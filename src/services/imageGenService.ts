/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * NekoChat Native Image Generation Engine
 * Supports Pollinations AI (Zero Key), OpenAI DALL-E 3, and Custom Flux/SD Endpoints.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Character, Persona } from '../types';
import { getDefaultSecureStoreDriver, getImageKeyStoreName } from './secureKeyStore';

const IMAGE_GEN_SECURE_KEY_ID = 'image_gen_service';

export type ImageGenProvider = 'pollinations' | 'openai' | 'custom';

export type ImageStylePreset =
  | 'anime'
  | 'semi-realistic'
  | 'photorealistic'
  | 'dark-fantasy'
  | 'pixel-art'
  | 'manga';

export interface ImageStyleOption {
  id: ImageStylePreset;
  label: string;
  description: string;
  promptPrefix: string;
}

export const IMAGE_STYLE_OPTIONS: ImageStyleOption[] = [
  {
    id: 'anime',
    label: 'Anime (Default)',
    description: 'Vibrant, ultra-detailed anime aesthetic with clean linework & expressive lighting.',
    promptPrefix: 'masterpiece, best quality, ultra-detailed anime illustration, vibrant colors, expressive eyes, clean cel-shaded lineart, makoto shinkai aesthetic'
  },
  {
    id: 'semi-realistic',
    label: 'Semi-Realistic / 2.5D',
    description: 'Smooth digital painting with volumetric lighting and realistic textures.',
    promptPrefix: '2.5d semi-realistic digital illustration, soft ambient lighting, highly detailed character concept art, octane render, rich textures'
  },
  {
    id: 'photorealistic',
    label: 'Photorealistic',
    description: 'Realistic photographic look with natural depth of field and soft lighting.',
    promptPrefix: 'raw photo, realistic portrait photography, natural lighting, 8k uhd, dslr, sharp focus, lifelike skin texture'
  },
  {
    id: 'dark-fantasy',
    label: 'Dark Fantasy',
    description: 'Moody, cinematic composition with dramatic shadows and atmospheric fog.',
    promptPrefix: 'cinematic dark fantasy illustration, atmospheric moody lighting, gothic aesthetic, dramatic shadows, epic composition'
  },
  {
    id: 'pixel-art',
    label: 'Pixel Art',
    description: 'Nostalgic 16-bit retro aesthetic with crisp pixel clusters.',
    promptPrefix: '16-bit retro pixel art, detailed pixel sprite, nostalgic gaming aesthetic, clean pixel clusters, vibrant palette'
  },
  {
    id: 'manga',
    label: 'Manga / Monochrome',
    description: 'Classic Japanese manga panel with screentones and high-contrast ink.',
    promptPrefix: 'manga illustration, monochrome screentones, sharp black and white ink lineart, dramatic manga panel, dynamic framing'
  }
];

export interface ImageGenConfig {
  enabled: boolean;
  provider: ImageGenProvider;
  model: string;
  apiKey: string;
  baseUrl: string;
  style: ImageStylePreset;
  customStylePrompt?: string;
  aspectRatio: 'portrait' | 'square' | 'landscape';
  width: number;
  height: number;
  negativePrompt: string;
  enhance?: boolean;
}

export function mapToAnomanStyle(stylePreset?: ImageStylePreset): 'flat-illustration' | 'cinematic' | '3d-render' | 'editorial' | 'product-photo' {
  switch (stylePreset) {
    case 'anime':
    case 'manga':
      return 'flat-illustration';
    case 'dark-fantasy':
    case 'pixel-art':
      return 'cinematic';
    case 'semi-realistic':
      return '3d-render';
    case 'photorealistic':
      return 'editorial';
    default:
      return 'flat-illustration';
  }
}

export const DEFAULT_IMAGE_GEN_CONFIG: ImageGenConfig = {
  enabled: true,
  provider: 'pollinations',
  model: 'sana',
  apiKey: '',
  baseUrl: 'https://image.pollinations.ai/prompt',
  style: 'anime',
  customStylePrompt: '',
  aspectRatio: 'portrait',
  width: 832,
  height: 1216,
  negativePrompt: 'low quality, blurry, deformed anatomy, bad hands, missing fingers, extra limbs, watermark, signature, ugly face',
  enhance: true
};

