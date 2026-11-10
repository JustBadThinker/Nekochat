/**
 * Discover Screen (Warden AI Style Card Layout)
 * Features high-res anime banners, stats row, creator handles, and instant chat transition.
 * Pure monochrome white iconography and live Chub.ai / Datacat scrapers.
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
import { Search, Flame, LayoutGrid, MessageSquare, Star, Play, Sparkles } from 'lucide-react-native';
import { Character } from '../types';
import { colors } from '../theme/colors';
import { TinderDeck } from '../components/TinderDeck';
import { communityCatalogService, ANIME_COMMUNITY_FALLBACK } from '../services/communityCatalogService';

interface DiscoverScreenProps {
  characters: Character[];
  onStartChat: (character: Character) => void;
  onToggleFavorite: (character: Character) => void;
}

export const DiscoverScreen: React.FC<DiscoverScreenProps> = ({
  characters: starterCharacters,
  onStartChat,
  onToggleFavorite,
}) => {
  const [mode, setMode] = useState<'grid' | 'match'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');
  const [liveCharacters, setLiveCharacters] = useState<Character[]>(ANIME_COMMUNITY_FALLBACK);
  const [isLoading, setIsLoading] = useState(false);
  const [catalogSource, setCatalogSource] = useState<'chub' | 'datacat'>('chub');

  const tags = ['All', 'Romance', 'Anime', 'Fantasy', 'Cyberpunk', 'Slice of Life', 'Comfort', 'Action'];

  useEffect(() => {
    fetchCatalog();
  }, [selectedTag, catalogSource]);

  const fetchCatalog = async (queryText?: string) => {
    setIsLoading(true);
    try {
      const q = queryText !== undefined ? queryText : searchQuery;
      const live = await communityCatalogService.getLiveCatalog({
        search: q,
        tag: selectedTag,
        source: catalogSource,
        limit: 24,
      });
      setLiveCharacters(live.length > 0 ? live : ANIME_COMMUNITY_FALLBACK);
    } catch {
      setLiveCharacters(ANIME_COMMUNITY_FALLBACK);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = () => {
    fetchCatalog(searchQuery);
  };

  const isGrid = mode === 'grid';

  if (mode === 'match') {
    return (
      <TinderDeck
        characters={liveCharacters}
        onBack={() => setMode('grid')}
        onMatchChat={onStartChat}
        onToggleFavorite={onToggleFavorite}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Segmented Control */}
      <View style={styles.segmentContainer}>
        <View style={styles.segmentPill}>
          <TouchableOpacity
            style={[styles.segmentBtn, isGrid && styles.segmentBtnActive]}
            onPress={() => setMode('grid')}
          >
            <LayoutGrid size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={[styles.segmentBtnText, isGrid && styles.segmentBtnTextActive]}>
              Catalog Cards
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, !isGrid && styles.segmentBtnActive]}
            onPress={() => setMode('match')}
          >
            <Flame size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={[styles.segmentBtnText, !isGrid && styles.segmentBtnTextActive]}>
              Match Mode
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Live Catalog Source Toggle */}
      <View style={styles.sourceSelectorRow}>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live Community Hub</Text>
        </View>

        <View style={styles.sourceButtons}>
          <TouchableOpacity
            style={[styles.sourceBtn, catalogSource === 'chub' && styles.sourceBtnActive]}
            onPress={() => setCatalogSource('chub')}
          >
            <Text style={[styles.sourceBtnText, catalogSource === 'chub' && styles.sourceBtnTextActive]}>
              Chub.ai
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sourceBtn, catalogSource === 'datacat' && styles.sourceBtnActive]}
            onPress={() => setCatalogSource('datacat')}
          >
            <Text style={[styles.sourceBtnText, catalogSource === 'datacat' && styles.sourceBtnTextActive]}>
              Datacat (Janitor)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchBar}>
        <Search size={16} color="rgba(255, 255, 255, 0.45)" style={{ marginRight: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search anime companions, tags, tropes..."
          placeholderTextColor="rgba(255, 255, 255, 0.35)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
        />
        {isLoading && <ActivityIndicator size="small" color="#FFFFFF" style={{ marginLeft: 6 }} />}
      </View>

      {/* Filter Tag Chips */}
      <View style={{ height: 42 }}>
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

      {/* Character Catalog (Warden AI Card Layout) */}
      <FlatList
        data={liveCharacters}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.wardenCard}>
            {/* Aspect Ratio 16/10 Artwork Banner */}
            <View style={styles.bannerWrapper}>
              <Image source={{ uri: item.avatar }} style={styles.bannerImage} />
              
              {/* Top Floating Badges */}
              <View style={styles.bannerTopRow}>
                <View style={styles.tokenBadge}>
                  <Text style={styles.tokenBadgeText}>#{item.tags[0] || 'Anime'}</Text>
                </View>
                <TouchableOpacity
                  style={styles.favBadge}
                  onPress={() => onToggleFavorite(item)}
                >
                  <Star
                    size={16}
                    color={item.isFavorite ? '#FFD700' : '#FFFFFF'}
                    fill={item.isFavorite ? '#FFD700' : 'transparent'}
                  />
                </TouchableOpacity>
              </View>

              {/* Progressive Scrim at Bottom of Banner */}
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

              {/* Stats Bar (Chats count & Action Button) */}
              <View style={styles.cardFooter}>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <MessageSquare size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.statText}>{item.totalChats || 240}</Text>
                  </View>
                </View>

                {/* Quick Start Chat Button */}
                <TouchableOpacity
                  style={styles.chatActionBtn}
                  onPress={() => onStartChat(item)}
                  activeOpacity={0.8}
                >
                  <Play size={12} color="#FFFFFF" fill="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.chatActionBtnText}>Chat Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0c0e14',
  },
  segmentContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  segmentPill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 24,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sourceSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  sourceButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  sourceBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sourceBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: '#FFFFFF',
  },
  sourceBtnText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: '600',
  },
  sourceBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  segmentBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  segmentBtnText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
  },
  tagChipsList: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
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
    fontSize: 12,
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
    color: 'rgba(255, 255, 255, 0.7)',
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
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    color: '#FFFFFF',
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
