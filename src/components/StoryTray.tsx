/**
 * Top 5 Trending 24h Story Tray
 * Ref: Gambar 6 — Instagram-style circular story rings on top of My Chat.
 */

import React from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Flame } from 'lucide-react-native';
import { Character } from '../types';
import { colors } from '../theme/colors';

interface StoryTrayProps {
  trendingCharacters: Character[];
  onOpenStory: (character: Character, index: number) => void;
}

export const StoryTray: React.FC<StoryTrayProps> = ({ trendingCharacters, onOpenStory }) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleContainer}>
          <Flame size={16} color={colors.lime} style={{ marginRight: 6 }} />
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
            {/* Glowing Gradient Ring */}
            <View style={[styles.avatarRing, { borderColor: index === 0 ? colors.lime : colors.lavender }]}>
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
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerBadge: {
    color: colors.lime,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(204, 255, 0, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
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
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 3,
    borderWidth: 2,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  storyName: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
});

