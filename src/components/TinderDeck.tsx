/**
 * Tinder-Style Match Deck
 * Ref: Gambar 3 — Fullscreen card with right-handed thumb action dock.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { ArrowLeft, X, Star, MessageCircle, Filter, RotateCcw } from 'lucide-react-native';
import { Character } from '../types';
import { colors } from '../theme/colors';

const { width, height } = Dimensions.get('window');

interface TinderDeckProps {
  characters: Character[];
  onBack: () => void;
  onMatchChat: (character: Character) => void;
  onToggleFavorite: (character: Character) => void;
}

export const TinderDeck: React.FC<TinderDeckProps> = ({
  characters,
  onBack,
  onMatchChat,
  onToggleFavorite,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const position = useRef(new Animated.ValueXY()).current;

  const currentCharacter = characters[currentIndex];

  const handleNext = () => {
    position.setValue({ x: 0, y: 0 });
    setCurrentIndex(prev => prev + 1);
  };

  const handlePass = () => {
    Animated.timing(position, {
      toValue: { x: -width * 1.3, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => handleNext());
  };

  const handleChat = () => {
    if (currentCharacter) {
      Animated.timing(position, {
        toValue: { x: width * 1.3, y: 0 },
        duration: 250,
        useNativeDriver: false,
      }).start(() => {
        onMatchChat(currentCharacter);
        handleNext();
      });
    }
  };

  // Full 120Hz PanGesture Drag Responder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy * 0.4 });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 120) {
          handleChat();
        } else if (gesture.dx < -120) {
          handlePass();
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            tension: 40,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const rotate = position.x.interpolate({
    inputRange: [-width * 1.5, 0, width * 1.5],
    outputRange: ['-14deg', '0deg', '14deg'],
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [20, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const nopeOpacity = position.x.interpolate({
    inputRange: [-100, -20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const handleReset = () => {
    setCurrentIndex(0);
  };

  if (currentIndex >= characters.length || !currentCharacter) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Deck Finished! 🔥</Text>
        <Text style={styles.emptySubtitle}>You've reviewed all available companions in this deck.</Text>
        <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
          <RotateCcw size={18} color="#000" style={{ marginRight: 8 }} />
          <Text style={styles.resetButtonText}>Reshuffle Deck</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton} onPress={onBack}>
          <Filter size={18} color={colors.lime} style={{ marginRight: 8 }} />
          <Text style={styles.filterButtonText}>Adjust Filter & Return</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Clean Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Match Mode</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Main Full-Bleed Card with 120Hz Gesture Physics */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.cardWrapper,
          position.getLayout(),
          {
            transform: [{ rotate }],
          },
        ]}
      >
        <Image source={{ uri: currentCharacter.avatar }} style={styles.cardCover} />

        {/* Dynamic LIKE & NOPE Stamp Overlays on Swipe */}
        <Animated.View style={[styles.stampLike, { opacity: likeOpacity }]}>
          <Text style={styles.stampLikeText}>MATCH 🔥</Text>
        </Animated.View>

        <Animated.View style={[styles.stampNope, { opacity: nopeOpacity }]}>
          <Text style={styles.stampNopeText}>PASS ✕</Text>
        </Animated.View>

        {/* Right-Handed Vertical Action Dock (Ref: Gambar 3) */}
        <View style={styles.rightActionDock}>
          {/* Pass Button (✕) */}
          <TouchableOpacity style={styles.actionBtnPass} onPress={handlePass} activeOpacity={0.8}>
            <X size={22} color={colors.coral} />
          </TouchableOpacity>

          {/* Star / Bookmark Button (⭐) */}
          <TouchableOpacity
            style={styles.actionBtnStar}
            onPress={() => onToggleFavorite(currentCharacter)}
            activeOpacity={0.8}
          >
            <Star
              size={22}
              color={currentCharacter.isFavorite ? colors.lemon : 'rgba(255,255,255,0.85)'}
              fill={currentCharacter.isFavorite ? colors.lemon : 'transparent'}
            />
          </TouchableOpacity>

          {/* Chat / Match CTA (💬) */}
          <TouchableOpacity style={styles.actionBtnChat} onPress={handleChat} activeOpacity={0.8}>
            <MessageCircle size={24} color="#000" fill="#000" />
          </TouchableOpacity>
        </View>

        {/* Bottom Metadata & Interest Tags */}
        <View style={styles.bottomOverlay}>
          <Text style={styles.charName}>{currentCharacter.name}</Text>
          <Text style={styles.charTagline}>{currentCharacter.tagline}</Text>
          <Text style={styles.charBio} numberOfLines={3}>
            {currentCharacter.description}
          </Text>

          {/* Interest Chips */}
          <View style={styles.chipsRow}>
            {currentCharacter.tags.slice(0, 3).map((tag, i) => (
              <View key={i} style={styles.tagChip}>
                <Text style={styles.tagChipText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  cardWrapper: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 80,
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: colors.bgSurface,
  },
  cardCover: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  stampLike: {
    position: 'absolute',
    top: 30,
    left: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: colors.lime,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    transform: [{ rotate: '-15deg' }],
    zIndex: 20,
  },
  stampLikeText: {
    color: colors.lime,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
  },
  stampNope: {
    position: 'absolute',
    top: 30,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: colors.coral,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    transform: [{ rotate: '15deg' }],
    zIndex: 20,
  },
  stampNopeText: {
    color: colors.coral,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
  },
  rightActionDock: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    zIndex: 10,
    backgroundColor: 'rgba(10, 10, 15, 0.65)',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    gap: 14,
  },
  actionBtnPass: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(251, 113, 133, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnStar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(250, 204, 21, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnChat: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.lime,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.lime,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingRight: 80, // Prevent text overlapping the right action dock
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  charName: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  charTagline: {
    color: colors.lime,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  charBio: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  tagChipText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: colors.bgDark,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lime,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    marginBottom: 12,
  },
  resetButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(204, 255, 0, 0.12)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.lime,
  },
  filterButtonText: {
    color: colors.lime,
    fontSize: 13,
    fontWeight: '600',
  },
});

