/**
 * NekoChat Theme Store Service
 * Fetches, validates, caches, installs, and manages optional JSON Theme Packs
 * from the official NekoChat GitHub repository (`themes/index.json`).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemePalette } from '../theme/colors';
import {
  NekoThemePack,
  ThemePackManifestItem,
  validateThemeCatalog,
  validateThemePack,
} from '../theme/themePackSchema';

import starterCatalogRaw from '../../themes/index.json';
import catppuccinRaw from '../../themes/packs/catppuccin-mocha.json';
import tokyoNightRaw from '../../themes/packs/tokyo-night-neon.json';
import nordFrostRaw from '../../themes/packs/nord-frost.json';
import rosePineRaw from '../../themes/packs/rose-pine-velvet.json';
import crtPhosphorRaw from '../../themes/packs/crt-phosphor.json';
import draculaObsidianRaw from '../../themes/packs/dracula-obsidian.json';
import aegisScifiRaw from '../../themes/packs/aegis-scifi-hud.json';

export const THEME_CATALOG_URL =
  'https://raw.githubusercontent.com/JustBadThinker/Nekochat/main/themes/index.json';

const INSTALLED_PACKS_KEY = '@nekochat_installed_theme_packs_v1';
const CATALOG_CACHE_KEY = '@nekochat_theme_catalog_cache_v1';

const STARTER_CATALOG: ThemePackManifestItem[] = validateThemeCatalog(starterCatalogRaw);

const STARTER_PACK_MAP: Record<string, NekoThemePack> = (() => {
  const map: Record<string, NekoThemePack> = {};
  for (const raw of [
    catppuccinRaw,
    tokyoNightRaw,
    nordFrostRaw,
    rosePineRaw,
    crtPhosphorRaw,
    draculaObsidianRaw,
    aegisScifiRaw,
  ]) {
    const validated = validateThemePack(raw);
    if (validated) map[validated.id] = validated;
  }
  return map;
})();

const installedPacksCache = new Map<string, NekoThemePack>();
let cachedCatalog: ThemePackManifestItem[] = STARTER_CATALOG;
let hasHydrated = false;

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function hydrateInstalledThemePacks(): Promise<NekoThemePack[]> {
  if (hasHydrated) {
    return Array.from(installedPacksCache.values());
  }
  try {
    const [rawInstalled, rawCatalog] = await Promise.all([
      AsyncStorage.getItem(INSTALLED_PACKS_KEY),
      AsyncStorage.getItem(CATALOG_CACHE_KEY),
    ]);

    if (rawInstalled) {
      const parsed = JSON.parse(rawInstalled);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const valid = validateThemePack(item);
          if (valid) {
            installedPacksCache.set(valid.id, valid);
          }
        }
      }
    }

    if (rawCatalog) {
      const parsedCatalog = validateThemeCatalog(JSON.parse(rawCatalog));
      if (parsedCatalog.length > 0) {
        cachedCatalog = parsedCatalog;
      }
    }
  } catch {
    // Keep starter defaults on storage error
  }
  hasHydrated = true;
  return Array.from(installedPacksCache.values());
}

export function getInstalledThemePacksSync(): NekoThemePack[] {
  return Array.from(installedPacksCache.values());
}

export function getInstalledThemePackByIdSync(id?: string | null): NekoThemePack | null {
  if (!id) return null;
  return installedPacksCache.get(id) || null;
}

export function getAllInstalledPalettesSync(): ThemePalette[] {
  const result: ThemePalette[] = [];
  const seen = new Set<string>();
  for (const pack of installedPacksCache.values()) {
    for (const p of pack.palettes) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      result.push({
        id: p.id,
        name: p.name,
        desc: p.desc || pack.description || `Color scheme from ${pack.name}`,
        packId: pack.id,
        packName: pack.name,
        accent: p.accent,
        accentMuted: p.accentMuted,
        accentRgb: p.accentRgb,
        bgDark: p.bgDark,
        bgSurface: p.bgSurface,
        bgSurfaceSubtle: p.bgSurfaceSubtle,
        webFrameBg: p.webFrameBg || p.bgDark,
        dockBg: p.dockBg,
        ...(p.userBubbleBg ? { userBubbleBg: p.userBubbleBg } : {}),
        ...(p.aiBubbleBg ? { aiBubbleBg: p.aiBubbleBg } : {}),
      });
    }
  }
  return result;
}

export function findInstalledPaletteByIdSync(paletteId?: string | null): ThemePalette | null {
  if (!paletteId) return null;
  return getAllInstalledPalettesSync().find(p => p.id === paletteId) || null;
}

export function getPreviewPackSync(id: string): NekoThemePack | null {
  return installedPacksCache.get(id) || STARTER_PACK_MAP[id] || null;
}

export function getCatalogSync(): ThemePackManifestItem[] {
  return cachedCatalog.length > 0 ? cachedCatalog : STARTER_CATALOG;
}

export async function refreshThemeCatalog(): Promise<{
  items: ThemePackManifestItem[];
  fromNetwork: boolean;
  error?: string;
}> {
  try {
    const json = await fetchJsonWithTimeout(THEME_CATALOG_URL, 6500);
    const items = validateThemeCatalog(json);
    if (items.length === 0) {
      return {
        items: getCatalogSync(),
        fromNetwork: false,
        error: 'Remote catalog returned no valid themes.',
      };
    }
    cachedCatalog = items;
    await AsyncStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(items)).catch(() => {});
    return { items, fromNetwork: true };
  } catch (err: any) {
    return {
      items: getCatalogSync(),
      fromNetwork: false,
      error: err?.message || 'Unable to reach GitHub catalog',
    };
  }
}

async function persistInstalledPacks(): Promise<void> {
  const list = Array.from(installedPacksCache.values());
  await AsyncStorage.setItem(INSTALLED_PACKS_KEY, JSON.stringify(list));
}

export async function installThemePack(item: ThemePackManifestItem): Promise<NekoThemePack> {
  let validated: NekoThemePack | null = null;
  let lastError: string | null = null;

  try {
    const remoteJson = await fetchJsonWithTimeout(item.packUrl, 8000);
    validated = validateThemePack(remoteJson);
    if (!validated) {
      lastError = 'Downloaded theme failed template validation.';
    }
  } catch (err: any) {
    lastError = err?.message || 'Network download failed.';
  }

  if (!validated && STARTER_PACK_MAP[item.id]) {
    validated = STARTER_PACK_MAP[item.id];
  }

  if (!validated) {
    throw new Error(lastError || 'Could not install theme pack.');
  }

  installedPacksCache.set(validated.id, validated);
  hasHydrated = true;
  await persistInstalledPacks();
  return validated;
}

export async function uninstallThemePack(packId: string): Promise<void> {
  installedPacksCache.delete(packId);
  await persistInstalledPacks();
}
