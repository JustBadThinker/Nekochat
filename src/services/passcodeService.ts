/**
 * Passcode Security Helpers (Hashed Credential + Lockout + Background Re-Lock)
 *
 * - Stores a salted PBKDF2-SHA256 verifier instead of a plaintext 4-digit PIN.
 * - Uses `expo-secure-store` (via `SecureStoreDriver`) on native Android/iOS,
 *   keeping `AsyncStorage` free of any PIN or hash when SecureStore is available.
 * - Keeps no direct `react-native` or `expo-secure-store` imports so all security
 *   and migration logic runs directly in Node unit tests.
 */

import CryptoJS from 'crypto-js';
import type { AppSettings } from '../types';
import type { SecureStoreDriver } from './secureKeyStore';

export const PASSCODE_STORE_KEY = 'nekochat_passcode_hash_v1';
export const PASSCODE_MAX_ATTEMPTS = 5;
const HASH_PREFIX = 'pbkdf2_v1';
const PBKDF2_ITERATIONS = 2000;

function generateSaltHex(): string {
  try {
    const cryptoObj = (globalThis as { crypto?: { getRandomValues?: (arr: Uint8Array) => Uint8Array } }).crypto;
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      cryptoObj.getRandomValues(bytes);
      return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // Fall back to pseudo-random hex if globalThis.crypto is unavailable
  }
  let out = '';
  for (let i = 0; i < 32; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

export function hashPasscode(pin: string, saltHex?: string): string {
  const salt = saltHex || generateSaltHex();
  const hash = CryptoJS.PBKDF2(pin, salt, {
    keySize: 8,
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  }).toString(CryptoJS.enc.Hex);
  return `${HASH_PREFIX}$${salt}$${hash}`;
}

export function isHashedPasscode(value?: string): boolean {
  if (typeof value !== 'string') return false;
  const parts = value.split('$');
  return parts.length === 3 && parts[0] === HASH_PREFIX && parts[1].length > 0 && parts[2].length > 0;
}

export function isPlaintextPin(value?: string): boolean {
  return typeof value === 'string' && /^\d{4}$/.test(value);
}

export function hasPasscodeConfigured(
  settings?: Pick<AppSettings, 'passcodeHash' | 'passcodePin'> | null
): boolean {
  return Boolean(
    settings &&
      (isHashedPasscode(settings.passcodeHash) ||
        isHashedPasscode(settings.passcodePin) ||
        isPlaintextPin(settings.passcodePin))
  );
}

export function constantTimeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

export function verifyPasscode(inputPin: string, storedCredential?: string): boolean {
  if (!inputPin || !storedCredential) return false;
  if (isHashedPasscode(storedCredential)) {
    const [, salt, expectedHash] = storedCredential.split('$');
    const actualHash = hashPasscode(inputPin, salt).split('$')[2] || '';
    return constantTimeEqual(actualHash, expectedHash);
  }
  if (isPlaintextPin(storedCredential)) {
    return constantTimeEqual(inputPin, storedCredential);
  }
  return false;
}

export async function persistPasscodeCredential(
  pinOrHash: string,
  driver: SecureStoreDriver
): Promise<{ storedInSecureStore: boolean; asyncStorageHash: string; hydratedHash: string }> {
  const hashed = isHashedPasscode(pinOrHash) ? pinOrHash : hashPasscode(pinOrHash);
  const available = await driver.isAvailable().catch(() => false);
  if (available) {
    try {
      await driver.setItemAsync(PASSCODE_STORE_KEY, hashed);
      const readBack = await driver.getItemAsync(PASSCODE_STORE_KEY);
      if (readBack === hashed) {
        return { storedInSecureStore: true, asyncStorageHash: '', hydratedHash: hashed };
      }
    } catch {
      // Fall back to storing the salted PBKDF2 verifier in AsyncStorage
    }
  }
  return { storedInSecureStore: false, asyncStorageHash: hashed, hydratedHash: hashed };
}

export async function clearPasscodeCredential(driver: SecureStoreDriver): Promise<void> {
  const available = await driver.isAvailable().catch(() => false);
  if (!available) return;
  await driver.deleteItemAsync(PASSCODE_STORE_KEY).catch(() => {});
}

/**
 * Hydrates passcode credentials on settings load and silently migrates any
 * legacy plaintext `passcodePin` or unmigrated AsyncStorage hash into SecureStore.
 */
export async function hydratePasscodeFromSettings(
  raw: AppSettings,
  driver: SecureStoreDriver
): Promise<{ hydrated: AppSettings; asyncStorageCopy: AppSettings; needsPersist: boolean }> {
  const base: AppSettings = { ...raw };

  // 1. Migrate legacy plaintext PIN or hash mistakenly stored in `passcodePin`
  if (isPlaintextPin(base.passcodePin) || isHashedPasscode(base.passcodePin)) {
    const res = await persistPasscodeCredential(base.passcodePin!, driver);
    return {
      hydrated: { ...base, passcodePin: '', passcodeHash: res.hydratedHash },
      asyncStorageCopy: { ...base, passcodePin: '', passcodeHash: res.asyncStorageHash },
      needsPersist: true,
    };
  }

  // 2. Migrate AsyncStorage hash into SecureStore when SecureStore is available
  if (isHashedPasscode(base.passcodeHash)) {
    const available = await driver.isAvailable().catch(() => false);
    if (available) {
      const res = await persistPasscodeCredential(base.passcodeHash!, driver);
      if (res.storedInSecureStore) {
        return {
          hydrated: { ...base, passcodePin: '', passcodeHash: res.hydratedHash },
          asyncStorageCopy: { ...base, passcodePin: '', passcodeHash: '' },
          needsPersist: true,
        };
      }
    }
    return {
      hydrated: { ...base, passcodePin: '' },
      asyncStorageCopy: { ...base, passcodePin: '' },
      needsPersist: false,
    };
  }

  // 3. Hydrate hash from SecureStore into memory
  if (base.passcodeEnabled) {
    const available = await driver.isAvailable().catch(() => false);
    if (available) {
      const stored = await driver.getItemAsync(PASSCODE_STORE_KEY).catch(() => null);
      if (stored && isHashedPasscode(stored)) {
        return {
          hydrated: { ...base, passcodePin: '', passcodeHash: stored },
          asyncStorageCopy: { ...base, passcodePin: '', passcodeHash: '' },
          needsPersist: false,
        };
      }
    }
  }

  return {
    hydrated: { ...base, passcodePin: '' },
    asyncStorageCopy: { ...base, passcodePin: '' },
    needsPersist: false,
  };
}

/**
 * Prepares settings for persistence: clears stored credential if disabled, or
 * hashes & stores it in SecureStore (stripping plaintext `passcodePin`).
 */
export async function preparePasscodeSettingsForSave(
  merged: AppSettings,
  driver: SecureStoreDriver
): Promise<{ hydrated: AppSettings; asyncStorageCopy: AppSettings }> {
  if (!merged.passcodeEnabled) {
    await clearPasscodeCredential(driver);
    return {
      hydrated: { ...merged, passcodeEnabled: false, passcodePin: '', passcodeHash: '' },
      asyncStorageCopy: { ...merged, passcodeEnabled: false, passcodePin: '', passcodeHash: '' },
    };
  }

  const candidate = isPlaintextPin(merged.passcodePin)
    ? merged.passcodePin!
    : merged.passcodeHash || merged.passcodePin || '';

  if (candidate && (isPlaintextPin(candidate) || isHashedPasscode(candidate))) {
    const res = await persistPasscodeCredential(candidate, driver);
    return {
      hydrated: { ...merged, passcodePin: '', passcodeHash: res.hydratedHash },
      asyncStorageCopy: { ...merged, passcodePin: '', passcodeHash: res.asyncStorageHash },
    };
  }

  return {
    hydrated: { ...merged, passcodePin: '', passcodeHash: '' },
    asyncStorageCopy: { ...merged, passcodePin: '', passcodeHash: '' },
  };
}

export function computeLockoutMs(failedAttempts: number): number {
  if (failedAttempts < PASSCODE_MAX_ATTEMPTS) return 0;
  if (failedAttempts === PASSCODE_MAX_ATTEMPTS) return 30_000;
  if (failedAttempts === PASSCODE_MAX_ATTEMPTS + 1) return 60_000;
  return 120_000;
}

export function shouldRelockOnResume(
  backgroundedAtMs: number | null,
  nowMs: number,
  timeoutSec: number
): boolean {
  if (timeoutSec < 0) return false;
  if (!backgroundedAtMs) return false;
  if (timeoutSec === 0) return true;
  return nowMs - backgroundedAtMs >= timeoutSec * 1000;
}
