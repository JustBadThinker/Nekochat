/**
 * CommunityCharacterCard.tsx
 * 2-column Bento character card for the Discover catalog (cover art, SFW/NSFW badge,
 * creator follow pill, tags, favorite & quick-chat actions).
 * Zero hardcoded mock data — if the card looks cute, it's 100% real catalog aura (+1000 aura).
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MessageSquare,
  Heart,
  Bookmark,
  Play,
  CheckCircle2,
  Coins,
} from 'lucide-react-native';
import { CommunityCharacter } from '../types';
import { matchAlgorithmService } from '../services/matchAlgorithmService';
import { GLASS } from '../theme/glassTheme';
import { useTheme } from '../theme/ThemeContext';
import { getCardSurfaceStyle } from '../theme/skins';
import {
  runPressInAnimation,
  runPressOutAnimation,
} from '../theme/animations';
import { ThemePalette } from '../theme/colors';

interface CommunityCharacterCardProps {
  character: CommunityCharacter;
  onSelect: (character: CommunityCharacter) => void;
  onStartChat: (character: CommunityCharacter) => void;
  onImport?: (character: CommunityCharacter) => void;
  isBookmarked: boolean;
  onToggleBookmark: (characterId: string) => void;
  isLiked?: boolean;
  onToggleLike?: (character: CommunityCharacter, nextLiked: boolean) => void;
  isFollowingCreator?: boolean;
  onToggleFollowCreator?: (creatorName: string, avatarUrl?: string) => void;
  onCreatorClick?: (creatorName: string) => void;
  onTagClick?: (tagId: string, tagName: string) => void;
  isExiting?: boolean;
}

export const CommunityCharacterCard: React.FC<CommunityCharacterCardProps> = React.memo(function CommunityCharacterCard({
  character,
  onSelect,
  onStartChat,
  onImport,
  isBookmarked,
  onToggleBookmark,
  isLiked: isLikedProp,
  onToggleLike,
  isFollowingCreator,
  onToggleFollowCreator,
  onCreatorClick,
  onTagClick,
  isExiting = false,
}) {
  const { palette, skin } = useTheme();
  const styles = useMemo(() => getCachedCardStyles(palette), [palette]);
  const [imgError, setImgError] = useState(false);
  const [isLiked, setIsLiked] = useState<boolean>(
    Boolean(isLikedProp ?? isBookmarked ?? matchAlgorithmService.isCharacterLiked(character.id))
  );
  const [likesCount, setLikesCount] = useState<number>(character.favoritesCount || 0);

  useEffect(() => {
    setIsLiked(Boolean(isLikedProp ?? isBookmarked ?? matchAlgorithmService.isCharacterLiked(character.id)));
  }, [isLikedProp, isBookmarked, character.id]);

  useEffect(() => {
    setLikesCount(character.favoritesCount || 0);
  }, [character.favoritesCount]);
  const likeScale = useRef(new Animated.Value(1)).current;
  const enterAnim = useRef(new Animated.Value(1)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isExiting) {
      Animated.timing(enterAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isExiting, enterAnim]);

  const handlePressIn = () => {
    runPressInAnimation(pressScale, skin.animation);
  };

  const handlePressOut = () => {
    runPressOutAnimation(pressScale, skin.animation);
  };

  const handlePressLike = (e: any) => {
    e.stopPropagation();
    const next = !isLiked;
    setIsLiked(next);
    setLikesCount(prev => Math.max(0, prev + (next ? 1 : -1)));

    // Bouncy tactile spring feedback (social media style)
    Animated.sequence([
      Animated.timing(likeScale, { toValue: 1.45, duration: 110, useNativeDriver: true }),
      Animated.spring(likeScale, { toValue: 1, friction: 3, tension: 45, useNativeDriver: true }),
    ]).start();

    // Immediately record in algorithm service & trigger callback
    matchAlgorithmService.recordUserLike(character, next);
    if (onToggleLike) {
      onToggleLike(character, next);
    } else {
      onToggleBookmark(character.id);
    }
  };

  const formatCount = (num: number) => {
    if (!num) return '0';
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num.toString();
  };

  const cleanHandle = (creator: string) => {
    return creator.replace(/^@/, '');
  };

  const displayTags = (character.tags || []).slice(0, 3);
  const remainingTagCount = (character.tags || []).length - displayTags.length;

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        getCardSurfaceStyle(palette, skin),
        {
          opacity: enterAnim,
          transform: [
            { scale: Animated.multiply(pressScale, enterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] })) },
            { translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={{ flex: 1 }}
        onPress={() => onSelect(character)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.92}
      >
        {/* 1. Artwork Banner with 16/11 Aspect Ratio & Badges */}
        <View style={styles.bannerWrapper}>
          {!imgError && character.avatarUrl ? (
            <Image
              source={{ uri: character.avatarUrl }}
              style={styles.bannerImage}
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={styles.fallbackBanner}>
              <View style={styles.fallbackAvatar}>
                <Text style={styles.fallbackAvatarText}>
                  {character.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.fallbackName} numberOfLines={1}>
                {character.name}
              </Text>
            </View>
          )}

          {/* Progressive Top Gradient Scrim behind badges */}
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(12, 14, 20, 0.62)', 'rgba(12, 14, 20, 0.22)', 'transparent']}
            locations={[0, 0.55, 1]}
            style={styles.bannerTopScrim}
          />

          {/* Top Badges Row */}
          <View style={styles.topBadgesRow}>
            {character.isNsfw ? (
              <View style={styles.nsfwBadge}>
                <Text style={styles.badgeText}>18+</Text>
              </View>
            ) : (
              <View style={styles.sfwBadge}>
                <Text style={styles.badgeText}>SFW</Text>
              </View>
            )}

            {character.totalTokens > 0 && (
              <View style={styles.tokenBadge}>
                <Coins size={10} color={palette.accent} style={{ marginRight: 3 }} />
                <Text style={styles.tokenText}>{formatCount(character.totalTokens)}</Text>
              </View>
            )}
          </View>

          {/* Top-Right Bookmark Button */}
          <TouchableOpacity
            style={styles.bookmarkBtn}
            onPress={e => {
              e.stopPropagation();
              onToggleBookmark(character.id);
            }}
            activeOpacity={0.7}
          >
            <Bookmark
              size={13}
              color={isBookmarked ? palette.accent : '#e2e8f0'}
              fill={isBookmarked ? palette.accent : 'transparent'}
            />
          </TouchableOpacity>

          {/* Linear Transparent Gradient Scrim */}
          <LinearGradient
            pointerEvents="none"
            colors={['transparent', 'rgba(15, 18, 29, 0.22)', 'rgba(15, 18, 29, 0.72)']}
            locations={[0, 0.45, 1]}
            style={styles.bannerGradientScrim}
          />
        </View>

        {/* 2. Card Content Body */}
        <View style={styles.cardBody}>
          {/* Character Title */}
          <Text style={styles.charTitle} numberOfLines={1}>
            {character.name}
          </Text>

          {/* Chat Name / Subtitle (Theme Accent) */}
          {character.chatName ? (
            <Text style={[styles.chatSubtitle, { color: palette.accent }]} numberOfLines={1}>
              {character.chatName}
            </Text>
          ) : null}

          {/* Creator Attribution with Verified Check & + Follow Button */}
          <View style={styles.creatorRow}>
            <TouchableOpacity
              style={styles.creatorHandleWrap}
              onPress={e => {
                e.stopPropagation();
                onCreatorClick?.(character.creatorName);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.creatorBy}>by</Text>
              <Text style={styles.creatorHandle} numberOfLines={1}>
                @{cleanHandle(character.creatorName || 'community')}
              </Text>
              <CheckCircle2 size={11} color={palette.accent} style={{ marginLeft: 2 }} />
            </TouchableOpacity>

            {onToggleFollowCreator && (
              <TouchableOpacity
                style={[styles.followBtn, isFollowingCreator && styles.followBtnActive]}
                onPress={e => {
                  e.stopPropagation();
                  onToggleFollowCreator(character.creatorName, character.avatarUrl);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.followBtnText, isFollowingCreator && styles.followBtnTextActive]}
                >
                  {isFollowingCreator ? 'Following' : '+ Follow'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 2-line Description Snippet */}
          <Text style={styles.snippetText} numberOfLines={2}>
            {character.shortDescription || 'Roleplay companion ready to chat.'}
          </Text>

          {/* Tag Chips Row */}
          <View style={styles.tagsRow}>
            {displayTags.map(tag => {
              const tagName = typeof tag === 'string' ? tag : tag.name;
              const tagId = typeof tag === 'string' ? tag : String(tag.id || tag.slug);
              const cleanName = tagName.replace(/^[^\w\s]+/, '').trim();
              return (
                <TouchableOpacity
                  key={tagId}
                  style={styles.tagChip}
                  onPress={e => {
                    e.stopPropagation();
                    onTagClick?.(tagId, cleanName);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.tagChipText} numberOfLines={1}>
                    #{cleanName}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {remainingTagCount > 0 && (
              <View style={styles.moreTagChip}>
                <Text style={styles.moreTagText}>+{remainingTagCount}</Text>
              </View>
            )}
          </View>

          {/* 3. Card Footer: Stats & Actions */}
          <View style={styles.cardFooter}>
            <View style={styles.statsGroup}>
              <View style={styles.statItem}>
                <Heart
                  size={11}
                  color={isLiked ? '#EF4444' : '#9ca3af'}
                  fill={isLiked ? '#EF4444' : 'transparent'}
                  style={{ marginRight: 3 }}
                />
                <Text style={[styles.statCount, isLiked && { color: '#EF4444', fontWeight: '700' }]}>
                  {formatCount(likesCount)}
                </Text>
              </View>
              <View style={styles.statItem}>
                <MessageSquare size={11} color="#9ca3af" style={{ marginRight: 3 }} />
                <Text style={styles.statCount}>
                  {formatCount(character.chatCount || character.messageCount)}
                </Text>
              </View>
            </View>

            <View style={styles.actionsGroup}>
              {/* Social Media Style Instant-Feedback Like Button */}
              <TouchableOpacity
                style={[styles.likeActionBtn, isLiked && styles.likeActionBtnActive]}
                onPress={handlePressLike}
                activeOpacity={0.7}
                accessibilityLabel={isLiked ? "Unlike Companion" : "Like Companion"}
              >
                <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                  <Heart
                    size={13}
                    color={isLiked ? '#EF4444' : palette.accent}
                    fill={isLiked ? '#EF4444' : 'transparent'}
                  />
                </Animated.View>
              </TouchableOpacity>

              {/* Glowing Accent Circular Play Button */}
              <TouchableOpacity
                style={[styles.playBtn, { backgroundColor: palette.accent, shadowColor: palette.accent }]}
                onPress={e => {
                  e.stopPropagation();
                  onStartChat(character);
                }}
                activeOpacity={0.8}
              >
                <Play size={10} color="#000000" fill="#000000" style={{ marginLeft: 1 }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}, (prev, next) =>
  prev.character.id === next.character.id &&
  prev.character.name === next.character.name &&
  prev.character.avatarUrl === next.character.avatarUrl &&
  prev.character.favoritesCount === next.character.favoritesCount &&
  prev.character.chatCount === next.character.chatCount &&
  prev.isBookmarked === next.isBookmarked &&
  prev.isLiked === next.isLiked &&
  prev.isFollowingCreator === next.isFollowingCreator &&
  prev.isExiting === next.isExiting
);

const cardStylesCache = new WeakMap<ThemePalette, ReturnType<typeof createStyles>>();
function getCachedCardStyles(palette: ThemePalette) {
  let cached = cardStylesCache.get(palette);
  if (!cached) {
    cached = createStyles(palette);
    cardStylesCache.set(palette, cached);
  }
  return cached;
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  cardContainer: {
    flex: 1,
    maxWidth: '48.5%',
    backgroundColor: GLASS.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS.borderBright,
    overflow: 'hidden',
    marginBottom: 12,
    ...GLASS.backdrop,
    ...GLASS.shadow,
    ...Platform.select({
      web: {
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: 'pointer',
      },
      default: {},
    }),
  },
  bannerWrapper: {
    width: '100%',
    aspectRatio: 1, // 1:1 Square artwork provides generous headroom and profile image space
    backgroundColor: palette.bgDark,
    position: 'relative',
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  fallbackBanner: {
    width: '100%',
    height: '100%',
    backgroundColor: '#161324',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  fallbackAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `rgba(${palette.accentRgb}, 0.15)`,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.35)`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  fallbackAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.accent,
  },
  fallbackName: {
    fontSize: 10,
    color: '#9ca3af',
  },
  bannerTopScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 44,
    zIndex: 5,
  },
  bannerGradientScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 52,
    ...(Platform.OS === 'web'
      ? ({
        backgroundImage:
          'linear-gradient(to bottom, rgba(15, 18, 29, 0) 0%, rgba(15, 18, 29, 0.45) 45%, rgba(15, 18, 29, 0.92) 85%, #0f121d 100%)',
      } as any)
      : {}),
  },
  topBadgesRow: {
    position: 'absolute',
    top: 7,
    left: 7,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nsfwBadge: {
    backgroundColor: '#e11d48',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  sfwBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  tokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 17, 28, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    ...GLASS.backdrop,
  },
  tokenText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#d8b4fe',
  },
  bookmarkBtn: {
    position: 'absolute',
    top: 7,
    right: 7,
    zIndex: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(14, 17, 28, 0.56)',
    borderWidth: 1,
    borderColor: GLASS.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
    ...GLASS.backdrop,
  },
  cardBody: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  charTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  chatSubtitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: palette.accent,
    marginTop: 1.5,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  creatorHandleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 4,
  },
  creatorBy: {
    fontSize: 9.5,
    color: '#6b7280',
    marginRight: 2.5,
  },
  creatorHandle: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#d8b4fe',
    maxWidth: 65,
  },
  followBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#181c28',
    borderWidth: 1,
    borderColor: '#262c3f',
  },
  followBtnActive: {
    backgroundColor: 'rgba(147, 51, 234, 0.3)',
    borderColor: 'rgba(168, 85, 247, 0.5)',
  },
  followBtnText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#d1d5db',
  },
  followBtnTextActive: {
    color: '#e9d5ff',
  },
  snippetText: {
    fontSize: 10,
    lineHeight: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  tagChip: {
    backgroundColor: '#181c28',
    borderWidth: 1,
    borderColor: '#222736',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  tagChipText: {
    fontSize: 8.5,
    fontWeight: '500',
    color: '#9ca3af',
    maxWidth: 70,
  },
  moreTagChip: {
    backgroundColor: '#181c28',
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.25)`,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
  },
  moreTagText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: palette.accent,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1b1e28',
  },
  statsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCount: {
    fontSize: 9.5,
    fontWeight: '500',
    color: '#9ca3af',
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likeActionBtn: {
    width: 25,
    height: 25,
    borderRadius: 6,
    backgroundColor: '#181c28',
    borderWidth: 1,
    borderColor: '#222736',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeActionBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.45)',
  },
  importBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#181c28',
    borderWidth: 1,
    borderColor: '#222736',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
    elevation: 3,
  },
});

