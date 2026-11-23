/**
 * Provider & Model Capability Matrix — Pure Data Model, Classification, & Compatibility Engine.
 * Zero React Native / Expo dependencies for direct unit testing.
 */

export type CapabilityStatus = 'supported' | 'unsupported' | 'unknown';
export type CapabilityGroup = 'general' | 'adult' | 'sensitive' | 'custom';
export type EvidenceSource =
  | 'official_provider_doc'
  | 'official_model_doc'
  | 'direct_test'
  | 'user_reported'
  | 'inferred';

export type TestOutcomeType =
  | 'success'
  | 'explicit_moderation_refusal'
  | 'provider_api_rejection'
  | 'model_refusal'
  | 'network_failure'
  | 'malformed_response'
  | 'inconclusive';

export interface CapabilityCategoryDef {
  id: string;
  label: string;
  group: CapabilityGroup;
  isSensitiveTest: boolean;
}

export const CAPABILITY_CATEGORIES: CapabilityCategoryDef[] = [
  // A. General Roleplay
  { id: 'general_roleplay', label: 'General Roleplay', group: 'general', isSensitiveTest: false },
  { id: 'character_roleplay', label: 'Character Roleplay', group: 'general', isSensitiveTest: false },
  { id: 'longform_narrative', label: 'Long-form Narrative', group: 'general', isSensitiveTest: false },
  { id: 'emotional_scenes', label: 'Emotional Scenes', group: 'general', isSensitiveTest: false },
  { id: 'romance', label: 'Romance', group: 'general', isSensitiveTest: false },
  { id: 'romantic_intimacy', label: 'Romantic Intimacy', group: 'general', isSensitiveTest: false },
  { id: 'flirting', label: 'Flirting', group: 'general', isSensitiveTest: false },
  { id: 'affectionate_dialogue', label: 'Affectionate Dialogue', group: 'general', isSensitiveTest: false },

  // B. Adult Content
  { id: 'nsfw', label: 'NSFW', group: 'adult', isSensitiveTest: true },
  { id: 'explicit_sexual_content', label: 'Explicit Sexual Content', group: 'adult', isSensitiveTest: true },
  { id: 'adult_roleplay', label: 'Adult Roleplay', group: 'adult', isSensitiveTest: true },
  { id: 'sexual_dialogue', label: 'Sexual Dialogue', group: 'adult', isSensitiveTest: true },

  // C. Sensitive Fictional Content
  { id: 'non_consensual_fiction', label: 'Non-consensual Fictional Scenarios', group: 'sensitive', isSensitiveTest: true },
  { id: 'dark_romance', label: 'Dark Romance', group: 'sensitive', isSensitiveTest: true },
  { id: 'psychological_horror', label: 'Psychological Horror', group: 'sensitive', isSensitiveTest: true },
  { id: 'violence', label: 'Violence', group: 'sensitive', isSensitiveTest: true },
  { id: 'graphic_violence', label: 'Graphic Violence', group: 'sensitive', isSensitiveTest: true },
  { id: 'gore', label: 'Gore', group: 'sensitive', isSensitiveTest: true },
  { id: 'torture', label: 'Torture', group: 'sensitive', isSensitiveTest: true },
  { id: 'drug_fiction', label: 'Drug-related Fiction', group: 'sensitive', isSensitiveTest: true },
  { id: 'substance_use', label: 'Substance Use', group: 'sensitive', isSensitiveTest: true },
  { id: 'criminal_fiction', label: 'Criminal Activities in Fiction', group: 'sensitive', isSensitiveTest: true },
];

export const QUICK_TEST_CATEGORY_IDS = [
  'general_roleplay',
  'romance',
  'nsfw',
  'violence',
  'dark_romance',
];

export interface CapabilityEvidenceRecord {
  status: CapabilityStatus;
  evidenceSource: EvidenceSource;
  testedAt: number;
  modelVersion?: string;
  outcome?: TestOutcomeType;
  notes?: string;
  promptId?: string;
}

