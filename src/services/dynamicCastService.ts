/**
 * Dynamic Cast & Scene Continuity Service (Phase 7)
 *
 * Pure local-first, conversation-scoped cast & scene engine:
 * - Distinguishes mention vs. introduction vs. interaction (never auto-creates).
 * - Tracks provisional character profiles with strict source-message provenance.
 * - Never promotes unconfirmed AI-inferred assumptions into established facts.
 * - Formats [SCENE CONTINUITY], [DYNAMIC CAST & PRESENCE], and [KNOWLEDGE BOUNDARIES]
 *   within a strict token budget for `aiProviderService.streamChat()`.
 */

import type {
  CastFactRecord,
  CastFactSource,
  CastPresenceStatus,
  CastProfileField,
  DynamicCastMember,
  SceneContinuityState,
} from '../types';

export type CastSignalKind = 'interaction' | 'introduction' | 'mention';

export interface CastCandidateSuggestion {
  name: string;
  signal: CastSignalKind;
  suggestedPresence: CastPresenceStatus;
  suggestedAiControlled: boolean;
  draftCharacteristics?: string;
}

const ALL_PROFILE_FIELDS: CastProfileField[] = [
  'personality',
  'appearance',
  'background',
  'relationships',
  'interests',
];

const STOP_WORDS = new Set([
  'i', 'you', 'he', 'she', 'they', 'we', 'it', 'me', 'him', 'her', 'them', 'us',
  'my', 'your', 'his', 'their', 'our', 'the', 'a', 'an', 'and', 'or', 'but', 'if',
  'then', 'when', 'where', 'while', 'after', 'before', 'today', 'tonight', 'tomorrow',
  'yesterday', 'morning', 'afternoon', 'evening', 'night', 'monday', 'tuesday',
  'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february',
  'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october',
  'november', 'december', 'husband', 'wife', 'baby', 'dear', 'honey', 'love',
  'highschool', 'library', 'room', 'house', 'home', 'work', 'school', 'ooc',
  'user', 'char', 'assistant', 'system', 'penelope', 'please', 'thanks', 'thank',
  'hello', 'hi', 'hey', 'well', 'yeah', 'yes', 'no', 'okay', 'ok', 'sorry',
  'whoa', 'whoaa', 'wow', 'oh', 'ah', 'uh', 'uhh', 'umm', 'ummm', 'uhmm', 'hmm', 'ekhm', 'eh',
  'btw', 'really', 'same', 'nah', 'bruh', 'bro', 'sis', 'wait', 'actually', 'literally',
  'honestly', 'maybe', 'anyway', 'up', 'out', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'was', 'are', 'be', 'do', 'did', 'go', 'someone', 'somebody',
  'anyone', 'everybody', 'everyone', 'nobody', 'friend', 'friends', 'guy', 'girl',
]);

function normalizeName(raw: string): string {
  return raw.trim().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9'-]+$/g, '');
}

