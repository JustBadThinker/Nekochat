/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import CryptoJS from 'crypto-js';
import { ContentRating } from '../types';
import { extractCleanCharacterName, cleanCreatorHandle } from './aiProviderService';

export interface ImportedCardData {
  name: string;
  subtitle?: string;
  shortDescription: string;
  personality: string;
  background: string;
  systemPrompt?: string;
  exampleDialogue: string;
  firstMessage: string;
  alternateGreetings: string[];
  creatorNotes?: string;
  creatorUsername?: string;
  tags: string[];
  avatarUrl?: string; // Base64 data URL or remote URL
  contentRating: ContentRating;
  age?: number;
  lorebook?: {
    name: string;
    description?: string;
    entries: {
      title: string;
      keys: string[];
      content: string;
      priority?: number;
      enabled?: boolean;
    }[];
  };
  originalFormat: 'png_tEXt' | 'chara_card_v2' | 'chara_card_v3' | 'chara_card_v1' | 'warden_json' | 'generic_json';
  unsupportedFields: string[];
  missingMandatoryFields: string[];
}

export interface ImportParseResult {
  success: boolean;
  data?: ImportedCardData;
  error?: string;
  warnings?: string[];
  canEdit?: boolean;
}

export type PngCardInput =
  | Uint8Array
  | ArrayBuffer
  | string // base64 or data URL
  | {
      uri?: string;
      base64?: string;
      arrayBuffer?: () => Promise<ArrayBuffer>;
      size?: number;
      name?: string;
    };

export class CharacterImportService {
  private static readonly MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB limit

