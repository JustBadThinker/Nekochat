/**
 * Chats Screen (My Chats)
 * Displays Top 5 Trending 24h Story Tray & 2-Column Bento Grid of conversations.
 * Groups multi-session roleplay per character into 1 library card with session drawer.
 * Outside click dismisses modal automatically.
 * Zero fake mock data.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  LayoutAnimation,
  Platform,
  UIManager,
  Animated,
  Easing,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import {
  MessageSquare,
  Compass,
  Plus,
  Trash2,
  X,
  Layers,
  LayoutGrid,
  ChevronDown,
  Heart,
  CheckSquare,
  Square,
  ArrowUpDown,
  Eye,
} from 'lucide-react-native';
import { Character, Persona, Conversation } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { getCardSurfaceStyle } from '../theme/skins';
import { runToggleAnimation } from '../theme/animations';
import { useTranslation } from '../i18n/LanguageContext';
import { NekoLogoSvg } from '../components/NekoLogoSvg';
import { StoryTray } from '../components/StoryTray';
import { BentoChatCard } from '../components/BentoChatCard';
import { StoryViewerModal } from '../components/StoryViewerModal';
import { BottomSheetModal } from '../components/BottomSheetModal';
import { storageService } from '../services/storageService';
import { GLASS } from '../theme/glassTheme';
import { matchAlgorithmService } from '../services/matchAlgorithmService';
import { characterService } from '../services/characterService';
import { ThemePalette } from '../theme/colors';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const VIEW_MODE_KEY = '@nekochat:chats_view_mode';

const AccordionAnimatedBody: React.FC<{ isExpanded: boolean; children: React.ReactNode }> = ({
  isExpanded,
  children,
}) => {
  const { skin } = useTheme();
  const anim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const [rendered, setRendered] = useState(isExpanded);

  useEffect(() => {
    if (isExpanded) {
      setRendered(true);
      anim.setValue(0);
      runToggleAnimation(anim, true, skin.animation);
    } else if (rendered) {
      Animated.timing(anim, {
        toValue: 0,
        duration: Math.max(140, Math.round(skin.animation.enterDuration * 0.65)),
        easing: skin.animation.easing,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [isExpanded, skin.animation]);

  if (!rendered) return null;

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [-10, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
};

const AccordionAnimatedChevron: React.FC<{ isExpanded: boolean; activeColor: string }> = ({
  isExpanded,
  activeColor,
}) => {
  const { skin } = useTheme();
  const rot = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  useEffect(() => {
    runToggleAnimation(rot, isExpanded, skin.animation);
  }, [isExpanded, skin.animation]);

  return (
    <Animated.View
      style={{
        transform: [
          {
            rotate: rot.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '180deg'],
            }),
          },
        ],
      }}
    >
      <ChevronDown size={16} color={isExpanded ? activeColor : '#94a3b8'} />
    </Animated.View>
  );
};

interface ChatsScreenProps {
  characters: Character[];
  trendingCharacters: Character[];
  userPersona?: Persona | null;
  onSelectCharacter: (character: Character, detail?: any, conversationId?: string) => void;
  onToggleFavorite: (character: Character) => void;
  onDeleteCharacter?: (characterId: string) => void;
  onNavigateDiscover: () => void;
  onNavigateStudio?: () => void;
  onScrollDirectionChange?: (visible: boolean) => void;
}

let cachedChatsViewMode: 'grid' | 'accordion' | null = null;

export const ChatsScreen: React.FC<ChatsScreenProps> = ({
  characters,
  trendingCharacters,
  userPersona,
  onSelectCharacter,
  onToggleFavorite,
  onDeleteCharacter,
  onNavigateDiscover,
  onNavigateStudio,
  onScrollDirectionChange,
}) => {
  const lastScrollYRef = useRef(0);
  const [viewMode, setViewMode] = useState<'grid' | 'accordion'>(cachedChatsViewMode || 'grid');
  const [viewModeLoaded, setViewModeLoaded] = useState<boolean>(cachedChatsViewMode !== null);
  const [expandedCharId, setExpandedCharId] = useState<string | null>(null);
  const [sessionSort, setSessionSort] = useState<'latest' | 'oldest' | 'messages'>('latest');
  const [selectModeCharId, setSelectModeCharId] = useState<string | null>(null);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Record<string, boolean>>({});
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
    AsyncStorage.getItem(VIEW_MODE_KEY)
      .then(v => {
        const resolved: 'grid' | 'accordion' = v === 'accordion' ? 'accordion' : 'grid';
        cachedChatsViewMode = resolved;
        setViewMode(resolved);
      })
      .catch(() => {})
      .finally(() => {
        setViewModeLoaded(true);
      });
  }, []);

  useEffect(() => {
    loadAllConversations();
    loadTrayFeed();
  }, [userPersona, characters]);

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
      if (topMatches && topMatches.length > 0) {
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

  // Compute character list with real session counts and timestamps, sorted by most recent chat
  const groupedCharacters = useMemo(() => {
    return characters
      .map(char => {
        const charSessions = sessionsByCharId.get(char.id) || [];
        const latestConv = charSessions[0];
        const convTime = latestConv ? new Date(latestConv.updatedAt).getTime() : 0;
        const updatedTime = char.updatedAt ? new Date(char.updatedAt).getTime() : 0;
        return {
          ...char,
          totalChats: charSessions.length,
          lastActive: Math.max(convTime, updatedTime, char.lastActive || 0),
        };
      })
      .sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
  }, [characters, sessionsByCharId]);

  const handleCardPress = (char: Character) => {
    setSelectedGroupChar(char);
    setSessionsSheetVisible(true);
  };

  const handleDeleteSession = async (sessionId: string, characterId?: string) => {
    await storageService.deleteConversation(sessionId);
    const updatedList = await storageService.getConversations();
    setConversations(updatedList);
    if (characterId) {
      const remainingForChar = updatedList.filter(c => c.characterId === characterId);
      if (remainingForChar.length === 0) {
        if (selectedGroupChar?.id === characterId) {
          setSessionsSheetVisible(false);
          setSelectedGroupChar(null);
        }
        onDeleteCharacter?.(characterId);
      }
    }
  };

  const handleBulkDeleteSessions = async (characterId: string) => {
    const idsToDelete = Object.keys(selectedSessionIds).filter(id => selectedSessionIds[id]);
    if (idsToDelete.length === 0) return;
    for (const id of idsToDelete) {
      await storageService.deleteConversation(id);
    }
    const updatedList = await storageService.getConversations();
    setConversations(updatedList);
    setSelectedSessionIds({});
    setSelectModeCharId(null);
    const remainingForChar = updatedList.filter(c => c.characterId === characterId);
    if (remainingForChar.length === 0) {
      onDeleteCharacter?.(characterId);
    }
  };

  const handleDeleteCharCard = async (characterId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (selectedGroupChar?.id === characterId) {
      setSessionsSheetVisible(false);
      setSelectedGroupChar(null);
    }
    if (selectModeCharId === characterId) {
      setSelectModeCharId(null);
      setSelectedSessionIds({});
    }
    await onDeleteCharacter?.(characterId);
    await loadAllConversations();
  };

  const handleToggleViewMode = (mode: 'grid' | 'accordion') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    cachedChatsViewMode = mode;
    setViewMode(mode);
    AsyncStorage.setItem(VIEW_MODE_KEY, mode).catch(() => {});
  };

  const toggleExpandChar = (charId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCharId(prev => (prev === charId ? null : charId));
  };

  const cycleSessionSort = () => {
    setSessionSort(prev => (prev === 'latest' ? 'oldest' : prev === 'oldest' ? 'messages' : 'latest'));
  };

  const getSortedSessions = (list: Conversation[]) => {
    const copy = [...list];
    if (sessionSort === 'oldest') {
      copy.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
    } else if (sessionSort === 'messages') {
      copy.sort((a, b) => (b.messages?.length || 0) - (a.messages?.length || 0));
    } else {
      copy.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    return copy;
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

  const { palette, skin } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bgDark }]}>
      <StatusBar style="light" />

      {/* Screen Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <NekoLogoSvg size={34} color={palette.accent} />
          <View>
            <Text style={styles.appTitle}>NekoChat</Text>
            <Text style={styles.appSubtitle}>{t('chats.subtitle')}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.discoverBtn}
          onPress={onNavigateDiscover}
          activeOpacity={0.8}
        >
          <Compass size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.discoverBtnText}>{t('chats.explore')}</Text>
        </TouchableOpacity>
      </View>

      {/* Main Scroll Content — wait for persisted viewMode on cold start to avoid Grid->Accordion flash */}
      {!viewModeLoaded ? (
        <View style={{ flex: 1 }} />
      ) : (
      <FlatList
        key={viewMode}
        data={groupedCharacters}
        keyExtractor={item => item.id}
        numColumns={viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode === 'grid' && groupedCharacters.length > 0 ? styles.columnWrapper : undefined}
        contentContainerStyle={styles.listContent}
        scrollEventThrottle={16}
        onScroll={e => {
          if (!onScrollDirectionChange) return;
          const y = e?.nativeEvent?.contentOffset?.y ?? 0;
          const dy = y - lastScrollYRef.current;
          lastScrollYRef.current = y;
          if (y <= 14) onScrollDirectionChange(true);
          else if (dy > 8 && y > 60) onScrollDirectionChange(false);
          else if (dy < -8) onScrollDirectionChange(true);
        }}
        ListHeaderComponent={
          <>
            {/* Top Trending / Algorithmic Recommendations Tray */}
            <StoryTray
              recommendations={recommendations}
              trendingCharacters={trendingList.length > 0 ? trendingList : trendingCharacters}
              onOpenStory={handleOpenStory}
            />

            {/* My Chats Section Header + Bento / Accordion View Switcher */}
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.sectionTitle}>{t('chats.myChats')}</Text>
                <Text style={styles.sectionCount}>
                  {groupedCharacters.length === 0 ? t('chats.empty') : `${groupedCharacters.length} ${t('chats.active')}`}
                </Text>
              </View>

              <View style={styles.viewTogglePill}>
                <TouchableOpacity
                  style={[
                    styles.viewToggleBtn,
                    viewMode === 'grid' && { backgroundColor: palette.accent },
                  ]}
                  onPress={() => handleToggleViewMode('grid')}
                  activeOpacity={0.8}
                  accessibilityLabel="Bento grid view"
                >
                  <LayoutGrid size={13} color={viewMode === 'grid' ? palette.bgDark : '#94a3b8'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.viewToggleBtn,
                    viewMode === 'accordion' && { backgroundColor: palette.accent },
                  ]}
                  onPress={() => handleToggleViewMode('accordion')}
                  activeOpacity={0.8}
                  accessibilityLabel="Dropdown accordion view"
                >
                  <Layers size={13} color={viewMode === 'accordion' ? palette.bgDark : '#94a3b8'} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <MessageSquare size={26} color="#FFFFFF" />
            </View>
            <Text style={styles.emptyTitle}>{t('chats.noActiveTitle')}</Text>
            <Text style={styles.emptySubtitle}>
              {t('chats.noActiveSub')}
            </Text>

            <View style={styles.emptyActionsRow}>
              <TouchableOpacity
                style={styles.emptyPrimaryBtn}
                onPress={onNavigateDiscover}
              >
                <Compass size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.emptyPrimaryBtnText}>{t('chats.exploreCatalog')}</Text>
              </TouchableOpacity>

              {onNavigateStudio && (
                <TouchableOpacity
                  style={styles.emptySecondaryBtn}
                  onPress={onNavigateStudio}
                >
                  <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.emptySecondaryBtnText}>{t('chats.createCard')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          if (viewMode === 'grid') {
            return (
              <BentoChatCard
                character={item}
                onPress={() => handleCardPress(item)}
                onToggleFavorite={() => onToggleFavorite(item)}
              />
            );
          }

          const isExpanded = expandedCharId === item.id;
          const charSessions = getSortedSessions(sessionsByCharId.get(item.id) || []);
          const isSelectingThis = selectModeCharId === item.id;
          const selectedCount = charSessions.filter(s => selectedSessionIds[s.id]).length;

          return (
            <View
              style={[
                styles.accordionCard,
                getCardSurfaceStyle(palette, skin),
                isExpanded && { borderColor: `rgba(${palette.accentRgb}, 0.4)` },
              ]}
            >
              {/* Accordion Header Row */}
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => toggleExpandChar(item.id)}
                activeOpacity={0.82}
              >
                <Image source={{ uri: item.avatar }} style={styles.accordionAvatar} />
                <View style={styles.accordionHeaderInfo}>
                  <Text style={styles.accordionCharName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <View style={styles.accordionMetaRow}>
                    <View style={styles.accordionCountBadge}>
                      <Text style={styles.accordionCountText}>
                        {charSessions.length} {charSessions.length === 1 ? 'chat' : 'chats'}
                      </Text>
                    </View>
                    {item.lastActive ? (
                      <Text style={styles.accordionTimeText}>{formatTimeAgo(item.lastActive)}</Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.accordionHeaderActions}>
                  <TouchableOpacity
                    style={styles.accordionIconBtn}
                    onPress={e => {
                      e.stopPropagation();
                      onToggleFavorite(item);
                    }}
                    activeOpacity={0.75}
                  >
                    <Heart
                      size={15}
                      color={item.isFavorite ? '#f43f5e' : '#64748b'}
                      fill={item.isFavorite ? '#f43f5e' : 'transparent'}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.accordionIconBtn}
                    onPress={e => {
                      e.stopPropagation();
                      handleDeleteCharCard(item.id);
                    }}
                    activeOpacity={0.75}
                    accessibilityLabel={`Delete ${item.name} card`}
                  >
                    <Trash2 size={14} color="#ef4444" />
                  </TouchableOpacity>

                  <View style={styles.accordionChevronWrap}>
                    <AccordionAnimatedChevron isExpanded={isExpanded} activeColor={palette.accent} />
                  </View>
                </View>
              </TouchableOpacity>

              {/* Expanded Accordion Body */}
              <AccordionAnimatedBody isExpanded={isExpanded}>
                <View style={styles.accordionBody}>
                  {/* Action Buttons Row */}
                  <View style={styles.accordionCtaRow}>
                    <TouchableOpacity
                      style={[
                        styles.accordionPrimaryBtn,
                        { backgroundColor: palette.accent, borderRadius: skin.buttonRadius },
                      ]}
                      onPress={async () => {
                        try {
                          const newConv = await storageService.createConversation(
                            item,
                            userPersona?.id || 'persona_default',
                            'prov_gemini'
                          );
                          await loadAllConversations();
                          onSelectCharacter(item, undefined, newConv.id);
                        } catch {
                          onSelectCharacter(item);
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <Plus size={14} color={palette.bgDark} style={{ marginRight: 5 }} />
                      <Text style={[styles.accordionPrimaryBtnText, { color: palette.bgDark }]}>
                        {t('chats.startNewChat')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.accordionSecondaryBtn, { borderRadius: skin.buttonRadius }]}
                      onPress={() => handleCardPress(item)}
                      activeOpacity={0.8}
                    >
                      <Eye size={13} color="#e2e8f0" style={{ marginRight: 5 }} />
                      <Text style={styles.accordionSecondaryBtnText}>{t('chats.details')}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Sort & Multi-Select Bar */}
                  <View style={styles.accordionToolsRow}>
                    <TouchableOpacity
                      style={styles.accordionSortPill}
                      onPress={cycleSessionSort}
                      activeOpacity={0.8}
                    >
                      <ArrowUpDown size={12} color={palette.accent} style={{ marginRight: 5 }} />
                      <Text style={styles.accordionSortText}>
                        {sessionSort === 'latest'
                          ? t('chats.latest')
                          : sessionSort === 'oldest'
                          ? t('chats.oldest')
                          : t('chats.mostMsgs')}
                      </Text>
                    </TouchableOpacity>

                    {charSessions.length > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {isSelectingThis && selectedCount > 0 && (
                          <TouchableOpacity
                            style={styles.accordionBulkDeleteBtn}
                            onPress={() => handleBulkDeleteSessions(item.id)}
                            activeOpacity={0.8}
                          >
                            <Trash2 size={12} color="#ffffff" style={{ marginRight: 4 }} />
                            <Text style={styles.accordionBulkDeleteText}>Delete ({selectedCount})</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[
                            styles.accordionSelectBtn,
                            isSelectingThis && { borderColor: palette.accent, backgroundColor: `rgba(${palette.accentRgb}, 0.14)` },
                          ]}
                          onPress={() => {
                            if (isSelectingThis) {
                              setSelectModeCharId(null);
                              setSelectedSessionIds({});
                            } else {
                              setSelectModeCharId(item.id);
                              setSelectedSessionIds({});
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          <CheckSquare size={12} color={isSelectingThis ? palette.accent : '#94a3b8'} style={{ marginRight: 4 }} />
                          <Text style={[styles.accordionSelectText, isSelectingThis && { color: palette.accent }]}>
                            {isSelectingThis ? t('chats.done') : t('chats.select')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Nested Sessions */}
                  {charSessions.length === 0 ? (
                    <Text style={styles.accordionEmptyText}>
                      No saved chats yet — tap &quot;Start new chat&quot; above.
                    </Text>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {charSessions.map((session, idx) => {
                        const lastMsg = session.messages?.[session.messages.length - 1];
                        const snippet = lastMsg?.content
                          ? lastMsg.content.slice(0, 96).replace(/\n/g, ' ')
                          : 'Empty chat session ready to resume.';
                        const timeAgo = formatTimeAgo(new Date(session.updatedAt).getTime());
                        const checked = !!selectedSessionIds[session.id];

                        return (
                          <View key={session.id} style={styles.accordionSessionCard}>
                            <TouchableOpacity
                              style={{ flex: 1 }}
                              onPress={() => {
                                if (isSelectingThis) {
                                  setSelectedSessionIds(prev => ({
                                    ...prev,
                                    [session.id]: !prev[session.id],
                                  }));
                                } else {
                                  onSelectCharacter(item, undefined, session.id);
                                }
                              }}
                              activeOpacity={0.8}
                            >
                              <View style={styles.accordionSessionTop}>
                                {isSelectingThis && (
                                  <View style={{ marginRight: 6 }}>
                                    {checked ? (
                                      <CheckSquare size={14} color={palette.accent} />
                                    ) : (
                                      <Square size={14} color="#64748b" />
                                    )}
                                  </View>
                                )}
                                <Text style={styles.accordionSessionTime}>{timeAgo}</Text>
                                {userPersona?.name ? (
                                  <View style={styles.accordionPersonaPill}>
                                    <Text style={styles.accordionPersonaText} numberOfLines={1}>
                                      as {userPersona.name}
                                    </Text>
                                  </View>
                                ) : null}
                                <View style={{ flex: 1 }} />
                                <View style={styles.sessionMsgPill}>
                                  <Text style={styles.sessionMsgPillText}>
                                    {session.messages?.length || 0} msgs
                                  </Text>
                                </View>
                              </View>

                              <Text style={styles.accordionSessionTitle} numberOfLines={1}>
                                {session.scenarioTitle || session.title || `Chat Session #${charSessions.length - idx}`}
                              </Text>
                              <Text style={styles.sessionSnippet} numberOfLines={2}>
                                {snippet}
                              </Text>
                            </TouchableOpacity>

                            {!isSelectingThis && (
                              <TouchableOpacity
                                style={styles.accordionSessionTrash}
                                onPress={() => handleDeleteSession(session.id, item.id)}
                                activeOpacity={0.7}
                                accessibilityLabel="Delete chat session"
                              >
                                <Trash2 size={14} color="#ef4444" />
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </AccordionAnimatedBody>
            </View>
          );
        }}
      />
      )}

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
                      <Layers size={11} color={palette.accent} style={{ marginRight: 4 }} />
                      <Text style={styles.groupSessionBadgeText}>
                        {activeCharSessions.length} {activeCharSessions.length === 1 ? 'Session' : 'Sessions'} Saved
                      </Text>
                    </View>
                  </View>
                  {onDeleteCharacter && (
                    <TouchableOpacity
                      style={[styles.groupCloseBtn, { marginRight: 6, backgroundColor: 'rgba(239, 68, 68, 0.14)' }]}
                      onPress={() => handleDeleteCharCard(selectedGroupChar.id)}
                      activeOpacity={0.75}
                      accessibilityLabel="Delete character card"
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  )}
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
                  style={[styles.newGroupChatBtn, { backgroundColor: palette.accent }]}
                  onPress={async () => {
                    const targetChar = selectedGroupChar;
                    setSessionsSheetVisible(false);
                    try {
                      const newConv = await storageService.createConversation(
                        targetChar,
                        userPersona?.id || 'persona_default',
                        'prov_gemini'
                      );
                      await loadAllConversations();
                      onSelectCharacter(targetChar, undefined, newConv.id);
                    } catch {
                      onSelectCharacter(targetChar);
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Plus size={16} color={palette.bgDark} style={{ marginRight: 6 }} />
                  <Text style={styles.newGroupChatBtnText}>Start New Scenario / Chat</Text>
                </TouchableOpacity>

                {/* Sessions List */}
                <Text style={styles.sessionsListLabel}>EXISTING SCENARIOS & CHATS</Text>
                <ScrollView style={styles.sessionsScroll} showsVerticalScrollIndicator={false}>
                  {activeCharSessions.length === 0 ? (
                    <View style={styles.emptySessionsBox}>
                      <Text style={styles.emptySessionsTitle}>No previous sessions yet</Text>
                      <Text style={styles.emptySessionsSub}>
                        Tap {'"+ Start New Scenario / Chat"'} above to begin your first roleplay with {selectedGroupChar.name}.
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
                            onPress={() => handleDeleteSession(session.id, selectedGroupChar.id)}
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

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bgDark,
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
    backgroundColor: `rgba(${palette.accentRgb}, 0.1)`,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.25)`,
  },
  groupSessionBadgeText: {
    color: palette.accent,
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
    backgroundColor: palette.accent,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 16,
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  newGroupChatBtnText: {
    color: palette.bgDark,
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
    color: palette.accent,
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
  viewTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 2,
  },
  viewToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(18, 22, 34, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  accordionAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  accordionHeaderInfo: {
    flex: 1,
  },
  accordionCharName: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  accordionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  accordionCountBadge: {
    backgroundColor: `rgba(${palette.accentRgb}, 0.12)`,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.28)`,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  accordionCountText: {
    color: palette.accent,
    fontSize: 10.5,
    fontWeight: '700',
  },
  accordionTimeText: {
    color: 'rgba(255, 255, 255, 0.42)',
    fontSize: 11,
  },
  accordionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  accordionIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionChevronWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionBody: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(10, 13, 22, 0.48)',
  },
  accordionCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  accordionPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  accordionPrimaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  accordionSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  accordionSecondaryBtnText: {
    color: '#e2e8f0',
    fontSize: 12.5,
    fontWeight: '600',
  },
  accordionToolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  accordionSortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  accordionSortText: {
    color: '#cbd5e1',
    fontSize: 11.5,
    fontWeight: '600',
  },
  accordionSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  accordionSelectText: {
    color: '#94a3b8',
    fontSize: 11.5,
    fontWeight: '600',
  },
  accordionBulkDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#ef4444',
  },
  accordionBulkDeleteText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '700',
  },
  accordionEmptyText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 12,
  },
  accordionSessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 11,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    gap: 8,
  },
  accordionSessionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  accordionSessionTime: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 10.5,
    fontWeight: '600',
  },
  accordionPersonaPill: {
    backgroundColor: `rgba(${palette.accentRgb}, 0.1)`,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    maxWidth: 140,
  },
  accordionPersonaText: {
    color: palette.accent,
    fontSize: 10,
    fontWeight: '600',
  },
  accordionSessionTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  accordionSessionTrash: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
});
