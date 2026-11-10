/**
 * Universal Offline-First Storage Service
 * Works seamlessly across React Native (Android/iOS) and Web (Edge/Firefox).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Character, ChatMessage, Persona, ProviderConfig, AppSettings } from '../types';

const KEYS = {
  CHARACTERS: '@nekochat:characters',
  USER_CHARACTERS: '@nekochat:user_characters',
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
  // --- Active Chat History Characters ---
  async getCharacters(): Promise<Character[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.CHARACTERS);
      if (!data) return [];
      const list: Character[] = JSON.parse(data);
      // Auto-purge any legacy mock characters from previous runs
      const cleaned = list.filter(c => 
        !c.id.startsWith('kaito-') && 
        !c.id.startsWith('synthia-') && 
        !c.id.startsWith('ren-') && 
        !c.id.startsWith('lunaria-') && 
        !c.id.startsWith('haru-') && 
        !c.avatar.includes('images.unsplash.com')
      );
      if (cleaned.length !== list.length) {
        await this.saveCharacters(cleaned);
      }
      return cleaned;
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

  // --- User Created Cards (Studio) ---
  async getUserCharacters(): Promise<Character[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.USER_CHARACTERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async saveUserCharacters(characters: Character[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.USER_CHARACTERS, JSON.stringify(characters));
  },

  async upsertUserCharacter(character: Character): Promise<void> {
    const list = await this.getUserCharacters();
    const index = list.findIndex(c => c.id === character.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...character };
    } else {
      list.unshift(character);
    }
    await this.saveUserCharacters(list);
  },

  async deleteUserCharacter(characterId: string): Promise<void> {
    const list = await this.getUserCharacters();
    const filtered = list.filter(c => c.id !== characterId);
    await this.saveUserCharacters(filtered);
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
          id: 'per_default',
          name: 'Ren',
          pronouns: 'he/him',
          description: 'A relaxed student with an observant mind and quiet curiosity.',
          avatar: 'https://avatars.charhub.io/avatars/hiro_mc/irresistible-riley-e91d140ac49d/avatar.webp',
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

  async upsertPersona(persona: Persona): Promise<void> {
    const list = await this.getPersonas();
    const index = list.findIndex(p => p.id === persona.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...persona };
    } else {
      list.unshift(persona);
    }
    await this.savePersonas(list);
  },

  async deletePersona(personaId: string): Promise<void> {
    const list = await this.getPersonas();
    if (list.length <= 1) return; // Keep at least one persona
    const filtered = list.filter(p => p.id !== personaId);
    if (!filtered.some(p => p.isDefault)) {
      filtered[0].isDefault = true;
    }
    await this.savePersonas(filtered);
  },

  async setDefaultPersona(personaId: string): Promise<void> {
    const list = await this.getPersonas();
    const updated = list.map(p => ({
      ...p,
      isDefault: p.id === personaId,
    }));
    await this.savePersonas(updated);
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
