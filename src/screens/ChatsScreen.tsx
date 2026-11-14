/**
 * Chats Screen (My Chats)
 * Displays Top 5 Trending 24h Story Tray & 2-Column Bento Grid of conversations.
 * Groups multi-session roleplay per character into 1 library card with session drawer.
 * Outside click dismisses modal automatically.
 * Zero fake mock data.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  MessageSquare,
  Compass,
  Plus,
  Sparkles,
  Trash2,
  X,
  Play,
  Layers,
  ChevronRight,
} from 'lucide-react-native';
import { Character, Persona, Conversation } from '../types';
import { colors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { NekoLogoSvg } from '../components/NekoLogoSvg';
import { StoryTray } from '../components/StoryTray';
import { BentoChatCard } from '../components/BentoChatCard';
import { StoryViewerModal } from '../components/StoryViewerModal';
import { BottomSheetModal } from '../components/BottomSheetModal';
import { storageService } from '../services/storageService';
import { GLASS } from '../theme/glassTheme';
import { matchAlgorithmService } from '../services/matchAlgorithmService';
import { characterService } from '../services/characterService';

interface ChatsScreenProps {
  characters: Character[];
  trendingCharacters: Character[];
  userPersona?: Persona | null;
  onSelectCharacter: (character: Character, detail?: any, conversationId?: string) => void;
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

  // Grouped Sessions State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedGroupChar, setSelectedGroupChar] = useState<Character | null>(null);
  const [sessionsSheetVisible, setSessionsSheetVisible] = useState(false);

  // Tray Feed State (Algorithmic Top 3 Recommendations & Live 24h Community Trending)
  const [recommendations, setRecommendations] = useState<Character[]>([]);
  const [trendingList, setTrendingList] = useState<Character[]>(trendingCharacters || []);

  useEffect(() => {
    loadAllConversations();
    loadTrayFeed();
  }, [userPersona]);

  const loadTrayFeed = async () => {
    // 1. Always fetch genuine community 24h trending companions
    try {
      const live = await characterService.getTrending24h();
      if (live && live.length > 0) {
        setTrendingList(live);
      }
    } catch {}

    // 2. Query algorithmic recommendation engine: if affinity pattern detected (>= 50%), compute Top 3 For You
    try {
      const topMatches = await matchAlgorithmService.getLearnedRecommendations(3, userPersona || undefined);
      if (topMatches && topMatches.length >= 3) {
        setRecommendations(
          topMatches.map(c => ({
            id: c.id || c.characterId,
            name: c.name,
            tagline: c.chatName || c.name,
            description: c.shortDescription,
            avatar: c.avatarUrl,
            personality: c.personality || '',
            scenario: c.scenario || '',
            firstMessage: c.firstMessage || '',
            tags: Array.isArray(c.tags) ? c.tags.map(t => (typeof t === 'string' ? t : t.name)) : [],
            creator: c.creatorName,
            totalChats: c.chatCount || 0,
            lastActive: Date.now(),
            isFavorite: false,
          }))
        );
      } else {
        // If under 50% pattern or no dominant affinity found:
        // Do NOT show Top 3 For You — show only Trending 24h (as requested by user)
        setRecommendations([]);
      }
    } catch {
      setRecommendations([]);
    }
  };

  const loadAllConversations = async () => {
    try {
      const list = await storageService.getConversations();
      setConversations(list);
    } catch {}
  };

  const allTrayStories = useMemo(() => {
    return [...recommendations, ...(trendingList.length > 0 ? trendingList : trendingCharacters)];
  }, [recommendations, trendingList, trendingCharacters]);

  const handleOpenStory = (char: Character, index: number) => {
    setSelectedStoryIndex(index);
    setStoryModalVisible(true);
  };

  // Group sessions by characterId
  const sessionsByCharId = useMemo(() => {
    const map = new Map<string, Conversation[]>();
    for (const c of conversations) {
      const existing = map.get(c.characterId) || [];
      existing.push(c);
      map.set(c.characterId, existing);
    }
    return map;
  }, [conversations]);

  // Compute character list with real session counts and timestamps
  const groupedCharacters = useMemo(() => {
    return characters.map(char => {
      const charSessions = sessionsByCharId.get(char.id) || [];
      const latestConv = charSessions[0];
      return {
        ...char,
        totalChats: charSessions.length,
        lastActive: latestConv ? new Date(latestConv.updatedAt).getTime() : char.lastActive,
      };
    });
  }, [characters, sessionsByCharId]);

  const handleCardPress = (char: Character) => {
    setSelectedGroupChar(char);
    setSessionsSheetVisible(true);
  };

  const handleDeleteSession = async (sessionId: string) => {
    await storageService.deleteConversation(sessionId);
    await loadAllConversations();
  };

  const formatTimeAgo = (timestamp?: number) => {
    if (!timestamp) return 'Just now';
    const diffMin = Math.round((Date.now() - timestamp) / 60000);
    if (diffMin < 60) return `${Math.max(1, diffMin)}m ago`;
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.round(diffHours / 24)}d ago`;
  };

  const activeCharSessions = selectedGroupChar
    ? sessionsByCharId.get(selectedGroupChar.id) || []
    : [];

  const { palette } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bgDark }]}>
      <StatusBar style="light" />

      {/* Screen Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <NekoLogoSvg size={34} color={palette.accent} />
          <View>
            <Text style={styles.appTitle}>NekoChat</Text>
            <Text style={styles.appSubtitle}>AI Companion & Roleplay</Text>
          </View>
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
        data={groupedCharacters}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={groupedCharacters.length > 0 ? styles.columnWrapper : undefined}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Top Trending / Algorithmic Recommendations Tray */}
            <StoryTray
              recommendations={recommendations}
              trendingCharacters={trendingList.length > 0 ? trendingList : trendingCharacters}
              onOpenStory={handleOpenStory}
            />

            {/* My Chats Grid Section Header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Chats</Text>
              <Text style={styles.sectionCount}>
                {groupedCharacters.length === 0 ? 'Empty' : `${groupedCharacters.length} active`}
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
            onPress={() => handleCardPress(item)}
            onToggleFavorite={() => onToggleFavorite(item)}
          />
        )}
      />

      {/* Fullscreen Story Viewer Modal */}
      <StoryViewerModal
        visible={storyModalVisible}
        characters={allTrayStories}
        initialIndex={selectedStoryIndex}
        onClose={() => setStoryModalVisible(false)}
        onStartChat={onSelectCharacter}
        onToggleFavorite={onToggleFavorite}
      />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* CHARACTER SESSION GROUP DRAWER (Outside Click & Swipe-Down Closes) */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <BottomSheetModal
        visible={sessionsSheetVisible}
        onClose={() => setSessionsSheetVisible(false)}
        sheetStyle={styles.groupModalSheet}
      >
            {selectedGroupChar && (
              <>
                {/* Character Header Banner */}
                <View style={styles.groupHeader}>
                  <Image source={{ uri: selectedGroupChar.avatar }} style={styles.groupAvatar} />
                  <View style={styles.groupInfo}>
                    <Text style={styles.groupCharName} numberOfLines={1}>
                      {selectedGroupChar.name}
                    </Text>
                    <Text style={styles.groupCharCreator} numberOfLines={1}>
                      Created by @{selectedGroupChar.creator || 'community'}
                    </Text>
                    <View style={styles.groupSessionBadge}>
                      <Layers size={11} color="#d4ff00" style={{ marginRight: 4 }} />
                      <Text style={styles.groupSessionBadgeText}>
                        {activeCharSessions.length} {activeCharSessions.length === 1 ? 'Session' : 'Sessions'} Saved
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.groupCloseBtn}
                    onPress={() => setSessionsSheetVisible(false)}
                    activeOpacity={0.7}
                  >
                    <X size={18} color="#9ca3af" />
                  </TouchableOpacity>
                </View>

                {/* + Start New Scenario / Chat CTA */}
                <TouchableOpacity
                  style={styles.newGroupChatBtn}
                  onPress={() => {
                    setSessionsSheetVisible(false);
                    onSelectCharacter(selectedGroupChar);
                  }}
                  activeOpacity={0.85}
                >
                  <Plus size={16} color="#0c0e14" style={{ marginRight: 6 }} />
                  <Text style={styles.newGroupChatBtnText}>Start New Scenario / Chat</Text>
                </TouchableOpacity>

                {/* Sessions List */}
                <Text style={styles.sessionsListLabel}>EXISTING SCENARIOS & CHATS</Text>
                <ScrollView style={styles.sessionsScroll} showsVerticalScrollIndicator={false}>
                  {activeCharSessions.length === 0 ? (
                    <View style={styles.emptySessionsBox}>
                      <Text style={styles.emptySessionsTitle}>No previous sessions yet</Text>
                      <Text style={styles.emptySessionsSub}>
                        Tap "+ Start New Scenario / Chat" above to begin your first roleplay with {selectedGroupChar.name}.
                      </Text>
                    </View>
                  ) : (
                    activeCharSessions.map((session, idx) => {
                      const lastMsg = session.messages?.[session.messages.length - 1];
                      const snippet = lastMsg?.content
                        ? lastMsg.content.slice(0, 90).replace(/\n/g, ' ')
                        : 'Empty chat session ready to resume.';
                      const timeAgo = formatTimeAgo(new Date(session.updatedAt).getTime());

                      return (
                        <View key={session.id} style={styles.sessionRowCard}>
                          <TouchableOpacity
                            style={styles.sessionRowMain}
                            onPress={() => {
                              setSessionsSheetVisible(false);
                              onSelectCharacter(selectedGroupChar, undefined, session.id);
                            }}
                            activeOpacity={0.8}
                          >
                            <View style={styles.sessionTitleRow}>
                              <Text style={styles.sessionCardTitle} numberOfLines={1}>
                                {session.scenarioTitle || session.title || `Chat Session #${activeCharSessions.length - idx}`}
                              </Text>
                              <View style={styles.sessionMsgPill}>
                                <Text style={styles.sessionMsgPillText}>
                                  {session.messages?.length || 0} msgs
                                </Text>
                              </View>
                            </View>

                            <Text style={styles.sessionSnippet} numberOfLines={2}>
                              {snippet}
                            </Text>

                            <View style={styles.sessionMetaRow}>
                              <Text style={styles.sessionTimeText}>{timeAgo}</Text>
                              <Text style={styles.sessionResumeText}>Resume ➔</Text>
                            </View>
                          </TouchableOpacity>

                          {/* Trash button to erase this chat session */}
                          <TouchableOpacity
                            style={styles.sessionTrashBtn}
                            onPress={() => handleDeleteSession(session.id)}
                            activeOpacity={0.7}
                            accessibilityLabel="Delete chat session"
                          >
                            <Trash2 size={16} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
              </>
            )}
      </BottomSheetModal>
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
    backgroundColor: GLASS.bgPill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GLASS.borderBright,
    ...GLASS.backdrop,
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
    gap: 12,
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
  groupModalSheet: {
    maxHeight: '80%',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#161922',
    marginRight: 14,
  },
  groupInfo: {
    flex: 1,
  },
  groupCharName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  groupCharCreator: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 4,
  },
  groupSessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 255, 0, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.25)',
  },
  groupSessionBadgeText: {
    color: '#d4ff00',
    fontSize: 10,
    fontWeight: '700',
  },
  groupCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  newGroupChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d4ff00',
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 16,
    shadowColor: '#d4ff00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  newGroupChatBtnText: {
    color: '#0c0e14',
    fontSize: 14,
    fontWeight: '800',
  },
  sessionsListLabel: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sessionsScroll: {
    maxHeight: 340,
  },
  emptySessionsBox: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  emptySessionsTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySessionsSub: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  sessionRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141824',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  sessionRowMain: {
    flex: 1,
    padding: 12,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sessionCardTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  sessionMsgPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sessionMsgPillText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '600',
  },
  sessionSnippet: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  sessionMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionTimeText: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 10,
  },
  sessionResumeText: {
    color: '#d4ff00',
    fontSize: 11,
    fontWeight: '700',
  },
  sessionTrashBtn: {
    padding: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.06)',
  },
});
