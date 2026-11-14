/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * NekoChat Native Speech Synthesis Engine
 * Built on Expo Speech with Smart Quote Extraction for authentic Character Voice RP.
 */

import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface VoiceProfile {
  id: string;
  name: string;
  category: 'female' | 'male' | 'british' | 'anime';
  archetype: string;
  description: string;
  gender: 'female' | 'male';
  langCode: string;
}

export const VOICE_PROFILES: VoiceProfile[] = [
  // --- FEMALE VOICES ---
  {
    id: 'af_heart',
    name: 'Heart',
    category: 'female',
    archetype: 'Warm, Natural Waifu (Recommended)',
    description: 'Balanced, highly expressive, warm and natural everyday voice.',
    gender: 'female',
    langCode: 'en-US'
  },
  {
    id: 'af_bella',
    name: 'Bella',
    category: 'female',
    archetype: 'Sweet & Playful Girlfriend',
    description: 'Youthful, energetic, high-spirited, sweet tone.',
    gender: 'female',
    langCode: 'en-US'
  },
  {
    id: 'af_sarah',
    name: 'Sarah',
    category: 'female',
    archetype: 'Mature MILF / Calm Mother / Onee-san',
    description: 'Gentle, comforting, mature resonance with motherly warmth.',
    gender: 'female',
    langCode: 'en-US'
  },
  {
    id: 'af_nicole',
    name: 'Nicole',
    category: 'female',
    archetype: 'Sensual / Whispery / ASMR & Intimate',
    description: 'Soft, breathy, intimate whisper suitable for emotional or late-night RP.',
    gender: 'female',
    langCode: 'en-US'
  },
  {
    id: 'af_sky',
    name: 'Sky',
    category: 'female',
    archetype: 'Cheerful Genki / Tsundere Girl',
    description: 'Brisk, upbeat, slightly sharp and lively speech.',
    gender: 'female',
    langCode: 'en-US'
  },
  {
    id: 'af_alloy',
    name: 'Alloy',
    category: 'female',
    archetype: 'Tomboy / Knight / Steadfast Boss',
    description: 'Slightly deeper female tone, authoritative, calm and assertive.',
    gender: 'female',
    langCode: 'en-US'
  },
  // --- MALE VOICES ---
  {
    id: 'am_adam',
    name: 'Adam',
    category: 'male',
    archetype: 'Deep Baritone / Alpha / Husbando',
    description: 'Deep, commanding, masculine baritone with strong gravitas.',
    gender: 'male',
    langCode: 'en-US'
  },
  {
    id: 'am_michael',
    name: 'Michael',
    category: 'male',
    archetype: 'Warm Boyfriend / Gentle Giant',
    description: 'Friendly, warm, grounded conversational male tone.',
    gender: 'male',
    langCode: 'en-US'
  },
  {
    id: 'am_liam',
    name: 'Liam',
    category: 'male',
    archetype: 'Soft Boy / Twink / Gentle',
    description: 'Young, soft-spoken, boyish, gentle and endearing.',
    gender: 'male',
    langCode: 'en-US'
  },
  {
    id: 'am_echo',
    name: 'Echo',
    category: 'male',
    archetype: 'Cool / Detached Kuudere Male',
    description: 'Calm, measured, low emotion, cyberpunk or assassin vibe.',
    gender: 'male',
    langCode: 'en-US'
  },
  // --- BRITISH & EUROPEAN ACCENTS ---
  {
    id: 'bf_emma',
    name: 'Emma (UK)',
    category: 'british',
    archetype: 'Refined Aristocrat / Elegant Lady',
    description: 'Crisp British RP accent, aristocratic and poised.',
    gender: 'female',
    langCode: 'en-GB'
  },
  {
    id: 'bm_george',
    name: 'George (UK)',
    category: 'british',
    archetype: 'Sophisticated Butler / Noble Lord',
    description: 'Impeccable British gentleman cadence, polite and formal.',
    gender: 'male',
    langCode: 'en-GB'
  },
  // --- ANIME INFLECTED ---
  {
    id: 'jf_alpha',
    name: 'Alpha (Anime JP)',
    category: 'anime',
    archetype: 'Kuudere / Anime Waifu',
    description: 'Light, soft, anime-styled cadence with gentle pauses.',
    gender: 'female',
    langCode: 'ja-JP'
  },
  {
    id: 'jm_kumo',
    name: 'Kumo (Anime JP)',
    category: 'anime',
    archetype: 'Anime Protagonist / Shonen Hero',
    description: 'Clear, high-spirited anime male hero delivery.',
    gender: 'male',
    langCode: 'ja-JP'
  }
];

