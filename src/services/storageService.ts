/**
 * Universal Offline-First Storage Service
 * Works seamlessly across React Native (Android/iOS) and Web (Edge/Firefox).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Character, ChatMessage, Persona, ProviderConfig, AppSettings } from '../types';

const KEYS = {
  CHARACTERS: '@nekochat:characters',
  MESSAGES: '@nekochat:messages',
  PERSONAS: '@nekochat:personas',
  PROVIDER_CONFIG: '@nekochat:provider_config',
  APP_SETTINGS: '@nekochat:app_settings',
  COMMENT_CACHE: '@nekochat:comment_cache_',
};

const DEFAULT_SETTINGS: AppSettings = {
  chatStyle: 'bubble',
  syntaxColors: {
    dialogue: '#FFFFFF',
    narration: '#94A3B8',
    thoughts: '#818CF8',
    emphasis: '#CCFF00',
  },
  showTokenCounter: true,
  currency: 'IDR',
  language: 'en-US',
};

const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  provider: 'gemini',
  apiKey: '',
  model: 'gemini-2.5-flash',
  imageProvider: 'pollinations',
};

export const storageService = {
  // --- Characters ---
  async getCharacters(): Promise<Character[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.CHARACTERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async saveCharacters(characters: Character[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.CHARACTERS, JSON.stringify(characters));
  },

  async upsertCharacter(character: Character): Promise<void> {
    const list = await this.getCharacters();
    const index = list.findIndex(c => c.id === character.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...character };
    } else {
      list.unshift(character);
    }
    await this.saveCharacters(list);
  },

  async toggleFavorite(characterId: string): Promise<boolean> {
    const list = await this.getCharacters();
    const char = list.find(c => c.id === characterId);
    if (!char) return false;
    char.isFavorite = !char.isFavorite;
    await this.saveCharacters(list);
    return !!char.isFavorite;
  },

  // --- Messages ---
  async getMessages(characterId: string): Promise<ChatMessage[]> {
    try {
      const data = await AsyncStorage.getItem(`${KEYS.MESSAGES}:${characterId}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async saveMessages(characterId: string, messages: ChatMessage[]): Promise<void> {
    await AsyncStorage.setItem(`${KEYS.MESSAGES}:${characterId}`, JSON.stringify(messages));
    // Update lastActive timestamp on character
    const chars = await this.getCharacters();
    const char = chars.find(c => c.id === characterId);
    if (char) {
      char.lastActive = Date.now();
      char.totalChats = messages.length;
      await this.saveCharacters(chars);
    }
  },

  async appendMessage(characterId: string, message: ChatMessage): Promise<void> {
    const messages = await this.getMessages(characterId);
    messages.push(message);
    await this.saveMessages(characterId, messages);
  },

  // --- Personas ---
  async getPersonas(): Promise<Persona[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.PERSONAS);
      if (!data) {
        const defaultPersona: Persona = {
          id: 'default-user',
          name: 'Ren',
          description: 'A relaxed college student with a curious mind.',
          isDefault: true,
        };
        await AsyncStorage.setItem(KEYS.PERSONAS, JSON.stringify([defaultPersona]));
        return [defaultPersona];
      }
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  async savePersonas(personas: Persona[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.PERSONAS, JSON.stringify(personas));
  },

  // --- Settings & Provider ---
  async getSettings(): Promise<AppSettings> {
    try {
      const data = await AsyncStorage.getItem(KEYS.APP_SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  async saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(KEYS.APP_SETTINGS, JSON.stringify(updated));
    return updated;
  },

  async getProviderConfig(): Promise<ProviderConfig> {
    try {
      const data = await AsyncStorage.getItem(KEYS.PROVIDER_CONFIG);
      return data ? { ...DEFAULT_PROVIDER_CONFIG, ...JSON.parse(data) } : DEFAULT_PROVIDER_CONFIG;
    } catch {
      return DEFAULT_PROVIDER_CONFIG;
    }
  },

  async saveProviderConfig(config: Partial<ProviderConfig>): Promise<ProviderConfig> {
    const current = await this.getProviderConfig();
    const updated = { ...current, ...config };
    await AsyncStorage.setItem(KEYS.PROVIDER_CONFIG, JSON.stringify(updated));
    return updated;
  },

  // --- 24h Comment Cache Protection ---
  async getCachedComments(characterId: string): Promise<any[] | null> {
    try {
      const raw = await AsyncStorage.getItem(`${KEYS.COMMENT_CACHE}${characterId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Valid for 24 hours
      if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
        return null;
      }
      return parsed.comments;
    } catch {
      return null;
    }
  },

  async setCachedComments(characterId: string, comments: any[]): Promise<void> {
    await AsyncStorage.setItem(
      `${KEYS.COMMENT_CACHE}${characterId}`,
      JSON.stringify({ timestamp: Date.now(), comments })
    );
  },
};

