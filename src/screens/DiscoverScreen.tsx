/**
 * Discover Screen (Warden AI Architecture)
 * Distinct views for:
 * 1. Chub.ai Catalog (with Scope: All / Following / Favorites & Sorting: Trending / Popular / Latest)
 * 2. Janitor / Datacat Hub (Dedicated feed with live Janitor cards)
 * 3. Match Mode (Tinder-style swipe deck with filter pop-up)
 * Clicking any card opens the CommunityCharacterModal.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  Search,
  Flame,
  LayoutGrid,
  MessageSquare,
  Star,
  Play,
  Heart,
  Users,
  Sparkles,
  ExternalLink,
  Layers,
} from 'lucide-react-native';
import { Character } from '../types';
import { TinderDeck } from '../components/TinderDeck';
import { CommunityCharacterModal } from '../components/CommunityCharacterModal';
import { communityCatalogService, ANIME_COMMUNITY_FALLBACK } from '../services/communityCatalogService';
import { storageService } from '../services/storageService';

interface DiscoverScreenProps {
  characters: Character[];
  onStartChat: (character: Character) => void;
  onToggleFavorite: (character: Character) => void;
}

type DiscoverViewTab = 'chub' | 'datacat' | 'match';
type ScopeFilter = 'all' | 'following' | 'favorites';
type SortFilter = 'trending' | 'popular' | 'latest';

export const DiscoverScreen: React.FC<DiscoverScreenProps> = ({
  onStartChat,
  onToggleFavorite,
}) => {
  const [activeTab, setActiveTab] = useState<DiscoverViewTab>('chub');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [sort, setSort] = useState<SortFilter>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');

  const [chubCharacters, setChubCharacters] = useState<Character[]>(ANIME_COMMUNITY_FALLBACK);
  const [datacatCharacters, setDatacatCharacters] = useState<Character[]>([]);
  const [followedCreators, setFollowedCreators] = useState<string[]>([]);
  const [favoriteCharacters, setFavoriteCharacters] = useState<Character[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [selectedModalChar, setSelectedModalChar] = useState<Character | null>(null);

  const tags = ['All', 'Romance', 'Anime', 'Fantasy', 'Cyberpunk', 'Slice of Life', 'Comfort', 'Action'];

  useEffect(() => {
    loadSocialData();
    if (activeTab === 'chub') {
      fetchChubCatalog();
    } else if (activeTab === 'datacat') {
      fetchDatacatCatalog();
    }
  }, [activeTab, sort, selectedTag]);

  const loadSocialData = async () => {
    const follows = await storageService.getFollowedCreators();
    setFollowedCreators(follows);
    const favs = await storageService.getCommunityFavorites();
    setFavoriteCharacters(favs);
  };

  const fetchChubCatalog = async (queryText?: string) => {
    setIsLoading(true);
    try {
      const q = queryText !== undefined ? queryText : searchQuery;
      const res = await communityCatalogService.fetchChubCharacters({
        search: q,
        tag: selectedTag,
        sort,
        limit: 24,
      });
      setChubCharacters(res.length > 0 ? res : ANIME_COMMUNITY_FALLBACK);
    } catch {
      setChubCharacters(ANIME_COMMUNITY_FALLBACK);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDatacatCatalog = async (queryText?: string) => {
    setIsLoading(true);
    try {
      const q = queryText !== undefined ? queryText : searchQuery;
      const res = await communityCatalogService.fetchDatacatCharacters({
        search: q,
        tag: selectedTag,
        limit: 24,
      });
      setDatacatCharacters(res.length > 0 ? res : ANIME_COMMUNITY_FALLBACK);
    } catch {
      setDatacatCharacters(ANIME_COMMUNITY_FALLBACK);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = () => {
    if (activeTab === 'chub') {
      fetchChubCatalog(searchQuery);
    } else if (activeTab === 'datacat') {
      fetchDatacatCatalog(searchQuery);
    }
  };

  // Filter based on scope (All / Following / Favorites)
  const getDisplayedCharacters = () => {
    const baseList = activeTab === 'chub' ? chubCharacters : datacatCharacters;

    if (scope === 'favorites') {
      return favoriteCharacters;
    }

    if (scope === 'following') {
      if (followedCreators.length === 0) return [];
      return baseList.filter(c => {
        const handle = c.creator.replace(/^@/, '').toLowerCase();
        return followedCreators.some(f => f.toLowerCase() === handle);
      });
    }

    return baseList;
  };

  const displayedList = getDisplayedCharacters();

  // If Match Mode is active, render Match Deck
  if (activeTab === 'match') {
    return (
      <TinderDeck
        characters={chubCharacters}
        onBack={() => setActiveTab('chub')}
        onMatchChat={onStartChat}
        onToggleFavorite={onToggleFavorite}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 1. Dedicated Top Hub Tabs (Chub.ai vs Datacat Hub vs Match Mode) */}
      <View style={styles.topTabsContainer}>
        <View style={styles.topTabsPill}>
          <TouchableOpacity
            style={[styles.topTabBtn, activeTab === 'chub' && styles.topTabBtnActive]}
            onPress={() => {
              setActiveTab('chub');
              setScope('all');
            }}
          >
            <Text style={[styles.topTabText, activeTab === 'chub' && styles.topTabTextActive]}>
              Chub.ai
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.topTabBtn, activeTab === 'datacat' && styles.topTabBtnActive]}
            onPress={() => {
              setActiveTab('datacat');
              setScope('all');
            }}
          >
            <Text style={[styles.topTabText, activeTab === 'datacat' && styles.topTabTextActive]}>
              Janitor / Datacat
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.topTabBtn, activeTab === 'match' && styles.topTabBtnActive]}
            onPress={() => setActiveTab('match')}
          >
            <Flame size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={[styles.topTabText, activeTab === 'match' && styles.topTabTextActive]}>
              Match Mode
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Scope Selector: All | Following | Favorites (Ref: Warden AI) */}
      <View style={styles.scopeStrip}>
        <View style={styles.scopeButtonsRow}>
          <TouchableOpacity
            style={[styles.scopeBtn, scope === 'all' && styles.scopeBtnActive]}
            onPress={() => setScope('all')}
          >
            <Text style={[styles.scopeBtnText, scope === 'all' && styles.scopeBtnTextActive]}>
              All Characters
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.scopeBtn, scope === 'following' && styles.scopeBtnActive]}
            onPress={() => {
              setScope('following');
              loadSocialData();
            }}
          >
            <Users size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={[styles.scopeBtnText, scope === 'following' && styles.scopeBtnTextActive]}>
              Following ({followedCreators.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.scopeBtn, scope === 'favorites' && styles.scopeBtnActive]}
            onPress={() => {
              setScope('favorites');
              loadSocialData();
            }}
          >
            <Heart size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={[styles.scopeBtnText, scope === 'favorites' && styles.scopeBtnTextActive]}>
              Favorites ({favoriteCharacters.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. Search Bar & Sorting Controls */}
      {scope === 'all' && (
        <>
          <View style={styles.searchRow}>
            <View style={styles.searchBar}>
              <Search size={15} color="rgba(255, 255, 255, 0.45)" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder={`Search ${activeTab === 'chub' ? 'Chub.ai' : 'Janitor'} anime companions...`}
                placeholderTextColor="rgba(255, 255, 255, 0.35)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
              />
              {isLoading && <ActivityIndicator size="small" color="#FFFFFF" style={{ marginLeft: 6 }} />}
            </View>

            {/* Sort Toggle (Trending / Popular / Latest) */}
            <View style={styles.sortTogglePill}>
              <TouchableOpacity
                style={[styles.sortBtn, sort === 'trending' && styles.sortBtnActive]}
                onPress={() => setSort('trending')}
              >
                <Text style={[styles.sortBtnText, sort === 'trending' && styles.sortBtnTextActive]}>
                  Hot
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortBtn, sort === 'popular' && styles.sortBtnActive]}
                onPress={() => setSort('popular')}
              >
                <Text style={[styles.sortBtnText, sort === 'popular' && styles.sortBtnTextActive]}>
                  Top
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortBtn, sort === 'latest' && styles.sortBtnActive]}
                onPress={() => setSort('latest')}
              >
                <Text style={[styles.sortBtnText, sort === 'latest' && styles.sortBtnTextActive]}>
                  New
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 4. Tag Chips Horizontal Strip */}
          <View style={{ height: 38, marginBottom: 6 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagChipsList}>
              {tags.map((tag, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.chip, selectedTag === tag && styles.chipActive]}
                  onPress={() => setSelectedTag(tag)}
                >
                  <Text style={[styles.chipText, selectedTag === tag && styles.chipTextActive]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </>
      )}

      {/* 5. Character Catalog List (Clickable Cards) */}
      <FlatList
        data={displayedList}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyStateBox}>
            <Sparkles size={24} color="#FFFFFF" style={{ marginBottom: 10 }} />
            <Text style={styles.emptyTitle}>
              {scope === 'following'
                ? 'No Followed Creators Found'
                : scope === 'favorites'
                ? 'No Favorite Characters'
                : 'No Characters Found'}
            </Text>
            <Text style={styles.emptyDesc}>
              {scope === 'following'
                ? 'Follow creators on character cards to see their companion releases here.'
                : scope === 'favorites'
                ? 'Tap the Star or Heart icon on any card to add it to your favorites.'
                : 'Try adjusting your search terms or genre filter.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.wardenCard}
            onPress={() => setSelectedModalChar(item)}
            activeOpacity={0.88}
          >
            {/* Banner Artwork (Aspect 16/10) */}
            <View style={styles.bannerWrapper}>
              <Image source={{ uri: item.avatar }} style={styles.bannerImage} />

              {/* Top Floating Badges */}
              <View style={styles.bannerTopRow}>
                <View style={styles.tokenBadge}>
                  <Text style={styles.tokenBadgeText}>#{item.tags[0] || 'Anime'}</Text>
                </View>
                <TouchableOpacity
                  style={styles.favBadge}
                  onPress={e => {
                    e.stopPropagation();
                    storageService.toggleCommunityFavorite(item).then(() => {
                      loadSocialData();
                      if (onToggleFavorite) onToggleFavorite(item);
                    });
                  }}
                >
                  <Star
                    size={16}
                    color={favoriteCharacters.some(f => f.id === item.id) ? '#FFD700' : '#FFFFFF'}
                    fill={favoriteCharacters.some(f => f.id === item.id) ? '#FFD700' : 'transparent'}
                  />
                </TouchableOpacity>
              </View>

              {/* Creator Handle Scrim */}
              <View style={styles.bannerBottomScrim}>
                <Text style={styles.creatorName}>{item.creator}</Text>
              </View>
            </View>

            {/* Card Content Body */}
            <View style={styles.cardBody}>
              <Text style={styles.charTitle}>{item.name}</Text>
              <Text style={styles.charTagline}>{item.tagline}</Text>
              <Text style={styles.charBio} numberOfLines={2}>
                {item.description}
              </Text>

              {/* Card Footer Bar */}
              <View style={styles.cardFooter}>
                <View style={styles.statItem}>
                  <MessageSquare size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.statText}>{item.totalChats || 120} chats</Text>
                </View>

                {/* Direct Action Button */}
                <TouchableOpacity
                  style={styles.chatActionBtn}
                  onPress={e => {
                    e.stopPropagation();
                    onStartChat(item);
                  }}
                  activeOpacity={0.8}
                >
                  <Play size={12} color="#FFFFFF" fill="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.chatActionBtnText}>Chat Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* 6. Full Character Detail Modal */}
      <CommunityCharacterModal
        character={selectedModalChar}
        visible={Boolean(selectedModalChar)}
        onClose={() => setSelectedModalChar(null)}
        onStartChat={char => {
          setSelectedModalChar(null);
          onStartChat(char);
        }}
        onToggleFavorite={onToggleFavorite}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0c0e14',
  },
  topTabsContainer: {
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  topTabsPill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 24,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  topTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  topTabBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  topTabText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  topTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scopeStrip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  scopeButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scopeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  scopeBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderColor: '#FFFFFF',
  },
  scopeBtnText: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 11,
    fontWeight: '600',
  },
  scopeBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
  },
  sortTogglePill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sortBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },
  sortBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  sortBtnText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    fontWeight: '600',
  },
  sortBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tagChipsList: {
    paddingHorizontal: 16,
    gap: 6,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  chipText: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 90,
    gap: 16,
  },
  emptyStateBox: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderStyle: 'dashed',
    marginTop: 20,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyDesc: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  wardenCard: {
    backgroundColor: '#12151e',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1b1e28',
    marginBottom: 8,
  },
  bannerWrapper: {
    width: '100%',
    aspectRatio: 16 / 10,
    position: 'relative',
    backgroundColor: '#0c0e14',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerTopRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  tokenBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  tokenBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  favBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  bannerBottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(12, 14, 20, 0.85)',
  },
  creatorName: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    fontWeight: '600',
  },
  cardBody: {
    padding: 14,
  },
  charTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 3,
  },
  charTagline: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  charBio: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    fontWeight: '600',
  },
  chatActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  chatActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
