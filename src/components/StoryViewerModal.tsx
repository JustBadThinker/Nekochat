/**
 * Fullscreen Instagram-Style Story Viewer Modal
 * Close button pinned strictly at top-right corner (zIndex: 99999).
 * Avatar, Name, and Tagline docked cleanly at the BOTTOM.
 */

import React, { useState, useEffect , useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { X, Heart, MessageCircle } from 'lucide-react-native';
import { Character } from '../types';
import { GLASS } from '../theme/glassTheme';
import { useTheme } from '../theme/ThemeContext';
import { storageService } from '../services/storageService';
import { matchAlgorithmService } from '../services/matchAlgorithmService';
import { ThemePalette } from '../theme/colors';

interface StoryViewerModalProps {
  visible: boolean;
  characters: Character[];
  initialIndex: number;
  onClose: () => void;
  onStartChat: (character: Character) => void;
  onToggleFavorite: (character: Character) => void;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  visible,
  characters,
  initialIndex,
  onClose,
  onStartChat,
  onToggleFavorite,
}) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCurrentIndex(initialIndex || 0);
    setShowFullDesc(false);
    if (visible) {
      storageService.getCommunityFavorites().then(favs => {
        setLikedIds(new Set(favs.map(f => f.id)));
      }).catch(() => {});
    }
  }, [initialIndex, visible]);

  if (!visible || characters.length === 0) return null;

  const currentCharacter = characters[currentIndex] || characters[0];
  const isLiked = Boolean(currentCharacter.isFavorite || likedIds.has(currentCharacter.id));

  const handleLikeStory = async () => {
    const nextLiked = !isLiked;
    setLikedIds(prev => {
      const copy = new Set(prev);
      if (nextLiked) copy.add(currentCharacter.id);
      else copy.delete(currentCharacter.id);
      return copy;
    });
    try {
      await storageService.toggleCommunityFavorite({
        id: currentCharacter.id,
        characterId: currentCharacter.id,
        name: currentCharacter.name,
        chatName: currentCharacter.chatName || currentCharacter.name,
        creatorName: currentCharacter.creator || 'community',
        avatarUrl: currentCharacter.avatar,
        shortDescription: currentCharacter.description || '',
        isNsfw: currentCharacter.contentRating === 'NSFW',
        totalTokens: currentCharacter.totalTokens || 850,
        chatCount: currentCharacter.chatCount || 0,
        messageCount: 0,
        favoritesCount: currentCharacter.likeCount || 0,
        tags: (currentCharacter.tags || []).map((t, i) => ({ id: i, name: String(t), slug: String(t).toLowerCase() })),
      } as any);
      matchAlgorithmService.recordUserLike(currentCharacter as any, nextLiked);
    } catch {}
    onToggleFavorite(currentCharacter);
  };

  const handleNext = () => {
    setShowFullDesc(false);
    if (currentIndex < characters.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    setShowFullDesc(false);
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const shortBio = currentCharacter.description.length > 140
    ? currentCharacter.description.slice(0, 140) + '...'
    : currentCharacter.description;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.storyContainer}>
          {/* Fullscreen Cover Background */}
          <Image source={{ uri: currentCharacter.avatar }} style={styles.fullCover} />

          {/* Top Progress Bar Segments */}
          <View style={styles.topProgressRow}>
            {characters.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.segment,
                  i === currentIndex
                    ? styles.segmentActive
                    : i < currentIndex
                    ? styles.segmentCompleted
                    : styles.segmentInactive,
                ]}
              />
            ))}
          </View>

          {/* Pinned Top-Right Close Button (Explicit Absolute Pinning) */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Touch Gestures: Left Tap (Prev) / Right Tap (Next) */}
          <View style={styles.tapGestureArea}>
            <TouchableWithoutFeedback onPress={handlePrev}>
              <View style={styles.tapLeft} />
            </TouchableWithoutFeedback>
            <TouchableWithoutFeedback onPress={handleNext}>
              <View style={styles.tapRight} />
            </TouchableWithoutFeedback>
          </View>

          {/* Bottom Story Scrim Card: Avatar, Name, Title, Bio DOCKED AT BOTTOM */}
          <View style={styles.bottomCard}>
            {/* Character Header at BOTTOM */}
            <View style={styles.characterBottomHeader}>
              <Image source={{ uri: currentCharacter.avatar }} style={styles.bottomAvatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.bottomCharName}>{currentCharacter.name}</Text>
                <Text style={styles.bottomCharTagline}>{currentCharacter.tagline}</Text>
              </View>
            </View>

            <Text style={styles.bioText}>
              {showFullDesc ? currentCharacter.description : shortBio}
            </Text>

            {currentCharacter.description.length > 140 && !showFullDesc && (
              <TouchableOpacity onPress={() => setShowFullDesc(true)}>
                <Text style={styles.readMoreText}>...Read more</Text>
              </TouchableOpacity>
            )}

            {/* Action CTA Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.likeBtn, isLiked && { borderColor: '#FF6B6B', backgroundColor: 'rgba(255, 107, 107, 0.16)' }]}
                onPress={handleLikeStory}
                activeOpacity={0.7}
              >
                <Heart
                  size={20}
                  color={isLiked ? '#FF6B6B' : '#FFFFFF'}
                  fill={isLiked ? '#FF6B6B' : 'transparent'}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.chatCTA, { backgroundColor: palette.accent }]}
                onPress={() => {
                  onClose();
                  onStartChat(currentCharacter);
                }}
                activeOpacity={0.8}
              >
                <MessageCircle size={16} color="#000000" fill="#000000" style={{ marginRight: 8 }} />
                <Text style={styles.chatCTAText}>Start Chat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    height: '100%',
    backgroundColor: '#050608',
    position: 'relative',
    overflow: 'hidden',
  },
  fullCover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  topProgressRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 6,
    zIndex: 20,
    marginRight: 60, // Leave room for top-right close button
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentCompleted: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  segmentInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    zIndex: 99999,
  },
  tapGestureArea: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    bottom: 180,
    flexDirection: 'row',
    zIndex: 5,
  },
  tapLeft: {
    flex: 1,
  },
  tapRight: {
    flex: 2,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: GLASS.bgModal,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: GLASS.borderBright,
    zIndex: 30,
    ...GLASS.backdropStrong,
    ...GLASS.shadow,
  },
  characterBottomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  bottomAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  bottomCharName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  bottomCharTagline: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 11,
    fontWeight: '600',
  },
  bioText: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 18,
  },
  readMoreText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 10,
  },
  likeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  chatCTA: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.accent,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
  chatCTAText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
});
