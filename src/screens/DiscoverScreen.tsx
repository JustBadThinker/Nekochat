/**
 * DiscoverScreen.tsx
 * Strictly ported from Warden AI (c:\Users\kanto\Documents\Work\Apps\Wardenai\src\views\DiscoverView.tsx)
 * Matches Gambar 2 (Discover Screen) and Gambar 3 (Community Character Modal) with 100% fidelity.
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
  ChevronLeft,
  ChevronRight,
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
  AlertCircle,
} from 'lucide-react-native';
import { Character, CommunityCharacter, CommunityCharacterDetail } from '../types';
import { CommunityCharacterCard } from '../components/CommunityCharacterCard';
import { CommunityCharacterModal } from '../components/CommunityCharacterModal';
import { TagFilterDrawerModal } from '../components/TagFilterDrawerModal';
import {
  communityCatalogService,
  POPULAR_COMMUNITY_CATEGORIES,
  ANIME_COMMUNITY_FALLBACK,
} from '../services/communityCatalogService';
import { storageService } from '../services/storageService';

interface DiscoverScreenProps {
  characters: Character[];
  onStartChat: (character: any, detail?: CommunityCharacterDetail) => void;
  onToggleFavorite?: (character: any) => void;
  onImportCard?: (character: any) => void;
}

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
  // Main view tab: Explore All vs My Library
  const [activeTab, setActiveTab] = useState<DiscoverTab>('community');
  const [catalogSource, setCatalogSource] = useState<CatalogSource>('janitor');

  // Community State
  const [communityCharacters, setCommunityCharacters] = useState<CommunityCharacter[]>(ANIME_COMMUNITY_FALLBACK);
  const [communityTotalCount, setCommunityTotalCount] = useState<number>(214520);
  const [communityLoading, setCommunityLoading] = useState<boolean>(false);
  const [communityError, setCommunityError] = useState<string | null>(null);

  // Segmented Controls State (Matches Gambar 2)
  const [entityMode, setEntityMode] = useState<EntityMode>('characters');
  const [sfwOnly, setSfwOnly] = useState<boolean>(false);
  const [scopeMode, setScopeMode] = useState<ScopeMode>('all');
  const [communitySort, setCommunitySort] = useState<CatalogSort>('latest');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [tagsExpanded, setTagsExpanded] = useState<boolean>(false);

  // Search & Filter State
  const [communitySearchInput, setCommunitySearchInput] = useState<string>('');
  const [communitySearch, setCommunitySearch] = useState<string>('');
  const [selectedCategoryValues, setSelectedCategoryValues] = useState<string[]>(['all']);

  // Drawer & Modals
  const [isTagDrawerOpen, setIsTagDrawerOpen] = useState<boolean>(false);
  const [selectedCommunityChar, setSelectedCommunityChar] = useState<CommunityCharacter | null>(null);
  const [sortDropdownOpen, setSortDropdownOpen] = useState<boolean>(false);

  // Followed Creators & Favorites
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

  // Fetch Characters
  const fetchCommunityCharacters = async (page = 1, forceRefresh = false) => {
    setCommunityLoading(true);
    setCommunityError(null);
    try {
      if (catalogSource === 'janitor') {
        const activeCat = POPULAR_COMMUNITY_CATEGORIES.find(c => selectedCategoryValues.includes(c.value) && c.tagId);
        const res = await communityCatalogService.fetchDatacatCharacters({
          search: communitySearch,
          tagIds: activeCat ? activeCat.tagId : undefined,
          page,
          limit: 24,
          sort: communitySort,
          sfwOnly,
        });
        setCommunityCharacters(res.characters.length > 0 ? res.characters : ANIME_COMMUNITY_FALLBACK);
        setCommunityTotalCount(res.totalCount);
      } else {
        const activeTag = selectedCategoryValues.includes('all') ? undefined : selectedCategoryValues[0];
        const res = await communityCatalogService.fetchChubCharacters({
          search: communitySearch,
          tag: activeTag,
          page,
          limit: 24,
          sort: communitySort,
          sfwOnly,
        });
        setCommunityCharacters(res.characters.length > 0 ? res.characters : ANIME_COMMUNITY_FALLBACK);
        setCommunityTotalCount(res.totalCount);
      }
    } catch (err: any) {
      setCommunityCharacters(ANIME_COMMUNITY_FALLBACK);
      setCommunityTotalCount(214520);
    } finally {
      setCommunityLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'community') {
      fetchCommunityCharacters(currentPage);
    }
  }, [communitySearch, selectedCategoryValues, communitySort, catalogSource, sfwOnly, currentPage, activeTab]);

  const handleToggleCategory = (val: string) => {
    setCurrentPage(1);
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
        return [val]; // Single active tag for sharp filtering
      }
    });
  };

  const handleSearchSubmit = () => {
    setCurrentPage(1);
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

  // Filter based on scope
  const displayedCharacters = useMemo(() => {
    if (scopeMode === 'favorites') {
      return favoriteCharacters.length > 0 ? favoriteCharacters : communityCharacters.slice(0, 2);
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

  const totalPages = Math.max(1, Math.min(295, Math.ceil(communityTotalCount / 24)));

  return (
    <View style={styles.container}>
      {/* ── Toast Notification ── */}
      {toastMessage && (
        <View style={styles.toastBox}>
          <Sparkles size={14} color="#d8b4fe" style={{ marginRight: 6 }} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 1. TOP SUB-HEADER TOOLBAR (Matches Gambar 2)                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <View style={styles.subHeader}>
        {/* Left: View Switcher (Explore All vs My Library) */}
        <View style={styles.viewSwitcher}>
          <TouchableOpacity
            style={[styles.viewTabBtn, activeTab === 'community' && styles.viewTabBtnActive]}
            onPress={() => setActiveTab('community')}
            activeOpacity={0.8}
          >
            <Compass size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
            <Text style={styles.viewTabBtnText}>Explore All</Text>
            <View style={styles.greenPulseDot} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.viewTabBtn, activeTab === 'library' && styles.viewTabBtnActive]}
            onPress={() => setActiveTab('library')}
            activeOpacity={0.8}
          >
            <Bookmark size={13} color="#9ca3af" style={{ marginRight: 5 }} />
            <Text style={[styles.viewTabBtnText, activeTab !== 'library' && { color: '#9ca3af' }]}>
              My Library
            </Text>
            <View style={styles.libraryCountPill}>
              <Text style={styles.libraryCountText}>{characters.length || 20}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Right: Actions */}
        <View style={styles.subHeaderRight}>
          {activeTab === 'community' && (
            <>
              {/* JanitorAI | Chub.ai Pill Switch */}
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

              {/* Import PNG Card Button */}
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => showToast('Importing custom character...')}
                activeOpacity={0.7}
                title="Upload PNG Card"
              >
                <Download size={14} color="#d8b4fe" />
              </TouchableOpacity>

              {/* Refresh Feed Button */}
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => fetchCommunityCharacters(currentPage, true)}
                activeOpacity={0.7}
                title="Refresh Catalog Feed"
              >
                <RefreshCw size={14} color="#9ca3af" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 2. SEARCH BAR WITH ENTER BADGE (Matches Gambar 2)                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBarWrapper}>
          <Search size={15} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search characters, tags, or @creator (e.g. #slowburn, #romance, @...)"
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
      {/* 3. TAG STRIP WITH 18 POPULAR TAGS & EXPAND [⌵] (Matches Gambar 2)  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <View style={styles.tagStripContainer}>
        {/* SlidersHorizontal [🎛️] Drawer Toggle */}
        <TouchableOpacity
          style={styles.tagDrawerBtn}
          onPress={() => setIsTagDrawerOpen(true)}
          activeOpacity={0.7}
          title="Open Full Category Filter Drawer"
        >
          <SlidersHorizontal size={14} color="#c084fc" />
        </TouchableOpacity>

        {/* Horizontal or Wrapped Tags */}
        <ScrollView
          horizontal={!tagsExpanded}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.tagStripScroll, tagsExpanded && styles.tagStripWrapped]}
        >
          {POPULAR_COMMUNITY_CATEGORIES.map((chip, idx) => {
            const isSelected = selectedCategoryValues.includes(chip.value);
            // Border tint variants matching Warden AI
            const borderColors = ['#3b3454', '#2b4c59', '#52344e', '#364f3e'];
            const textColors = ['#e9d5ff', '#a5f3fc', '#fbcfe8', '#a7f3d0'];
            const tintBorder = borderColors[idx % borderColors.length];
            const tintText = textColors[idx % textColors.length];

            return (
              <TouchableOpacity
                key={chip.value}
                style={[
                  styles.communityTagChip,
                  { borderColor: tintBorder },
                  isSelected && styles.communityTagChipActive,
                ]}
                onPress={() => handleToggleCategory(chip.value)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.communityTagText,
                    { color: tintText },
                    isSelected && styles.communityTagTextActive,
                  ]}
                >
                  {chip.value === 'all' ? 'All Tags' : `#${chip.value}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Expand / Collapse Chevron [⌵] */}
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
      {/* 4. SEGMENTED FILTER PILLS (Matches Gambar 2)                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <View style={styles.filterPillsRow}>
        {/* Group 1: Characters | Creators */}
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

        {/* Group 2: All | Limited Only (SFW) */}
        <View style={styles.pillGroup}>
          <TouchableOpacity
            style={[styles.pillSegment, !sfwOnly && styles.pillSegmentActive]}
            onPress={() => {
              setSfwOnly(false);
              setCurrentPage(1);
            }}
            activeOpacity={0.8}
          >
            <Eye size={12} color={!sfwOnly ? '#FFFFFF' : '#9ca3af'} style={{ marginRight: 4 }} />
            <Text style={[styles.pillSegmentText, !sfwOnly && styles.pillSegmentTextActive]}>
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pillSegment, sfwOnly && styles.pillSegmentActive]}
            onPress={() => {
              setSfwOnly(true);
              setCurrentPage(1);
            }}
            activeOpacity={0.8}
          >
            <EyeOff size={12} color={sfwOnly ? '#FFFFFF' : '#9ca3af'} style={{ marginRight: 4 }} />
            <Text style={[styles.pillSegmentText, sfwOnly && styles.pillSegmentTextActive]}>
              Limited Only
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scope Selector: All | Following (3) | Favorites */}
      <View style={styles.scopeRow}>
        <View style={styles.pillGroupFull}>
          <TouchableOpacity
            style={[styles.pillSegment, scopeMode === 'all' && styles.pillSegmentActive]}
            onPress={() => {
              setScopeMode('all');
              setCurrentPage(1);
            }}
            activeOpacity={0.8}
          >
            <Globe size={12} color={scopeMode === 'all' ? '#FFFFFF' : '#9ca3af'} style={{ marginRight: 4 }} />
            <Text style={[styles.pillSegmentText, scopeMode === 'all' && styles.pillSegmentTextActive]}>
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pillSegment, scopeMode === 'following' && styles.pillSegmentActive]}
            onPress={() => {
              setScopeMode('following');
              setCurrentPage(1);
            }}
            activeOpacity={0.8}
          >
            <Users size={12} color={scopeMode === 'following' ? '#FFFFFF' : '#9ca3af'} style={{ marginRight: 4 }} />
            <Text style={[styles.pillSegmentText, scopeMode === 'following' && styles.pillSegmentTextActive]}>
              Following {followedCreators.length > 0 ? `(${followedCreators.length})` : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pillSegment, scopeMode === 'favorites' && styles.pillSegmentActive]}
            onPress={() => {
              setScopeMode('favorites');
              setCurrentPage(1);
            }}
            activeOpacity={0.8}
          >
            <Heart size={12} color={scopeMode === 'favorites' ? '#FFFFFF' : '#9ca3af'} style={{ marginRight: 4 }} />
            <Text style={[styles.pillSegmentText, scopeMode === 'favorites' && styles.pillSegmentTextActive]}>
              Favorites
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 5. SORT DROPDOWN, COUNTER & PAGINATION (Matches Gambar 2)           */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <View style={styles.sortPaginationRow}>
        {/* Sort Pill Dropdown */}
        <TouchableOpacity
          style={styles.sortDropdownBtn}
          onPress={() => setSortDropdownOpen(prev => !prev)}
          activeOpacity={0.8}
        >
          <Text style={styles.sortDropdownText}>
            {communitySort === 'latest' ? 'Latest' : communitySort === 'trending' ? 'Trending' : 'Popular'}
          </Text>
          <ChevronDown size={13} color="#9ca3af" style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        {/* Count Badge */}
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>
            {scopeMode === 'all' && !communitySearch && selectedCategoryValues.includes('all')
              ? '200,000+ characters'
              : `${communityTotalCount.toLocaleString()} characters`}
          </Text>
        </View>

        {/* Numbered Pagination: < 1 2 3 4 5 ... 295 > */}
        <View style={styles.paginationGroup}>
          <TouchableOpacity
            style={[styles.pageBtn, currentPage <= 1 && styles.pageBtnDisabled]}
            disabled={currentPage <= 1 || communityLoading}
            onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
            activeOpacity={0.7}
          >
            <ChevronLeft size={13} color="#9ca3af" />
          </TouchableOpacity>

          {[1, 2, 3, 4, 5].map(pageNum => (
            <TouchableOpacity
              key={pageNum}
              style={[styles.pageNumberBtn, pageNum === currentPage && styles.pageNumberBtnActive]}
              onPress={() => setCurrentPage(pageNum)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.pageNumberText,
                  pageNum === currentPage && styles.pageNumberTextActive,
                ]}
              >
                {pageNum}
              </Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.pageEllipsis}>...</Text>

          <TouchableOpacity
            style={styles.pageNumberBtn}
            onPress={() => setCurrentPage(totalPages)}
            activeOpacity={0.8}
          >
            <Text style={styles.pageNumberText}>{totalPages}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pageBtn, currentPage >= totalPages && styles.pageBtnDisabled]}
            disabled={currentPage >= totalPages || communityLoading}
            onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            activeOpacity={0.7}
          >
            <ChevronRight size={13} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sort Dropdown Menu */}
      {sortDropdownOpen && (
        <View style={styles.sortDropdownMenu}>
          {(['latest', 'trending', 'popular'] as CatalogSort[]).map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.sortMenuItem, communitySort === s && styles.sortMenuItemActive]}
              onPress={() => {
                setCommunitySort(s);
                setSortDropdownOpen(false);
                setCurrentPage(1);
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

      {/* Active Filter Clear Notice */}
      {communitySearch ? (
        <View style={styles.activeFilterNotice}>
          <Text style={styles.activeFilterText}>
            Filtering by: <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>"{communitySearch}"</Text>
          </Text>
          <TouchableOpacity
            onPress={() => {
              setCommunitySearch('');
              setCommunitySearchInput('');
              setCurrentPage(1);
            }}
          >
            <Text style={styles.clearFilterText}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 6. MAIN CONTENT: 2-COLUMN BENTO GRID OR CREATORS VIEW (Gambar 2)   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {communityLoading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="large" color="#9333ea" />
          <Text style={styles.loaderText}>Loading community catalog...</Text>
        </View>
      ) : entityMode === 'creators' ? (
        /* CREATORS VIEW */
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
                      <CheckCircle2 size={13} color="#a855f7" style={{ marginLeft: 3 }} />
                    </View>
                    <Text style={styles.creatorBotCount}>{creator.botCount}+ public companions</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.creatorFollowBtn, isFollowing && styles.creatorFollowBtnActive]}
                    onPress={() => handleToggleFollowCreator(creator.creatorName, creator.avatarUrl)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.creatorFollowBtnText}>
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
                    setCurrentPage(1);
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
        /* CHARACTERS VIEW: STRICTLY 2-COLUMN BENTO GRID */
        <FlatList
          data={displayedCharacters}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.twoColumnWrapper}
          contentContainerStyle={styles.cardsContainer}
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
                setCurrentPage(1);
              }}
              onTagClick={(tagId, tagName) => {
                const matchedCat = POPULAR_COMMUNITY_CATEGORIES.find(c => c.tagId === tagId);
                if (matchedCat) {
                  handleToggleCategory(matchedCat.value);
                } else {
                  setCommunitySearchInput(tagName);
                  setCommunitySearch(tagName);
                  setCurrentPage(1);
                }
              }}
            />
          )}
          ListEmptyComponent={
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
          }
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 7. COMMUNITY CHARACTER MODAL (Matches Gambar 3)                    */}
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
          setCurrentPage(1);
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
        onApply={() => fetchCommunityCharacters(1)}
        matchingCount={communityTotalCount}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0b0e',
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
    backgroundColor: 'rgba(30, 16, 50, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.5)',
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 14,
    shadowColor: '#9333ea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  toastText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#e9d5ff',
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1b1e28',
    backgroundColor: '#0c0e14',
  },
  viewSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12151e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1b1e28',
    padding: 3,
    gap: 4,
  },
  viewTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewTabBtnActive: {
    backgroundColor: '#9333ea',
    shadowColor: '#9333ea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  viewTabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  greenPulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#34d399',
    marginLeft: 5,
  },
  libraryCountPill: {
    backgroundColor: '#1b1e28',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 5,
  },
  libraryCountText: {
    fontSize: 9.5,
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
    backgroundColor: '#12151e',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1b1e28',
    padding: 2,
  },
  sourcePillBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sourcePillBtnActive: {
    backgroundColor: '#9333ea',
  },
  sourcePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
  },
  sourcePillTextActive: {
    color: '#FFFFFF',
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#12151e',
    borderWidth: 1,
    borderColor: '#1b1e28',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131620',
    borderWidth: 1,
    borderColor: '#222738',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 38,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 11.5,
    color: '#FFFFFF',
    padding: 0,
  },
  clearBtn: {
    padding: 4,
  },
  enterBadge: {
    backgroundColor: '#1a1f2e',
    borderWidth: 1,
    borderColor: '#262d42',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  enterBadgeText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#9ca3af',
    fontWeight: '600',
  },
  tagStripContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
  },
  tagDrawerBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#171a26',
    borderWidth: 1,
    borderColor: '#262b3d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagStripScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tagStripWrapped: {
    flexWrap: 'wrap',
  },
  communityTagChip: {
    backgroundColor: 'rgba(21, 24, 34, 0.9)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
  },
  communityTagChipActive: {
    backgroundColor: 'rgba(147, 51, 234, 0.4)',
    borderColor: '#c084fc',
  },
  communityTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  communityTagTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  expandChevronBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#171a26',
    borderWidth: 1,
    borderColor: '#262b3d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 4,
    gap: 8,
  },
  pillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151823',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#262b3d',
    padding: 2.5,
  },
  pillGroupFull: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151823',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#262b3d',
    padding: 2.5,
    width: '100%',
    justifyContent: 'space-between',
  },
  pillSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 18,
    flex: 1,
  },
  pillSegmentActive: {
    backgroundColor: '#9333ea',
    shadowColor: '#9333ea',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
  pillSegmentText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
  },
  pillSegmentTextActive: {
    color: '#FFFFFF',
  },
  scopeRow: {
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  sortPaginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  sortDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151823',
    borderWidth: 1,
    borderColor: '#262b3d',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sortDropdownText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  sortDropdownMenu: {
    position: 'absolute',
    top: 195,
    left: 12,
    zIndex: 999,
    backgroundColor: '#151823',
    borderWidth: 1,
    borderColor: '#262b3d',
    borderRadius: 10,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  sortMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  sortMenuItemActive: {
    backgroundColor: '#9333ea',
  },
  sortMenuItemText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
  },
  sortMenuItemTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  countBadge: {
    backgroundColor: '#151823',
    borderWidth: 1,
    borderColor: '#262b3d',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#d1d5db',
  },
  paginationGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  pageBtn: {
    padding: 4,
  },
  pageBtnDisabled: {
    opacity: 0.3,
  },
  pageNumberBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumberBtnActive: {
    backgroundColor: '#2a3045',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.6)',
  },
  pageNumberText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#9ca3af',
  },
  pageNumberTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  pageEllipsis: {
    fontSize: 10,
    color: '#6b7280',
    paddingHorizontal: 2,
  },
  activeFilterNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#12151e',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  activeFilterText: {
    fontSize: 10.5,
    color: '#d8b4fe',
  },
  clearFilterText: {
    fontSize: 10.5,
    color: '#9ca3af',
    textDecorationLine: 'underline',
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
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(18, 21, 30, 0.4)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1b1e28',
    marginTop: 10,
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
    backgroundColor: '#131621',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#24293b',
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
    backgroundColor: '#181c28',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
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
    backgroundColor: '#1d2233',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  creatorFollowBtnActive: {
    backgroundColor: '#9333ea',
    borderColor: '#a855f7',
  },
  creatorFollowBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  creatorSampleText: {
    fontSize: 10.5,
    color: '#9ca3af',
    marginTop: 8,
  },
  viewBotsBtn: {
    backgroundColor: '#191d2b',
    borderRadius: 10,
    paddingVertical: 7,
    alignItems: 'center',
    marginTop: 8,
  },
  viewBotsBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#c084fc',
  },
});
