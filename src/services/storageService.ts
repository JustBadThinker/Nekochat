/**
 * Universal Offline-First Storage Service
 * Works seamlessly across React Native (Android/iOS) and Web (Edge/Firefox).
 * Full support for Vault backup/restore, followed creators, and community favorites.
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
  FOLLOWED_CREATORS: '@nekochat:followed_creators',
  COMMUNITY_FAVORITES: '@nekochat:community_favorites',
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

  // --- Followed Creators ---
  async getFollowedCreators(): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.FOLLOWED_CREATORS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async toggleFollowCreator(creator: string): Promise<boolean> {
    const cleanHandle = creator.replace(/^@/, '').trim();
    const list = await this.getFollowedCreators();
    const exists = list.includes(cleanHandle);
    let updated: string[];
    if (exists) {
      updated = list.filter(c => c !== cleanHandle);
    } else {
      updated = [...list, cleanHandle];
    }
    await AsyncStorage.setItem(KEYS.FOLLOWED_CREATORS, JSON.stringify(updated));
    return !exists;
  },

  async isFollowingCreator(creator: string): Promise<boolean> {
    const cleanHandle = creator.replace(/^@/, '').trim();
    const list = await this.getFollowedCreators();
    return list.includes(cleanHandle);
  },

  // --- Community Favorites / Bookmarks ---
  async getCommunityFavorites(): Promise<Character[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.COMMUNITY_FAVORITES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async toggleCommunityFavorite(char: Character): Promise<boolean> {
    const list = await this.getCommunityFavorites();
    const idx = list.findIndex(c => c.id === char.id);
    let updated: Character[];
    let isNowFavorite = false;
    if (idx >= 0) {
      updated = list.filter(c => c.id !== char.id);
    } else {
      updated = [{ ...char, isFavorite: true }, ...list];
      isNowFavorite = true;
    }
    await AsyncStorage.setItem(KEYS.COMMUNITY_FAVORITES, JSON.stringify(updated));
    return isNowFavorite;
  },

  async isCommunityFavorite(id: string): Promise<boolean> {
    const list = await this.getCommunityFavorites();
    return list.some(c => c.id === id);
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
    if (list.length <= 1) return;
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

  // --- Vault Export & Import ---
  async exportVaultData(): Promise<string> {
    const characters = await this.getCharacters();
    const userCharacters = await this.getUserCharacters();
    const personas = await this.getPersonas();
    const settings = await this.getSettings();
    const providerConfig = await this.getProviderConfig();
    const favorites = await this.getCommunityFavorites();
    const followedCreators = await this.getFollowedCreators();

    const vaultPayload = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      appName: 'NekoChat',
      data: {
        characters,
        userCharacters,
        personas,
        settings,
        providerConfig,
        favorites,
        followedCreators,
      },
    };

    return JSON.stringify(vaultPayload, null, 2);
  },

  async importVaultData(jsonStr: string): Promise<{ characters: number; personas: number }> {
    try {
      const parsed = JSON.parse(jsonStr);
      const data = parsed.data || parsed;
      let charCount = 0;
      let persCount = 0;

      if (Array.isArray(data.characters)) {
        await this.saveCharacters(data.characters);
        charCount += data.characters.length;
      }
      if (Array.isArray(data.userCharacters)) {
        await this.saveUserCharacters(data.userCharacters);
      }
      if (Array.isArray(data.personas)) {
        await this.savePersonas(data.personas);
        persCount = data.personas.length;
      }
      if (data.settings) {
        await this.saveSettings(data.settings);
      }
      if (data.providerConfig) {
        await this.saveProviderConfig(data.providerConfig);
      }
      if (Array.isArray(data.favorites)) {
        await AsyncStorage.setItem(KEYS.COMMUNITY_FAVORITES, JSON.stringify(data.favorites));
      }
      if (Array.isArray(data.followedCreators)) {
        await AsyncStorage.setItem(KEYS.FOLLOWED_CREATORS, JSON.stringify(data.followedCreators));
      }

      return { characters: charCount, personas: persCount };
    } catch (err: any) {
      throw new Error('Invalid vault file format: ' + err.message);
    }
  },

  async clearAllCache(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const commentKeys = keys.filter(k => k.startsWith(KEYS.COMMENT_CACHE));
    await AsyncStorage.multiRemove(commentKeys);
  },
};