  /**
   * Parse PNG file / buffer / base64 to extract tEXt/iTXt chunk containing character data.
   * Compatible with React Native, Expo ImagePicker, and standard web File/Blob.
   */
  public static async parsePngCard(input: PngCardInput): Promise<ImportParseResult> {
    try {
      let bytes: Uint8Array;
      let avatarDataUrl: string | undefined;

      if (input instanceof Uint8Array) {
        bytes = input;
      } else if (input instanceof ArrayBuffer) {
        bytes = new Uint8Array(input);
      } else if (typeof input === 'string') {
        const cleanBase64 = input.replace(/^data:image\/[^;]+;base64,/, '');
        avatarDataUrl = input.startsWith('data:') ? input : `data:image/png;base64,${input}`;
        const parsedWords = CryptoJS.enc.Base64.parse(cleanBase64);
        bytes = this.wordArrayToUint8Array(parsedWords);
      } else if (input && typeof input === 'object') {
        if (input.size && input.size > this.MAX_FILE_SIZE) {
          return {
            success: false,
            error: `File size exceeds 15MB limit (provided: ${(input.size / (1024 * 1024)).toFixed(1)}MB). Please choose a smaller image.`
          };
        }

        if (input.base64) {
          avatarDataUrl = `data:image/png;base64,${input.base64}`;
          const parsedWords = CryptoJS.enc.Base64.parse(input.base64);
          bytes = this.wordArrayToUint8Array(parsedWords);
        } else if (typeof input.arrayBuffer === 'function') {
          const buf = await input.arrayBuffer();
          bytes = new Uint8Array(buf);
        } else if (input.uri) {
          // In React Native / Expo, fetch uri can retrieve the local blob/buffer
          const res = await fetch(input.uri);
          const buf = await res.arrayBuffer();
          bytes = new Uint8Array(buf);
          avatarDataUrl = input.uri;
        } else {
          return { success: false, error: 'Unrecognized PNG input format.' };
        }
      } else {
        return { success: false, error: 'Invalid PNG input.' };
      }

      if (bytes.length > this.MAX_FILE_SIZE) {
        return {
          success: false,
          error: `File size exceeds 15MB limit (provided: ${(bytes.length / (1024 * 1024)).toFixed(1)}MB).`
        };
      }

      // Verify PNG signature: 137 80 78 71 13 10 26 10
      const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      for (let i = 0; i < 8; i++) {
        if (bytes[i] !== pngSignature[i]) {
          return {
            success: false,
            error: 'Invalid PNG file. File does not contain a valid PNG signature.'
          };
        }
      }

      // Walk PNG chunks to locate tEXt / iTXt
      const chunks = this.extractPngChunks(bytes);
      let characterJsonString: string | null = null;

      for (const chunk of chunks) {
        if (chunk.name === 'tEXt') {
          // Format: Keyword (1-79 bytes) + Null (1 byte) + Text string
          const nullIndex = chunk.data.indexOf(0);
          if (nullIndex > 0) {
            const keyword = this.decodeAscii(chunk.data.slice(0, nullIndex));
            if (['chara', 'ccv3', 'character'].includes(keyword.toLowerCase())) {
              const textBytes = chunk.data.slice(nullIndex + 1);
              const rawText = this.decodeUtf8(textBytes);
              characterJsonString = this.decodeCardText(rawText);
              if (characterJsonString) break;
            }
          }
        } else if (chunk.name === 'iTXt') {
          // Format: Keyword + Null + compFlag + compMethod + langTag + Null + transKey + Null + text
          const nullIndex = chunk.data.indexOf(0);
          if (nullIndex > 0) {
            const keyword = this.decodeAscii(chunk.data.slice(0, nullIndex));
            if (['chara', 'ccv3', 'character'].includes(keyword.toLowerCase())) {
              const compFlag = chunk.data[nullIndex + 1];
              if (compFlag === 0) {
                let textStart = nullIndex + 3;
                let nullCount = 0;
                while (textStart < chunk.data.length && nullCount < 2) {
                  if (chunk.data[textStart] === 0) nullCount++;
                  textStart++;
                }
                const rawText = this.decodeUtf8(chunk.data.slice(textStart));
                characterJsonString = this.decodeCardText(rawText);
                if (characterJsonString) break;
              }
            }
          }
        }
      }

      if (!characterJsonString) {
        return {
          success: false,
          error:
            'No character card data found in this PNG. The image does not contain a "chara" or "ccv3" metadata chunk. Try exporting in JSON or copying the text manually.'
        };
      }

      let parsedJson: any;
      try {
        parsedJson = JSON.parse(characterJsonString);
      } catch (e: any) {
        return {
          success: false,
          error: 'Character metadata chunk was found, but failed to parse JSON data: ' + (e?.message || String(e))
        };
      }

      const mapped = this.mapCardObjectToWarden(parsedJson, avatarDataUrl, 'png_tEXt');
      return {
        success: true,
        data: mapped,
        warnings:
          mapped.missingMandatoryFields.length > 0
            ? [`Missing required fields: ${mapped.missingMandatoryFields.join(', ')} (you can edit them in the preview).`]
            : undefined
      };
    } catch (err: any) {
      return {
        success: false,
        error: 'Failed to process PNG file: ' + (err?.message || String(err))
      };
    }
  }

