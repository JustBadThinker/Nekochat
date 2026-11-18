/**
 * NekoChat — Tinder-Style Match Mode Deck
 * Features 120Hz gesture swipe physics, mouse drag compatibility for web/desktop,
 * next-card stack peeking, thumb action dock (Rewind, Pass, Favorite, Match, Info),
 * non-repeating algorithmic matching queue with affinity score badges.
 */

import React, { useState, useRef, useEffect , useMemo } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Star,
  MessageCircle,
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  Check,
  Flame,
  Info,
  Zap,
} from 'lucide-react-native';
import {
  matchAlgorithmService,
  ScoredMatchCharacter,
  isCharacterExplicitlyMale,
  isCharacterExplicitlyFemale,
} from '../services/matchAlgorithmService';
import { Persona } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { ThemePalette } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 75;

const FALLBACK_AVATAR = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800';

export interface TinderDeckProps {
  characters?: any[];
  activePersona?: Persona;
  onBack: () => void;
  onMatchChat: (character: any) => void;
  onToggleFavorite: (character: any) => void;
  favoriteIds?: Set<string>;
}

export const TinderDeck: React.FC<TinderDeckProps> = ({
  characters: propCharacters,
  activePersona,
  onBack,
  onMatchChat,
  onToggleFavorite,
  favoriteIds = new Set(),
}) => {
  const { palette, skin } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [deck, setDeck] = useState<ScoredMatchCharacter[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState<{ index: number; character: ScoredMatchCharacter }[]>([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(['All']);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());

  const position = useRef(new Animated.ValueXY()).current;

  // Initialize algorithmic feed
  useEffect(() => {
    loadFreshBatch(true);
  }, [selectedTags]);

  const loadFreshBatch = async (isReset: boolean = false) => {
    if (isReset) {
      setInitialLoading(true);
      setCurrentIndex(0);
      setHistory([]);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const scored = await matchAlgorithmService.getNextBatch(15, activePersona, selectedTags);
      if (scored.length > 0) {
        setDeck(prev => {
          if (isReset) {
            const seenIds = new Set<string>();
            const seenNames = new Set<string>();
            return scored.filter(c => {
              const id = c.id || (c as any).characterId;
              const nameKey = (c.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
              if (seenIds.has(id) || (nameKey && seenNames.has(nameKey))) return false;
              seenIds.add(id);
              if (nameKey) seenNames.add(nameKey);
              return true;
            });
          }
          const existingIds = new Set(prev.map(p => p.id || (p as any).characterId));
          const existingNames = new Set(
            prev.map(p => (p.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '')).filter(Boolean)
          );
          const uniqueScored = scored.filter(c => {
            const id = c.id || (c as any).characterId;
            const nameKey = (c.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            if (existingIds.has(id) || (nameKey && existingNames.has(nameKey))) return false;
            existingIds.add(id);
            if (nameKey) existingNames.add(nameKey);
            return true;
          });
          return [...prev, ...uniqueScored];
        });
      } else if (isReset && propCharacters && propCharacters.length > 0) {
        // Fallback to prop characters if remote batch is empty, with strict gender filtering
        const filteredProps = propCharacters.filter(c => {
          if (selectedTags.includes('Female') && isCharacterExplicitlyMale(c)) return false;
          if (selectedTags.includes('Male') && isCharacterExplicitlyFemale(c)) return false;
          return true;
        });
        const seenIds = new Set<string>();
        const seenNames = new Set<string>();
        const uniqueProps = filteredProps.filter(c => {
          const id = c.id || c.characterId;
          const nameKey = (c.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          if (seenIds.has(id) || (nameKey && seenNames.has(nameKey))) return false;
          seenIds.add(id);
          if (nameKey) seenNames.add(nameKey);
          return true;
        });
        const mapped: ScoredMatchCharacter[] = uniqueProps.map(c => ({
          ...c,
          affinityScore: 88,
          matchReasons: ['Popular match'],
        }));
        setDeck(mapped);
      }
    } catch {
      if (isReset && propCharacters && propCharacters.length > 0) {
        const filteredProps = propCharacters.filter(c => {
          if (selectedTags.includes('Female') && isCharacterExplicitlyMale(c)) return false;
          if (selectedTags.includes('Male') && isCharacterExplicitlyFemale(c)) return false;
          return true;
        });
        const seenIds = new Set<string>();
        const seenNames = new Set<string>();
        const uniqueProps = filteredProps.filter(c => {
          const id = c.id || c.characterId;
          const nameKey = (c.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          if (seenIds.has(id) || (nameKey && seenNames.has(nameKey))) return false;
          seenIds.add(id);
          if (nameKey) seenNames.add(nameKey);
          return true;
        });
        setDeck(
          uniqueProps.map(c => ({
            ...c,
            affinityScore: 85,
            matchReasons: ['Curated for you'],
          }))
        );
      }
    } finally {
      setInitialLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Pre-fetch more cards when queue drops low
  useEffect(() => {
    if (!initialLoading && !isLoadingMore && deck.length > 0 && currentIndex >= deck.length - 4) {
      loadFreshBatch(false);
    }
  }, [currentIndex, deck.length]);

  const currentCharacter = deck[currentIndex];
  const nextCharacter = deck[currentIndex + 1];

  // Up-to-date refs to eliminate stale closure freezing in PanResponder
  const deckRef = useRef(deck);
  deckRef.current = deck;

  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  const currentCharacterRef = useRef(currentCharacter);
  currentCharacterRef.current = currentCharacter;

  const onMatchChatRef = useRef(onMatchChat);
  onMatchChatRef.current = onMatchChat;

  const isAnimatingRef = useRef(false);

  useEffect(() => {
    position.stopAnimation();
    position.setValue({ x: 0, y: 0 });
    isAnimatingRef.current = false;
  }, [currentIndex]);

  const handleNext = () => {
    setCurrentIndex(prev => prev + 1);
  };

  const handleRewind = () => {
    if (history.length === 0) return;
    const lastItem = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setCurrentIndex(lastItem.index);
  };

  const handlePass = () => {
    if (isAnimatingRef.current) return;
    const char = currentCharacterRef.current || deckRef.current[currentIndexRef.current];
    if (!char) {
      Animated.spring(position, {
        toValue: { x: 0, y: 0 },
        friction: 6,
        tension: 50,
        useNativeDriver: false,
      }).start(() => {
        isAnimatingRef.current = false;
      });
      return;
    }

    isAnimatingRef.current = true;
    const curIdx = currentIndexRef.current;
    setHistory(prev => [...prev, { index: curIdx, character: char }]);
    matchAlgorithmService.markSwiped(char.id || char.characterId, 'pass', char);

    const targetX = -Math.max(SCREEN_WIDTH, 480) * 1.5;
    Animated.timing(position, {
      toValue: { x: targetX, y: 15 },
      duration: Math.max(180, Math.round(skin.animation.enterDuration * 0.85)),
      easing: skin.animation.easing,
      useNativeDriver: false,
    }).start(() => handleNext());

    // Failsafe timer so card can never freeze on desktop or mobile
    setTimeout(() => {
      if (isAnimatingRef.current) {
        handleNext();
      }
    }, 380);
  };

  const handleMatch = () => {
    if (isAnimatingRef.current) return;
    const char = currentCharacterRef.current || deckRef.current[currentIndexRef.current];
    if (!char) {
      Animated.spring(position, {
        toValue: { x: 0, y: 0 },
        friction: 6,
        tension: 50,
        useNativeDriver: false,
      }).start(() => {
        isAnimatingRef.current = false;
      });
      return;
    }

    isAnimatingRef.current = true;
    const curIdx = currentIndexRef.current;
    setHistory(prev => [...prev, { index: curIdx, character: char }]);
    matchAlgorithmService.markSwiped(char.id || char.characterId, 'match', char);

    const targetX = Math.max(SCREEN_WIDTH, 480) * 1.5;
    Animated.timing(position, {
      toValue: { x: targetX, y: 15 },
      duration: Math.max(180, Math.round(skin.animation.enterDuration * 0.85)),
      easing: skin.animation.easing,
      useNativeDriver: false,
    }).start(() => {
      onMatchChatRef.current?.(char);
      handleNext();
    });

    // Failsafe timer
    setTimeout(() => {
      if (isAnimatingRef.current) {
        handleNext();
      }
    }, 380);
  };

  const handlePassRef = useRef(handlePass);
  handlePassRef.current = handlePass;

  const handleMatchRef = useRef(handleMatch);
  handleMatchRef.current = handleMatch;

  // PanResponder with touch & desktop mouse drag support + velocity flicks
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        isAnimatingRef.current = false; // Always release locks on fresh touch!
        position.stopAnimation();
      },
      onPanResponderMove: (_, gesture) => {
        if (isAnimatingRef.current) return;
        position.setValue({ x: gesture.dx, y: gesture.dy * 0.35 });
      },
      onPanResponderRelease: (_, gesture) => {
        if (isAnimatingRef.current) return;
        const isFlickRight = gesture.dx > 35 && gesture.vx > 0.2;
        const isFlickLeft = gesture.dx < -35 && gesture.vx < -0.2;

        if (gesture.dx > SWIPE_THRESHOLD || isFlickRight) {
          handleMatchRef.current();
        } else if (gesture.dx < -SWIPE_THRESHOLD || isFlickLeft) {
          handlePassRef.current();
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 6,
            tension: 50,
            useNativeDriver: false,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        if (isAnimatingRef.current) return;
        Animated.spring(position, {
          toValue: { x: 0, y: 0 },
          friction: 6,
          tension: 50,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  // Rotation interpolations
  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
    outputRange: ['-18deg', '0deg', '18deg'],
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

  const nextScale = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: [1, 0.94, 1],
    extrapolate: 'clamp',
  });

  const nextOpacity = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: [1, 0.7, 1],
    extrapolate: 'clamp',
  });

  const filterTags = [
    'All',
    'Female',
    'Male',
    'Anime',
    'Romance',
    'Fantasy',
    'Tsundere',
    'Yandere',
    'RPG',
    'Sci-Fi',
    'Monster Girls',
    'Slice of Life',
    'Smut',
    'Fluff',
  ];

  const handleToggleFilter = (tag: string) => {
    if (tag === 'All') {
      setSelectedTags(['All']);
      return;
    }
    setSelectedTags(prev => {
      const withoutAll = prev.filter(t => t !== 'All');
      if (withoutAll.includes(tag)) {
        const next = withoutAll.filter(t => t !== tag);
        return next.length === 0 ? ['All'] : next;
      } else {
        return [...withoutAll, tag];
      }
    });
  };

  const handleRestartDeck = async () => {
    await matchAlgorithmService.resetSeen();
    loadFreshBatch(true);
  };

  const getSafeAvatarUri = (char?: any) => {
    if (!char) return FALLBACK_AVATAR;
    const id = char.id || char.characterId || '';
    if (failedImageIds.has(id)) return FALLBACK_AVATAR;
    const uri =
      char.avatarUrl ||
      char.avatar ||
      char.avatarVariantUrls?.hero ||
      char.avatarVariantUrls?.card ||
      char.avatarDisplayUrl ||
      FALLBACK_AVATAR;
    return String(uri).trim() || FALLBACK_AVATAR;
  };

  const getTagsList = (char?: any): string[] => {
    if (!char || !Array.isArray(char.tags)) return [];
    return char.tags.map((t: any) => (typeof t === 'string' ? t : (t?.name || t?.slug || String(t))));
  };

  // ── Initial Radar Loading State ──
  if (initialLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <View style={styles.pulseRadar}>
            <Flame size={32} color={palette.accent} />
          </View>
          <Text style={styles.emptyTitle}>Scanning Anime Companions...</Text>
          <Text style={styles.emptyDesc}>
            Calculating chemistry scores based on your persona and roleplay preferences.
          </Text>
          <ActivityIndicator size="small" color={palette.accent} style={{ marginTop: 14 }} />
        </View>
      </View>
    );
  }

  // ── Empty / End of Deck State ──
  if (!currentCharacter || currentIndex >= deck.length) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Sparkles size={28} color={palette.accent} />
          </View>
          <Text style={styles.emptyTitle}>{"You've Caught Up!"}</Text>
          <Text style={styles.emptyDesc}>
            You have reviewed all available anime companions. Tap below to restart discovery or browse the grid catalog.
          </Text>
          <View style={styles.emptyBtnRow}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleRestartDeck}>
              <RotateCcw size={15} color={palette.bgDark} style={{ marginRight: 6 }} />
              <Text style={styles.resetBtnText}>Restart Deck</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backCatalogBtn} onPress={onBack}>
              <Text style={styles.backCatalogBtnText}>Browse Catalog Grid</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const avatarUri = getSafeAvatarUri(currentCharacter);
  const nextAvatarUri = getSafeAvatarUri(nextCharacter);
  const tagsList = getTagsList(currentCharacter);
  const creator = currentCharacter.creatorName || (currentCharacter as any).creator || 'community';
  const charId = currentCharacter.id || currentCharacter.characterId;
  const isFav = (currentCharacter as any).isFavorite || favoriteIds.has(charId);
  const bio = currentCharacter.shortDescription || currentCharacter.personality || (currentCharacter as any).description || '';
  const isNsfw = Boolean(currentCharacter.isNsfw || (currentCharacter as any).rating === 'NSFW' || (currentCharacter as any).contentRating === 'NSFW');
  const affinity = currentCharacter.affinityScore || 85;
  const reason = currentCharacter.matchReasons?.[0] || 'Recommended match';

  return (
    <View style={styles.container}>
      {/* ── Sub Toolbar in Match Deck ── */}
      <View style={styles.deckToolbar}>
        <View style={styles.deckToolbarLeft}>
          <View style={styles.affinityBadgeHeader}>
            <Zap size={11} color={palette.accent} style={{ marginRight: 3 }} />
            <Text style={styles.affinityBadgeHeaderText}>{affinity}% Chemistry</Text>
          </View>
          {!selectedTags.includes('All') && (
            <View style={styles.activeTagBadge}>
              <Text style={styles.activeTagBadgeText}>
                {selectedTags.map(t => `#${t}`).join(' ')}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.filterTriggerBtn}
          onPress={() => setFilterModalVisible(true)}
          activeOpacity={0.8}
        >
          <SlidersHorizontal size={13} color={palette.accent} style={{ marginRight: 5 }} />
          <Text style={styles.filterTriggerText}>Filter</Text>
        </TouchableOpacity>
      </View>

      {/* ── Card Stack Viewport ── */}
      <View style={styles.deckViewport}>
        {/* Next Card in Stack (Peeking underneath - strictly behind top card) */}
        {nextCharacter && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.cardWrapper,
              styles.nextCardBehind,
              {
                transform: [{ scale: nextScale }],
                opacity: nextOpacity,
              },
            ]}
          >
            {/* Solid opaque background prevents alpha-channel PNGs from bleeding through */}
            <View style={styles.cardSolidBackdrop} />
            <Image
              key={`next-img-${nextCharacter.id || nextCharacter.characterId || 'next'}`}
              source={{ uri: nextAvatarUri }}
              style={styles.cardCover}
              resizeMode="cover"
              {...(Platform.OS === 'web' ? { draggable: false } : {})}
            />
            {/* Progressive Blur / Gradient Scrim */}
            <LinearGradient
              colors={['transparent', 'rgba(10, 12, 18, 0.65)', 'rgba(10, 12, 18, 0.94)']}
              locations={[0, 0.45, 1]}
              style={styles.deckGradientScrim}
              pointerEvents="none"
            />
            <View style={styles.bottomOverlay}>
              <Text style={styles.charName} numberOfLines={1}>
                {nextCharacter.name}
              </Text>
              <Text style={styles.charCreator}>by @{nextCharacter.creatorName || 'community'}</Text>
            </View>
          </Animated.View>
        )}

        {/* Current Active Top Card (Interactive Swipeable with zIndex: 10) */}
        <Animated.View
          key={`top-${charId}`}
          {...panResponder.panHandlers}
          style={[
            styles.cardWrapper,
            styles.topCard,
            {
              transform: [
                { translateX: position.x },
                { translateY: position.y },
                { rotate },
              ],
            },
          ]}
        >
          {/* Solid opaque black backdrop ensures NO card underneath ever shines through */}
          <View style={styles.cardSolidBackdrop} />
          <Image
            key={`img-${charId}`}
            source={{ uri: avatarUri }}
            style={styles.cardCover}
            resizeMode="cover"
            onError={() => {
              setFailedImageIds(prev => new Set([...prev, charId]));
            }}
            {...(Platform.OS === 'web' ? { draggable: false } : {})}
          />

          {/* Dynamic LIKE & PASS Stamp Overlays */}
          <Animated.View style={[styles.stampLike, { opacity: likeOpacity }]}>
            <Flame size={20} color={palette.accent} style={{ marginRight: 4 }} />
            <Text style={styles.stampLikeText}>MATCH 🔥</Text>
          </Animated.View>

          <Animated.View style={[styles.stampNope, { opacity: nopeOpacity }]}>
            <Text style={styles.stampNopeText}>PASS ✕</Text>
          </Animated.View>

          {/* Algorithmic Affinity Ribbon (Top Left) */}
          <View style={styles.matchScoreRibbon}>
            <Flame size={13} color={palette.accent} style={{ marginRight: 4 }} />
            <Text style={styles.matchScoreText}>{affinity}% Match</Text>
            <Text style={styles.matchReasonText}>• {reason}</Text>
          </View>

          {/* Rating Badge (Top Right) */}
          <View style={styles.ratingBadge}>
            <Text style={[styles.ratingBadgeText, isNsfw && styles.ratingNsfw]}>
              {isNsfw ? 'NSFW 18+' : 'SFW'}
            </Text>
          </View>

          {/* Right-Handed Thumb Action Dock */}
          <View style={styles.rightActionDock}>
            {history.length > 0 && (
              <TouchableOpacity style={styles.dockBtnRewind} onPress={handleRewind} activeOpacity={0.8}>
                <RotateCcw size={18} color="#9ca3af" />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.dockBtnPass} onPress={handlePass} activeOpacity={0.8}>
              <X size={22} color="#ef4444" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dockBtnStar}
              onPress={() => onToggleFavorite(currentCharacter)}
              activeOpacity={0.8}
            >
              <Star
                size={20}
                color={isFav ? '#f59e0b' : '#FFFFFF'}
                fill={isFav ? '#f59e0b' : 'transparent'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dockBtnInfo}
              onPress={() => setInfoModalVisible(true)}
              activeOpacity={0.8}
            >
              <Info size={19} color={palette.accent} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.dockBtnMatch} onPress={handleMatch} activeOpacity={0.8}>
              <Flame size={24} color={palette.bgDark} fill={palette.bgDark} />
            </TouchableOpacity>
          </View>

          {/* Progressive Blur / Gradient Scrim */}
          <LinearGradient
            colors={['transparent', 'rgba(10, 12, 18, 0.65)', 'rgba(10, 12, 18, 0.94)']}
            locations={[0, 0.45, 1]}
            style={styles.deckGradientScrim}
            pointerEvents="none"
          />

          {/* Bottom Card Info Overlay */}
          <TouchableOpacity
            style={styles.bottomOverlay}
            activeOpacity={0.9}
            onPress={() => setInfoModalVisible(true)}
          >
            <View style={styles.nameRow}>
              <Text style={styles.charName} numberOfLines={1}>
                {currentCharacter.name}
              </Text>
            </View>

            <Text style={styles.charCreator}>by @{creator}</Text>

            {/* Engagement Stats Strip */}
            <View style={styles.statsStrip}>
              {Boolean(currentCharacter.chatCount) && (
                <View style={styles.statPill}>
                  <MessageCircle size={11} color={palette.accent} style={{ marginRight: 4 }} />
                  <Text style={styles.statPillText}>
                    {Number(currentCharacter.chatCount).toLocaleString()}
                  </Text>
                </View>
              )}
              {Boolean(currentCharacter.totalTokens) && (
                <View style={styles.statPill}>
                  <Sparkles size={11} color="#60a5fa" style={{ marginRight: 4 }} />
                  <Text style={styles.statPillText}>
                    {Number(currentCharacter.totalTokens).toLocaleString()} tok
                  </Text>
                </View>
              )}
            </View>

            {/* Bio Clamp */}
            <Text style={styles.charBio} numberOfLines={2}>
              {bio}
            </Text>

            {/* Tag Pills */}
            <View style={styles.chipsRow}>
              {tagsList.slice(0, 3).map((tag, i) => (
                <View key={i} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>#{tag}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* ── Character Inspect Detail Modal (Outside Click Auto-Closes) ── */}
      <Modal visible={infoModalVisible} transparent animationType="slide" onRequestClose={() => setInfoModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setInfoModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.inspectCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={styles.inspectHeader}>
              <Text style={styles.inspectTitle} numberOfLines={1}>
                {currentCharacter.name}
              </Text>
              <TouchableOpacity
                style={styles.inspectCloseBtn}
                onPress={() => setInfoModalVisible(false)}
              >
                <X size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.inspectScroll} showsVerticalScrollIndicator={false}>
              <Image source={{ uri: avatarUri }} style={styles.inspectHeroImg} resizeMode="cover" />

              <View style={styles.inspectSection}>
                <Text style={styles.inspectSectionLabel}>CREATOR</Text>
                <Text style={styles.inspectCreatorText}>@{creator}</Text>
              </View>

              <View style={styles.inspectSection}>
                <Text style={styles.inspectSectionLabel}>PERSONA & STORY</Text>
                <Text style={styles.inspectBodyText}>{bio || 'No public description available.'}</Text>
              </View>

              {Boolean(currentCharacter.firstMessage) && (
                <View style={styles.inspectSection}>
                  <Text style={styles.inspectSectionLabel}>OPENING MESSAGE</Text>
                  <View style={styles.openingMessageBox}>
                    <Text style={styles.openingMessageText}>
                      {currentCharacter.firstMessage}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.inspectSection}>
                <Text style={styles.inspectSectionLabel}>TAGS</Text>
                <View style={styles.chipsRow}>
                  {tagsList.map((tag, i) => (
                    <View key={i} style={styles.tagChip}>
                      <Text style={styles.tagChipText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.inspectFooter}>
              <TouchableOpacity
                style={styles.inspectStartBtn}
                onPress={() => {
                  setInfoModalVisible(false);
                  handleMatch();
                }}
              >
                <Flame size={18} color={palette.bgDark} fill={palette.bgDark} style={{ marginRight: 6 }} />
                <Text style={styles.inspectStartBtnText}>Match & Start Roleplay</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Filter Pop-up Modal (Outside Click Auto-Closes) ── */}
      <Modal visible={filterModalVisible} transparent animationType="fade" onRequestClose={() => setFilterModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.filterCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={styles.filterHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Flame size={16} color={palette.accent} style={{ marginRight: 6 }} />
                <Text style={styles.filterTitle}>Match Mode Filters</Text>
              </View>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <X size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterSectionLabel}>Filter By Anime Archetype / Genre (Multi-Select)</Text>
            <View style={styles.filterTagsRow}>
              {filterTags.map((t, idx) => {
                const isSelected = selectedTags.includes(t);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.filterTagChip, isSelected && styles.filterTagChipActive]}
                    onPress={() => handleToggleFilter(t)}
                  >
                    {isSelected && <Check size={12} color={palette.bgDark} style={{ marginRight: 4 }} />}
                    <Text style={[styles.filterTagText, isSelected && styles.filterTagTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bgDark,
  },
  deckToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  deckToolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  affinityBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `rgba(${palette.accentRgb}, 0.12)`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.3)`,
  },
  affinityBadgeHeaderText: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  activeTagBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeTagBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  filterTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  filterTriggerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  deckViewport: {
    flex: 1,
    position: 'relative',
    marginHorizontal: 16,
    marginBottom: 80,
  },
  cardWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: palette.bgDark,
    ...(Platform.OS === 'web' ? { userSelect: 'none' as any, cursor: 'grab' as any } : {}),
  },
  cardSolidBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.bgDark,
    zIndex: 0,
  },
  topCard: {
    zIndex: 10,
    elevation: 10,
    backgroundColor: palette.bgDark,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'grab',
          userSelect: 'none',
          touchAction: 'none',
        } as any)
      : {}),
  },
  nextCardBehind: {
    zIndex: 1,
    elevation: 1,
    backgroundColor: palette.bgDark,
  },
  cardCover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    ...(Platform.OS === 'web'
      ? ({
          userSelect: 'none',
          pointerEvents: 'none',
        } as any)
      : {}),
  },
  stampLike: {
    position: 'absolute',
    top: 36,
    left: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4ADE80',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    transform: [{ rotate: '-14deg' }],
    zIndex: 30,
  },
  stampLikeText: {
    color: '#4ADE80',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1,
  },
  stampNope: {
    position: 'absolute',
    top: 36,
    right: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FF6B6B',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    transform: [{ rotate: '14deg' }],
    zIndex: 30,
  },
  stampNopeText: {
    color: '#FF6B6B',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1,
  },
  matchScoreRibbon: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(12, 14, 20, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.35)`,
    zIndex: 25,
  },
  matchScoreText: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: '800',
    marginRight: 4,
  },
  matchReasonText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '500',
  },
  ratingBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 25,
  },
  ratingBadgeText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '700',
  },
  ratingNsfw: {
    color: '#f87171',
  },
  rightActionDock: {
    position: 'absolute',
    right: 14,
    bottom: 26,
    zIndex: 40,
    backgroundColor: 'rgba(12, 14, 24, 0.92)',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    gap: 11,
  },
  dockBtnRewind: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dockBtnPass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dockBtnStar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dockBtnInfo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(147, 197, 253, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dockBtnMatch: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: palette.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  deckGradientScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
    zIndex: 15,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'linear-gradient(to bottom, rgba(10, 12, 18, 0) 0%, rgba(10, 12, 18, 0.65) 50%, rgba(10, 12, 18, 0.94) 100%)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        } as any)
      : {}),
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingRight: 74,
    backgroundColor: 'rgba(10, 12, 18, 0.94)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 20,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        } as any)
      : {}),
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  charName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
  },
  charCreator: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 6,
  },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statPillText: {
    color: '#E5E7EB',
    fontSize: 10,
    fontWeight: '600',
  },
  charBio: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
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
  pulseRadar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `rgba(${palette.accentRgb}, 0.12)`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.35)`,
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
    textAlign: 'center',
  },
  emptyDesc: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 320,
  },
  emptyBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  resetBtnText: {
    color: palette.bgDark,
    fontSize: 13,
    fontWeight: '800',
  },
  backCatalogBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backCatalogBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  filterCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: palette.bgSurface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
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
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  filterTagText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  filterTagTextActive: {
    color: palette.bgDark,
    fontWeight: '800',
  },
  inspectCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    backgroundColor: palette.bgSurface,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  inspectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  inspectTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  inspectCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  inspectScroll: {
    padding: 18,
  },
  inspectHeroImg: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    marginBottom: 16,
  },
  inspectSection: {
    marginBottom: 16,
  },
  inspectSectionLabel: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  inspectCreatorText: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  inspectBodyText: {
    color: '#E5E7EB',
    fontSize: 13,
    lineHeight: 19,
  },
  openingMessageBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: palette.accent,
  },
  openingMessageText: {
    color: '#E5E7EB',
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  inspectFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  inspectStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
    paddingVertical: 12,
    borderRadius: 16,
  },
  inspectStartBtnText: {
    color: palette.bgDark,
    fontSize: 14,
    fontWeight: '800',
  },
});
