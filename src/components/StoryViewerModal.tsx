/**
 * Fullscreen Instagram-Style Story Viewer Modal
 * Ref: Gambar 6 & User Request — Top 5 trending 24h interactive viewer.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { X, Heart, MessageCircle } from 'lucide-react-native';
import { Character } from '../types';
import { colors } from '../theme/colors';

const { width, height } = Dimensions.get('window');

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
  const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
  const [showFullDesc, setShowFullDesc] = useState(false);

  // Sync index when modal opens
  React.useEffect(() => {
    setCurrentIndex(initialIndex || 0);
    setShowFullDesc(false);
  }, [initialIndex, visible]);

  if (!visible || characters.length === 0) return null;

  const currentCharacter = characters[currentIndex] || characters[0];

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

  // Truncate description to max 150 characters
  const shortBio = currentCharacter.description.length > 150
    ? currentCharacter.description.slice(0, 150) + '...'
    : currentCharacter.description;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        {/* Fullscreen Cover Background */}
        <Image source={{ uri: currentCharacter.avatar }} style={styles.fullCover} />

        {/* Top Progress Bar Segments (5 Segments) */}
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

        {/* Top Header: Character Name & Close Button */}
        <View style={styles.headerRow}>
          <View style={styles.creatorInfo}>
            <Image source={{ uri: currentCharacter.avatar }} style={styles.headerAvatar} />
            <View>
              <Text style={styles.headerName}>{currentCharacter.name}</Text>
              <Text style={styles.headerTagline}>{currentCharacter.tagline}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <X size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Touch Gestures: Left Tap (Prev) / Right Tap (Next) */}
        <View style={styles.tapGestureArea}>
          <TouchableWithoutFeedback onPress={handlePrev}>
            <View style={styles.tapLeft} />
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback onPress={handleNext}>
            <View style={styles.tapRight} />
          </TouchableWithoutFeedback>
        </View>

        {/* Bottom Story Scrim Card */}
        <View style={styles.bottomCard}>
          <Text style={styles.bioText}>
            {showFullDesc ? currentCharacter.description : shortBio}
          </Text>

          {currentCharacter.description.length > 150 && !showFullDesc && (
            <TouchableOpacity onPress={() => setShowFullDesc(true)}>
              <Text style={styles.readMoreText}>...Read more</Text>
            </TouchableOpacity>
          )}

          {/* Action CTA Buttons */}
          <View style={styles.actionRow}>
            {/* Like Button */}
            <TouchableOpacity
              style={styles.likeBtn}
              onPress={() => onToggleFavorite(currentCharacter)}
              activeOpacity={0.7}
            >
              <Heart
                size={22}
                color={currentCharacter.isFavorite ? colors.coral : '#fff'}
                fill={currentCharacter.isFavorite ? colors.coral : 'transparent'}
              />
            </TouchableOpacity>

            {/* Start Chat Button */}
            <TouchableOpacity
              style={styles.chatCTA}
              onPress={() => {
                onClose();
                onStartChat(currentCharacter);
              }}
              activeOpacity={0.8}
            >
              <MessageCircle size={18} color="#000" fill="#000" style={{ marginRight: 8 }} />
              <Text style={styles.chatCTAText}>Start Chat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'space-between',
  },
  fullCover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width,
    height,
  },
  topProgressRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 48,
    gap: 6,
    zIndex: 10,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  segmentActive: {
    backgroundColor: colors.lime,
  },
  segmentCompleted: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  segmentInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    zIndex: 10,
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: colors.lime,
  },
  headerName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  headerTagline: {
    color: colors.lime,
    fontSize: 11,
    fontWeight: '600',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tapGestureArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    backgroundColor: 'rgba(7, 9, 13, 0.92)',
    marginHorizontal: 16,
    marginBottom: 36,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 10,
  },
  bioText: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 20,
  },
  readMoreText: {
    color: colors.lime,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  likeBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatCTA: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatCTAText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
  },
});