  /**
   * Parse JSON character card (V1, V2, V3 or Warden AI native)
   */
  public static parseJsonCard(rawText: string, fallbackAvatarUrl?: string): ImportParseResult {
    if (!rawText.trim()) {
      return { success: false, error: 'JSON content is empty.' };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch (e: any) {
      return {
        success: false,
        error: 'Invalid JSON syntax: ' + (e?.message || 'Check for trailing commas or unescaped characters.')
      };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return { success: false, error: 'JSON card must be an object.' };
    }

    const format: ImportedCardData['originalFormat'] =
      parsed.spec === 'chara_card_v3'
        ? 'chara_card_v3'
        : parsed.spec === 'chara_card_v2'
        ? 'chara_card_v2'
        : parsed.scenarios && parsed.systemPrompt && parsed.name
        ? 'warden_json'
        : parsed.name && (parsed.description || parsed.personality)
        ? 'chara_card_v1'
        : 'generic_json';

    const mapped = this.mapCardObjectToWarden(parsed, fallbackAvatarUrl, format);

    return {
      success: true,
      data: mapped,
      warnings:
        mapped.missingMandatoryFields.length > 0
          ? [`Missing required fields: ${mapped.missingMandatoryFields.join(', ')}`]
          : undefined
    };
  }

  /**
   * Helper to parse manual text (e.g. pasted W++ or raw character prompts)
   */
  public static parseManualText(text: string): ImportParseResult {
    if (!text.trim()) {
      return { success: false, error: 'Manual text cannot be empty.' };
    }

    if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
      return this.parseJsonCard(text);
    }

    const lines = text.split('\n');
    let currentField = 'description';
    let name = '';
    let description = '';
    let personality = '';
    let scenario = '';
    let firstMessage = '';
    let exampleDialogue = '';
    let tags: string[] = ['manual-import'];

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (/^name\s*[:=-]/i.test(line)) {
        name = line.replace(/^name\s*[:=-]\s*/i, '').trim();
        currentField = 'name';
      } else if (/^(?:description|desc|appearance|details)\s*[:=-]/i.test(line)) {
        description += line.replace(/^(?:description|desc|appearance|details)\s*[:=-]\s*/i, '') + '\n';
        currentField = 'description';
      } else if (/^(?:personality|traits|mind)\s*[:=-]/i.test(line)) {
        personality += line.replace(/^(?:personality|traits|mind)\s*[:=-]\s*/i, '') + '\n';
        currentField = 'personality';
      } else if (/^(?:scenario|setting|context)\s*[:=-]/i.test(line)) {
        scenario += line.replace(/^(?:scenario|setting|context)\s*[:=-]\s*/i, '') + '\n';
        currentField = 'scenario';
      } else if (/^(?:first\s*message|greeting|greeting\s*message|opener)\s*[:=-]/i.test(line)) {
        firstMessage += line.replace(/^(?:first\s*message|greeting|greeting\s*message|opener)\s*[:=-]\s*/i, '') + '\n';
        currentField = 'firstMessage';
      } else if (/^(?:example\s*dialogue|dialogue|examples)\s*[:=-]/i.test(line)) {
        exampleDialogue += line.replace(/^(?:example\s*dialogue|dialogue|examples)\s*[:=-]\s*/i, '') + '\n';
        currentField = 'exampleDialogue';
      } else if (/^(?:tags?|categories)\s*[:=-]/i.test(line)) {
        const rawTags = line.replace(/^(?:tags?|categories)\s*[:=-]\s*/i, '').split(/[,;]/);
        tags = tags.concat(rawTags.map(t => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean));
      } else {
        if (currentField === 'name' && !name) {
          name = line;
        } else if (currentField === 'personality') {
          personality += rawLine + '\n';
        } else if (currentField === 'scenario') {
          scenario += rawLine + '\n';
        } else if (currentField === 'firstMessage') {
          firstMessage += rawLine + '\n';
        } else if (currentField === 'exampleDialogue') {
          exampleDialogue += rawLine + '\n';
        } else {
          description += rawLine + '\n';
        }
      }
    }

    if (!name.trim()) {
      const firstLine = lines.find(l => l.trim().length > 0)?.trim() || 'Imported Character';
      name = firstLine.length < 50 ? firstLine : 'Imported Character';
    }

    if (!firstMessage.trim()) {
      firstMessage = `*${name} stands before you in quiet contemplation.* "Greetings. What brings you to see me today?"`;
    }

    const mapped: ImportedCardData = {
      name: this.sanitizeText(name),
      shortDescription: this.sanitizeText(description.trim() || 'Imported character description.'),
      personality: this.sanitizeText(personality.trim() || 'Adaptable and observant.'),
      background: this.sanitizeText(scenario.trim() || description.trim()),
      exampleDialogue: this.sanitizeText(exampleDialogue.trim() || '<START>\n{{user}}: "Hello."\n{{char}}: *nods respectfully* "Hello."'),
      firstMessage: this.sanitizeText(firstMessage.trim()),
      alternateGreetings: [],
      tags: Array.from(new Set(tags)),
      contentRating: 'SFW',
      age: 21,
      originalFormat: 'generic_json',
      unsupportedFields: [],
      missingMandatoryFields: []
    };

