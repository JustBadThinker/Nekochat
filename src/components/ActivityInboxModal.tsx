import React from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Bell, CheckCheck, RefreshCw, Settings, Sparkles, X } from 'lucide-react-native';
import type { CreatorDropNotificationItem } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { getSubtleSurfaceBg, getSurfaceBg } from '../theme/skins';
import { BottomSheetModal, BottomSheetScrollView } from './BottomSheetModal';

interface ActivityInboxModalProps {
  visible: boolean;
  onClose: () => void;
  drops: CreatorDropNotificationItem[];
  checking: boolean;
  followedCount: number;
  onCheckNow: () => void;
  onMarkAllRead: () => void;
  onOpenDrop: (drop: CreatorDropNotificationItem) => void;
  onOpenNotificationSettings: () => void;
}

function formatRelative(ts: number): string {
  const diffMin = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

export const ActivityInboxModal: React.FC<ActivityInboxModalProps> = ({
  visible,
  onClose,
  drops,
  checking,
  followedCount,
  onCheckNow,
  onMarkAllRead,
  onOpenDrop,
  onOpenNotificationSettings,
}) => {
  const { palette, skin } = useTheme();
  const surfaceBg = getSurfaceBg(palette, skin);
  const subtleBg = getSubtleSurfaceBg(palette, skin);
  const unreadCount = drops.filter(d => !d.read).length;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetStyle={{ paddingHorizontal: 0, paddingBottom: 0, height: '78%', maxHeight: '82%' }}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: 'rgba(255, 255, 255, 0.08)' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: Math.min(12, skin.buttonRadius),
              backgroundColor: `rgba(${palette.accentRgb}, 0.14)`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bell size={17} color={palette.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Activity & Drops</Text>
            <Text style={styles.subtitle}>
              {followedCount === 0
                ? 'Follow creators in Discover to get card alerts'
                : `${followedCount} followed ${followedCount === 1 ? 'creator' : 'creators'}${unreadCount > 0 ? ` · ${unreadCount} new` : ''}`}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            onPress={onOpenNotificationSettings}
            style={[styles.iconBtn, { backgroundColor: subtleBg, borderRadius: skin.buttonRadius }]}
            activeOpacity={0.75}
            accessibilityLabel="Notification settings"
          >
            <Settings size={15} color="#cbd5e1" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.iconBtn, { backgroundColor: subtleBg, borderRadius: skin.buttonRadius }]}
            activeOpacity={0.75}
            accessibilityLabel="Close activity inbox"
          >
            <X size={16} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          onPress={onCheckNow}
          disabled={checking}
          activeOpacity={0.8}
          style={[
            styles.toolbarBtn,
            {
              backgroundColor: `rgba(${palette.accentRgb}, 0.14)`,
              borderColor: `rgba(${palette.accentRgb}, 0.35)`,
              borderRadius: skin.buttonRadius,
              opacity: checking ? 0.65 : 1,
            },
          ]}
        >
          {checking ? (
            <ActivityIndicator size="small" color={palette.accent} />
          ) : (
            <RefreshCw size={13} color={palette.accent} />
          )}
          <Text style={[styles.toolbarBtnText, { color: palette.accent }]}>
            {checking ? 'Checking...' : 'Check Now'}
          </Text>
        </TouchableOpacity>

        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={onMarkAllRead}
            activeOpacity={0.8}
            style={[
              styles.toolbarBtn,
              {
                backgroundColor: subtleBg,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: skin.buttonRadius,
              },
            ]}
          >
            <CheckCheck size={13} color="#cbd5e1" />
            <Text style={[styles.toolbarBtnText, { color: '#cbd5e1' }]}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Body */}
      <BottomSheetScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        {drops.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: subtleBg,
                borderRadius: skin.cardRadius,
                borderColor: 'rgba(255, 255, 255, 0.08)',
              },
            ]}
          >
            <Sparkles size={24} color={palette.accent} />
            <Text style={styles.emptyTitle}>
              {followedCount === 0 ? 'No followed creators yet' : 'No new drops yet'}
            </Text>
            <Text style={styles.emptyBody}>
              {followedCount === 0
                ? 'Tap "+ Follow" on any character card in Discover. Newly published cards from those creators will appear here.'
                : 'You’re all caught up! When a creator you follow publishes a new character card, it will show up here.'}
            </Text>
          </View>
        ) : (
          drops.map(drop => (
            <TouchableOpacity
              key={drop.id}
              activeOpacity={0.82}
              onPress={() => onOpenDrop(drop)}
              style={[
                styles.dropCard,
                {
                  backgroundColor: drop.read ? subtleBg : surfaceBg,
                  borderRadius: skin.cardRadius,
                  borderColor: drop.read
                    ? 'rgba(255, 255, 255, 0.08)'
                    : `rgba(${palette.accentRgb}, 0.4)`,
                },
              ]}
            >
              {drop.avatarUrl ? (
                <Image source={{ uri: drop.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: subtleBg }]}>
                  <Text style={{ color: palette.accent, fontWeight: '800', fontSize: 16 }}>
                    {(drop.characterName || 'N').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {!drop.read && (
                    <View style={[styles.unreadDot, { backgroundColor: palette.accent }]} />
                  )}
                  <Text style={styles.dropTitle} numberOfLines={1}>
                    {drop.characterName}
                  </Text>
                  <Text style={styles.timeText}>{formatRelative(drop.discoveredAt)}</Text>
                </View>
                <Text style={[styles.creatorText, { color: palette.accent }]} numberOfLines={1}>
                  New card by @{drop.creatorHandle}
                </Text>
                {drop.tagline ? (
                  <Text style={styles.taglineText} numberOfLines={2}>
                    {drop.tagline}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: { color: '#f8fafc', fontSize: 16, fontWeight: '800' },
  subtitle: { color: '#94a3b8', fontSize: 11.5, marginTop: 2 },
  iconBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  toolbarBtnText: { fontSize: 12, fontWeight: '700' },
  emptyCard: {
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  emptyTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '700', marginTop: 4 },
  emptyBody: {
    color: '#94a3b8',
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
  },
  dropCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#1e1e24',
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dropTitle: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  timeText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  creatorText: {
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 2,
  },
  taglineText: {
    color: '#94a3b8',
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 3,
  },
});
