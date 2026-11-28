/**
 * NekoChat Core Types & Interfaces
 * Free & Open-Source AI Roleplay Client
 *
 * Full Source-Driven Parity with Warden AI Architecture
 * Native Expo / React Native Compatible
 */

import type { ThemeId } from '../theme/colors';
import type { UiSkinId } from '../theme/skins';

export type UserRole = 'user' | 'moderator' | 'admin';

export interface User {
  id: string;
  firebaseUid?: string;
  email: string;
  username: string;
  displayName: string;
  role: UserRole;
  isEmailVerified: boolean;
  isAgeVerified: boolean;
  isSuspended: boolean;
  avatarUrl: string;
  bannerUrl?: string;
  bio: string;
  joinedDate: string;
  followerCount: number;
  followingCount: number;
  publishedCharacterCount: number;
  isNsfwAllowed: boolean;
  blurNsfw: boolean;
  isRestricted?: boolean;
  restrictionReason?: string;
}

export type TagCategory =
  | 'gender'
  | 'romance'
  | 'personality'
  | 'relationship'
  | 'power'
  | 'genre'
  | 'species'
  | 'scenario'
  | 'style'
  | 'rating'
  | 'theme';

export interface Tag {
  id: string;
  name: string;
  slug: string;
  category: TagCategory;
  description?: string;
  count?: number;
}

export type ContentRating = 'SFW' | 'Mature' | 'NSFW';

export type PublicationStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'changes_requested'
  | 'rejected'
  | 'unpublished'
  | 'removed'
  | 'private';

