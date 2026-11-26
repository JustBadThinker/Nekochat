import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLockoutMs,
  hashPasscode,
  hydratePasscodeFromSettings,
  isHashedPasscode,
  PASSCODE_STORE_KEY,
  preparePasscodeSettingsForSave,
  shouldRelockOnResume,
  verifyPasscode,
} from '../src/services/passcodeService.ts';

function createMemorySecureDriver(available = true, failVerify = false) {
  const store = new Map();
  return {
    store,
    driver: {
      isAvailable: async () => available,
      getItemAsync: async key => (failVerify ? null : store.get(key) ?? null),
      setItemAsync: async (key, value) => {
        store.set(key, value);
      },
      deleteItemAsync: async key => {
        store.delete(key);
      },
    },
  };
}

const baseSettings = {
  theme: 'midnight',
  contextLimit: 8192,
  currency: 'IDR',
  language: 'English',
  passcodeEnabled: true,
  passcodePin: '',
  passcodeHash: '',
  passcodeAutoLockSec: 60,
};

test('1. hashPasscode creates unique salted PBKDF2 hashes and verifyPasscode validates accurately', () => {
  const h1 = hashPasscode('2580');
  const h2 = hashPasscode('2580');
  assert.ok(isHashedPasscode(h1));
  assert.notEqual(h1, h2);
  assert.equal(verifyPasscode('2580', h1), true);
  assert.equal(verifyPasscode('2580', h2), true);
  assert.equal(verifyPasscode('0000', h1), false);
  // Legacy plaintext fallback still validates during migration
  assert.equal(verifyPasscode('1234', '1234'), true);
  assert.equal(verifyPasscode('9999', '1234'), false);
});

test('2. hydratePasscodeFromSettings migrates legacy plaintext PIN into SecureStore and strips AsyncStorage copy', async () => {
  const { store, driver } = createMemorySecureDriver(true, false);
  const legacy = { ...baseSettings, passcodePin: '4321', passcodeHash: '' };

  const res = await hydratePasscodeFromSettings(legacy, driver);
  assert.equal(res.needsPersist, true);
  assert.equal(res.asyncStorageCopy.passcodePin, '');
  assert.equal(res.asyncStorageCopy.passcodeHash, '');
  assert.equal(res.hydrated.passcodePin, '');
  assert.ok(isHashedPasscode(res.hydrated.passcodeHash));
  assert.equal(store.get(PASSCODE_STORE_KEY), res.hydrated.passcodeHash);
  assert.equal(verifyPasscode('4321', res.hydrated.passcodeHash), true);
});

test('3. preparePasscodeSettingsForSave stores salted hash (never plaintext) when SecureStore is unavailable', async () => {
  const { driver } = createMemorySecureDriver(false, false);
  const res = await preparePasscodeSettingsForSave(
    { ...baseSettings, passcodePin: '7890' },
    driver
  );
  assert.equal(res.asyncStorageCopy.passcodePin, '');
  assert.ok(isHashedPasscode(res.asyncStorageCopy.passcodeHash));
  assert.equal(verifyPasscode('7890', res.asyncStorageCopy.passcodeHash), true);
  assert.equal(verifyPasscode('0000', res.asyncStorageCopy.passcodeHash), false);
});

test('4. computeLockoutMs & shouldRelockOnResume enforce escalating cooldown and background timeout policies', () => {
  assert.equal(computeLockoutMs(1), 0);
  assert.equal(computeLockoutMs(4), 0);
  assert.equal(computeLockoutMs(5), 30_000);
  assert.equal(computeLockoutMs(6), 60_000);
  assert.equal(computeLockoutMs(7), 120_000);

  const t0 = 1_000_000;
  assert.equal(shouldRelockOnResume(t0, t0 + 100, 0), true);
  assert.equal(shouldRelockOnResume(t0, t0 + 59_000, 60), false);
  assert.equal(shouldRelockOnResume(t0, t0 + 60_000, 60), true);
  assert.equal(shouldRelockOnResume(t0, t0 + 9_999_999, -1), false);
  assert.equal(shouldRelockOnResume(null, t0 + 99_000, 0), false);
});
