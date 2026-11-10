/**
 * Discover Screen (Warden AI Style Card Layout)
 * Features high-res anime banners, stats row, creator handles, and instant chat transition.
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
import { Search, Flame, LayoutGrid, MessageSquare, Star, Heart, Play, Sparkles } from 'lucide-react-native';
import { Character } from '../types';
import { colors } from '../theme/colors';
import { TinderDeck } from '../components/TinderDeck';
import { communityCatalogService } from '../services/communityCatalogService';

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
  const [liveCharacters, setLiveCharacters] = useState<Character[]>(starterCharacters);
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
      const live = await communityCatalogService.getLiveCatalog(
        {
          search: q,
          tag: selectedTag,
          source: catalogSource,
          limit: 24,
        },
        starterCharacters
      );
      setLiveCharacters(live.length > 0 ? live : starterCharacters);
    } catch {
      setLiveCharacters(starterCharacters);
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
            <LayoutGrid size={15} color={isGrid ? '#000' : colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.segmentBtnText, isGrid && styles.segmentBtnTextActive]}>
              Catalog Cards
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, !isGrid && styles.segmentBtnActive]}
            onPress={() => setMode('match')}
          >
            <Flame size={15} color={!isGrid ? '#000' : colors.textSecondary} style={{ marginRight: 6 }} />
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
        <Search size={18} color={colors.textMuted} style={{ marginRight: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search anime companions, tags, tropes..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
        />
        {isLoading && <ActivityIndicator size="small" color={colors.lime} style={{ marginLeft: 6 }} />}
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
                    color={item.isFavorite ? colors.lemon : '#FFFFFF'}
                    fill={item.isFavorite ? colors.lemon : 'transparent'}
                  />
                </TouchableOpacity>
              </View>

              {/* Progressive Blur Scrim at Bottom of Banner */}
              <View style={styles.bannerBottomScrim}>
                <Text style={styles.creatorName}>by @{item.creator}</Text>
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
                    <MessageSquare size={13} color={colors.lime} style={{ marginRight: 4 }} />
                    <Text style={styles.statText}>{item.totalChats || 240}</Text>
                  </View>
                </View>

                {/* Quick Start Chat Button */}
                <TouchableOpacity
                  style={styles.chatActionBtn}
                  onPress={() => onStartChat(item)}
                  activeOpacity={0.8}
                >
                  <Play size={14} color="#000" fill="#000" style={{ marginRight: 6 }} />
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
    backgroundColor: colors.bgDark,
  },
  segmentContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  segmentPill: {
    flexDirection: 'row',
    backgroundColor: colors.bgSurface,
    borderRadius: 24,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
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
    backgroundColor: colors.lime,
    marginRight: 6,
  },
  liveText: {
    color: colors.lime,
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
    backgroundColor: 'rgba(204, 255, 0, 0.15)',
    borderColor: colors.lime,
  },
  sourceBtnText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  sourceBtnTextActive: {
    color: colors.lime,
  },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  segmentBtnActive: {
    backgroundColor: colors.lime,
  },
  segmentBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  segmentBtnTextActive: {
    color: '#000',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
  },
  tagChipsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    backgroundColor: colors.bgSurface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  chipActive: {
    backgroundColor: 'rgba(204, 255, 0, 0.15)',
    borderColor: colors.lime,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.lime,
  },
  listContent: {
    padding: 16,
    paddingBottom: 110,
  },
  wardenCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  bannerWrapper: {
    width: '100%',
    height: 190,
    position: 'relative',
    backgroundColor: '#0c0e14',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerTopRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  tokenBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  tokenBadgeText: {
    color: colors.lime,
    fontSize: 10,
    fontWeight: '700',
  },
  favBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  bannerBottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(14, 15, 18, 0.85)',
  },
  creatorName: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  cardBody: {
    padding: 14,
  },
  charTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  charTagline: {
    color: colors.lime,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  charBio: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
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
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  chatActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lime,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  chatActionBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
  },
});