export interface CharacterScenario {
  id: string;
  characterId: string;
  title: string;
  description: string;
  openingMessage: string;
  scenarioInstructions: string;
  imageUrl?: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterRevision {
  id: string;
  characterId: string;
  version: number;
  changesSummary: string;
  systemPrompt: string;
  contentRating: ContentRating;
  submittedAt: string;
  status: PublicationStatus;
  moderatorNotes?: string;
}

export interface CharacterComment {
  id: string;
  author: string;
  avatar?: string;
  content: string;
  date?: string;
  rating?: number;
}

export interface CharacterReview {
  id: string;
  characterId: string;
  userId: string;
  username: string;
  userAvatar: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Character {
  id: string;
  name: string;
  chatName?: string; // Actual RP character name (distinct from card title)
  customChatName?: string; // User-overridden RP display/prompt name (takes precedence over auto-extracted name)
  subtitle?: string; // Character subtitle / secondary identity title
  tagline: string; // e.g. "The Cold CEO", "Playful Childhood Friend"
  description: string;
  avatar: string; // High-res portrait URL or file URI
  avatarUrl?: string; // Warden alias for avatar
  coverUrl?: string; // Landscape hero banner
  personality: string;
  background?: string;
  scenario: string; // Main default scenario premise
  systemPrompt?: string; // Bot instruction prompt
  firstMessage: string;
  exampleDialogue?: string;
  creatorNotes?: string;
  tags: string[];
  tagSlugs?: string[];
  creator: string; // Clean handle
  creatorId?: string;
  creatorUsername?: string;
  creatorAvatar?: string;
  totalChats?: number;
  lastActive?: number;
  isFavorite?: boolean;
  comments?: CharacterComment[];
  isUserCreated?: boolean;
  contentRating?: ContentRating;
  visibility?: 'public' | 'unlisted' | 'private';
  publicationStatus?: PublicationStatus;
  moderationNotes?: string;
  scenarios?: CharacterScenario[];
  totalTokens?: number;
  alternateGreetings?: string[];
  likeCount?: number;
  bookmarkCount?: number;
  chatCount?: number;
  ratingAverage?: number;
  ratingCount?: number;
  lorebookIds?: string[];
  createdAt?: string;
  updatedAt?: string;
  age?: number;
}

export interface CommunityCharacter {
  id: string;
  characterId: string;
  name: string;
  chatName: string;
  creatorName: string;
  creatorId?: string;
  avatarUrl: string;
  shortDescription: string;
  isNsfw: boolean;
  totalTokens: number;
  chatCount: number;
  messageCount: number;
  favoritesCount: number;
  tags: { id: number | string; name: string; slug: string }[];
  firstPublishedAt?: string;
  createdAt?: string;
  firstMessage?: string;
  personality?: string;
  scenario?: string;
  alternateGreetings?: string[];
  source?: 'janitor' | 'chub';
  fullPath?: string;
}

export interface CommunityCharacterDetail extends CommunityCharacter {
  firstMessage: string;
  personality: string;
  scenario: string;
  descriptionHtml?: string;
  alternateGreetings: string[];
  rawCardV2?: any;
}

export interface Persona {
  id: string;
  userId?: string;
  name: string;
  pronouns?: string;
  genderPronouns?: string;
  description: string;
  shortDescription?: string;
  appearance?: string;
  personality?: string;
  background?: string;
  roleInstructions?: string;
  avatar?: string;
  avatarUrl?: string;
  lorebookIds?: string[];
  isDefault?: boolean;
  createdAt?: string;
}

export interface LorebookEntry {
  id: string;
  title: string;
  keys: string[]; // trigger phrases
  secondaryKeys?: string[]; // selective secondary triggers
  content: string;
  priority: number;
  enabled: boolean;
  selective?: boolean; // requires both primary and secondary triggers
  constant?: boolean; // always injected regardless of triggers
  position?: 'before_char' | 'after_char' | 'before_history';
  depth?: number; // optional prompt depth hint
  probability?: number; // 0..100
  useProbability?: boolean;
  caseSensitive?: boolean;
  matchWholeWords?: boolean;
  scanDepth?: number;
  sticky?: number; // turns to stay active after trigger
  cooldown?: number; // turns to suppress after deactivation
  delay?: number; // minimum total turns before entry can activate
  group?: string; // inclusion group name
  groupWeight?: number;
  ignoreBudget?: boolean;
  preventRecursion?: boolean; // do not allow this entry's content to trigger others
  excludeRecursion?: boolean; // do not allow other entries to recursively trigger this one
  characterFilter?: string[]; // restrict entry to matching character names
}

export interface Lorebook {
  id: string;
  userId: string;
  title: string;
  description: string;
  enabled?: boolean;
  scanDepth?: number;
  tokenBudget?: number;
  globalBudget?: number;
  maxEntries?: number;
  recursiveScanning?: boolean;
  maxRecursionDepth?: number;
  entries: LorebookEntry[];
  isPublic: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId?: string;
  characterId: string;
  role: 'user' | 'assistant' | 'system';
  sender?: 'user' | 'character' | 'system';
  senderRole?: 'user' | 'assistant' | 'system';
  senderId?: string;
  personaId?: string;
  personaName?: string;
  content: string;
  swipes?: string[];
  swipeIndex?: number;
  rawTemplate?: string;
  thought?: string;
  backendPrompt?: string;
  finishReason?: string;
  imageUrl?: string;
  imagePrompt?: string;
  imageStyle?: string;
  imageLoading?: boolean;
  imageError?: string;
  timestamp: number | string;
  tokenCount?: number;
}

export interface Conversation {
  id: string;
  userId: string;
  characterId: string;
  scenarioId?: string;
  scenarioTitle?: string;
  personaId: string;
  providerId: string;
  title: string;
  modelName?: string;
  messages: ChatMessage[];
  messageCount?: number;
  isArchived?: boolean;
  isPinned?: boolean;
  summary?: string;
  keyMemories?: string[];
  lastSummaryAt?: string;
  memoryCheckpoint?: number;
  customPrompt?: string;
  tokenOptimizer?: TokenOptimizerLevel;
  cumulativeUsage?: CumulativeTokenUsage;
  parentConversationId?: string;
  branchedFromMessageId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CumulativeTokenUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  totalCostIdr: number;
  turnCount: number;
}

export type TokenOptimizerLevel = 'off' | 'easy' | 'medium' | 'aggressive';
export type TokenCurrency = 'USD' | 'IDR';

export interface TokenPriceConfig {
  presetId: string;
  name: string;
  pricePer1MInput: number; // USD per 1M input tokens
  pricePer1MOutput: number; // USD per 1M output tokens
  pricePer1MInputIdr?: number; // Direct IDR for Indonesian routers
  pricePer1MOutputIdr?: number; // Direct IDR for Indonesian routers
  contextLimit: number;
  currency?: TokenCurrency;
  usdToIdrRate?: number;
}

export interface ContextBreakdownItem {
  label: string;
  tokens: number;
  percentage: number;
  color: string;
}

export interface ConversationTokenStats {
  inputTokens: number;
  outputTokens: number;
  totalContextTokens: number;
  contextLimit: number;
  contextUsagePercent: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: TokenCurrency;
  formattedInputCost: string;
  formattedOutputCost: string;
  formattedTotalCost: string;
  formattedSavedCost: string;
  uncompressedTokens: number;
  savedTokens: number;
  savedCost: number;
  breakdown: ContextBreakdownItem[];
}

export type ProviderType = 'gemini' | 'openai' | 'openrouter' | 'anthropic' | 'custom' | 'simulation';
export type LLMProvider = 'gemini' | 'openai' | 'openrouter' | 'anthropic' | 'custom' | 'simulation';
export type ImageProvider = 'pollinations' | 'openai' | 'custom';
export type ChatStyleMode = 'novel' | 'bubble';

export interface ModelBudgetOverride {
  contextLimit?: number;
  maxOutputTokens?: number;
  updatedAt?: number;
}

export interface CachedModelMetadata {
  endpointIdentity: string;
  source: 'fetch_models';
  contextLimit?: number;
  maxOutputTokens?: number;
  fetchedAt: number;
}

export interface ProviderConfig {
  id?: string;
  userId?: string;
  providerType?: ProviderType;
  provider?: LLMProvider;
  name?: string;
  apiKey: string;
  baseUrl?: string;
  customEndpoint?: string;
  defaultModel?: string;
  model: string;
  temperature?: number;
  topP?: number;
  repetitionPenalty?: number;
  maxTokens?: number;
  contextLimit?: number;
  /** @deprecated Legacy shipped default field; ignored as a user override unless userConfiguredContextLimit is true. */
  contextWindow?: number;
  userConfiguredContextLimit?: boolean;
  userConfiguredMaxTokens?: boolean;
  modelContextLimits?: Record<string, ModelBudgetOverride>;
  cachedModelMetadata?: Record<string, CachedModelMetadata>;
  streaming?: boolean;
  isDefault?: boolean;
  customHeaders?: Record<string, string>;
  customPrompt?: string;
  tokenOptimizer?: TokenOptimizerLevel;
  imageProvider?: ImageProvider;
  imageApiKey?: string;
}

export interface GlobalChatBackground {
  imageUrl: string;
  fit: 'cover' | 'contain' | 'fill';
  blur: number; // in pixels (0 - 20)
  darkOverlay: number; // in percentage (0 - 100)
}

export interface ChatCustomization {
  dialogueColor: string;
  actionColor: string;
  userTextColor: string;
  backgroundColor: string;
  backgroundImageUrl?: string;
  backgroundDim: number;
  fontSize: 'sm' | 'md' | 'lg';
  fontFamily?: 'sans' | 'serif' | 'mono' | 'casual' | 'rounded';
}

export interface SyntaxColorConfig {
  dialogue: string;
  narration: string;
  thoughts: string;
  emphasis: string;
}

export interface AppSettings {
  theme?: ThemeId | string;
  uiSkin?: UiSkinId;
  activeThemePackId?: string | null;
  chatStyle: ChatStyleMode;
  syntaxColors: SyntaxColorConfig;
  showTokenCounter: boolean;
  currency: 'IDR' | 'USD';
  language: string;
  uiLanguage?: 'en' | 'ja' | 'fr' | 'id';
  autoLanguagePrompt?: boolean;
  languageCustomPrompt?: string;
  hasCompletedOnboarding?: boolean;
  passcodeEnabled?: boolean;
  passcodePin?: string;
  passcodeHash?: string;
  passcodeAutoLockSec?: number;
  activePersonaId?: string;
  customProxyUrl?: string;
  backendUrl?: string;
  enableExternalCatalogs?: boolean;
  autoMemoryEnabled?: boolean;
  notifyMissYou?: boolean;
  notifyAlgorithmPicks?: boolean;
  notifyFollowedCreators?: boolean;
  notifyDiscreetMode?: boolean;
  notifyQuietHours?: boolean;
  developerMode?: boolean;
}

export interface CreatorDropNotificationItem {
  id: string;
  creatorHandle: string;
  characterId: string;
  characterName: string;
  avatarUrl?: string;
  tagline?: string;
  isNsfw?: boolean;
  discoveredAt: number;
  read: boolean;
  source?: string;
  fullPath?: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt?: number;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export interface BotRulePreset {
  id: string;
  name: string;
  category: 'roleplay' | 'formatting' | 'behavior' | 'nsfw' | 'jailbreak' | 'custom';
  description: string;
  ruleText: string;
  isBuiltin: boolean;
  isActive: boolean;
}

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
  lorebooksCount?: number;
}

export interface VaultImportStats {
  personasAdded: number;
  conversationsAdded: number;
  messagesAdded: number;
  rulesAdded: number;
  charactersAdded: number;
  lorebooksAdded?: number;
}

export interface ImportedCardData {
  name: string;
  subtitle?: string;
  shortDescription: string;
  personality: string;
  background: string;
  systemPrompt: string;
  firstMessage: string;
  exampleDialogue: string;
  scenarios: CharacterScenario[];
  tagSlugs: string[];
  contentRating: ContentRating;
  age?: number;
  avatarUrl?: string;
  rawCardV2?: any;
}

export interface ImportParseResult {
  success: boolean;
  data?: ImportedCardData;
  error?: string;
  warnings?: string[];
  detectedFormat?: string;
}

export type CastPresenceStatus = 'present' | 'away' | 'unknown';
export type CastFactSource = 'user' | 'ai_inferred' | 'imported';
export type CastProfileField =
  | 'personality'
  | 'appearance'
  | 'background'
  | 'relationships'
  | 'interests'
  | 'fact';

export interface CastFactRecord {
  id: string;
  castMemberId: string;
  conversationId: string;
  field: CastProfileField;
  value: string;
  sourceType: CastFactSource;
  confirmed: boolean;
  sourceMessageId?: string;
  turnIndex?: number;
  status: 'active' | 'stale' | 'needs_review';
  createdAt: number;
  updatedAt: number;
}

export interface CastKnowledgeBoundary {
  witnessed: string[];
  communicated: string[];
  unknown: string[];
}

export interface DynamicCastMember {
  id: string;
  conversationId: string;
  characterId: string;
  name: string;
  aliases: string[];
  isPrimary: boolean;
  presence: CastPresenceStatus;
  aiControlled: boolean;
  singleTurnOnly?: boolean;
  profileStatus: 'stub' | 'provisional' | 'established';
  unknownFields: CastProfileField[];
  facts: CastFactRecord[];
  knowledge: CastKnowledgeBoundary;
  introducedAtMessageId?: string;
  introducedTurnIndex?: number;
  createdAt: number;
  updatedAt: number;
}

export interface SceneContinuityState {
  conversationId: string;
  characterId: string;
  currentLocation: string;
  establishedTime: string;
  ongoingActivities: string[];
  unresolvedActions: string[];
  lastTransitionMessageId?: string;
  lastTransitionTurnIndex?: number;
  updatedAt: number;
}
