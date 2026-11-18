/**
 * Universal Offline-First Storage Service
 * Native Expo / React Native Compatible
 *
 * Full Source-Driven Parity with Warden AI Storage Architecture:
 * - Multi-session Conversation Engine
 * - Lorebook Codex Persistence
 * - Bot Rule Presets
 * - Multi-Persona Management
 * - Global Background Customization
 * - 100% Backward Compatibility with legacy @nekochat keys
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateLegacyProviderConfig } from './promptBudget';
import { getSqliteConversationRepository, SqliteConversationRepository } from './sqliteDatabase';
import {
  getDefaultSecureStoreDriver,
  hydrateProviderSecrets,
  removeProviderSecrets,
  stripAndPersistProviderSecrets,
} from './secureKeyStore';
import {
  Character,
  ChatMessage,
  Conversation,
  Lorebook,
  Persona,
  ProviderConfig,
  AppSettings,
  BotRulePreset,
  GlobalChatBackground,
} from '../types';

const SQLITE_MIGRATION_FLAG = '@nekochat_sqlite_migration_v1';
let migrationPromise: Promise<SqliteConversationRepository | null> | null = null;

async function ensureSqliteRepo(): Promise<SqliteConversationRepository | null> {
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    const repo = await getSqliteConversationRepository();
    if (!repo) return null;

    try {
      const done = await AsyncStorage.getItem(SQLITE_MIGRATION_FLAG);
      if (done !== 'completed') {
        const legacyRaw = await AsyncStorage.getItem(KEYS.CONVERSATIONS);
        const legacyConvs: Conversation[] = legacyRaw ? JSON.parse(legacyRaw) : [];
        const result = await repo.migrateFromLegacyConversations(
          Array.isArray(legacyConvs) ? legacyConvs : []
        );
        if (result.verified) {
          await AsyncStorage.setItem(SQLITE_MIGRATION_FLAG, 'completed');
        } else {
          // Verification failed — keep AsyncStorage authoritative
          return null;
        }
      }
      return repo;
    } catch (err) {
      console.warn('[StorageService] SQLite migration error, using AsyncStorage:', (err as any)?.message || err);
      return null;
    }
  })();
  return migrationPromise;
}

const KEYS = {
  CHARACTERS: '@nekochat:characters',
  USER_CHARACTERS: '@nekochat:user_characters',
  MESSAGES: '@nekochat:messages',
  CONVERSATIONS: '@nekochat:conversations',
  PERSONAS: '@nekochat:personas',
  LOREBOOKS: '@nekochat:lorebooks',
  BOT_RULES: '@nekochat:bot_rules',
  GLOBAL_BACKGROUND: '@nekochat:global_background',
  PROVIDERS: '@nekochat:providers',
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
    thoughts: '#38BDF8',
    emphasis: '#CCFF00',
  },
  showTokenCounter: true,
  currency: 'IDR',
  language: 'en-US',
  uiLanguage: 'en',
  autoLanguagePrompt: false,
  languageCustomPrompt: '',
  hasCompletedOnboarding: false,
  passcodeEnabled: false,
  passcodePin: '',
  backendUrl: '',
  enableExternalCatalogs: true,
  autoMemoryEnabled: false,
};

const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  provider: 'gemini',
  providerType: 'gemini',
  apiKey: '',
  model: 'gemini-2.5-flash',
  defaultModel: 'gemini-2.5-flash',
  imageProvider: 'pollinations',
};

export const INITIAL_PROVIDERS: ProviderConfig[] = [
  {
    id: 'prov_gemini',
    userId: 'default_user',
    provider: 'gemini',
    providerType: 'gemini',
    name: 'Google Gemini Pro / Flash',
    apiKey: '',
    model: 'gemini-2.5-flash',
    defaultModel: 'gemini-2.5-flash',
    temperature: 0.8,
    topP: 0.95,
    maxTokens: 4096,
    userConfiguredContextLimit: false,
    userConfiguredMaxTokens: false,
    streaming: true,
    isDefault: true,
  },
  {
    id: 'prov_openrouter',
    userId: 'default_user',
    provider: 'openrouter',
    providerType: 'openrouter',
    name: 'OpenRouter (Claude / Llama / DeepSeek)',
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    customEndpoint: 'https://openrouter.ai/api/v1',
    model: 'anthropic/claude-3.5-sonnet',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    temperature: 0.8,
    topP: 0.95,
    maxTokens: 4096,
    userConfiguredContextLimit: false,
    userConfiguredMaxTokens: false,
    streaming: true,
    isDefault: false,
  },
  {
    id: 'prov_openai',
    userId: 'default_user',
    provider: 'openai',
    providerType: 'openai',
    name: 'OpenAI (GPT-4o / GPT-4o-mini)',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    customEndpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    defaultModel: 'gpt-4o-mini',
    temperature: 0.8,
    topP: 0.9,
    maxTokens: 4096,
    userConfiguredContextLimit: false,
    userConfiguredMaxTokens: false,
    streaming: true,
    isDefault: false,
  },
  {
    id: 'prov_custom',
    userId: 'default_user',
    provider: 'custom',
    providerType: 'custom',
    name: 'AI Gateway / Custom Reverse Proxy',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    customEndpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    defaultModel: 'gpt-4o-mini',
    temperature: 0.8,
    topP: 0.9,
    maxTokens: 4096,
    userConfiguredContextLimit: false,
    userConfiguredMaxTokens: false,
    streaming: true,
    isDefault: false,
  },
];

export const INITIAL_BOT_RULES: BotRulePreset[] = [
  {
    id: 'rule_immersive_rp',
    name: 'Dynamic Narrative & Sensual Depth',
    category: 'roleplay',
    description: 'Enforces literary third-person prose, sensory details, and organic emotional pacing.',
    ruleText:
      'Write in evocative third-person limited perspective. Emphasize physical sensations, nuanced body language, subtle vocal inflections, and atmospheric details. Avoid repetitive dialogue loops and allow organic dramatic tension to build naturally.',
    isBuiltin: true,
    isActive: true,
  },
  {
    id: 'rule_anti_loop',
    name: 'Anti-Repetition & Progressive Momentum',
    category: 'behavior',
    description: 'Prevents the AI from echoing user phrasing or stalling the scene in circular dialogue.',
    ruleText:
      'Never echo or summarize the user’s last turn. Advance the physical scene, introduce subtle environmental shifts, or make decisive character actions instead of asking passive questions.',
    isBuiltin: true,
    isActive: true,
  },
  {
    id: 'rule_formatting_syntax',
    name: 'Color-Coded Roleplay Formatting',
    category: 'formatting',
    description: 'Quotes for spoken dialogue, asterisks for actions, parentheses for thoughts.',
    ruleText:
      'Always wrap spoken dialogue in double quotation marks ("..."). Wrap actions, narrative prose, and physical gestures in single asterisks (*...*). Enclose internal monologue or unspoken thoughts in parentheses ((...)).',
    isBuiltin: true,
    isActive: true,
  },
];

export const storageService = {
  // ═══════════════════════════════════════════════════════════════════════
  // 1. CHARACTERS (MY LIBRARY)
  // ═══════════════════════════════════════════════════════════════════════
  async getCharacters(): Promise<Character[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.CHARACTERS);
      if (!data) return [];
      const list: Character[] = JSON.parse(data);
      // Auto-purge any legacy mock characters from early prototypes
      const cleaned = list.filter(
        c =>
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

  async deleteCharacter(characterId: string): Promise<void> {
    const list = await this.getCharacters();
    await this.saveCharacters(list.filter(c => c.id !== characterId));
    const repo = await ensureSqliteRepo();
    if (repo) {
      await repo.deleteConversationsForCharacter(characterId);
      return;
    }
    const convs = await this.getConversations();
    await this.saveConversations(convs.filter(c => c.characterId !== characterId));
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 2. MULTI-SESSION CONVERSATIONS (SQLITE + ASYNCSTORAGE FALLBACK)
  // ═══════════════════════════════════════════════════════════════════════
  async getConversations(userId?: string): Promise<Conversation[]> {
    try {
      const repo = await ensureSqliteRepo();
      if (repo) {
        return await repo.getConversations(userId);
      }
      const data = await AsyncStorage.getItem(KEYS.CONVERSATIONS);
      if (!data) return [];
      const list: Conversation[] = JSON.parse(data);
      if (userId) {
        return list.filter(c => c.userId === userId);
      }
      return list;
    } catch {
      return [];
    }
  },

  async getConversation(id: string): Promise<Conversation | null> {
    const repo = await ensureSqliteRepo();
    if (repo) {
      return await repo.getConversation(id);
    }
    const list = await this.getConversations();
    return list.find(c => c.id === id) || null;
  },

  async getConversationsForCharacter(characterId: string): Promise<Conversation[]> {
    const repo = await ensureSqliteRepo();
    if (repo) {
      return await repo.getConversationsForCharacter(characterId);
    }
    const list = await this.getConversations();
    return list.filter(c => c.characterId === characterId);
  },

  async saveConversations(conversations: Conversation[]): Promise<void> {
    const repo = await ensureSqliteRepo();
    if (repo) {
      await repo.saveAllConversations(conversations);
      return;
    }
    await AsyncStorage.setItem(KEYS.CONVERSATIONS, JSON.stringify(conversations));
  },

  async createConversation(
    character: Character,
    personaId: string,
    providerId: string,
    scenarioId?: string,
    scenarioTitle?: string
  ): Promise<Conversation> {
    const now = new Date().toISOString();
    const convId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Initial greeting message
    let openingText = character.firstMessage;
    if (scenarioId && character.scenarios) {
      const scen = character.scenarios.find(s => s.id === scenarioId);
      if (scen?.openingMessage) {
        openingText = scen.openingMessage;
      }
    }

    const firstMsg: ChatMessage = {
      id: `msg_first_${Date.now()}`,
      conversationId: convId,
      characterId: character.id,
      role: 'assistant',
      sender: 'character',
      senderRole: 'assistant',
      content: openingText,
      timestamp: Date.now(),
    };

    const newConv: Conversation = {
      id: convId,
      userId: 'user_local_01',
      characterId: character.id,
      scenarioId,
      scenarioTitle: scenarioTitle || (scenarioId ? 'Custom Scenario' : 'Default Encounter'),
      personaId,
      providerId,
      title: character.name,
      messages: [firstMsg],
      messageCount: 1,
      createdAt: now,
      updatedAt: now,
      tokenOptimizer: 'off',
    };

    const repo = await ensureSqliteRepo();
    if (repo) {
      await repo.upsertConversation(newConv);
      return newConv;
    }

    const list = await this.getConversations();
    list.unshift(newConv);
    await this.saveConversations(list);

    // Also mirror to legacy message key for backwards compatibility when SQLite is inactive
    await AsyncStorage.setItem(`${KEYS.MESSAGES}:${character.id}`, JSON.stringify([firstMsg]));

    return newConv;
  },

  /**
   * Native SQLite-only atomic conversation branching.
   * Returns `null` on Web (AsyncStorage lacks atomic multi-key transactions).
   */
  async branchConversation(params: {
    sourceConversationId: string;
    characterId: string;
    branchMessageId: string;
    title?: string;
  }): Promise<{
    conversation: Conversation;
    branchTurnIndex: number;
    sourceMessageCount: number;
    copiedMemoriesCount: number;
    excludedMemoriesCount: number;
  } | null> {
    const repo = await ensureSqliteRepo();
    if (!repo) return null;
    return await repo.branchConversationAtMessage(params);
  },

  async appendMessageToConversation(conversationId: string, message: ChatMessage): Promise<void> {
    const repo = await ensureSqliteRepo();
    if (repo) {
      await repo.appendMessageToConversation(conversationId, message);
      const conv = await repo.getConversation(conversationId);
      if (conv) {
        const chars = await this.getCharacters();
        const char = chars.find(c => c.id === conv.characterId);
        if (char) {
          char.lastActive = Date.now();
          char.totalChats = conv.messages.length;
          await this.saveCharacters(chars);
        }
      }
      return;
    }

    const list = await this.getConversations();
    const conv = list.find(c => c.id === conversationId);
    if (!conv) return;

    message.conversationId = conversationId;
    conv.messages.push(message);
    conv.messageCount = conv.messages.length;
    conv.updatedAt = new Date().toISOString();

    await this.saveConversations(list);

    // Also sync to legacy message cache
    await AsyncStorage.setItem(`${KEYS.MESSAGES}:${conv.characterId}`, JSON.stringify(conv.messages));

    // Update character's lastActive and totalChats
    const chars = await this.getCharacters();
    const char = chars.find(c => c.id === conv.characterId);
    if (char) {
      char.lastActive = Date.now();
      char.totalChats = conv.messages.length;
      await this.saveCharacters(chars);
    }
  },

  async updateConversation(updated: Conversation): Promise<void> {
    const repo = await ensureSqliteRepo();
    if (repo) {
      await repo.upsertConversation({ ...updated, updatedAt: new Date().toISOString() });
      return;
    }
    const list = await this.getConversations();
    const index = list.findIndex(c => c.id === updated.id);
    if (index >= 0) {
      list[index] = { ...updated, updatedAt: new Date().toISOString() };
      await this.saveConversations(list);
    }
  },

  async upsertConversation(conversation: Conversation): Promise<void> {
    const repo = await ensureSqliteRepo();
    if (repo) {
      const existing = await repo.getConversation(conversation.id);
      await repo.upsertConversation(
        existing
          ? { ...existing, ...conversation, updatedAt: new Date().toISOString() }
          : conversation
      );
      return;
    }
    const list = await this.getConversations();
    const index = list.findIndex(c => c.id === conversation.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...conversation, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(conversation);
    }
    await this.saveConversations(list);
  },

  async deleteConversation(conversationId: string): Promise<void> {
    const repo = await ensureSqliteRepo();
    if (repo) {
      await repo.deleteConversation(conversationId);
      return;
    }
    const list = await this.getConversations();
    const filtered = list.filter(c => c.id !== conversationId);
    await this.saveConversations(filtered);
  },

  async togglePinConversation(conversationId: string): Promise<boolean> {
    const list = await this.getConversations();
    const conv = list.find(c => c.id === conversationId);
    if (!conv) return false;
    conv.isPinned = !conv.isPinned;
    await this.saveConversations(list);
    return !!conv.isPinned;
  },

  async toggleArchiveConversation(conversationId: string): Promise<boolean> {
    const list = await this.getConversations();
    const conv = list.find(c => c.id === conversationId);
    if (!conv) return false;
    conv.isArchived = !conv.isArchived;
    await this.saveConversations(list);
    return !!conv.isArchived;
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 3. MESSAGES (LEGACY BACKWARD COMPATIBILITY BRIDGE)
  // ═══════════════════════════════════════════════════════════════════════
  async getMessages(characterId: string): Promise<ChatMessage[]> {
    try {
      const data = await AsyncStorage.getItem(`${KEYS.MESSAGES}:${characterId}`);
      if (data) return JSON.parse(data);

      // Check if a Conversation exists for this character
      const convs = await this.getConversationsForCharacter(characterId);
      if (convs.length > 0 && convs[0].messages) {
        return convs[0].messages;
      }
      return [];
    } catch {
      return [];
    }
  },

  async saveMessages(characterId: string, messages: ChatMessage[]): Promise<void> {
    await AsyncStorage.setItem(`${KEYS.MESSAGES}:${characterId}`, JSON.stringify(messages));

    // Mirror to active conversation if exists
    const allConvs = await this.getConversations();
    const convIndex = allConvs.findIndex(c => c.characterId === characterId);
    if (convIndex >= 0) {
      allConvs[convIndex].messages = messages;
      allConvs[convIndex].messageCount = messages.length;
      allConvs[convIndex].updatedAt = new Date().toISOString();
      await this.saveConversations(allConvs);
    }

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

  // ═══════════════════════════════════════════════════════════════════════
  // 4. LOREBOOKS & ENTRIES
  // ═══════════════════════════════════════════════════════════════════════
  async getLorebooks(userId?: string): Promise<Lorebook[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.LOREBOOKS);
      if (!data) return [];
      const list: Lorebook[] = JSON.parse(data);
      if (userId) return list.filter(l => l.userId === userId);
      return list;
    } catch {
      return [];
    }
  },

  async saveLorebooks(lorebooks: Lorebook[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.LOREBOOKS, JSON.stringify(lorebooks));
  },

  async upsertLorebook(lorebook: Lorebook): Promise<void> {
    const list = await this.getLorebooks();
    const index = list.findIndex(l => l.id === lorebook.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...lorebook };
    } else {
      list.unshift(lorebook);
    }
    await this.saveLorebooks(list);
  },

  async deleteLorebook(lorebookId: string): Promise<void> {
    const list = await this.getLorebooks();
    const filtered = list.filter(l => l.id !== lorebookId);
    await this.saveLorebooks(filtered);
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 5. BOT RULE PRESETS
  // ═══════════════════════════════════════════════════════════════════════
  async getBotRulePresets(): Promise<BotRulePreset[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.BOT_RULES);
      if (!data) {
        await AsyncStorage.setItem(KEYS.BOT_RULES, JSON.stringify(INITIAL_BOT_RULES));
        return INITIAL_BOT_RULES;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_BOT_RULES;
    }
  },

  async saveBotRulePresets(rules: BotRulePreset[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.BOT_RULES, JSON.stringify(rules));
  },

  async saveBotRulePreset(preset: BotRulePreset): Promise<void> {
    const list = await this.getBotRulePresets();
    const index = list.findIndex(r => r.id === preset.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...preset };
    } else {
      list.push(preset);
    }
    await this.saveBotRulePresets(list);
  },

  async toggleBotRule(ruleId: string): Promise<boolean> {
    const list = await this.getBotRulePresets();
    const rule = list.find(r => r.id === ruleId);
    if (!rule) return false;
    rule.isActive = !rule.isActive;
    await this.saveBotRulePresets(list);
    return rule.isActive;
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 6. GLOBAL CHAT BACKGROUND
  // ═══════════════════════════════════════════════════════════════════════
  async getGlobalChatBackground(): Promise<GlobalChatBackground | null> {
    try {
      const data = await AsyncStorage.getItem(KEYS.GLOBAL_BACKGROUND);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async saveGlobalChatBackground(bg: GlobalChatBackground): Promise<void> {
    await AsyncStorage.setItem(KEYS.GLOBAL_BACKGROUND, JSON.stringify(bg));
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 7. PERSONAS
  // ═══════════════════════════════════════════════════════════════════════
  async getPersonas(): Promise<Persona[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.PERSONAS);
      if (!data) {
        const defaultPersona: Persona = {
          id: 'per_default',
          name: 'Ren',
          pronouns: 'he/him',
          genderPronouns: 'He/Him',
          description: 'A relaxed student with an observant mind and quiet curiosity.',
          shortDescription: 'Observant student and calm companion.',
          appearance: 'Casual streetwear, dark unstyled hair, hazel eyes, calm posture.',
          personality: 'Thoughtful, perceptive, supportive, dry sense of humor under pressure.',
          background: 'Local university student who enjoys ambient late-night conversation.',
          roleInstructions: 'Engages naturally, listens attentively, and contributes thoughtful perspective.',
          avatar: '',
          isDefault: true,
          createdAt: new Date().toISOString(),
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

  // ═══════════════════════════════════════════════════════════════════════
  // 8. SOCIAL & COMMUNITY FAVORITES
  // ═══════════════════════════════════════════════════════════════════════
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
    const targetId = char.id || (char as any).characterId || '';
    if (!targetId) return false;
    const idx = list.findIndex(c => (c.id || (c as any).characterId) === targetId);
    let updated: Character[];
    let isNowFavorite = false;
    if (idx >= 0) {
      updated = list.filter(c => (c.id || (c as any).characterId) !== targetId);
    } else {
      updated = [{ ...char, id: targetId, isFavorite: true }, ...list];
      isNowFavorite = true;
    }
    await AsyncStorage.setItem(KEYS.COMMUNITY_FAVORITES, JSON.stringify(updated));
    return isNowFavorite;
  },

  async isCommunityFavorite(id: string): Promise<boolean> {
    if (!id) return false;
    const list = await this.getCommunityFavorites();
    return list.some(c => (c.id || (c as any).characterId) === id);
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 9. USER STUDIO CREATED CARDS
  // ═══════════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════════
  // 10. APP SETTINGS & AI PROVIDER CONFIG
  // ═══════════════════════════════════════════════════════════════════════
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
      const driver = await getDefaultSecureStoreDriver();
      const data = await AsyncStorage.getItem(KEYS.PROVIDER_CONFIG);
      let parsed: ProviderConfig | null = data
        ? migrateLegacyProviderConfig({ ...DEFAULT_PROVIDER_CONFIG, ...JSON.parse(data) })
        : null;

      // Migrate any legacy plaintext apiKey/imageApiKey in KEYS.PROVIDER_CONFIG to SecureStore
      if (parsed && (parsed.apiKey || parsed.imageApiKey)) {
        const { sanitized, migratedCount } = await stripAndPersistProviderSecrets(
          [parsed],
          driver,
          parsed.id || 'active_provider'
        );
        if (migratedCount > 0) {
          await AsyncStorage.setItem(KEYS.PROVIDER_CONFIG, JSON.stringify(sanitized[0]));
        }
      }

      if (parsed) {
        const [hydrated] = await hydrateProviderSecrets(
          [parsed],
          driver,
          parsed.id || 'active_provider'
        );
        parsed = hydrated;
      }

      // Also inspect the multi-provider list so a saved Custom Endpoint / OpenRouter / OpenAI key is never missed
      const list = await this.getProviders();
      if (list.length > 0) {
        const defaultWithKey =
          list.find(p => p.isDefault && p.apiKey) || list.find(p => p.apiKey) || list.find(p => p.isDefault);
        if (parsed && parsed.apiKey) {
          return parsed;
        }
        if (defaultWithKey) {
          return { ...DEFAULT_PROVIDER_CONFIG, ...(parsed || {}), ...defaultWithKey };
        }
      }
      return parsed || DEFAULT_PROVIDER_CONFIG;
    } catch {
      return DEFAULT_PROVIDER_CONFIG;
    }
  },

  async saveProviderConfig(config: Partial<ProviderConfig>): Promise<ProviderConfig> {
    const current = await this.getProviderConfig();
    const updated: ProviderConfig = { ...current, ...config };
    const driver = await getDefaultSecureStoreDriver();
    const { sanitized } = await stripAndPersistProviderSecrets(
      [updated],
      driver,
      updated.id || 'active_provider'
    );
    await AsyncStorage.setItem(KEYS.PROVIDER_CONFIG, JSON.stringify(sanitized[0]));
    return updated;
  },

  async getProviders(): Promise<ProviderConfig[]> {
    try {
      const driver = await getDefaultSecureStoreDriver();
      const data = await AsyncStorage.getItem(KEYS.PROVIDERS);
      if (!data) {
        await AsyncStorage.setItem(KEYS.PROVIDERS, JSON.stringify(INITIAL_PROVIDERS));
        return INITIAL_PROVIDERS;
      }
      const parsed: ProviderConfig[] = JSON.parse(data);
      const migrated = Array.isArray(parsed)
        ? parsed.map(p => migrateLegacyProviderConfig(p))
        : INITIAL_PROVIDERS;

      // One-time verified migration of any remaining plaintext keys in AsyncStorage
      const hasPlaintextSecrets = migrated.some(p => Boolean(p.apiKey || p.imageApiKey));
      if (hasPlaintextSecrets) {
        const { sanitized, migratedCount } = await stripAndPersistProviderSecrets(migrated, driver);
        if (migratedCount > 0) {
          await AsyncStorage.setItem(KEYS.PROVIDERS, JSON.stringify(sanitized));
        }
        return await hydrateProviderSecrets(sanitized, driver);
      }

      return await hydrateProviderSecrets(migrated, driver);
    } catch {
      return INITIAL_PROVIDERS;
    }
  },

  async saveProviders(providers: ProviderConfig[]): Promise<void> {
    const driver = await getDefaultSecureStoreDriver();
    const { sanitized } = await stripAndPersistProviderSecrets(providers, driver);
    await AsyncStorage.setItem(KEYS.PROVIDERS, JSON.stringify(sanitized));
  },

  async upsertProvider(provider: ProviderConfig): Promise<void> {
    const list = await this.getProviders();
    const index = list.findIndex(p => p.id === provider.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...provider };
    } else {
      list.push(provider);
    }
    await this.saveProviders(list);
  },

  async deleteProvider(id: string): Promise<void> {
    const driver = await getDefaultSecureStoreDriver();
    await removeProviderSecrets(id, driver);
    const list = await this.getProviders();
    const filtered = list.filter(p => p.id !== id);
    await this.saveProviders(filtered);
  },

  async setDefaultProvider(id: string): Promise<void> {
    const list = await this.getProviders();
    list.forEach(p => {
      p.isDefault = p.id === id;
    });
    await this.saveProviders(list);

    const active = list.find(p => p.id === id);
    if (active) {
      await this.saveProviderConfig(active);
    }
  },

  async getActiveProvider(): Promise<ProviderConfig> {
    const list = await this.getProviders();
    const active = list.find(p => p.isDefault) || list[0] || DEFAULT_PROVIDER_CONFIG;
    return active;
  },

  async clearAllCache(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const commentKeys = keys.filter(k => k.startsWith(KEYS.COMMENT_CACHE));
    await AsyncStorage.multiRemove(commentKeys);
  },

  async exportVaultData(): Promise<string> {
    const characters = await this.getCharacters();
    const personas = await this.getPersonas();
    const conversations = await this.getConversations();
    const rules = await this.getBotRulePresets();
    const lorebooks = await this.getLorebooks();
    const globalBackground = await this.getGlobalChatBackground();

    const payload = {
      app: 'NekoChat',
      version: 1,
      exportedAt: new Date().toISOString(),
      characters,
      personas,
      conversations,
      botRulePresets: rules.filter(r => !r.isBuiltin),
      lorebooks,
      globalBackground
    };
    return JSON.stringify(payload, null, 2);
  },

  async importVaultData(jsonStr: string): Promise<{ characters: number; personas: number; conversations: number }> {
    const data = JSON.parse(jsonStr);
    let characters = 0;
    let personas = 0;
    let conversations = 0;

    if (Array.isArray(data.characters)) {
      for (const c of data.characters) {
        await this.upsertCharacter(c);
        characters++;
      }
    }
    if (Array.isArray(data.personas)) {
      for (const p of data.personas) {
        await this.upsertPersona(p);
        personas++;
      }
    }
    if (Array.isArray(data.conversations)) {
      for (const conv of data.conversations) {
        await this.upsertConversation(conv);
        conversations++;
      }
    }
    if (Array.isArray(data.botRulePresets)) {
      for (const r of data.botRulePresets) {
        await this.saveBotRulePreset(r);
      }
    }
    if (Array.isArray(data.lorebooks)) {
      for (const lb of data.lorebooks) {
        await this.upsertLorebook(lb);
      }
    }
    return { characters, personas, conversations };
  },
};

export { BotRulePreset };
