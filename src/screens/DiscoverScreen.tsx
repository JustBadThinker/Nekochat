/**
 * DiscoverScreen.tsx
 * Bento-OLED Redesign for NekoChat (Pure React Native)
 * Features:
 * 1. Top Switcher: [ 🗂️ Catalog Grid ] | [ 🔥 Match Mode ]
 * 2. 18 Canonical Community Tags with Filter Drawer & Expand
 * 3. 2-Column Bento Grid with NekoChat Acid Lime (#d4ff00) Identity
 * 4. True Infinite Scroll Engine (auto-loads more cards on reach bottom)
 * 5. Community Character Modal & Tinder-Style Match Deck
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  Check,
  Sparkles,
  Download,
  Heart,
  Compass,
  Bookmark,
  RefreshCw,
  Globe,
  Eye,
  EyeOff,
  Users,
  CheckCircle2,
  Flame,
  LayoutGrid,
  Menu,
  Bell,
} from 'lucide-react-native';
import { Character, CommunityCharacter, CommunityCharacterDetail, Persona } from '../types';
import { CommunityCharacterCard } from '../components/CommunityCharacterCard';
import { CommunityCharacterModal } from '../components/CommunityCharacterModal';
import { CreatorProfileModal } from '../components/CreatorProfileModal';
import { TagFilterDrawerModal } from '../components/TagFilterDrawerModal';
import { TinderDeck } from '../components/TinderDeck';
import { NekoPulseLoader } from '../components/NekoPulseLoader';
import {
  communityCatalogService,
  POPULAR_COMMUNITY_CATEGORIES,
} from '../services/communityCatalogService';
import { storageService } from '../services/storageService';
import { GLASS } from '../theme/glassTheme';

interface DiscoverScreenProps {
  characters: Character[];
  activePersona?: Persona;
  onStartChat: (character: any, detail?: CommunityCharacterDetail) => void;
  onToggleFavorite?: (character: any) => void;
  onImportCard?: (character: any) => void;
  onMatchModeChange?: (isMatchMode: boolean) => void;
}

type TopMode = 'catalog' | 'match';
type DiscoverTab = 'community' | 'library';
type EntityMode = 'characters' | 'creators';
type ScopeMode = 'all' | 'following' | 'favorites';
type CatalogSort = 'latest' | 'trending' | 'popular';
type CatalogSource = 'janitor' | 'chub';

export const DiscoverScreen: React.FC<DiscoverScreenProps> = ({
  characters,
  activePersona,
  onStartChat,
  onToggleFavorite,
  onImportCard,
  onMatchModeChange,
}) => {
  // Top Primary Switcher: Catalog Grid vs Match Mode
  const [topMode, setTopMode] = useState<TopMode>('catalog');

  useEffect(() => {
    onMatchModeChange?.(topMode === 'match');
  }, [topMode, onMatchModeChange]);

  // Sub-tabs in Catalog Grid
  const [activeTab, setActiveTab] = useState<DiscoverTab>('community');
  const [catalogSource, setCatalogSource] = useState<CatalogSource>('janitor');

  // Community Catalog State — 100% Real Live Data (Starts empty)
  const [communityCharacters, setCommunityCharacters] = useState<CommunityCharacter[]>([]);
  const [communityTotalCount, setCommunityTotalCount] = useState<number>(0);
  const [communityLoading, setCommunityLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [communityError, setCommunityError] = useState<string | null>(null);

  // Segmented Controls State
  const [entityMode, setEntityMode] = useState<EntityMode>('characters');
  const [sfwOnly, setSfwOnly] = useState<boolean>(false);
  const [scopeMode, setScopeMode] = useState<ScopeMode>('all');
  const [communitySort, setCommunitySort] = useState<CatalogSort>('trending');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [tagsExpanded, setTagsExpanded] = useState<boolean>(false);

  // Search & Filter State
  const [communitySearchInput, setCommunitySearchInput] = useState<string>('');
  const [communitySearch, setCommunitySearch] = useState<string>('');
  const [selectedCategoryValues, setSelectedCategoryValues] = useState<string[]>(['all']);

  // Modals & Drawers
  const [isTagDrawerOpen, setIsTagDrawerOpen] = useState<boolean>(false);
  const [selectedCommunityChar, setSelectedCommunityChar] = useState<CommunityCharacter | null>(null);
  const [selectedCreator, setSelectedCreator] = useState<{
    name: string;
    id?: string;
    avatarUrl?: string;
  } | null>(null);
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState<boolean>(false);
  const [scopeMenuPos, setScopeMenuPos] = useState<{ top: number; left: number }>({ top: 220, left: 12 });
  const scopeBtnRef = useRef<any>(null);

  // Social State
  const [followedCreators, setFollowedCreators] = useState<string[]>([]);
  const [followingCharacters, setFollowingCharacters] = useState<CommunityCharacter[]>([]);
  const [followingLoading, setFollowingLoading] = useState<boolean>(false);
  const [favoriteCharacters, setFavoriteCharacters] = useState<CommunityCharacter[]>([]);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sticky Search on Scroll State
  const [isStickySearch, setIsStickySearch] = useState<boolean>(false);
  const lastScrollY = useRef<number>(0);
  const [headerExpandAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.timing(headerExpandAnim, {
      toValue: isStickySearch ? 0 : 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [isStickySearch, headerExpandAnim]);

  const handleCatalogScroll = (event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;

    if (currentY > 80 && diff > 10) {
      if (!isStickySearch) setIsStickySearch(true);
    } else if (diff < -10 || currentY <= 24) {
      if (isStickySearch) setIsStickySearch(false);
    }
    lastScrollY.current = currentY;
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    loadSocialData();
  }, []);

  const loadSocialData = async () => {
    try {
      const follows = await storageService.getFollowedCreators();
      setFollowedCreators(follows);
      const favs = await storageService.getCommunityFavorites();
      setFavoriteCharacters(favs as any);
    } catch {}
  };

  // Fetch live characters for all followed creators when "Following" scope is active
  useEffect(() => {
    if (activeTab !== 'community' || scopeMode !== 'following') return;
    if (followedCreators.length === 0) {
      setFollowingCharacters([]);
      setFollowingLoading(false);
      return;
    }

    let cancelled = false;
    setFollowingLoading(true);

    (async () => {
      try {
        const results = await Promise.all(
          followedCreators.map(handle =>
            communityCatalogService
              .fetchCreatorCharacters(handle, {
                source: catalogSource,
                limit: 24,
                sort: communitySort,
                sfwOnly,
              })
              .catch(() => ({ characters: [] as CommunityCharacter[] }))
          )
        );
        if (cancelled) return;

        const seen = new Set<string>();
        const merged: CommunityCharacter[] = [];
        for (const res of results) {
          for (const char of res.characters || []) {
            if (!seen.has(char.id)) {
              seen.add(char.id);
              merged.push(char);
            }
          }
        }
        // Also include any matching characters already in communityCharacters
        for (const char of communityCharacters) {
          const handle = (char.creatorName || '').replace(/^@+/, '').toLowerCase();
          if (
            followedCreators.some(f => f.replace(/^@+/, '').toLowerCase() === handle) &&
            !seen.has(char.id)
          ) {
            seen.add(char.id);
            merged.push(char);
          }
        }

        setFollowingCharacters(merged);
      } finally {
        if (!cancelled) setFollowingLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, scopeMode, followedCreators, catalogSource, communitySort, sfwOnly]);

  // Initial Fetch on filter changes
  useEffect(() => {
    if (activeTab === 'community') {
      setCurrentPage(1);
      fetchCharactersInitial(1);
    }
  }, [communitySearch, selectedCategoryValues, communitySort, catalogSource, sfwOnly, activeTab]);

  const fetchCharactersInitial = async (page = 1) => {
    setCommunityLoading(true);
    setCommunityError(null);
    try {
      if (catalogSource === 'janitor') {
        const activeCats = POPULAR_COMMUNITY_CATEGORIES.filter(c => selectedCategoryValues.includes(c.value) && c.tagId);
        const tagIds = activeCats.map(c => c.tagId).join(',');
        const res = await communityCatalogService.fetchDatacatCharacters({
          search: communitySearch,
          tagIds: tagIds || undefined,
          page,
          limit: 12,
          sort: communitySort,
          sfwOnly,
        });
        setCommunityCharacters(res.characters);
        setCommunityTotalCount(res.totalCount);
        if (res.error) setCommunityError(res.error);
      } else {
        const activeTags = selectedCategoryValues.filter(c => c !== 'all');
        const activeTag = activeTags.length > 0 ? activeTags.join(',') : undefined;
        const res = await communityCatalogService.fetchChubCharacters({
          search: communitySearch,
          tag: activeTag,
          page,
          limit: 12,
          sort: communitySort,
          sfwOnly,
        });
        setCommunityCharacters(res.characters);
        setCommunityTotalCount(res.totalCount);
        if (res.error) setCommunityError(res.error);
      }
    } catch (err: any) {
      setCommunityCharacters([]);
      setCommunityError(err?.message || 'Failed to fetch catalog feed');
    } finally {
      setCommunityLoading(false);
    }
  };

  // True Infinite Scroll Handler (Triggered on End Reached)
  const handleLoadMore = async () => {
    if (communityLoading || isLoadingMore || scopeMode === 'favorites' || scopeMode === 'following') return;
    setIsLoadingMore(true);
    const nextPage = currentPage + 1;
    try {
      let newChars: CommunityCharacter[] = [];
      if (catalogSource === 'janitor') {
        const activeCats = POPULAR_COMMUNITY_CATEGORIES.filter(c => selectedCategoryValues.includes(c.value) && c.tagId);
        const tagIds = activeCats.map(c => c.tagId).join(',');
        const res = await communityCatalogService.fetchDatacatCharacters({
          search: communitySearch,
          tagIds: tagIds || undefined,
          page: nextPage,
          limit: 12,
          sort: communitySort,
          sfwOnly,
        });
        newChars = res.characters;
      } else {
        const activeTags = selectedCategoryValues.filter(c => c !== 'all');
        const activeTag = activeTags.length > 0 ? activeTags.join(',') : undefined;
        const res = await communityCatalogService.fetchChubCharacters({
          search: communitySearch,
          tag: activeTag,
          page: nextPage,
          limit: 12,
          sort: communitySort,
          sfwOnly,
        });
        newChars = res.characters;
      }

      if (newChars.length > 0) {
        setCommunityCharacters(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const uniqueNew = newChars.filter(c => !existingIds.has(c.id));
          return [...prev, ...uniqueNew];
        });
        setCurrentPage(nextPage);
      }
    } catch {} finally {
      setIsLoadingMore(false);
    }
  };

  const handleToggleCategory = (val: string) => {
    if (val === 'all') {
      setSelectedCategoryValues(['all']);
      return;
    }
    setSelectedCategoryValues(prev => {
      const withoutAll = prev.filter(c => c !== 'all');
      if (withoutAll.includes(val)) {
        const next = withoutAll.filter(c => c !== val);
        return next.length === 0 ? ['all'] : next;
      } else {
        return [...withoutAll, val];
      }
    });
  };

  const handleSearchSubmit = () => {
    setCommunitySearch(communitySearchInput.trim());
  };

  const handleToggleFollowCreator = async (creatorName: string) => {
    const next = await storageService.toggleFollowCreator(creatorName);
    loadSocialData();
    showToast(next ? `👤 Now following @${creatorName}` : `Unfollowed @${creatorName}`);
  };

  const handleToggleCommunityFavorite = async (char: CommunityCharacter, knownState?: boolean) => {
    let next: boolean;
    if (typeof knownState === 'boolean') {
      next = knownState;
    } else {
      next = await storageService.toggleCommunityFavorite(char as any);
    }
    loadSocialData();
    showToast(next ? `❤️ Added ${char.name} to Favorites` : `Removed from Favorites`);
  };

  // Creator Profiles Aggregator (100% Genuine Catalog Data — Zero Mock Stock Photos)
  const creatorProfiles = useMemo(() => {
    const map = new Map<
      string,
      {
        creatorName: string;
        avatarUrl: string;
        botCount: number;
        sampleBots: string[];
      }
    >();

    for (const c of communityCharacters) {
      const key = (c.creatorName || 'Community Creator').toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.botCount += 1;
        if (existing.sampleBots.length < 3 && !existing.sampleBots.includes(c.name)) {
          existing.sampleBots.push(c.name);
        }
      } else {
        map.set(key, {
          creatorName: c.creatorName || 'Community Creator',
          avatarUrl: c.avatarUrl || '',
          botCount: 1,
          sampleBots: [c.name],
        });
      }
    }

    // Ensure followed creators exist with verified data or clean empty state
    for (const fc of followedCreators) {
      const key = fc.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          creatorName: fc,
          avatarUrl: '',
          botCount: 0,
          sampleBots: [],
        });
      }
    }

    return Array.from(map.values());
  }, [communityCharacters, followedCreators]);

  const displayedCharacters = useMemo(() => {
    // 1. My Library Tab: show saved & created characters from user's active library
    if (activeTab === 'library') {
      let libChars: CommunityCharacter[] = characters.map((c, idx) => ({
        id: c.id,
        characterId: c.id,
        name: c.name,
        chatName: c.name,
        creatorName: c.creator || 'My Library',
        avatarUrl: c.avatar,
        shortDescription: c.description || c.personality || 'My saved roleplay companion.',
        isNsfw: c.contentRating === 'NSFW',
        totalTokens: c.totalTokens || 850,
        chatCount: c.chatCount || 0,
        messageCount: 0,
        favoritesCount: c.isFavorite ? 1 : 0,
        tags: (c.tags || []).map((t, i) => ({ id: i, name: t, slug: t.toLowerCase() })),
        createdAt: c.updatedAt,
      }));

      if (communitySearch.trim()) {
        const q = communitySearch.toLowerCase();
        libChars = libChars.filter(
          c =>
            c.name.toLowerCase().includes(q) ||
            c.shortDescription.toLowerCase().includes(q) ||
            (c.creatorName && c.creatorName.toLowerCase().includes(q))
        );
      }
      if (sfwOnly) {
        libChars = libChars.filter(c => !c.isNsfw);
      }
      return libChars;
    }

    // 2. Explore All Tab: show live community catalog
    let list = communityCharacters;
    if (scopeMode === 'favorites') {
      list = favoriteCharacters.length > 0 ? favoriteCharacters : communityCharacters.slice(0, 4);
    } else if (scopeMode === 'following') {
      if (followedCreators.length === 0) {
        list = [];
      } else {
        const sourceList = followingCharacters.length > 0 ? followingCharacters : communityCharacters;
        list = sourceList.filter(c => {
          const handle = (c.creatorName || '').replace(/^@+/, '').toLowerCase();
          return followedCreators.some(f => f.replace(/^@+/, '').toLowerCase() === handle);
        });
        const q = communitySearch.trim().toLowerCase();
        if (q) {
          list = list.filter(
            c =>
              c.name.toLowerCase().includes(q) ||
              c.shortDescription.toLowerCase().includes(q) ||
              (c.creatorName && c.creatorName.toLowerCase().includes(q))
          );
        }
      }
    }

    // Client-side Limited Only (SFW) Filter guarantee
    if (sfwOnly) {
      list = list.filter(c => !c.isNsfw);
    }
    return list;
  }, [
    communityCharacters,
    followingCharacters,
    scopeMode,
    favoriteCharacters,
    followedCreators,
    activeTab,
    characters,
    communitySearch,
    sfwOnly,
  ]);

  return (
    <View style={styles.container}>
      {/* ── Toast Notification ── */}
      {toastMessage && (
        <View style={styles.toastBox}>
          <Sparkles size={14} color="#d4ff00" style={{ marginRight: 6 }} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 1. TOP PRIMARY SWITCHER: [ 🗂️ Catalog Grid ] | [ 🔥 Match Mode ]  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Animated.View
        pointerEvents={isStickySearch ? 'none' : 'auto'}
        style={{
          maxHeight: headerExpandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 62] }),
          opacity: headerExpandAnim,
          transform: [{ translateY: headerExpandAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
          overflow: 'hidden',
        }}
      >
        <View style={styles.topPrimaryBar}>
          <View style={styles.topPrimaryPill}>
            <TouchableOpacity
              style={[styles.topPrimaryBtn, topMode === 'catalog' && styles.topPrimaryBtnActive]}
              onPress={() => setTopMode('catalog')}
              activeOpacity={0.8}
            >
              <LayoutGrid size={13} color={topMode === 'catalog' ? '#000000' : '#FFFFFF'} style={{ marginRight: 5 }} />
              <Text style={[styles.topPrimaryBtnText, topMode === 'catalog' && styles.topPrimaryBtnTextActive]}>
                Catalog Grid
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.topPrimaryBtn, (topMode as TopMode) === 'match' && styles.topPrimaryBtnActive]}
              onPress={() => setTopMode('match')}
              activeOpacity={0.8}
            >
              <Flame size={13} color={(topMode as TopMode) === 'match' ? '#000000' : '#d4ff00'} style={{ marginRight: 5 }} />
              <Text style={[styles.topPrimaryBtnText, (topMode as TopMode) === 'match' && styles.topPrimaryBtnTextActive]}>
                Match Mode
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {topMode === 'match' ? (
        <TinderDeck
          characters={communityCharacters.length > 0 ? communityCharacters : (characters as any)}
          activePersona={activePersona}
          onBack={() => setTopMode('catalog')}
          onMatchChat={onStartChat}
          onToggleFavorite={handleToggleCommunityFavorite}
          favoriteIds={new Set(favoriteCharacters.map(f => f.id))}
        />
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* 2. SUB-HEADER TOOLBAR: Explore All vs My Library & Sources         */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <Animated.View
            pointerEvents={isStickySearch ? 'none' : 'auto'}
            style={{
              maxHeight: headerExpandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 60] }),
              opacity: headerExpandAnim,
              transform: [{ translateY: headerExpandAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
              overflow: 'hidden',
            }}
          >
            <View style={styles.subHeader}>
              {/* Left: Explore vs Library */}
              <View style={styles.viewSwitcher}>
                <TouchableOpacity
                  style={[styles.viewTabBtn, activeTab === 'community' && styles.viewTabBtnActive]}
                  onPress={() => setActiveTab('community')}
                  activeOpacity={0.8}
                >
                  <Compass size={13} color={activeTab === 'community' ? '#000000' : '#FFFFFF'} style={{ marginRight: 5 }} />
                  <Text style={[styles.viewTabBtnText, activeTab === 'community' && styles.viewTabBtnTextActive]}>
                    Explore All
                  </Text>
                  <View style={styles.greenPulseDot} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.viewTabBtn, activeTab === 'library' && styles.viewTabBtnActive]}
                  onPress={() => setActiveTab('library')}
                  activeOpacity={0.8}
                >
                  <Bookmark size={13} color={activeTab === 'library' ? '#000000' : '#9ca3af'} style={{ marginRight: 5 }} />
                  <Text style={[styles.viewTabBtnText, activeTab === 'library' ? styles.viewTabBtnTextActive : { color: '#9ca3af' }]}>
                    My Library
                  </Text>
                  <View style={styles.libraryCountPill}>
                    <Text style={styles.libraryCountText}>{characters.length}</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Right: JanitorAI | Chub.ai toggle & Actions */}
              <View style={styles.subHeaderRight}>
                {activeTab === 'community' && (
                  <>
                    <View style={styles.sourcePillSwitch}>
                      <TouchableOpacity
                        style={[styles.sourcePillBtn, catalogSource === 'janitor' && styles.sourcePillBtnActive]}
                        onPress={() => {
                          setCatalogSource('janitor');
                          setCurrentPage(1);
                        }}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.sourcePillText,
                            catalogSource === 'janitor' && styles.sourcePillTextActive,
                          ]}
                        >
                          JanitorAI
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.sourcePillBtn, catalogSource === 'chub' && styles.sourcePillBtnActive]}
                        onPress={() => {
                          setCatalogSource('chub');
                          setCurrentPage(1);
                        }}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.sourcePillText,
                            catalogSource === 'chub' && styles.sourcePillTextActive,
                          ]}
                        >
                          Chub.ai
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => fetchCharactersInitial(1)}
                      activeOpacity={0.7}
                      accessibilityLabel="Refresh Catalog Feed"
                    >
                      <RefreshCw size={13} color="#9ca3af" />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </Animated.View>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 3. SEARCH BAR (Sticky when scrolling down)                         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <View style={[styles.searchContainer, isStickySearch && styles.searchContainerSticky]}>
        <View style={[styles.searchBarWrapper, isStickySearch && { flex: 1 }]}>
          <Search size={15} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search anime companions, tags, tropes (@creator)..."
            placeholderTextColor="#6b7280"
            value={communitySearchInput}
            onChangeText={setCommunitySearchInput}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
          {communitySearchInput ? (
            <TouchableOpacity
              onPress={() => {
                setCommunitySearchInput('');
                setCommunitySearch('');
                setCurrentPage(1);
              }}
              style={styles.clearBtn}
            >
              <X size={14} color="#9ca3af" />
            </TouchableOpacity>
          ) : (
            <View style={styles.enterBadge}>
              <Text style={styles.enterBadgeText}>Enter</Text>
            </View>
          )}
        </View>

        {isStickySearch && (
          <TouchableOpacity
            style={styles.stickyFilterToggleBtn}
            onPress={() => setIsStickySearch(false)}
            activeOpacity={0.8}
            accessibilityLabel="Expand filters"
          >
            <SlidersHorizontal size={14} color="#d4ff00" />
            <Text style={styles.stickyFilterToggleText}>Filters</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 4. 18 CANONICAL TAG STRIP + DRAWER [🎛️] & EXPAND [⌵]               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Animated.View
        pointerEvents={isStickySearch ? 'none' : 'auto'}
        style={{
          maxHeight: headerExpandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 320] }),
          opacity: headerExpandAnim,
          transform: [{ translateY: headerExpandAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
          overflow: 'hidden',
        }}
      >
          <View style={styles.tagStripContainer}>
        <TouchableOpacity
          style={styles.tagDrawerBtn}
          onPress={() => setIsTagDrawerOpen(true)}
          activeOpacity={0.7}
          accessibilityLabel="Filter Drawer"
        >
          <SlidersHorizontal size={14} color="#d4ff00" />
        </TouchableOpacity>

        <ScrollView
          horizontal={!tagsExpanded}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.tagStripScroll, tagsExpanded && styles.tagStripWrapped]}
        >
          {POPULAR_COMMUNITY_CATEGORIES.map((chip, idx) => {
            const isSelected = selectedCategoryValues.includes(chip.value);
            return (
              <TouchableOpacity
                key={chip.value}
                style={[
                  styles.communityTagChip,
                  isSelected && styles.communityTagChipActive,
                ]}
                onPress={() => handleToggleCategory(chip.value)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.communityTagText,
                    isSelected && styles.communityTagTextActive,
                  ]}
                >
                  {chip.value === 'all' ? 'All Tags' : `#${chip.value}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={styles.expandChevronBtn}
          onPress={() => setTagsExpanded(prev => !prev)}
          activeOpacity={0.7}
        >
          <ChevronDown
            size={15}
            color="#9ca3af"
            style={{ transform: [{ rotate: tagsExpanded ? '180deg' : '0deg' }] }}
          />
        </TouchableOpacity>
      </View>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 5. SEGMENTED FILTER PILLS (Characters | Creators & All | Limited) */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <View style={styles.filterPillsRow}>
        <View style={styles.pillGroup}>
          <TouchableOpacity
            style={[styles.pillSegment, entityMode === 'characters' && styles.pillSegmentActive]}
            onPress={() => setEntityMode('characters')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.pillSegmentText,
                entityMode === 'characters' && styles.pillSegmentTextActive,
              ]}
            >
              Characters
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pillSegment, entityMode === 'creators' && styles.pillSegmentActive]}
            onPress={() => setEntityMode('creators')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.pillSegmentText,
                entityMode === 'creators' && styles.pillSegmentTextActive,
              ]}
            >
              Creators
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.pillGroup}>
          <TouchableOpacity
            style={[styles.pillSegment, !sfwOnly && styles.pillSegmentActive]}
            onPress={() => setSfwOnly(false)}
            activeOpacity={0.8}
          >
            <Eye size={12} color={!sfwOnly ? '#000000' : '#9ca3af'} style={{ marginRight: 4 }} />
            <Text numberOfLines={1} style={[styles.pillSegmentText, !sfwOnly && styles.pillSegmentTextActive]}>
              NSFW
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pillSegment, sfwOnly && styles.pillSegmentActive]}
            onPress={() => setSfwOnly(true)}
            activeOpacity={0.8}
          >
            <EyeOff size={12} color={sfwOnly ? '#000000' : '#9ca3af'} style={{ marginRight: 4 }} />
            <Text numberOfLines={1} style={[styles.pillSegmentText, sfwOnly && styles.pillSegmentTextActive]}>
              SFW
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sort Bar: Trending | Popular | Latest */}
      <View style={styles.scopeRow}>
        <View style={styles.pillGroupFull}>
          {(['trending', 'popular', 'latest'] as CatalogSort[]).map(s => {
            const isActive = communitySort === s;
            const label = s === 'trending' ? '🔥 Trending' : s === 'popular' ? '❤️ Popular' : '✨ Latest';
            return (
              <TouchableOpacity
                key={s}
                style={[styles.pillSegment, isActive && styles.pillSegmentActive]}
                onPress={() => setCommunitySort(s)}
                activeOpacity={0.8}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.pillSegmentText, isActive && styles.pillSegmentTextActive]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Scope Dropdown (All | Following | Favorites) & Count Row */}
      <View style={styles.sortCountRow}>
        <TouchableOpacity
          ref={scopeBtnRef}
          style={[styles.sortDropdownBtn, scopeDropdownOpen && styles.sortDropdownBtnActive]}
          onPress={() => {
            scopeBtnRef.current?.measureInWindow?.((x: number, y: number, _w: number, h: number) => {
              if (typeof x === 'number' && typeof y === 'number') {
                setScopeMenuPos({ top: y + h + 6, left: Math.max(12, x) });
              }
            });
            setScopeDropdownOpen(prev => !prev);
          }}
          activeOpacity={0.8}
        >
          {scopeMode === 'all' ? (
            <Globe size={12} color="#d4ff00" style={{ marginRight: 5 }} />
          ) : scopeMode === 'following' ? (
            <Users size={12} color="#d4ff00" style={{ marginRight: 5 }} />
          ) : (
            <Heart size={12} color="#d4ff00" style={{ marginRight: 5 }} />
          )}
          <Text style={styles.sortDropdownText}>
            {scopeMode === 'all'
              ? 'All'
              : scopeMode === 'following'
              ? `Following${followedCreators.length > 0 ? ` (${followedCreators.length})` : ''}`
              : 'Favorites'}
          </Text>
          <ChevronDown
            size={12}
            color="#d4ff00"
            style={{
              marginLeft: 5,
              transform: [{ rotate: scopeDropdownOpen ? '180deg' : '0deg' }],
            }}
          />
        </TouchableOpacity>

        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>
            {displayedCharacters.length} companions loaded • Infinite Scroll
          </Text>
        </View>
      </View>

      <Modal
        visible={scopeDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setScopeDropdownOpen(false)}
      >
        <TouchableOpacity
          style={styles.scopeDropdownOverlay}
          activeOpacity={1}
          onPress={() => setScopeDropdownOpen(false)}
        >
          <View
            style={[styles.scopeMenuCard, { top: scopeMenuPos.top, left: scopeMenuPos.left }]}
            onStartShouldSetResponder={() => true}
          >
            {([
              { key: 'all' as ScopeMode, label: 'All Companions', icon: Globe },
              { key: 'following' as ScopeMode, label: 'Following Creators', icon: Users, count: followedCreators.length },
              { key: 'favorites' as ScopeMode, label: 'Favorites', icon: Heart, count: favoriteCharacters.length },
            ]).map(opt => {
              const Icon = opt.icon;
              const isSelected = scopeMode === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.scopeMenuItem, isSelected && styles.scopeMenuItemActive]}
                  onPress={() => {
                    setScopeMode(opt.key);
                    setScopeDropdownOpen(false);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.scopeMenuIconWrap, isSelected && styles.scopeMenuIconWrapActive]}>
                    <Icon size={13} color={isSelected ? '#000000' : '#d4ff00'} />
                  </View>
                  <Text style={[styles.scopeMenuText, isSelected && styles.scopeMenuTextActive]}>
                    {opt.label}
                  </Text>
                  {typeof opt.count === 'number' && opt.count > 0 && (
                    <View style={[styles.scopeCountBadge, isSelected && styles.scopeCountBadgeActive]}>
                      <Text style={[styles.scopeCountBadgeText, isSelected && styles.scopeCountBadgeTextActive]}>
                        {opt.count}
                      </Text>
                    </View>
                  )}
                  {isSelected && <Check size={13} color="#000000" style={{ marginLeft: 6 }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
      </Animated.View>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 6. MAIN CONTENT: 2-COLUMN BENTO GRID WITH TRUE INFINITE SCROLL     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {(communityLoading || (scopeMode === 'following' && followingLoading && displayedCharacters.length === 0)) ? (
        <View style={styles.loaderBox}>
          <NekoPulseLoader
            size={46}
            label={
              scopeMode === 'following'
                ? 'Loading companions from followed creators...'
                : 'Loading NekoChat companions...'
            }
          />
        </View>
      ) : entityMode === 'creators' ? (
        <ScrollView contentContainerStyle={styles.creatorsList}>
          {creatorProfiles.map(creator => {
            const isFollowing = followedCreators.some(
              f => f.toLowerCase() === creator.creatorName.toLowerCase()
            );
            return (
              <View key={creator.creatorName} style={styles.creatorCard}>
                <View style={styles.creatorCardTop}>
                  {creator.avatarUrl ? (
                    <Image source={{ uri: creator.avatarUrl }} style={styles.creatorAvatar} />
                  ) : (
                    <View style={[styles.creatorAvatar, { alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: '#d4ff00' }}>
                        {creator.creatorName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.creatorInfoCol}>
                    <View style={styles.creatorNameRow}>
                      <Text style={styles.creatorCardName}>@{creator.creatorName}</Text>
                      <CheckCircle2 size={13} color="#d4ff00" style={{ marginLeft: 3 }} />
                    </View>
                    <Text style={styles.creatorBotCount}>{creator.botCount} public companions</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.creatorFollowBtn, isFollowing && styles.creatorFollowBtnActive]}
                    onPress={() => handleToggleFollowCreator(creator.creatorName)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.creatorFollowBtnText,
                        isFollowing && styles.creatorFollowBtnTextActive,
                      ]}
                    >
                      {isFollowing ? 'Following' : '+ Follow'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {creator.sampleBots.length > 0 && (
                  <Text style={styles.creatorSampleText} numberOfLines={1}>
                    Notable bots: <Text style={{ color: '#e2e8f0' }}>{creator.sampleBots.join(', ')}</Text>
                  </Text>
                )}

                <TouchableOpacity
                  style={styles.viewBotsBtn}
                  onPress={() => {
                    setSelectedCreator({
                      name: creator.creatorName,
                      avatarUrl: creator.avatarUrl,
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.viewBotsBtnText}>
                    View Creator Profile & Companions →
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <FlatList
          data={displayedCharacters}
          keyExtractor={item => item.id}
          numColumns={2}
          onScroll={handleCatalogScroll}
          scrollEventThrottle={16}
          columnWrapperStyle={styles.twoColumnWrapper}
          contentContainerStyle={styles.cardsContainer}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => (
            <CommunityCharacterCard
              character={item}
              onSelect={c => setSelectedCommunityChar(c)}
              onStartChat={c => onStartChat(c)}
              onImport={c => {
                onImportCard?.(c);
                showToast(`✨ Imported "${c.name}" into My Library!`);
              }}
              isBookmarked={favoriteCharacters.some(f => f.id === item.id)}
              onToggleBookmark={() => handleToggleCommunityFavorite(item)}
              isFollowingCreator={followedCreators.some(
                f => f.toLowerCase() === (item.creatorName || '').toLowerCase()
              )}
              onToggleFollowCreator={creatorName =>
                handleToggleFollowCreator(creatorName)
              }
              onCreatorClick={cName => {
                setSelectedCreator({
                  name: cName,
                  id: item.creatorId,
                });
              }}
              onTagClick={(tagId, tagName) => {
                const matchedCat = POPULAR_COMMUNITY_CATEGORIES.find(c => c.tagId === tagId);
                if (matchedCat) {
                  handleToggleCategory(matchedCat.value);
                } else {
                  setCommunitySearchInput(tagName);
                  setCommunitySearch(tagName);
                }
              }}
            />
          )}
          ListFooterComponent={
            isLoadingMore && scopeMode === 'all' ? (
              <View style={styles.footerLoader}>
                <NekoPulseLoader size={26} label="Streaming more characters..." />
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            communityError ? (
              <View style={styles.errorContainer}>
                <View style={styles.errorIconCircle}>
                  <Sparkles size={24} color="#f43f5e" />
                </View>
                <Text style={styles.errorTitle}>
                  {catalogSource === 'janitor'
                    ? 'JanitorAI Gateway Offline (Port 3001)'
                    : 'Chub.ai Feed Unavailable'}
                </Text>
                <Text style={styles.errorDesc}>
                  {catalogSource === 'janitor'
                    ? 'Buka terminal baru di folder NekoChat dan jalankan "npm run proxy" untuk mengaktifkan proxy JanitorAI tanpa mock data.'
                    : communityError}
                </Text>
                <View style={styles.errorActionsRow}>
                  <TouchableOpacity
                    style={styles.errorRetryBtn}
                    onPress={() => fetchCharactersInitial(1)}
                    activeOpacity={0.8}
                  >
                    <RefreshCw size={13} color="#000000" style={{ marginRight: 6 }} />
                    <Text style={styles.errorRetryBtnText}>Retry Connection</Text>
                  </TouchableOpacity>

                  {catalogSource === 'janitor' && (
                    <TouchableOpacity
                      style={styles.errorSwitchBtn}
                      onPress={() => {
                        setCatalogSource('chub');
                        setCurrentPage(1);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.errorSwitchBtnText}>Switch to Chub.ai</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Sparkles size={28} color="#9ca3af" style={{ marginBottom: 10 }} />
                <Text style={styles.emptyTitle}>
                  {scopeMode === 'following'
                    ? followedCreators.length === 0
                      ? 'No Followed Creators Yet'
                      : 'No Companions Found'
                    : scopeMode === 'favorites'
                    ? 'No Saved Favorites'
                    : 'No Characters Found'}
                </Text>
                <Text style={styles.emptyDesc}>
                  {scopeMode === 'following'
                    ? followedCreators.length === 0
                      ? 'Tap "+ Follow" on any character card to see companions from your favorite creators here.'
                      : `Following ${followedCreators.map(f => '@' + f.replace(/^@+/, '')).join(', ')}, but no matching public companions were found in ${catalogSource === 'janitor' ? 'JanitorAI' : 'Chub.ai'}.`
                    : scopeMode === 'favorites'
                    ? 'Tap the Bookmark icon on any card to save it here for fast access.'
                    : 'Try adjusting your search terms or selecting another tag.'}
                </Text>
              </View>
            )
          }
        />
      )}
      </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 7. COMMUNITY CHARACTER DETAIL MODAL                                */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <CommunityCharacterModal
        character={selectedCommunityChar}
        visible={Boolean(selectedCommunityChar)}
        onClose={() => setSelectedCommunityChar(null)}
        onStartChat={(char, detail) => {
          setSelectedCommunityChar(null);
          onStartChat(char, detail);
        }}
        onImport={(char, detail) => {
          onImportCard?.(char);
          showToast(`✨ Imported "${char.name}" into My Library!`);
        }}
        onToggleFavorite={handleToggleCommunityFavorite}
        onTagClick={tagName => {
          setSelectedCommunityChar(null);
          setCommunitySearchInput(tagName);
          setCommunitySearch(tagName);
        }}
        onCreatorClick={(creatorName, creatorId) => {
          setSelectedCommunityChar(null);
          setSelectedCreator({ name: creatorName, id: creatorId });
        }}
        onFollowChange={loadSocialData}
      />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 7b. CREATOR PROFILE MODAL                                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <CreatorProfileModal
        visible={Boolean(selectedCreator)}
        creatorName={selectedCreator?.name || null}
        creatorId={selectedCreator?.id}
        initialAvatarUrl={selectedCreator?.avatarUrl}
        catalogSource={catalogSource}
        sfwOnly={sfwOnly}
        onClose={() => setSelectedCreator(null)}
        onSelectCharacter={char => {
          setSelectedCreator(null);
          setSelectedCommunityChar(char);
        }}
        onStartChat={char => {
          setSelectedCreator(null);
          onStartChat(char);
        }}
        onImport={char => {
          onImportCard?.(char);
          showToast(`✨ Imported "${char.name}" into My Library!`);
        }}
        onFollowChange={loadSocialData}
      />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 8. TAG FILTER DRAWER MODAL                                         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <TagFilterDrawerModal
        visible={isTagDrawerOpen}
        onClose={() => setIsTagDrawerOpen(false)}
        selectedTagSlugs={selectedCategoryValues}
        onToggleTag={slug => handleToggleCategory(slug)}
        onClearTags={() => setSelectedCategoryValues(['all'])}
        onApply={() => fetchCharactersInitial(1)}
        matchingCount={communityTotalCount}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  toastBox: {
    position: 'absolute',
    top: 10,
    left: '10%',
    right: '10%',
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 24, 15, 0.96)',
    borderWidth: 1,
    borderColor: '#d4ff00',
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 14,
    shadowColor: '#d4ff00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  toastText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#d4ff00',
  },
  topBrandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 44 : 10,
    paddingBottom: 8,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#121622',
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0f121d',
    borderWidth: 1,
    borderColor: '#1e2436',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  brandTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  brandDotLime: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d4ff00',
    marginLeft: 5,
  },
  brandRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellUnreadDot: {
    position: 'absolute',
    top: 6,
    right: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d4ff00',
  },
  profileAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1b1a2e',
    borderWidth: 1.5,
    borderColor: '#d4ff00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarLetter: {
    fontSize: 13,
    fontWeight: '800',
    color: '#d4ff00',
  },
  topPrimaryBar: {
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#161a26',
    backgroundColor: '#000000',
  },
  topPrimaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f121d',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1e2436',
    padding: 3,
  },
  topPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6.5,
    borderRadius: 18,
  },
  topPrimaryBtnActive: {
    backgroundColor: '#d4ff00',
    shadowColor: '#d4ff00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  topPrimaryBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#9ca3af',
  },
  topPrimaryBtnTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#161a26',
    backgroundColor: '#07090e',
  },
  viewSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f121d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e2436',
    padding: 2.5,
    gap: 4,
  },
  viewTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5.5,
    borderRadius: 8,
  },
  viewTabBtnActive: {
    backgroundColor: '#d4ff00',
  },
  viewTabBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewTabBtnTextActive: {
    color: '#000000',
  },
  greenPulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#000000',
    marginLeft: 4,
  },
  libraryCountPill: {
    backgroundColor: '#1b1e28',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 4,
  },
  libraryCountText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#d1d5db',
  },
  subHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourcePillSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f121d',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e2436',
    padding: 2,
  },
  sourcePillBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  sourcePillBtnActive: {
    backgroundColor: '#d4ff00',
  },
  sourcePillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#9ca3af',
  },
  sourcePillTextActive: {
    color: '#000000',
  },
  iconBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#0f121d',
    borderWidth: 1,
    borderColor: '#1e2436',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 5,
  },
  searchContainerSticky: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    backgroundColor: '#0c0e14',
    borderBottomWidth: 1,
    borderBottomColor: '#161a26',
    zIndex: 20,
  },
  stickyFilterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f121d',
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.35)',
  },
  stickyFilterToggleText: {
    color: '#d4ff00',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS.bgSubtle,
    borderWidth: 1,
    borderColor: GLASS.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 36,
    ...GLASS.backdrop,
  },
  searchIcon: {
    marginRight: 7,
  },
  searchInput: {
    flex: 1,
    fontSize: 11,
    color: '#FFFFFF',
    padding: 0,
  },
  clearBtn: {
    padding: 3,
  },
  enterBadge: {
    backgroundColor: '#161a26',
    borderWidth: 1,
    borderColor: '#22293d',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  enterBadgeText: {
    fontSize: 8.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#9ca3af',
    fontWeight: '700',
  },
  tagStripContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 5,
  },
  tagDrawerBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: GLASS.bgSubtle,
    borderWidth: 1,
    borderColor: GLASS.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...GLASS.backdrop,
  },
  tagStripScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tagStripWrapped: {
    flexWrap: 'wrap',
  },
  communityTagChip: {
    backgroundColor: GLASS.bgSubtle,
    borderWidth: 1,
    borderColor: GLASS.border,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    ...GLASS.backdrop,
  },
  communityTagChipActive: {
    backgroundColor: '#d4ff00',
    borderColor: '#d4ff00',
  },
  communityTagText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#9ca3af',
  },
  communityTagTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  expandChevronBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#0f121d',
    borderWidth: 1,
    borderColor: '#1e2436',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 4,
    gap: 7,
  },
  pillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS.bgSubtle,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS.border,
    padding: 2,
    ...GLASS.backdrop,
  },
  pillGroupFull: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS.bgSubtle,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS.border,
    padding: 2,
    width: '100%',
    justifyContent: 'space-between',
    ...GLASS.backdrop,
  },
  pillSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 11,
    paddingVertical: 4.5,
    borderRadius: 16,
    flex: 1,
  },
  pillSegmentActive: {
    backgroundColor: '#d4ff00',
  },
  pillSegmentText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#9ca3af',
  },
  pillSegmentTextActive: {
    color: '#000000',
  },
  scopeRow: {
    paddingHorizontal: 12,
    paddingTop: 5,
  },
  sortCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sortDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS.bgSubtle,
    borderWidth: 1,
    borderColor: GLASS.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    ...GLASS.backdrop,
  },
  sortDropdownText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  sortDropdownMenu: {
    position: 'absolute',
    top: 215,
    left: 12,
    zIndex: 999,
    backgroundColor: GLASS.bgModal,
    borderWidth: 1,
    borderColor: GLASS.borderBright,
    borderRadius: 10,
    padding: 4,
    ...GLASS.backdropStrong,
    ...GLASS.shadow,
  },
  sortMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  sortMenuItemActive: {
    backgroundColor: '#d4ff00',
  },
  sortMenuItemText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#9ca3af',
  },
  sortMenuItemTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  sortDropdownBtnActive: {
    borderColor: 'rgba(212, 255, 0, 0.55)',
    backgroundColor: 'rgba(212, 255, 0, 0.12)',
  },
  scopeDropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 12, 0.35)',
  },
  scopeMenuCard: {
    position: 'absolute',
    minWidth: 215,
    backgroundColor: GLASS.bgModal,
    borderWidth: 1,
    borderColor: GLASS.borderBright,
    borderRadius: 16,
    padding: 6,
    gap: 4,
    ...GLASS.backdropStrong,
    ...GLASS.shadow,
  },
  scopeMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 11,
  },
  scopeMenuItemActive: {
    backgroundColor: '#d4ff00',
  },
  scopeMenuIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 255, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  scopeMenuIconWrapActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.14)',
  },
  scopeMenuText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  scopeMenuTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  scopeCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  scopeCountBadgeActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
  },
  scopeCountBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#d4ff00',
  },
  scopeCountBadgeTextActive: {
    color: '#000000',
  },
  countBadge: {
    backgroundColor: GLASS.bgSubtle,
    borderWidth: 1,
    borderColor: GLASS.border,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    ...GLASS.backdrop,
  },
  countBadgeText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#9ca3af',
  },
  cardsContainer: {
    paddingHorizontal: 12,
    paddingBottom: 110,
  },
  twoColumnWrapper: {
    justifyContent: 'space-between',
  },
  loaderBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loaderText: {
    fontSize: 11.5,
    color: '#9ca3af',
    marginTop: 10,
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 11,
    color: '#d4ff00',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: '#0f121d',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e2436',
    marginTop: 10,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(244, 63, 94, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
    marginTop: 10,
  },
  errorIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fda4af',
    marginBottom: 6,
    textAlign: 'center',
  },
  errorDesc: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 300,
    marginBottom: 14,
  },
  errorActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d4ff00',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  errorRetryBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  errorSwitchBtn: {
    backgroundColor: '#181c28',
    borderWidth: 1,
    borderColor: '#262c3f',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  errorSwitchBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 280,
  },
  creatorsList: {
    paddingHorizontal: 12,
    paddingBottom: 110,
    gap: 10,
  },
  creatorCard: {
    backgroundColor: GLASS.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS.borderBright,
    padding: 12,
    ...GLASS.backdrop,
    ...GLASS.shadow,
  },
  creatorCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#161a26',
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.3)',
    marginRight: 10,
  },
  creatorInfoCol: {
    flex: 1,
  },
  creatorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  creatorBotCount: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
  creatorFollowBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#161a26',
    borderWidth: 1,
    borderColor: '#22293d',
  },
  creatorFollowBtnActive: {
    backgroundColor: '#d4ff00',
    borderColor: '#d4ff00',
  },
  creatorFollowBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  creatorFollowBtnTextActive: {
    color: '#000000',
  },
  creatorSampleText: {
    fontSize: 10.5,
    color: '#9ca3af',
    marginTop: 8,
  },
  viewBotsBtn: {
    backgroundColor: '#161a26',
    borderRadius: 10,
    paddingVertical: 7,
    alignItems: 'center',
    marginTop: 8,
  },
  viewBotsBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#d4ff00',
  },
});
