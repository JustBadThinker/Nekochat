/**
 * NekoChat Core Types & Interfaces
 * Free & Open-Source AI Roleplay Client (React Pure Engine)
 */

export interface CharacterComment {
  id: string;
  author: string;
  avatar?: string;
  content: string;
  date?: string;
  rating?: number;
}

export interface Character {
  id: string;
  name: string;
  tagline: string; // e.g. "The Cold CEO", "Playful Childhood Friend"
  description: string;
  avatar: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  exampleDialogue?: string;
  tags: string[];
  creator: string;
  totalChats?: number;
  lastActive?: number;
  isFavorite?: boolean;
  comments?: CharacterComment[];
  isUserCreated?: boolean;
  contentRating?: 'SFW' | 'NSFW';
  totalTokens?: number;
  chatName?: string;
  alternateGreetings?: string[];
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
  count?: number;
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
  tags: Array<{ id: number | string; name: string; slug: string }>;
  firstPublishedAt?: string;
  createdAt?: string;
  firstMessage?: string;
  personality?: string;
  scenario?: string;
  alternateGreetings?: string[];
}

export interface CommunityCharacterDetail extends CommunityCharacter {
  firstMessage: string;
  personality: string;
  scenario: string;
  descriptionHtml?: string;
  alternateGreetings: string[];
}

export interface ChatMessage {
  id: string;
  characterId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thought?: string;
  timestamp: number;
  tokenCount?: number;
  imageUrl?: string;
}

export interface Persona {
  id: string;
  name: string;
  pronouns?: string;
  description: string;
  avatar?: string;
  isDefault?: boolean;
}

export type LLMProvider = 'gemini' | 'openrouter' | 'custom';
export type ImageProvider = 'pollinations' | 'anoman';
export type ChatStyleMode = 'novel' | 'bubble';

export interface ProviderConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  customEndpoint?: string;
  temperature?: number;
  contextLimit?: number;
  imageProvider: ImageProvider;
  imageApiKey?: string;
}

export interface SyntaxColorConfig {
  dialogue: string;
  narration: string;
  thoughts: string;
  emphasis: string;
}

export interface AppSettings {
  chatStyle: ChatStyleMode;
  syntaxColors: SyntaxColorConfig;
  showTokenCounter: boolean;
  currency: 'IDR' | 'USD';
  language: string;
  activePersonaId?: string;
}
