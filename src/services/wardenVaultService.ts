/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import CryptoJS from 'crypto-js';
import { Share } from 'react-native';
import {
  Character,
  Conversation,
  Lorebook,
  Persona,
  GlobalChatBackground,
  BotRulePreset
} from '../types';
import { storageService } from './storageService';

export interface WardenVaultPayload {
  format: 'warden-vault';
  version: 1;
  exportedAt: string;
  app: 'Warden AI' | 'NekoChat';
  personas: Persona[];
  conversations: Conversation[];
  characters: Character[];
  botRulePresets: BotRulePreset[];
  lorebooks?: Lorebook[];
  globalBackground?: GlobalChatBackground;
}

export interface WardenEncryptedEnvelope {
  wardenEnvelope: 'WARDEN_VAULT_V1';
  format: 'warden';
  version: 1;
  algorithm: 'AES-256' | 'AES-GCM-256';
  kdf: 'PBKDF2';
  hasCustomPassword: boolean;
  ciphertext: string;
  salt?: string;
  iv?: string;
  exportedAt: string;
}

export interface VaultExportStats {
  personasCount: number;
  conversationsCount: number;
  messagesCount: number;
  rulesCount: number;
  charactersCount: number;
}

export interface VaultImportStats {
  personasAdded: number;
  conversationsAdded: number;
  messagesAdded: number;
  rulesAdded: number;
  charactersAdded: number;
}

const DEFAULT_VAULT_KEY = 'WardenAI_ClientStorage_Vault_Key_v1_ZeroAuth';

export class WardenVaultService {
  /**
   * Exports all personas, conversations (with complete history), characters, and custom rules into
   * an encrypted .warden file. Excludes all provider API credentials.
   * Uses pure-JS AES encryption so it works seamlessly on Android, iOS, and Web.
   */
  public async exportVault(
    userId: string = 'default-user',
    password?: string
  ): Promise<{ filename: string; stats: VaultExportStats; rawContent: string }> {
    const hasCustomPassword = Boolean(password && password.trim().length > 0);
    const effectivePass = hasCustomPassword ? password!.trim() : DEFAULT_VAULT_KEY;

    // Collect all data entities asynchronously from storage
    const personas = await storageService.getPersonas();
    const conversations = await storageService.getConversations(userId);
    const characters = await storageService.getCharacters();
    const allRules = await storageService.getBotRulePresets();
    const customRules = allRules.filter(p => !p.isBuiltin);
    const lorebooks = await storageService.getLorebooks();
    const globalBackground = await storageService.getGlobalChatBackground();

    const messagesCount = conversations.reduce((acc, c) => acc + (c.messages?.length || 0), 0);

    const stats: VaultExportStats = {
      personasCount: personas.length,
      conversationsCount: conversations.length,
      messagesCount,
      rulesCount: customRules.length,
      charactersCount: characters.length
    };

    const payload: WardenVaultPayload = {
      format: 'warden-vault',
      version: 1,
      exportedAt: new Date().toISOString(),
      app: 'NekoChat',
      personas,
      conversations,
      characters,
      botRulePresets: customRules,
      lorebooks,
      globalBackground: globalBackground || undefined
    };

    const plaintextJson = JSON.stringify(payload);

    // Encrypt payload with AES-256
    const encryptedCiphertext = CryptoJS.AES.encrypt(plaintextJson, effectivePass).toString();

    const envelope: WardenEncryptedEnvelope = {
      wardenEnvelope: 'WARDEN_VAULT_V1',
      format: 'warden',
      version: 1,
      algorithm: 'AES-256',
      kdf: 'PBKDF2',
      hasCustomPassword,
      ciphertext: encryptedCiphertext,
      exportedAt: payload.exportedAt
    };

    const envelopeString = JSON.stringify(envelope, null, 2);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const filename = `warden-${year}-${month}-${day}-${hours}${minutes}.warden`;

    return { filename, stats, rawContent: envelopeString };
  }

  /**
   * Inspects a .warden file content to check whether it's valid and requires a password.
   */
  public inspectVaultFile(rawContent: string): {
    isValid: boolean;
    hasCustomPassword: boolean;
    version?: number;
    exportedAt?: string;
    error?: string;
  } {
    try {
      const parsed = JSON.parse(rawContent.trim());
      if (parsed.wardenEnvelope !== 'WARDEN_VAULT_V1' && parsed.format !== 'warden') {
        return {
          isValid: false,
          hasCustomPassword: false,
          error: 'File is not a valid Warden AI encrypted vault (.warden).'
        };
      }
      return {
        isValid: true,
        hasCustomPassword: Boolean(parsed.hasCustomPassword),
        version: parsed.version || 1,
        exportedAt: parsed.exportedAt
      };
    } catch {
      return {
        isValid: false,
        hasCustomPassword: false,
        error: 'Invalid file format. Could not parse .warden structure.'
      };
    }
  }

