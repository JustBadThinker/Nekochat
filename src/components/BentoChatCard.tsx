/**
 * Bento Grid Chat Card with Progressive Scrim
 * Ref: Gambar 2 & Gambar 4/5 — 2-column grid cards for My Chat history.
 */

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { MessageSquare, Heart } from 'lucide-react-native';
import { Character } from '../types';
import { colors } from '../theme/colors';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

interface BentoChatCardProps {
  character: Character;
  onPress: () => void;
  onToggleFavorite?: () => void;
}

export const BentoChatCard: React.FC<BentoChatCardProps> = ({
  character,
  onPress,
  onToggleFavorite,
}) => {
  const formatTimeAgo = (timestamp?: number) => {
    if (!timestamp) return 'New';
    const diffMin = Math.round((Date.now() - timestamp) / 60000);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.round(diffHours / 24)}d ago`;
  };

  return (
    <TouchableOpacity
      style={styles.cardContainer}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Cover Image */}
      <Image source={{ uri: character.avatar }} style={styles.cardImage} />

      {/* Top Floating Badge Row */}
      <View style={styles.topRow}>
        <View style={styles.chatBadge}>
          <MessageSquare size={11} color={colors.lime} style={{ marginRight: 4 }} />
          <Text style={styles.chatBadgeText}>{character.totalChats || 0}</Text>
        </View>

        {onToggleFavorite && (
          <TouchableOpacity
            style={styles.favButton}
            onPress={onToggleFavorite}
            activeOpacity={0.7}
          >
            <Heart
              size={14}
              color={character.isFavorite ? colors.coral : 'rgba(255,255,255,0.7)'}
              fill={character.isFavorite ? colors.coral : 'transparent'}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Progressive Scrim / Bottom Metadata Container */}
      <View style={styles.scrimContainer}>
        <Text style={styles.charName} numberOfLines={1}>
          {character.name}
        </Text>
        <Text style={styles.charTagline} numberOfLines={1}>
          {character.tagline}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.tagBadge} numberOfLines={1}>
            {character.tags[0] || 'Roleplay'}
          </Text>
          <Text style={styles.timeText}>
            {formatTimeAgo(character.lastActive)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.35,
    borderRadius: 20,
    backgroundColor: colors.bgSurface,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    zIndex: 2,
  },
  chatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  chatBadgeText: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
  favButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  scrimContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(7, 9, 13, 0.88)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  charName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  charTagline: {
    color: colors.textSecondary,
    fontSize: 11,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagBadge: {
    color: colors.lime,
    fontSize: 10,
    fontWeight: '600',
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  timeText: {
    color: colors.textMuted,
    fontSize: 10,
  },
});

