/**
 * Tinder-Style Match Deck
 * Features interactive 120Hz gesture swipe physics, right-handed thumb dock,
 * and Filter Modal pop-up with tag filters.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import {
  ArrowLeft,
  X,
  Star,
  MessageCircle,
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  Check,
} from 'lucide-react-native';
import { Character } from '../types';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;

interface TinderDeckProps {
  characters: Character[];
  onBack: () => void;
  onMatchChat: (character: Character) => void;
  onToggleFavorite: (character: Character) => void;
  onApplyFilters?: (tag: string) => void;
}

export const TinderDeck: React.FC<TinderDeckProps> = ({
  characters: initialCharacters,
  onBack,
  onMatchChat,
  onToggleFavorite,
  onApplyFilters,
}) => {
  const [deck, setDeck] = useState<Character[]>(initialCharacters);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedTag, setSelectedTag] = useState('All');

  const position = useRef(new Animated.ValueXY()).current;

  useEffect(() => {
    setDeck(initialCharacters);
    setCurrentIndex(0);
    position.setValue({ x: 0, y: 0 });
  }, [initialCharacters]);

  const currentCharacter = deck[currentIndex];

  const handleNext = () => {
    position.setValue({ x: 0, y: 0 });
    setCurrentIndex(prev => prev + 1);
  };

  const handlePass = () => {
    Animated.timing(position, {
      toValue: { x: -width * 1.4, y: 10 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => handleNext());
  };

  const handleChat = () => {
    if (currentCharacter) {
      Animated.timing(position, {
        toValue: { x: width * 1.4, y: 10 },
        duration: 250,
        useNativeDriver: false,
      }).start(() => {
        onMatchChat(currentCharacter);
        handleNext();
      });
    }
  };

  // Robust PanResponder with desktop & touch drag support
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5;
      },
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy * 0.4 });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          handleChat();
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
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
    outputRange: ['-16deg', '0deg', '16deg'],
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [20, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const nopeOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const filterTags = ['All', 'Romance', 'Anime', 'Fantasy', 'Tsundere', 'Cyberpunk', 'Slice of Life'];

  const handleSelectFilter = (tag: string) => {
    setSelectedTag(tag);
    if (onApplyFilters) {
      onApplyFilters(tag);
    } else {
      if (tag === 'All') {
        setDeck(initialCharacters);
      } else {
        const filtered = initialCharacters.filter(c =>
          c.tags.some(t => t.toLowerCase() === tag.toLowerCase())
        );
        setDeck(filtered.length > 0 ? filtered : initialCharacters);
      }
      setCurrentIndex(0);
    }
    setFilterModalVisible(false);
  };

  const handleResetDeck = () => {
    setCurrentIndex(0);
    position.setValue({ x: 0, y: 0 });
  };

  if (!currentCharacter || currentIndex >= deck.length) {
    return (
      <View style={styles.container}>
        <View style={styles.topHeader}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <ArrowLeft size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Match Mode</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Sparkles size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.emptyTitle}>You've Caught Up!</Text>
          <Text style={styles.emptyDesc}>
            You have reviewed all available anime companions for this filter.
          </Text>
          <TouchableOpacity style={styles.resetBtn} onPress={handleResetDeck}>
            <RotateCcw size={16} color="#000000" style={{ marginRight: 6 }} />
            <Text style={styles.resetBtnText}>Restart Deck</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ArrowLeft size={18} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.topTitle}>Match Mode</Text>

        {/* Filter Pop-up Trigger Button */}
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setFilterModalVisible(true)}
        >
          <SlidersHorizontal size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Main Swipeable Card */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.cardWrapper,
          position.getLayout(),
          { transform: [{ rotate }] },
        ]}
      >
        <Image source={{ uri: currentCharacter.avatar }} style={styles.cardCover} />

        {/* Dynamic LIKE & PASS Stamp Overlays */}
        <Animated.View style={[styles.stampLike, { opacity: likeOpacity }]}>
          <Text style={styles.stampLikeText}>MATCH 🔥</Text>
        </Animated.View>

        <Animated.View style={[styles.stampNope, { opacity: nopeOpacity }]}>
          <Text style={styles.stampNopeText}>PASS ✕</Text>
        </Animated.View>

        {/* Right-Handed Thumb Action Dock */}
        <View style={styles.rightActionDock}>
          <TouchableOpacity style={styles.actionBtnPass} onPress={handlePass} activeOpacity={0.8}>
            <X size={20} color="#FF6B6B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnStar}
            onPress={() => onToggleFavorite(currentCharacter)}
            activeOpacity={0.8}
          >
            <Star
              size={20}
              color={currentCharacter.isFavorite ? '#FFD700' : '#FFFFFF'}
              fill={currentCharacter.isFavorite ? '#FFD700' : 'transparent'}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtnChat} onPress={handleChat} activeOpacity={0.8}>
            <MessageCircle size={22} color="#FFFFFF" fill="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Bottom Scrim & Info */}
        <View style={styles.bottomOverlay}>
          <Text style={styles.charName}>{currentCharacter.name}</Text>
          <Text style={styles.charTagline}>{currentCharacter.tagline}</Text>
          <Text style={styles.charBio} numberOfLines={3}>
            {currentCharacter.description}
          </Text>

          <View style={styles.chipsRow}>
            {currentCharacter.tags.slice(0, 3).map((tag, i) => (
              <View key={i} style={styles.tagChip}>
                <Text style={styles.tagChipText}>#{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>

      {/* Filter Pop-up Modal */}
      <Modal visible={filterModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.filterCard}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Match Mode Filters</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <X size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterSectionLabel}>Filter by Anime Tag / Genre</Text>
            <View style={styles.filterTagsRow}>
              {filterTags.map((t, idx) => {
                const isSelected = selectedTag === t;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.filterTagChip, isSelected && styles.filterTagChipActive]}
                    onPress={() => handleSelectFilter(t)}
                  >
                    {isSelected && <Check size={12} color="#FFFFFF" style={{ marginRight: 4 }} />}
                    <Text style={[styles.filterTagText, isSelected && styles.filterTagTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0e14',
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  topTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cardWrapper: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 80,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: '#12151e',
    cursor: 'grab',
  },
  cardCover: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    resizeMode: 'cover',
  },
  stampLike: {
    position: 'absolute',
    top: 30,
    left: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4ADE80',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    transform: [{ rotate: '-15deg' }],
    zIndex: 30,
  },
  stampLikeText: {
    color: '#4ADE80',
    fontSize: 18,
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
    borderWidth: 2,
    borderColor: '#FF6B6B',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    transform: [{ rotate: '15deg' }],
    zIndex: 30,
  },
  stampNopeText: {
    color: '#FF6B6B',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  rightActionDock: {
    position: 'absolute',
    right: 14,
    bottom: 40,
    zIndex: 40,
    backgroundColor: 'rgba(12, 14, 20, 0.85)',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    gap: 12,
  },
  actionBtnPass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnStar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnChat: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 18,
    paddingRight: 76,
    backgroundColor: 'rgba(12, 14, 20, 0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  charName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  charTagline: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 6,
  },
  charBio: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tagChipText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyDesc: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  resetBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  filterCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#12151e',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  filterSectionLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginBottom: 10,
  },
  filterTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterTagChipActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: '#FFFFFF',
  },
  filterTagText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
  },
  filterTagTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
