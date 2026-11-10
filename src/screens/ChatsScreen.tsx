/**
 * Chats Screen (My Chats)
 * Displays Top 5 Trending 24h Story Tray & 2-Column Bento Grid of conversations.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Plus, Sparkles } from 'lucide-react-native';
import { Character } from '../types';
import { colors } from '../theme/colors';
import { StoryTray } from '../components/StoryTray';
import { BentoChatCard } from '../components/BentoChatCard';
import { StoryViewerModal } from '../components/StoryViewerModal';

interface ChatsScreenProps {
  characters: Character[];
  trendingCharacters: Character[];
  onSelectCharacter: (character: Character) => void;
  onToggleFavorite: (character: Character) => void;
  onNavigateDiscover: () => void;
}

export const ChatsScreen: React.FC<ChatsScreenProps> = ({
  characters,
  trendingCharacters,
  onSelectCharacter,
  onToggleFavorite,
  onNavigateDiscover,
}) => {
  const [storyModalVisible, setStoryModalVisible] = useState(false);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);

  const handleOpenStory = (char: Character, index: number) => {
    setSelectedStoryIndex(index);
    setStoryModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Screen Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>NekoChat</Text>
          <Text style={styles.appSubtitle}>AI Companion & Roleplay</Text>
        </View>

        <TouchableOpacity
          style={styles.discoverBtn}
          onPress={onNavigateDiscover}
          activeOpacity={0.8}
        >
          <Sparkles size={16} color={colors.lime} style={{ marginRight: 6 }} />
          <Text style={styles.discoverBtnText}>Explore</Text>
        </TouchableOpacity>
      </View>

      {/* Main Scroll Content */}
      <FlatList
        data={characters}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Top 5 Trending 24h Story Tray (Ref: Gambar 6) */}
            <StoryTray
              trendingCharacters={trendingCharacters}
              onOpenStory={handleOpenStory}
            />

            {/* My Chats Grid Section Header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Chats</Text>
              <Text style={styles.sectionCount}>{characters.length} active</Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <BentoChatCard
            character={item}
            onPress={() => onSelectCharacter(item)}
            onToggleFavorite={() => onToggleFavorite(item)}
          />
        )}
      />

      {/* Fullscreen Story Viewer Modal */}
      <StoryViewerModal
        visible={storyModalVisible}
        characters={trendingCharacters}
        initialIndex={selectedStoryIndex}
        onClose={() => setStoryModalVisible(false)}
        onStartChat={onSelectCharacter}
        onToggleFavorite={onToggleFavorite}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  appTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  discoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.3)',
  },
  discoverBtnText: {
    color: colors.lime,
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 100, // Safe padding above floating CapsuleDock
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionCount: {
    color: colors.textMuted,
    fontSize: 12,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
});