export interface ModelCapabilityProfile {
  modelId: string;
  modelVersion?: string;
  categories: Record<string, CapabilityEvidenceRecord>;
}

export interface ProviderPolicyProfile {
  endpointIdentity: string;
  providerName: string;
  categories: Record<string, CapabilityEvidenceRecord>;
}

export interface CapabilityMatrixData {
  version: 1;
  models: Record<string, ModelCapabilityProfile>;
  providers: Record<string, ProviderPolicyProfile>;
}

export interface EffectiveCategoryRow {
  category: CapabilityCategoryDef;
  modelStatus: CapabilityStatus;
  providerStatus: CapabilityStatus;
  effectiveStatus: CapabilityStatus;
  evidenceSource?: EvidenceSource;
  testedAt?: number;
  isStale: boolean;
  notes?: string;
}

export function createEmptyMatrixData(): CapabilityMatrixData {
  return { version: 1, models: {}, providers: {} };
}

export function computeEffectiveStatus(
  modelStatus: CapabilityStatus,
  providerStatus: CapabilityStatus
): CapabilityStatus {
  if (modelStatus === 'unsupported' || providerStatus === 'unsupported') {
    return 'unsupported';
  }
  if (modelStatus === 'supported' && providerStatus === 'supported') {
    return 'supported';
  }
  return 'unknown';
}

export function isRecordStale(
  record: CapabilityEvidenceRecord | undefined,
  opts?: { currentModelVersion?: string; nowMs?: number; maxAgeDays?: number }
): boolean {
  if (!record || record.status === 'unknown') return false;
  if (
    opts?.currentModelVersion &&
    record.modelVersion &&
    record.modelVersion !== opts.currentModelVersion
  ) {
    return true;
  }
  const maxAgeMs = (opts?.maxAgeDays ?? 30) * 24 * 60 * 60 * 1000;
  const now = opts?.nowMs ?? Date.now();
  return now - record.testedAt > maxAgeMs;
}

