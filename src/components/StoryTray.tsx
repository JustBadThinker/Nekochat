/**
 * Top 5 Trending 24h Story Tray
 * Monochrome Warden AI styling with clean anime story avatars.
 */

import React from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Flame } from 'lucide-react-native';
import { Character } from '../types';

interface StoryTrayProps {
  trendingCharacters: Character[];
  onOpenStory: (character: Character, index: number) => void;
}

export const StoryTray: React.FC<StoryTrayProps> = ({ trendingCharacters, onOpenStory }) => {
  if (trendingCharacters.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleContainer}>
          <Flame size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.headerTitle}>Trending 24h</Text>
        </View>
        <Text style={styles.headerBadge}>Top 5</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {trendingCharacters.map((char, index) => (
          <TouchableOpacity
            key={char.id}
            style={styles.storyItem}
            onPress={() => onOpenStory(char, index)}
            activeOpacity={0.8}
          >
            {/* Story Ring (Pure sleek outline) */}
            <View
              style={[
                styles.avatarRing,
                { borderColor: index === 0 ? '#FFFFFF' : 'rgba(255, 255, 255, 0.35)' },
              ]}
            >
              <Image source={{ uri: char.avatar }} style={styles.avatarImage} />
            </View>
            <Text style={styles.storyName} numberOfLines={1}>
              {char.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerBadge: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  storyItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 68,
  },
  avatarRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    padding: 2.5,
    borderWidth: 1.5,
    backgroundColor: '#0c0e14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  storyName: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
});