const STORAGE_KEY = '@nekochat:image_gen_config_v1';

/**
 * Infers an accurate visual subject tag (1boy / 1girl / neutral character name)
 * from character metadata instead of blindly forcing `1girl`.
 */
export function inferCharacterSubjectTag(character: Character): string {
  const charName = character.name.split(' ')[0] || character.name;
  const tagPool = [
    ...(character.tagSlugs || []),
    ...(character.tags || []),
    character.tagline || '',
    character.personality || '',
    character.description || '',
  ].join(' ');

  const hasMaleCue =
    /\b(male|boy|man|guy|gentleman|prince|king|emperor|duke|husband|boyfriend|brother|he\/him|1boy|ikemen|shota|otoko)\b/i.test(
      tagPool
    );
  const hasFemaleCue =
    /\b(female|girl|woman|lady|princess|queen|empress|duchess|wife|girlfriend|sister|maid|she\/her|1girl|waifu|bishoujo)\b/i.test(
      tagPool
    );

  if (hasMaleCue && !hasFemaleCue) return `1boy, ${charName}`;
  if (hasFemaleCue && !hasMaleCue) return `1girl, ${charName}`;
  return charName;
}

class ImageGenService {
  private config: ImageGenConfig = { ...DEFAULT_IMAGE_GEN_CONFIG };
  private initialized = false;

  constructor() {
    this.loadConfig();
  }

  public async loadConfig(): Promise<ImageGenConfig> {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.config = { ...DEFAULT_IMAGE_GEN_CONFIG, ...JSON.parse(saved) };
        if (this.config.provider === 'custom') {
          if (!this.config.model || this.config.model === 'flux-anime' || this.config.model === 'turbo' || this.config.model === 'any-dark') {
            this.config.model = 'flux-schnell';
          }
        }
        if (this.config.provider === 'openai') {
          if (!this.config.model || this.config.model === 'flux-anime') {
            this.config.model = 'dall-e-3';
          }
        }
        if (this.config.customStylePrompt?.trim().toLowerCase() === 'flux-schnell' || this.config.customStylePrompt?.trim().toLowerCase() === 'flux') {
          this.config.customStylePrompt = '';
        }
      }

