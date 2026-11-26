import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AndroidImportance,
  SchedulableTriggerInputTypes,
  cancelAllScheduledNotificationsAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
} from 'expo-notifications';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import type { AppSettings, Character, CreatorDropNotificationItem } from '../types';
import { getThemePalette } from '../theme/colors';
import { storageService } from './storageService';
import { communityCatalogService } from './communityCatalogService';
import {
  adjustForQuietHours,
  diffNewCreatorDrops,
  formatAlgorithmPickNotification,
  formatCreatorDropNotification,
  formatMissYouNotification,
  isCharacterNsfw,
  pickEligibleCharacter,
} from './notificationLogic';

export const NEKOCHAT_CREATOR_DROP_TASK = 'nekochat-followed-creator-drops';

const ANDROID_CHANNEL_ID = 'nekochat-companions';
const KEY_DROPS_INBOX = '@nekochat:creator_drops_inbox_v1';
const KEY_DROPS_SEEN = '@nekochat:creator_drops_seen_v1';
const KEY_LAST_CHECK = '@nekochat:creator_drops_last_check_v1';
const MAX_INBOX_ITEMS = 30;
const FOREGROUND_CHECK_COOLDOWN_MS = 15 * 60 * 1000;

if (Platform.OS !== 'web') {
  try {
    setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // No-op in headless/unsupported runtimes
  }
}

async function readSeenMap(): Promise<Record<string, string[]>> {
  try {
    const raw = await AsyncStorage.getItem(KEY_DROPS_SEEN);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function ensureAndroidChannel(accentColor?: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  await setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Companions & Creator Drops',
    importance: AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180, 100, 180],
    lightColor: accentColor || getThemePalette().accent,
  });
}

export async function getDropsInbox(): Promise<CreatorDropNotificationItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_DROPS_INBOX);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function markAllDropsRead(): Promise<CreatorDropNotificationItem[]> {
  const inbox = await getDropsInbox();
  const updated = inbox.map(item => (item.read ? item : { ...item, read: true }));
  await AsyncStorage.setItem(KEY_DROPS_INBOX, JSON.stringify(updated));
  return updated;
}

export async function markDropRead(dropId: string): Promise<CreatorDropNotificationItem[]> {
  const inbox = await getDropsInbox();
  const updated = inbox.map(item => (item.id === dropId ? { ...item, read: true } : item));
  await AsyncStorage.setItem(KEY_DROPS_INBOX, JSON.stringify(updated));
  return updated;
}

export async function clearDropsInbox(): Promise<void> {
  await AsyncStorage.setItem(KEY_DROPS_INBOX, JSON.stringify([]));
}

export async function requestNotificationPermissionsAsync(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    await ensureAndroidChannel();
    const current = await getPermissionsAsync();
    if (current.status === 'granted') return 'granted';
    const next = await requestPermissionsAsync();
    return next.status === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

export async function hasNotificationPermissionAsync(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const current = await getPermissionsAsync();
    return current.status === 'granted';
  } catch {
    return false;
  }
}

export async function cancelScheduledReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await cancelAllScheduledNotificationsAsync();
  } catch {
    // Ignore when unavailable (e.g. unsupported runtime)
  }
}

export async function syncNotificationSchedule(
  settings: AppSettings,
  characters: Character[],
  candidates: Character[]
): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Available) {
      if (settings.notifyFollowedCreators) {
        await BackgroundTask.registerTaskAsync(NEKOCHAT_CREATOR_DROP_TASK, {
          minimumInterval: 180, // 3 hours (minutes unit per Expo BackgroundTask spec)
        }).catch(() => {});
      } else {
        await BackgroundTask.unregisterTaskAsync(NEKOCHAT_CREATOR_DROP_TASK).catch(() => {});
      }
    }
  } catch {
    // Background task unavailable in current environment (e.g. Expo Go)
  }

  await cancelScheduledReminders();

  const anyScheduled = Boolean(settings.notifyMissYou || settings.notifyAlgorithmPicks);
  if (!anyScheduled) return;

  const permitted = await hasNotificationPermissionAsync();
  if (!permitted) return;

  await ensureAndroidChannel(getThemePalette(settings.theme).accent);

  const discreet = settings.notifyDiscreetMode !== false;
  const quietHours = settings.notifyQuietHours !== false;
  const now = Date.now();

  if (settings.notifyMissYou) {
    const recentFirst = [...characters].sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
    const favFirst = recentFirst.filter(c => c.isFavorite).concat(recentFirst.filter(c => !c.isFavorite));
    const chosen = pickEligibleCharacter(favFirst, discreet);
    if (chosen) {
      const copy = formatMissYouNotification(chosen.chatName || chosen.name, discreet);
      const triggerMs = adjustForQuietHours(now + 48 * 60 * 60 * 1000, quietHours);
      await scheduleNotificationAsync({
        content: {
          title: copy.title,
          body: copy.body,
          data: { kind: 'miss_you', characterId: chosen.id },
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: new Date(triggerMs),
          ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
        },
      }).catch(() => {});
    }
  }

  if (settings.notifyAlgorithmPicks) {
    const chosenIds = new Set(characters.map(c => c.id));
    const freshPool = candidates.filter(c => !chosenIds.has(c.id));
    const pick = pickEligibleCharacter(freshPool.length > 0 ? freshPool : candidates, discreet);
    if (pick) {
      const copy = formatAlgorithmPickNotification(pick.chatName || pick.name, discreet);
      const triggerMs = adjustForQuietHours(now + 24 * 60 * 60 * 1000, quietHours);
      await scheduleNotificationAsync({
        content: {
          title: copy.title,
          body: copy.body,
          data: { kind: 'algorithm_pick', characterId: pick.id },
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: new Date(triggerMs),
          ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
        },
      }).catch(() => {});
    }
  }
}