function isLikelyNameToken(token: string, excludedLower: Set<string>): boolean {
  const clean = normalizeName(token);
  if (clean.length < 2 || clean.length > 24) return false;
  const lower = clean.toLowerCase();
  if (STOP_WORDS.has(lower) || excludedLower.has(lower)) return false;
  return /^[a-zA-Z][a-zA-Z'-]+$/.test(clean);
}

/**
 * Classifies whether a user message mentions, introduces, or directly interacts
 * with an unregistered character name. Suggestion-only — NEVER auto-creates cast.
 */
export function detectCastCandidates(params: {
  message: string;
  primaryCharName: string;
  userName: string;
  existingCast: DynamicCastMember[];
}): CastCandidateSuggestion[] {
  const text = String(params.message || '').trim();
  if (!text) return [];

  const excluded = new Set<string>([
    params.primaryCharName.toLowerCase(),
    params.userName.toLowerCase(),
  ]);
  for (const m of params.existingCast) {
    excluded.add(m.name.toLowerCase());
    for (const a of m.aliases || []) excluded.add(a.toLowerCase());
  }

  const found = new Map<string, CastCandidateSuggestion>();
  const addCandidate = (rawName: string, next: CastCandidateSuggestion) => {
    const clean = normalizeName(rawName);
    if (!isLikelyNameToken(clean, excluded)) return;
    const key = clean.toLowerCase();
    const displayName = clean.charAt(0).toUpperCase() + clean.slice(1);
    const prev = found.get(key);
    const priority: Record<CastSignalKind, number> = { interaction: 3, introduction: 2, mention: 1 };
    if (!prev || priority[next.signal] > priority[prev.signal]) {
      found.set(key, { ...next, name: displayName });
    }
  };

  // 1. Direct interaction (require capitalized name or explicit greeting + capitalized/explicit name)
  const vocativePatterns = [
    /(?:^|[.!?\n]\s*)(?:hey|hi|hello)\s+([A-Z][a-zA-Z'-]{1,20})\b/g,
    /(?:^|[.!?\n]\s*)([A-Z][a-zA-Z'-]{1,20})\s*,/g,
    /,\s*([A-Z][a-zA-Z'-]{1,20})\s*[?!.]+$/g,
    /\b(?:isn't it|right|aren't you|will you|can you)\s+([a-zA-Z'-]{2,20})\s*[?!.]/gi,
  ];
  for (const rx of vocativePatterns) {
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) {
      addCandidate(m[1], {
        name: m[1],
        signal: 'interaction',
        suggestedPresence: 'present',
        suggestedAiControlled: true,
      });
    }
  }

  // 2. Character introduction ("meet Clara", "this is Clara", "with Clara", "chatting with Clara")
  const introPatterns = [
    /\b(?:this is|meet|introduce you to|hang out with|hanging out with|chatting with|talking with|met)\s+([a-zA-Z'-]{2,20})\b/gi,
  ];
  for (const rx of introPatterns) {
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) {
      addCandidate(m[1], {
        name: m[1],
        signal: 'introduction',
        suggestedPresence: 'present',
        suggestedAiControlled: true,
      });
    }
  }

  // 3. Capitalized mid-sentence mentions ("told Clara", "saw Clara")
  const capMatches = text.matchAll(/(?:^|\s)([A-Z][a-z]{1,20})\b/g);
  for (const m of capMatches) {
    addCandidate(m[1], {
      name: m[1],
      signal: 'mention',
      suggestedPresence: 'unknown',
      suggestedAiControlled: false,
    });
  }

  return Array.from(found.values());
}

/**
 * Heuristic check for world/RPG/narrator cards that do not represent a single
 * fixed primary character (e.g. "Dark Forest RPG", "Isekai Simulator").
 */
export function isWorldOrRpgCard(character: {
  name?: string;
  subtitle?: string;
  tags?: string[];
}): boolean {
  const title = `${character.name || ''} ${character.subtitle || ''}`;
  if (/\b(rpg|simulator|world\s*sim|sandbox|game\s*master|narrator|dungeon\s*master|text\s*adventure)\b/i.test(title)) {
    return true;
  }
  const tags = (character.tags || []).map(t => String(t).toLowerCase());
  return tags.some(t => t === 'rpg' || t === 'simulator' || t === 'world' || t === 'narrator');
}

/**
 * Scans a multi-character card's text fields for named characters (e.g.
 * `**Elena** - ...`, `Name: Marcus`, `Elena: "..."`) so the Cast Sheet can
 * suggest them as one-tap additions without auto-creating cast silently.
 */
export function extractCastCandidatesFromCard(params: {
  character: {
    name?: string;
    description?: string;
    personality?: string;
    background?: string;
    scenario?: string;
    firstMessage?: string;
  };
  userName: string;
  existingCast: DynamicCastMember[];
}): CastCandidateSuggestion[] {
  const rawBlob = [
    params.character.description,
    params.character.personality,
    params.character.background,
    params.character.scenario,
    params.character.firstMessage,
  ]
    .filter(Boolean)
    .join('\n')
    .replace(/<[^>]*>/g, ' ');

  if (!rawBlob.trim()) return [];

  const excluded = new Set<string>([
    (params.character.name || '').toLowerCase(),
    params.userName.toLowerCase(),
    'narrator',
    'system',
    'scenario',
    'overview',
    'world',
    'personality',
    'appearance',
    'background',
    'description',
    'rules',
    'notes',
    'summary',
  ]);
  for (const m of params.existingCast) {
    excluded.add(m.name.toLowerCase());
    for (const a of m.aliases || []) excluded.add(a.toLowerCase());
  }

  const found = new Map<string, CastCandidateSuggestion>();
  const addFromCard = (rawName: string, snippet?: string) => {
    const clean = normalizeName(rawName);
    if (!isLikelyNameToken(clean, excluded)) return;
    const key = clean.toLowerCase();
    if (found.has(key) || found.size >= 6) return;
    const displayName = clean.charAt(0).toUpperCase() + clean.slice(1);
    found.set(key, {
      name: displayName,
      signal: 'introduction',
      suggestedPresence: 'present',
      suggestedAiControlled: true,
      draftCharacteristics: snippet ? snippet.trim().slice(0, 140) : undefined,
    });
  };

  // 1. Explicit "Name: X" or "**X** - desc" or "### X" lines
  const lines = rawBlob.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const nameField = trimmed.match(/^(?:[-*•]\s*)?(?:name|character)\s*[:=-]\s*([A-Z][a-zA-Z'-]{1,20})\b/i);
    if (nameField) {
      addFromCard(nameField[1]);
      continue;
    }

    const boldBullet = trimmed.match(/^(?:[-*•\d.]+\s*)?\*\*([A-Z][a-zA-Z'-]{1,20})\*\*\s*(?:[:—–-]\s*(.+))?/);
    if (boldBullet) {
      addFromCard(boldBullet[1], boldBullet[2]);
      continue;
    }

    const heading = trimmed.match(/^#{1,4}\s*([A-Z][a-zA-Z'-]{1,20})\b(?:\s*[:—–-]\s*(.+))?/);
    if (heading) {
      addFromCard(heading[1], heading[2]);
      continue;
    }

    // Dialogue speaker labels like `Elena: "Wait..."`
    const speaker = trimmed.match(/^(?:\*\*)?([A-Z][a-zA-Z'-]{1,20})(?:\*\*)?\s*:\s*["“*]/);
    if (speaker) {
      addFromCard(speaker[1]);
    }
  }

  return Array.from(found.values());
}

export function createPrimaryCastMember(params: {
  conversationId: string;
  characterId: string;
  name: string;
  presence?: CastPresenceStatus;
  aiControlled?: boolean;
}): DynamicCastMember {
  const now = Date.now();
  return {
    id: `cast_primary_${params.conversationId}`,
    conversationId: params.conversationId,
    characterId: params.characterId,
    name: params.name,
    aliases: [],
    isPrimary: true,
    presence: params.presence ?? 'present',
    aiControlled: params.aiControlled ?? true,
    profileStatus: 'established',
    unknownFields: [],
    facts: [],
    knowledge: { witnessed: [], communicated: [], unknown: [] },
    createdAt: now,
    updatedAt: now,
  };
}

export function createProvisionalCastMember(params: {
  conversationId: string;
  characterId: string;
  name: string;
  presence?: CastPresenceStatus;
  aiControlled?: boolean;
  characteristics?: string;
  sourceMessageId?: string;
  turnIndex?: number;
}): DynamicCastMember {
  const now = Date.now();
  const id = `cast_${now}_${Math.random().toString(36).slice(2, 7)}`;
  const facts: CastFactRecord[] = [];
  const cleanChar = (params.characteristics || '').trim();
  if (cleanChar) {
    facts.push({
      id: `cf_${now}_${Math.random().toString(36).slice(2, 7)}`,
      castMemberId: id,
      conversationId: params.conversationId,
      field: 'fact',
      value: cleanChar,
      sourceType: 'user',
      confirmed: true,
      sourceMessageId: params.sourceMessageId,
      turnIndex: params.turnIndex,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  }

  const unknownFields = computeUnknownFields(facts);
  return {
    id,
    conversationId: params.conversationId,
    characterId: params.characterId,
    name: params.name.trim(),
    aliases: [],
    isPrimary: false,
    presence: params.presence ?? 'present',
    aiControlled: params.aiControlled ?? true,
    profileStatus: facts.length > 0 ? 'provisional' : 'stub',
    unknownFields,
    facts,
    knowledge: { witnessed: [], communicated: [], unknown: [] },
    introducedAtMessageId: params.sourceMessageId,
    introducedTurnIndex: params.turnIndex,
    createdAt: now,
    updatedAt: now,
  };
}

export function computeUnknownFields(facts: CastFactRecord[]): CastProfileField[] {
  const known = new Set(
    facts.filter(f => f.status === 'active' && f.confirmed).map(f => f.field)
  );
  return ALL_PROFILE_FIELDS.filter(f => !known.has(f));
}

export function appendCastFact(
  member: DynamicCastMember,
  params: {
    field: CastProfileField;
    value: string;
    sourceType: CastFactSource;
    confirmed?: boolean;
    sourceMessageId?: string;
    turnIndex?: number;
  }
): DynamicCastMember {
  const now = Date.now();
  // Never auto-promote ai_inferred assumptions to confirmed truth
  const confirmed = params.sourceType === 'ai_inferred' ? false : Boolean(params.confirmed ?? true);
  const newFact: CastFactRecord = {
    id: `cf_${now}_${Math.random().toString(36).slice(2, 7)}`,
    castMemberId: member.id,
    conversationId: member.conversationId,
    field: params.field,
    value: params.value.trim(),
    sourceType: params.sourceType,
    confirmed,
    sourceMessageId: params.sourceMessageId,
    turnIndex: params.turnIndex,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  const nextFacts = [...member.facts, newFact];
  const nextUnknown = computeUnknownFields(nextFacts);
  return {
    ...member,
    facts: nextFacts,
    unknownFields: nextUnknown,
    profileStatus: nextFacts.some(f => f.confirmed && f.status === 'active')
      ? member.isPrimary
        ? 'established'
        : 'provisional'
      : 'stub',
    updatedAt: now,
  };
}

export function getConfirmedCharacteristicsSummary(member: DynamicCastMember): string {
  const activeConfirmed = member.facts.filter(f => f.status === 'active' && f.confirmed);
  if (activeConfirmed.length === 0) return '';
  return activeConfirmed.map(f => f.value).join('; ');
}

export function buildDynamicCastPromptSection(params: {
  primaryCharName: string;
  userName: string;
  castMembers: DynamicCastMember[];
  sceneState?: SceneContinuityState | null;
  isRpgNarrator?: boolean;
  maxTokens?: number;
}): string {
  const maxTokens = params.maxTokens ?? 450;
  const sideCast = params.castMembers.filter(m => !m.isPrimary);
  const primaryOverride = params.castMembers.find(m => m.isPrimary);
  const hasScene =
    Boolean(params.sceneState) &&
    Boolean(
      params.sceneState?.currentLocation ||
        params.sceneState?.establishedTime ||
        (params.sceneState?.ongoingActivities?.length || 0) > 0 ||
        (params.sceneState?.unresolvedActions?.length || 0) > 0
    );

  // If no side cast, no primary presence/control override, no RPG narrator mode, and no scene state, keep single-char prompt untouched
  if (
    sideCast.length === 0 &&
    !hasScene &&
    !params.isRpgNarrator &&
    (!primaryOverride || (primaryOverride.presence === 'present' && primaryOverride.aiControlled))
  ) {
    return '';
  }

  const lines: string[] = [];

  // 1. Scene Continuity & Anti-Timeskip
  const presentAi = params.castMembers.filter(m => m.presence === 'present' && m.aiControlled);
  const presentNonAi = params.castMembers.filter(m => m.presence === 'present' && !m.aiControlled);
  const awayOrUnknown = params.castMembers.filter(m => m.presence !== 'present');

  lines.push('[SCENE CONTINUITY & ANTI-TIMESKIP]');
  if (params.sceneState?.currentLocation) {
    lines.push(`- Current Location: ${params.sceneState.currentLocation}`);
  }
  if (params.sceneState?.establishedTime) {
    lines.push(`- Established Time: ${params.sceneState.establishedTime}`);
  }
  if (params.sceneState?.ongoingActivities && params.sceneState.ongoingActivities.length > 0) {
    lines.push(`- Ongoing Activities: ${params.sceneState.ongoingActivities.join('; ')}`);
  }
  if (params.sceneState?.unresolvedActions && params.sceneState.unresolvedActions.length > 0) {
    lines.push(`- Unresolved Actions: ${params.sceneState.unresolvedActions.join('; ')}`);
  }
  lines.push(
    '- Stay strictly in the immediate scene. Do NOT time-skip ahead, complete ongoing activities on your own, or jump to another location unless the user explicitly transitions.'
  );
  lines.push(
    `- Keep ${params.userName} exclusively under user control: NEVER write ${params.userName}'s dialogue, decisions, movements, or completed actions.`
  );

  // 2. Dynamic Cast & Presence
  lines.push('');
  lines.push('[DYNAMIC CAST & SCENE PRESENCE]');
  if (presentAi.length > 0) {
    lines.push('Present & AI-Controlled (play these characters in this response when relevant):');
    for (const m of presentAi) {
      const confirmed = getConfirmedCharacteristicsSummary(m);
      const unknownNote =
        !m.isPrimary && m.unknownFields.length > 0
          ? ` | Unknown: ${m.unknownFields.join(', ')} (do not invent)`
          : '';
      lines.push(
        `- ${m.name}${m.isPrimary ? ' (Primary)' : ''}: ${
          confirmed || (m.isPrimary ? 'Use primary character card above' : 'Provisional stub — wait for user details, do not invent backstory')
        }${unknownNote}`
      );
    }
    if (presentAi.length >= 2) {
      lines.push(
        '- Multi-Character Attribution: Prefix each character’s spoken lines or actions clearly (e.g. **Clara:** "..." / **Penelope:** "...").'
      );
    }
  } else if (params.isRpgNarrator) {
    lines.push(
      `- RPG / Narrator Mode: Play the world, environment, and any NPCs ${params.userName} encounters naturally without forcing a single fixed character.`
    );
  } else {
    lines.push(
      `- No AI-controlled character is marked present right now; narrate only the immediate environment without speaking for ${params.userName} or away characters.`
    );
  }

  if (presentNonAi.length > 0) {
    lines.push(
      `Present (AI Control Disabled — do NOT write dialogue/actions for them): ${presentNonAi
        .map(m => m.name)
        .join(', ')}`
    );
  }

  if (awayOrUnknown.length > 0) {
    lines.push(
      `Not in Current Scene (do NOT jump to or speak for them): ${awayOrUnknown
        .map(m => `${m.name} (${m.presence})`)
        .join(', ')}`
    );
  }

  // 3. Knowledge Boundaries
  const kbLines: string[] = [];
  for (const m of params.castMembers) {
    const parts: string[] = [];
    if (m.knowledge.witnessed.length > 0) parts.push(`Witnessed: ${m.knowledge.witnessed.join('; ')}`);
    if (m.knowledge.communicated.length > 0) parts.push(`Told: ${m.knowledge.communicated.join('; ')}`);
    if (m.knowledge.unknown.length > 0) parts.push(`Does NOT know: ${m.knowledge.unknown.join('; ')}`);
    if (m.presence === 'away') {
      parts.push('Does NOT know events happening in the current off-screen scene unless later told');
    }
    if (parts.length > 0) {
      kbLines.push(`- ${m.name}: ${parts.join(' | ')}`);
    }
  }
  if (kbLines.length > 0) {
    lines.push('');
    lines.push('[KNOWLEDGE BOUNDARIES]');
    lines.push(...kbLines);
  }

  // Respect strict token budget
  const joined = lines.join('\n');
  const maxChars = maxTokens * 4;
  return joined.length > maxChars ? `${joined.slice(0, maxChars - 16)}\n[...cast trimmed]` : joined;
}
