/**
 * CommunityCharacterCard.tsx
 * Strictly ported from Warden AI (c:\Users\kanto\Documents\Work\Apps\Wardenai\src\components\character\CommunityCharacterCard.tsx)
 * Matches Gambar 2 Bento 2-column grid layout with 100% fidelity.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import {
  MessageSquare,
  Heart,
  Bookmark,
  Play,
  CheckCircle2,
  Download,
  Coins,
} from 'lucide-react-native';
import { CommunityCharacter } from '../types';

interface CommunityCharacterCardProps {
  character: CommunityCharacter;
  onSelect: (character: CommunityCharacter) => void;
  onStartChat: (character: CommunityCharacter) => void;
  onImport?: (character: CommunityCharacter) => void;
  isBookmarked: boolean;
  onToggleBookmark: (characterId: string) => void;
  isFollowingCreator?: boolean;
  onToggleFollowCreator?: (creatorName: string, avatarUrl?: string) => void;
  onCreatorClick?: (creatorName: string) => void;
  onTagClick?: (tagId: string, tagName: string) => void;
}

export const CommunityCharacterCard: React.FC<CommunityCharacterCardProps> = ({
  character,
  onSelect,
  onStartChat,
  onImport,
  isBookmarked,
  onToggleBookmark,
  isFollowingCreator,
  onToggleFollowCreator,
  onCreatorClick,
  onTagClick,
}) => {
  const [imgError, setImgError] = useState(false);

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
    <TouchableOpacity
      style={styles.cardContainer}
      onPress={() => onSelect(character)}
      activeOpacity={0.88}
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
              <Coins size={10} color="#d8b4fe" style={{ marginRight: 3 }} />
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
            color={isBookmarked ? '#c084fc' : '#e2e8f0'}
            fill={isBookmarked ? '#c084fc' : 'transparent'}
          />
        </TouchableOpacity>

        {/* Subtle Dark Bottom Scrim */}
        <View style={styles.bannerScrim} />
      </View>

      {/* 2. Card Content Body */}
      <View style={styles.cardBody}>
        {/* Character Title */}
        <Text style={styles.charTitle} numberOfLines={1}>
          {character.name}
        </Text>

        {/* Chat Name / Subtitle (Purple Accent) */}
        {character.chatName ? (
          <Text style={styles.chatSubtitle} numberOfLines={1}>
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
            <CheckCircle2 size={11} color="#a855f7" style={{ marginLeft: 2 }} />
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
              <Heart size={11} color="#9ca3af" style={{ marginRight: 3 }} />
              <Text style={styles.statCount}>{formatCount(character.favoritesCount)}</Text>
            </View>
            <View style={styles.statItem}>
              <MessageSquare size={11} color="#9ca3af" style={{ marginRight: 3 }} />
              <Text style={styles.statCount}>
                {formatCount(character.chatCount || character.messageCount)}
              </Text>
            </View>
          </View>

          <View style={styles.actionsGroup}>
            {/* Quick Import Button */}
            <TouchableOpacity
              style={styles.importBtn}
              onPress={e => {
                e.stopPropagation();
                onImport?.(character);
              }}
              activeOpacity={0.7}
              title="Import Card"
            >
              <Download size={12} color="#c084fc" />
            </TouchableOpacity>

            {/* Glowing Purple Circular Play Button */}
            <TouchableOpacity
              style={styles.playBtn}
              onPress={e => {
                e.stopPropagation();
                onStartChat(character);
              }}
              activeOpacity={0.8}
            >
              <Play size={10} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 1 }} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flex: 1,
    maxWidth: '48.5%',
    backgroundColor: '#12151e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1b1e28',
    overflow: 'hidden',
    marginBottom: 12,
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
    aspectRatio: 16 / 11,
    backgroundColor: '#0c0e14',
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
    backgroundColor: 'rgba(168, 85, 247, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  fallbackAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e9d5ff',
  },
  fallbackName: {
    fontSize: 10,
    color: '#9ca3af',
  },
  bannerScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
    backgroundColor: 'rgba(18, 21, 30, 0.65)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.35)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '600',
    color: '#c084fc',
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
    borderColor: 'rgba(168, 85, 247, 0.25)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
  },
  moreTagText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#c084fc',
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
    gap: 5,
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
    backgroundColor: '#9333ea',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9333ea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 3,
  },
});
