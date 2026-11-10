/**
 * Chats Screen (My Chats)
 * Displays Top 5 Trending 24h Story Tray & 2-Column Bento Grid of conversations.
 * Includes pristine empty state matching Warden AI (zero fake mock data).
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
import { MessageSquare, Compass, Plus, Sparkles } from 'lucide-react-native';
import { Character, Persona } from '../types';
import { colors } from '../theme/colors';
import { StoryTray } from '../components/StoryTray';
import { BentoChatCard } from '../components/BentoChatCard';
import { StoryViewerModal } from '../components/StoryViewerModal';

interface ChatsScreenProps {
  characters: Character[];
  trendingCharacters: Character[];
  userPersona?: Persona | null;
  onSelectCharacter: (character: Character) => void;
  onToggleFavorite: (character: Character) => void;
  onNavigateDiscover: () => void;
  onNavigateStudio?: () => void;
}

export const ChatsScreen: React.FC<ChatsScreenProps> = ({
  characters,
  trendingCharacters,
  userPersona,
  onSelectCharacter,
  onToggleFavorite,
  onNavigateDiscover,
  onNavigateStudio,
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
          <Compass size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.discoverBtnText}>Explore</Text>
        </TouchableOpacity>
      </View>

      {/* Main Scroll Content */}
      <FlatList
        data={characters}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={characters.length > 0 ? styles.columnWrapper : undefined}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Top 5 Trending 24h Story Tray with + Story Button */}
            <StoryTray
              trendingCharacters={trendingCharacters}
              userPersona={userPersona}
              onOpenStory={handleOpenStory}
              onAddStory={onNavigateStudio}
            />

            {/* My Chats Grid Section Header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Chats</Text>
              <Text style={styles.sectionCount}>
                {characters.length === 0 ? 'Empty' : `${characters.length} active`}
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <MessageSquare size={26} color="#FFFFFF" />
            </View>
            <Text style={styles.emptyTitle}>No Active Chats Yet</Text>
            <Text style={styles.emptySubtitle}>
              Discover anime companions from the community catalog or build your own custom character in the Studio.
            </Text>

            <View style={styles.emptyActionsRow}>
              <TouchableOpacity
                style={styles.emptyPrimaryBtn}
                onPress={onNavigateDiscover}
              >
                <Compass size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.emptyPrimaryBtnText}>Explore Catalog</Text>
              </TouchableOpacity>

              {onNavigateStudio && (
                <TouchableOpacity
                  style={styles.emptySecondaryBtn}
                  onPress={onNavigateStudio}
                >
                  <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.emptySecondaryBtnText}>Create Card</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
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
    backgroundColor: '#0c0e14',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  appTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    marginTop: 2,
  },
  discoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  discoverBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 90,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionCount: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
    marginHorizontal: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderStyle: 'dashed',
    marginTop: 20,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    maxWidth: 320,
  },
  emptyActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  emptyPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  emptyPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptySecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  emptySecondaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
