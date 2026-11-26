import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeExternalHttpUrl } from '../src/utils/urlSafety.ts';

test('sanitizeExternalHttpUrl allows valid http and https URLs', () => {
  assert.equal(sanitizeExternalHttpUrl('https://chub.ai/characters/test'), 'https://chub.ai/characters/test');
  assert.equal(sanitizeExternalHttpUrl('  http://localhost:3001/health  '), 'http://localhost:3001/health');
});

test('sanitizeExternalHttpUrl blocks dangerous, non-http, control-char, and malformed URLs', () => {
  assert.equal(sanitizeExternalHttpUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeExternalHttpUrl('tel:+1234567890'), null);
  assert.equal(sanitizeExternalHttpUrl('sms:12345'), null);
  assert.equal(sanitizeExternalHttpUrl('intent://scan/#Intent;end'), null);
  assert.equal(sanitizeExternalHttpUrl('file:///etc/passwd'), null);
  assert.equal(sanitizeExternalHttpUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(sanitizeExternalHttpUrl('https://example.com/\u0007bad'), null);
  assert.equal(sanitizeExternalHttpUrl('   '), null);
  assert.equal(sanitizeExternalHttpUrl(null), null);
  assert.equal(sanitizeExternalHttpUrl(undefined), null);
  assert.equal(sanitizeExternalHttpUrl('not a url'), null);
});
