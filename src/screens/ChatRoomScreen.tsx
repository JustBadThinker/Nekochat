/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ChatRoomScreen.tsx
 * Native React Native / Expo Roleplay Experience
 * Full Parity with Warden AI:
 * - Multi-session conversations & session switching
 * - Scenario & alternate greeting cycling
 * - Lorebook context injection
 * - In-chat message editing, regeneration & continuation
 * - Dynamic OOC mode & AI Writing Coach (Refine)
 * - Novel Mode & Bubble Mode layout
 */

import React, { useState, useEffect, useRef , useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  Modal,
  Animated,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SmoothSlider } from '../components/SmoothSlider';
import { ModelDropdown } from '../components/ModelDropdown';
import { RichHtmlRenderer } from '../components/RichHtmlRenderer';
import { BottomSheetModal } from '../components/BottomSheetModal';
import { NekoSwitch } from '../components/NekoSwitch';
import { GLASS } from '../theme/glassTheme';
import {
  ArrowLeft,
  Send,
  Plus,
  MessageCircle,
  Sparkles,
  X,
  Check,
  RotateCcw,
  Square,
  Copy,
  Edit2,
  Trash2,
  Layers,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Play,
  RotateCw,
  Volume2,
  Image as ImageIcon,
  Palette,
  Maximize2,
  Minimize2,
  ImagePlus,
  MoreHorizontal,
  UserCheck,
  Smile,
  Brain,
  Cpu,
  Coins,
  Bookmark,
  GitBranch,
  Users,
  BookOpen,
  HelpCircle,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { compressImageFile } from '../utils/imageUtils';
import {
  Character,
  CharacterScenario,
  ChatMessage,
  Conversation,
  Lorebook,
  Persona,
  ProviderConfig,
  ChatStyleMode,
  DynamicCastMember,
  SceneContinuityState,
  CastPresenceStatus,
} from '../types';
import { colors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { getBubbleSurfaceStyle, getCardSurfaceStyle } from '../theme/skins';
import { runToggleAnimation } from '../theme/animations';
import { useTranslation } from '../i18n/LanguageContext';
import { imageGenService, IMAGE_STYLE_OPTIONS, ImageStylePreset } from '../services/imageGenService';
import { ttsService, TtsPlaybackState } from '../services/ttsService';
import { aiProviderService, extractCleanCharacterName } from '../services/aiProviderService';
import { storageService } from '../services/storageService';
import { getSqliteConversationRepository, resolveBranchCheckpointState } from '../services/sqliteDatabase';
import {
  CastCandidateSuggestion,
  appendCastFact,
  createPrimaryCastMember,
  createProvisionalCastMember,
  detectCastCandidates,
  extractCastCandidatesFromCard,
  getConfirmedCharacteristicsSummary,
  isWorldOrRpgCard,
} from '../services/dynamicCastService';
import { calculateCost, estimateTokens } from '../services/tokenOptimizerService';
import { tokenPriceService } from '../services/tokenPriceService';
import { NekoPulseLoader } from '../components/NekoPulseLoader';
import { InlineWaitFidget } from '../components/InlineWaitFidget';
import { DeskNekoWalker } from '../components/DeskNekoWalker';
import { HelpCenterModal } from '../components/HelpCenterModal';
import {
  ChatBackgroundLayer,
  ChatAppearanceConfig,
  GLOBAL_CHAT_APPEARANCE_KEY,
} from '../components/chat/ChatBackgroundLayer';
import { ThemePalette } from '../theme/colors';

interface ChatRoomScreenProps {
  character: Character;
  persona: Persona;
  personas: Persona[];
  onSelectPersona: (p: Persona) => void;
  config: ProviderConfig;
  onBack: () => void;
  initialConversationId?: string;
}

export const ChatRoomScreen: React.FC<ChatRoomScreenProps> = ({
  character,
  persona,
  personas,
  onSelectPersona,
  config,
  onBack,
  initialConversationId,
}) => {
  const { palette, skin } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(palette), [palette]);
  // Session & Message State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [revealState, setRevealState] = useState<{ msgId: string; shownWords: number } | null>(null);
  const [fidgetOpen, setFidgetOpen] = useState(false);
  const [composerWidth, setComposerWidth] = useState(340);
  const [isContinuingWait, setIsContinuingWait] = useState(false);
  const [fidgetScore, setFidgetScore] = useState(0);
  const [fidgetStreak, setFidgetStreak] = useState(0);
  const [chatStyle, setChatStyle] = useState<ChatStyleMode>('bubble');
  const [showActionDeck, setShowActionDeck] = useState(false);
  const actionDeckAnim = useRef(new Animated.Value(0)).current;
  const wallpaperToggleAnim = useRef(new Animated.Value(1)).current;
  const chatControlTabAnim = useRef(new Animated.Value(1)).current;

  // Scenarios, Alternate Greetings & Lorebooks
  const [lorebooks, setLorebooks] = useState<Lorebook[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showScenarioModal, setShowScenarioModal] = useState(false);

  // Message Actions & Inline Editing
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Refine / AI Writing Coach State
  const [isRefining, setIsRefining] = useState(false);
  const [refineMode, setRefineMode] = useState<'refine' | 'write'>('refine');
  const [refinePreview, setRefinePreview] = useState<string | null>(null);

  // Per-chat Custom Prompt / Rules & Header Menu & Scroll-to-Bottom FAB
  const [customPrompt, setCustomPrompt] = useState('');
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const headerMenuAnim = useRef(new Animated.Value(0)).current;
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const scrollBottomAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    runToggleAnimation(scrollBottomAnim, showScrollBottom, skin.animation);
  }, [showScrollBottom, scrollBottomAnim, skin.animation]);

  // TTS Speech State
  const [ttsState, setTtsState] = useState<TtsPlaybackState>(ttsService.getPlaybackState());

  // Image Gen / Scene Depiction State
  const [showImageModal, setShowImageModal] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageStyle, setImageStyle] = useState<ImageStylePreset>('anime');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<{ imageUrl: string; prompt: string } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // Chat Appearance & Wallpaper State (supports per-chat or global "apply to all chats")
  const [appearance, setAppearance] = useState<ChatAppearanceConfig>({
    enableWallpaper: true,
    wallpaperUrl: character.coverUrl || character.avatar || '',
    overlayOpacity: 0.38,
    blurRadius: 6,
    smartAutoOverlay: true,
    applyToAllChats: false,
  });

  // Character Profile Card Modal State (Header Name Tap)
  const [showCharacterCardModal, setShowCharacterCardModal] = useState(false);

  // Chat Control Modal State (3-Dot Button: Memory, Per-Chat Model, Syntax Colors)
  const [showChatControlModal, setShowChatControlModal] = useState(false);
  const [chatControlTab, setChatControlTab] = useState<'memory' | 'model' | 'syntax'>('memory');
  const [chatMemory, setChatMemory] = useState('');
  const [chatModel, setChatModel] = useState('');
  const [chatTemperature, setChatTemperature] = useState<number>(config?.temperature || 0.7);
  const [chatMaxTokens, setChatMaxTokens] = useState<number>(config?.maxTokens ?? 4096);
  const [promptPresets, setPromptPresets] = useState<{ id: string; name: string; prompt: string; updatedAt: number }[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [showNewPresetForm, setShowNewPresetForm] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetBody, setNewPresetBody] = useState('');
  const [settingsSubView, setSettingsSubView] = useState<'main' | 'generation' | 'custom_prompt' | 'new_custom_prompt' | 'prefill' | 'forbidden_words' | 'lorebooks'>('main');
  const [attachedLorebookIds, setAttachedLorebookIds] = useState<string[]>(character.lorebookIds || []);
  const [helpLorebookVisible, setHelpLorebookVisible] = useState(false);
  const [responseLength, setResponseLength] = useState<'standard' | 'shorter'>('standard');
  const [prefillEnabled, setPrefillEnabled] = useState(false);
  const [prefillText, setPrefillText] = useState('');
  const [forbiddenWords, setForbiddenWords] = useState<string[]>([]);
  const [forbiddenWordInput, setForbiddenWordInput] = useState('');
  const [memoryReplacesOld, setMemoryReplacesOld] = useState(false);
  const [autoMemoryEnabled, setAutoMemoryEnabled] = useState(false);
  const [autoMemoryInterval, setAutoMemoryInterval] = useState(20);
  const [visibleMessageCount, setVisibleMessageCount] = useState(40);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [textStreamingEnabled, setTextStreamingEnabled] = useState(true);
  const [chatFontSize, setChatFontSize] = useState(15);
  const [chatFontFamily, setChatFontFamily] = useState<'default' | 'serif' | 'monospace' | 'light'>('default');
  const [expandedInspectorIds, setExpandedInspectorIds] = useState<Record<string, boolean>>({});
  const inspectorScrollRefs = useRef<Record<string, React.ComponentRef<typeof ScrollView> | null>>({});
  const [expandedColorPicker, setExpandedColorPicker] = useState<'dialogue' | 'narration' | 'bold' | 'code' | null>(null);
  const [activeImageProvider, setActiveImageProvider] = useState<string>('');
  const [fetchedChatModels, setFetchedChatModels] = useState<{ id: string; name: string }[]>([]);
  const [loadingChatModels, setLoadingChatModels] = useState(false);
  const [syntaxColors, setSyntaxColors] = useState({
    dialogue: '#FFFFFF',
    narration: '#94A3B8',
    thoughts: '#38BDF8',
    bold: '#FFFFFF',
    code: '#A78BFA',
  });
  const [memorySavedNotice, setMemorySavedNotice] = useState(false);
  const [isSummarizingMemory, setIsSummarizingMemory] = useState(false);
  const [memoryNoticeText, setMemoryNoticeText] = useState('');
  const [lastCheckpointIndex, setLastCheckpointIndex] = useState<number>(-1);

  // Phase 7: Dynamic Cast & Scene Continuity State
  const [castMembers, setCastMembers] = useState<DynamicCastMember[]>([]);
  const [sceneState, setSceneState] = useState<SceneContinuityState | null>(null);
  const [castCandidate, setCastCandidate] = useState<CastCandidateSuggestion | null>(null);
  const [castCandidateMsgId, setCastCandidateMsgId] = useState<string | undefined>(undefined);
  const [showCastSheet, setShowCastSheet] = useState(false);
  const [editingCastId, setEditingCastId] = useState<string | null>(null);
  const [castDraftName, setCastDraftName] = useState('');
  const [castDraftCharacteristics, setCastDraftCharacteristics] = useState('');
  const [castLocationDraft, setCastLocationDraft] = useState('');
  const [castTimeDraft, setCastTimeDraft] = useState('');

  // Quick Persona Switcher & Personality Editor State (Dynamic from storage)
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [allPersonas, setAllPersonas] = useState<Persona[]>(personas || []);
  const [editingPersonaName, setEditingPersonaName] = useState(persona?.name || 'Ren');
  const [editingPersonaPersonality, setEditingPersonaPersonality] = useState(persona?.personality || persona?.description || '');

  // Expandable Input Box State
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [composerInputHeight, setComposerInputHeight] = useState(34);
  const composerInputRef = useRef<any>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  const scrollViewRef = useRef<any>(null);

  const chatCharName = extractCleanCharacterName(
    character.chatName || character.name,
    character.subtitle || character.tagline,
    character.firstMessage,
    character.personality || character.description
  );

  const allGreetings = [
    character.firstMessage,
    ...(character.alternateGreetings || []),
  ].filter(Boolean);

  const currentScenario = (character.scenarios || []).find(s => s.id === activeScenarioId);

  // Load persistent reading view mode (Novel vs Bubble) & Fidget stats
  useEffect(() => {
    AsyncStorage.getItem('@nekochat:chat_style').then(saved => {
      if (saved === 'novel' || saved === 'bubble') {
        setChatStyle(saved);
      }
    });
    AsyncStorage.getItem('@nekochat:custom_prompt_presets').then(raw => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setPromptPresets(parsed);
        } catch {}
      }
    });
    AsyncStorage.getItem('@nekochat:active_custom_prompt').then(raw => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed?.text === 'string' && parsed.text.trim()) {
            setCustomPrompt(prev => (prev && prev.trim() ? prev : parsed.text));
            setActivePresetId(parsed.presetId ?? null);
          }
        } catch {}
      }
    });
    imageGenService.loadConfig().then(imgCfg => {
      if (imgCfg?.provider) {
        setActiveImageProvider(imgCfg.provider);
      }
    }).catch(() => {});
    AsyncStorage.getItem('@nekochat:customize_prefs').then(raw => {
      if (raw) {
        try {
          const c = JSON.parse(raw);
          if (typeof c.autoScrollEnabled === 'boolean') setAutoScrollEnabled(c.autoScrollEnabled);
          if (typeof c.textStreamingEnabled === 'boolean') setTextStreamingEnabled(c.textStreamingEnabled);
          if (typeof c.chatFontSize === 'number') setChatFontSize(c.chatFontSize);
          if (c.chatFontFamily === 'default' || c.chatFontFamily === 'serif' || c.chatFontFamily === 'monospace' || c.chatFontFamily === 'light') {
            setChatFontFamily(c.chatFontFamily);
          }
        } catch {}
      }
    });
    AsyncStorage.getItem(`@nekochat:chat_settings_${character.id}`).then(raw => {
      if (raw) {
        try {
          const s = JSON.parse(raw);
          if (s.responseLength === 'standard' || s.responseLength === 'shorter') setResponseLength(s.responseLength);
          if (typeof s.temperature === 'number') setChatTemperature(s.temperature);
          if (typeof s.maxTokens === 'number') setChatMaxTokens(s.maxTokens);
          if (typeof s.prefillEnabled === 'boolean') setPrefillEnabled(s.prefillEnabled);
          if (typeof s.prefillText === 'string') setPrefillText(s.prefillText);
          if (Array.isArray(s.forbiddenWords)) setForbiddenWords(s.forbiddenWords);
          if (Array.isArray(s.attachedLorebookIds)) setAttachedLorebookIds(s.attachedLorebookIds);
          if (typeof s.memoryReplacesOld === 'boolean') setMemoryReplacesOld(s.memoryReplacesOld);
          if (typeof s.autoMemoryEnabled === 'boolean') setAutoMemoryEnabled(s.autoMemoryEnabled);
          if (typeof s.autoMemoryInterval === 'number' && s.autoMemoryInterval >= 4) {
            setAutoMemoryInterval(s.autoMemoryInterval);
          }
        } catch {}
      }
    });
    AsyncStorage.getItem('@nekochat:fidget_stats').then(raw => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed.score === 'number') setFidgetScore(parsed.score);
          if (typeof parsed.streak === 'number') setFidgetStreak(parsed.streak);
        } catch {}
      }
    });
  }, []);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvt, () => {
      if (autoScrollEnabled) {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 80);
      }
    });
    return () => sub.remove();
  }, [autoScrollEnabled]);

  const handleFidgetScoreChange = (nextScore: number, nextStreak: number) => {
    setFidgetScore(nextScore);
    setFidgetStreak(nextStreak);
    AsyncStorage.setItem('@nekochat:fidget_stats', JSON.stringify({ score: nextScore, streak: nextStreak })).catch(() => {});
  };

  const handleFidgetReset = () => {
    setFidgetScore(0);
    setFidgetStreak(0);
    AsyncStorage.setItem('@nekochat:fidget_stats', JSON.stringify({ score: 0, streak: 0 })).catch(() => {});
  };

  const loadPersonas = async () => {
    try {
      const list = await storageService.getPersonas();
      if (list && list.length > 0) {
        setAllPersonas(list);
      }
    } catch {}
  };

  const getSessionMemoryKey = (convId: string) => `@nekochat:chat_memory_${convId}`;
  const getSessionCheckpointKey = (convId: string) => `@nekochat:chat_checkpoint_idx_${convId}`;

  const persistSessionMemory = async (convId: string | null, memText: string, checkpointIdx?: number) => {
    if (!convId) return;
    await AsyncStorage.setItem(getSessionMemoryKey(convId), memText);
    if (typeof checkpointIdx === 'number') {
      await AsyncStorage.setItem(getSessionCheckpointKey(convId), String(checkpointIdx));
    }
  };

  const loadChatMemoryAndSettings = async (targetConvId?: string | null) => {
    try {
      const convId = targetConvId ?? activeConversationId;
      if (convId) {
        let savedMemory = await AsyncStorage.getItem(getSessionMemoryKey(convId));
        let savedLastIdx = await AsyncStorage.getItem(getSessionCheckpointKey(convId));

        // Conservative one-time check for legacy character-scoped memory
        if (savedMemory === null) {
          const legacyMemoryKey = `@nekochat:chat_memory_${character.id}`;
          const legacyIdxKey = `@nekochat:chat_checkpoint_idx_${character.id}`;
          const legacyMem = await AsyncStorage.getItem(legacyMemoryKey);

          if (legacyMem && legacyMem.replace(/<memory>|<\/memory>/gi, '').trim().length > 0) {
            const charConvs = await storageService.getConversationsForCharacter(character.id);
            if (charConvs.length <= 1) {
              // Unambiguous: migrate legacy memory to this single session
              savedMemory = legacyMem;
              await AsyncStorage.setItem(getSessionMemoryKey(convId), legacyMem);
              await AsyncStorage.removeItem(legacyMemoryKey);

              const legacyIdx = await AsyncStorage.getItem(legacyIdxKey);
              if (legacyIdx !== null) {
                const parsedIdx = parseInt(legacyIdx, 10);
                const msgLen = charConvs[0]?.messages?.length ?? 0;
                if (!isNaN(parsedIdx) && parsedIdx >= 0 && parsedIdx < msgLen) {
                  savedLastIdx = String(parsedIdx);
                  await AsyncStorage.setItem(getSessionCheckpointKey(convId), savedLastIdx);
                }
                await AsyncStorage.removeItem(legacyIdxKey);
              }
            } else {
              // Ambiguous across multiple sessions: preserve in non-injected legacy key without contaminating sessions
              await AsyncStorage.setItem(`@nekochat:legacy_ambiguous_memory_${character.id}`, legacyMem);
              await AsyncStorage.removeItem(legacyMemoryKey);
              await AsyncStorage.removeItem(legacyIdxKey);
            }
          }
        }

        if (savedMemory) {
          const hasContent = savedMemory.replace(/<memory>|<\/memory>/gi, '').trim().length > 0;
          setChatMemory(hasContent ? savedMemory : '');
        } else {
          setChatMemory('');
        }

        if (savedLastIdx !== null) {
          const parsed = parseInt(savedLastIdx, 10);
          setLastCheckpointIndex(isNaN(parsed) ? -1 : parsed);
        } else {
          setLastCheckpointIndex(-1);
        }
      } else {
        setChatMemory('');
        setLastCheckpointIndex(-1);
      }

      const savedModel = await AsyncStorage.getItem(`@nekochat:chat_model_${character.id}`);
      if (savedModel && savedModel !== 'custom') {
        setChatModel(savedModel);
      } else {
        setChatModel('');
      }

      const savedColors = await AsyncStorage.getItem('@nekochat:syntax_colors');
      if (savedColors) {
        setSyntaxColors(prev => ({ ...prev, ...JSON.parse(savedColors) }));
      }
    } catch {}
  };

  useEffect(() => {
    runToggleAnimation(actionDeckAnim, showActionDeck, skin.animation);
  }, [showActionDeck, actionDeckAnim, skin.animation]);

  useEffect(() => {
    Animated.spring(wallpaperToggleAnim, {
      toValue: appearance.enableWallpaper ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 140,
    }).start();
  }, [appearance.enableWallpaper]);

  useEffect(() => {
    runToggleAnimation(headerMenuAnim, showHeaderMenu, skin.animation);
  }, [showHeaderMenu, headerMenuAnim, skin.animation]);

  useEffect(() => {
    chatControlTabAnim.setValue(0.35);
    Animated.timing(chatControlTabAnim, {
      toValue: 1,
      duration: Math.max(140, Math.round(skin.animation.enterDuration * 0.7)),
      easing: skin.animation.easing,
      useNativeDriver: true,
    }).start();
  }, [chatControlTab, settingsSubView, skin.animation]);

  useEffect(() => {
    loadPersonas();
    loadChatMemoryAndSettings(activeConversationId);
    if (activeConversationId) {
      storageService
        .getDynamicCastState(activeConversationId, character.id)
        .then(res => {
          setCastMembers(res.castMembers);
          setSceneState(res.sceneState);
          setCastLocationDraft(res.sceneState?.currentLocation || '');
          setCastTimeDraft(res.sceneState?.establishedTime || '');
        })
        .catch(() => {});
    } else {
      setCastMembers([]);
      setSceneState(null);
    }
  }, [character.id, persona?.id, activeConversationId]);

  const hasValidMemory = (mem: string) => {
    return mem.replace(/<memory>|<\/memory>/gi, '').trim().length > 0;
  };

  /**
   * 1. Incremental Checkpoint Update:
   * Summarizes only from the last checkpoint up to the latest conversation turn.
   * If no prior checkpoint exists, performs an initial synthesis.
   * Maximizes token efficiency (JanitorAI & Warden standard)!
   */
  const runIncrementalCheckpointForList = async (targetMessages: ChatMessage[], silent = false) => {
    if (isSummarizingMemory || targetMessages.length === 0) return;

    const existingHasContent = hasValidMemory(chatMemory);
    const isFirstRun = !existingHasContent || lastCheckpointIndex < 0;

    const startIdx = isFirstRun ? 0 : Math.max(0, lastCheckpointIndex + 1);
    const contextPrefixIdx = isFirstRun ? 0 : Math.max(0, startIdx - 3);
    const messagesToSummarize = targetMessages.slice(startIdx);

    if (messagesToSummarize.length === 0 && !isFirstRun) {
      if (!silent) {
        setMemoryNoticeText('✓ Already up-to-date with latest message!');
        setTimeout(() => setMemoryNoticeText(''), 2500);
      }
      return;
    }

    setIsSummarizingMemory(true);
    if (!silent) {
      setMemoryNoticeText(
        isFirstRun
          ? `Synthesizing initial story checkpoint (${targetMessages.length} messages)...`
          : `Synthesizing incremental checkpoint (${messagesToSummarize.length} new turns)...`
      );
    }

    try {
      const activeConfig = await resolveActiveConfig();
      const existingCount = (chatMemory.match(/\[Checkpoint\s*#?(\d+)/gi) || []).length;
      const nextNum = existingCount + 1;

      const sliceForLlm = isFirstRun ? targetMessages : targetMessages.slice(contextPrefixIdx);

      const newCheckpoint = await aiProviderService.summarizeChatToCheckpoint(
        character,
        sliceForLlm,
        persona,
        activeConfig,
        {
          mode: isFirstRun ? 'full' : 'incremental',
          existingMemory: existingHasContent ? chatMemory : undefined,
          checkpointNumber: nextNum,
        }
      );

      const cleanExisting = chatMemory.replace(/<memory>\s*<\/memory>/gi, '').trim();
      const updated = cleanExisting && !isFirstRun ? `${cleanExisting}\n\n${newCheckpoint}` : newCheckpoint;
      setChatMemory(updated);
      const newLastIdx = targetMessages.length - 1;
      setLastCheckpointIndex(newLastIdx);

      await persistSessionMemory(activeConversationId, updated, newLastIdx);

      if (!silent) {
        setMemoryNoticeText(
          isFirstRun
            ? `✓ Initial Checkpoint created up to turn #${newLastIdx + 1}!`
            : `✓ Checkpoint #${nextNum} saved up to turn #${newLastIdx + 1}!`
        );
      }
    } catch (err: any) {
      if (!silent) {
        setMemoryNoticeText(`⚠️ Incremental summary failed: ${err.message || 'Error'}`);
      }
    } finally {
      setIsSummarizingMemory(false);
      if (!silent) {
        setTimeout(() => setMemoryNoticeText(''), 3500);
      }
    }
  };

  const handleIncrementalCheckpoint = () => runIncrementalCheckpointForList(messages, false);

  /**
   * 2. Full Story Rescan:
   * Re-reads the complete chat history from Message #1 to synthesize a Master Checkpoint.
   */
  const handleFullRescanMemory = async () => {
    if (isSummarizingMemory || messages.length === 0) return;

    setIsSummarizingMemory(true);
    setMemoryNoticeText(`Synthesizing full master arc (${messages.length} messages)...`);

    try {
      const activeConfig = await resolveActiveConfig();
      const masterCheckpoint = await aiProviderService.summarizeChatToCheckpoint(
        character,
        messages,
        persona,
        activeConfig,
        {
          mode: 'full',
          checkpointNumber: 1,
        }
      );

      setChatMemory(masterCheckpoint);
      const newLastIdx = messages.length - 1;
      setLastCheckpointIndex(newLastIdx);

      await persistSessionMemory(activeConversationId, masterCheckpoint, newLastIdx);

      setMemoryNoticeText(`✓ Master Checkpoint synthesized from start to finish!`);
    } catch (err: any) {
      setMemoryNoticeText(`⚠️ Full summary failed: ${err.message || 'Error'}`);
    } finally {
      setIsSummarizingMemory(false);
      setTimeout(() => setMemoryNoticeText(''), 3500);
    }
  };

  /**
   * Pins a checkpoint from an in-chat <memory> card into persistent memory notes.
   */
  const handlePinCheckpointFromMessage = async (rawMemoryBlock: string) => {
    const cleanBlock = rawMemoryBlock.trim();
    if (!cleanBlock) return;
    if (!chatMemory.includes(cleanBlock)) {
      const updated = chatMemory.trim() ? `${chatMemory.trim()}\n\n${cleanBlock}` : cleanBlock;
      setChatMemory(updated);
      await persistSessionMemory(activeConversationId, updated);
    }
    setMemorySavedNotice(true);
    setTimeout(() => setMemorySavedNotice(false), 2000);
  };

  const handleSelectModel = async (newModel: string) => {
    const clean = newModel === 'custom' ? '' : newModel;
    setChatModel(clean);
    if (clean) {
      await AsyncStorage.setItem(`@nekochat:chat_model_${character.id}`, clean);
    } else {
      await AsyncStorage.removeItem(`@nekochat:chat_model_${character.id}`);
    }
  };

  const handleFetchChatModels = async () => {
    setLoadingChatModels(true);
    try {
      const latestCfg = await storageService.getProviderConfig();
      const mergedCfg = { ...latestCfg, ...config, apiKey: config?.apiKey || latestCfg.apiKey, customEndpoint: config?.customEndpoint || latestCfg.customEndpoint, baseUrl: config?.baseUrl || latestCfg.baseUrl };
      const list = await aiProviderService.fetchModels(mergedCfg);
      setFetchedChatModels(list);
    } catch {}
    setLoadingChatModels(false);
  };

  const persistChatSettings = async (overrides: Partial<{
    responseLength: 'standard' | 'shorter';
    temperature: number;
    maxTokens: number;
    prefillEnabled: boolean;
    prefillText: string;
    forbiddenWords: string[];
    attachedLorebookIds: string[];
    memoryReplacesOld: boolean;
    autoMemoryEnabled: boolean;
    autoMemoryInterval: number;
  }> = {}) => {
    const payload = {
      responseLength: overrides.responseLength ?? responseLength,
      temperature: overrides.temperature ?? chatTemperature,
      maxTokens: overrides.maxTokens ?? chatMaxTokens,
      prefillEnabled: overrides.prefillEnabled ?? prefillEnabled,
      prefillText: overrides.prefillText ?? prefillText,
      forbiddenWords: overrides.forbiddenWords ?? forbiddenWords,
      attachedLorebookIds: overrides.attachedLorebookIds ?? attachedLorebookIds,
      memoryReplacesOld: overrides.memoryReplacesOld ?? memoryReplacesOld,
      autoMemoryEnabled: overrides.autoMemoryEnabled ?? autoMemoryEnabled,
      autoMemoryInterval: overrides.autoMemoryInterval ?? autoMemoryInterval,
    };
    await AsyncStorage.setItem(`@nekochat:chat_settings_${character.id}`, JSON.stringify(payload)).catch(() => {});
  };

  const persistCustomizePrefs = async (overrides: Partial<{
    autoScrollEnabled: boolean;
    textStreamingEnabled: boolean;
    chatFontSize: number;
    chatFontFamily: 'default' | 'serif' | 'monospace' | 'light';
  }> = {}) => {
    const payload = {
      autoScrollEnabled: overrides.autoScrollEnabled ?? autoScrollEnabled,
      textStreamingEnabled: overrides.textStreamingEnabled ?? textStreamingEnabled,
      chatFontSize: overrides.chatFontSize ?? chatFontSize,
      chatFontFamily: overrides.chatFontFamily ?? chatFontFamily,
    };
    await AsyncStorage.setItem('@nekochat:customize_prefs', JSON.stringify(payload)).catch(() => {});
  };

  const resolveMessageFontFamily = (): string | undefined => {
    if (chatFontFamily === 'serif') {
      return Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' });
    }
    if (chatFontFamily === 'monospace') {
      return Platform.select({ ios: 'Courier', android: 'monospace', web: 'monospace' });
    }
    if (chatFontFamily === 'light') {
      return Platform.select({ ios: 'Avenir-Light', android: 'sans-serif-light', web: 'system-ui, sans-serif' });
    }
    return undefined;
  };

  const getPromptHistory = (fullHistory: ChatMessage[]) => {
    if (memoryReplacesOld && chatMemory.trim() && lastCheckpointIndex >= 0 && lastCheckpointIndex < fullHistory.length - 1) {
      return fullHistory.slice(lastCheckpointIndex + 1);
    }
    return fullHistory;
  };

  // Note: Session memory is injected once via aiProviderService.streamChat(..., { memory: chatMemory }),
  // never duplicated into effectiveChar.scenario here.
  const buildExtraContext = () =>
    [
      customPrompt.trim() ? `[Custom Chat Rules & Prompt: ${customPrompt.trim()}]` : '',
      responseLength === 'shorter'
        ? '[Response Length: Shorter — keep replies concise and minimum length, maximum 5 paragraphs.]'
        : '[Response Length: Standard — write rich, detailed roleplay replies of 6 to 9 well-paced paragraphs.]',
      forbiddenWords.length > 0
        ? `[Avoid using these words or phrases: ${forbiddenWords.join(', ')}]`
        : '',
      prefillEnabled && prefillText.trim()
        ? `[Response Prefill: Begin your reply immediately with "${prefillText.trim()}" and continue seamlessly in that voice and format.]`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

  const resolveActiveConfig = async (): Promise<ProviderConfig> => {
    const storedCfg = await storageService.getProviderConfig();
    const baseCfg: ProviderConfig = config?.apiKey ? { ...storedCfg, ...config } : { ...config, ...storedCfg };
    const effectiveModel =
      chatModel && chatModel.trim() && chatModel !== 'custom'
        ? chatModel.trim()
        : baseCfg.model || baseCfg.defaultModel || 'gpt-4o-mini';
    const rawTokens = chatMaxTokens === 0 ? 0 : (chatMaxTokens ?? baseCfg.maxTokens ?? 4096);
    const effectiveTokens = responseLength === 'shorter' ? (rawTokens > 0 ? Math.min(rawTokens, 950) : 950) : rawTokens;
    const isPerChatOverride =
      responseLength === 'shorter' ||
      (typeof chatMaxTokens === 'number' && chatMaxTokens !== (baseCfg.maxTokens ?? 4096));
    return {
      ...baseCfg,
      model: effectiveModel,
      temperature: chatTemperature ?? baseCfg.temperature,
      maxTokens: effectiveTokens,
      userConfiguredMaxTokens: isPerChatOverride ? true : baseCfg.userConfiguredMaxTokens,
    };
  };

  const handleSelectTemperature = async (temp: number) => {
    setChatTemperature(temp);
    persistChatSettings({ temperature: temp });
  };

  const handleAddForbiddenWord = () => {
    const w = forbiddenWordInput.trim();
    if (!w || forbiddenWords.length >= 10) return;
    if (forbiddenWords.some(existing => existing.toLowerCase() === w.toLowerCase())) {
      setForbiddenWordInput('');
      return;
    }
    const next = [...forbiddenWords, w];
    setForbiddenWords(next);
    setForbiddenWordInput('');
    persistChatSettings({ forbiddenWords: next });
  };

  const handleRemoveForbiddenWord = (word: string) => {
    const next = forbiddenWords.filter(w => w !== word);
    setForbiddenWords(next);
    persistChatSettings({ forbiddenWords: next });
  };

  const handleApplyCustomPrompt = async (text: string, presetId: string | null = null) => {
    setCustomPrompt(text);
    setActivePresetId(presetId);
    if (text.trim()) {
      await AsyncStorage.setItem(
        '@nekochat:active_custom_prompt',
        JSON.stringify({ presetId, text })
      ).catch(() => {});
    } else {
      await AsyncStorage.removeItem('@nekochat:active_custom_prompt').catch(() => {});
    }
    if (activeConversationId) {
      const conv = await storageService.getConversation(activeConversationId);
      if (conv) {
        await storageService.updateConversation({ ...conv, customPrompt: text });
      }
    }
  };

  const handleSaveNewPreset = async () => {
    const trimmedName = newPresetName.trim();
    const trimmedBody = newPresetBody.trim();
    if (!trimmedName || !trimmedBody) return;
    const newPreset = {
      id: `preset_${Date.now()}`,
      name: trimmedName,
      prompt: trimmedBody,
      updatedAt: Date.now(),
    };
    const next = [newPreset, ...promptPresets];
    setPromptPresets(next);
    await AsyncStorage.setItem('@nekochat:custom_prompt_presets', JSON.stringify(next));
    await handleApplyCustomPrompt(trimmedBody, newPreset.id);
    setNewPresetName('');
    setNewPresetBody('');
    setShowNewPresetForm(false);
  };

  const handleDeletePreset = async (id: string) => {
    const next = promptPresets.filter(p => p.id !== id);
    setPromptPresets(next);
    await AsyncStorage.setItem('@nekochat:custom_prompt_presets', JSON.stringify(next));
    if (activePresetId === id) {
      setActivePresetId(null);
      setCustomPrompt('');
      await AsyncStorage.removeItem('@nekochat:active_custom_prompt').catch(() => {});
    }
  };

  const handleUpdateSyntaxColors = async (updates: Partial<typeof syntaxColors>) => {
    const next = { ...syntaxColors, ...updates };
    setSyntaxColors(next);
    await AsyncStorage.setItem('@nekochat:syntax_colors', JSON.stringify(next));
  };

  const handleToggleChatStyle = async () => {
    const next: ChatStyleMode = chatStyle === 'bubble' ? 'novel' : 'bubble';
    setChatStyle(next);
    await AsyncStorage.setItem('@nekochat:chat_style', next);
  };

  const handleSaveActivePersonaPersonality = async () => {
    if (!persona) return;
    const updatedPersona: Persona = {
      ...persona,
      name: editingPersonaName.trim() || persona.name,
      personality: editingPersonaPersonality.trim(),
      description: editingPersonaPersonality.trim(),
    };
    await storageService.upsertPersona(updatedPersona);
    onSelectPersona(updatedPersona);
    await loadPersonas();
    setShowPersonaModal(false);
  };

  useEffect(() => {
    const unsub = ttsService.subscribe(setTtsState);
    return () => {
      unsub();
      ttsService.stop();
    };
  }, []);

  useEffect(() => {
    loadChat();
    loadChatAppearance();
  }, [character.id]);

  const loadChatAppearance = async () => {
    try {
      const [savedGlobal, savedLocal] = await Promise.all([
        AsyncStorage.getItem(GLOBAL_CHAT_APPEARANCE_KEY),
        AsyncStorage.getItem(`@nekochat:chat_appearance_${character.id}`),
      ]);
      const globalParsed = savedGlobal ? (JSON.parse(savedGlobal) as Partial<ChatAppearanceConfig>) : null;
      const localParsed = savedLocal ? (JSON.parse(savedLocal) as Partial<ChatAppearanceConfig>) : null;

      if (globalParsed?.applyToAllChats) {
        setAppearance(prev => ({ ...prev, ...globalParsed, applyToAllChats: true }));
      } else if (localParsed) {
        setAppearance(prev => ({ ...prev, ...localParsed }));
      } else {
        setAppearance({
          enableWallpaper: true,
          wallpaperUrl: character.coverUrl || character.avatar || '',
          overlayOpacity: 0.38,
          blurRadius: 6,
          smartAutoOverlay: true,
          applyToAllChats: false,
        });
      }
    } catch (err) {
      console.warn('[ChatAppearance] Failed to load saved wallpaper preferences:', err);
    }
  };

  const saveChatAppearance = async (updates: Partial<ChatAppearanceConfig>) => {
    const next = { ...appearance, ...updates };
    setAppearance(next);
    try {
      await AsyncStorage.setItem(`@nekochat:chat_appearance_${character.id}`, JSON.stringify(next));
      if (next.applyToAllChats) {
        await AsyncStorage.setItem(GLOBAL_CHAT_APPEARANCE_KEY, JSON.stringify(next));
      } else if (updates.applyToAllChats === false) {
        await AsyncStorage.removeItem(GLOBAL_CHAT_APPEARANCE_KEY);
      }
    } catch (err) {
      console.warn('[ChatAppearance] Failed to save wallpaper preferences:', err);
    }
  };

  const handlePickWallpaper = async () => {
    try {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            const base64 = await compressImageFile(file, 1280);
            saveChatAppearance({ enableWallpaper: true, wallpaperUrl: base64 });
          }
        };
        input.click();
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.85,
          base64: true,
        });
        if (!result.canceled && result.assets?.[0]) {
          const asset = result.assets[0];
          const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
          saveChatAppearance({ enableWallpaper: true, wallpaperUrl: uri });
        }
      }
    } catch (err) {
      console.warn('Failed to pick custom wallpaper:', err);
    }
  };

  const loadChat = async () => {
    // 1. Load active Lorebooks
    const lbs = await storageService.getLorebooks();
    setLorebooks(lbs);

    // 2. Load conversations for this character
    const convs = await storageService.getConversationsForCharacter(character.id);
    setConversations(convs);

    if (convs.length > 0) {
      const activeConv = initialConversationId
        ? convs.find(c => c.id === initialConversationId) || convs[0]
        : convs[0];
      setActiveConversationId(activeConv.id);
      setActiveScenarioId(activeConv.scenarioId || null);
      setCustomPrompt(activeConv.customPrompt || '');
      setMessages(activeConv.messages || []);
    } else {
      // Create first conversation
      const newConv = await storageService.createConversation(
        character,
        persona.id,
        config.id || 'prov_gemini',
        character.scenarios?.[0]?.id,
        character.scenarios?.[0]?.title
      );
      setConversations([newConv]);
      setActiveConversationId(newConv.id);
      setActiveScenarioId(newConv.scenarioId || null);
      setCustomPrompt(newConv.customPrompt || '');
      setMessages(newConv.messages || []);
    }
  };

  // --- Session Switching ---
  const handleStartNewSession = async (scenario?: CharacterScenario) => {
    setShowSessionModal(false);
    setShowScenarioModal(false);
    setShowHeaderMenu(false);
    const newConv = await storageService.createConversation(
      character,
      persona.id,
      config.id || 'prov_gemini',
      scenario?.id,
      scenario?.title
    );
    const updated = [newConv, ...conversations];
    setConversations(updated);
    setActiveConversationId(newConv.id);
    setActiveScenarioId(newConv.scenarioId || null);
    setCustomPrompt(newConv.customPrompt || '');
    setMessages(newConv.messages || []);
    setGreetingIndex(0);
  };

  const handleSwitchSession = (conv: Conversation) => {
    setShowSessionModal(false);
    setActiveConversationId(conv.id);
    setActiveScenarioId(conv.scenarioId || null);
    setCustomPrompt(conv.customPrompt || '');
    setMessages(conv.messages || []);
  };

  // --- Alternate Greetings Cycler ---
  const handleStepGreeting = async (dir: -1 | 1) => {
    if (messages.length > 1 || allGreetings.length <= 1) return;
    const nextIdx = (greetingIndex + dir + allGreetings.length) % allGreetings.length;
    setGreetingIndex(nextIdx);
    const updatedFirst: ChatMessage = {
      ...messages[0],
      content: allGreetings[nextIdx],
    };
    const updated = [updatedFirst];
    setMessages(updated);
    if (activeConversationId) {
      const conv = await storageService.getConversation(activeConversationId);
      if (conv) {
        await storageService.updateConversation({ ...conv, messages: updated });
      }
    } else {
      await storageService.saveMessages(character.id, updated);
    }
  };

  const handleCycleGreeting = () => handleStepGreeting(1);

  const handleOpenCastSheet = async (prefillName?: string) => {
    setShowHeaderMenu(false);
    if (activeConversationId && !castMembers.some(m => m.isPrimary)) {
      const isRpg = isWorldOrRpgCard(character);
      const primary = createPrimaryCastMember({
        conversationId: activeConversationId,
        characterId: character.id,
        name: isRpg ? 'Narrator / Game Master' : chatCharName,
      });
      await storageService.saveCastMember(primary);
      setCastMembers(prev => [primary, ...prev]);
    }
    setEditingCastId(null);
    setCastDraftName(prefillName || '');
    setCastDraftCharacteristics('');
    setShowCastSheet(true);
  };

  const handleSaveCastDraft = async () => {
    const cleanName = castDraftName.trim();
    if (!cleanName || !activeConversationId) return;
    let current = castMembers;
    if (!current.some(m => m.isPrimary)) {
      const isRpg = isWorldOrRpgCard(character);
      const primary = createPrimaryCastMember({
        conversationId: activeConversationId,
        characterId: character.id,
        name: isRpg ? 'Narrator / Game Master' : chatCharName,
      });
      await storageService.saveCastMember(primary);
      current = [primary, ...current];
    }

    const existing = editingCastId ? current.find(m => m.id === editingCastId) : undefined;
    if (existing) {
      let updated: DynamicCastMember = { ...existing, name: cleanName, facts: [], updatedAt: Date.now() };
      const cleanDesc = castDraftCharacteristics.trim();
      if (cleanDesc) {
        const lastMsg = messages[messages.length - 1];
        updated = appendCastFact(updated, {
          field: 'fact',
          value: cleanDesc,
          sourceType: 'user',
          confirmed: true,
          sourceMessageId: lastMsg?.id,
          turnIndex: messages.length > 0 ? messages.length - 1 : undefined,
        });
      } else {
        updated.profileStatus = 'stub';
      }
      await storageService.saveCastMember(updated);
      setCastMembers(current.map(m => (m.id === updated.id ? updated : m)));
    } else {
      const lastMsg = messages[messages.length - 1];
      const created = createProvisionalCastMember({
        conversationId: activeConversationId,
        characterId: character.id,
        name: cleanName,
        presence: 'present',
        aiControlled: true,
        characteristics: castDraftCharacteristics.trim() || undefined,
        sourceMessageId: lastMsg?.id,
        turnIndex: messages.length > 0 ? messages.length - 1 : undefined,
      });
      created.singleTurnOnly = true;
      await storageService.saveCastMember(created);
      setCastMembers([...current, created]);
      if (castCandidate && castCandidate.name.toLowerCase() === cleanName.toLowerCase()) {
        setCastCandidate(null);
        setCastCandidateMsgId(undefined);
      }
    }
    setEditingCastId(null);
    setCastDraftName('');
    setCastDraftCharacteristics('');
  };

  const handleCycleCastPresence = async (member: DynamicCastMember) => {
    const order: CastPresenceStatus[] = ['present', 'away', 'unknown'];
    const nextPresence = order[(order.indexOf(member.presence) + 1) % order.length];
    const updated: DynamicCastMember = { ...member, presence: nextPresence, updatedAt: Date.now() };
    await storageService.saveCastMember(updated);
    setCastMembers(prev => prev.map(m => (m.id === updated.id ? updated : m)));
  };

  const handleToggleCastAi = async (member: DynamicCastMember) => {
    const updated: DynamicCastMember = { ...member, aiControlled: !member.aiControlled, updatedAt: Date.now() };
    await storageService.saveCastMember(updated);
    setCastMembers(prev => prev.map(m => (m.id === updated.id ? updated : m)));
  };

  const handleSaveSceneLocationTime = async () => {
    if (!activeConversationId) return;
    const lastMsg = messages[messages.length - 1];
    const nextScene: SceneContinuityState = {
      conversationId: activeConversationId,
      characterId: character.id,
      currentLocation: castLocationDraft.trim(),
      establishedTime: castTimeDraft.trim(),
      ongoingActivities: sceneState?.ongoingActivities || [],
      unresolvedActions: sceneState?.unresolvedActions || [],
      lastTransitionMessageId: lastMsg?.id,
      lastTransitionTurnIndex: messages.length > 0 ? messages.length - 1 : undefined,
      updatedAt: Date.now(),
    };
    await storageService.saveSceneState(nextScene);
    setSceneState(nextScene);
  };

  // --- Non-Destructive Reply Alternatives (< 1 / N >) ---
  const handleSwipeAlternative = async (dir: -1 | 1) => {
    if (isStreaming || messages.length === 0) return;
    const lastIdx = messages.length - 1;
    const lastMsg = messages[lastIdx];
    if (!lastMsg || lastMsg.role !== 'assistant' || lastIdx === 0) return;

    const swipes = lastMsg.swipes && lastMsg.swipes.length > 0 ? lastMsg.swipes : [lastMsg.content];
    const curIdx = typeof lastMsg.swipeIndex === 'number' ? lastMsg.swipeIndex : swipes.length - 1;

    if (dir === -1) {
      if (curIdx <= 0) return;
      const nextIdx = curIdx - 1;
      const updated = [...messages];
      updated[lastIdx] = {
        ...lastMsg,
        content: swipes[nextIdx],
        swipes,
        swipeIndex: nextIdx,
      };
      setMessages(updated);
      await persistMessagesList(updated);
      return;
    }

    // dir === 1
    if (curIdx < swipes.length - 1) {
      const nextIdx = curIdx + 1;
      const updated = [...messages];
      updated[lastIdx] = {
        ...lastMsg,
        content: swipes[nextIdx],
        swipes,
        swipeIndex: nextIdx,
      };
      setMessages(updated);
      await persistMessagesList(updated);
      return;
    }

    // At the last alternative -> generate a new one without erasing previous alternatives
    const trimmed = messages.slice(0, lastIdx);
    if (trimmed.length === 0) return;
    const lastTurn = trimmed[trimmed.length - 1];
    const promptText = lastTurn.role === 'user' ? lastTurn.content : '[Continue the opening scene in character.]';
    setMessages(trimmed);
    await persistMessagesList(trimmed);
    await triggerAiStream(trimmed, promptText, swipes);
  };

  // --- Sending & Streaming ---
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    setInputText('');
    setComposerInputHeight(34);
    if (Platform.OS === 'web' && composerInputRef.current) {
      (composerInputRef.current as any).style.height = '34px';
    }
    setShowActionDeck(false);

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      conversationId: activeConversationId || undefined,
      characterId: character.id,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const updated = [...messages, userMsg];
    setMessages(updated);

    if (activeConversationId) {
      await storageService.appendMessageToConversation(activeConversationId, userMsg);
    } else {
      await storageService.appendMessage(character.id, userMsg);
    }

    const candidates = detectCastCandidates({
      message: text,
      primaryCharName: chatCharName,
      userName: persona?.name || 'User',
      existingCast: castMembers,
    });
    if (candidates.length > 0 && candidates[0].signal !== 'mention') {
      setCastCandidate(candidates[0]);
      setCastCandidateMsgId(userMsg.id);
    }

    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    await triggerAiStream(updated, text);
  };

  const persistMessagesList = async (updatedList: ChatMessage[]) => {
    if (activeConversationId) {
      const conv = await storageService.getConversation(activeConversationId);
      if (conv) {
        await storageService.updateConversation({ ...conv, messages: updatedList });
      }
    } else {
      await storageService.saveMessages(character.id, updatedList);
    }
  };

  const triggerAiStream = async (
    historyWithUser: ChatMessage[],
    userMessage: string,
    existingSwipes?: string[]
  ) => {
    setIsStreaming(true);
    let incomingAssistantText = '';
    let capturedBackendPrompt = '';

    const assistantPlaceholderId = `bot-${Date.now()}`;
    setRevealState({ msgId: assistantPlaceholderId, shownWords: 0 });
    const assistantMsg: ChatMessage = {
      id: assistantPlaceholderId,
      conversationId: activeConversationId || undefined,
      characterId: character.id,
      role: 'assistant',
      content: '...',
      timestamp: Date.now(),
    };

    const withPlaceholder = [...historyWithUser, assistantMsg];
    setMessages(withPlaceholder);

    const activeConfig = await resolveActiveConfig();
    const extraContext = buildExtraContext();
    const effectiveChar: Character = {
      ...character,
      lorebookIds: Array.from(new Set([...(character.lorebookIds || []), ...attachedLorebookIds])),
      ...(extraContext ? { scenario: `${character.scenario || ''}\n${extraContext}`.trim() } : {}),
    };

    await aiProviderService.streamChat(
      effectiveChar,
      getPromptHistory(historyWithUser),
      userMessage,
      persona,
      activeConfig,
      {
        onPromptBuilt: builtPrompt => {
          capturedBackendPrompt = builtPrompt;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantPlaceholderId ? { ...m, backendPrompt: builtPrompt } : m
            )
          );
        },
        onChunk: chunk => {
          incomingAssistantText += chunk;
          if (textStreamingEnabled) {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantPlaceholderId ? { ...m, content: incomingAssistantText } : m
              )
            );
            if (autoScrollEnabled) {
              scrollViewRef.current?.scrollToEnd({ animated: false });
            }
          }
        },
        onError: err => {
          setIsStreaming(false);
          setIsContinuingWait(false);
          setRevealState(null);
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantPlaceholderId
                ? { ...m, content: `⚠️ Error: ${err.message}` }
                : m
            )
          );
        },
        onComplete: async (fullText, tokenCount, thought) => {
          setIsStreaming(false);
          // Auto-reset 1-turn-only cast members back to away so they don't leak into subsequent turns
          const singleTurnMembers = castMembers.filter(
            m => !m.isPrimary && m.singleTurnOnly && m.presence === 'present'
          );
          if (singleTurnMembers.length > 0) {
            const nowMs = Date.now();
            const nextCast = castMembers.map(m =>
              !m.isPrimary && m.singleTurnOnly && m.presence === 'present'
                ? { ...m, presence: 'away' as CastPresenceStatus, aiControlled: false, updatedAt: nowMs }
                : m
            );
            setCastMembers(nextCast);
            for (const m of nextCast) {
              if (!m.isPrimary && m.singleTurnOnly) {
                storageService.saveCastMember(m).catch(() => {});
              }
            }
          }
          const candidateText = fullText || incomingAssistantText || '';
          const visibleText = stripThinkTags(candidateText).trim();
          const finalText =
            visibleText.length > 0
              ? candidateText
              : '*(Empty response — tap Regenerate or Continue)*';
          const nextSwipes =
            existingSwipes && existingSwipes.length > 0
              ? [...existingSwipes, finalText]
              : [finalText];
          const finalMsg: ChatMessage = {
            id: assistantPlaceholderId,
            conversationId: activeConversationId || undefined,
            characterId: character.id,
            role: 'assistant',
            content: finalText,
            swipes: nextSwipes,
            swipeIndex: nextSwipes.length - 1,
            thought,
            backendPrompt: capturedBackendPrompt || undefined,
            tokenCount,
            timestamp: Date.now(),
          };
          const finalMessages = historyWithUser.concat([finalMsg]);
          setMessages(finalMessages);
          await persistMessagesList(finalMessages);

          const turnsSinceCheckpoint = finalMessages.length - 1 - lastCheckpointIndex;
          if (
            autoMemoryEnabled &&
            !isSummarizingMemory &&
            turnsSinceCheckpoint >= Math.max(4, autoMemoryInterval)
          ) {
            runIncrementalCheckpointForList(finalMessages, true).catch(() => {});
          }
        },
      },
      {
        conversationId: activeConversationId || undefined,
        scenario: currentScenario,
        lorebooks,
        memory: chatMemory,
      }
    );
  };

  // --- Message Actions ---
  const handleCopyMessage = (msg: ChatMessage) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(msg.content);
    }
    setCopiedId(msg.id);
    setSelectedMessageId(null);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const invalidateSessionMemoriesForTurn = async (
    affectedIds: string[],
    minAffectedIdx: number,
    action: 'edit' | 'delete' | 'regenerate'
  ) => {
    if (!activeConversationId) return;
    if (lastCheckpointIndex >= minAffectedIdx && minAffectedIdx >= 0) {
      const nextIdx = Math.max(-1, minAffectedIdx - 1);
      setLastCheckpointIndex(nextIdx);
      await AsyncStorage.setItem(getSessionCheckpointKey(activeConversationId), String(nextIdx)).catch(() => {});
    }
    try {
      const repo = await getSqliteConversationRepository();
      if (repo) {
        for (const msgId of affectedIds) {
          await repo.invalidateMemoriesForMessage({
            conversationId: activeConversationId,
            characterId: character.id,
            messageId: msgId,
            action,
          });
        }
      }
      for (const msgId of affectedIds) {
        await storageService.invalidateCastFactsForMessage(activeConversationId, character.id, msgId);
      }
      const refreshedCast = await storageService.getDynamicCastState(activeConversationId, character.id);
      setCastMembers(refreshedCast.castMembers);
    } catch {}
  };

  const handlePinMessageToMemory = async (msg: ChatMessage) => {
    setSelectedMessageId(null);
    const clean = stripThinkTags(msg.content || '').replace(/\s+/g, ' ').trim().slice(0, 260);
    if (!clean) return;

    if (activeConversationId) {
      try {
        const repo = await getSqliteConversationRepository();
        if (repo) {
          await repo.addSessionMemory({
            conversationId: activeConversationId,
            characterId: character.id,
            memoryType: 'pinned',
            content: clean,
            isPinned: true,
            sourceMessageIds: [msg.id],
          });
        }
      } catch {}
    }

    const pinLine = `[Pinned] ${clean}`;
    if (!chatMemory.includes(pinLine)) {
      const updated = chatMemory.trim() ? `${chatMemory.trim()}\n${pinLine}` : pinLine;
      setChatMemory(updated);
      await persistSessionMemory(activeConversationId, updated);
    }
    setMemoryNoticeText('✓ Pinned to this session memory');
    setTimeout(() => setMemoryNoticeText(''), 2200);
  };

  /**
   * Cascading Delete:
   * Deleting a message automatically deletes it AND all messages below it in the thread.
   */
  const handleDeleteMessage = async (msgId: string) => {
    setSelectedMessageId(null);
    const targetIdx = messages.findIndex(m => m.id === msgId);
    const removedIds = targetIdx >= 0 ? messages.slice(targetIdx).map(m => m.id) : [msgId];
    const updated = targetIdx >= 0 ? messages.slice(0, targetIdx) : messages.filter(m => m.id !== msgId);
    setMessages(updated);
    await persistMessagesList(updated);
    await invalidateSessionMemoriesForTurn(removedIds, targetIdx >= 0 ? targetIdx : messages.length - 1, 'delete');
  };

  /**
   * Native SQLite-only atomic conversation branching up to `msg` (inclusive).
   * Excludes future turns, unattributed/future memories, and future checkpoints.
   */
  const handleBranchFromMessage = async (msg: ChatMessage) => {
    setSelectedMessageId(null);
    if (isStreaming || Platform.OS === 'web' || !activeConversationId) return;

    const targetIdx = messages.findIndex(m => m.id === msg.id);
    if (targetIdx < 0) return;

    const branched = await storageService.branchConversation({
      sourceConversationId: activeConversationId,
      characterId: character.id,
      branchMessageId: msg.id,
      title: `Branch · Turn ${targetIdx + 1}`,
    });
    if (!branched) return;

    const checkpointState = resolveBranchCheckpointState({
      chatMemory,
      lastCheckpointIndex,
      branchTurnIndex: branched.branchTurnIndex,
      sourceMessageCount: branched.sourceMessageCount,
    });

    await persistSessionMemory(
      branched.conversation.id,
      checkpointState.chatMemory,
      checkpointState.lastCheckpointIndex
    );

    const updatedConvs = await storageService.getConversationsForCharacter(character.id);
    setConversations(updatedConvs);
    setActiveConversationId(branched.conversation.id);
    setMessages(branched.conversation.messages);
    setChatMemory(checkpointState.chatMemory);
    setLastCheckpointIndex(checkpointState.lastCheckpointIndex);

    setMemoryNoticeText(
      checkpointState.excludedFutureCheckpoint || branched.excludedMemoriesCount > 0
        ? `✓ Branched at Turn #${targetIdx + 1} (future memories/checkpoints excluded)`
        : `✓ Branched cleanly at Turn #${targetIdx + 1}`
    );
    setTimeout(() => setMemoryNoticeText(''), 3000);
  };

  const handleStartEdit = (msg: ChatMessage) => {
    setSelectedMessageId(null);
    setEditingMessageId(msg.id);
    setEditText(msg.content);
  };

  const handleSaveEdit = async (regenerateAfter: boolean = false) => {
    if (!editingMessageId || !editText.trim()) return;
    const targetIdx = messages.findIndex(m => m.id === editingMessageId);
    if (targetIdx < 0) return;
    const affectedIds = regenerateAfter
      ? messages.slice(targetIdx).map(m => m.id)
      : [messages[targetIdx].id];

    if (regenerateAfter) {
      if (isStreaming) {
        aiProviderService.abortGeneration();
        setIsStreaming(false);
        setIsContinuingWait(false);
        setRevealState(null);
      }
      setEditingMessageId(null);
      const updated = [...messages];
      updated[targetIdx] = { ...updated[targetIdx], content: editText.trim() };
      setMessages(updated);
      await persistMessagesList(updated);
      await invalidateSessionMemoriesForTurn(affectedIds, targetIdx, 'regenerate');
      await handleRegenerate(targetIdx, editText.trim());
    } else {
      const updated = [...messages];
      updated[targetIdx] = { ...updated[targetIdx], content: editText.trim() };
      setMessages(updated);
      setEditingMessageId(null);
      await persistMessagesList(updated);
      await invalidateSessionMemoriesForTurn(affectedIds, targetIdx, 'edit');
    }
  };

  /**
   * Regenerate Response:
   * Truncates any assistant replies after the target user message, persists the clean history,
   * and streams a fresh response from the active AI provider.
   */
  const handleRegenerate = async (specificIndex?: number, newText?: string) => {
    if (isStreaming || messages.length === 0) return;
    setSelectedMessageId(null);
    setShowActionDeck(false);

    let trimmed: ChatMessage[] = [];
    if (specificIndex !== undefined) {
      const targetMsg = messages[specificIndex];
      if (targetMsg && targetMsg.role === 'assistant') {
        // Regenerating from an assistant bubble: keep everything up to the preceding message
        trimmed = messages.slice(0, specificIndex);
      } else {
        trimmed = messages.slice(0, specificIndex + 1);
        if (newText) {
          trimmed[specificIndex] = { ...trimmed[specificIndex], content: newText };
        }
      }
    } else {
      let lastUserIdx = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          lastUserIdx = i;
          break;
        }
      }
      if (lastUserIdx >= 0) {
        trimmed = messages.slice(0, lastUserIdx + 1);
      } else {
        // Opening greeting only — regenerate a fresh follow-up from the character
        trimmed = messages.slice(0, 1);
      }
    }

    if (trimmed.length === 0) return;
    const removedIds = messages.slice(trimmed.length).map(m => m.id);
    const lastTurn = trimmed[trimmed.length - 1];
    const promptText = lastTurn.role === 'user' ? lastTurn.content : '[Continue the opening scene in character.]';

    setMessages(trimmed);
    await persistMessagesList(trimmed);
    if (removedIds.length > 0) {
      await invalidateSessionMemoriesForTurn(removedIds, trimmed.length, 'regenerate');
    }
    await triggerAiStream(trimmed, promptText);
  };

  const handleContinue = async () => {
    if (isStreaming || messages.length === 0) return;
    setSelectedMessageId(null);

    const lastIdx = messages.length - 1;
    const lastMsg = messages[lastIdx];
    if (lastMsg.role !== 'assistant') return;

    setIsStreaming(true);
    setIsContinuingWait(true);
    let continuedText = lastMsg.content;

    const activeConfig = await resolveActiveConfig();
    const extraContext = buildExtraContext();
    const effectiveChar: Character = {
      ...character,
      lorebookIds: Array.from(new Set([...(character.lorebookIds || []), ...attachedLorebookIds])),
      ...(extraContext ? { scenario: `${character.scenario || ''}\n${extraContext}`.trim() } : {}),
    };

    await aiProviderService.streamChat(
      effectiveChar,
      getPromptHistory(messages),
      '',
      persona,
      activeConfig,
      {
        onPromptBuilt: builtPrompt => {
          setMessages(prev =>
            prev.map((m, idx) =>
              idx === lastIdx ? { ...m, backendPrompt: builtPrompt } : m
            )
          );
        },
        onChunk: chunk => {
          setIsContinuingWait(false);
          continuedText += chunk;
          if (textStreamingEnabled) {
            setMessages(prev =>
              prev.map((m, idx) => (idx === lastIdx ? { ...m, content: continuedText } : m))
            );
            if (autoScrollEnabled) {
              scrollViewRef.current?.scrollToEnd({ animated: false });
            }
          }
        },
        onError: err => {
          setIsContinuingWait(false);
          setIsStreaming(false);
          setRevealState(null);
          setMessages(prev =>
            prev.map((m, idx) =>
              idx === lastIdx ? { ...m, content: `${m.content}\n\n⚠️ Error continuing: ${err.message}` } : m
            )
          );
        },
        onComplete: async (fullText, tokenCount, thought) => {
          setIsContinuingWait(false);
          setIsStreaming(false);
          const finalMsg: ChatMessage = {
            ...lastMsg,
            content: continuedText,
            tokenCount: (lastMsg.tokenCount || 0) + tokenCount,
            thought: thought || lastMsg.thought,
          };
          const updated = messages.map((m, idx) => (idx === lastIdx ? finalMsg : m));
          setMessages(updated);
          await persistMessagesList(updated);
        },
      },
      {
        conversationId: activeConversationId || undefined,
        scenario: currentScenario,
        lorebooks,
        isContinue: true,
        memory: chatMemory,
      }
    );
  };

  // AI Writing Coach (Refine Draft OR Write for Me from Scratch)
  const handleRefine = async (forceMode?: 'refine' | 'write') => {
    const hasDraft = inputText.trim().length > 0;
    const mode: 'refine' | 'write' = forceMode || (hasDraft ? 'refine' : 'write');
    if (mode === 'refine' && !hasDraft) return;

    setRefineMode(mode);
    setIsRefining(true);
    setShowActionDeck(false);

    try {
      const activeConfig = await resolveActiveConfig();
      const recentContext = messages
        .slice(-6)
        .map(m => `${m.role === 'user' ? persona.name : chatCharName}: ${m.content}`)
        .join('\n\n');
      const scratchContext = [
        chatMemory.trim() ? `[Saved Memory:\n${chatMemory.trim()}]` : '',
        recentContext ? `[Recent Messages:\n${recentContext}]` : '',
      ]
        .filter(Boolean)
        .join('\n\n');
      const lastBot =
        mode === 'write'
          ? scratchContext || messages.filter(m => m.role === 'assistant').pop()?.content || ''
          : messages.filter(m => m.role === 'assistant').pop()?.content || '';
      const polished = await aiProviderService.refineMessage(
        mode === 'write' ? '' : inputText,
        character,
        lastBot,
        persona,
        activeConfig
      );
      if (polished && polished.trim()) {
        setRefinePreview(polished);
      }
    } finally {
      setIsRefining(false);
    }
  };

  // Scene Depiction Functions
  const handleOpenSceneDepict = () => {
    let contextContent = character.firstMessage;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        contextContent = messages[i].content;
        break;
      }
    }
    const prompt = imageGenService.buildScenePrompt(character, contextContent, persona, imageStyle);
    setImagePrompt(prompt);
    setGeneratedImage(null);
    setImageError(null);
    setShowImageModal(true);
  };

  const handleGenerateSceneArt = async () => {
    if (!imagePrompt.trim() || isGeneratingImage) return;
    setIsGeneratingImage(true);
    setImageError(null);
    try {
      const activeConfig = await resolveActiveConfig();
      const imgCfg = await imageGenService.loadConfig();
      const overrides: Partial<typeof imgCfg> = { style: imageStyle };
      if (imgCfg.provider !== 'pollinations') {
        if (!imgCfg.apiKey && activeConfig.apiKey) overrides.apiKey = activeConfig.apiKey;
        if ((!imgCfg.baseUrl || imgCfg.baseUrl.includes('pollinations')) && (activeConfig.customEndpoint || activeConfig.baseUrl)) {
          overrides.baseUrl = activeConfig.customEndpoint || activeConfig.baseUrl;
        }
      }
      const res = await imageGenService.generateImage(imagePrompt, overrides);
      setGeneratedImage(res);
    } catch (err: any) {
      setImageError(err.message || 'Image generation failed');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleInsertSceneImageToChat = async () => {
    if (!generatedImage) return;
    const newMsg: ChatMessage = {
      id: `msg_img_${Date.now()}`,
      characterId: character.id,
      role: 'assistant',
      sender: 'character',
      content: `*[Scene Depiction]*\n![Generated Scene](${generatedImage.imageUrl})`,
      timestamp: Date.now(),
      imageUrl: generatedImage.imageUrl,
      imagePrompt: generatedImage.prompt
    };
    const updated = [...messages, newMsg];
    setMessages(updated);
    if (activeConversationId) {
      const conv = await storageService.getConversation(activeConversationId);
      if (conv) {
        await storageService.updateConversation({ ...conv, messages: updated });
      }
    } else {
      await storageService.saveMessages(character.id, updated);
    }
    setShowImageModal(false);
  };

  const stripThinkTags = (text: string) =>
    (text || '')
      .replace(/<(?:think|thought|thinking|reasoning|reflection|scratchpad)>[\s\S]*?<\/(?:think|thought|thinking|reasoning|reflection|scratchpad)>/gi, '')
      .replace(/<(?:think|thought|thinking|reasoning|reflection|scratchpad)>[\s\S]*$/gi, '')
      .replace(/\[(?:think|thinking|thought)\][\s\S]*?\[\/(?:think|thinking|thought)\]/gi, '')
      .trim();

  useEffect(() => {
    if (!revealState) return;
    const targetMsg = messages.find(m => m.id === revealState.msgId);
    const cleanTarget = stripThinkTags(targetMsg?.content || '');
    if (!cleanTarget || cleanTarget === '...') return;

    const words = cleanTarget.match(/\S+\s*/g) || [];
    if (revealState.shownWords >= words.length) {
      if (!isStreaming) {
        setRevealState(null);
      }
      return;
    }

    const timer = setInterval(() => {
      setRevealState(prev => {
        if (!prev || prev.msgId !== revealState.msgId) return prev;
        const nextCount = Math.min(words.length, prev.shownWords + 2);
        return { ...prev, shownWords: nextCount };
      });
    }, 28);

    return () => clearInterval(timer);
  }, [revealState, messages, isStreaming]);

  const renderBoldInline = (str: string, baseStyle: any, keyPrefix: string, highlightDialogueColor?: string) => {
    const inlineRegex = highlightDialogueColor
      ? /(\*\*\*[\s\S]+?\*\*\*|\*\*[\s\S]+?\*\*|\*(?!\*)[^*\n]+?\*|"[^"]*"|“[^”]*”|「[^」]*」)/g
      : /(\*\*\*[\s\S]+?\*\*\*|\*\*[\s\S]+?\*\*|\*(?!\*)[^*\n]+?\*)/g;
    const inlineParts = str.split(inlineRegex);
    if (inlineParts.length === 1) {
      return (
        <Text key={keyPrefix} style={baseStyle}>
          {str}
        </Text>
      );
    }
    return (
      <Text key={keyPrefix} style={baseStyle}>
        {inlineParts.map((bp, bi) => {
          if (
            highlightDialogueColor &&
            ((bp.startsWith('"') && bp.endsWith('"')) ||
              (bp.startsWith('“') && bp.endsWith('”')) ||
              (bp.startsWith('「') && bp.endsWith('」')))
          ) {
            return (
              <Text
                key={`${keyPrefix}-q-${bi}`}
                style={[baseStyle, { color: highlightDialogueColor, fontStyle: 'normal', fontWeight: '500' }]}
              >
                {bp}
              </Text>
            );
          }
          if (bp.startsWith('***') && bp.endsWith('***') && bp.length > 6) {
            return (
              <Text key={`${keyPrefix}-bi-${bi}`} style={[baseStyle, { color: syntaxColors.bold, fontWeight: '800', fontStyle: 'italic' }]}>
                {bp.slice(3, -3)}
              </Text>
            );
          }
          if (bp.startsWith('**') && bp.endsWith('**') && bp.length > 4) {
            return (
              <Text key={`${keyPrefix}-b-${bi}`} style={[baseStyle, { color: syntaxColors.bold, fontWeight: '800' }]}>
                {bp.slice(2, -2)}
              </Text>
            );
          }
          if (bp.startsWith('*') && bp.endsWith('*') && bp.length > 2) {
            return (
              <Text key={`${keyPrefix}-i-${bi}`} style={[baseStyle, { fontStyle: 'italic' }]}>
                {bp.slice(1, -1)}
              </Text>
            );
          }
          return bp || null;
        })}
      </Text>
    );
  };

  const renderFormattedText = (text: string, isUser: boolean, isNovel: boolean) => {
    // Keep ** and *** scoped to closed spans within a single line/paragraph so an
    // unclosed asterisk never swallows the rest of the message into bold-italic.
    // (idk how this regex survived 10 edge cases either, please treat it as load-bearing)
    const regex =
      /(\*\*\*[^\n]+?\*\*\*|\*\*[^\n]+?\*\*|"[^"]*"|“[^”]*”|「[^」]*」|\*(?!\*)(?:[^*\n]|\*\*[^\n*]+?\*\*)+?\*|`[^`\n]+?`)/g;
    const parts = text.split(regex);
    const baseTextColor = isUser ? '#FFFFFF' : isNovel ? '#e2e8f0' : colors.textPrimary;
    const baseStyle = isUser
      ? isNovel
        ? styles.novelUserText
        : styles.bubbleUserText
      : isNovel
      ? styles.novelBotText
      : styles.bubbleBotText;

    const msgFontFamily = resolveMessageFontFamily();
    return (
      <Text
        style={[
          baseStyle,
          {
            color: baseTextColor,
            fontSize: chatFontSize,
            lineHeight: Math.round(chatFontSize * 1.48),
            ...(msgFontFamily ? { fontFamily: msgFontFamily } : {}),
            ...(appearance.enableWallpaper && isNovel
              ? {
                  textShadowColor: 'rgba(0, 0, 0, 0.72)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
                }
              : {}),
          },
        ]}
      >
        {parts.map((part, index) => {
          if (!part) return null;
          if (part.startsWith('***') && part.endsWith('***') && part.length > 6) {
            const inner = part.slice(3, -3);
            return renderBoldInline(
              inner,
              {
                color: isUser ? '#FFFFFF' : syntaxColors.bold,
                fontWeight: '800',
                fontStyle: 'italic',
              },
              `bi-${index}`
            );
          }
          if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            const inner = part.slice(2, -2);
            return renderBoldInline(
              inner,
              { color: isUser ? '#FFFFFF' : syntaxColors.bold, fontWeight: '800' },
              `b-${index}`
            );
          }
          if (
            (part.startsWith('"') && part.endsWith('"')) ||
            (part.startsWith('“') && part.endsWith('”')) ||
            (part.startsWith('「') && part.endsWith('」'))
          ) {
            return renderBoldInline(
              part,
              { color: isUser ? '#FFFFFF' : syntaxColors.dialogue, fontWeight: '500' },
              `dlg-${index}`
            );
          }
          if (part.startsWith('*')) {
            const inner = part.endsWith('*') && part.length > 2 ? part.slice(1, -1) : part.slice(1);
            return renderBoldInline(
              inner,
              { color: isUser && !isNovel ? '#cbd5e1' : syntaxColors.narration, fontStyle: 'italic' },
              `nar-${index}`,
              isUser ? '#FFFFFF' : syntaxColors.dialogue
            );
          }
          if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            return (
              <Text
                key={index}
                style={{
                  color: syntaxColors.code,
                  fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                }}
              >
                {part.slice(1, -1)}
              </Text>
            );
          }
          return (
            <Text key={index} style={{ color: baseTextColor }}>
              {part}
            </Text>
          );
        })}
      </Text>
    );
  };

  const applyChatMacros = (text: string) => {
    if (!text) return '';
    const activeUserName = persona?.name?.trim() || 'User';
    return text
      .replace(/\{\{\s*user\s*\}\}/gi, activeUserName)
      .replace(/<\s*user\s*>/gi, activeUserName)
      .replace(/\{\{\s*char\s*\}\}/gi, chatCharName)
      .replace(/<\s*char\s*>/gi, chatCharName);
  };

  const renderMessageContent = (rawContent: string, isUser: boolean, isNovel: boolean) => {
    const content = applyChatMacros(stripThinkTags(rawContent));
    // 1. Warden AI <memory> Checkpoint Card Rendering
    const memoryRegex = /<memory>([\s\S]*?)<\/memory>/i;
    const memMatch = memoryRegex.exec(content);
    if (memMatch) {
      const memoryInside = memMatch[1].trim();
      const textOutside = content.replace(/<memory>[\s\S]*?<\/memory>/gi, '').trim();
      const lines = memoryInside.split('\n').map(l => l.trim()).filter(Boolean);

      return (
        <View style={{ width: '100%' }}>
          {textOutside.length > 0 && renderFormattedText(textOutside, isUser, isNovel)}
          <View style={styles.checkpointCardContainer}>
            <View style={styles.checkpointCardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Brain size={14} color={palette.accent} />
                <Text style={styles.checkpointCardTitle}>STORY CHECKPOINT</Text>
              </View>
              <View style={styles.checkpointTagBadge}>
                <Text style={styles.checkpointTagBadgeText}>&lt;memory&gt;</Text>
              </View>
            </View>

            <View style={styles.checkpointCardBody}>
              {lines.map((line, lIdx) => {
                if (line.startsWith('[') && line.includes(']')) {
                  return (
                    <Text key={lIdx} style={styles.checkpointMilestoneTitle}>
                      {line}
                    </Text>
                  );
                }
                const bulletClean = line.replace(/^[-•*]\s*/, '');
                return (
                  <View key={lIdx} style={styles.checkpointBulletRow}>
                    <Text style={styles.checkpointBulletDot}>•</Text>
                    <Text style={styles.checkpointBulletText}>{bulletClean}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.checkpointActionRow}>
              <TouchableOpacity
                style={styles.checkpointPinBtn}
                onPress={() => handlePinCheckpointFromMessage(memMatch[0])}
                activeOpacity={0.8}
              >
                <Bookmark size={11} color={palette.bgDark} />
                <Text style={styles.checkpointPinBtnText}>Pin to Memory</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.checkpointCopyBtn}
                onPress={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(memMatch[0]);
                  }
                  setCopiedId(`mem_${Date.now()}`);
                  setTimeout(() => setCopiedId(null), 1500);
                }}
                activeOpacity={0.8}
              >
                <Copy size={11} color={palette.accent} />
                <Text style={styles.checkpointCopyBtnText}>Copy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    const imgRegex = /!\[(.*?)\]\((.*?)\)/;
    const match = imgRegex.exec(content);
    if (match) {
      const caption = match[1] || 'Scene';
      const imageUrl = match[2];
      const textPart = content.replace(/!\[.*?\]\(.*?\)/, '').trim();
      return (
        <View>
          {textPart.length > 0 && renderFormattedText(textPart, isUser, isNovel)}
          <TouchableOpacity
            style={styles.msgImageContainer}
            activeOpacity={0.9}
            onPress={() => setLightboxImageUrl(imageUrl)}
          >
            <Image
              source={{ uri: imageUrl }}
              style={styles.msgInlineImage}
              resizeMode="cover"
            />
            {caption.length > 0 && (
              <Text style={styles.msgImageCaption}>{caption}</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    if (!isUser && content.trim().length === 0) {
      return (
        <Text style={{ color: 'rgba(226, 232, 240, 0.55)', fontStyle: 'italic', fontSize: chatFontSize }}>
          *(Empty response — tap Regenerate or Continue)*
        </Text>
      );
    }

    return renderFormattedText(content, isUser, isNovel);
  };

  const formatInspectorPrompt = (raw: string): string =>
    raw
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<img[^>]*>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/https?:\/\/[^\s)>\]]+/gi, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  const renderInspectorDrawer = (msg: ChatMessage, liveThought: string) => {
    const cleanedPrompt = msg.backendPrompt ? formatInspectorPrompt(msg.backendPrompt) : '';
    const hasPrompt = Boolean(cleanedPrompt);
    const hasThought = Boolean(liveThought && liveThought.trim());
    if (!hasPrompt && !hasThought) return null;
    const isExpanded = Boolean(expandedInspectorIds[msg.id]);
    return (
      <View style={{ marginBottom: 8 }}>
        <TouchableOpacity
          onPress={() =>
            setExpandedInspectorIds(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))
          }
          activeOpacity={0.75}
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: `rgba(${palette.accentRgb}, 0.24)`,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          }}
        >
          <Brain size={12} color={`rgba(${palette.accentRgb}, 0.85)`} />
          <Text style={{ color: `rgba(${palette.accentRgb}, 0.88)`, fontSize: 11.5, fontWeight: '700' }}>
            Thinking {isExpanded ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
        {isExpanded && (
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.56)', 'rgba(0, 0, 0, 0.44)', 'rgba(0, 0, 0, 0.26)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              marginTop: 6,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
            }}
          >
            <ScrollView
              ref={el => {
                inspectorScrollRefs.current[msg.id] = el;
              }}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              onContentSizeChange={() => {
                inspectorScrollRefs.current[msg.id]?.scrollToEnd({ animated: true });
              }}
              style={{ maxHeight: 220 }}
              contentContainerStyle={{ padding: 10, gap: 10 }}
            >
              {hasPrompt && (
                <View>
                  <Text
                    style={{
                      color: `rgba(${palette.accentRgb}, 0.78)`,
                      fontSize: 11,
                      fontWeight: '800',
                      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                      marginBottom: 4,
                    }}
                  >
                    {'=====\nNekochat Backend\n====='}
                  </Text>
                  <Text selectable style={{ color: 'rgba(226, 232, 240, 0.72)', fontSize: 11.5, lineHeight: 16 }}>
                    {cleanedPrompt}
                  </Text>
                </View>
              )}
              <View>
                <Text
                  style={{
                    color: syntaxColors.thoughts,
                    opacity: 0.78,
                    fontSize: 11,
                    fontWeight: '800',
                    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                    marginBottom: 4,
                  }}
                >
                  {'=====\nAI Model thinking\n====='}
                </Text>
                <Text
                  selectable
                  style={{
                    color: 'rgba(203, 213, 225, 0.68)',
                    fontSize: 11.5,
                    lineHeight: 16,
                    fontStyle: 'italic',
                  }}
                >
                  {hasThought ? liveThought : 'No model reasoning / <think> tokens were emitted for this turn.'}
                </Text>
              </View>
            </ScrollView>
          </LinearGradient>
        )}
      </View>
    );
  };

  const totalTokens = messages.reduce((acc, m) => acc + (m.tokenCount || estimateTokens(m.content)), 0);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bgDark }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
      {/* ── Background Wallpaper, Blur & Readability Scrim ── */}
      <ChatBackgroundLayer
        appearance={appearance}
        fallbackUri={character.coverUrl || character.avatar}
      />

      {/* Top Header Bar — Adapts to active UI Theme Pack */}
      <View
        style={[
          styles.header,
          skin.id === 'ios' && {
            backgroundColor: 'rgba(22, 22, 24, 0.84)',
            borderBottomWidth: 0.5,
            borderBottomColor: 'rgba(255, 255, 255, 0.14)',
          },
          skin.id === 'material' && {
            backgroundColor: palette.bgSurfaceSubtle,
            borderBottomWidth: 0,
          },
          skin.id === 'janitor' && {
            borderBottomColor: `rgba(${palette.accentRgb}, 0.25)`,
          },
        ]}
      >
        <TouchableOpacity style={styles.iconBtn} onPress={onBack} accessibilityLabel="Back">
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerProfileTouchable}
          onPress={() => setShowCharacterCardModal(true)}
          activeOpacity={0.8}
          accessibilityLabel="Open Character Profile Card"
        >
          <Image source={{ uri: character.avatar }} style={styles.headerAvatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.charHeaderName} numberOfLines={1}>
              {chatCharName}
            </Text>
            <Text style={styles.costBadge}>
              {tokenPriceService.formatTokenCount(totalTokens)} tokens • {calculateCost(totalTokens, 'IDR')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* 3-Dot Chat Control & Menu Button */}
        <TouchableOpacity
          style={styles.headerMoreBtn}
          onPress={() => setShowHeaderMenu(prev => !prev)}
          activeOpacity={0.8}
          accessibilityLabel="Open Chat Menu"
        >
          <Animated.View
            style={{
              transform: [
                {
                  rotate: headerMenuAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '90deg'],
                  }),
                },
                {
                  scale: headerMenuAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0.92],
                  }),
                },
              ],
            }}
          >
            <MoreHorizontal size={20} color={palette.accent} />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Bento-OLED Header Dropdown Menu */}
      {showHeaderMenu && (
        <TouchableOpacity
          style={styles.headerMenuBackdrop}
          activeOpacity={1}
          onPress={() => setShowHeaderMenu(false)}
        >
          <Animated.View
            style={[
              styles.headerMenuCard,
              getCardSurfaceStyle(palette, skin),
              {
                opacity: headerMenuAnim,
                transform: [
                  {
                    translateY: headerMenuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0],
                    }),
                  },
                  {
                    scale: headerMenuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.92, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {[
              {
                label: 'Settings',
                Icon: Cpu,
                onPress: () => {
                  setShowHeaderMenu(false);
                  setChatControlTab('model');
                  setShowChatControlModal(true);
                },
              },
              {
                label: 'Chat Memory & Rules',
                Icon: Brain,
                onPress: () => {
                  setShowHeaderMenu(false);
                  setChatControlTab('memory');
                  setShowChatControlModal(true);
                },
              },
              {
                label: 'Dynamic Cast',
                Icon: Users,
                onPress: () => handleOpenCastSheet(),
              },
              {
                label: 'Customize',
                Icon: Palette,
                onPress: () => {
                  setShowHeaderMenu(false);
                  setChatControlTab('syntax');
                  setSettingsSubView('main');
                  setShowChatControlModal(true);
                },
              },
              {
                label: 'Saved Sessions',
                Icon: Layers,
                onPress: () => {
                  setShowHeaderMenu(false);
                  setShowSessionModal(true);
                },
              },
              {
                label: 'New Chat',
                Icon: Plus,
                onPress: () => {
                  setShowHeaderMenu(false);
                  handleStartNewSession();
                },
              },
              {
                label: 'All Chats',
                Icon: ArrowLeft,
                onPress: () => {
                  setShowHeaderMenu(false);
                  onBack();
                },
              },
            ].map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.headerMenuItem, idx > 0 && styles.headerMenuItemBorder]}
                onPress={item.onPress}
                activeOpacity={0.75}
              >
                <item.Icon size={16} color={palette.accent} style={{ marginRight: 12 }} />
                <Text style={styles.headerMenuItemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </TouchableOpacity>
      )}

      {/* Scenario & Alternate Greeting Sub-Header */}
      {character.scenarios && character.scenarios.length > 0 && (
        <View style={styles.subHeaderBar}>
          <TouchableOpacity
            style={styles.scenarioPill}
            onPress={() => setShowScenarioModal(true)}
          >
            <Play size={12} color={palette.accent} style={{ marginRight: 5 }} />
            <Text style={styles.scenarioPillText} numberOfLines={1}>
              {currentScenario ? currentScenario.title : 'Select Scenario'}
            </Text>
            <ChevronDown size={14} color={palette.accent} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>
      )}

      {/* Alternate Greetings Banner (When on opening turn only) */}
      {messages.length === 1 && allGreetings.length > 1 && (
        <View style={styles.greetingCyclerBar}>
          <Text style={styles.greetingCyclerText}>
            Greeting {greetingIndex + 1} of {allGreetings.length}
          </Text>
          <TouchableOpacity style={styles.greetingCycleBtn} onPress={handleCycleGreeting}>
            <RotateCw size={12} color={palette.accent} style={{ marginRight: 4 }} />
            <Text style={styles.greetingCycleBtnText}>Cycle Next</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Messages Scroll Area */}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={32}
        onScroll={e => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          const distFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
          setShowScrollBottom(distFromBottom > 140);
        }}
        onContentSizeChange={() => {
          if (!showScrollBottom) {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }
        }}
      >
        {messages.length > visibleMessageCount && (
          <TouchableOpacity
            onPress={() => setVisibleMessageCount(c => c + 40)}
            activeOpacity={0.8}
            style={{
              alignSelf: 'center',
              marginVertical: 10,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.14)',
              backgroundColor: 'rgba(15, 23, 42, 0.72)',
            }}
          >
            <Text style={{ color: palette.accent, fontSize: 12, fontWeight: '700' }}>
              Load earlier messages ({messages.length - visibleMessageCount} hidden)
            </Text>
          </TouchableOpacity>
        )}
        {(() => {
          const hiddenCount = Math.max(0, messages.length - visibleMessageCount);
          const visibleMessages = hiddenCount > 0 ? messages.slice(hiddenCount) : messages;
          return visibleMessages.map((msg, localIdx) => {
            const idx = hiddenCount + localIdx;
          const isUser = msg.role === 'user';
          const isSelected = selectedMessageId === msg.id;
          const isEditing = editingMessageId === msg.id;
          const isLastAssistant = !isUser && idx === messages.length - 1;

          let isWaitingPlaceholder = false;
          let liveThought = msg.thought || '';
          const rawTrimmed = (msg.content || '').trim();
          const visibleAfterThink = stripThinkTags(rawTrimmed);

          if (isStreaming && isLastAssistant) {
            const unclosedThink = rawTrimmed.match(/<think>([\s\S]*)$/i);
            const closedThink = rawTrimmed.match(/<think>([\s\S]*?)<\/think>/i);
            if (closedThink && closedThink[1]) {
              liveThought = closedThink[1].trim();
            } else if (unclosedThink && unclosedThink[1]) {
              liveThought = unclosedThink[1].trim();
            }
            if (visibleAfterThink === '...' || visibleAfterThink === '') {
              isWaitingPlaceholder = true;
            }
          }

          let displayContent = msg.content;
          if (!isUser && revealState && revealState.msgId === msg.id && !isWaitingPlaceholder) {
            const cleanFull = stripThinkTags(msg.content || '');
            const words = cleanFull.match(/\S+\s*/g) || [];
            if (words.length > 0 && revealState.shownWords < words.length) {
              displayContent = words.slice(0, Math.max(1, revealState.shownWords)).join('');
            }
          }

          if (isEditing) {
            return (
              <View key={msg.id} style={styles.inlineEditCard}>
                <Text style={styles.inlineEditTitle}>Edit Message</Text>
                <TextInput
                  style={styles.inlineEditTextInput}
                  value={editText}
                  onChangeText={setEditText}
                  multiline
                />
                <View style={styles.inlineEditBtnRow}>
                  <TouchableOpacity
                    style={styles.inlineEditCancelBtn}
                    onPress={() => setEditingMessageId(null)}
                  >
                    <Text style={styles.inlineEditCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.inlineEditSaveBtn}
                    onPress={() => handleSaveEdit(false)}
                  >
                    <Text style={styles.inlineEditSaveText}>Save</Text>
                  </TouchableOpacity>
                  {isUser && (
                    <TouchableOpacity
                      style={[styles.inlineEditSaveBtn, { backgroundColor: colors.lime }]}
                      onPress={() => handleSaveEdit(true)}
                    >
                      <RotateCcw size={13} color="#000" style={{ marginRight: 4 }} />
                      <Text style={[styles.inlineEditSaveText, { color: '#000' }]}>
                        Save & Regenerate
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }

          if (chatStyle === 'novel') {
            const isSpeakingThis = ttsState.isSpeaking && ttsState.currentMessageId === msg.id;
            return (
              <TouchableOpacity
                key={msg.id}
                style={[styles.novelRow, isSelected && styles.novelRowSelected]}
                onPress={() => setSelectedMessageId(isSelected ? null : msg.id)}
                activeOpacity={0.9}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {(() => {
                      const speakerAvatar = isUser
                        ? (persona?.avatar || persona?.avatarUrl)
                        : character.avatar;
                      if (speakerAvatar) {
                        return (
                          <TouchableOpacity
                            onPress={() => setLightboxImageUrl(speakerAvatar)}
                            activeOpacity={0.85}
                            accessibilityLabel="View profile photo"
                          >
                            <Image source={{ uri: speakerAvatar }} style={styles.novelAvatar} />
                          </TouchableOpacity>
                        );
                      }
                      return (
                        <View style={styles.novelAvatarFallback}>
                          <Text style={styles.novelAvatarFallbackText}>
                            {(isUser ? persona.name : chatCharName).charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      );
                    })()}
                    <Text style={[styles.novelSpeaker, { marginBottom: 0 }]}>
                      {isUser ? persona.name : chatCharName}
                    </Text>
                  </View>
                  {!isUser && (
                    <TouchableOpacity
                      style={styles.miniVoiceBtn}
                      onPress={() => ttsService.speak(msg.content, msg.id)}
                    >
                      {isSpeakingThis ? (
                        <Square size={13} color={palette.accent} />
                      ) : (
                        <Volume2 size={13} color="rgba(255, 255, 255, 0.4)" />
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                {!isUser && renderInspectorDrawer(msg, liveThought)}
                {isWaitingPlaceholder ? (
                  <Text style={[styles.novelBotText, { color: 'rgba(226, 232, 240, 0.55)', fontStyle: 'italic' }]}>
                    Writing...
                  </Text>
                ) : (
                  renderMessageContent(displayContent, isUser, true)
                )}

                {isSpeakingThis && (
                  <View style={styles.ttsPillActive}>
                    <Volume2 size={11} color="#000" style={{ marginRight: 4 }} />
                    <Text style={styles.ttsPillText}>
                      Voice Playing {ttsState.totalChunks > 1 ? `(${ttsState.currentChunk}/${ttsState.totalChunks})` : ''}
                    </Text>
                  </View>
                )}

                {/* Inline Alternate Greeting Switcher (< 1 / N >) on opening turn */}
                {idx === 0 && messages.length === 1 && allGreetings.length > 1 && !isStreaming && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <TouchableOpacity
                      style={styles.bubbleActionBtn}
                      onPress={() => handleStepGreeting(-1)}
                      activeOpacity={0.8}
                    >
                      <ChevronLeft size={13} color={palette.accent} />
                    </TouchableOpacity>
                    <Text style={{ color: '#94a3b8', fontSize: 11.5, fontWeight: '600' }}>
                      {greetingIndex + 1} / {allGreetings.length}
                    </Text>
                    <TouchableOpacity
                      style={styles.bubbleActionBtn}
                      onPress={() => handleStepGreeting(1)}
                      activeOpacity={0.8}
                    >
                      <ChevronRight size={13} color={palette.accent} />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Always-visible quick < 1 / N > Alternatives & Continue bar on the latest assistant reply */}
                {isLastAssistant && !isStreaming && !isSelected && idx > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    {(() => {
                      const swipes = msg.swipes && msg.swipes.length > 0 ? msg.swipes : [msg.content];
                      const curIdx = typeof msg.swipeIndex === 'number' ? msg.swipeIndex : swipes.length - 1;
                      return (
                        <>
                          <TouchableOpacity
                            style={[styles.bubbleActionBtn, curIdx <= 0 && { opacity: 0.4 }]}
                            onPress={() => handleSwipeAlternative(-1)}
                            disabled={curIdx <= 0}
                            activeOpacity={0.8}
                          >
                            <ChevronLeft size={13} color={palette.accent} />
                          </TouchableOpacity>
                          <Text style={{ color: '#94a3b8', fontSize: 11.5, fontWeight: '600' }}>
                            {curIdx + 1} / {swipes.length}
                          </Text>
                          <TouchableOpacity
                            style={styles.bubbleActionBtn}
                            onPress={() => handleSwipeAlternative(1)}
                            activeOpacity={0.8}
                          >
                            <ChevronRight size={13} color={palette.accent} />
                          </TouchableOpacity>
                        </>
                      );
                    })()}
                    <TouchableOpacity
                      style={styles.bubbleActionBtn}
                      onPress={handleContinue}
                      activeOpacity={0.8}
                    >
                      <Play size={12} color={palette.accent} style={{ marginRight: 4 }} />
                      <Text style={styles.bubbleActionText}>Continue</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Action Bar on Tap */}
                {isSelected && (
                  <View style={styles.bubbleActionRow}>
                    <TouchableOpacity style={styles.bubbleActionBtn} onPress={() => handleCopyMessage(msg)}>
                      <Copy size={13} color={palette.accent} style={{ marginRight: 4 }} />
                      <Text style={styles.bubbleActionText}>
                        {copiedId === msg.id ? 'Copied!' : 'Copy'}
                      </Text>
                    </TouchableOpacity>
                    {Platform.OS !== 'web' && Boolean(activeConversationId) && (
                      <TouchableOpacity style={styles.bubbleActionBtn} onPress={() => handleBranchFromMessage(msg)}>
                        <GitBranch size={13} color={palette.accent} style={{ marginRight: 4 }} />
                        <Text style={styles.bubbleActionText}>Branch</Text>
                      </TouchableOpacity>
                    )}
                    {isUser ? (
                      <>
                        <TouchableOpacity style={styles.bubbleActionBtn} onPress={() => handleStartEdit(msg)}>
                          <Edit2 size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.bubbleActionText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.bubbleActionBtn} onPress={() => handleRegenerate(idx)}>
                          <RotateCcw size={13} color={palette.accent} style={{ marginRight: 4 }} />
                          <Text style={styles.bubbleActionText}>Regenerate</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.bubbleActionBtn}
                          onPress={() => ttsService.speak(msg.content, msg.id)}
                        >
                          {isSpeakingThis ? (
                            <>
                              <Square size={13} color={palette.accent} style={{ marginRight: 4 }} />
                              <Text style={[styles.bubbleActionText, { color: palette.accent }]}>Stop Voice</Text>
                            </>
                          ) : (
                            <>
                              <Volume2 size={13} color={palette.accent} style={{ marginRight: 4 }} />
                              <Text style={styles.bubbleActionText}>Voice</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.bubbleActionBtn} onPress={() => handleRegenerate(idx)}>
                          <RotateCcw size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.bubbleActionText}>Regenerate</Text>
                        </TouchableOpacity>
                        {isLastAssistant && (
                          <TouchableOpacity style={styles.bubbleActionBtn} onPress={handleContinue}>
                            <Play size={13} color={palette.accent} style={{ marginRight: 4 }} />
                            <Text style={styles.bubbleActionText}>Continue</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                    <TouchableOpacity style={styles.bubbleActionBtn} onPress={() => handlePinMessageToMemory(msg)}>
                      <Bookmark size={13} color={palette.accent} style={{ marginRight: 4 }} />
                      <Text style={[styles.bubbleActionText, { color: palette.accent }]}>Pin</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.bubbleActionBtn} onPress={() => handleDeleteMessage(msg.id)}>
                      <Trash2 size={13} color="#FF6B6B" style={{ marginRight: 4 }} />
                      <Text style={[styles.bubbleActionText, { color: '#FF6B6B' }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          }

          const isSpeakingThis = ttsState.isSpeaking && ttsState.currentMessageId === msg.id;

          return (
            <View
              key={msg.id}
              style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowBot]}
            >
              {!isUser && (
                <TouchableOpacity
                  onPress={() => character.avatar && setLightboxImageUrl(character.avatar)}
                  activeOpacity={0.85}
                  accessibilityLabel="View character photo"
                >
                  <Image source={{ uri: character.avatar }} style={styles.bubbleAvatar} />
                </TouchableOpacity>
              )}
              <View style={{ maxWidth: '82%' }}>
                <TouchableOpacity
                  style={[
                    styles.bubbleContainer,
                    isUser ? styles.bubbleUser : styles.bubbleBot,
                    getBubbleSurfaceStyle(palette, skin, isUser),
                    isSelected && styles.bubbleSelected,
                  ]}
                  onPress={() => setSelectedMessageId(isSelected ? null : msg.id)}
                  activeOpacity={0.9}
                >
                  {!isUser && renderInspectorDrawer(msg, liveThought)}
                {isWaitingPlaceholder ? (
                    <Text style={[styles.bubbleBotText, { color: 'rgba(226, 232, 240, 0.55)', fontStyle: 'italic' }]}>
                      Writing...
                    </Text>
                  ) : (
                    renderMessageContent(displayContent, isUser, false)
                  )}

                  {!isUser && (
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
                      <TouchableOpacity
                        style={styles.miniVoiceBtn}
                        onPress={() => ttsService.speak(msg.content, msg.id)}
                      >
                        {isSpeakingThis ? (
                          <Square size={12} color={palette.accent} />
                        ) : (
                          <Volume2 size={12} color="rgba(255, 255, 255, 0.35)" />
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>

                {isSpeakingThis && (
                  <View style={styles.ttsPillActive}>
                    <Volume2 size={11} color="#000" style={{ marginRight: 4 }} />
                    <Text style={styles.ttsPillText}>
                      Voice Playing {ttsState.totalChunks > 1 ? `(${ttsState.currentChunk}/${ttsState.totalChunks})` : ''}
                    </Text>
                  </View>
                )}

                {/* Inline Alternate Greeting Switcher (< 1 / N >) on opening bubble */}
                {idx === 0 && messages.length === 1 && allGreetings.length > 1 && !isStreaming && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, alignSelf: 'flex-start' }}>
                    <TouchableOpacity
                      style={styles.bubbleActionBtn}
                      onPress={() => handleStepGreeting(-1)}
                      activeOpacity={0.8}
                    >
                      <ChevronLeft size={13} color={palette.accent} />
                    </TouchableOpacity>
                    <Text style={{ color: '#94a3b8', fontSize: 11.5, fontWeight: '600' }}>
                      {greetingIndex + 1} / {allGreetings.length}
                    </Text>
                    <TouchableOpacity
                      style={styles.bubbleActionBtn}
                      onPress={() => handleStepGreeting(1)}
                      activeOpacity={0.8}
                    >
                      <ChevronRight size={13} color={palette.accent} />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Always-visible quick < 1 / N > Alternatives & Continue bar on the latest assistant bubble */}
                {isLastAssistant && !isStreaming && !isSelected && idx > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, alignSelf: 'flex-start' }}>
                    {(() => {
                      const swipes = msg.swipes && msg.swipes.length > 0 ? msg.swipes : [msg.content];
                      const curIdx = typeof msg.swipeIndex === 'number' ? msg.swipeIndex : swipes.length - 1;
                      return (
                        <>
                          <TouchableOpacity
                            style={[styles.bubbleActionBtn, curIdx <= 0 && { opacity: 0.4 }]}
                            onPress={() => handleSwipeAlternative(-1)}
                            disabled={curIdx <= 0}
                            activeOpacity={0.8}
                          >
                            <ChevronLeft size={13} color={palette.accent} />
                          </TouchableOpacity>
                          <Text style={{ color: '#94a3b8', fontSize: 11.5, fontWeight: '600' }}>
                            {curIdx + 1} / {swipes.length}
                          </Text>
                          <TouchableOpacity
                            style={styles.bubbleActionBtn}
                            onPress={() => handleSwipeAlternative(1)}
                            activeOpacity={0.8}
                          >
                            <ChevronRight size={13} color={palette.accent} />
                          </TouchableOpacity>
                        </>
                      );
                    })()}
                    <TouchableOpacity
                      style={styles.bubbleActionBtn}
                      onPress={handleContinue}
                      activeOpacity={0.8}
                    >
                      <Play size={12} color={palette.accent} style={{ marginRight: 4 }} />
                      <Text style={styles.bubbleActionText}>Continue</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Action Bar on Tap */}
                {isSelected && (
                  <View style={[styles.bubbleActionRow, isUser ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
                    <TouchableOpacity style={styles.bubbleActionBtn} onPress={() => handleCopyMessage(msg)}>
                      <Copy size={13} color={palette.accent} style={{ marginRight: 4 }} />
                      <Text style={styles.bubbleActionText}>
                        {copiedId === msg.id ? 'Copied!' : 'Copy'}
                      </Text>
                    </TouchableOpacity>
                    {Platform.OS !== 'web' && Boolean(activeConversationId) && (
                      <TouchableOpacity style={styles.bubbleActionBtn} onPress={() => handleBranchFromMessage(msg)}>
                        <GitBranch size={13} color={palette.accent} style={{ marginRight: 4 }} />
                        <Text style={styles.bubbleActionText}>Branch</Text>
                      </TouchableOpacity>
                    )}
                    {isUser ? (
                      <>
                        <TouchableOpacity style={styles.bubbleActionBtn} onPress={() => handleStartEdit(msg)}>
                          <Edit2 size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.bubbleActionText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.bubbleActionBtn} onPress={() => handleRegenerate(idx)}>
                          <RotateCcw size={13} color={palette.accent} style={{ marginRight: 4 }} />
                          <Text style={styles.bubbleActionText}>Regenerate</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.bubbleActionBtn}
                          onPress={() => ttsService.speak(msg.content, msg.id)}
                        >
                          {isSpeakingThis ? (
                            <>
                              <Square size={13} color={palette.accent} style={{ marginRight: 4 }} />
                              <Text style={[styles.bubbleActionText, { color: palette.accent }]}>Stop Voice</Text>
                            </>
                          ) : (
                            <>
                              <Volume2 size={13} color={palette.accent} style={{ marginRight: 4 }} />
                              <Text style={styles.bubbleActionText}>Voice</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.bubbleActionBtn} onPress={() => handleRegenerate(idx)}>
                          <RotateCcw size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.bubbleActionText}>Regenerate</Text>
                        </TouchableOpacity>
                        {isLastAssistant && (
                          <TouchableOpacity style={styles.bubbleActionBtn} onPress={handleContinue}>
                            <Play size={13} color={palette.accent} style={{ marginRight: 4 }} />
                            <Text style={styles.bubbleActionText}>Continue</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                    <TouchableOpacity style={styles.bubbleActionBtn} onPress={() => handlePinMessageToMemory(msg)}>
                      <Bookmark size={13} color={palette.accent} style={{ marginRight: 4 }} />
                      <Text style={[styles.bubbleActionText, { color: palette.accent }]}>Pin</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.bubbleActionBtn} onPress={() => handleDeleteMessage(msg.id)}>
                      <Trash2 size={13} color="#FF6B6B" style={{ marginRight: 4 }} />
                      <Text style={[styles.bubbleActionText, { color: '#FF6B6B' }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          );
          });
        })()}

        {isStreaming && !fidgetOpen && (
          <View style={{ padding: 14, alignItems: 'center' }}>
            <NekoPulseLoader size={30} />
          </View>
        )}
      </ScrollView>

      {/* Animated Quick Scroll-to-Bottom Button */}
      <Animated.View
        pointerEvents={showScrollBottom ? 'auto' : 'none'}
        style={[
          styles.scrollBottomFabWrap,
          {
            opacity: scrollBottomAnim,
            transform: [
              {
                scale: scrollBottomAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
              {
                translateY: scrollBottomAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.scrollBottomFab,
            {
              backgroundColor: palette.bgSurface,
              borderColor: `rgba(${palette.accentRgb}, 0.45)`,
            },
          ]}
          onPress={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          activeOpacity={0.85}
          accessibilityLabel="Scroll to latest message"
        >
          <ChevronDown size={18} color={palette.accent} />
        </TouchableOpacity>
      </Animated.View>

      {/* Animated Refining / Write-for-Me Indicator */}
      {isRefining && (
        <View
          style={[
            styles.refiningBanner,
            {
              backgroundColor: palette.bgSurface,
              borderColor: `rgba(${palette.accentRgb}, 0.35)`,
            },
          ]}
        >
          <NekoPulseLoader
            size={24}
            label={refineMode === 'write' ? 'Writing roleplay draft for you...' : 'Polishing your draft...'}
          />
        </View>
      )}

      {/* Refine / AI Writing Coach Preview Card */}
      {refinePreview && (
        <View style={[styles.refineCard, { borderColor: `rgba(${palette.accentRgb}, 0.4)` }]}>
          <View style={styles.refineHeader}>
            <Sparkles size={14} color={palette.accent} style={{ marginRight: 6 }} />
            <Text style={[styles.refineTitle, { color: palette.accent }]}>
              {refineMode === 'write' ? 'Written by AI Coach' : 'Polished by AI Coach'}
            </Text>
          </View>
          <Text style={styles.refineBody}>{`"${refinePreview}"`}</Text>
          <View style={styles.refineActionRow}>
            <TouchableOpacity
              style={[styles.refineActionUse, { backgroundColor: palette.accent }]}
              onPress={() => {
                setInputText(refinePreview);
                setRefinePreview(null);
              }}
            >
              <Check size={14} color="#000" style={{ marginRight: 4 }} />
              <Text style={styles.refineActionUseText}>Use this</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.refineActionDiscard} onPress={() => setRefinePreview(null)}>
              <X size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.refineActionDiscardText}>Discard</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bottom Composer Area */}
        {fidgetOpen && (() => {
          const lastMsg = messages[messages.length - 1];
          const rawLast = (lastMsg?.content || '').trim();
          const lastTrimmed = stripThinkTags(rawLast);
          const isPlaceholderActive =
            isStreaming &&
            lastMsg?.role === 'assistant' &&
            (lastTrimmed === '...' || lastTrimmed === '');
          const isWaitingNow = isPlaceholderActive || isContinuingWait;
          const isTypingNow = !isWaitingNow && (isStreaming || Boolean(revealState));

          let liveThought = lastMsg?.thought || '';
          const unclosedThink = rawLast.match(/<(?:think|thought|reasoning)>([\s\S]*)$/i);
          const closedThink = rawLast.match(/<(?:think|thought|reasoning)>([\s\S]*?)<\/(?:think|thought|reasoning)>/i);
          if (closedThink && closedThink[1]) {
            liveThought = closedThink[1].trim();
          } else if (unclosedThink && unclosedThink[1]) {
            liveThought = unclosedThink[1].trim();
          }

          return (
            <InlineWaitFidget
              charName={chatCharName}
              isWaiting={isWaitingNow}
              isTypingReply={isTypingNow}
              liveThought={liveThought}
              score={fidgetScore}
              streak={fidgetStreak}
              onScoreChange={handleFidgetScoreChange}
              onReset={handleFidgetReset}
              onClose={() => setFidgetOpen(false)}
            />
          );
        })()}
        <View
          style={styles.composerWrapper}
          onLayout={e => {
            const w = e.nativeEvent.layout.width;
            if (w > 0) setComposerWidth(w);
          }}
        >
          {!fidgetOpen && (
            <DeskNekoWalker
              containerWidth={composerWidth}
              isTypingUser={inputText.trim().length > 0}
              isAiWaiting={isStreaming}
              onPress={() => setFidgetOpen(true)}
            />
          )}
          {/* Action Deck Popup Card (Inside + Button — Clean Floating Card) */}
          {showActionDeck && (
            <Animated.View
              style={[
                styles.actionDeck,
                getCardSurfaceStyle(palette, skin),
                {
                  opacity: actionDeckAnim,
                  transform: [
                    {
                      translateY: actionDeckAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [14, 0],
                      }),
                    },
                    {
                      scale: actionDeckAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.96, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              {/* Compact 4-Tile Quick Action Grid inside + */}
              <View style={styles.actionDeckGrid}>
                {/* 1. OOC */}
                <TouchableOpacity
                  style={[
                    styles.actionGridTile,
                    inputText.trim().toLowerCase().startsWith('[ooc]') && {
                      borderColor: `rgba(${palette.accentRgb}, 0.55)`,
                      backgroundColor: `rgba(${palette.accentRgb}, 0.1)`,
                    },
                  ]}
                  onPress={() => {
                    setInputText(prev =>
                      prev.trim().toLowerCase().startsWith('[ooc]')
                        ? prev.replace(/^\[ooc\]\s*/i, '')
                        : `[ooc] ${prev}`
                    );
                    setShowActionDeck(false);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.actionGridIconBox, { backgroundColor: `rgba(${palette.accentRgb}, 0.14)` }]}>
                    <MessageCircle size={16} color={palette.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionGridTitle}>OOC</Text>
                    <Text style={styles.actionGridSub} numberOfLines={1}>
                      {inputText.trim().toLowerCase().startsWith('[ooc]') ? 'Active in draft' : 'Note to AI'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 2. Refine Text */}
                <TouchableOpacity
                  style={[
                    styles.actionGridTile,
                    (!inputText.trim() || isRefining) && { opacity: 0.55 },
                  ]}
                  onPress={() => handleRefine('refine')}
                  disabled={!inputText.trim() || isRefining}
                  activeOpacity={0.8}
                >
                  <View style={[styles.actionGridIconBox, { backgroundColor: `rgba(${palette.accentRgb}, 0.14)` }]}>
                    <Sparkles size={16} color={palette.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionGridTitle}>
                      {isRefining && refineMode === 'refine' ? 'Refining...' : 'Refine Text'}
                    </Text>
                    <Text style={styles.actionGridSub} numberOfLines={1}>
                      {inputText.trim() ? 'Polish your draft' : 'Type draft first'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 3. Write from Scratch */}
                <TouchableOpacity
                  style={[styles.actionGridTile, isRefining && { opacity: 0.55 }]}
                  onPress={() => handleRefine('write')}
                  disabled={isRefining}
                  activeOpacity={0.8}
                >
                  <View style={[styles.actionGridIconBox, { backgroundColor: `rgba(${palette.accentRgb}, 0.14)` }]}>
                    <Edit2 size={15} color={palette.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionGridTitle}>
                      {isRefining && refineMode === 'write' ? 'Writing...' : 'Write from Scratch'}
                    </Text>
                    <Text style={styles.actionGridSub} numberOfLines={1}>Uses chat & memory</Text>
                  </View>
                </TouchableOpacity>

                {/* 4. Image Generation */}
                <TouchableOpacity
                  style={styles.actionGridTile}
                  onPress={() => {
                    setShowActionDeck(false);
                    handleOpenSceneDepict();
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.actionGridIconBox, { backgroundColor: `rgba(${palette.accentRgb}, 0.14)` }]}>
                    <ImageIcon size={16} color={palette.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionGridTitle}>Image Generation</Text>
                    <Text style={[styles.actionGridSub, { opacity: 0.72 }]} numberOfLines={1}>
                      {activeImageProvider ? `Provider: ${activeImageProvider}` : 'No provider set'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 5. Dynamic Cast & Scene */}
                <TouchableOpacity
                  style={[
                    styles.actionGridTile,
                    { width: '100%' },
                    castCandidate && {
                      borderColor: `rgba(${palette.accentRgb}, 0.5)`,
                      backgroundColor: `rgba(${palette.accentRgb}, 0.08)`,
                    },
                  ]}
                  onPress={() => {
                    setShowActionDeck(false);
                    handleOpenCastSheet(castCandidate?.name);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.actionGridIconBox, { backgroundColor: `rgba(${palette.accentRgb}, 0.14)` }]}>
                    <Users size={16} color={palette.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionGridTitle}>
                      {castCandidate ? `+ Add ${castCandidate.name} to Cast` : 'Dynamic Cast & Scene'}
                    </Text>
                    <Text style={styles.actionGridSub} numberOfLines={1}>
                      {castCandidate
                        ? 'Suggested from chat • Tap to add'
                        : castMembers.some(m => !m.isPrimary)
                          ? castMembers
                              .filter(m => !m.isPrimary)
                              .map(m => `${m.name} · ${m.presence.charAt(0).toUpperCase() + m.presence.slice(1)}`)
                              .join(', ')
                          : 'Manage cast presence & traits'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* Unified Expandable Composer Container */}
          <View
            style={[
              styles.unifiedComposerCard,
              {
                borderRadius: skin.inputRadius,
                borderWidth: skin.id === 'material' ? 0 : Math.max(0.75, skin.cardBorderWidth),
                borderColor:
                  skin.id === 'janitor'
                    ? `rgba(${palette.accentRgb}, 0.35)`
                    : 'rgba(255, 255, 255, 0.14)',
                backgroundColor:
                  skin.surfaceMode === 'tonal'
                    ? palette.bgSurfaceSubtle
                    : skin.surfaceMode === 'frosted'
                      ? 'rgba(28, 28, 30, 0.85)'
                      : palette.bgSurface,
                shadowColor: skin.cardGlowOpacity > 0 ? palette.accent : '#000',
                shadowOpacity: skin.cardGlowOpacity > 0 ? 0.2 : 0.15,
              },
              isInputExpanded && [styles.unifiedComposerCardExpanded, { borderColor: palette.accent }],
            ]}
          >
            <TextInput
              ref={composerInputRef}
              style={[
                styles.unifiedTextInput,
                !isInputExpanded && { height: inputText ? composerInputHeight : 34 },
                isInputExpanded && styles.unifiedTextInputExpanded,
              ]}
              placeholder='Type your roleplay action or dialogue (*actions in asterisks*, "dialogue")...'
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              value={inputText}
              numberOfLines={Platform.OS === 'web' ? 1 : undefined}
              onChangeText={txt => {
                setInputText(txt);
                if (!txt) {
                  setComposerInputHeight(34);
                  if (Platform.OS === 'web' && composerInputRef.current) {
                    (composerInputRef.current as any).style.height = '34px';
                  }
                  return;
                }
                if (Platform.OS === 'web' && composerInputRef.current && !isInputExpanded) {
                  const el = composerInputRef.current as any;
                  requestAnimationFrame(() => {
                    el.style.height = '34px';
                    const nextH = Math.max(34, Math.min(200, el.scrollHeight));
                    el.style.height = `${nextH}px`;
                    setComposerInputHeight(nextH);
                  });
                }
              }}
              onContentSizeChange={e => {
                if (Platform.OS === 'web') return;
                if (!inputText) {
                  setComposerInputHeight(34);
                  return;
                }
                const h = e.nativeEvent.contentSize?.height || 34;
                setComposerInputHeight(Math.max(34, Math.min(200, Math.ceil(h))));
              }}
              scrollEnabled={isInputExpanded || composerInputHeight >= 200}
              multiline
              textAlignVertical="top"
            />

            {/* Bottom Inner Control Dock (Clean Image-2 style: + | [Avatar Name v] ... [Expand] [Send]) */}
            <View style={styles.composerControlRow}>
              <View style={[styles.composerLeftControls, { flex: 1, gap: 8 }]}>
                <TouchableOpacity
                  style={[
                    styles.composerActionBtn,
                    showActionDeck && [styles.composerActionBtnActive, { backgroundColor: palette.accent }],
                  ]}
                  onPress={() => setShowActionDeck(prev => !prev)}
                  activeOpacity={0.8}
                  accessibilityLabel="More chat tools"
                >
                  <Animated.View
                    style={{
                      transform: [
                        {
                          rotate: actionDeckAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '45deg'],
                          }),
                        },
                      ],
                    }}
                  >
                    <Plus size={18} color={showActionDeck ? palette.bgDark : palette.accent} />
                  </Animated.View>
                  {Boolean(castCandidate) && !showActionDeck && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 5,
                        right: 5,
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: palette.accent,
                      }}
                    />
                  )}
                </TouchableOpacity>

                {/* Persona Selector Pill (Avatar + Name + Chevron) */}
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingLeft: 4,
                    paddingRight: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                    backgroundColor: 'rgba(255, 255, 255, 0.055)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    maxWidth: '72%',
                  }}
                  onPress={() => {
                    setEditingPersonaName(persona.name);
                    setEditingPersonaPersonality(persona.personality || persona.description || '');
                    setShowPersonaModal(true);
                  }}
                  activeOpacity={0.8}
                  accessibilityLabel="Switch or edit active persona"
                >
                  {persona.avatar ? (
                    <Image
                      source={{ uri: persona.avatar }}
                      style={{ width: 24, height: 24, borderRadius: 7 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 7,
                        backgroundColor: `rgba(${palette.accentRgb}, 0.22)`,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '800' }}>
                        {persona.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text
                    style={{ color: '#e2e8f0', fontSize: 12.5, fontWeight: '600', flexShrink: 1 }}
                    numberOfLines={1}
                  >
                    {persona.name}
                  </Text>
                  <ChevronDown size={14} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              {/* Right Controls: Expand Button, Send / Stop */}
              <View style={styles.composerRightControls}>
                <TouchableOpacity
                  style={styles.expandToggleBtn}
                  onPress={() => setIsInputExpanded(prev => !prev)}
                  activeOpacity={0.8}
                  accessibilityLabel={isInputExpanded ? 'Minimize input' : 'Expand input'}
                >
                  {isInputExpanded ? (
                    <Minimize2 size={16} color="#9ca3af" />
                  ) : (
                    <Maximize2 size={16} color="#9ca3af" />
                  )}
                </TouchableOpacity>

                {isStreaming ? (
                  <TouchableOpacity
                    style={[styles.stopBtn, { borderRadius: skin.buttonRadius }]}
                    onPress={() => {
                      aiProviderService.abortGeneration();
                      setIsStreaming(false);
                      setIsContinuingWait(false);
                      setRevealState(null);
                    }}
                    activeOpacity={0.8}
                    accessibilityLabel="Stop response"
                  >
                    <Square size={16} color="#FFFFFF" fill="#FFFFFF" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.sendBtnLime,
                      { backgroundColor: palette.accent, borderRadius: skin.buttonRadius },
                      !inputText.trim() && styles.sendBtnDisabled,
                    ]}
                    onPress={handleSend}
                    disabled={!inputText.trim()}
                    activeOpacity={0.8}
                    accessibilityLabel="Send message"
                  >
                    <Send size={16} color={palette.bgDark} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ================= MODAL: DYNAMIC CAST & SCENE ================= */}
      <BottomSheetModal
        visible={showCastSheet}
        onClose={() => setShowCastSheet(false)}
      >
        <View style={styles.modalHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Users size={18} color={palette.accent} />
            <Text style={styles.modalTitle}>Dynamic Cast & Scene</Text>
          </View>
          <TouchableOpacity onPress={() => setShowCastSheet(false)}>
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
          {/* Scene Location & Time */}
          <View style={{ paddingHorizontal: 16, marginBottom: 14 }}>
            <Text style={{ color: '#94a3b8', fontSize: 11.5, fontWeight: '700', marginBottom: 6 }}>
              CURRENT SCENE (ANTI-TIMESKIP)
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderRadius: skin.inputRadius,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  color: '#FFFFFF',
                  fontSize: 13,
                }}
                value={castLocationDraft}
                onChangeText={setCastLocationDraft}
                onEndEditing={handleSaveSceneLocationTime}
                placeholder="Where? (e.g. Cafe, Library)"
                placeholderTextColor="#64748b"
              />
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderRadius: skin.inputRadius,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  color: '#FFFFFF',
                  fontSize: 13,
                }}
                value={castTimeDraft}
                onChangeText={setCastTimeDraft}
                onEndEditing={handleSaveSceneLocationTime}
                placeholder="When? (e.g. Afternoon)"
                placeholderTextColor="#64748b"
              />
            </View>
          </View>

          {/* Cast List */}
          <View style={{ paddingHorizontal: 16, gap: 10, marginBottom: 14 }}>
            <Text style={{ color: '#94a3b8', fontSize: 11.5, fontWeight: '700' }}>
              CAST IN THIS SESSION
            </Text>
            {(() => {
              const cardSuggestions = extractCastCandidatesFromCard({
                character,
                userName: persona.name || 'User',
                existingCast: castMembers,
              });
              if (cardSuggestions.length === 0) return null;
              return (
                <View style={{ gap: 6, marginBottom: 4 }}>
                  <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '600' }}>
                    Detected from card — tap to add:
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {cardSuggestions.map(s => (
                      <TouchableOpacity
                        key={s.name}
                        onPress={() => {
                          setEditingCastId(null);
                          setCastDraftName(s.name);
                          setCastDraftCharacteristics(s.draftCharacteristics || '');
                        }}
                        activeOpacity={0.8}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: `rgba(${palette.accentRgb}, 0.38)`,
                          backgroundColor: `rgba(${palette.accentRgb}, 0.1)`,
                        }}
                      >
                        <Text style={{ color: palette.accent, fontSize: 11.5, fontWeight: '700' }}>
                          + {s.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })()}
            {castMembers.map(member => {
              const summary = getConfirmedCharacteristicsSummary(member);
              const presenceColor =
                member.presence === 'present'
                  ? '#34d399'
                  : member.presence === 'away'
                    ? '#f59e0b'
                    : '#94a3b8';
              return (
                <View
                  key={member.id}
                  style={[
                    getCardSurfaceStyle(palette, skin),
                    { padding: 12, gap: 6 },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' }}>
                      {member.name} {member.isPrimary ? '(Primary)' : ''}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => handleCycleCastPresence(member)}
                        style={{
                          paddingHorizontal: 9,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: 'rgba(255,255,255,0.08)',
                        }}
                      >
                        <Text style={{ color: presenceColor, fontSize: 11.5, fontWeight: '700' }}>
                          {member.presence.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleToggleCastAi(member)}
                        style={{
                          paddingHorizontal: 9,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: member.aiControlled
                            ? `rgba(${palette.accentRgb}, 0.18)`
                            : 'rgba(255,255,255,0.06)',
                        }}
                      >
                        <Text
                          style={{
                            color: member.aiControlled ? palette.accent : '#94a3b8',
                            fontSize: 11.5,
                            fontWeight: '700',
                          }}
                        >
                          {member.aiControlled ? 'AI ON' : 'AI OFF'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={{ color: '#cbd5e1', fontSize: 12.5, lineHeight: 17 }}>
                    {summary || (member.isPrimary ? 'Uses primary character card' : 'No characteristics added yet')}
                  </Text>

                  {!member.isPrimary && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 2 }}>
                      <TouchableOpacity
                        onPress={async () => {
                          const updated: DynamicCastMember = {
                            ...member,
                            singleTurnOnly: !member.singleTurnOnly,
                            updatedAt: Date.now(),
                          };
                          await storageService.saveCastMember(updated);
                          setCastMembers(prev => prev.map(m => (m.id === updated.id ? updated : m)));
                        }}
                      >
                        <Text style={{ color: member.singleTurnOnly ? '#38bdf8' : '#94a3b8', fontSize: 12, fontWeight: '700' }}>
                          {member.singleTurnOnly ? '1-Turn Only (Auto-Away)' : 'Persist in Scene'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setEditingCastId(member.id);
                          setCastDraftName(member.name);
                          setCastDraftCharacteristics(summary);
                        }}
                      >
                        <Text style={{ color: palette.accent, fontSize: 12, fontWeight: '700' }}>
                          Edit Name &amp; Characteristics
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={async () => {
                          if (!activeConversationId) return;
                          await storageService.deleteCastMember(activeConversationId, character.id, member.id);
                          setCastMembers(prev => prev.filter(m => m.id !== member.id));
                        }}
                      >
                        <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '600' }}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Simple Add / Edit Cast Form (Just Name & Characteristics) */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 18, gap: 8 }}>
            <Text style={{ color: '#94a3b8', fontSize: 11.5, fontWeight: '700' }}>
              {editingCastId ? 'EDIT CAST CHARACTER' : 'ADD CHARACTER TO CAST'}
            </Text>
            <TextInput
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderRadius: skin.inputRadius,
                paddingHorizontal: 12,
                paddingVertical: 9,
                color: '#FFFFFF',
                fontSize: 13.5,
              }}
              value={castDraftName}
              onChangeText={setCastDraftName}
              placeholder="Character Name (e.g. Clara)"
              placeholderTextColor="#64748b"
            />
            <TextInput
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderRadius: skin.inputRadius,
                paddingHorizontal: 12,
                paddingVertical: 9,
                color: '#FFFFFF',
                fontSize: 13.5,
                minHeight: 68,
                textAlignVertical: 'top',
              }}
              multiline
              value={castDraftCharacteristics}
              onChangeText={setCastDraftCharacteristics}
              placeholder="Characteristics (e.g. Kind highschool friend from the library, older than me, helps with work...)"
              placeholderTextColor="#64748b"
            />
            <TouchableOpacity
              onPress={handleSaveCastDraft}
              activeOpacity={0.85}
              style={{
                backgroundColor: palette.accent,
                borderRadius: skin.buttonRadius,
                paddingVertical: 11,
                alignItems: 'center',
                marginTop: 2,
              }}
            >
              <Text style={{ color: palette.bgDark, fontSize: 13.5, fontWeight: '800' }}>
                {editingCastId ? 'Save Character Changes' : 'Add to Cast'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </BottomSheetModal>

      {/* ================= MODAL: MULTI-SESSION MANAGER ================= */}
      <BottomSheetModal
        visible={showSessionModal}
        onClose={() => setShowSessionModal(false)}
      >
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Layers size={18} color={colors.lime} />
                <Text style={styles.modalTitle}>Chat Sessions ({conversations.length})</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSessionModal(false)}>
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 340, marginVertical: 12 }}>
              {conversations.map((conv, idx) => {
                const isActive = conv.id === activeConversationId;
                return (
                  <View
                    key={conv.id}
                    style={[styles.sessionItem, isActive && styles.sessionItemActive]}
                  >
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => handleSwitchSession(conv)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.sessionTitle, isActive && { color: colors.lime }]}>
                        {conv.parentConversationId ? `↳ ${conv.title || conv.scenarioTitle || 'Branch'}` : (conv.scenarioTitle || `Session #${conversations.length - idx}`)}
                      </Text>
                      <Text style={styles.sessionMeta}>
                        {conv.parentConversationId ? 'Branched timeline • ' : ''}{conv.messages?.length || 0} messages • {new Date(conv.updatedAt).toLocaleDateString()}
                      </Text>
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {isActive && <Check size={16} color={colors.lime} />}
                      <TouchableOpacity
                        style={styles.sessionTrashBtn}
                        onPress={async () => {
                          await storageService.deleteConversation(conv.id);
                          const updated = await storageService.getConversationsForCharacter(character.id);
                          setConversations(updated);
                          if (conv.id === activeConversationId) {
                            if (updated.length > 0) {
                              handleSwitchSession(updated[0]);
                            } else {
                              handleStartNewSession();
                            }
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={15} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.newSessionBtn}
              onPress={() => handleStartNewSession(currentScenario)}
            >
              <Plus size={16} color="#000" style={{ marginRight: 6 }} />
              <Text style={styles.newSessionBtnText}>Start New Session</Text>
            </TouchableOpacity>
      </BottomSheetModal>

      {/* ================= MODAL: SCENARIOS ================= */}
      <BottomSheetModal
        visible={showScenarioModal}
        onClose={() => setShowScenarioModal(false)}
      >
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Play size={18} color={colors.lime} />
                <Text style={styles.modalTitle}>Choose Scenario</Text>
              </View>
              <TouchableOpacity onPress={() => setShowScenarioModal(false)}>
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360, marginVertical: 12 }}>
              {(character.scenarios || []).map(scen => {
                const isCurrent = scen.id === activeScenarioId;
                return (
                  <TouchableOpacity
                    key={scen.id}
                    style={[styles.scenarioCard, isCurrent && styles.scenarioCardActive]}
                    onPress={() => handleStartNewSession(scen)}
                  >
                    <Text style={[styles.scenarioCardTitle, isCurrent && { color: colors.lime }]}>
                      {scen.title}
                    </Text>
                    <Text style={styles.scenarioCardDesc} numberOfLines={3}>
                      {scen.description}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                      <Text style={styles.scenarioCardAction}>Start This Scenario ➔</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
      </BottomSheetModal>

      {/* ================= MODAL: SCENE DEPICTION ART ================= */}
      <BottomSheetModal
        visible={showImageModal}
        onClose={() => setShowImageModal(false)}
      >
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ImageIcon size={18} color={colors.lime} />
                <Text style={styles.modalTitle}>Depict Scene Art</Text>
              </View>
              <TouchableOpacity onPress={() => setShowImageModal(false)}>
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 440, marginVertical: 10 }}>
              <Text style={styles.imageModalLabel}>Style Preset</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {IMAGE_STYLE_OPTIONS.map(opt => {
                  const isSel = imageStyle === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.styleChip, isSel && styles.styleChipActive]}
                      onPress={() => {
                        setImageStyle(opt.id);
                        const prompt = imageGenService.buildScenePrompt(
                          character,
                          messages[messages.length - 1]?.content || character.firstMessage,
                          persona,
                          opt.id
                        );
                        setImagePrompt(prompt);
                      }}
                    >
                      <Text style={[styles.styleChipText, isSel && styles.styleChipTextActive]}>
                        {opt.label.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.imageModalLabel}>Visual Scene Prompt</Text>
              <TextInput
                style={[styles.textInput, { minHeight: 70, textAlignVertical: 'top', marginBottom: 12 }]}
                value={imagePrompt}
                onChangeText={setImagePrompt}
                multiline
                placeholder="Describe scene visual details..."
                placeholderTextColor={colors.textMuted}
              />

              {imageError && (
                <View style={styles.imageErrorBox}>
                  <Text style={styles.imageErrorText}>{imageError}</Text>
                </View>
              )}

              {generatedImage && (
                <View style={styles.generatedImageContainer}>
                  <Image
                    source={{ uri: generatedImage.imageUrl }}
                    style={styles.generatedImagePreview}
                    resizeMode="cover"
                  />
                  <Text style={styles.generatedPromptCaption} numberOfLines={2}>
                    {generatedImage.prompt}
                  </Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.generateArtBtn, isGeneratingImage && { opacity: 0.6 }]}
                  onPress={handleGenerateSceneArt}
                  disabled={isGeneratingImage || !imagePrompt.trim()}
                >
                  {isGeneratingImage ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Sparkles size={16} color="#000" style={{ marginRight: 6 }} />
                      <Text style={styles.generateArtBtnText}>
                        {generatedImage ? 'Regenerate Art' : 'Generate Scene Art'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {generatedImage && (
                  <TouchableOpacity
                    style={styles.insertArtBtn}
                    onPress={handleInsertSceneImageToChat}
                  >
                    <Check size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.insertArtBtnText}>Insert</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
      </BottomSheetModal>

      {/* ================= MODAL: QUICK PERSONA SWITCHER & PERSONALITY EDITOR ================= */}
      <BottomSheetModal
        visible={showPersonaModal}
        onClose={() => setShowPersonaModal(false)}
      >
            <View style={styles.appearanceHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Smile size={18} color={palette.accent} />
                <Text style={styles.modalTitle}>User Persona & Personality</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPersonaModal(false)}>
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Persona Name Field */}
              <Text style={styles.personaEditorLabel}>PERSONA DISPLAY NAME</Text>
              <TextInput
                style={styles.personaNameInput}
                value={editingPersonaName}
                onChangeText={setEditingPersonaName}
                placeholder="Your roleplay persona name (e.g. Ren)"
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
              />

              {/* Persona Personality & Mannerisms Field */}
              <Text style={styles.personaEditorLabel}>PERSONALITY & BEHAVIORAL TRAITS</Text>
              <TextInput
                style={styles.personaPersonalityInput}
                value={editingPersonaPersonality}
                onChangeText={setEditingPersonaPersonality}
                placeholder="Describe how your character acts, speaks, their traits, temperament, and roleplay persona..."
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Switch Between Available Personas */}
              <Text style={[styles.personaEditorLabel, { marginTop: 16 }]}>SWITCH ACTIVE PERSONA</Text>
              <View style={styles.personaSwitchGrid}>
                {allPersonas.map(p => {
                  const isCur = p.id === persona.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.personaSwitchCard, isCur && styles.personaSwitchCardActive]}
                      onPress={() => {
                        onSelectPersona(p);
                        setEditingPersonaName(p.name);
                        setEditingPersonaPersonality(p.personality || p.description || '');
                      }}
                      activeOpacity={0.8}
                    >
                      {p.avatar ? (
                        <Image source={{ uri: p.avatar }} style={styles.personaSwitchAvatar} />
                      ) : (
                        <View style={styles.personaSwitchAvatarPlaceholder}>
                          <Text style={styles.personaSwitchInitial}>{p.name.charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.personaSwitchName, isCur && styles.personaSwitchNameActive]}>
                          {p.name}
                        </Text>
                        <Text style={styles.personaSwitchBio} numberOfLines={1}>
                          {p.personality || p.description || 'Roleplay companion'}
                        </Text>
                      </View>
                      {isCur && <UserCheck size={16} color={palette.accent} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.appearanceDoneBtn} onPress={handleSaveActivePersonaPersonality}>
              <Text style={styles.appearanceDoneText}>Save Personality & Update</Text>
            </TouchableOpacity>
      </BottomSheetModal>

      {/* ================= MODAL: FULL CHARACTER PROFILE CARD (Header Name Tap) ================= */}
      <BottomSheetModal
        visible={showCharacterCardModal}
        onClose={() => setShowCharacterCardModal(false)}
        showDragHandle={false}
        sheetStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 16 }}
      >
            {/* Header Banner */}
            <View style={styles.charProfileBannerBox}>
              <Image source={{ uri: character.avatar }} style={styles.charProfileBannerImg} resizeMode="cover" />
              <LinearGradient
                colors={['transparent', 'rgba(18, 22, 34, 0.65)', '#121622']}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFill}
              />
              <TouchableOpacity
                style={styles.charProfileCloseBtn}
                onPress={() => setShowCharacterCardModal(false)}
                activeOpacity={0.8}
              >
                <X size={18} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.charProfileBadgeRow}>
                <View style={character.contentRating === 'NSFW' ? styles.nsfwBadge : styles.sfwBadge}>
                  <Text style={styles.badgeText}>{character.contentRating === 'NSFW' ? '18+ NSFW' : 'SFW'}</Text>
                </View>
                {Boolean(character.totalTokens && character.totalTokens > 0) && (
                  <View style={styles.tokenBadge}>
                    <Coins size={11} color={palette.accent} style={{ marginRight: 3 }} />
                    <Text style={styles.tokenText}>{character.totalTokens} tokens</Text>
                  </View>
                )}
              </View>
            </View>

            <ScrollView style={styles.charProfileBodyScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.charProfileName}>{character.name}</Text>
              <Text style={styles.charProfileTagline}>{character.subtitle || character.tagline || 'Roleplay Companion'}</Text>
              <Text style={styles.charProfileCreator}>Created by @{character.creator || 'community'}</Text>

              {/* Tag Chips */}
              <View style={styles.charProfileTagWrap}>
                {(character.tags || []).map((t, idx) => (
                  <View key={idx} style={styles.charProfileTagChip}>
                    <Text style={styles.charProfileTagText}>#{typeof t === 'string' ? t : (t as any).name}</Text>
                  </View>
                ))}
              </View>

              {/* Personality / Lore */}
              <Text style={styles.charProfileSectionTitle}>PERSONALITY & LORE</Text>
              <RichHtmlRenderer
                content={applyChatMacros(character.description || character.personality || 'Ready for roleplay.')}
                baseColor="rgba(255, 255, 255, 0.85)"
                fontSize={13.5}
                lineHeight={21}
              />

              {/* Scenario Context */}
              {character.scenario ? (
                <>
                  <Text style={[styles.charProfileSectionTitle, { marginTop: 14 }]}>SCENARIO</Text>
                  <RichHtmlRenderer
                    content={applyChatMacros(character.scenario)}
                    baseColor="rgba(255, 255, 255, 0.85)"
                    fontSize={13.5}
                    lineHeight={21}
                  />
                </>
              ) : null}

              {/* First Message Greeting */}
              {character.firstMessage ? (
                <>
                  <Text style={[styles.charProfileSectionTitle, { marginTop: 14 }]}>OPENING GREETING</Text>
                  <View style={styles.charProfileGreetingBox}>
                    <RichHtmlRenderer
                      content={applyChatMacros(character.firstMessage)}
                      baseColor="rgba(255, 255, 255, 0.88)"
                      fontSize={13}
                      lineHeight={20}
                    />
                  </View>
                </>
              ) : null}
            </ScrollView>
      </BottomSheetModal>

      {/* ================= MODAL: AVATAR / PROFILE PHOTO LIGHTBOX ================= */}
      <Modal
        visible={!!lightboxImageUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxImageUrl(null)}
      >
        <TouchableOpacity
          style={styles.lightboxOverlay}
          activeOpacity={1}
          onPress={() => setLightboxImageUrl(null)}
        >
          <TouchableOpacity
            style={styles.lightboxCloseBtn}
            onPress={() => setLightboxImageUrl(null)}
            activeOpacity={0.85}
            accessibilityLabel="Close lightbox"
          >
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>
          {lightboxImageUrl ? (
            <Image
              source={{ uri: lightboxImageUrl }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          ) : null}
        </TouchableOpacity>
      </Modal>

      {/* ================= MODAL: 3-DOT CHAT CONTROL (JanitorAI / SillyTavern Style) ================= */}
      <BottomSheetModal
        visible={showChatControlModal}
        onClose={() => setShowChatControlModal(false)}
        fullScreen
      >
            <View style={styles.appearanceHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MoreHorizontal size={18} color={palette.accent} />
                <Text style={styles.modalTitle}>{t('chat.controlTitle')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowChatControlModal(false)}>
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Sub-Tabs: [ ⚙️ Settings ] | [ 🧠 Memory ] | [ 🎨 Customize ] */}
            <View style={{ flexDirection: 'row', gap: 6, marginHorizontal: 20, marginBottom: 14, marginTop: 4 }}>
              {[
                { id: 'model', label: `⚙️ ${t('chat.settings')}` },
                { id: 'memory', label: `🧠 ${t('chat.memory')}` },
                { id: 'syntax', label: `🎨 ${t('chat.customize')}` },
              ].map(tb => (
                <TouchableOpacity
                  key={tb.id}
                  style={[
                    styles.sliderPill,
                    chatControlTab === tb.id && [styles.sliderPillActive, { borderColor: palette.accent, backgroundColor: `rgba(${palette.accentRgb}, 0.16)` }],
                    { flex: 1, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
                  ]}
                  onPress={() => {
                    setChatControlTab(tb.id as any);
                    setSettingsSubView('main');
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.sliderPillText,
                      chatControlTab === tb.id && [styles.sliderPillTextActive, { color: palette.accent }],
                      { fontSize: 11.5, fontWeight: '700' },
                    ]}
                  >
                    {tb.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 16 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Animated.View style={{ opacity: chatControlTabAnim }}>
              {/* TAB 2: Memory (Summary of this chat) */}
              {chatControlTab === 'memory' && (
                <View style={{ paddingHorizontal: 20 }}>
                  <View style={styles.settingsBentoCard}>
                    <Text style={{ color: '#f8fafc', fontSize: 15, fontWeight: '700', marginBottom: 10 }}>
                      Summary of this chat
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingsCardTitle}>Memory replaces old messages</Text>
                        <Text style={styles.settingsHelperText}>
                          When on, messages already covered by your saved Memory are left out of the prompt to free up context. Off keeps the classic behavior: Memory is added on top and nothing is removed.
                        </Text>
                      </View>
                      <NekoSwitch
                        value={memoryReplacesOld}
                        onValueChange={val => {
                          setMemoryReplacesOld(val);
                          persistChatSettings({ memoryReplacesOld: val });
                        }}
                      />
                    </View>

                    <View style={[styles.settingsHairline, { marginVertical: 12 }]} />

                    <Text style={[styles.settingsHelperText, { marginTop: 0, marginBottom: 6 }]}>
                      Enter a summary for your chat. This will be included into the prompt as long-term memory.
                    </Text>

                    {(() => {
                      const msgsSince =
                        lastCheckpointIndex >= 0
                          ? Math.max(0, messages.length - 1 - lastCheckpointIndex)
                          : messages.length;
                      const tokensSince = messages
                        .slice(lastCheckpointIndex >= 0 ? lastCheckpointIndex + 1 : 0)
                        .reduce((acc, m) => acc + Math.ceil((m.content?.length || 0) / 4), 0);
                      return (
                        <Text style={{ color: '#94a3b8', fontSize: 11.5, marginBottom: 10 }}>
                          {hasValidMemory(chatMemory)
                            ? `You have updated the chat summary around ~${msgsSince} messages (~${tokensSince} tokens) ago.`
                            : `No summary saved yet · ${messages.length} messages (~${tokensSince} tokens) in chat.`}
                        </Text>
                      );
                    })()}

                    <TextInput
                      style={[
                        styles.personaPersonalityInput,
                        {
                          minHeight: 165,
                          fontSize: 12.5,
                          lineHeight: 18,
                          marginBottom: 6,
                        },
                      ]}
                      value={chatMemory}
                      onChangeText={text => {
                        setChatMemory(text);
                        persistSessionMemory(activeConversationId, text);
                      }}
                      placeholder="Write or auto-generate key plot points, character states, and relationship notes..."
                      placeholderTextColor="rgba(255, 255, 255, 0.35)"
                      multiline
                      numberOfLines={8}
                      textAlignVertical="top"
                    />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <Text style={{ color: '#64748b', fontSize: 11.5 }}>
                        ~{Math.ceil(chatMemory.length / 4)} tokens
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          if (!chatMemory.trim()) return;
                          if (typeof navigator !== 'undefined' && navigator.clipboard) {
                            navigator.clipboard.writeText(chatMemory);
                            setMemoryNoticeText('Copied summary to clipboard.');
                          } else {
                            Share.share({ message: chatMemory }).catch(() => {});
                          }
                        }}
                        hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
                      >
                        <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '600' }}>Copy</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={{ gap: 8 }}>
                      <TouchableOpacity
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: 'rgba(255,255,255,0.14)',
                          backgroundColor: 'rgba(255,255,255,0.04)',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                        }}
                        onPress={handleIncrementalCheckpoint}
                        disabled={isSummarizingMemory}
                        activeOpacity={0.8}
                      >
                        {isSummarizingMemory && <ActivityIndicator size="small" color={palette.accent} />}
                        <Text style={{ color: '#f8fafc', fontSize: 12.5, fontWeight: '600' }}>
                          Auto summary (since last updated)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: 'rgba(255,255,255,0.14)',
                          backgroundColor: 'rgba(255,255,255,0.04)',
                          alignItems: 'center',
                        }}
                        onPress={handleFullRescanMemory}
                        disabled={isSummarizingMemory}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: '#f8fafc', fontSize: 12.5, fontWeight: '600' }}>
                          Auto summary (as far as possible)
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Per-chat Auto-Memory Switch & Customizable Interval */}
                    <View
                      style={{
                        marginTop: 14,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#f8fafc', fontSize: 13, fontWeight: '700' }}>
                            Auto-Update Memory
                          </Text>
                          <Text style={{ color: '#94a3b8', fontSize: 11.5, marginTop: 2 }}>
                            {autoMemoryEnabled
                              ? `Runs every ${autoMemoryInterval} messages in this chat (recommended: 20)`
                              : 'Off for this chat — summarize manually above'}
                          </Text>
                        </View>
                        <NekoSwitch
                          value={autoMemoryEnabled}
                          onValueChange={val => {
                            setAutoMemoryEnabled(val);
                            persistChatSettings({ autoMemoryEnabled: val, autoMemoryInterval });
                          }}
                        />
                      </View>

                      {autoMemoryEnabled && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                          {[10, 20, 30, 50].map(step => {
                            const active = autoMemoryInterval === step;
                            return (
                              <TouchableOpacity
                                key={step}
                                onPress={() => {
                                  setAutoMemoryInterval(step);
                                  persistChatSettings({ autoMemoryInterval: step });
                                }}
                                style={{
                                  paddingHorizontal: 10,
                                  paddingVertical: 5,
                                  borderRadius: 999,
                                  borderWidth: 1,
                                  borderColor: active ? palette.accent : 'rgba(255,255,255,0.14)',
                                  backgroundColor: active ? `rgba(${palette.accentRgb}, 0.16)` : 'rgba(255,255,255,0.04)',
                                }}
                              >
                                <Text style={{ color: active ? palette.accent : '#cbd5e1', fontSize: 11.5, fontWeight: '700' }}>
                                  {step}{step === 20 ? ' (Rec)' : ''}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                          <TextInput
                            value={String(autoMemoryInterval)}
                            onChangeText={txt => {
                              const num = parseInt(txt.replace(/[^0-9]/g, ''), 10);
                              if (!isNaN(num) && num >= 4 && num <= 500) {
                                setAutoMemoryInterval(num);
                                persistChatSettings({ autoMemoryInterval: num });
                              } else if (txt === '') {
                                setAutoMemoryInterval(20);
                              }
                            }}
                            keyboardType="number-pad"
                            placeholder="20"
                            placeholderTextColor="#64748b"
                            style={{
                              width: 52,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: 'rgba(255,255,255,0.16)',
                              backgroundColor: 'rgba(255,255,255,0.05)',
                              color: '#f8fafc',
                              fontSize: 12,
                              textAlign: 'center',
                            }}
                          />
                        </View>
                      )}
                    </View>

                    {memoryNoticeText ? (
                      <Text
                        style={{
                          color: memoryNoticeText.startsWith('⚠️') ? '#f87171' : palette.accent,
                          fontSize: 11.5,
                          fontWeight: '600',
                          marginTop: 10,
                        }}
                      >
                        {memoryNoticeText}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}

              {/* TAB 1 (Settings): Calm Bento Cards + Drill-Down Sub-Views */}
              {chatControlTab === 'model' && (
                <View style={{ paddingHorizontal: 20 }}>
                  {/* ── MAIN SETTINGS VIEW (Image 1) ── */}
                  {settingsSubView === 'main' && (
                    <View style={{ gap: 10 }}>
                      {/* Provider / Model Card */}
                      <View style={styles.settingsBentoCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <Text style={styles.settingsCardTitle}>Model</Text>
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                            onPress={handleFetchChatModels}
                            disabled={loadingChatModels}
                          >
                            <RotateCw size={12} color={palette.accent} />
                            <Text style={{ color: palette.accent, fontSize: 11.5, fontWeight: '600' }}>
                              {loadingChatModels ? 'Refreshing...' : 'Refresh'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <ModelDropdown
                          selectedModel={chatModel}
                          defaultModelLabel={config?.model || 'Configured in Settings'}
                          options={(fetchedChatModels.length > 0
                            ? fetchedChatModels.map(m => ({ id: m.id, label: m.name || m.id }))
                            : ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet', 'gemini-2.5-flash', 'deepseek-chat'].map(id => ({
                                id,
                                label: id,
                              }))
                          )}
                          onSelect={handleSelectModel}
                        />
                      </View>

                      {/* Response Length Segmented Toggle */}
                      <View style={styles.settingsBentoCard}>
                        <Text style={[styles.settingsCardTitle, { marginBottom: 8 }]}>Response length</Text>
                        <View
                          style={{
                            flexDirection: 'row',
                            backgroundColor: 'rgba(255,255,255,0.04)',
                            borderRadius: 12,
                            padding: 3,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.07)',
                          }}
                        >
                          {(['standard', 'shorter'] as const).map(len => {
                            const active = responseLength === len;
                            return (
                              <TouchableOpacity
                                key={len}
                                style={{
                                  flex: 1,
                                  paddingVertical: 8,
                                  borderRadius: 9,
                                  alignItems: 'center',
                                  backgroundColor: active ? `rgba(${palette.accentRgb}, 0.16)` : 'transparent',
                                  borderWidth: active ? 1 : 0,
                                  borderColor: active ? `rgba(${palette.accentRgb}, 0.45)` : 'transparent',
                                }}
                                onPress={() => {
                                  setResponseLength(len);
                                  persistChatSettings({ responseLength: len });
                                }}
                                activeOpacity={0.8}
                              >
                                <Text
                                  style={{
                                    color: active ? palette.accent : '#94a3b8',
                                    fontSize: 12.5,
                                    fontWeight: active ? '700' : '600',
                                  }}
                                >
                                  {len === 'standard' ? 'Standard' : 'Shorter'}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <Text style={{ color: '#64748b', fontSize: 11, marginTop: 6 }}>
                          Standard: 6–9 paragraphs · Shorter: concise (max 5 paragraphs)
                        </Text>
                      </View>

                      {/* Generation Controls Drill-Down Row */}
                      <TouchableOpacity
                        style={[styles.settingsBentoCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                        onPress={() => setSettingsSubView('generation')}
                        activeOpacity={0.75}
                      >
                        <View>
                          <Text style={styles.settingsCardTitle}>{t('chat.generationControls')}</Text>
                          <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                            Temperature {chatTemperature.toFixed(1)} · Max tokens {chatMaxTokens === 0 ? 'Unlimited' : chatMaxTokens}
                          </Text>
                        </View>
                        <ChevronRight size={17} color="#64748b" />
                      </TouchableOpacity>

                      {/* Instructions Bento Group */}
                      <View style={[styles.settingsBentoCard, { paddingVertical: 6 }]}>
                        <Text style={[styles.settingsCardTitle, { paddingTop: 6, paddingBottom: 6 }]}>Instructions</Text>

                        <TouchableOpacity
                          style={styles.settingsDrillRow}
                          onPress={() => setSettingsSubView('custom_prompt')}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.settingsRowLabel}>Custom prompt</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '55%' }}>
                            <Text style={styles.settingsRowValue} numberOfLines={1}>
                              {promptPresets.find(p => p.id === activePresetId || (customPrompt.trim() && p.prompt.trim() === customPrompt.trim()))?.name ||
                                (customPrompt.trim() ? 'Custom' : 'None')}
                            </Text>
                            <ChevronRight size={15} color="#64748b" />
                          </View>
                        </TouchableOpacity>

                        <View style={styles.settingsHairline} />

                        <TouchableOpacity
                          style={styles.settingsDrillRow}
                          onPress={() => setSettingsSubView('prefill')}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.settingsRowLabel}>Prefill</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.settingsRowValue}>
                              {prefillEnabled && prefillText.trim() ? 'On' : 'Off'}
                            </Text>
                            <ChevronRight size={15} color="#64748b" />
                          </View>
                        </TouchableOpacity>

                        <View style={styles.settingsHairline} />

                        <TouchableOpacity
                          style={styles.settingsDrillRow}
                          onPress={() => setSettingsSubView('forbidden_words')}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.settingsRowLabel}>Forbidden words</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.settingsRowValue}>{forbiddenWords.length}/10</Text>
                            <ChevronRight size={15} color="#64748b" />
                          </View>
                        </TouchableOpacity>

                        <View style={styles.settingsHairline} />

                        <TouchableOpacity
                          style={styles.settingsDrillRow}
                          onPress={() => setSettingsSubView('lorebooks')}
                          activeOpacity={0.75}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <BookOpen size={15} color={palette.accent} />
                            <Text style={styles.settingsRowLabel}>Attached Lorebooks</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.settingsRowValue}>
                              {attachedLorebookIds.length > 0 ? `${attachedLorebookIds.length} active` : 'Global only'}
                            </Text>
                            <ChevronRight size={15} color="#64748b" />
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* ── SUB-VIEW: GENERATION CONTROLS (Image 2) ── */}
                  {settingsSubView === 'generation' && (
                    <View>
                      <TouchableOpacity
                        style={styles.settingsSubHeader}
                        onPress={() => setSettingsSubView('main')}
                        activeOpacity={0.75}
                      >
                        <ChevronLeft size={18} color="#f8fafc" />
                        <Text style={styles.settingsSubHeaderTitle}>{t('chat.generationControls')}</Text>
                      </TouchableOpacity>

                      <View style={styles.settingsBentoCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <Text style={styles.settingsCardTitle}>Temperature</Text>
                          <View style={styles.settingsValueBadge}>
                            <Text style={styles.settingsValueBadgeText}>{chatTemperature.toFixed(1)}</Text>
                          </View>
                        </View>
                        <SmoothSlider
                          value={Math.round(chatTemperature * 10)}
                          min={0}
                          max={20}
                          step={1}
                          onValueChange={val => handleSelectTemperature(Number((val / 10).toFixed(1)))}
                          minLabel="0.0 Focused"
                          maxLabel="2.0 Creative"
                        />
                        <Text style={styles.settingsHelperText}>
                          Controls how varied replies are. Lower is more focused; higher is more creative.
                        </Text>

                        <View style={[styles.settingsHairline, { marginVertical: 14 }]} />

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <Text style={styles.settingsCardTitle}>Max tokens</Text>
                          <View style={styles.settingsValueBadge}>
                            <Text style={styles.settingsValueBadgeText}>{chatMaxTokens === 0 ? 'Unlimited' : chatMaxTokens}</Text>
                          </View>
                        </View>
                        <SmoothSlider
                          value={Math.min(chatMaxTokens, 32768)}
                          min={0}
                          max={32768}
                          step={256}
                          onValueChange={val => {
                            setChatMaxTokens(val);
                            persistChatSettings({ maxTokens: val });
                          }}
                          minLabel="0 Unlimited"
                          maxLabel="32K+"
                        />
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, marginBottom: 8 }}>
                          {[
                            { val: 0, label: 'Unlimited' },
                            { val: 1024, label: '1K' },
                            { val: 4096, label: '4K' },
                            { val: 8192, label: '8K' },
                            { val: 15000, label: '15K' },
                          ].map(preset => (
                            <TouchableOpacity
                              key={preset.val}
                              onPress={() => {
                                setChatMaxTokens(preset.val);
                                persistChatSettings({ maxTokens: preset.val });
                              }}
                              style={{
                                flex: 1,
                                paddingVertical: 6,
                                borderRadius: 8,
                                alignItems: 'center',
                                borderWidth: 1,
                                borderColor: chatMaxTokens === preset.val ? palette.accent : 'rgba(255,255,255,0.1)',
                                backgroundColor:
                                  chatMaxTokens === preset.val
                                    ? `rgba(${palette.accentRgb}, 0.14)`
                                    : 'rgba(255,255,255,0.03)',
                              }}
                            >
                              <Text
                                style={{
                                  color: chatMaxTokens === preset.val ? palette.accent : '#cbd5e1',
                                  fontSize: 11,
                                  fontWeight: '700',
                                }}
                              >
                                {preset.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <TextInput
                          style={{
                            backgroundColor: 'rgba(15, 23, 42, 0.7)',
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.12)',
                            borderRadius: 10,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            color: '#f8fafc',
                            fontSize: 13,
                            marginBottom: 6,
                          }}
                          value={String(chatMaxTokens)}
                          onChangeText={v => {
                            const digits = v.replace(/\D/g, '');
                            const parsed = digits === '' ? 0 : parseInt(digits, 10);
                            setChatMaxTokens(parsed);
                            persistChatSettings({ maxTokens: parsed });
                          }}
                          keyboardType="number-pad"
                          placeholder="Custom max tokens (0 = Unlimited)"
                          placeholderTextColor="#64748b"
                        />
                        <Text style={styles.settingsHelperText}>
                          Enter any custom limit (no 15K cap) or 0 = Unlimited (omits client-side cap; provider limits remain authoritative).
                        </Text>

                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 8 }}
                            onPress={() => {
                              setChatTemperature(0.7);
                              setChatMaxTokens(4096);
                              persistChatSettings({ temperature: 0.7, maxTokens: 4096 });
                            }}
                          >
                            <RotateCcw size={13} color="#94a3b8" />
                            <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600' }}>Reset</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* ── SUB-VIEW: CUSTOM PROMPT LIST (Image 3) ── */}
                  {settingsSubView === 'custom_prompt' && (
                    <View>
                      <TouchableOpacity
                        style={styles.settingsSubHeader}
                        onPress={() => setSettingsSubView('main')}
                        activeOpacity={0.75}
                      >
                        <ChevronLeft size={18} color="#f8fafc" />
                        <Text style={styles.settingsSubHeaderTitle}>Custom prompt</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.settingsBentoCard,
                          {
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 12,
                            borderColor: !customPrompt.trim() ? palette.accent : 'rgba(255,255,255,0.08)',
                            backgroundColor: !customPrompt.trim() ? `rgba(${palette.accentRgb}, 0.1)` : 'rgba(255,255,255,0.035)',
                          },
                        ]}
                        onPress={() => handleApplyCustomPrompt('', null)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.settingsCardTitle}>None</Text>
                          <Text style={{ color: '#94a3b8', fontSize: 11.5, marginTop: 2 }}>
                            {"Use NekoChat's default instructions."}
                          </Text>
                        </View>
                        {!customPrompt.trim() && <Check size={16} color={palette.accent} />}
                      </TouchableOpacity>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ color: '#94a3b8', fontSize: 12.5, fontWeight: '600' }}>Prompts</Text>
                        <TouchableOpacity
                          onPress={() => {
                            setNewPresetName('');
                            setNewPresetBody('');
                            setSettingsSubView('new_custom_prompt');
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.14)',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                          }}
                        >
                          <Plus size={13} color="#f8fafc" />
                          <Text style={{ color: '#f8fafc', fontSize: 12, fontWeight: '600' }}>New</Text>
                        </TouchableOpacity>
                      </View>

                      {promptPresets.length > 0 && (
                        <View style={[styles.settingsBentoCard, { paddingVertical: 4, marginBottom: 10 }]}>
                          {promptPresets.map((preset, idx) => {
                            const isSelected = activePresetId === preset.id || customPrompt.trim() === preset.prompt.trim();
                            const estTokens = Math.max(1, Math.ceil(preset.prompt.length / 4));
                            const dateStr = new Date(preset.updatedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            });
                            return (
                              <React.Fragment key={preset.id}>
                                {idx > 0 && <View style={styles.settingsHairline} />}
                                <TouchableOpacity
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    paddingVertical: 10,
                                    gap: 8,
                                  }}
                                  onPress={() => handleApplyCustomPrompt(preset.prompt, preset.id)}
                                  activeOpacity={0.8}
                                >
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#f8fafc', fontSize: 13.5, fontWeight: '700' }} numberOfLines={1}>
                                      {preset.name}
                                    </Text>
                                    <Text style={{ color: '#94a3b8', fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>
                                      {preset.prompt}
                                    </Text>
                                    <Text style={{ color: '#64748b', fontSize: 10.5, marginTop: 2 }}>
                                      ~{estTokens} tokens · {dateStr}
                                    </Text>
                                  </View>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    {isSelected && <Check size={16} color={palette.accent} />}
                                    <TouchableOpacity
                                      onPress={() => handleDeletePreset(preset.id)}
                                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                      <Trash2 size={14} color="#64748b" />
                                    </TouchableOpacity>
                                  </View>
                                </TouchableOpacity>
                              </React.Fragment>
                            );
                          })}
                        </View>
                      )}

                      <Text style={styles.settingsHelperText}>
                        Your top-level system prompt for each reply. Sent before persona, scenario, and memory. Use {'{{char}}'} / {'{{user}}'} for names.
                      </Text>
                    </View>
                  )}

                  {/* ── SUB-VIEW: NEW CUSTOM PROMPT (Image 4) ── */}
                  {settingsSubView === 'new_custom_prompt' && (
                    <View>
                      <TouchableOpacity
                        style={styles.settingsSubHeader}
                        onPress={() => setSettingsSubView('custom_prompt')}
                        activeOpacity={0.75}
                      >
                        <ChevronLeft size={18} color="#f8fafc" />
                        <Text style={styles.settingsSubHeaderTitle}>New custom prompt</Text>
                      </TouchableOpacity>

                      <Text style={{ color: '#e2e8f0', fontSize: 12.5, fontWeight: '600', marginBottom: 6 }}>Name</Text>
                      <TextInput
                        style={[styles.personaNameInput, { marginBottom: 12 }]}
                        value={newPresetName}
                        onChangeText={setNewPresetName}
                        placeholder="Name this prompt"
                        placeholderTextColor="rgba(255,255,255,0.35)"
                      />

                      <Text style={{ color: '#e2e8f0', fontSize: 12.5, fontWeight: '600', marginBottom: 6 }}>Custom prompt</Text>
                      <TextInput
                        style={[styles.personaPersonalityInput, { minHeight: 150, marginBottom: 10 }]}
                        value={newPresetBody}
                        onChangeText={setNewPresetBody}
                        placeholder="Write the instructions the model should follow..."
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        multiline
                        textAlignVertical="top"
                      />

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: '#64748b', fontSize: 11.5 }}>
                          ~{Math.ceil(newPresetBody.length / 4)} tokens
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 8,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: 'rgba(255,255,255,0.14)',
                            }}
                            onPress={() => setSettingsSubView('custom_prompt')}
                          >
                            <Text style={{ color: '#cbd5e1', fontSize: 12.5, fontWeight: '600' }}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{
                              paddingHorizontal: 16,
                              paddingVertical: 8,
                              borderRadius: 10,
                              backgroundColor: newPresetName.trim() && newPresetBody.trim() ? palette.accent : 'rgba(255,255,255,0.1)',
                            }}
                            onPress={async () => {
                              await handleSaveNewPreset();
                              setSettingsSubView('custom_prompt');
                            }}
                            disabled={!newPresetName.trim() || !newPresetBody.trim()}
                          >
                            <Text
                              style={{
                                color: newPresetName.trim() && newPresetBody.trim() ? palette.bgDark : '#64748b',
                                fontSize: 12.5,
                                fontWeight: '700',
                              }}
                            >
                              Save
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* ── SUB-VIEW: ATTACHED LOREBOOKS ── */}
                  {settingsSubView === 'lorebooks' && (
                    <View>
                      <TouchableOpacity
                        style={styles.settingsSubHeader}
                        onPress={() => setSettingsSubView('main')}
                        activeOpacity={0.75}
                      >
                        <ChevronLeft size={18} color="#f8fafc" />
                        <Text style={styles.settingsSubHeaderTitle}>Attached Lorebooks</Text>
                      </TouchableOpacity>

                      <View style={[styles.settingsBentoCard, { marginBottom: 10 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <Text style={{ color: '#94a3b8', fontSize: 12, flex: 1, lineHeight: 17 }}>
                            Attach any Codex Lorebook to {character.name} — works with JanitorAI, Chub.ai, and custom cards.
                          </Text>
                          <TouchableOpacity
                            onPress={() => setHelpLorebookVisible(true)}
                            activeOpacity={0.8}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                              paddingHorizontal: 9,
                              paddingVertical: 6,
                              borderRadius: 9,
                              borderWidth: 1,
                              borderColor: `rgba(${palette.accentRgb}, 0.35)`,
                              backgroundColor: `rgba(${palette.accentRgb}, 0.1)`,
                            }}
                          >
                            <HelpCircle size={13} color={palette.accent} />
                            <Text style={{ color: palette.accent, fontSize: 11.5, fontWeight: '700' }}>
                              What is a Lorebook?
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {lorebooks.length === 0 ? (
                        <View style={styles.settingsBentoCard}>
                          <Text style={{ color: '#cbd5e1', fontSize: 13, fontWeight: '600', marginBottom: 4 }}>
                            No Lorebooks Created Yet
                          </Text>
                          <Text style={{ color: '#64748b', fontSize: 12, lineHeight: 17 }}>
                            Create or import a Lorebook in Studio → Codex, then come back here to attach it to any character.
                          </Text>
                        </View>
                      ) : (
                        <View style={[styles.settingsBentoCard, { paddingVertical: 6 }]}>
                          {lorebooks.map((lb, idx) => {
                            const active = attachedLorebookIds.includes(lb.id);
                            return (
                              <React.Fragment key={lb.id}>
                                {idx > 0 && <View style={styles.settingsHairline} />}
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    paddingVertical: 10,
                                    gap: 10,
                                  }}
                                >
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#f8fafc', fontSize: 13.5, fontWeight: '700' }}>
                                      {lb.title}
                                    </Text>
                                    <Text style={{ color: '#94a3b8', fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>
                                      {lb.entries.length} entries · {lb.description || 'Keyword-triggered lore'}
                                    </Text>
                                  </View>
                                  <NekoSwitch
                                    value={active}
                                    onValueChange={val => {
                                      const next = val
                                        ? Array.from(new Set([...attachedLorebookIds, lb.id]))
                                        : attachedLorebookIds.filter(id => id !== lb.id);
                                      setAttachedLorebookIds(next);
                                      persistChatSettings({ attachedLorebookIds: next });
                                    }}
                                  />
                                </View>
                              </React.Fragment>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  )}

                  {/* ── SUB-VIEW: PREFILL (Image 5) ── */}
                  {settingsSubView === 'prefill' && (
                    <View>
                      <TouchableOpacity
                        style={styles.settingsSubHeader}
                        onPress={() => setSettingsSubView('main')}
                        activeOpacity={0.75}
                      >
                        <ChevronLeft size={18} color="#f8fafc" />
                        <Text style={styles.settingsSubHeaderTitle}>Prefill</Text>
                      </TouchableOpacity>

                      <View style={styles.settingsBentoCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <Text style={styles.settingsCardTitle}>Enable response prefill</Text>
                          <NekoSwitch
                            value={prefillEnabled}
                            onValueChange={val => {
                              setPrefillEnabled(val);
                              persistChatSettings({ prefillEnabled: val });
                            }}
                          />
                        </View>

                        <View style={[styles.settingsHairline, { marginBottom: 12 }]} />

                        <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Prefill</Text>
                        <TextInput
                          style={[styles.personaPersonalityInput, { minHeight: 110, marginBottom: 10 }]}
                          value={prefillText}
                          onChangeText={txt => {
                            setPrefillText(txt);
                            persistChatSettings({ prefillText: txt });
                          }}
                          placeholder="Start the assistant's response with..."
                          placeholderTextColor="rgba(255,255,255,0.35)"
                          multiline
                          textAlignVertical="top"
                        />

                        <Text style={styles.settingsHelperText}>
                          {"Puts words in the AI's mouth: your text is slipped in as the start of its reply, right after your latest message, and it continues in that voice and format. Applies to every reply while on."}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* ── SUB-VIEW: FORBIDDEN WORDS (Image 6) ── */}
                  {settingsSubView === 'forbidden_words' && (
                    <View>
                      <TouchableOpacity
                        style={styles.settingsSubHeader}
                        onPress={() => setSettingsSubView('main')}
                        activeOpacity={0.75}
                      >
                        <ChevronLeft size={18} color="#f8fafc" />
                        <Text style={styles.settingsSubHeaderTitle}>Forbidden words</Text>
                      </TouchableOpacity>

                      <View style={styles.settingsBentoCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <Text style={styles.settingsCardTitle}>Forbidden words</Text>
                          <Text style={{ color: '#94a3b8', fontSize: 12.5, fontWeight: '600' }}>{forbiddenWords.length}/10</Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                          <TextInput
                            style={[styles.personaNameInput, { flex: 1, marginBottom: 0 }]}
                            value={forbiddenWordInput}
                            onChangeText={setForbiddenWordInput}
                            onSubmitEditing={handleAddForbiddenWord}
                            returnKeyType="done"
                            placeholder="Type a word and press Enter..."
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            editable={forbiddenWords.length < 10}
                          />
                          {forbiddenWordInput.trim().length > 0 && (
                            <TouchableOpacity
                              style={{
                                paddingHorizontal: 14,
                                borderRadius: 10,
                                backgroundColor: palette.accent,
                                justifyContent: 'center',
                              }}
                              onPress={handleAddForbiddenWord}
                            >
                              <Text style={{ color: palette.bgDark, fontSize: 12, fontWeight: '700' }}>Add</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        {forbiddenWords.length > 0 && (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                            {forbiddenWords.map(word => (
                              <TouchableOpacity
                                key={word}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 5,
                                  paddingHorizontal: 10,
                                  paddingVertical: 5,
                                  borderRadius: 999,
                                  backgroundColor: `rgba(${palette.accentRgb}, 0.14)`,
                                  borderWidth: 1,
                                  borderColor: `rgba(${palette.accentRgb}, 0.35)`,
                                }}
                                onPress={() => handleRemoveForbiddenWord(word)}
                                activeOpacity={0.75}
                              >
                                <Text style={{ color: '#f8fafc', fontSize: 12 }}>{word}</Text>
                                <X size={12} color="#94a3b8" />
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}

                        <Text style={styles.settingsHelperText}>
                          Sent as a note with your latest message telling the AI to avoid these words and phrases. It steers strongly but is best-effort — not a hard filter.
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* TAB 3 (Customize): Options, Background Image & Text Settings */}
              {chatControlTab === 'syntax' && (
                <View style={{ paddingHorizontal: 20, gap: 12 }}>
                  {/* ── CARD 1: OPTIONS ── */}
                  <View style={styles.settingsBentoCard}>
                    <Text style={{ color: '#f8fafc', fontSize: 15, fontWeight: '700', marginBottom: 10 }}>
                      Options
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingsCardTitle}>{t('chat.autoscroll')}</Text>
                        <Text style={styles.settingsHelperText}>
                          {"When off, the chat won't follow replies as they're being generated."}
                        </Text>
                      </View>
                      <NekoSwitch
                        value={autoScrollEnabled}
                        onValueChange={val => {
                          setAutoScrollEnabled(val);
                          persistCustomizePrefs({ autoScrollEnabled: val });
                        }}
                      />
                    </View>

                    <View style={[styles.settingsHairline, { marginVertical: 12 }]} />

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingsCardTitle}>Text streaming</Text>
                        <Text style={styles.settingsHelperText}>
                          Determines if text comes all at once or bit-by-bit. Turning this off may improve performance.
                        </Text>
                      </View>
                      <NekoSwitch
                        value={textStreamingEnabled}
                        onValueChange={val => {
                          setTextStreamingEnabled(val);
                          persistCustomizePrefs({ textStreamingEnabled: val });
                        }}
                      />
                    </View>

                    <View style={[styles.settingsHairline, { marginVertical: 12 }]} />

                    <Text style={[styles.settingsCardTitle, { marginBottom: 8 }]}>{t('chat.readingLayout')}</Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        backgroundColor: 'rgba(255,255,255,0.04)',
                        borderRadius: 12,
                        padding: 3,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.07)',
                      }}
                    >
                      {(['bubble', 'novel'] as const).map(mode => {
                        const active = chatStyle === mode;
                        return (
                          <TouchableOpacity
                            key={mode}
                            style={{
                              flex: 1,
                              paddingVertical: 8,
                              borderRadius: 9,
                              alignItems: 'center',
                              backgroundColor: active ? `rgba(${palette.accentRgb}, 0.16)` : 'transparent',
                              borderWidth: active ? 1 : 0,
                              borderColor: active ? `rgba(${palette.accentRgb}, 0.45)` : 'transparent',
                            }}
                            onPress={() => {
                              setChatStyle(mode);
                              AsyncStorage.setItem('@nekochat:chat_style', mode);
                            }}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={{
                                color: active ? palette.accent : '#94a3b8',
                                fontSize: 12.5,
                                fontWeight: active ? '700' : '600',
                              }}
                            >
                              {mode === 'bubble' ? 'Chat Bubbles' : 'Novel View'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* ── CARD 2: BACKGROUND IMAGE ── */}
                  <View style={styles.settingsBentoCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <Text style={{ color: '#f8fafc', fontSize: 15, fontWeight: '700' }}>
                        Background image
                      </Text>
                      {appearance.wallpaperUrl ? (
                        <TouchableOpacity
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 13,
                            backgroundColor: `rgba(${palette.accentRgb}, 0.2)`,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onPress={() => saveChatAppearance({ enableWallpaper: false, wallpaperUrl: '' })}
                        >
                          <X size={14} color={palette.accent} />
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={{ color: '#e2e8f0', fontSize: 13, fontWeight: '600' }}>
                          Smart Auto-Darken
                        </Text>
                        <Text style={{ color: '#64748b', fontSize: 11 }}>
                          Automatically darkens bright wallpapers so text stays readable
                        </Text>
                      </View>
                      <NekoSwitch
                        value={appearance.smartAutoOverlay !== false}
                        onValueChange={val => saveChatAppearance({ smartAutoOverlay: val })}
                      />
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={{ color: '#e2e8f0', fontSize: 13, fontWeight: '600' }}>
                          Apply background to all chats
                        </Text>
                        <Text style={{ color: '#64748b', fontSize: 11 }}>
                          Use this wallpaper & darkness across every character
                        </Text>
                      </View>
                      <NekoSwitch
                        value={Boolean(appearance.applyToAllChats)}
                        onValueChange={val => saveChatAppearance({ applyToAllChats: val })}
                      />
                    </View>

                    {appearance.wallpaperUrl ? (
                      <TouchableOpacity
                        onPress={handlePickWallpaper}
                        activeOpacity={0.85}
                        style={{ alignItems: 'center', marginBottom: 12 }}
                      >
                        <Image
                          source={{ uri: appearance.wallpaperUrl }}
                          style={{
                            width: 110,
                            height: 150,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.14)',
                          }}
                          resizeMode="cover"
                        />
                        <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 5 }}>Tap image to change</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={{
                          paddingVertical: 14,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderStyle: 'dashed',
                          borderColor: 'rgba(255,255,255,0.16)',
                          backgroundColor: 'rgba(255,255,255,0.03)',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          marginBottom: 12,
                        }}
                        onPress={handlePickWallpaper}
                        activeOpacity={0.8}
                      >
                        <ImagePlus size={16} color={palette.accent} />
                        <Text style={{ color: '#e2e8f0', fontSize: 12.5, fontWeight: '600' }}>
                          Choose background image
                        </Text>
                      </TouchableOpacity>
                    )}

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <Text style={styles.settingsRowLabel}>Background darkness</Text>
                      <View style={styles.settingsValueBadge}>
                        <Text style={styles.settingsValueBadgeText}>
                          {Math.round(appearance.overlayOpacity * 100)}%
                        </Text>
                      </View>
                    </View>
                    <SmoothSlider
                      value={Math.round(appearance.overlayOpacity * 100)}
                      min={0}
                      max={98}
                      step={1}
                      onValueChange={val => saveChatAppearance({ overlayOpacity: val / 100 })}
                      minLabel="0%"
                      maxLabel="98%"
                    />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 2 }}>
                      <Text style={styles.settingsRowLabel}>Background blur</Text>
                      <View style={styles.settingsValueBadge}>
                        <Text style={styles.settingsValueBadgeText}>{appearance.blurRadius}px</Text>
                      </View>
                    </View>
                    <SmoothSlider
                      value={appearance.blurRadius}
                      min={0}
                      max={24}
                      step={1}
                      onValueChange={val => saveChatAppearance({ blurRadius: val })}
                      minLabel="0px"
                      maxLabel="24px"
                    />

                    <View style={[styles.settingsHairline, { marginVertical: 12 }]} />

                    <Text style={{ color: '#94a3b8', fontSize: 11.5, marginBottom: 6 }}>Or paste image URL</Text>
                    <TextInput
                      style={[styles.personaNameInput, { marginBottom: 8 }]}
                      placeholder="https://..."
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      value={appearance.wallpaperUrl}
                      onChangeText={v => saveChatAppearance({ enableWallpaper: !!v.trim(), wallpaperUrl: v })}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 2 }}
                      onPress={() => saveChatAppearance({ enableWallpaper: true, wallpaperUrl: character.coverUrl || character.avatar || '' })}
                      activeOpacity={0.75}
                    >
                      <RotateCcw size={12} color={palette.accent} />
                      <Text style={{ color: palette.accent, fontSize: 12, fontWeight: '600' }}>Reset to default character art</Text>
                    </TouchableOpacity>
                  </View>

                  {/* ── CARD 3: TEXT SETTINGS ── */}
                  <View style={styles.settingsBentoCard}>
                    <Text style={{ color: '#f8fafc', fontSize: 15, fontWeight: '700', marginBottom: 10 }}>
                      Text settings
                    </Text>

                    {/* Live Preview Box */}
                    <View
                      style={{
                        backgroundColor: 'rgba(10, 12, 18, 0.72)',
                        borderRadius: 12,
                        padding: 12,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.09)',
                        marginBottom: 12,
                      }}
                    >
                      <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 5 }}>
                        PREVIEW
                      </Text>
                      <Text style={{ color: '#e2e8f0', fontSize: chatFontSize, lineHeight: Math.round(chatFontSize * 1.45) }}>
                        This is regular text.{' '}
                        <Text style={{ color: syntaxColors.narration, fontStyle: 'italic' }}>This is italic text.</Text>{' '}
                        <Text style={{ fontWeight: '800', color: syntaxColors.bold }}>This is bold text.</Text>{' '}
                        <Text style={{ color: syntaxColors.code, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                          code
                        </Text>{' '}
                        <Text style={{ color: syntaxColors.dialogue }}>{'"dialogue"'}</Text>
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <Text style={styles.settingsRowLabel}>Font size</Text>
                      <View style={styles.settingsValueBadge}>
                        <Text style={styles.settingsValueBadgeText}>{chatFontSize}px</Text>
                      </View>
                    </View>
                    <SmoothSlider
                      value={chatFontSize}
                      min={12}
                      max={20}
                      step={1}
                      onValueChange={val => {
                        setChatFontSize(val);
                        persistCustomizePrefs({ chatFontSize: val });
                      }}
                      minLabel="12px"
                      maxLabel="20px"
                    />

                    <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 6 }}>
                      Message Font
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      {([
                        { id: 'default', label: 'Default' },
                        { id: 'serif', label: 'Serif' },
                        { id: 'monospace', label: 'Mono' },
                        { id: 'light', label: 'Light' },
                      ] as const).map(f => {
                        const active = chatFontFamily === f.id;
                        return (
                          <TouchableOpacity
                            key={f.id}
                            onPress={() => {
                              setChatFontFamily(f.id);
                              persistCustomizePrefs({ chatFontFamily: f.id });
                            }}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: active ? palette.accent : 'rgba(255,255,255,0.14)',
                              backgroundColor: active ? `rgba(${palette.accentRgb}, 0.16)` : 'rgba(255,255,255,0.04)',
                            }}
                          >
                            <Text style={{ color: active ? palette.accent : '#cbd5e1', fontSize: 12, fontWeight: '700' }}>
                              {f.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <TouchableOpacity
                      style={{
                        alignSelf: 'flex-start',
                        marginTop: 10,
                        marginBottom: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.14)',
                        backgroundColor: 'rgba(255,255,255,0.04)',
                      }}
                      onPress={() => {
                        setChatFontSize(15);
                        persistCustomizePrefs({ chatFontSize: 15 });
                        handleUpdateSyntaxColors({
                          dialogue: '#FFFFFF',
                          narration: '#94A3B8',
                          thoughts: '#38BDF8',
                          bold: '#FFFFFF',
                          code: '#A78BFA',
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: '600' }}>Reset text settings</Text>
                    </TouchableOpacity>

                    {/* Expandable Color Rows */}
                    {([
                      {
                        key: 'dialogue' as const,
                        label: 'Dialogue color',
                        color: syntaxColors.dialogue,
                        swatches: ['#FFFFFF', palette.accent, '#38bdf8', '#fb7185', '#facc15', '#c084fc'],
                      },
                      {
                        key: 'narration' as const,
                        label: 'Italic text color',
                        color: syntaxColors.narration,
                        swatches: ['#94A3B8', '#cbd5e1', '#a3e635', '#64748b', '#e2e8f0', '#38bdf8'],
                      },
                      {
                        key: 'bold' as const,
                        label: 'Bold text color',
                        color: syntaxColors.bold,
                        swatches: ['#FFFFFF', palette.accent, '#38bdf8', '#facc15', '#fb7185', '#cbd5e1'],
                      },
                      {
                        key: 'code' as const,
                        label: 'Code color',
                        color: syntaxColors.code,
                        swatches: ['#A78BFA', '#38BDF8', '#34d399', '#facc15', '#f472b6', '#e2e8f0'],
                      },
                    ]).map(item => {
                      const isOpen = expandedColorPicker === item.key;
                      return (
                        <View
                          key={item.key}
                          style={{
                            borderRadius: 12,
                            backgroundColor: 'rgba(255,255,255,0.03)',
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.08)',
                            marginBottom: 8,
                            overflow: 'hidden',
                          }}
                        >
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                            }}
                            onPress={() => setExpandedColorPicker(isOpen ? null : item.key)}
                            activeOpacity={0.8}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                              <View
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 6,
                                  backgroundColor: item.color,
                                  borderWidth: 1,
                                  borderColor: 'rgba(255,255,255,0.25)',
                                }}
                              />
                              <Text style={{ color: '#e2e8f0', fontSize: 13, fontWeight: '600' }}>{item.label}</Text>
                            </View>
                            <ChevronDown
                              size={15}
                              color="#94a3b8"
                              style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                            />
                          </TouchableOpacity>
                          {isOpen && (
                            <View
                              style={{
                                flexDirection: 'row',
                                gap: 10,
                                paddingHorizontal: 12,
                                paddingBottom: 12,
                                paddingTop: 2,
                              }}
                            >
                              {item.swatches.map(col => (
                                <TouchableOpacity
                                  key={col}
                                  style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 15,
                                    backgroundColor: col,
                                    borderWidth: item.color === col ? 2.5 : 1,
                                    borderColor: item.color === col ? '#FFFFFF' : 'rgba(255,255,255,0.2)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                  onPress={() => handleUpdateSyntaxColors({ [item.key]: col })}
                                  activeOpacity={0.8}
                                >
                                  {item.color === col && <Check size={13} color="#000000" />}
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
              </Animated.View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.appearanceDoneBtn, { backgroundColor: palette.accent }]}
              onPress={() => {
                persistSessionMemory(activeConversationId, chatMemory);
                setShowChatControlModal(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.appearanceDoneText, { color: palette.bgDark }]}>{t('chat.applyClose')}</Text>
            </TouchableOpacity>
      </BottomSheetModal>
      <HelpCenterModal
        visible={helpLorebookVisible}
        onClose={() => setHelpLorebookVisible(false)}
        initialArticleId="lorebooks"
      />
    </SafeAreaView>
  );
};

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: GLASS.bg,
    borderBottomWidth: 1,
    borderBottomColor: GLASS.border,
    gap: 12,
    ...GLASS.backdrop,
  },
  iconBtn: {
    padding: 6,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.bgSurface,
  },
  charHeaderName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  costBadge: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  headerProfileTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerMoreBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: `rgba(${palette.accentRgb}, 0.1)`,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.25)`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSessionBtn: {
    padding: 8,
    backgroundColor: `rgba(${palette.accentRgb}, 0.1)`,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.25)`,
  },
  styleSwitcher: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  subHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  scenarioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `rgba(${palette.accentRgb}, 0.08)`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.2)`,
  },
  scenarioPillText: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 240,
  },
  greetingCyclerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: `rgba(${palette.accentRgb}, 0.06)`,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: `rgba(${palette.accentRgb}, 0.15)`,
  },
  greetingCyclerText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  greetingCycleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `rgba(${palette.accentRgb}, 0.15)`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  greetingCycleBtnText: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowBot: {
    justifyContent: 'flex-start',
  },
  bubbleAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginTop: 2,
  },
  bubbleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: `rgba(${palette.accentRgb}, 0.14)`,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.42)`,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: 'rgba(18, 21, 30, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderBottomLeftRadius: 4,
  },
  bubbleSelected: {
    borderColor: palette.accent,
    borderWidth: 1.5,
  },
  bubbleUserText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  bubbleBotText: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 21,
  },
  thoughtBox: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#38BDF8',
  },
  thoughtText: {
    color: '#38BDF8',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  bubbleActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    maxWidth: '100%',
    backgroundColor: '#1C2232',
    padding: 4,
    borderRadius: 12,
    marginTop: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bubbleActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bubbleActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  novelRow: {
    marginBottom: 20,
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: 8,
  },
  novelRowSelected: {
    backgroundColor: `rgba(${palette.accentRgb}, 0.05)`,
  },
  novelSpeaker: {
    color: colors.lime,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  novelAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.35)`,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  novelAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.35)`,
    backgroundColor: `rgba(${palette.accentRgb}, 0.14)`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  novelAvatarFallbackText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 12, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  lightboxCloseBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: {
    width: '100%',
    height: '82%',
    borderRadius: 14,
  },
  novelUserText: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 15,
    lineHeight: 23,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  novelBotText: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 23,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  inlineEditCard: {
    backgroundColor: '#161B26',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.lime,
  },
  inlineEditTitle: {
    color: colors.lime,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  inlineEditTextInput: {
    color: '#FFFFFF',
    backgroundColor: '#0F131D',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inlineEditBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 8,
  },
  inlineEditCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  inlineEditCancelText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  inlineEditSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  inlineEditSaveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  refineCard: {
    backgroundColor: 'rgba(28, 34, 50, 0.95)',
    borderTopWidth: 1,
    borderTopColor: `rgba(${palette.accentRgb}, 0.3)`,
    padding: 14,
  },
  refineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  refineTitle: {
    color: colors.lime,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  refineBody: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  refineActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  refineActionUse: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lime,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  refineActionUseText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  refineActionDiscard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  refineActionDiscardText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  composerWrapper: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
    backgroundColor: 'rgba(10, 13, 20, 0.65)',
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 14 : 10,
  },
  actionDeck: {
    backgroundColor: GLASS.bgModal,
    borderWidth: 1,
    borderColor: GLASS.borderBright,
    padding: 10,
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 16,
    ...GLASS.backdropStrong,
    ...GLASS.shadow,
  },
  actionDeckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  actionDeckText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  actionDeckTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  actionDeckSub: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 1,
  },
  modeIndicatorBadge: {
    backgroundColor: `rgba(${palette.accentRgb}, 0.15)`,
    borderWidth: 1,
    borderColor: palette.accent,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  modeIndicatorText: {
    color: palette.accent,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  actionDeckOoc: {
    color: palette.accent,
    fontWeight: '700',
    fontSize: 13,
    marginRight: 8,
  },
  unifiedComposerCard: {
    backgroundColor: GLASS.bgModal,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: GLASS.borderBright,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    marginHorizontal: 12,
    marginBottom: 4,
    ...GLASS.backdropStrong,
    ...GLASS.shadow,
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  unifiedComposerCardExpanded: {
    borderColor: palette.accent,
    minHeight: 280,
    ...(Platform.OS === 'web' ? { height: 280 } : {}),
  },
  unifiedTextInput: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    minHeight: 34,
    maxHeight: 200,
    paddingVertical: 4,
    paddingHorizontal: 2,
    textAlignVertical: 'top',
  },
  unifiedTextInputExpanded: {
    minHeight: 220,
    maxHeight: 380,
    ...(Platform.OS === 'web' ? { height: 220, flex: 1 } : {}),
  },
  composerControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  composerLeftControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  composerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  composerActionBtnActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  personaAvatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: palette.accent,
    backgroundColor: palette.bgSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  personaAvatarImg: {
    width: '100%',
    height: '100%',
  },
  personaAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#181c28',
    justifyContent: 'center',
    alignItems: 'center',
  },
  personaAvatarInitial: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  personaNameLabel: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 90,
  },
  composerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expandToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fastForwardBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: `rgba(${palette.accentRgb}, 0.15)`,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.35)`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnLime: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  sessionTrashBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  stopBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  actionBtn: {
    padding: 8,
    marginBottom: 2,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    color: colors.textPrimary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.lime,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 8, 14, 0.68)',
    justifyContent: 'flex-end',
    ...GLASS.backdrop,
    ...(Platform.OS === 'web'
      ? ({
          backgroundColor: 'transparent',
          backgroundImage:
            'linear-gradient(to bottom, rgba(6, 8, 14, 0.12) 0%, rgba(6, 8, 14, 0.48) 50%, rgba(6, 8, 14, 0.88) 100%)',
        } as any)
      : {}),
  },
  modalSheet: {
    backgroundColor: '#121622',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 8,
  },
  sessionItemActive: {
    backgroundColor: `rgba(${palette.accentRgb}, 0.08)`,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.25)`,
  },
  sessionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sessionMeta: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    marginTop: 2,
  },
  newSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lime,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  newSessionBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
  scenarioCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  scenarioCardActive: {
    borderColor: `rgba(${palette.accentRgb}, 0.3)`,
    backgroundColor: `rgba(${palette.accentRgb}, 0.06)`,
  },
  scenarioCardTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  scenarioCardDesc: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    lineHeight: 17,
  },
  scenarioCardAction: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  miniVoiceBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  ttsPillActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lime,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  ttsPillText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '700',
  },
  msgImageContainer: {
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.25)`,
    maxWidth: 320,
    width: '100%',
  },
  msgInlineImage: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 280,
    borderRadius: 14,
  },
  msgImageCaption: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontStyle: 'italic',
    padding: 6,
    textAlign: 'center',
  },
  imageModalLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  styleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1b1e28',
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  styleChipActive: {
    backgroundColor: `rgba(${palette.accentRgb}, 0.15)`,
    borderColor: colors.lime,
  },
  styleChipText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  styleChipTextActive: {
    color: colors.lime,
  },
  imageErrorBox: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  imageErrorText: {
    color: '#FF6B6B',
    fontSize: 12,
  },
  generatedImageContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.3)`,
  },
  generatedImagePreview: {
    width: '100%',
    height: 240,
    backgroundColor: '#000',
  },
  generatedPromptCaption: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 11,
    padding: 8,
    backgroundColor: palette.bgSurface,
  },
  generateArtBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lime,
    paddingVertical: 12,
    borderRadius: 12,
  },
  generateArtBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
  insertArtBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E2330',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  insertArtBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Appearance & Wallpaper Modal Styles (Blueprint Section D) ──
  appearanceSheet: {
    backgroundColor: palette.bgSurface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.25)`,
  },
  appearanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  appearanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 8,
  },
  appearanceLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  appearanceSub: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  appearanceSectionTitle: {
    color: palette.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  appearanceInput: {
    backgroundColor: '#1a1d29',
    color: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 6,
  },
  uploadWallpaperBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 6,
  },
  uploadWallpaperText: {
    color: palette.bgDark,
    fontSize: 13,
    fontWeight: '800',
  },
  resetWallpaperBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  resetWallpaperText: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  sliderPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  sliderPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sliderPillActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  sliderPillText: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '700',
  },
  sliderPillTextActive: {
    color: palette.bgDark,
    fontWeight: '800',
  },
  togglePill: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 2,
    justifyContent: 'center',
  },
  togglePillActive: {
    backgroundColor: palette.accent,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  appearanceDoneBtn: {
    backgroundColor: palette.accent,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 14,
  },
  appearanceDoneText: {
    color: palette.bgDark,
    fontSize: 14,
    fontWeight: '800',
  },
  personaEditorLabel: {
    color: palette.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  personaNameInput: {
    backgroundColor: '#1a1d29',
    color: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12,
  },
  personaPersonalityInput: {
    backgroundColor: '#1a1d29',
    color: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 70,
    marginBottom: 12,
  },
  personaSwitchGrid: {
    gap: 8,
    marginTop: 6,
    marginBottom: 10,
  },
  personaSwitchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  personaSwitchCardActive: {
    borderColor: palette.accent,
    backgroundColor: `rgba(${palette.accentRgb}, 0.08)`,
  },
  personaSwitchAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#181c28',
  },
  personaSwitchAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#181c28',
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.3)`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  personaSwitchInitial: {
    color: palette.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  personaSwitchName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  personaSwitchNameActive: {
    color: palette.accent,
  },
  personaSwitchBio: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 1,
  },
  charProfileCardSheet: {
    backgroundColor: '#10141f',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    maxHeight: '88%',
    borderTopWidth: 1,
    borderTopColor: `rgba(${palette.accentRgb}, 0.3)`,
  },
  charProfileBannerBox: {
    width: '100%',
    height: 190,
    position: 'relative',
    backgroundColor: palette.bgDark,
  },
  charProfileBannerImg: {
    width: '100%',
    height: '100%',
  },
  charProfileCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  charProfileBadgeRow: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    flexDirection: 'row',
    gap: 6,
    zIndex: 10,
  },
  charProfileBodyScroll: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 32,
  },
  charProfileName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  charProfileTagline: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  charProfileCreator: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 10,
  },
  charProfileTagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  charProfileTagChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  charProfileTagText: {
    color: '#cbd5e1',
    fontSize: 10.5,
    fontWeight: '600',
  },
  charProfileSectionTitle: {
    color: '#9ca3af',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  charProfileDescText: {
    color: '#e2e8f0',
    fontSize: 12.5,
    lineHeight: 18,
  },
  charProfileGreetingBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 4,
    marginBottom: 20,
  },
  charProfileGreetingText: {
    color: '#e2e8f0',
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
  },
  tokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.3)`,
  },
  tokenText: {
    color: palette.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  nsfwBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sfwBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.85)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  // ── Warden AI Memory Checkpoint Styles ──
  checkpointCardContainer: {
    backgroundColor: 'rgba(16, 20, 30, 0.94)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.35)`,
    padding: 14,
    marginVertical: 6,
    width: '100%',
  },
  checkpointCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 8,
    marginBottom: 8,
  },
  checkpointCardTitle: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  checkpointTagBadge: {
    backgroundColor: `rgba(${palette.accentRgb}, 0.12)`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.25)`,
  },
  checkpointTagBadgeText: {
    color: palette.accent,
    fontSize: 9.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
  },
  checkpointCardBody: {
    gap: 4,
    marginBottom: 8,
  },
  checkpointMilestoneTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  checkpointBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  checkpointBulletDot: {
    color: palette.accent,
    fontSize: 13,
    lineHeight: 18,
  },
  checkpointBulletText: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  checkpointActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 8,
  },
  checkpointPinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  checkpointPinBtnText: {
    color: palette.bgDark,
    fontSize: 11,
    fontWeight: '800',
  },
  checkpointCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.2)`,
  },
  checkpointCopyBtnText: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  headerMenuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  headerMenuCard: {
    position: 'absolute',
    top: 56,
    right: 14,
    width: 210,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 14,
  },
  headerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerMenuItemBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerMenuItemText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
  },
  scrollBottomFabWrap: {
    position: 'absolute',
    right: 16,
    bottom: 116,
    zIndex: 40,
  },
  scrollBottomFab: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  refiningBanner: {
    marginHorizontal: 14,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    minHeight: 30,
  },
  toolbarPillText: {
    color: '#cbd5e1',
    fontSize: 11.5,
    fontWeight: '700',
  },
  toolbarIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDeckGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionGridTile: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionGridIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionGridTitle: {
    color: '#f8fafc',
    fontSize: 12.5,
    fontWeight: '700',
  },
  actionGridSub: {
    color: '#94a3b8',
    fontSize: 10.5,
    marginTop: 1,
  },
  settingsBentoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  settingsCardTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  settingsDrillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
  },
  settingsRowLabel: {
    color: '#e2e8f0',
    fontSize: 13.5,
    fontWeight: '500',
  },
  settingsRowValue: {
    color: '#94a3b8',
    fontSize: 13,
  },
  settingsHairline: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  settingsSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingVertical: 2,
  },
  settingsSubHeaderTitle: {
    color: '#f8fafc',
    fontSize: 15.5,
    fontWeight: '700',
  },
  settingsValueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    minWidth: 52,
    alignItems: 'center',
  },
  settingsValueBadgeText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  settingsHelperText: {
    color: '#94a3b8',
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 4,
  },
});