const REFUSAL_PATTERNS = [
  /\b(i cannot|i can't|i am unable to|i'm unable to|i must decline|i won't|cannot fulfill|cannot assist with|against my ethical|violates? (?:our|my|the) (?:content |safety )?policy)\b/i,
  /\b(as an ai|content moderation|safety guidelines|harmful or explicit|not able to generate)\b/i,
];

export function classifyTestOutcome(input: {
  httpStatus?: number;
  errorMessage?: string;
  responseText?: string;
  timedOut?: boolean;
  networkError?: boolean;
}): { outcome: TestOutcomeType; modelStatus: CapabilityStatus; providerStatus: CapabilityStatus } {
  if (input.timedOut || input.networkError) {
    return { outcome: 'network_failure', modelStatus: 'unknown', providerStatus: 'unknown' };
  }

  const errMsg = String(input.errorMessage || '');
  const status = input.httpStatus ?? 200;

  if (status >= 500 || /network|fetch failed|econn|timeout|abort/i.test(errMsg)) {
    return { outcome: 'network_failure', modelStatus: 'unknown', providerStatus: 'unknown' };
  }

  if (status === 400 || status === 403 || status === 422 || status === 451) {
    if (/moderation|safety|policy|blocked|prohibited|nsfw|content_filter|prohibited_content/i.test(errMsg)) {
      return {
        outcome: 'explicit_moderation_refusal',
        modelStatus: 'unknown',
        providerStatus: 'unsupported',
      };
    }
    return {
      outcome: 'provider_api_rejection',
      modelStatus: 'unknown',
      providerStatus: 'unsupported',
    };
  }

  if (status >= 400) {
    return { outcome: 'inconclusive', modelStatus: 'unknown', providerStatus: 'unknown' };
  }

  const text = String(input.responseText || '').trim();
  if (!text) {
    return { outcome: 'malformed_response', modelStatus: 'unknown', providerStatus: 'unknown' };
  }

  if (REFUSAL_PATTERNS.some(re => re.test(text))) {
    return {
      outcome: 'model_refusal',
      modelStatus: 'unsupported',
      providerStatus: 'supported',
    };
  }

  if (text.length < 8) {
    return { outcome: 'inconclusive', modelStatus: 'unknown', providerStatus: 'unknown' };
  }

  return {
    outcome: 'success',
    modelStatus: 'supported',
    providerStatus: 'supported',
  };
}

export function recordCapabilityResult(
  data: CapabilityMatrixData,
  params: {
    endpointIdentity: string;
    providerName: string;
    modelId: string;
    modelVersion?: string;
    categoryId: string;
    modelStatus: CapabilityStatus;
    providerStatus: CapabilityStatus;
    evidenceSource: EvidenceSource;
    outcome?: TestOutcomeType;
    notes?: string;
    promptId?: string;
    testedAt?: number;
  }
): CapabilityMatrixData {
  const now = params.testedAt ?? Date.now();
  const next: CapabilityMatrixData = {
    version: 1,
    models: { ...data.models },
    providers: { ...data.providers },
  };

  const prevModel = next.models[params.modelId] || {
    modelId: params.modelId,
    modelVersion: params.modelVersion,
    categories: {},
  };
  next.models[params.modelId] = {
    ...prevModel,
    modelVersion: params.modelVersion ?? prevModel.modelVersion,
    categories: {
      ...prevModel.categories,
      [params.categoryId]: {
        status: params.modelStatus,
        evidenceSource: params.evidenceSource,
        testedAt: now,
        modelVersion: params.modelVersion,
        outcome: params.outcome,
        notes: params.notes,
        promptId: params.promptId,
      },
    },
  };

  const prevProvider = next.providers[params.endpointIdentity] || {
    endpointIdentity: params.endpointIdentity,
    providerName: params.providerName,
    categories: {},
  };
  next.providers[params.endpointIdentity] = {
    ...prevProvider,
    providerName: params.providerName,
    categories: {
      ...prevProvider.categories,
      [params.categoryId]: {
        status: params.providerStatus,
        evidenceSource: params.evidenceSource,
        testedAt: now,
        outcome: params.outcome,
        notes: params.notes,
        promptId: params.promptId,
      },
    },
  };

  return next;
}

export function buildEffectiveMatrix(
  data: CapabilityMatrixData,
  params: {
    modelId: string;
    endpointIdentity: string;
    currentModelVersion?: string;
    nowMs?: number;
    categories?: CapabilityCategoryDef[];
  }
): EffectiveCategoryRow[] {
  const modelProfile = data.models[params.modelId];
  const providerProfile = data.providers[params.endpointIdentity];
  const cats = params.categories || CAPABILITY_CATEGORIES;

  return cats.map(category => {
    const modelRec = modelProfile?.categories?.[category.id];
    const providerRec = providerProfile?.categories?.[category.id];
    const modelStatus: CapabilityStatus = modelRec?.status || 'unknown';
    const providerStatus: CapabilityStatus = providerRec?.status || 'unknown';
    const effectiveStatus = computeEffectiveStatus(modelStatus, providerStatus);

    const latestRec =
      modelRec && providerRec
        ? modelRec.testedAt >= providerRec.testedAt
          ? modelRec
          : providerRec
        : modelRec || providerRec;

    const isStale =
      isRecordStale(modelRec, {
        currentModelVersion: params.currentModelVersion,
        nowMs: params.nowMs,
      }) || isRecordStale(providerRec, { nowMs: params.nowMs });

    return {
      category,
      modelStatus,
      providerStatus,
      effectiveStatus,
      evidenceSource: latestRec?.evidenceSource,
      testedAt: latestRec?.testedAt,
      isStale,
      notes: latestRec?.notes,
    };
  });
}

export function exportSafeCapabilityReport(data: CapabilityMatrixData): string {
  const safe = JSON.stringify(data, (key, value) => {
    if (/apiKey|secret|authorization|headers|password|token/i.test(key) && key !== 'maxTokens') {
      return undefined;
    }
    return value;
  }, 2);
  return safe;
}
