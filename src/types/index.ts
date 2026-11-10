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
  dialogue: string;   // e.g. spoken words in quotes
  narration: string;  // e.g. *actions and descriptions*
  thoughts: string;   // e.g. character inner monologue
  emphasis: string;   // e.g. **bold penekanan**
}

export interface AppSettings {
  chatStyle: ChatStyleMode;
  syntaxColors: SyntaxColorConfig;
  showTokenCounter: boolean;
  currency: 'IDR' | 'USD';
  language: string;
  activePersonaId?: string;
}