    return {
      success: true,
      data: mapped
    };
  }

  /**
   * Validate and inspect Community character URLs (Datacat, JannyAI, JanitorAI)
   */
  public static validateCommunityUrl(inputUrl: string): {
    isValid: boolean;
    hubType?: 'datacat' | 'jannyai' | 'janitorai' | 'other';
    characterId?: string;
    normalizedUrl?: string;
    errorMessage?: string;
    explanation?: string;
  } {
    const trimmed = inputUrl.trim();
    if (!trimmed) {
      return {
        isValid: false,
        errorMessage: 'Please enter a valid URL.'
      };
    }

    try {
      const parsed = new URL(trimmed);
      const hostname = parsed.hostname.toLowerCase();

      const isDatacat = hostname === 'datacat.run' || hostname.endsWith('.datacat.run');
      const isJanny = hostname === 'jannyai.com' || hostname.endsWith('.jannyai.com');
      const isJanitor = hostname === 'janitorai.com' || hostname.endsWith('.janitorai.com');

      if (!isDatacat && !isJanny && !isJanitor) {
        return {
          isValid: false,
          errorMessage: 'URL must point to jannyai.com, datacat.run, or janitorai.com.',
          explanation: 'NekoChat verifies supported community hubs. If your character card is from another site, download the PNG or JSON card and upload it directly.'
        };
      }

      const hubType: 'datacat' | 'jannyai' | 'janitorai' = isJanny
        ? 'jannyai'
        : isJanitor
        ? 'janitorai'
        : 'datacat';

      const pathParts = parsed.pathname.split('/').filter(Boolean);
      const charIndex = pathParts.findIndex(p =>
        ['character', 'characters', 'c', 'card', 'bot'].includes(p.toLowerCase())
      );
      const charId = charIndex >= 0 && pathParts[charIndex + 1] ? pathParts[charIndex + 1] : undefined;

      const hubName = isJanny ? 'JannyAI' : isJanitor ? 'JanitorAI' : 'Datacat';

      return {
        isValid: true,
        hubType,
        characterId: charId,
        normalizedUrl: parsed.origin + parsed.pathname,
        explanation: `${hubName} character card detected. If direct URL fetching is blocked by network restrictions, save the portrait PNG from ${hubName} and import it directly.`
      };
    } catch {
      return {
        isValid: false,
        errorMessage: 'Invalid URL format. Please enter a full URL including https://.'
      };
    }
  }

  public static validateDatacatUrl(inputUrl: string) {
    return this.validateCommunityUrl(inputUrl);
  }

  /**
   * Attempt authorized community character retrieval (Datacat, JannyAI, JanitorAI)
   */
  public static async fetchCommunityCharacter(url: string): Promise<ImportParseResult> {
    const val = this.validateCommunityUrl(url);
    if (!val.isValid) {
      return {
        success: false,
        error: val.errorMessage || 'Invalid URL.'
      };
    }

    const hubName = val.hubType === 'jannyai' ? 'JannyAI' : val.hubType === 'janitorai' ? 'JanitorAI' : 'Datacat';

    try {
      const response = await fetch(val.normalizedUrl || url, {
        headers: {
          Accept: 'application/json, text/html, image/png, */*'
        }
      });

      if (!response.ok) {
        return {
          success: false,
          error: `${hubName} request returned status ${response.status} (${response.statusText}).`,
          warnings: [
            `${hubName} pages may require dynamic JavaScript rendering or anti-bot verification.`,
            `Recommended fallback: Download the character card / image from ${hubName} and upload it directly.`
          ]
        };
      }

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const jsonText = await response.text();
        return this.parseJsonCard(jsonText);
      }

      if (contentType.includes('image/png')) {
        const arrayBuf = await response.arrayBuffer();
        return await this.parsePngCard(new Uint8Array(arrayBuf));
      }

      const html = await response.text();
      const metaMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
      if (metaMatch && metaMatch[1]) {
        try {
          const nextData = JSON.parse(metaMatch[1]);
          const cardData =
            nextData?.props?.pageProps?.character ||
            nextData?.props?.pageProps?.card ||
            nextData?.props?.pageProps?.bot;
          if (cardData) {
            return {
              success: true,
              data: this.mapCardObjectToWarden(cardData, undefined, 'generic_json')
            };
          }
        } catch {}
      }

      const charMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/i);
      if (charMatch && charMatch[1]) {
        try {
          const stateData = JSON.parse(charMatch[1]);
          const cardData = stateData?.character || stateData?.card;
          if (cardData) {
            return {
              success: true,
              data: this.mapCardObjectToWarden(cardData, undefined, 'generic_json')
            };
          }
        } catch {}
      }

      return {
        success: false,
        error: `Unable to extract character payload directly from ${hubName} URL.`,
        warnings: [
          `The character page is protected by dynamic hydration or access restrictions.`,
          `Guaranteed Solution: Download the PNG card file from ${hubName} and import it directly into NekoChat.`
        ]
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Network error retrieving ${hubName} URL: ` + (err?.message || String(err)),
        warnings: [
          `Save the character card / image from ${hubName} and import it directly via PNG / JSON tab.`
        ]
      };
    }
  }

  public static fetchDatacatCharacter(url: string): Promise<ImportParseResult> {
    return this.fetchCommunityCharacter(url);
  }

  /**
   * Map raw card JSON (V1, V2, V3 or native) to NekoChat / Warden schema
   */
  public static mapCardObjectToWarden(
    raw: any,
    fallbackAvatarUrl?: string,
    format: ImportedCardData['originalFormat'] = 'generic_json'
  ): ImportedCardData {
    const data = raw.data ? raw.data : raw;

    const chatName = this.sanitizeText(
      data.chat_name ||
      raw.chat_name ||
      data.chatName ||
      raw.chatName ||
      data.char_name ||
      ''
    );
    const rawTitle = this.sanitizeText(data.name || data.title || 'Unnamed Character');
    const rawSubtitle = this.sanitizeText(data.subtitle || data.tagline || data.short_description || '');

    const rawDesc = data.description || data.char_persona || data.char_desc || '';
    const rawPersonality = data.personality || data.char_personality || '';
    const personality = this.sanitizeText(rawPersonality || rawDesc);

    const rawFirstMes =
      data.first_mes ||
      data.greeting ||
      data.first_message ||
      data.initial_message ||
      data.openingMessage ||
      '';

    const name =
      chatName && chatName !== rawTitle && chatName.length <= 34
        ? chatName
        : extractCleanCharacterName(rawTitle, rawSubtitle, rawFirstMes, personality);

    const subtitle = rawTitle !== name ? rawTitle : rawSubtitle;

    const shortDescription = this.sanitizeText(
      subtitle || (rawDesc.length > 250 ? rawDesc.substring(0, 247) + '...' : rawDesc)
    );

    const scenario = this.sanitizeText(data.scenario || data.world_scenario || '');
    const background = this.sanitizeText(
      rawDesc && rawDesc !== personality ? rawDesc : scenario || 'A character imported from community archives.'
    );

    const firstMessage = this.sanitizeText(
      rawFirstMes || `*${name} observes you attentively.* "Welcome. I am ${name}."`
    );

    const alternateGreetings: string[] = Array.isArray(data.alternate_greetings)
      ? data.alternate_greetings.map((g: any) => this.sanitizeText(String(g))).filter(Boolean)
      : [];

    const systemPrompt = this.sanitizeText(
      data.system_prompt ||
      data.systemPrompt ||
      `You are ${name}. Embody their personality, mannerisms, and background in every response. Use asterisks for actions (*she smiles*) and quotes for dialogue ("spoken line"). Never break character.`
    );

    const exampleDialogue = this.sanitizeText(
      data.mes_example ||
      data.example_dialogue ||
      data.example_dialogs ||
      data.exampleDialogue ||
      `<START>\n{{user}}: "Hello."\n{{char}}: *nods warmly* "Greetings."`
    );

    const creatorNotes = this.sanitizeText(data.creator_notes || data.creatorNotes || data.comment || '');
    const creatorUsername = this.sanitizeText(
      cleanCreatorHandle(raw.creator || data.creator || raw.author || data.author || 'Imported Creator')
    );

    let tags: string[] = ['imported'];
    if (Array.isArray(data.tags)) {
      tags = tags.concat(data.tags.map((t: any) => String(t).trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean));
    }
    if (Array.isArray(raw.tags)) {
      tags = tags.concat(raw.tags.map((t: any) => String(t).trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean));
    }

    let age = 20;
    if (typeof data.age === 'number') {
      age = data.age;
    } else if (typeof data.age === 'string') {
      const parsedAge = parseInt(data.age, 10);
      if (!isNaN(parsedAge)) age = parsedAge;
    }

    const avatarUrl =
      fallbackAvatarUrl ||
      (typeof data.avatarUrl === 'string' && data.avatarUrl.startsWith('http') ? data.avatarUrl : undefined) ||
      (typeof data.avatar_url === 'string' && data.avatar_url.startsWith('http') ? data.avatar_url : undefined) ||
      (typeof data.avatar === 'string' && data.avatar.startsWith('http') ? data.avatar : undefined) ||
      (typeof data.image === 'string' && data.image.startsWith('http') ? data.image : undefined) ||
      undefined;

    let contentRating: ContentRating = 'SFW';
    const tagString = tags.join(' ').toLowerCase();
    if (data.nsfw === true || tagString.includes('nsfw') || tagString.includes('18+')) {
      contentRating = 'NSFW';
    } else if (tagString.includes('mature') || tagString.includes('violence')) {
      contentRating = 'Mature';
    }

    let lorebook: ImportedCardData['lorebook'] | undefined;
    const rawBook = data.character_book || data.lorebook;
    if (rawBook && Array.isArray(rawBook.entries)) {
      lorebook = {
        name: this.sanitizeText(rawBook.name || `${name} Lorebook`),
        description: this.sanitizeText(rawBook.description || `Embedded lore for ${name}`),
        entries: rawBook.entries.map((e: any, idx: number) => ({
          title: this.sanitizeText(e.comment || e.title || `Entry ${idx + 1}`),
          keys: Array.isArray(e.keys) ? e.keys.map(String) : [],
          content: this.sanitizeText(e.content || ''),
          priority: typeof e.priority === 'number' ? e.priority : 10,
          enabled: e.enabled !== false
        }))
      };
    }

    const standardKeys = new Set([
      'name', 'char_name', 'title', 'subtitle', 'tagline', 'description', 'char_desc',
      'personality', 'char_personality', 'scenario', 'first_mes', 'greeting',
      'alternate_greetings', 'system_prompt', 'mes_example', 'creator_notes',
      'character_book', 'tags', 'creator', 'author', 'avatar', 'avatarUrl',
      'spec', 'spec_version', 'age', 'nsfw'
    ]);

    const unsupportedFields: string[] = [];
    for (const key of Object.keys(data)) {
      if (!standardKeys.has(key) && typeof data[key] !== 'function') {
        unsupportedFields.push(key);
      }
    }

    const missingMandatoryFields: string[] = [];
    if (!name || name === 'Unnamed Character') missingMandatoryFields.push('Character Name');
    if (!personality) missingMandatoryFields.push('Personality');
    if (!shortDescription) missingMandatoryFields.push('Description');
    if (!firstMessage) missingMandatoryFields.push('First Message');
    if (age < 18) missingMandatoryFields.push('Minimum Age (must be 18+)');

    return {
      name,
      subtitle,
      shortDescription,
      personality,
      background,
      systemPrompt,
      exampleDialogue,
      firstMessage,
      alternateGreetings,
      creatorNotes,
      creatorUsername,
      tags: Array.from(new Set(tags)),
      avatarUrl,
      contentRating,
      age: Math.max(age, 18),
      lorebook,
      originalFormat: format,
      unsupportedFields,
      missingMandatoryFields
    };
  }

  /**
   * Sanitize text: prevent script/XSS execution while preserving Markdown & converting HTML to Markdown
   */
  public static sanitizeText(input: string): string {
    if (!input) return '';
    return (
      input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(
          /<(?:iframe|object|embed|applet)\b[^<]*(?:(?!<\/(?:iframe|object|embed|applet)>)<[^<]*)*<\/(?:iframe|object|embed|applet)>/gi,
          ''
        )
        .replace(/<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*?>/gi, (fullTag, src) => {
          const altMatch = fullTag.match(/\balt=["']([^"']*)["']/i);
          const alt = altMatch ? altMatch[1].trim() : '';
          return `\n\n![${alt}](${src.trim()})\n\n`;
        })
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:p|div|h[1-6]|li|blockquote|section|article)>/gi, '\n\n')
        .replace(/<hr\s*\/?>/gi, '\n---\n')
        .replace(/<(?:b|strong)\b[^>]*>([\s\S]*?)<\/(?:b|strong)>/gi, '**$1**')
        .replace(/<(?:i|em)\b[^>]*>([\s\S]*?)<\/(?:i|em)>/gi, '*$1*')
        .replace(/<(?!\/?(?:user|char)\b)[a-zA-Z\/][^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\0/g, '')
        .trim()
    );
  }

  /**
   * Decode card text from raw tEXt/iTXt chunk payload
   */
  private static decodeCardText(raw: string): string | null {
    const trimmed = raw.trim();

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed;
    }

    try {
      const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/');
      const parsedWords = CryptoJS.enc.Base64.parse(normalized);
      const decodedUtf8 = CryptoJS.enc.Utf8.stringify(parsedWords);
      if (decodedUtf8 && decodedUtf8.trim().startsWith('{')) {
        return decodedUtf8.trim();
      }
    } catch {}

    return null;
  }

  /**
   * Helper to parse PNG binary chunks
   */
  private static extractPngChunks(bytes: Uint8Array): { name: string; data: Uint8Array }[] {
    const chunks: { name: string; data: Uint8Array }[] = [];
    let offset = 8; // skip 8-byte PNG signature

    const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    while (offset < bytes.length - 8) {
      const length = dataView.getUint32(offset, false);
      offset += 4;

      const chunkTypeBytes = bytes.slice(offset, offset + 4);
      const chunkName = String.fromCharCode(...chunkTypeBytes);
      offset += 4;

      const chunkData = bytes.slice(offset, offset + length);
      offset += length;

      // Skip 4-byte CRC
      offset += 4;

      chunks.push({ name: chunkName, data: chunkData });

      if (chunkName === 'IEND') break;
    }

    return chunks;
  }

  private static decodeAscii(bytes: Uint8Array): string {
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
      result += String.fromCharCode(bytes[i]);
    }
    return result;
  }

  private static decodeUtf8(bytes: Uint8Array): string {
    if (typeof TextDecoder !== 'undefined') {
      try {
        return new TextDecoder('utf-8').decode(bytes);
      } catch {}
    }
    // Fallback using CryptoJS
    const words: number[] = [];
    for (let i = 0; i < bytes.length; i++) {
      words[i >>> 2] |= (bytes[i] & 0xff) << (24 - (i % 4) * 8);
    }
    const wordArray = CryptoJS.lib.WordArray.create(words, bytes.length);
    return CryptoJS.enc.Utf8.stringify(wordArray);
  }

  private static wordArrayToUint8Array(wordArray: CryptoJS.lib.WordArray): Uint8Array {
    const { words, sigBytes } = wordArray;
    const u8 = new Uint8Array(sigBytes);
    for (let i = 0; i < sigBytes; i++) {
      const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
      u8[i] = byte;
    }
    return u8;
  }
}

export const characterImportService = CharacterImportService;
export default characterImportService;
