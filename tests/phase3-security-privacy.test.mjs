import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getApiKeyStoreName,
  getImageKeyStoreName,
  hydrateProviderSecrets,
  removeProviderSecrets,
  stripAndPersistProviderSecrets,
} from '../src/services/secureKeyStore.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function createMemorySecureDriver(available = true) {
  const store = new Map();
  return {
    store,
    async isAvailable() {
      return available;
    },
    async getItemAsync(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async setItemAsync(key, value) {
      store.set(key, value);
    },
    async deleteItemAsync(key) {
      store.delete(key);
    },
  };
}

test('stripAndPersistProviderSecrets verifies readback before stripping plaintext keys', async () => {
  const driver = createMemorySecureDriver(true);
  const providers = [
    { id: 'prov_gemini', apiKey: 'AIzaTestSecret123', imageApiKey: 'imgSecret456', model: 'gemini-2.5-flash' },
    { id: 'prov_custom', apiKey: 'sk-anoman-secret', model: 'deepseek-v4-flash-0731' },
  ];

  const { sanitized, migratedCount, allVerified } = await stripAndPersistProviderSecrets(providers, driver);
  assert.equal(allVerified, true);
  assert.equal(migratedCount, 3);
  assert.equal(sanitized[0].apiKey, '');
  assert.equal(sanitized[0].imageApiKey, '');
  assert.equal(sanitized[1].apiKey, '');

  // Hydrating restores secrets
  const hydrated = await hydrateProviderSecrets(sanitized, driver);
  assert.equal(hydrated[0].apiKey, 'AIzaTestSecret123');
  assert.equal(hydrated[0].imageApiKey, 'imgSecret456');
  assert.equal(hydrated[1].apiKey, 'sk-anoman-secret');

  // Removing provider deletes its secrets
  await removeProviderSecrets('prov_gemini', driver);
  const afterDelete = await hydrateProviderSecrets(sanitized, driver);
  assert.equal(afterDelete[0].apiKey, '');
  assert.equal(afterDelete[0].imageApiKey, '');
});

test('stripAndPersistProviderSecrets preserves plaintext if SecureStore is unavailable or verification fails', async () => {
  const unavailableDriver = createMemorySecureDriver(false);
  const input = [{ id: 'prov_gemini', apiKey: 'AIzaKeepMe', model: 'gemini-2.5-flash' }];
  const resUnavailable = await stripAndPersistProviderSecrets(input, unavailableDriver);
  assert.equal(resUnavailable.allVerified, false);
  assert.equal(resUnavailable.sanitized[0].apiKey, 'AIzaKeepMe');

  // Driver that fails readback verification
  const brokenDriver = {
    async isAvailable() { return true; },
    async setItemAsync() {},
    async getItemAsync() { return null; },
    async deleteItemAsync() {},
  };
  const resBroken = await stripAndPersistProviderSecrets(input, brokenDriver);
  assert.equal(resBroken.allVerified, false);
  assert.equal(resBroken.sanitized[0].apiKey, 'AIzaKeepMe');
});

test('SecureStore key names only use allowed [a-zA-Z0-9._-] characters', () => {
  const k1 = getApiKeyStoreName('prov:custom/1@host');
  const k2 = getImageKeyStoreName('prov:custom/1@host');
  assert.match(k1, /^[a-zA-Z0-9._-]+$/);
  assert.match(k2, /^[a-zA-Z0-9._-]+$/);
});

test('Vault export in storageService excludes providers and apiKey', async () => {
  const storageSrc = await fs.readFile(path.join(ROOT, 'src/services/storageService.ts'), 'utf8');
  const exportMatch = storageSrc.match(/async exportVaultData\(\):[\s\S]*?return JSON\.stringify\(payload, null, 2\);/);
  assert.ok(exportMatch, 'exportVaultData should exist');
  assert.doesNotMatch(exportMatch[0], /getProviders|getProviderConfig|apiKey|imageApiKey/);
});
