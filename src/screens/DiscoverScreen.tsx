/**
 * Discover Screen
 * Toggle between Catalog Grid and Tinder Match Mode.
 * Includes Collapsible Scenario Dropdown and Scraped Community Reviews.
 */

import React, { useState } from 'react';
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
} from 'react-native';
import { Search, Flame, LayoutGrid, ChevronDown, ChevronUp, MessageSquare, Star } from 'lucide-react-native';
import { Character } from '../types';
import { colors } from '../theme/colors';
import { TinderDeck } from '../components/TinderDeck';

interface DiscoverScreenProps {
  characters: Character[];
  onStartChat: (character: Character) => void;
  onToggleFavorite: (character: Character) => void;
}

export const DiscoverScreen: React.FC<DiscoverScreenProps> = ({
  characters,
  onStartChat,
  onToggleFavorite,
}) => {
  const [mode, setMode] = useState<'grid' | 'match'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');
  const [expandedScenarioId, setExpandedScenarioId] = useState<string | null>(null);

  const tags = ['All', 'Romance', 'Cyberpunk', 'Fantasy', 'Slice of Life', 'Comfort'];

  const filteredCharacters = characters.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.tagline.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = selectedTag === 'All' || c.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  const toggleScenario = (id: string) => {
    setExpandedScenarioId(prev => (prev === id ? null : id));
  };

  const isGrid = mode === 'grid';

  if (mode === 'match') {
    return (
      <TinderDeck
        characters={filteredCharacters}
        onBack={() => setMode('grid')}
        onMatchChat={onStartChat}
        onToggleFavorite={onToggleFavorite}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Segmented Control (Ref: Blueprint Section 3.B) */}
      <View style={styles.segmentContainer}>
        <View style={styles.segmentPill}>
          <TouchableOpacity
            style={[styles.segmentBtn, isGrid && styles.segmentBtnActive]}
            onPress={() => setMode('grid')}
          >
            <LayoutGrid size={15} color={isGrid ? '#000' : colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.segmentBtnText, isGrid && styles.segmentBtnTextActive]}>
              Catalog Grid
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

      {/* Search Input Bar */}
      <View style={styles.searchBar}>
        <Search size={18} color={colors.textMuted} style={{ marginRight: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search companions, tags, or tropes..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
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

      {/* Character Catalog List */}
      <FlatList
        data={filteredCharacters}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isScenarioExpanded = expandedScenarioId === item.id;
          return (
            <View style={styles.catalogCard}>
              <View style={styles.cardHeader}>
                <Image source={{ uri: item.avatar }} style={styles.avatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.charName}>{item.name}</Text>
                  <Text style={styles.charTagline}>{item.tagline}</Text>
                  <View style={styles.tagsRow}>
                    {item.tags.map((t, idx) => (
                      <Text key={idx} style={styles.cardTagBadge}>#{t}</Text>
                    ))}
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.favIcon}
                  onPress={() => onToggleFavorite(item)}
                >
                  <Star
                    size={18}
                    color={item.isFavorite ? colors.lemon : colors.textMuted}
                    fill={item.isFavorite ? colors.lemon : 'transparent'}
                  />
                </TouchableOpacity>
              </View>

              {/* Character Hook Bio */}
              <Text style={styles.charBio}>{item.description}</Text>

              {/* Collapsible Scenario Dropdown */}
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => toggleScenario(item.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.accordionTitle}>Scenario & Initial Context</Text>
                {isScenarioExpanded ? (
                  <ChevronUp size={16} color={colors.lime} />
                ) : (
                  <ChevronDown size={16} color={colors.textSecondary} />
                )}
              </TouchableOpacity>

              {isScenarioExpanded && (
                <View style={styles.accordionContent}>
                  <Text style={styles.scenarioText}>{item.scenario}</Text>
                </View>
              )}

              {/* Scraped Community Reviews Section */}
              {item.comments && item.comments.length > 0 && (
                <View style={styles.reviewsBox}>
                  <View style={styles.reviewHeaderRow}>
                    <MessageSquare size={12} color={colors.lime} style={{ marginRight: 6 }} />
                    <Text style={styles.reviewHeaderTitle}>Community Reviews</Text>
                  </View>
                  {item.comments.slice(0, 2).map(comment => (
                    <View key={comment.id} style={styles.commentItem}>
                      <Text style={styles.commentAuthor}>@{comment.author}:</Text>
                      <Text style={styles.commentText}>"{comment.content}"</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Start Chat CTA */}
              <TouchableOpacity
                style={styles.startChatBtn}
                onPress={() => onStartChat(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.startChatBtnText}>Start Conversation</Text>
              </TouchableOpacity>
            </View>
          );
        }}
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
    paddingBottom: 100,
  },
  catalogCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  charName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  charTagline: {
    color: colors.lime,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  cardTagBadge: {
    color: colors.textMuted,
    fontSize: 10,
  },
  favIcon: {
    padding: 6,
  },
  charBio: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  accordionTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  accordionContent: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  scenarioText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  reviewsBox: {
    backgroundColor: 'rgba(204, 255, 0, 0.04)',
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(204, 255, 0, 0.2)',
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  reviewHeaderTitle: {
    color: colors.lime,
    fontSize: 11,
    fontWeight: '700',
  },
  commentItem: {
    marginBottom: 4,
  },
  commentAuthor: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
  commentText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontStyle: 'italic',
  },
  startChatBtn: {
    backgroundColor: colors.lime,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  startChatBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
  },
});