  /**
   * Decrypts and imports a .warden vault file.
   * Non-destructive: preserves all existing data and merges imported items!
   */
  public async importVault(
    rawContent: string,
    currentUserId: string = 'default-user',
    password?: string
  ): Promise<{ success: boolean; stats: VaultImportStats; error?: string }> {
    try {
      const envelope: WardenEncryptedEnvelope = JSON.parse(rawContent.trim());
      if (envelope.wardenEnvelope !== 'WARDEN_VAULT_V1' && envelope.format !== 'warden') {
        return {
          success: false,
          stats: { personasAdded: 0, conversationsAdded: 0, messagesAdded: 0, rulesAdded: 0, charactersAdded: 0 },
          error: 'Invalid .warden envelope format.'
        };
      }

      const effectivePass = envelope.hasCustomPassword
        ? (password || '').trim()
        : DEFAULT_VAULT_KEY;

      if (envelope.hasCustomPassword && !effectivePass) {
        return {
          success: false,
          stats: { personasAdded: 0, conversationsAdded: 0, messagesAdded: 0, rulesAdded: 0, charactersAdded: 0 },
          error: 'Password is required to decrypt this .warden vault.'
        };
      }

      let decryptedJson = '';

      // Decrypt using CryptoJS AES
      try {
        const bytes = CryptoJS.AES.decrypt(envelope.ciphertext, effectivePass);
        decryptedJson = bytes.toString(CryptoJS.enc.Utf8);
        if (!decryptedJson) {
          return {
            success: false,
            stats: { personasAdded: 0, conversationsAdded: 0, messagesAdded: 0, rulesAdded: 0, charactersAdded: 0 },
            error: 'Decryption failed: Incorrect password or corrupted vault file.'
          };
        }
      } catch {
        return {
          success: false,
          stats: { personasAdded: 0, conversationsAdded: 0, messagesAdded: 0, rulesAdded: 0, charactersAdded: 0 },
          error: 'Decryption failed: Incorrect password or corrupted vault file.'
        };
      }

      const payload: WardenVaultPayload = JSON.parse(decryptedJson);

      // ─── NON-DESTRUCTIVE MERGE ───

      // 1. Personas: Add without overwriting existing
      const existingPersonas = await storageService.getPersonas();
      const existingPersonaIds = new Set(existingPersonas.map(p => p.id));
      const existingPersonaNames = new Set(existingPersonas.map(p => p.name.trim().toLowerCase()));

      let personasAdded = 0;
      if (Array.isArray(payload.personas)) {
        for (const p of payload.personas) {
          let finalId = p.id;
          let finalName = p.name;

          if (existingPersonaIds.has(finalId)) {
            finalId = `persona_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          }
          if (existingPersonaNames.has(finalName.trim().toLowerCase())) {
            finalName = `${finalName} (Imported)`;
          }

          await storageService.upsertPersona({
            ...p,
            id: finalId,
            name: finalName,
            userId: currentUserId
          });

          existingPersonaIds.add(finalId);
          existingPersonaNames.add(finalName.trim().toLowerCase());
          personasAdded++;
        }
      }

      // 2. Conversations & History: Preserve existing, append imported
      const existingConvs = await storageService.getConversations(currentUserId);
      const existingConvIds = new Set(existingConvs.map(c => c.id));

      let conversationsAdded = 0;
      let messagesAdded = 0;
      if (Array.isArray(payload.conversations)) {
        for (const conv of payload.conversations) {
          let finalId = conv.id;
          if (existingConvIds.has(finalId)) {
            finalId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          }

          await storageService.upsertConversation({
            ...conv,
            id: finalId,
            userId: currentUserId
          });

          existingConvIds.add(finalId);
          conversationsAdded++;
          messagesAdded += conv.messages?.length || 0;
        }
      }

      // 3. Custom Bot Rules / Prompts
      const existingRules = await storageService.getBotRulePresets();
      const existingRuleNames = new Set(existingRules.map(r => r.name.trim().toLowerCase()));

      let rulesAdded = 0;
      if (Array.isArray(payload.botRulePresets)) {
        for (const rule of payload.botRulePresets) {
          if (!rule.isBuiltin) {
            let finalName = rule.name;
            if (existingRuleNames.has(finalName.trim().toLowerCase())) {
              finalName = `${finalName} (Imported)`;
            }

            await storageService.saveBotRulePreset({
              ...rule,
              id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              name: finalName
            });

            existingRuleNames.add(finalName.trim().toLowerCase());
            rulesAdded++;
          }
        }
      }

      // 4. Characters
      const existingChars = await storageService.getCharacters();
      const existingCharIds = new Set(existingChars.map(c => c.id));

      let charactersAdded = 0;
      if (Array.isArray(payload.characters)) {
        for (const char of payload.characters) {
          let finalId = char.id;
          if (existingCharIds.has(finalId)) {
            finalId = `char_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          }

          await storageService.upsertCharacter({
            ...char,
            id: finalId
          });

          existingCharIds.add(finalId);
          charactersAdded++;
        }
      }

      // 5. Lorebooks
      if (Array.isArray(payload.lorebooks)) {
        for (const lb of payload.lorebooks) {
          await storageService.upsertLorebook(lb);
        }
      }

      // 6. Global Background (optional)
      if (payload.globalBackground) {
        await storageService.saveGlobalChatBackground(payload.globalBackground);
      }

      return {
        success: true,
        stats: {
          personasAdded,
          conversationsAdded,
          messagesAdded,
          rulesAdded,
          charactersAdded
        }
      };
    } catch (err: any) {
      return {
        success: false,
        stats: { personasAdded: 0, conversationsAdded: 0, messagesAdded: 0, rulesAdded: 0, charactersAdded: 0 },
        error: err?.message || 'Failed to import .warden vault.'
      };
    }
  }

  /**
   * Shares the encrypted .warden backup file via native platform Share sheet
   */
  public async shareVaultFile(
    rawContent: string,
    filename: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await Share.share(
        {
          message: rawContent,
          title: filename
        },
        {
          dialogTitle: `Export ${filename}`
        }
      );
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to share backup file.' };
    }
  }
}

export const wardenVaultService = new WardenVaultService();
export default wardenVaultService;
