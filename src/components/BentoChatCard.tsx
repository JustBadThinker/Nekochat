/**
 * Bento Grid Chat Card with Progressive Scrim
 * Clean 2-column cards for My Chats with pure monochrome white iconography.
 */

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { MessageSquare, Heart } from 'lucide-react-native';
import { Character } from '../types';

const { width: windowWidth } = Dimensions.get('window');
const effectiveWidth = Math.min(windowWidth, 480);
const CARD_WIDTH = (effectiveWidth - 48) / 2;

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
          <MessageSquare size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.chatBadgeText}>{character.totalChats || 0}</Text>
        </View>

        {onToggleFavorite && (
          <TouchableOpacity
            style={styles.favButton}
            onPress={onToggleFavorite}
            activeOpacity={0.7}
          >
            <Heart
              size={13}
              color={character.isFavorite ? '#FF6B6B' : 'rgba(255,255,255,0.7)'}
              fill={character.isFavorite ? '#FF6B6B' : 'transparent'}
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
            #{character.tags[0] || 'Anime'}
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
    borderRadius: 18,
    backgroundColor: '#12151e',
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1b1e28',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  topRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  chatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  chatBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  favButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  scrimContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(12, 14, 20, 0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  charName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  charTagline: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagBadge: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 10,
    fontWeight: '600',
  },
  timeText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10,
  },
});
