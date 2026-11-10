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
} from 'react-native';
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
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
import { Character, CommunityCharacter, CommunityCharacterDetail } from '../types';
import { CommunityCharacterCard } from '../components/CommunityCharacterCard';
import { CommunityCharacterModal } from '../components/CommunityCharacterModal';
import { TagFilterDrawerModal } from '../components/TagFilterDrawerModal';
import { TinderDeck } from '../components/TinderDeck';
import {
  communityCatalogService,
  POPULAR_COMMUNITY_CATEGORIES,
} from '../services/communityCatalogService';
import { storageService } from '../services/storageService';

interface DiscoverScreenProps {
  characters: Character[];
  onStartChat: (character: any, detail?: CommunityCharacterDetail) => void;
  onToggleFavorite?: (character: any) => void;
  onImportCard?: (character: any) => void;
}

type TopMode = 'catalog' | 'match';
type DiscoverTab = 'community' | 'library';
type EntityMode = 'characters' | 'creators';
type ScopeMode = 'all' | 'following' | 'favorites';
type CatalogSort = 'latest' | 'trending' | 'popular';
type CatalogSource = 'janitor' | 'chub';

export const DiscoverScreen: React.FC<DiscoverScreenProps> = ({
  characters,
  onStartChat,
  onToggleFavorite,
  onImportCard,
}) => {
  // Top Primary Switcher: Catalog Grid vs Match Mode
  const [topMode, setTopMode] = useState<TopMode>('catalog');

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
  const [sortDropdownOpen, setSortDropdownOpen] = useState<boolean>(false);

  // Social State
  const [followedCreators, setFollowedCreators] = useState<string[]>([]);
  const [favoriteCharacters, setFavoriteCharacters] = useState<CommunityCharacter[]>([]);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
        const activeCat = POPULAR_COMMUNITY_CATEGORIES.find(c => selectedCategoryValues.includes(c.value) && c.tagId);
        const res = await communityCatalogService.fetchDatacatCharacters({
          search: communitySearch,
          tagIds: activeCat ? activeCat.tagId : undefined,
          page,
          limit: 12,
          sort: communitySort,
          sfwOnly,
        });
        setCommunityCharacters(res.characters);
        setCommunityTotalCount(res.totalCount);
        if (res.error) setCommunityError(res.error);
      } else {
        const activeTag = selectedCategoryValues.includes('all') ? undefined : selectedCategoryValues[0];
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
    if (communityLoading || isLoadingMore || scopeMode === 'favorites') return;
    setIsLoadingMore(true);
    const nextPage = currentPage + 1;
    try {
      let newChars: CommunityCharacter[] = [];
      if (catalogSource === 'janitor') {
        const activeCat = POPULAR_COMMUNITY_CATEGORIES.find(c => selectedCategoryValues.includes(c.value) && c.tagId);
        const res = await communityCatalogService.fetchDatacatCharacters({
          search: communitySearch,
          tagIds: activeCat ? activeCat.tagId : undefined,
          page: nextPage,
          limit: 12,
          sort: communitySort,
          sfwOnly,
        });
        newChars = res.characters;
      } else {
        const activeTag = selectedCategoryValues.includes('all') ? undefined : selectedCategoryValues[0];
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
        return [val];
      }
    });
  };

  const handleSearchSubmit = () => {
    setCommunitySearch(communitySearchInput.trim());
  };

  const handleToggleFollowCreator = async (creatorName: string, avatarUrl?: string) => {
    const next = await storageService.toggleFollowCreator(creatorName, avatarUrl);
    loadSocialData();
    showToast(next ? `👤 Now following @${creatorName}` : `Unfollowed @${creatorName}`);
  };

  const handleToggleCommunityFavorite = async (char: CommunityCharacter) => {
    const next = await storageService.toggleCommunityFavorite(char as any);
    loadSocialData();
    showToast(next ? `❤️ Added ${char.name} to Favorites` : `Removed from Favorites`);
  };

  // Creator Profiles Aggregator
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

    for (const fc of followedCreators) {
      map.set(fc.toLowerCase(), {
        creatorName: fc,
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        botCount: 12,
        sampleBots: [],
      });
    }

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
          avatarUrl: c.avatarUrl,
          botCount: 1,
          sampleBots: [c.name],
        });
      }
    }

    return Array.from(map.values());
  }, [communityCharacters, followedCreators]);

  const displayedCharacters = useMemo(() => {
    if (scopeMode === 'favorites') {
      return favoriteCharacters.length > 0 ? favoriteCharacters : communityCharacters.slice(0, 4);
    }
    if (scopeMode === 'following') {
      if (followedCreators.length === 0) return [];
      return communityCharacters.filter(c => {
        const handle = (c.creatorName || '').replace(/^@/, '').toLowerCase();
        return followedCreators.some(f => f.toLowerCase() === handle);
      });
    }
    return communityCharacters;
  }, [communityCharacters, scopeMode, favoriteCharacters, followedCreators]);

  // If in Match Mode, render the Tinder-style Deck
  if (topMode === 'match') {
    return (
      <TinderDeck
        characters={communityCharacters as any}
        onBack={() => setTopMode('catalog')}
        onMatchChat={onStartChat}
        onToggleFavorite={onToggleFavorite as any}
      />
    );
  }

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
      {/* 0. BRAND HEADER (Matches Warden AI Image 5 Header Hierarchy)       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <View style={styles.topBrandHeader}>
        <View style={styles.brandLeft}>
          <TouchableOpacity style={styles.brandIconBtn} activeOpacity={0.7}>
            <Menu size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.brandTitleWrap}>
            <Text style={styles.brandTitleText}>NekoChat</Text>
            <View style={styles.brandDotLime} />
          </View>
        </View>

        <View style={styles.brandRight}>
          <TouchableOpacity
            style={styles.brandIconBtn}
            activeOpacity={0.7}
            onPress={() => {
              // Focus search
            }}
          >
            <Search size={16} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.brandIconBtn} activeOpacity={0.7}>
            <Bell size={16} color="#9ca3af" />
            <View style={styles.bellUnreadDot} />
          </TouchableOpacity>

          <View style={styles.profileAvatarCircle}>
            <Text style={styles.profileAvatarLetter}>N</Text>
          </View>
        </View>
      </View>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 1. TOP PRIMARY SWITCHER: [ 🗂️ Catalog Grid ] | [ 🔥 Match Mode ]  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
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
            style={[styles.topPrimaryBtn, topMode === 'match' && styles.topPrimaryBtnActive]}
            onPress={() => setTopMode('match')}
            activeOpacity={0.8}
          >
            <Flame size={13} color={topMode === 'match' ? '#000000' : '#d4ff00'} style={{ marginRight: 5 }} />
            <Text style={[styles.topPrimaryBtnText, topMode === 'match' && styles.topPrimaryBtnTextActive]}>
              Match Mode
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 2. SUB-HEADER TOOLBAR: Explore All vs My Library & Sources         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
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
              <Text style={styles.libraryCountText}>{characters.length || 20}</Text>
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
                title="Refresh Catalog Feed"
              >
                <RefreshCw size={13} color="#9ca3af" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 3. SEARCH BAR WITH KEYBOARD BADGE                                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBarWrapper}>
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
      </View>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 4. 18 CANONICAL TAG STRIP + DRAWER [🎛️] & EXPAND [⌵]               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <View style={styles.tagStripContainer}>
        <TouchableOpacity
          style={styles.tagDrawerBtn}
          onPress={() => setIsTagDrawerOpen(true)}
          activeOpacity={0.7}
          title="Filter Drawer"
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
            <Text style={[styles.pillSegmentText, !sfwOnly && styles.pillSegmentTextActive]}>
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pillSegment, sfwOnly && styles.pillSegmentActive]}
            onPress={() => setSfwOnly(true)}
            activeOpacity={0.8}
          >
            <EyeOff size={12} color={sfwOnly ? '#000000' : '#9ca3af'} style={{ marginRight: 4 }} />
            <Text style={[styles.pillSegmentText, sfwOnly && styles.pillSegmentTextActive]}>
              Limited Only
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scope: All | Following | Favorites */}
      <View style={styles.scopeRow}>
        <View style={styles.pillGroupFull}>
          <TouchableOpacity
            style={[styles.pillSegment, scopeMode === 'all' && styles.pillSegmentActive]}
            onPress={() => setScopeMode('all')}
            activeOpacity={0.8}
          >
            <Globe size={12} color={scopeMode === 'all' ? '#000000' : '#9ca3af'} style={{ marginRight: 4 }} />
            <Text style={[styles.pillSegmentText, scopeMode === 'all' && styles.pillSegmentTextActive]}>
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pillSegment, scopeMode === 'following' && styles.pillSegmentActive]}
            onPress={() => setScopeMode('following')}
            activeOpacity={0.8}
          >
            <Users size={12} color={scopeMode === 'following' ? '#000000' : '#9ca3af'} style={{ marginRight: 4 }} />
            <Text style={[styles.pillSegmentText, scopeMode === 'following' && styles.pillSegmentTextActive]}>
              Following {followedCreators.length > 0 ? `(${followedCreators.length})` : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pillSegment, scopeMode === 'favorites' && styles.pillSegmentActive]}
            onPress={() => setScopeMode('favorites')}
            activeOpacity={0.8}
          >
            <Heart size={12} color={scopeMode === 'favorites' ? '#000000' : '#9ca3af'} style={{ marginRight: 4 }} />
            <Text style={[styles.pillSegmentText, scopeMode === 'favorites' && styles.pillSegmentTextActive]}>
              Favorites
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Count & Sort Row */}
      <View style={styles.sortCountRow}>
        <TouchableOpacity
          style={styles.sortDropdownBtn}
          onPress={() => setSortDropdownOpen(prev => !prev)}
          activeOpacity={0.8}
        >
          <Text style={styles.sortDropdownText}>
            {communitySort === 'latest' ? '✨ Latest' : communitySort === 'trending' ? '🔥 Trending' : '❤️ Popular'}
          </Text>
          <ChevronDown size={12} color="#9ca3af" style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>
            {displayedCharacters.length} companions loaded • Infinite Scroll
          </Text>
        </View>
      </View>

      {sortDropdownOpen && (
        <View style={styles.sortDropdownMenu}>
          {(['latest', 'trending', 'popular'] as CatalogSort[]).map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.sortMenuItem, communitySort === s && styles.sortMenuItemActive]}
              onPress={() => {
                setCommunitySort(s);
                setSortDropdownOpen(false);
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.sortMenuItemText,
                  communitySort === s && styles.sortMenuItemTextActive,
                ]}
              >
                {s === 'latest' ? '✨ Latest' : s === 'trending' ? '🔥 Trending' : '❤️ Popular'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 6. MAIN CONTENT: 2-COLUMN BENTO GRID WITH TRUE INFINITE SCROLL     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {communityLoading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="large" color="#d4ff00" />
          <Text style={styles.loaderText}>Loading NekoChat companions...</Text>
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
                  <Image source={{ uri: creator.avatarUrl }} style={styles.creatorAvatar} />
                  <View style={styles.creatorInfoCol}>
                    <View style={styles.creatorNameRow}>
                      <Text style={styles.creatorCardName}>@{creator.creatorName}</Text>
                      <CheckCircle2 size={13} color="#d4ff00" style={{ marginLeft: 3 }} />
                    </View>
                    <Text style={styles.creatorBotCount}>{creator.botCount}+ public companions</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.creatorFollowBtn, isFollowing && styles.creatorFollowBtnActive]}
                    onPress={() => handleToggleFollowCreator(creator.creatorName, creator.avatarUrl)}
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
                    setEntityMode('characters');
                    setScopeMode('all');
                    setCommunitySearchInput(creator.creatorName);
                    setCommunitySearch(creator.creatorName);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.viewBotsBtnText}>
                    View all companions by @{creator.creatorName} →
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
              onToggleFollowCreator={(creatorName, avatarUrl) =>
                handleToggleFollowCreator(creatorName, avatarUrl)
              }
              onCreatorClick={cName => {
                setCommunitySearchInput(cName);
                setCommunitySearch(cName);
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
            isLoadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#d4ff00" />
                <Text style={styles.footerLoaderText}>Streaming more characters...</Text>
              </View>
            ) : null
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
                    ? 'No Followed Creators Yet'
                    : scopeMode === 'favorites'
                    ? 'No Saved Favorites'
                    : 'No Characters Found'}
                </Text>
                <Text style={styles.emptyDesc}>
                  {scopeMode === 'following'
                    ? 'Tap "+ Follow" on any character card to see companions from your favorite creators here.'
                    : scopeMode === 'favorites'
                    ? 'Tap the Bookmark icon on any card to save it here for fast access.'
                    : 'Try adjusting your search terms or selecting another tag.'}
                </Text>
              </View>
            )
          }
        />
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
        onToggleFavorite={onToggleFavorite}
        onTagClick={tagName => {
          setSelectedCommunityChar(null);
          setCommunitySearchInput(tagName);
          setCommunitySearch(tagName);
        }}
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
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f121d',
    borderWidth: 1,
    borderColor: '#1e2436',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 36,
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
    backgroundColor: '#0f121d',
    borderWidth: 1,
    borderColor: '#1e2436',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#0f121d',
    borderWidth: 1,
    borderColor: '#1e2436',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
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
    backgroundColor: '#0f121d',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1e2436',
    padding: 2,
  },
  pillGroupFull: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f121d',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1e2436',
    padding: 2,
    width: '100%',
    justifyContent: 'space-between',
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
    backgroundColor: '#0f121d',
    borderWidth: 1,
    borderColor: '#1e2436',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    backgroundColor: '#0f121d',
    borderWidth: 1,
    borderColor: '#1e2436',
    borderRadius: 10,
    padding: 4,
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
  countBadge: {
    backgroundColor: '#0f121d',
    borderWidth: 1,
    borderColor: '#1e2436',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
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
    backgroundColor: '#0f121d',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e2436',
    padding: 12,
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
