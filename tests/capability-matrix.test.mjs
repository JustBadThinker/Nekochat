import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPABILITY_CATEGORIES,
  buildEffectiveMatrix,
  classifyTestOutcome,
  computeEffectiveStatus,
  createEmptyMatrixData,
  exportSafeCapabilityReport,
  isRecordStale,
  recordCapabilityResult,
} from '../src/services/capabilityMatrix.ts';

test('1 & 2 & 3. Independent category statuses and Model vs Provider separation', () => {
  let data = createEmptyMatrixData();
  data = recordCapabilityResult(data, {
    endpointIdentity: 'openrouter:openrouter.ai/api/v1',
    providerName: 'OpenRouter',
    modelId: 'mistralai/mistral-nemo',
    categoryId: 'nsfw',
    modelStatus: 'supported',
    providerStatus: 'unsupported',
    evidenceSource: 'direct_test',
  });
  data = recordCapabilityResult(data, {
    endpointIdentity: 'openrouter:openrouter.ai/api/v1',
    providerName: 'OpenRouter',
    modelId: 'mistralai/mistral-nemo',
    categoryId: 'romance',
    modelStatus: 'supported',
    providerStatus: 'supported',
    evidenceSource: 'direct_test',
  });

  const rows = buildEffectiveMatrix(data, {
    modelId: 'mistralai/mistral-nemo',
    endpointIdentity: 'openrouter:openrouter.ai/api/v1',
  });

  const romance = rows.find(r => r.category.id === 'romance');
  const nsfw = rows.find(r => r.category.id === 'nsfw');
  const noncon = rows.find(r => r.category.id === 'non_consensual_fiction');

  assert.equal(romance.effectiveStatus, 'supported');
  assert.equal(nsfw.modelStatus, 'supported');
  assert.equal(nsfw.providerStatus, 'unsupported');
  assert.equal(nsfw.effectiveStatus, 'unsupported');
  assert.equal(noncon.effectiveStatus, 'unknown');
});

test('4. Unknown status handling never defaults to Supported', () => {
  assert.equal(computeEffectiveStatus('supported', 'unknown'), 'unknown');
  assert.equal(computeEffectiveStatus('unknown', 'supported'), 'unknown');
  assert.equal(computeEffectiveStatus('unknown', 'unknown'), 'unknown');
  assert.equal(computeEffectiveStatus('unsupported', 'unknown'), 'unsupported');
});

test('5, 6, 7. Classification distinguishes network failure, explicit moderation refusal, and API rejection', () => {
  const net = classifyTestOutcome({ networkError: true, errorMessage: 'ECONNRESET' });
  assert.equal(net.outcome, 'network_failure');
  assert.equal(net.modelStatus, 'unknown');
  assert.equal(net.providerStatus, 'unknown');

  const mod = classifyTestOutcome({ httpStatus: 400, errorMessage: 'Blocked by content_filter policy' });
  assert.equal(mod.outcome, 'explicit_moderation_refusal');
  assert.equal(mod.providerStatus, 'unsupported');

  const apiRej = classifyTestOutcome({ httpStatus: 403, errorMessage: 'Forbidden endpoint access' });
  assert.equal(apiRej.outcome, 'provider_api_rejection');
  assert.equal(apiRej.providerStatus, 'unsupported');

  const modelRef = classifyTestOutcome({ httpStatus: 200, responseText: "I'm sorry, I cannot assist with that request." });
  assert.equal(modelRef.outcome, 'model_refusal');
  assert.equal(modelRef.modelStatus, 'unsupported');
  assert.equal(modelRef.providerStatus, 'supported');

  const ok = classifyTestOutcome({ httpStatus: 200, responseText: 'The lantern flickered softly in the night.' });
  assert.equal(ok.outcome, 'success');
  assert.equal(ok.modelStatus, 'supported');
  assert.equal(ok.providerStatus, 'supported');
});

test('8 & 9. Model version changes and age mark results stale', () => {
  const rec = {
    status: 'supported',
    evidenceSource: 'direct_test',
    testedAt: Date.now() - 1000,
    modelVersion: 'v1.0',
  };
  assert.equal(isRecordStale(rec, { currentModelVersion: 'v1.0' }), false);
  assert.equal(isRecordStale(rec, { currentModelVersion: 'v2.0' }), true);
  assert.equal(isRecordStale(rec, { nowMs: Date.now() + 40 * 24 * 60 * 60 * 1000 }), true);
});

test('10 & 11. Manual test recording and retesting update provenance cleanly', () => {
  let data = createEmptyMatrixData();
  data = recordCapabilityResult(data, {
    endpointIdentity: 'custom:anoman.example/v1',
    providerName: 'Anoman',
    modelId: 'mistral-nemo',
    categoryId: 'violence',
    modelStatus: 'supported',
    providerStatus: 'supported',
    evidenceSource: 'user_reported',
    notes: 'Manual check',
  });
  let row = buildEffectiveMatrix(data, { modelId: 'mistral-nemo', endpointIdentity: 'custom:anoman.example/v1' }).find(r => r.category.id === 'violence');
  assert.equal(row.evidenceSource, 'user_reported');

  data = recordCapabilityResult(data, {
    endpointIdentity: 'custom:anoman.example/v1',
    providerName: 'Anoman',
    modelId: 'mistral-nemo',
    categoryId: 'violence',
    modelStatus: 'unsupported',
    providerStatus: 'supported',
    evidenceSource: 'direct_test',
  });
  row = buildEffectiveMatrix(data, { modelId: 'mistral-nemo', endpointIdentity: 'custom:anoman.example/v1' }).find(r => r.category.id === 'violence');
  assert.equal(row.evidenceSource, 'direct_test');
  assert.equal(row.effectiveStatus, 'unsupported');
});

test('12 & 13 & 14. Exported reports exclude API keys and all 22 categories are independent', () => {
  assert.ok(CAPABILITY_CATEGORIES.length >= 22);
  const data = {
    ...createEmptyMatrixData(),
    apiKey: 'sk-secret-do-not-leak',
  };
  const exported = exportSafeCapabilityReport(data);
  assert.ok(!exported.includes('sk-secret-do-not-leak'));
});

test('15. Soft refusals, multilingual refusals, empty meta-acks, and <think> tags are classified accurately', () => {
  const softPivot = classifyTestOutcome({
    httpStatus: 200,
    responseText: "Let's keep this PG and appropriate — instead, I can write a softer scene holding hands.",
  });
  assert.equal(softPivot.outcome, 'model_refusal');
  assert.equal(softPivot.modelStatus, 'unsupported');

  const idRefusal = classifyTestOutcome({
    httpStatus: 200,
    responseText: 'Maaf, saya tidak bisa memenuhi permintaan konten tersebut.',
  });
  assert.equal(idRefusal.outcome, 'model_refusal');
  assert.equal(idRefusal.modelStatus, 'unsupported');

  const emptyMeta = classifyTestOutcome({
    httpStatus: 200,
    responseText: 'Sure, I can do that!',
  });
  assert.equal(emptyMeta.outcome, 'inconclusive');
  assert.equal(emptyMeta.modelStatus, 'unknown');

  const withThinkRefusal = classifyTestOutcome({
    httpStatus: 200,
    responseText: '<think>Let me check policy carefully.</think>I have to decline that scenario.',
  });
  assert.equal(withThinkRefusal.outcome, 'model_refusal');
  assert.equal(withThinkRefusal.modelStatus, 'unsupported');
});
