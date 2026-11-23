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
  RefreshControl,
  useWindowDimensions,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  Check,
  Sparkles,
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
  MessageCircle,
} from 'lucide-react-native';
import { matchAlgorithmService } from '../services/matchAlgorithmService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView, BlurTargetView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { RichHtmlRenderer } from '../components/RichHtmlRenderer';
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
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../i18n/LanguageContext';
import { ThemePalette } from '../theme/colors';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface DiscoverScreenProps {
  characters: Character[];
  activePersona?: Persona;
  onStartChat: (character: any, detail?: CommunityCharacterDetail) => void;
  onToggleFavorite?: (character: any) => void;
  onImportCard?: (character: any) => void;
  onMatchModeChange?: (isMatchMode: boolean) => void;
  onScrollDirectionChange?: (visible: boolean) => void;
}

type TopMode = 'catalog' | 'foryou' | 'match';
type DiscoverTab = 'community' | 'library';
type EntityMode = 'characters' | 'creators';
type ScopeMode = 'all' | 'following' | 'favorites';
type CatalogSort = 'latest' | 'trending' | 'popular';
type CatalogSource = 'local_db' | 'janitor' | 'chub';

export const DiscoverScreen: React.FC<DiscoverScreenProps> = ({
  characters,
  activePersona,
  onStartChat,
  onToggleFavorite,
  onImportCard,
  onMatchModeChange,
  onScrollDirectionChange,
}) => {
  const { palette, skin } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  // Top Primary Switcher: Catalog Grid / For You / Match Mode
  const [topMode, setTopMode] = useState<TopMode>('catalog');
  const [showCatalogDropdown, setShowCatalogDropdown] = useState(false);
  const [catalogDropdownMounted, setCatalogDropdownMounted] = useState(false);
  const catalogDropdownAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showCatalogDropdown) {
      setCatalogDropdownMounted(true);
      Animated.timing(catalogDropdownAnim, {
        toValue: 1,
        duration: Math.max(180, skin.animation.enterDuration),
        easing: skin.animation.easing,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(catalogDropdownAnim, {
        toValue: 0,
        duration: Math.max(150, Math.round(skin.animation.enterDuration * 0.8)),
        easing: skin.animation.easing,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setCatalogDropdownMounted(false);
      });
    }
  }, [showCatalogDropdown, catalogDropdownAnim, skin.animation.enterDuration, skin.animation.easing]);
  const [catalogScrollMode, setCatalogScrollMode] = useState<'top' | 'compact' | 'floating_mid' | 'floating'>('top');
  const lastCatalogScrollYRef = useRef(0);
  const upwardScrollAccumRef = useRef(0);
  const floatingHeaderAnim = useRef(new Animated.Value(0)).current;
  const midRowAnim = useRef(new Animated.Value(0)).current;
  const fullRowAnim = useRef(new Animated.Value(0)).current;
  const discoverContentRef = useRef<React.ComponentRef<typeof View> | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isRefreshingRef = useRef(false);
  const forYouLoadingMoreRef = useRef(false);

  const handleRefreshCatalog = async () => {
    if (isRefreshingRef.current || communityLoading) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    try {
      await fetchCharactersInitial();
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (catalogScrollMode === 'top') {
      floatingHeaderAnim.setValue(0);
      midRowAnim.setValue(0);
      fullRowAnim.setValue(0);
      return;
    }
    const showMid = catalogScrollMode === 'floating_mid' || catalogScrollMode === 'floating';
    const showFull = catalogScrollMode === 'floating';
    Animated.parallel([
      Animated.timing(floatingHeaderAnim, {
        toValue: 1,
        duration: Math.max(280, skin.animation.enterDuration),
        easing: skin.animation.easing,
        useNativeDriver: true,
      }),
      Animated.timing(midRowAnim, {
        toValue: showMid ? 1 : 0,
        duration: Math.max(280, skin.animation.enterDuration),
        easing: skin.animation.easing,
        useNativeDriver: false,
      }),
      Animated.timing(fullRowAnim, {
        toValue: showFull ? 1 : 0,
        duration: Math.max(320, skin.animation.enterDuration),
        easing: skin.animation.easing,
        useNativeDriver: false,
      }),
    ]).start();
  }, [catalogScrollMode, floatingHeaderAnim, midRowAnim, fullRowAnim, skin.animation]);

  const handleCatalogScroll = (event: any) => {
    const y = event?.nativeEvent?.contentOffset?.y ?? 0;
    const dy = y - lastCatalogScrollYRef.current;
    lastCatalogScrollYRef.current = y;
    if (y <= 14) {
      upwardScrollAccumRef.current = 0;
      setCatalogScrollMode(prev => (prev === 'top' ? prev : 'top'));
      onScrollDirectionChange?.(true);
    } else if (dy > 6 && y > 90) {
      upwardScrollAccumRef.current = 0;
      setCatalogScrollMode(prev => (prev === 'compact' ? prev : 'compact'));
      onScrollDirectionChange?.(false);
    } else if (dy < 0 && y > 14) {
      upwardScrollAccumRef.current += Math.abs(dy);
      if (dy < -6) {
        onScrollDirectionChange?.(true);
      }
      if (upwardScrollAccumRef.current >= 220) {
        setCatalogScrollMode(prev => (prev === 'floating' ? prev : 'floating'));
      } else if (upwardScrollAccumRef.current >= 90) {
        setCatalogScrollMode(prev =>
          prev === 'floating' || prev === 'floating_mid' ? prev : 'floating_mid'
        );
      }
    }
  };
  const [forYouItems, setForYouItems] = useState<CommunityCharacter[]>([]);
  const [forYouLoading, setForYouLoading] = useState(false);
  const { height: windowHeight } = useWindowDimensions();
  const [forYouHeight, setForYouHeight] = useState(() => Math.max(560, Math.floor(windowHeight - 130)));
  const [forYouReadMoreChar, setForYouReadMoreChar] = useState<CommunityCharacter | null>(null);
  const [forYouReadMoreDetail, setForYouReadMoreDetail] = useState<CommunityCharacterDetail | null>(null);
  const [loadingForYouDetail, setLoadingForYouDetail] = useState(false);
  const forYouDwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forYouViewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onForYouViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (forYouDwellTimerRef.current) {
      clearTimeout(forYouDwellTimerRef.current);
      forYouDwellTimerRef.current = null;
    }
    const active = viewableItems[0]?.item as CommunityCharacter | undefined;
    if (!active) return;
    matchAlgorithmService.recordInteraction(active, 'view').catch(() => {});
    forYouDwellTimerRef.current = setTimeout(() => {
      matchAlgorithmService.recordInteraction(active, 'dwell').catch(() => {});
    }, 3500);
  }).current;

  const handleOpenForYouReadMore = async (item: CommunityCharacter) => {
    matchAlgorithmService.recordInteraction(item, 'dwell').catch(() => {});
    setForYouReadMoreChar(item);
    setForYouReadMoreDetail(null);
    setLoadingForYouDetail(true);
    try {
      const detail = await communityCatalogService.getCharacterDetail(item.id, {
        fullPath: item.fullPath,
        source: item.source,
      });
      if (detail) setForYouReadMoreDetail(detail);
    } catch {}
    setLoadingForYouDetail(false);
  };

  useEffect(() => {
    onMatchModeChange?.(topMode === 'match' || topMode === 'foryou');
    if (topMode !== 'catalog') {
      setCatalogScrollMode('top');
      lastCatalogScrollYRef.current = 0;
    }
    if (topMode === 'foryou' && forYouItems.length === 0) {
      setForYouLoading(true);
      matchAlgorithmService
        .getNextBatch(20, activePersona)
        .then(batch => {
          setForYouItems(batch.length > 0 ? batch : communityCharacters);
        })
        .catch(() => {
          if (communityCharacters.length > 0) setForYouItems(communityCharacters);
        })
        .finally(() => setForYouLoading(false));
    }
  }, [topMode, onMatchModeChange]);

  // Sub-tabs in Catalog Grid (MySQL DB pill hidden while testing memory with JanitorAI & Chub.ai)
  const showMysqlSource = false;
  const [activeTab, setActiveTab] = useState<DiscoverTab>('community');
  const [enableExternalCatalogs] = useState<boolean>(true);
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
  const [librarySubTab, setLibrarySubTab] = useState<'latest' | 'liked' | 'creators'>('latest');
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
  const favoriteIdSet = useMemo(
    () => new Set(favoriteCharacters.map(f => f.id)),
    [favoriteCharacters]
  );
  const followedCreatorSet = useMemo(
    () => new Set(followedCreators.map(f => f.replace(/^@+/, '').toLowerCase())),
    [followedCreators]
  );

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pagination state
  const [hasMore, setHasMore] = useState<boolean>(true);

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
                source: catalogSource === 'chub' ? 'chub' : 'janitor',
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

  const TAG_ALIASES: Record<string, string> = {
    dominance: 'dominant',
    dom: 'dominant',
    sub: 'submissive',
    enemies: 'enemiestolovers',
    demi: 'demihuman',
    royal: 'royalty',
    magic: 'magical',
  };

  const buildSmartCatalogQuery = () => {
    const CHUB_TOPIC_ALIASES: Record<string, string> = {
      noncon: 'non-con',
      dubcon: 'dub-con',
    };

    const tokens = communitySearch.trim().split(/\s+/).filter(Boolean);
    const resolvedTagValues = new Set(selectedCategoryValues.filter(v => v !== 'all'));
    const extraChubTopics: string[] = [];
    const datacatWords: string[] = [];
    const chubWords: string[] = [];

    for (const tok of tokens) {
      if (tok.startsWith('#') && tok.length > 1) {
        const rawSlug = tok.slice(1).toLowerCase().replace(/[^a-z0-9_-]/g, '');
        const normalized = TAG_ALIASES[rawSlug] || rawSlug;
        const matchedCat = POPULAR_COMMUNITY_CATEGORIES.find(
          c => c.value.toLowerCase() === normalized && c.value !== 'all'
        );
        if (matchedCat) {
          resolvedTagValues.add(matchedCat.value);
        } else if (rawSlug) {
          extraChubTopics.push(CHUB_TOPIC_ALIASES[rawSlug] || rawSlug);
          datacatWords.push(rawSlug);
        }
      } else {
        const cleaned = tok.replace(/^#+/, '');
        if (cleaned) {
          datacatWords.push(cleaned);
          chubWords.push(cleaned);
        }
      }
    }

    const datacatSearch = datacatWords.join(' ').trim();
    const chubSearch = chubWords.join(' ').trim();
    const tagIds = POPULAR_COMMUNITY_CATEGORIES
      .filter(c => resolvedTagValues.has(c.value) && c.tagId)
      .map(c => c.tagId)
      .join(',');
    const chubTopics = Array.from(new Set([...resolvedTagValues, ...extraChubTopics])).join(',');

    return {
      datacatSearch: datacatSearch || undefined,
      chubSearch: chubSearch || undefined,
      tagIds: tagIds || undefined,
      chubTag: chubTopics || undefined,
    };
  };

  const fetchCharactersInitial = async (page = 1) => {
    setCommunityLoading(true);
    setCommunityError(null);
    const smartQuery = buildSmartCatalogQuery();
    try {
      if (catalogSource === 'janitor') {
        const res = await communityCatalogService.fetchDatacatCharacters({
          search: smartQuery.datacatSearch,
          tagIds: smartQuery.tagIds,
          page,
          limit: 12,
          sort: communitySort,
          sfwOnly,
        });
        setCommunityCharacters(res.characters);
        setCommunityTotalCount(res.totalCount);
        setHasMore(res.hasMore);
        if (res.error) setCommunityError(res.error);
      } else {
        const res = await communityCatalogService.fetchChubCharacters({
          search: smartQuery.chubSearch,
          tag: smartQuery.chubTag,
          page,
          limit: 12,
          sort: communitySort,
          sfwOnly,
        });
        setCommunityCharacters(res.characters);
        setCommunityTotalCount(res.totalCount);
        setHasMore(res.hasMore);
        if (res.error) setCommunityError(res.error);
      }
    } catch (err: any) {
      setCommunityCharacters([]);
      setHasMore(false);
      setCommunityError(err?.message || 'Failed to fetch catalog feed');
    } finally {
      setCommunityLoading(false);
    }
  };

  // True Infinite Scroll Handler (Triggered on End Reached)
  const handleLoadMore = async () => {
    if (communityLoading || isLoadingMore || !hasMore || scopeMode === 'favorites' || scopeMode === 'following') return;
    setIsLoadingMore(true);
    const nextPage = currentPage + 1;
    const smartQuery = buildSmartCatalogQuery();
    try {
      let newChars: CommunityCharacter[] = [];
      let nextHasMore = false;
      if (catalogSource === 'janitor') {
        const res = await communityCatalogService.fetchDatacatCharacters({
          search: smartQuery.datacatSearch,
          tagIds: smartQuery.tagIds,
          page: nextPage,
          limit: 12,
          sort: communitySort,
          sfwOnly,
        });
        newChars = res.characters;
        nextHasMore = res.hasMore;
      } else {
        const res = await communityCatalogService.fetchChubCharacters({
          search: smartQuery.chubSearch,
          tag: smartQuery.chubTag,
          page: nextPage,
          limit: 12,
          sort: communitySort,
          sfwOnly,
        });
        newChars = res.characters;
        nextHasMore = res.hasMore;
      }

      setHasMore(nextHasMore);
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

  const handleToggleCommunityFavorite = async (char: CommunityCharacter) => {
    const currentlyFav = favoriteCharacters.some(f => f.id === char.id);
    const optimisticNext = !currentlyFav;
    setFavoriteCharacters(prev =>
      optimisticNext ? [char, ...prev.filter(f => f.id !== char.id)] : prev.filter(f => f.id !== char.id)
    );
    const next = await storageService.toggleCommunityFavorite(char as any);
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
    // 1. My Library Tab: Latest (followed creators), Liked, or Creators
    if (activeTab === 'library') {
      const mappedLocal: CommunityCharacter[] = characters.map(c => ({
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

      let libChars: CommunityCharacter[] = [];
      if (librarySubTab === 'liked') {
        const seen = new Set<string>();
        for (const fav of favoriteCharacters) {
          if (!seen.has(fav.id)) {
            seen.add(fav.id);
            libChars.push(fav);
          }
        }
        for (const localFav of mappedLocal.filter((_, i) => characters[i]?.isFavorite)) {
          if (!seen.has(localFav.id)) {
            seen.add(localFav.id);
            libChars.push(localFav);
          }
        }
      } else {
        // 'latest': prioritize latest from followed creators, then local saved library
        const seen = new Set<string>();
        const followedSource = followingCharacters.length > 0
          ? followingCharacters
          : communityCharacters.filter(c => {
              const handle = (c.creatorName || '').replace(/^@+/, '').toLowerCase();
              return followedCreators.some(f => f.replace(/^@+/, '').toLowerCase() === handle);
            });
        for (const fc of followedSource) {
          if (!seen.has(fc.id)) {
            seen.add(fc.id);
            libChars.push(fc);
          }
        }
        for (const lc of mappedLocal) {
          if (!seen.has(lc.id)) {
            seen.add(lc.id);
            libChars.push(lc);
          }
        }
        libChars.sort((a, b) => {
          const tA = new Date(a.firstPublishedAt || a.createdAt || 0).getTime();
          const tB = new Date(b.firstPublishedAt || b.createdAt || 0).getTime();
          return tB - tA;
        });
      }

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

  const hasActiveFilters =
    !sfwOnly ||
    entityMode !== 'characters' ||
    scopeMode !== 'all' ||
    (selectedCategoryValues.length > 0 && !selectedCategoryValues.includes('all'));

  const renderSearchBarOnly = (compact: boolean = false) => (
    <View
      style={[
        styles.searchContainer,
        { flexDirection: 'row', alignItems: 'center', gap: 8 },
        compact && { paddingTop: 6, paddingBottom: 6 },
      ]}
    >
      <View
        style={[
          styles.searchBarWrapper,
          {
            flex: 1,
            minHeight: 44,
            borderRadius: skin.inputRadius,
            borderWidth: skin.id === 'material' ? 0 : Math.max(0.75, skin.cardBorderWidth),
            backgroundColor:
              skin.surfaceMode === 'tonal'
                ? palette.bgSurfaceSubtle
                : skin.surfaceMode === 'frosted'
                  ? 'rgba(28, 28, 30, 0.85)'
                  : palette.bgSurface,
          },
        ]}
      >
        <Search size={15} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('discover.searchPlaceholder')}
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

      <TouchableOpacity
        style={[
          styles.tagDrawerBtn,
          {
            width: 44,
            height: 44,
            borderRadius: skin.inputRadius,
            marginRight: 0,
          },
        ]}
        onPress={() => setIsTagDrawerOpen(true)}
        activeOpacity={0.75}
        accessibilityLabel="Filter Catalog"
      >
        <SlidersHorizontal size={16} color={palette.accent} />
        {hasActiveFilters && (
          <View
            style={{
              position: 'absolute',
              top: 7,
              right: 7,
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: palette.accent,
            }}
          />
        )}
      </TouchableOpacity>
    </View>
  );

  const renderTopPrimarySwitcher = () => (
        <View style={{ zIndex: 40 }}>
        <View
          style={[
            styles.topPrimaryBar,
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 14,
              gap: 8,
            },
          ]}
        >
          {/* Left: Mode Dropdown (Catalog Grid / For You / Match Mode) */}
          <TouchableOpacity
            style={[
              styles.topPrimaryBtn,
              styles.topPrimaryBtnActive,
              {
                backgroundColor: palette.accent,
                minHeight: 40,
                paddingHorizontal: 14,
                borderRadius: 999,
              },
            ]}
            onPress={() => setShowCatalogDropdown(prev => !prev)}
            activeOpacity={0.8}
          >
            {topMode === 'foryou' ? (
              <Sparkles size={14} color="#000000" style={{ marginRight: 6 }} />
            ) : topMode === 'match' ? (
              <Flame size={14} color="#000000" style={{ marginRight: 6 }} />
            ) : (
              <LayoutGrid size={14} color="#000000" style={{ marginRight: 6 }} />
            )}
            <Text style={[styles.topPrimaryBtnText, styles.topPrimaryBtnTextActive]}>
              {topMode === 'foryou'
                ? t('discover.forYou')
                : topMode === 'match'
                  ? t('discover.matchMode')
                  : t('discover.catalogGrid')}
            </Text>
            <ChevronDown
              size={14}
              color="#000000"
              style={{
                marginLeft: 5,
                transform: [{ rotate: showCatalogDropdown ? '180deg' : '0deg' }],
              }}
            />
          </TouchableOpacity>

          {/* Right: JanitorAI | Chub.ai + Refresh */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {activeTab === 'community' && enableExternalCatalogs && (
              <View style={[styles.sourcePillSwitch, { minHeight: 40 }]}>
                <TouchableOpacity
                  style={[
                    styles.sourcePillBtn,
                    { paddingHorizontal: 11, paddingVertical: 8 },
                    catalogSource === 'janitor' && styles.sourcePillBtnActive,
                  ]}
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
                  style={[
                    styles.sourcePillBtn,
                    { paddingHorizontal: 11, paddingVertical: 8 },
                    catalogSource === 'chub' && styles.sourcePillBtnActive,
                  ]}
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
            )}

            <TouchableOpacity
              style={[styles.iconBtn, { width: 40, height: 40, borderRadius: 20 }]}
              onPress={() => fetchCharactersInitial(1)}
              activeOpacity={0.7}
              accessibilityLabel="Refresh Catalog Feed"
            >
              <RefreshCw size={15} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
        </View>
        </View>
  );

  const renderCatalogControls = (omitSearchBar: boolean = false) => {
    const sortCycleLabel =
      activeTab === 'library'
        ? librarySubTab === 'latest'
          ? '✨ Latest'
          : librarySubTab === 'liked'
            ? '❤️ Liked'
            : '👤 Creators'
        : communitySort === 'trending'
          ? `🔥 ${t('discover.trending')}`
          : communitySort === 'popular'
            ? `❤️ ${t('discover.popular')}`
            : `✨ ${t('discover.latest')}`;

    const handleCycleSort = () => {
      if (activeTab === 'library') {
        const order = ['latest', 'liked', 'creators'] as const;
        const next = order[(order.indexOf(librarySubTab) + 1) % order.length];
        setLibrarySubTab(next);
        if (next === 'creators') setEntityMode('creators');
        else if (entityMode === 'creators') setEntityMode('characters');
      } else {
        const order: CatalogSort[] = ['trending', 'popular', 'latest'];
        const next = order[(order.indexOf(communitySort) + 1) % order.length];
        setCommunitySort(next);
      }
    };

    return (
      <>
        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* 2. SEARCH BAR + FILTER DRAWER BUTTON (44x44)                      */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {!omitSearchBar && renderSearchBarOnly()}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* 3. SINGLE SLIM HORIZONTAL STRIP: Explore / Library / Sort / SFW / Tags */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <ScrollView
          horizontal
          style={{ flexGrow: 0 }}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 14,
            paddingTop: 2,
            paddingBottom: 10,
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* Explore / Library segmented pills */}
          <TouchableOpacity
            style={[
              styles.communityTagChip,
              { minHeight: 38, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
              activeTab === 'community' && {
                backgroundColor: `rgba(${palette.accentRgb}, 0.16)`,
                borderColor: palette.accent,
              },
            ]}
            onPress={() => setActiveTab('community')}
            activeOpacity={0.8}
          >
            <Compass
              size={13}
              color={activeTab === 'community' ? palette.accent : '#9ca3af'}
              style={{ marginRight: 5 }}
            />
            <Text
              style={[
                styles.communityTagText,
                activeTab === 'community' && { color: palette.accent, fontWeight: '700' },
              ]}
            >
              {t('discover.exploreAll')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.communityTagChip,
              { minHeight: 38, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
              activeTab === 'library' && {
                backgroundColor: `rgba(${palette.accentRgb}, 0.16)`,
                borderColor: palette.accent,
              },
            ]}
            onPress={() => setActiveTab('library')}
            activeOpacity={0.8}
          >
            <Bookmark
              size={13}
              color={activeTab === 'library' ? palette.accent : '#9ca3af'}
              style={{ marginRight: 5 }}
            />
            <Text
              style={[
                styles.communityTagText,
                activeTab === 'library' && { color: palette.accent, fontWeight: '700' },
              ]}
            >
              {t('discover.myLibrary')} ({characters.length})
            </Text>
          </TouchableOpacity>

          {/* Sort cycle pill */}
          <TouchableOpacity
            style={[
              styles.communityTagChip,
              {
                minHeight: 38,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                backgroundColor: `rgba(${palette.accentRgb}, 0.12)`,
                borderColor: `rgba(${palette.accentRgb}, 0.35)`,
              },
            ]}
            onPress={handleCycleSort}
            activeOpacity={0.8}
          >
            <Text style={[styles.communityTagText, { color: palette.accent, fontWeight: '700' }]}>
              {sortCycleLabel}
            </Text>
            <ChevronDown size={12} color={palette.accent} style={{ marginLeft: 4 }} />
          </TouchableOpacity>

          {/* Quick SFW / NSFW toggle pill */}
          <TouchableOpacity
            style={[
              styles.communityTagChip,
              { minHeight: 38, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
              !sfwOnly && {
                backgroundColor: 'rgba(244, 63, 94, 0.16)',
                borderColor: 'rgba(244, 63, 94, 0.5)',
              },
            ]}
            onPress={() => setSfwOnly(prev => !prev)}
            activeOpacity={0.8}
          >
            {sfwOnly ? (
              <EyeOff size={12} color="#9ca3af" style={{ marginRight: 5 }} />
            ) : (
              <Eye size={12} color="#fb7185" style={{ marginRight: 5 }} />
            )}
            <Text
              style={[
                styles.communityTagText,
                !sfwOnly && { color: '#fb7185', fontWeight: '700' },
              ]}
            >
              {sfwOnly ? 'SFW' : 'NSFW'}
            </Text>
          </TouchableOpacity>

          {/* Tag Chips (soft tinted active state) */}
          {POPULAR_COMMUNITY_CATEGORIES.map(chip => {
            const isSelected = selectedCategoryValues.includes(chip.value);
            return (
              <TouchableOpacity
                key={chip.value}
                style={[
                  styles.communityTagChip,
                  { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12 },
                  isSelected && {
                    backgroundColor: `rgba(${palette.accentRgb}, 0.16)`,
                    borderColor: palette.accent,
                  },
                ]}
                onPress={() => handleToggleCategory(chip.value)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.communityTagText,
                    isSelected && { color: palette.accent, fontWeight: '700' },
                  ]}
                >
                  {chip.value === 'all' ? 'All Tags' : `#${chip.value}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bgDark }]}>
      {/* ── Toast Notification ── */}
      {toastMessage && (
        <View style={styles.toastBox}>
          <Sparkles size={14} color={palette.accent} style={{ marginRight: 6 }} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 1. TOP PRIMARY SWITCHER: [ 🗂️ Catalog Grid ⌄ ] | [ 🔥 Match Mode ] */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {topMode !== 'catalog' && renderTopPrimarySwitcher()}

      {topMode === 'match' ? (
        <View style={{ flex: 1, paddingBottom: Math.max(8, insets.bottom) }}>
          <TinderDeck
            characters={communityCharacters.length > 0 ? communityCharacters : (characters as any)}
            activePersona={activePersona}
            onBack={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setTopMode('catalog');
            }}
            onMatchChat={onStartChat}
            onToggleFavorite={handleToggleCommunityFavorite}
            favoriteIds={new Set(favoriteCharacters.map(f => f.id))}
          />
        </View>
      ) : topMode === 'foryou' ? (
        <View
          style={{ flex: 1, overflow: 'hidden' }}
          onLayout={e => {
            const h = Math.floor(e.nativeEvent.layout.height);
            if (h > 200 && Math.abs(h - forYouHeight) > 2) {
              setForYouHeight(h);
            }
          }}
        >
          {forYouLoading && forYouItems.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <NekoPulseLoader label="Curating your For You feed..." />
            </View>
          ) : forYouItems.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
              <Sparkles size={28} color={palette.accent} />
              <Text style={{ color: '#f8fafc', fontSize: 15, fontWeight: '700', marginTop: 10 }}>
                No recommendations ready yet
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 12.5, textAlign: 'center', marginTop: 4 }}>
                Like, follow creators, or chat with a few characters to tune your For You feed.
              </Text>
            </View>
          ) : (
            <FlatList
              style={{ flex: 1 }}
              data={forYouItems}
              keyExtractor={(item, idx) => `${item.id}_${idx}`}
              pagingEnabled
              showsVerticalScrollIndicator={false}
              snapToInterval={forYouHeight}
              snapToAlignment="start"
              decelerationRate="fast"
              disableIntervalMomentum
              getItemLayout={(_, index) => ({
                length: forYouHeight,
                offset: forYouHeight * index,
                index,
              })}
              initialNumToRender={2}
              maxToRenderPerBatch={2}
              windowSize={3}
              removeClippedSubviews={Platform.OS === 'android'}
              viewabilityConfig={forYouViewabilityConfig}
              onViewableItemsChanged={onForYouViewableItemsChanged}
              onEndReachedThreshold={0.5}
              onEndReached={() => {
                if (forYouLoading || forYouLoadingMoreRef.current) return;
                forYouLoadingMoreRef.current = true;
                matchAlgorithmService
                  .getNextBatch(12, activePersona)
                  .then(more => {
                    if (more.length > 0) {
                      setForYouItems(prev => {
                        const seen = new Set(prev.map(p => p.id));
                        const fresh = more.filter(m => !seen.has(m.id));
                        return fresh.length > 0 ? [...prev, ...fresh] : prev;
                      });
                    }
                  })
                  .catch(() => {})
                  .finally(() => {
                    forYouLoadingMoreRef.current = false;
                  });
              }}
              renderItem={({ item }) => {
                const isLiked = favoriteIdSet.has(item.id);
                const creatorHandle = (item.creatorName || 'creator').replace(/^@+/, '');
                const isFollowing = followedCreatorSet.has(creatorHandle.toLowerCase());
                const imageUri = item.avatarUrl || (item as any).coverUrl || (item as any).avatar || '';
                const tags: string[] = Array.isArray(item.tags)
                  ? item.tags.map((t: any) => (typeof t === 'string' ? t : t?.name || '')).filter(Boolean)
                  : [];
                const genderTag = tags.find(t => /^(female|male|non-binary|oc|futa|anypov|malepov|fempov)$/i.test(t));
                const rawDesc: string =
                  item.shortDescription || (item as any).description || (item as any).tagline || '';
                const previewDesc =
                  rawDesc.length > 200 ? `${rawDesc.slice(0, 200).trim()}...` : rawDesc;

                return (
                  <View
                    style={{
                      height: forYouHeight,
                      paddingHorizontal: 10,
                      paddingTop: 4,
                      paddingBottom: Math.max(12, insets.bottom + 8),
                    }}
                  >
                    {/* Full-Bleed Art Frame with TikTok-style Bottom Overlay (no right button column) */}
                    <View
                      style={{
                        flex: 1,
                        borderRadius: 20,
                        overflow: 'hidden',
                        backgroundColor: 'rgba(15, 18, 28, 0.9)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.09)',
                      }}
                    >
                      <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        onPress={() => setSelectedCommunityChar(item)}
                        activeOpacity={0.95}
                      >
                        {imageUri ? (
                          <Image
                            source={{ uri: imageUri }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: '#64748b', fontSize: 13 }}>No cover art</Text>
                          </View>
                        )}
                      </TouchableOpacity>

                      {/* Progressive Linear Black Fade into @creator, Name, Description, Tags & Start Chat */}
                      <LinearGradient
                        colors={['transparent', 'rgba(8,10,16,0.58)', 'rgba(8,10,16,0.92)', '#080a10']}
                        locations={[0, 0.25, 0.58, 1]}
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          bottom: 0,
                          paddingTop: 64,
                          paddingHorizontal: 14,
                          paddingBottom: 14,
                          gap: 8,
                        }}
                      >
                        {/* Bottom-anchored @creator + Follow + inline Like/Chat pills */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 }}>
                            <View
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 12,
                                backgroundColor: `rgba(${palette.accentRgb}, 0.22)`,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ color: palette.accent, fontSize: 10.5, fontWeight: '800' }}>
                                {creatorHandle.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <Text style={{ color: '#e2e8f0', fontSize: 12.5, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
                              @{creatorHandle}
                            </Text>
                            <TouchableOpacity
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                borderRadius: 999,
                                backgroundColor: isFollowing ? `rgba(${palette.accentRgb}, 0.2)` : 'rgba(255,255,255,0.12)',
                                borderWidth: 1,
                                borderColor: isFollowing ? palette.accent : 'rgba(255,255,255,0.22)',
                              }}
                              onPress={() => handleToggleFollowCreator(creatorHandle)}
                              activeOpacity={0.8}
                            >
                              <Text style={{ color: isFollowing ? palette.accent : '#f8fafc', fontSize: 11, fontWeight: '700' }}>
                                {isFollowing ? 'Following' : 'Follow'}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TouchableOpacity
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                paddingHorizontal: 9,
                                paddingVertical: 5,
                                borderRadius: 999,
                                backgroundColor: 'rgba(10, 12, 18, 0.72)',
                                borderWidth: 1,
                                borderColor: isLiked ? palette.accent : 'rgba(255,255,255,0.18)',
                              }}
                              onPress={() => {
                                handleToggleCommunityFavorite(item);
                                matchAlgorithmService.recordUserLike(item, !isLiked).catch(() => {});
                              }}
                              activeOpacity={0.8}
                            >
                              <Heart
                                size={12.5}
                                color={isLiked ? palette.accent : '#f8fafc'}
                                fill={isLiked ? palette.accent : 'transparent'}
                              />
                              <Text style={{ color: isLiked ? palette.accent : '#f8fafc', fontSize: 11.5, fontWeight: '700' }}>
                                {Number(item.favoritesCount ?? (item as any).likesCount ?? 0) + (isLiked ? 1 : 0)}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                paddingHorizontal: 9,
                                paddingVertical: 5,
                                borderRadius: 999,
                                backgroundColor: 'rgba(10, 12, 18, 0.72)',
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.18)',
                              }}
                              onPress={() => {
                                matchAlgorithmService.recordInteraction(item, 'chat').catch(() => {});
                                onStartChat(item);
                              }}
                              activeOpacity={0.8}
                            >
                              <MessageCircle size={12.5} color="#f8fafc" />
                              <Text style={{ color: '#f8fafc', fontSize: 11.5, fontWeight: '700' }}>
                                {item.chatCount ?? (item as any).chatsCount ?? 0}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Character Name right above Character · tokens */}
                        <Text style={{ color: '#f8fafc', fontSize: 18.5, fontWeight: '800', lineHeight: 22 }} numberOfLines={2}>
                          {item.name}
                        </Text>

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                            {genderTag ? genderTag : 'Character'}
                            {item.totalTokens ? ` · ${item.totalTokens} tokens` : ''}
                          </Text>
                          {typeof (item as any).affinityScore === 'number' && (item as any).affinityScore > 0 ? (
                            <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '700' }}>
                              {Math.round((item as any).affinityScore)}% match
                            </Text>
                          ) : null}
                        </View>

                        {previewDesc ? (
                          <View>
                            <RichHtmlRenderer
                              content={previewDesc}
                              baseColor="rgba(241, 245, 249, 0.9)"
                              fontSize={12}
                              lineHeight={17}
                            />
                            <TouchableOpacity
                              onPress={() => handleOpenForYouReadMore(item)}
                              style={{ alignSelf: 'flex-start', marginTop: 3 }}
                              activeOpacity={0.75}
                            >
                              <Text style={{ color: palette.accent, fontSize: 12, fontWeight: '700' }}>
                                Read more
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}

                        {tags.length > 0 && (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {tags.slice(0, 5).map(tag => (
                              <View
                                key={tag}
                                style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                  borderRadius: 8,
                                  backgroundColor: 'rgba(255,255,255,0.08)',
                                  borderWidth: 1,
                                  borderColor: 'rgba(255,255,255,0.12)',
                                }}
                              >
                                <Text style={{ color: '#cbd5e1', fontSize: 10.5, fontWeight: '600' }}>#{tag}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        <TouchableOpacity
                          style={{
                            backgroundColor: palette.accent,
                            borderRadius: 12,
                            paddingVertical: 11,
                            alignItems: 'center',
                            marginTop: 2,
                          }}
                          onPress={() => {
                            matchAlgorithmService.recordInteraction(item, 'chat').catch(() => {});
                            onStartChat(item);
                          }}
                          activeOpacity={0.85}
                        >
                          <Text style={{ color: palette.bgDark, fontSize: 13.5, fontWeight: '800' }}>Start Chat</Text>
                        </TouchableOpacity>
                      </LinearGradient>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      ) : (
        <>
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
                    <Icon size={13} color={isSelected ? '#000000' : palette.accent} />
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

      {/* ── Floating Collapsible Header (Transparent Frosted Blur) ── */}
      {catalogScrollMode !== 'top' && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 45,
              overflow: showCatalogDropdown ? 'visible' : 'hidden',
              backgroundColor: 'rgba(12, 14, 20, 0.72)',
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255, 255, 255, 0.08)',
              transform: [
                {
                  translateY: floatingHeaderAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-28, 0],
                  }),
                },
              ],
            },
            Platform.OS === 'web'
              ? ({
                  backdropFilter: 'blur(20px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                } as any)
              : {},
          ]}
        >
          {Platform.OS === 'ios' && (
            <BlurView
              intensity={52}
              tint="dark"
              blurMethod="dimezisBlurView"
              blurTarget={discoverContentRef}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          )}
          {/* Row 1 (slides in smoothly on first upward scroll): Top Mode + Source Bar */}
          <Animated.View
            style={{
              zIndex: 50,
              overflow: showCatalogDropdown ? 'visible' : 'hidden',
              maxHeight: midRowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 68],
              }),
            }}
          >
            {renderTopPrimarySwitcher()}
          </Animated.View>

          {/* Row 2 (always in floating/compact): Search + Filter */}
          {renderSearchBarOnly(true)}

          {/* Row 3 (slides in smoothly on deeper upward scroll): Single Horizontal Strip */}
          <Animated.View
            style={{
              overflow: 'hidden',
              maxHeight: fullRowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 56],
              }),
            }}
          >
            {renderCatalogControls(true)}
          </Animated.View>
        </Animated.View>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 6. MAIN CONTENT: 2-COLUMN BENTO GRID WITH TRUE INFINITE SCROLL     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <BlurTargetView ref={discoverContentRef} style={{ flex: 1 }}>
      {(communityLoading || (scopeMode === 'following' && followingLoading && displayedCharacters.length === 0)) ? (
        <View style={{ flex: 1 }}>
          {renderTopPrimarySwitcher()}
          {renderCatalogControls()}
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
        </View>
      ) : entityMode === 'creators' ? (
        <FlatList
          key="creators-list"
          data={
            activeTab === 'library'
              ? creatorProfiles.filter(cr =>
                  followedCreators.some(f => f.toLowerCase() === cr.creatorName.toLowerCase())
                )
              : creatorProfiles
          }
          keyExtractor={item => item.creatorName}
          contentContainerStyle={styles.creatorsList}
          ListHeaderComponent={
            <View style={{ marginHorizontal: -12 }}>
              {renderTopPrimarySwitcher()}
              {renderCatalogControls()}
            </View>
          }
          onScroll={handleCatalogScroll}
          scrollEventThrottle={16}
          onEndReached={activeTab === 'community' ? handleLoadMore : undefined}
          onEndReachedThreshold={0.5}
          renderItem={({ item: creator }) => {
            const isFollowing = followedCreators.some(
              f => f.toLowerCase() === creator.creatorName.toLowerCase()
            );
            return (
              <View style={styles.creatorCard}>
                <View style={styles.creatorCardTop}>
                  {creator.avatarUrl ? (
                    <Image source={{ uri: creator.avatarUrl }} style={styles.creatorAvatar} />
                  ) : (
                    <View style={[styles.creatorAvatar, { alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: palette.accent }}>
                        {creator.creatorName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.creatorInfoCol}>
                    <View style={styles.creatorNameRow}>
                      <Text style={styles.creatorCardName}>@{creator.creatorName}</Text>
                      <CheckCircle2 size={13} color={palette.accent} style={{ marginLeft: 3 }} />
                    </View>
                    <Text style={styles.creatorBotCount}>{creator.botCount} public companions</Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.creatorFollowBtn,
                      isFollowing && [styles.creatorFollowBtnActive, { backgroundColor: palette.accent, borderColor: palette.accent }],
                    ]}
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
                  <Text style={[styles.viewBotsBtnText, { color: palette.accent }]}>
                    View Creator Profile & Companions →
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ListFooterComponent={
            isLoadingMore && activeTab === 'community' ? (
              <View style={styles.footerLoader}>
                <NekoPulseLoader size={26} label="Loading more creators..." />
              </View>
            ) : undefined
          }
        />
      ) : (
        <FlatList
          key="characters-grid"
          data={displayedCharacters}
          keyExtractor={item => item.id}
          numColumns={2}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={Platform.OS === 'android'}
          columnWrapperStyle={styles.twoColumnWrapper}
          contentContainerStyle={styles.cardsContainer}
          ListHeaderComponent={
            <View style={{ marginHorizontal: -12 }}>
              {renderTopPrimarySwitcher()}
              {renderCatalogControls()}
            </View>
          }
          onScroll={handleCatalogScroll}
          scrollEventThrottle={16}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefreshCatalog}
              tintColor={palette.accent}
              colors={[palette.accent]}
            />
          }
          renderItem={({ item }) => (
            <CommunityCharacterCard
              character={item}
              onSelect={c => {
                matchAlgorithmService.recordInteraction(c, 'dwell').catch(() => {});
                setSelectedCommunityChar(c);
              }}
              onStartChat={c => {
                matchAlgorithmService.recordInteraction(c, 'chat').catch(() => {});
                onStartChat(c);
              }}
              onImport={c => {
                matchAlgorithmService.recordInteraction(c, 'chat').catch(() => {});
                onImportCard?.(c);
                showToast(`✨ Imported "${c.name}" into My Library!`);
              }}
              isBookmarked={favoriteIdSet.has(item.id)}
              onToggleBookmark={() => handleToggleCommunityFavorite(item)}
              isFollowingCreator={followedCreatorSet.has(
                (item.creatorName || '').replace(/^@+/, '').toLowerCase()
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
                  {catalogSource === 'local_db'
                    ? 'MySQL Backend Offline'
                    : catalogSource === 'janitor'
                      ? 'JanitorAI Gateway Offline (Port 3001)'
                      : 'Chub.ai Feed Unavailable'}
                </Text>
                <Text style={styles.errorDesc}>
                  {catalogSource === 'local_db'
                    ? `${communityError}\n\nStart MySQL in XAMPP, run "npm run proxy", and set your Backend URL in Settings → Account & MySQL.`
                    : catalogSource === 'janitor'
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
      </BlurTargetView>
      </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 6B. FOR YOU: READ MORE BLURRED OVERLAY WITH STICKY CHAT BUTTON     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={Boolean(forYouReadMoreChar)}
        transparent
        animationType="fade"
        onRequestClose={() => setForYouReadMoreChar(null)}
      >
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 36 }}>
          {Platform.OS !== 'android' && (
            <BlurView
              intensity={38}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          )}
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(6, 8, 14, 0.72)' },
            ]}
          />

          {forYouReadMoreChar && (
            <View
              style={{
                maxHeight: '86%',
                borderRadius: 22,
                backgroundColor: 'rgba(18, 22, 34, 0.94)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.12)',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 18,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255,255,255,0.08)',
                }}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ color: '#f8fafc', fontSize: 16.5, fontWeight: '800' }} numberOfLines={2}>
                    {forYouReadMoreChar.name}
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                    @{(forYouReadMoreChar.creatorName || 'creator').replace(/^@+/, '')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setForYouReadMoreChar(null)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={17} color="#f8fafc" />
                </TouchableOpacity>
              </View>

              {/* Scrollable Full HTML Description */}
              <ScrollView
                style={{ paddingHorizontal: 18, paddingTop: 14 }}
                contentContainerStyle={{ paddingBottom: 18 }}
                showsVerticalScrollIndicator={false}
              >
                {loadingForYouDetail && !forYouReadMoreDetail && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <ActivityIndicator size="small" color={palette.accent} />
                    <Text style={{ color: '#94a3b8', fontSize: 12 }}>Loading full description...</Text>
                  </View>
                )}
                <RichHtmlRenderer
                  content={
                    forYouReadMoreDetail?.descriptionHtml ||
                    forYouReadMoreDetail?.shortDescription ||
                    (forYouReadMoreChar as any).descriptionHtml ||
                    forYouReadMoreChar.shortDescription ||
                    (forYouReadMoreChar as any).description ||
                    (forYouReadMoreChar as any).tagline ||
                    'No description provided.'
                  }
                  baseColor="rgba(255, 255, 255, 0.88)"
                  fontSize={13.5}
                  lineHeight={21}
                />
              </ScrollView>

              {/* Sticky Start Chat Button */}
              <View
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 14,
                  borderTopWidth: 1,
                  borderTopColor: 'rgba(255,255,255,0.08)',
                  backgroundColor: 'rgba(14, 17, 26, 0.96)',
                }}
              >
                <TouchableOpacity
                  style={{
                    backgroundColor: palette.accent,
                    borderRadius: 14,
                    paddingVertical: 13,
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    const target = forYouReadMoreChar;
                    setForYouReadMoreChar(null);
                    onStartChat(target);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: palette.bgDark, fontSize: 14.5, fontWeight: '800' }}>Start Chat</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Top-Level Mode Dropdown Popover (above Catalog Grid, For You, and Match Mode) */}
      {catalogDropdownMounted && (
        <View
          pointerEvents={showCatalogDropdown ? 'auto' : 'none'}
          style={[StyleSheet.absoluteFill, { zIndex: 999, elevation: 30 }]}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowCatalogDropdown(false)}
            style={StyleSheet.absoluteFill}
          >
            <Animated.View
            style={{
              position: 'absolute',
              top: 56,
              left: 14,
              width: 220,
              borderRadius: 16,
              backgroundColor: 'rgba(14, 17, 26, 0.98)',
              borderWidth: 1,
              borderColor: `rgba(${palette.accentRgb}, 0.35)`,
              padding: 6,
              zIndex: 1000,
              shadowColor: '#000',
              shadowOpacity: 0.55,
              shadowRadius: 16,
              elevation: 31,
              opacity: catalogDropdownAnim,
              transform: [
                {
                  translateY: catalogDropdownAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 0],
                  }),
                },
                {
                  scale: catalogDropdownAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1],
                  }),
                },
              ],
            }}
          >
            {[
              { id: 'catalog' as const, label: 'Catalog Grid', sub: 'Browse & filter all', Icon: LayoutGrid },
              { id: 'foryou' as const, label: 'For You', sub: 'Algorithmic snap feed', Icon: Sparkles },
              { id: 'match' as const, label: 'Match Mode', sub: 'Swipe character deck', Icon: Flame },
            ].map(opt => {
              const active = topMode === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 10,
                    borderRadius: 11,
                    backgroundColor: active ? `rgba(${palette.accentRgb}, 0.14)` : 'transparent',
                  }}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setTopMode(opt.id);
                    setShowCatalogDropdown(false);
                  }}
                  activeOpacity={0.8}
                >
                  <opt.Icon size={15} color={active ? palette.accent : '#94a3b8'} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: active ? palette.accent : '#f8fafc', fontSize: 13, fontWeight: '700' }}>
                      {opt.label}
                    </Text>
                    <Text style={{ color: '#94a3b8', fontSize: 10.5 }}>{opt.sub}</Text>
                  </View>
                  {active && <Check size={14} color={palette.accent} />}
                </TouchableOpacity>
              );
            })}
            </Animated.View>
          </TouchableOpacity>
        </View>
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
        onClearTags={() => {
          setSelectedCategoryValues(['all']);
          setEntityMode('characters');
          setSfwOnly(true);
          setScopeMode('all');
        }}
        onApply={() => fetchCharactersInitial(1)}
        matchingCount={communityTotalCount}
        entityMode={entityMode}
        onChangeEntityMode={setEntityMode}
        sfwOnly={sfwOnly}
        onChangeSfwOnly={setSfwOnly}
        scopeMode={scopeMode}
        onChangeScopeMode={setScopeMode}
        followedCount={followedCreators.length}
      />
    </View>
  );
};

const createStyles = (palette: ThemePalette) => StyleSheet.create({
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
    borderColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 14,
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  toastText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: palette.accent,
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
    backgroundColor: palette.accent,
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
    backgroundColor: palette.accent,
  },
  profileAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1b1a2e',
    borderWidth: 1.5,
    borderColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarLetter: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.accent,
  },
  topPrimaryBar: {
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'transparent',
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
    backgroundColor: palette.accent,
    shadowColor: palette.accent,
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
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'transparent',
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
    backgroundColor: palette.accent,
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
    backgroundColor: palette.accent,
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
    backgroundColor: palette.bgDark,
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
    borderColor: `rgba(${palette.accentRgb}, 0.35)`,
  },
  stickyFilterToggleText: {
    color: palette.accent,
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
    backgroundColor: palette.accent,
    borderColor: palette.accent,
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
    overflow: 'hidden',
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
    paddingHorizontal: 8,
    paddingVertical: 6.5,
    borderRadius: 16,
    minHeight: 30,
    flex: 1,
  },
  pillSegmentActive: {
    backgroundColor: palette.accent,
  },
  pillSegmentText: {
    fontSize: 11.5,
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
    backgroundColor: palette.accent,
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
    borderColor: `rgba(${palette.accentRgb}, 0.55)`,
    backgroundColor: `rgba(${palette.accentRgb}, 0.12)`,
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
    backgroundColor: palette.accent,
  },
  scopeMenuIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: `rgba(${palette.accentRgb}, 0.12)`,
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
    color: palette.accent,
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
    color: palette.accent,
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
    backgroundColor: palette.accent,
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
    borderColor: `rgba(${palette.accentRgb}, 0.3)`,
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
    backgroundColor: palette.accent,
    borderColor: palette.accent,
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
    color: palette.accent,
  },
});