      try {
        const driver = await getDefaultSecureStoreDriver();
        const available = await driver.isAvailable().catch(() => false);
        if (available) {
          const keyName = getImageKeyStoreName(IMAGE_GEN_SECURE_KEY_ID);
          if (this.config.apiKey && this.config.apiKey.trim()) {
            const plaintextKey = this.config.apiKey;
            await driver.setItemAsync(keyName, plaintextKey);
            const readBack = await driver.getItemAsync(keyName);
            if (readBack === plaintextKey) {
              const strippedCopy: ImageGenConfig = { ...this.config, apiKey: '' };
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(strippedCopy)).catch(() => {});
            }
          } else {
            const stored = await driver.getItemAsync(keyName);
            if (stored) {
              this.config.apiKey = stored;
            }
          }
        }
      } catch {
        // Keep in-memory / AsyncStorage fallback if SecureStore fails
      }
    } catch (e) {
      console.warn('[ImageGenService] Failed to load config from storage:', e);
      this.config = { ...DEFAULT_IMAGE_GEN_CONFIG };
    }
    this.initialized = true;
    return this.config;
  }

  public async saveConfig(updates: Partial<ImageGenConfig>): Promise<ImageGenConfig> {
    this.config = { ...this.config, ...updates };
    const toPersist: ImageGenConfig = { ...this.config };
    try {
      const driver = await getDefaultSecureStoreDriver();
      const available = await driver.isAvailable().catch(() => false);
      if (available) {
        const keyName = getImageKeyStoreName(IMAGE_GEN_SECURE_KEY_ID);
        if (toPersist.apiKey && toPersist.apiKey.trim()) {
          await driver.setItemAsync(keyName, toPersist.apiKey);
          const readBack = await driver.getItemAsync(keyName);
          if (readBack === toPersist.apiKey) {
            toPersist.apiKey = '';
          }
        } else if ('apiKey' in updates && !toPersist.apiKey.trim()) {
          await driver.deleteItemAsync(keyName).catch(() => {});
        }
      }
    } catch {
      // Keep toPersist intact if SecureStore write fails so user key is never lost
    }
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist));
    } catch (e) {
      console.warn('[ImageGenService] Failed to save config to storage:', e);
    }
    return { ...this.config };
  }

  public getConfig(): ImageGenConfig {
    return { ...this.config };
  }

  /**
   * Builds an expressive visual prompt from character traits, persona, and recent message dialogue/action.
   */
  public buildScenePrompt(
    character: Character,
    messageContent: string,
    persona?: Persona,
    overrideStyle?: ImageStylePreset,
    customInstructions?: string,
    contextOptions?: {
      recentMessages?: { role: string; content: string; isError?: boolean }[];
      sceneLocation?: string;
      sceneTime?: string;
    }
  ): string {
    const activeStyle = overrideStyle || this.config.style || 'anime';
    const styleOption = IMAGE_STYLE_OPTIONS.find(s => s.id === activeStyle) || IMAGE_STYLE_OPTIONS[0];

    // 1. Character visual highlights (never force 1girl blindly)
    const visualTraits: string[] = [];
    const charName = character.name.split(' ')[0] || character.name;
    visualTraits.push(inferCharacterSubjectTag(character));

    const descPool = `${character.description || ''} ${character.personality || ''} ${character.background || ''}`;

    const hairMatch = descPool.match(/\b(black|brown|blonde|silver|white|red|crimson|pink|blue|purple|green|golden)\s+hair\b/i);
    if (hairMatch) visualTraits.push(hairMatch[0].toLowerCase());

    const eyeMatch = descPool.match(/\b(blue|red|amber|crimson|green|brown|hazel|violet|purple|golden|yellow)\s+eyes\b/i);
    if (eyeMatch) visualTraits.push(eyeMatch[0].toLowerCase());

    const clothingMatch = descPool.match(/\b(school uniform|maid outfit|maid dress|black hoodie|hoodie|armor|tank top|sundress|white dress|black dress|suit and tie|business suit|t-shirt and jeans|sweater|kimono|yukata|leather jacket|corset|overalls)\b/i);
    if (clothingMatch) visualTraits.push(clothingMatch[0].toLowerCase());

    if (character.tagSlugs && character.tagSlugs.length > 0) {
      const relevantTags = character.tagSlugs
        .filter(t => /cat|bunny|elf|demon|angel|maid|school|suit|armor|furry|vampire|goth|fox|wolf/i.test(t))
        .map(t => t.replace(/-/g, ' '));
      if (relevantTags.length > 0) {
        visualTraits.push(...relevantTags.slice(0, 3));
      }
    }

    // 2. Multi-turn Action / Scene extraction (last ~6 valid turns if supplied, else single messageContent)
    const sourceTexts: string[] = [];
    if (contextOptions?.recentMessages && contextOptions.recentMessages.length > 0) {
      const validRecent = contextOptions.recentMessages
        .filter(m => (m.role === 'user' || m.role === 'assistant') && !m.isError && String(m.content || '').trim() !== '...')
        .slice(-6);
      for (const m of validRecent) {
        sourceTexts.push(String(m.content || ''));
      }
    }
    if (sourceTexts.length === 0 && messageContent) {
      sourceTexts.push(messageContent);
    }

    const actionMatches: string[] = [];
    for (const txt of sourceTexts) {
      const asteriskRegex = /\*([^*]+)\*/g;
      let match: RegExpExecArray | null;
      while ((match = asteriskRegex.exec(txt)) !== null) {
        const cleaned = match[1].replace(/[*_#`]/g, '').trim();
        if (cleaned.length > 5 && cleaned.length < 180) {
          actionMatches.push(cleaned);
        }
      }
    }

    let sceneDescription = '';
    if (actionMatches.length > 0) {
      sceneDescription = actionMatches.slice(-3).join(', ');
    } else {
      const fallbackRaw = sourceTexts[sourceTexts.length - 1] || messageContent || '';
      const cleanText = fallbackRaw
        .replace(/["“「][^"”」]+["”」]/g, '')
        .replace(/[*_#`~[\]]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      sceneDescription = cleanText ? cleanText.slice(0, 180) : 'conversing warmly together';
    }

    const locationParts = [
      contextOptions?.sceneLocation?.trim() ? `setting: ${contextOptions.sceneLocation.trim()}` : '',
      contextOptions?.sceneTime?.trim() ? `time: ${contextOptions.sceneTime.trim()}` : '',
    ].filter(Boolean);
    const locationSnippet = locationParts.join(', ');

    // 3. User Persona context
    let interactionSnippet = '';
    if (persona && persona.name) {
      const personaDetails: string[] = [];
      if (persona.appearance) {
        const cleanApp = persona.appearance.replace(/[*_#`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
        if (cleanApp) personaDetails.push(cleanApp);
      }
      interactionSnippet = `together with ${persona.name}${personaDetails.length > 0 ? ` (${personaDetails.join(', ')})` : ''}`;
    }

    // 4. Combine into prompt
    const isFluxOrCustom = this.config.provider === 'custom' || /flux/i.test(this.config.model);

    if (isFluxOrCustom) {
      const subjectIntro = visualTraits.length > 0
        ? `A gorgeous ${styleOption.label.split(' ')[0].toLowerCase()} illustration of ${visualTraits.join(', ')}`
        : `A gorgeous ${styleOption.label.split(' ')[0].toLowerCase()} illustration of ${charName}`;

      const actionText = sceneDescription ? `, ${sceneDescription}` : ', in a charismatic and expressive pose';
      const locText = locationSnippet ? `, ${locationSnippet}` : '';
      const interactionText = interactionSnippet ? `, ${interactionSnippet}` : '';
      const customNotes = customInstructions?.trim() ? `, ${customInstructions.trim()}` : '';
      const customModifiers = this.config.customStylePrompt?.trim() ? `, ${this.config.customStylePrompt.trim()}` : '';

      return `${subjectIntro}${actionText}${locText}${interactionText}${customModifiers}${customNotes}. Atmospheric cinematic lighting, rich volumetric depth, expressive facial features, highly detailed environmental setting, masterpiece composition.`.replace(/\s+/g, ' ');
    }

    const parts = [
      styleOption.promptPrefix,
      this.config.customStylePrompt?.trim() || '',
      visualTraits.join(', '),
      sceneDescription,
      locationSnippet,
      interactionSnippet,
      customInstructions?.trim() || '',
      'cinematic lighting, detailed background, expressive emotions, high quality'
    ].filter(p => p && p.trim().length > 0);

    return parts.join(', ');
  }

  /**
   * Generates an image using Pollinations AI, OpenAI DALL-E, or Custom endpoint.
   */
  public async generateImage(
    prompt: string,
    overrideConfig?: Partial<ImageGenConfig>
  ): Promise<{ imageUrl: string; prompt: string }> {
    const cfg = { ...this.config, ...overrideConfig };
    const seed = Math.floor(Math.random() * 10000000);

    let width = cfg.width || 832;
    let height = cfg.height || 1216;
    if (cfg.aspectRatio === 'square') {
      width = 1024;
      height = 1024;
    } else if (cfg.aspectRatio === 'landscape') {
      width = 1216;
      height = 832;
    } else {
      width = 832;
      height = 1216;
    }

    // 1. POLLINATIONS AI (FREE / ZERO KEY)
    if (cfg.provider === 'pollinations' || !cfg.provider) {
      const model = cfg.model && cfg.model !== 'flux-anime' && cfg.model !== 'flux' ? cfg.model : 'sana';
      const cleanPrompt = prompt.trim();
      const encodedPrompt = encodeURIComponent(cleanPrompt);
      const negativePart = cfg.negativePrompt ? `&negative=${encodeURIComponent(cfg.negativePrompt)}` : '';
      const targetUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${model}&nologo=true&seed=${seed}${negativePart}`;

      return {
        imageUrl: targetUrl,
        prompt: cleanPrompt
      };
    }

    // 2. OPENAI DALL-E 3
    if (cfg.provider === 'openai') {
      if (!cfg.apiKey) {
        throw new Error('OpenAI API Key is required for DALL-E image generation.');
      }
      const rawBase = (cfg.baseUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
      const endpoint = rawBase.endsWith('/images/generations') ? rawBase : `${rawBase}/images/generations`;
      const sizeStr = cfg.aspectRatio === 'landscape' ? '1792x1024' : cfg.aspectRatio === 'portrait' ? '1024x1792' : '1024x1024';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cfg.apiKey.trim()}`
        },
        body: JSON.stringify({
          model: cfg.model || 'dall-e-3',
          prompt: prompt.trim(),
          n: 1,
          size: sizeStr,
          quality: 'standard'
        })
      });

      const rawText = await res.text();
      let resJson: any = null;
      try {
        resJson = JSON.parse(rawText);
      } catch {}

      if (!res.ok) {
        const errMsg = resJson?.error?.message || resJson?.message || `OpenAI returned status ${res.status}`;
        throw new Error(errMsg);
      }

      const firstItem = resJson?.data?.[0] || resJson?.images?.[0];
      const generatedUrl = firstItem?.url || (firstItem?.b64_json ? `data:image/png;base64,${firstItem.b64_json}` : '');
      if (!generatedUrl) {
        throw new Error('No image URL returned by OpenAI image API');
      }

      return {
        imageUrl: generatedUrl,
        prompt: firstItem?.revised_prompt || prompt
      };
    }

    // 3. CUSTOM OPENAI-COMPATIBLE ENDPOINT
    if (cfg.provider === 'custom') {
      const rawBase = (cfg.baseUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
      const endpoint = rawBase.endsWith('/images/generations') ? rawBase : `${rawBase}/images/generations`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (cfg.apiKey) {
        headers['Authorization'] = `Bearer ${cfg.apiKey.trim()}`;
      }

      let modelName = cfg.model?.trim() || 'flux-schnell';
      if (modelName === 'flux-anime' || modelName === 'turbo' || modelName === 'any-dark') {
        modelName = 'flux-schnell';
      }

      let sizeStr: string;
      const isFlux = /flux/i.test(modelName) || cfg.provider === 'custom';
      if (isFlux) {
        if (cfg.aspectRatio === 'square') {
          sizeStr = '1024x1024';
        } else if (cfg.aspectRatio === 'landscape') {
          sizeStr = '1024x576';
        } else {
          sizeStr = '576x1024';
        }
      } else {
        if (cfg.aspectRatio === 'square') {
          sizeStr = '1024x1024';
        } else if (cfg.aspectRatio === 'landscape') {
          sizeStr = '1792x1024';
        } else {
          sizeStr = '1024x1792';
        }
      }

      const anomanStyle = mapToAnomanStyle(cfg.style);
      const requestBody: Record<string, any> = {
        model: modelName,
        prompt: prompt.trim(),
        n: 1,
        size: sizeStr,
        enhance: cfg.enhance !== false,
        style: anomanStyle,
        response_format: 'b64_json'
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      const rawText = await res.text();
      let resJson: any = null;
      try {
        resJson = JSON.parse(rawText);
      } catch {}

      if (!res.ok) {
        const errMsg = resJson?.error?.message || resJson?.detail || resJson?.message || `Custom image API returned status ${res.status}`;
        throw new Error(errMsg);
      }

      const firstItem = resJson?.data?.[0] || resJson?.images?.[0];
      const generatedUrl = firstItem?.url || (firstItem?.b64_json ? `data:image/png;base64,${firstItem.b64_json}` : (typeof firstItem === 'string' ? firstItem : ''));
      if (!generatedUrl) {
        throw new Error('No image returned by custom image endpoint');
      }

      return {
        imageUrl: generatedUrl,
        prompt: resJson?._anoman?.enhanced_prompt || firstItem?.revised_prompt || prompt.trim()
      };
    }

    throw new Error(`Unsupported image provider: ${cfg.provider}`);
  }
}

export const imageGenService = new ImageGenService();
