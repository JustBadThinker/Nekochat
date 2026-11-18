/**
 * Bento Grid Chat Card with Progressive Scrim
 * Clean 2-column cards for My Chats with pure monochrome white iconography.
 */

import React, { useRef, useEffect , useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MessageSquare, Heart } from 'lucide-react-native';
import { Character } from '../types';
import { GLASS } from '../theme/glassTheme';
import { useTheme } from '../theme/ThemeContext';
import { getCardSurfaceStyle } from '../theme/skins';
import {
  runEnterAnimation,
  runPressInAnimation,
  runPressOutAnimation,
} from '../theme/animations';
import { ThemePalette } from '../theme/colors';

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
  const { palette, skin } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const enterAnim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    runEnterAnimation(enterAnim, skin.animation);
  }, []);

  const handlePressIn = () => {
    runPressInAnimation(pressScale, skin.animation);
  };

  const handlePressOut = () => {
    runPressOutAnimation(pressScale, skin.animation);
  };

  const handleFavPress = () => {
    heartScale.setValue(0.75);
    Animated.spring(heartScale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 4,
      tension: 180,
    }).start();
    onToggleFavorite?.();
  };

  const formatTimeAgo = (timestamp?: number) => {
    if (!timestamp) return 'New';
    const diffMin = Math.round((Date.now() - timestamp) / 60000);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.round(diffHours / 24)}d ago`;
  };

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        {
          opacity: enterAnim,
          transform: [
            { scale: Animated.multiply(pressScale, enterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] })) },
            { translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        },
      ]}
    >
    <TouchableOpacity
      style={[styles.cardContainer, getCardSurfaceStyle(palette, skin)]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.92}
    >
      {/* Cover Image */}
      <Image source={{ uri: character.avatar }} style={styles.cardImage} />

      {/* Progressive Top Scrim behind badges */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(12, 14, 20, 0.58)', 'rgba(12, 14, 20, 0.22)', 'transparent']}
        locations={[0, 0.55, 1]}
        style={styles.topScrim}
      />

      {/* Top Floating Badge Row */}
      <View style={styles.topRow}>
        <View style={styles.chatBadge}>
          <MessageSquare size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.chatBadgeText}>{character.totalChats || 0}</Text>
        </View>

        {onToggleFavorite && (
          <TouchableOpacity
            style={styles.favButton}
            onPress={handleFavPress}
            activeOpacity={0.7}
          >
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Heart
                size={13}
                color={character.isFavorite ? '#FF6B6B' : 'rgba(255,255,255,0.7)'}
                fill={character.isFavorite ? '#FF6B6B' : 'transparent'}
              />
            </Animated.View>
          </TouchableOpacity>
        )}
      </View>

      {/* Progressive Gradient Scrim Behind Text (Character remains sharp and clear above) */}
      <LinearGradient
        colors={['transparent', 'rgba(12, 14, 20, 0.4)', 'rgba(12, 14, 20, 0.85)', palette.bgDark]}
        locations={[0, 0.28, 0.68, 1]}
        style={styles.scrimContainer}
      >
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
      </LinearGradient>
    </TouchableOpacity>
    </Animated.View>
  );
};

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  cardWrapper: {
    flex: 1,
    maxWidth: '48.5%',
    marginBottom: 14,
  },
  cardContainer: {
    width: '100%',
    aspectRatio: 0.68, // Crisp portrait ratio with full-bleed character artwork
    borderRadius: 18,
    backgroundColor: GLASS.bg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GLASS.borderBright,
    position: 'relative',
    ...GLASS.shadow,
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
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 48,
    zIndex: 5,
  },
  chatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 17, 28, 0.56)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GLASS.borderBright,
    ...GLASS.backdrop,
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
    backgroundColor: 'rgba(14, 17, 28, 0.56)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: GLASS.borderBright,
    ...GLASS.backdrop,
  },
  scrimContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 42,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'linear-gradient(to bottom, rgba(12, 14, 20, 0) 0%, rgba(12, 14, 20, 0.4) 28%, rgba(12, 14, 20, 0.85) 68%, #0c0e14 100%)',
        } as any)
      : {}),
  },
  charName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  charTagline: {
    color: palette.accent,
    fontSize: 10.5,
    fontWeight: '600',
    marginBottom: 6,
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