export async function checkFollowedCreatorDropsNow(
  settings: AppSettings,
  emitSystemNotification = false,
  respectCooldown = false
): Promise<{
  newDrops: CreatorDropNotificationItem[];
  inbox: CreatorDropNotificationItem[];
  totalUnread: number;
  skippedByCooldown?: boolean;
}> {
  const existingInbox = await getDropsInbox();
  if (respectCooldown) {
    try {
      const lastRaw = await AsyncStorage.getItem(KEY_LAST_CHECK);
      const lastMs = lastRaw ? Number(lastRaw) : 0;
      if (Number.isFinite(lastMs) && Date.now() - lastMs < FOREGROUND_CHECK_COOLDOWN_MS) {
        return {
          newDrops: [],
          inbox: existingInbox,
          totalUnread: existingInbox.filter(d => !d.read).length,
          skippedByCooldown: true,
        };
      }
    } catch {
      // Ignore storage read error
    }
  }

  const followed = await storageService.getFollowedCreators();
  if (followed.length === 0) {
    return {
      newDrops: [],
      inbox: existingInbox,
      totalUnread: existingInbox.filter(d => !d.read).length,
    };
  }

  await AsyncStorage.setItem(KEY_LAST_CHECK, String(Date.now())).catch(() => {});

  let seenMap = await readSeenMap();
  const collectedDrops: CreatorDropNotificationItem[] = [];
  const slice = followed.slice(0, 8);

  for (const handle of slice) {
    try {
      const res = await communityCatalogService.fetchCreatorCharacters(handle, {
        source: 'janitor',
        limit: 6,
        sort: 'latest',
      });
      const diff = diffNewCreatorDrops(
        handle,
        res.characters.map(c => ({
          id: c.id || c.characterId,
          name: c.name,
          avatarUrl: c.avatarUrl,
          shortDescription: c.shortDescription,
          isNsfw: c.isNsfw,
          source: c.source,
          fullPath: c.fullPath,
        })),
        seenMap
      );
      seenMap = diff.nextSeenMap;
      if (diff.drops.length > 0) {
        collectedDrops.push(...diff.drops);
      }
    } catch {
      // Skip offline/transient creator failures cleanly
    }
  }

  await AsyncStorage.setItem(KEY_DROPS_SEEN, JSON.stringify(seenMap)).catch(() => {});

  const existingIds = new Set(existingInbox.map(d => d.id));
  const uniqueNewDrops = collectedDrops.filter(d => !existingIds.has(d.id));
  const mergedInbox = [...uniqueNewDrops, ...existingInbox].slice(0, MAX_INBOX_ITEMS);
  if (uniqueNewDrops.length > 0) {
    await AsyncStorage.setItem(KEY_DROPS_INBOX, JSON.stringify(mergedInbox)).catch(() => {});
  }

  if (
    emitSystemNotification &&
    Platform.OS !== 'web' &&
    settings.notifyFollowedCreators &&
    uniqueNewDrops.length > 0
  ) {
    const permitted = await hasNotificationPermissionAsync();
    if (permitted) {
      const discreet = settings.notifyDiscreetMode !== false;
      const eligibleDrop = discreet
        ? uniqueNewDrops.find(d => !isCharacterNsfw({ isNsfw: d.isNsfw }))
        : uniqueNewDrops[0];
      if (eligibleDrop) {
        await ensureAndroidChannel(getThemePalette(settings.theme).accent);
        const copy = formatCreatorDropNotification(
          eligibleDrop.creatorHandle,
          eligibleDrop.characterName,
          discreet
        );
        await scheduleNotificationAsync({
          content: {
            title: copy.title,
            body: copy.body,
            data: {
              kind: 'creator_drop',
              characterId: eligibleDrop.characterId,
              creatorHandle: eligibleDrop.creatorHandle,
              source: eligibleDrop.source,
              fullPath: eligibleDrop.fullPath,
            },
          },
          trigger: {
            type: SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 1,
            ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
          },
        }).catch(() => {});
      }
    }
  }

  return {
    newDrops: uniqueNewDrops,
    inbox: mergedInbox,
    totalUnread: mergedInbox.filter(d => !d.read).length,
  };
}

export async function sendTestNotificationNow(settings: AppSettings): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const status = await requestNotificationPermissionsAsync();
  if (status !== 'granted') return false;

  const discreet = settings.notifyDiscreetMode !== false;
  const copy = formatMissYouNotification('Neko Companion', discreet);

  await scheduleNotificationAsync({
    content: {
      title: copy.title,
      body: copy.body,
      data: { kind: 'test' },
    },
    trigger: {
      type: SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
  });
  return true;
}

// Register global BackgroundTask executor on native platforms at module scope.
if (Platform.OS !== 'web') {
  try {
    if (!TaskManager.isTaskDefined(NEKOCHAT_CREATOR_DROP_TASK)) {
      TaskManager.defineTask(NEKOCHAT_CREATOR_DROP_TASK, async () => {
        try {
          const settings = await storageService.getSettings();
          if (!settings.notifyFollowedCreators) {
            return BackgroundTask.BackgroundTaskResult.Success;
          }
          await checkFollowedCreatorDropsNow(settings, true, false);
          return BackgroundTask.BackgroundTaskResult.Success;
        } catch {
          return BackgroundTask.BackgroundTaskResult.Failed;
        }
      });
    }
  } catch {
    // TaskManager unavailable in unsupported runtime
  }
}
