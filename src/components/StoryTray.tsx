/**
 * Top 5 Trending 24h Story Tray
 * Features User Persona "+ Story" creator trigger followed by top trending companions.
 */

import React from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Flame, Plus } from 'lucide-react-native';
import { Character, Persona } from '../types';

interface StoryTrayProps {
  trendingCharacters: Character[];
  userPersona?: Persona | null;
  onOpenStory: (character: Character, index: number) => void;
  onAddStory?: () => void;
}

export const StoryTray: React.FC<StoryTrayProps> = ({
  trendingCharacters,
  userPersona,
  onOpenStory,
  onAddStory,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleContainer}>
          <Flame size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.headerTitle}>Trending 24h</Text>
        </View>
        <Text style={styles.headerBadge}>Stories</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 1. First Item: User Persona "+ Story / Profile" Circle */}
        <TouchableOpacity
          style={styles.storyItem}
          onPress={onAddStory}
          activeOpacity={0.8}
        >
          <View style={styles.userStoryRing}>
            <Image
              source={{
                uri:
                  userPersona?.avatar ||
                  'https://avatars.charhub.io/avatars/hiro_mc/irresistible-riley-e91d140ac49d/avatar.webp',
              }}
              style={styles.avatarImage}
            />
            {/* Corner '+' Badge */}
            <View style={styles.plusBadge}>
              <Plus size={12} color="#000000" />
            </View>
          </View>
          <Text style={styles.storyName} numberOfLines={1}>
            Your Story
          </Text>
        </TouchableOpacity>

        {/* 2. Trending Companions */}
        {trendingCharacters.map((char, index) => (
          <TouchableOpacity
            key={char.id}
            style={styles.storyItem}
            onPress={() => onOpenStory(char, index)}
            activeOpacity={0.8}
          >
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
  userStoryRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    padding: 2.5,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderStyle: 'dashed',
    backgroundColor: '#0c0e14',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  plusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0c0e14',
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