export interface TtsConfig {
  enabled: boolean;
  autoPlay: boolean;
  voiceId: string;
  pitch: number; // 0.5 to 1.5 (default 1.0)
  speed: number; // 0.5 to 2.0 (default 1.0)
  dialogueOnly: boolean; // default true (reads only quotation marks "...")
}

export const DEFAULT_TTS_CONFIG: TtsConfig = {
  enabled: true,
  autoPlay: false,
  voiceId: 'af_heart',
  pitch: 1.0,
  speed: 1.0,
  dialogueOnly: true
};

export interface TtsPlaybackState {
  isSpeaking: boolean;
  currentMessageId: string | null;
  currentChunk: number;
  totalChunks: number;
}

const STORAGE_KEY = '@nekochat:tts_settings_v1';

export class TtsService {
  private config: TtsConfig = { ...DEFAULT_TTS_CONFIG };
  private isSpeaking = false;
  private currentMessageId: string | null = null;
  private currentChunk = 0;
  private totalChunks = 0;
  private playbackQueue: string[] = [];
  private activeJobId = 0;
  private listeners = new Set<(state: TtsPlaybackState) => void>();
  private availableVoices: Speech.Voice[] = [];

  constructor() {
    this.loadConfig();
    this.initAvailableVoices();
  }

  private async initAvailableVoices() {
    try {
      this.availableVoices = await Speech.getAvailableVoicesAsync();
    } catch (e) {
      console.warn('[TtsService] Could not retrieve native voices:', e);
    }
  }

