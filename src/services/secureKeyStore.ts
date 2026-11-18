/**
 * Secure Credential Storage & Migration Helper (Phase 3)
 *
 * - Stores provider `apiKey` and `imageApiKey` in `expo-secure-store`
 *   (Android Keystore / iOS Keychain) on native platforms.
 * - Verifies every migrated key can be read back before stripping its
 *   plaintext copy from AsyncStorage.
 * - Uses a driver-agnostic `SecureStoreDriver` interface so the exact same
 *   migration and hydration logic can be unit-tested in Node.
 */

import type { ProviderConfig } from '../types';

export interface SecureStoreDriver {
  isAvailable(): Promise<boolean>;
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

function sanitizeKeySegment(raw: string): string {
  const cleaned = String(raw || 'default').replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned || 'default';
}

export function getApiKeyStoreName(providerId: string): string {
  return `nekochat_api_key_${sanitizeKeySegment(providerId)}`;
}

export function getImageKeyStoreName(providerId: string): string {
  return `nekochat_img_key_${sanitizeKeySegment(providerId)}`;
}

/**
 * Strips secrets from ProviderConfig copies meant for AsyncStorage, after
 * writing and verifying them in SecureStore. If SecureStore verification
 * fails, keeps the plaintext field intact to prevent accidental key loss.
 */
export async function stripAndPersistProviderSecrets(
  providers: ProviderConfig[],
  driver: SecureStoreDriver,
  activeKeyId = 'active_provider'
): Promise<{ sanitized: ProviderConfig[]; migratedCount: number; allVerified: boolean }> {
  const available = await driver.isAvailable().catch(() => false);
  if (!available) {
    return { sanitized: providers, migratedCount: 0, allVerified: false };
  }

  let migratedCount = 0;
  let allVerified = true;
  const sanitized: ProviderConfig[] = [];

  for (const p of providers) {
    const pid = p.id || activeKeyId;
    const copy: ProviderConfig = { ...p };

    if (copy.apiKey && copy.apiKey.trim()) {
      const keyName = getApiKeyStoreName(pid);
      try {
        await driver.setItemAsync(keyName, copy.apiKey);
        const readBack = await driver.getItemAsync(keyName);
        if (readBack === copy.apiKey) {
          copy.apiKey = '';
          migratedCount++;
        } else {
          allVerified = false;
        }
      } catch {
        allVerified = false;
      }
    }

    if (copy.imageApiKey && copy.imageApiKey.trim()) {
      const imgKeyName = getImageKeyStoreName(pid);
      try {
        await driver.setItemAsync(imgKeyName, copy.imageApiKey);
        const readBack = await driver.getItemAsync(imgKeyName);
        if (readBack === copy.imageApiKey) {
          copy.imageApiKey = '';
          migratedCount++;
        } else {
          allVerified = false;
        }
      } catch {
        allVerified = false;
      }
    }

    sanitized.push(copy);
  }

  return { sanitized, migratedCount, allVerified };
}

/**
 * Hydrates `apiKey` and `imageApiKey` from SecureStore into ProviderConfig objects.
 */
export async function hydrateProviderSecrets(
  providers: ProviderConfig[],
  driver: SecureStoreDriver,
  activeKeyId = 'active_provider'
): Promise<ProviderConfig[]> {
  const available = await driver.isAvailable().catch(() => false);
  if (!available) return providers;

  const hydrated: ProviderConfig[] = [];
  for (const p of providers) {
    const pid = p.id || activeKeyId;
    const copy: ProviderConfig = { ...p };

    try {
      if (!copy.apiKey) {
        const stored = await driver.getItemAsync(getApiKeyStoreName(pid));
        if (stored) copy.apiKey = stored;
      }
      if (!copy.imageApiKey) {
        const storedImg = await driver.getItemAsync(getImageKeyStoreName(pid));
        if (storedImg) copy.imageApiKey = storedImg;
      }
    } catch {
      // Keep non-secret config intact if SecureStore read fails
    }

    hydrated.push(copy);
  }
  return hydrated;
}

export async function removeProviderSecrets(
  providerId: string,
  driver: SecureStoreDriver
): Promise<void> {
  const available = await driver.isAvailable().catch(() => false);
  if (!available) return;
  await driver.deleteItemAsync(getApiKeyStoreName(providerId)).catch(() => {});
  await driver.deleteItemAsync(getImageKeyStoreName(providerId)).catch(() => {});
}

let cachedNativeDriver: SecureStoreDriver | null = null;

export async function getDefaultSecureStoreDriver(): Promise<SecureStoreDriver> {
  if (cachedNativeDriver) return cachedNativeDriver;

  try {
    const { Platform } = await import('react-native');
    if (Platform.OS === 'web') {
      cachedNativeDriver = {
        isAvailable: async () => false,
        getItemAsync: async () => null,
        setItemAsync: async () => {},
        deleteItemAsync: async () => {},
      };
      return cachedNativeDriver;
    }

    const SecureStore = await import('expo-secure-store');
    cachedNativeDriver = {
      isAvailable: () => SecureStore.isAvailableAsync(),
      getItemAsync: key => SecureStore.getItemAsync(key),
      setItemAsync: (key, value) => SecureStore.setItemAsync(key, value),
      deleteItemAsync: key => SecureStore.deleteItemAsync(key),
    };
    return cachedNativeDriver;
  } catch {
    return {
      isAvailable: async () => false,
      getItemAsync: async () => null,
      setItemAsync: async () => {},
      deleteItemAsync: async () => {},
    };
  }
}