  public async loadConfig(): Promise<TtsConfig> {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.config = { ...DEFAULT_TTS_CONFIG, ...JSON.parse(saved) };
      }
    } catch {
      this.config = { ...DEFAULT_TTS_CONFIG };
    }
    return this.config;
  }

  public async saveConfig(updated: Partial<TtsConfig>): Promise<TtsConfig> {
    this.config = { ...this.config, ...updated };
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch {}
    return this.config;
  }

  public getConfig(): TtsConfig {
    return { ...this.config };
  }

  public subscribe(cb: (state: TtsPlaybackState) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    const state: TtsPlaybackState = {
      isSpeaking: this.isSpeaking,
      currentMessageId: this.currentMessageId,
      currentChunk: this.currentChunk,
      totalChunks: this.totalChunks
    };
    this.listeners.forEach(cb => cb(state));
  }

  /**
   * Smart Quote Chunk Extractor for Roleplay:
   * Extracts each spoken dialogue quote as an individual chunk.
   * Discards actions/thoughts enclosed in asterisks *...* or _..._.
   */
  public extractSpokenDialogueChunks(text: string, dialogueOnly = true): string[] {
    if (!text) return [];

    const normalized = text
      .replace(/\*\*(["“「][^"”」]+["”」])\*\*/g, '$1')
      .replace(/(["“「])\*\*([^*]+)\*\*(["”」])/g, '$1$2$3');

    if (dialogueOnly) {
      const nonNarrativeText = normalized
        .replace(/\*[^*]+\*/g, ' ')
        .replace(/_[^_]+_/g, ' ');

      const quoteRegex = /["“「]([^"”」]+)["”」]/g;
      const rawQuotes: string[] = [];
      let match: RegExpExecArray | null;

      while ((match = quoteRegex.exec(nonNarrativeText)) !== null) {
        const cleaned = match[1].replace(/[*_#`~[\]]/g, '').trim();
        if (cleaned.length > 0 && /[a-zA-Z0-9\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(cleaned)) {
          rawQuotes.push(cleaned);
        }
      }

      if (rawQuotes.length > 0) {
        const chunks: string[] = [];
        for (const q of rawQuotes) {
          if (q.length > 160 && /[.!?…]\s+/.test(q)) {
            const subSentences = q.split(/(?<=[.!?…])\s+/).map(s => s.trim()).filter(s => s.length > 0);
            chunks.push(...subSentences);
          } else {
            chunks.push(q);
          }
        }
        return chunks.length > 0 ? chunks : rawQuotes;
      }
    }

    let stripped = normalized
      .replace(/[*_#`~[\]]/g, ' ')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!stripped) return [];

    const rawSentences = stripped
      .split(/(?<=[.!?…])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && /[a-zA-Z0-9\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(s));

    return rawSentences.length > 0 ? rawSentences : [stripped];
  }

  public extractSpokenDialogue(text: string, dialogueOnly = true): string {
    const chunks = this.extractSpokenDialogueChunks(text, dialogueOnly);
    return chunks.join(' ');
  }

  /**
   * Stop any ongoing speech synthesis immediately.
   */
  public async stop(): Promise<void> {
    this.activeJobId++;
    this.playbackQueue = [];
    this.isSpeaking = false;
    this.currentMessageId = null;
    this.currentChunk = 0;
    this.totalChunks = 0;
    try {
      await Speech.stop();
    } catch {}
    this.notify();
  }

  public getPlaybackState(): TtsPlaybackState {
    return {
      isSpeaking: this.isSpeaking,
      currentMessageId: this.currentMessageId,
      currentChunk: this.currentChunk,
      totalChunks: this.totalChunks
    };
  }

  private playNextQueueItem(jobId: number, voiceProfile: VoiceProfile, rate: number, pitch: number) {
    if (jobId !== this.activeJobId || this.playbackQueue.length === 0) {
      this.isSpeaking = false;
      this.currentMessageId = null;
      this.currentChunk = 0;
      this.totalChunks = 0;
      this.notify();
      return;
    }

    const nextText = this.playbackQueue.shift()!;
    this.currentChunk++;
    this.isSpeaking = true;
    this.notify();

    // Match best native voice for this profile
    const lang = voiceProfile.langCode || 'en-US';
    const targetGender = voiceProfile.gender;

    let voiceIdentifier: string | undefined;
    if (this.availableVoices.length > 0) {
      const match = this.availableVoices.find(v =>
        v.language.toLowerCase().startsWith(lang.toLowerCase().slice(0, 2)) &&
        (targetGender === 'female' ? /female|woman|girl|samantha|zira|karen|victoria|natural|kyoko/i.test(v.name) : /male|man|boy|david|george|alex|natural|otoya/i.test(v.name))
      ) || this.availableVoices.find(v => v.language.toLowerCase().startsWith(lang.toLowerCase().slice(0, 2)));

      if (match) {
        voiceIdentifier = match.identifier;
      }
    }

    Speech.speak(nextText, {
      language: lang,
      pitch: Math.max(0.5, Math.min(1.6, pitch)),
      rate: Math.max(0.6, Math.min(1.8, rate)),
      voice: voiceIdentifier,
      onDone: () => {
        if (jobId === this.activeJobId) {
          this.playNextQueueItem(jobId, voiceProfile, rate, pitch);
        }
      },
      onStopped: () => {
        if (jobId === this.activeJobId) {
          this.stop();
        }
      },
      onError: (err) => {
        console.warn('[TtsService] Speech chunk error:', err);
        if (jobId === this.activeJobId) {
          this.playNextQueueItem(jobId, voiceProfile, rate, pitch);
        }
      }
    });
  }

  /**
   * Speak a roleplay message turn with native Speech Synthesis.
   */
  public async speak(
    rawText: string,
    messageId?: string,
    overrideConfig?: Partial<TtsConfig>
  ): Promise<void> {
    const opts = { ...this.config, ...overrideConfig };
    const chunks = this.extractSpokenDialogueChunks(rawText, opts.dialogueOnly);

    if (!chunks || chunks.length === 0) {
      return;
    }

    // Toggle stop if speaking the same message
    if (this.isSpeaking && this.currentMessageId === messageId) {
      await this.stop();
      return;
    }

    await this.stop();

    this.activeJobId++;
    const thisJobId = this.activeJobId;
    this.playbackQueue = [...chunks];
    this.currentMessageId = messageId || null;
    this.totalChunks = chunks.length;
    this.currentChunk = 0;
    this.isSpeaking = true;

    const voiceProfile = VOICE_PROFILES.find(v => v.id === opts.voiceId) || VOICE_PROFILES[0];
    this.playNextQueueItem(thisJobId, voiceProfile, opts.speed, opts.pitch);
  }
}

export const ttsService = new TtsService();

