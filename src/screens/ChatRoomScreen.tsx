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

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SmoothSlider } from '../components/SmoothSlider';
import { ModelDropdown } from '../components/ModelDropdown';
import { RichHtmlRenderer } from '../components/RichHtmlRenderer';
import { BottomSheetModal } from '../components/BottomSheetModal';
import { GLASS } from '../theme/glassTheme';
import {
  ArrowLeft,
  Send,
  Plus,
  BookOpen,
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
  Play,
  RotateCw,
  Volume2,
  Image as ImageIcon,
  Palette,
  Maximize2,
  Minimize2,
  ChevronsRight,
  ImagePlus,
  MoreHorizontal,
  UserCheck,
  Smile,
  Brain,
  Cpu,
  Coins,
  UserPlus,
  Bookmark,
  Zap,
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
} from '../types';
import { colors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { imageGenService, IMAGE_STYLE_OPTIONS, ImageStylePreset } from '../services/imageGenService';
import { ttsService, TtsPlaybackState } from '../services/ttsService';
import { aiProviderService, extractCleanCharacterName } from '../services/aiProviderService';
import { storageService } from '../services/storageService';
import { calculateCost, estimateTokens } from '../services/tokenOptimizerService';
import { tokenPriceService } from '../services/tokenPriceService';
import { NekoPulseLoader } from '../components/NekoPulseLoader';
import { InlineWaitFidget } from '../components/InlineWaitFidget';
import { DeskNekoWalker } from '../components/DeskNekoWalker';

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
  const { palette } = useTheme();
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
  const [refinePreview, setRefinePreview] = useState<string | null>(null);

  // TTS Speech State
  const [ttsState, setTtsState] = useState<TtsPlaybackState>(ttsService.getPlaybackState());

  // Image Gen / Scene Depiction State
  const [showImageModal, setShowImageModal] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageStyle, setImageStyle] = useState<ImageStylePreset>('anime');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<{ imageUrl: string; prompt: string } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // Chat Appearance & Wallpaper State
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const [appearance, setAppearance] = useState<{
    enableWallpaper: boolean;
    wallpaperUrl: string;
    overlayOpacity: number;
    blurRadius: number;
  }>({
    enableWallpaper: true,
    wallpaperUrl: character.coverUrl || character.avatar || '',
    overlayOpacity: 0.38,
    blurRadius: 6,
  });

  // Character Profile Card Modal State (Header Name Tap)
  const [showCharacterCardModal, setShowCharacterCardModal] = useState(false);

  // Chat Control Modal State (3-Dot Button: Memory, Per-Chat Model, Syntax Colors)
  const [showChatControlModal, setShowChatControlModal] = useState(false);
  const [chatControlTab, setChatControlTab] = useState<'memory' | 'model' | 'syntax'>('memory');
  const [chatMemory, setChatMemory] = useState('');
  const [chatModel, setChatModel] = useState('');
  const [chatTemperature, setChatTemperature] = useState<number>(config?.temperature || 0.7);
  const [fetchedChatModels, setFetchedChatModels] = useState<{ id: string; name: string }[]>([]);
  const [loadingChatModels, setLoadingChatModels] = useState(false);
  const [syntaxColors, setSyntaxColors] = useState({
    dialogue: '#FFFFFF',
    narration: '#94A3B8',
    thoughts: '#38BDF8',
  });
  const [memorySavedNotice, setMemorySavedNotice] = useState(false);
  const [isSummarizingMemory, setIsSummarizingMemory] = useState(false);
  const [memoryNoticeText, setMemoryNoticeText] = useState('');
  const [lastCheckpointIndex, setLastCheckpointIndex] = useState<number>(-1);

  // Quick Persona Switcher & Personality Editor State (Dynamic from storage)
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [allPersonas, setAllPersonas] = useState<Persona[]>(personas || []);
  const [editingPersonaName, setEditingPersonaName] = useState(persona?.name || 'Ren');
  const [editingPersonaPersonality, setEditingPersonaPersonality] = useState(persona?.personality || persona?.description || '');

  // Expandable Input Box State (Image 1 Parity)
  const [isInputExpanded, setIsInputExpanded] = useState(false);
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

  const loadChatMemoryAndSettings = async () => {
    try {
      const savedMemory = await AsyncStorage.getItem(`@nekochat:chat_memory_${character.id}`);
      if (savedMemory) {
        const hasContent = savedMemory.replace(/<memory>|<\/memory>/gi, '').trim().length > 0;
        setChatMemory(hasContent ? savedMemory : '');
      }

      const savedLastIdx = await AsyncStorage.getItem(`@nekochat:chat_checkpoint_idx_${character.id}`);
      if (savedLastIdx !== null) {
        setLastCheckpointIndex(parseInt(savedLastIdx, 10));
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
    Animated.spring(actionDeckAnim, {
      toValue: showActionDeck ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 120,
    }).start();
  }, [showActionDeck]);

  useEffect(() => {
    Animated.spring(wallpaperToggleAnim, {
      toValue: appearance.enableWallpaper ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 140,
    }).start();
  }, [appearance.enableWallpaper]);

  useEffect(() => {
    chatControlTabAnim.setValue(0.35);
    Animated.timing(chatControlTabAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [chatControlTab]);

  useEffect(() => {
    loadPersonas();
    loadChatMemoryAndSettings();
  }, [character.id, persona?.id]);

  const hasValidMemory = (mem: string) => {
    return mem.replace(/<memory>|<\/memory>/gi, '').trim().length > 0;
  };

  /**
   * 1. Incremental Checkpoint Update:
   * Summarizes only from the last checkpoint up to the latest conversation turn.
   * If no prior checkpoint exists, performs an initial synthesis.
   * Maximizes token efficiency (JanitorAI & Warden standard)!
   */
  const handleIncrementalCheckpoint = async () => {
    if (isSummarizingMemory || messages.length === 0) return;

    const existingHasContent = hasValidMemory(chatMemory);
    const isFirstRun = !existingHasContent || lastCheckpointIndex < 0;

    const startIdx = isFirstRun ? 0 : Math.max(0, lastCheckpointIndex + 1);
    const contextPrefixIdx = isFirstRun ? 0 : Math.max(0, startIdx - 3);
    const messagesToSummarize = messages.slice(startIdx);

    if (messagesToSummarize.length === 0 && !isFirstRun) {
      setMemoryNoticeText('✓ Already up-to-date with latest message!');
      setTimeout(() => setMemoryNoticeText(''), 2500);
      return;
    }

    setIsSummarizingMemory(true);
    setMemoryNoticeText(
      isFirstRun
        ? `Synthesizing initial story checkpoint (${messages.length} messages)...`
        : `Synthesizing incremental checkpoint (${messagesToSummarize.length} new turns)...`
    );

    try {
      const activeConfig = await resolveActiveConfig();
      const existingCount = (chatMemory.match(/\[Checkpoint\s*#?(\d+)/gi) || []).length;
      const nextNum = existingCount + 1;

      const sliceForLlm = isFirstRun ? messages : messages.slice(contextPrefixIdx);

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
      const newLastIdx = messages.length - 1;
      setLastCheckpointIndex(newLastIdx);

      await AsyncStorage.setItem(`@nekochat:chat_memory_${character.id}`, updated);
      await AsyncStorage.setItem(`@nekochat:chat_checkpoint_idx_${character.id}`, String(newLastIdx));

      setMemoryNoticeText(
        isFirstRun
          ? `✓ Initial Checkpoint created up to turn #${newLastIdx + 1}!`
          : `✓ Checkpoint #${nextNum} saved up to turn #${newLastIdx + 1}!`
      );
    } catch (err: any) {
      setMemoryNoticeText(`⚠️ Incremental summary failed: ${err.message || 'Error'}`);
    } finally {
      setIsSummarizingMemory(false);
      setTimeout(() => setMemoryNoticeText(''), 3500);
    }
  };

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

      await AsyncStorage.setItem(`@nekochat:chat_memory_${character.id}`, masterCheckpoint);
      await AsyncStorage.setItem(`@nekochat:chat_checkpoint_idx_${character.id}`, String(newLastIdx));

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
      await AsyncStorage.setItem(`@nekochat:chat_memory_${character.id}`, updated);
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

  const resolveActiveConfig = async (): Promise<ProviderConfig> => {
    const storedCfg = await storageService.getProviderConfig();
    const baseCfg: ProviderConfig = config?.apiKey ? { ...storedCfg, ...config } : { ...config, ...storedCfg };
    const effectiveModel =
      chatModel && chatModel.trim() && chatModel !== 'custom'
        ? chatModel.trim()
        : baseCfg.model || baseCfg.defaultModel || 'gpt-4o-mini';
    return {
      ...baseCfg,
      model: effectiveModel,
      temperature: chatTemperature ?? baseCfg.temperature,
    };
  };

  const handleSelectTemperature = async (temp: number) => {
    setChatTemperature(temp);
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
      const saved = await AsyncStorage.getItem(`@nekochat:chat_appearance_${character.id}`);
      if (saved) {
        setAppearance(prev => ({ ...prev, ...JSON.parse(saved) }));
      } else {
        setAppearance({
          enableWallpaper: true,
          wallpaperUrl: character.coverUrl || character.avatar || '',
          overlayOpacity: 0.38,
          blurRadius: 6,
        });
      }
    } catch {}
  };

  const saveChatAppearance = async (updates: Partial<typeof appearance>) => {
    const next = { ...appearance, ...updates };
    setAppearance(next);
    try {
      await AsyncStorage.setItem(`@nekochat:chat_appearance_${character.id}`, JSON.stringify(next));
    } catch {}
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
      setMessages(newConv.messages || []);
    }
  };

  // --- Session Switching ---
  const handleStartNewSession = async (scenario?: CharacterScenario) => {
    setShowSessionModal(false);
    setShowScenarioModal(false);
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
    setMessages(newConv.messages || []);
    setGreetingIndex(0);
  };

  const handleSwitchSession = (conv: Conversation) => {
    setShowSessionModal(false);
    setActiveConversationId(conv.id);
    setActiveScenarioId(conv.scenarioId || null);
    setMessages(conv.messages || []);
  };

  // --- Alternate Greetings Cycler ---
  const handleCycleGreeting = async () => {
    if (messages.length > 1 || allGreetings.length <= 1) return;
    const nextIdx = (greetingIndex + 1) % allGreetings.length;
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

  // --- Sending & Streaming ---
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    setInputText('');
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

  const triggerAiStream = async (historyWithUser: ChatMessage[], userMessage: string) => {
    setIsStreaming(true);
    let incomingAssistantText = '';

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
    const effectiveChar: Character = chatMemory.trim()
      ? {
          ...character,
          scenario: `${character.scenario || ''}\n[Permanent Roleplay Memory Notes: ${chatMemory.trim()}]`,
        }
      : character;

    await aiProviderService.streamChat(
      effectiveChar,
      historyWithUser,
      userMessage,
      persona,
      activeConfig,
      {
        onChunk: chunk => {
          incomingAssistantText += chunk;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantPlaceholderId ? { ...m, content: incomingAssistantText } : m
            )
          );
          scrollViewRef.current?.scrollToEnd({ animated: false });
        },
        onError: err => {
          setIsStreaming(false);
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
          const finalMsg: ChatMessage = {
            id: assistantPlaceholderId,
            conversationId: activeConversationId || undefined,
            characterId: character.id,
            role: 'assistant',
            content: fullText,
            thought,
            tokenCount,
            timestamp: Date.now(),
          };
          const finalMessages = historyWithUser.concat([finalMsg]);
          setMessages(finalMessages);
          await persistMessagesList(finalMessages);
        },
      },
      {
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

  /**
   * Cascading Delete:
   * Deleting a message automatically deletes it AND all messages below it in the thread.
   */
  const handleDeleteMessage = async (msgId: string) => {
    setSelectedMessageId(null);
    const targetIdx = messages.findIndex(m => m.id === msgId);
    const updated = targetIdx >= 0 ? messages.slice(0, targetIdx) : messages.filter(m => m.id !== msgId);
    setMessages(updated);
    await persistMessagesList(updated);
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

    if (regenerateAfter) {
      setEditingMessageId(null);
      await handleRegenerate(targetIdx, editText.trim());
    } else {
      const updated = [...messages];
      updated[targetIdx] = { ...updated[targetIdx], content: editText.trim() };
      setMessages(updated);
      setEditingMessageId(null);
      await persistMessagesList(updated);
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
    const lastTurn = trimmed[trimmed.length - 1];
    const promptText = lastTurn.role === 'user' ? lastTurn.content : '[Continue the opening scene in character.]';

    setMessages(trimmed);
    await persistMessagesList(trimmed);
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
    const effectiveChar: Character = chatMemory.trim()
      ? {
          ...character,
          scenario: `${character.scenario || ''}\n[Permanent Roleplay Memory Notes: ${chatMemory.trim()}]`,
        }
      : character;

    await aiProviderService.streamChat(
      effectiveChar,
      messages,
      '',
      persona,
      activeConfig,
      {
        onChunk: chunk => {
          setIsContinuingWait(false);
          continuedText += chunk;
          setMessages(prev =>
            prev.map((m, idx) => (idx === lastIdx ? { ...m, content: continuedText } : m))
          );
          scrollViewRef.current?.scrollToEnd({ animated: false });
        },
        onError: err => {
          setIsContinuingWait(false);
          setIsStreaming(false);
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
        scenario: currentScenario,
        lorebooks,
        isContinue: true,
        memory: chatMemory,
      }
    );
  };

  // AI Writing Coach (Refine)
  const handleRefine = async () => {
    if (!inputText.trim()) return;
    setIsRefining(true);
    setShowActionDeck(false);

    const activeConfig = await resolveActiveConfig();
    const lastBot = messages.filter(m => m.role === 'assistant').pop()?.content || '';
    const polished = await aiProviderService.refineMessage(
      inputText,
      character,
      lastBot,
      persona,
      activeConfig
    );

    setRefinePreview(polished);
    setIsRefining(false);
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
      .replace(/<(?:think|thought|reasoning)>[\s\S]*?<\/(?:think|thought|reasoning)>/gi, '')
      .replace(/<(?:think|thought|reasoning)>[\s\S]*$/gi, '')
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

  const renderFormattedText = (text: string, isUser: boolean, isNovel: boolean) => {
    if (isUser) {
      return (
        <Text style={isNovel ? styles.novelUserText : styles.bubbleUserText}>
          {text}
        </Text>
      );
    }

    const regex = /(\*\*[\s\S]*?(?:\*\*|$)|"[^"]*"|“[^”]*”|「[^」]*」|\*[^*\n]+?(?:\*|$)|`[^`]*?`)/g;
    const parts = text.split(regex);

    return (
      <Text style={[isNovel ? styles.novelBotText : styles.bubbleBotText, { color: syntaxColors.dialogue }]}>
        {parts.map((part, index) => {
          if (!part) return null;
          if (part.startsWith('**')) {
            const inner = part.endsWith('**') && part.length > 4 ? part.slice(2, -2) : part.slice(2);
            return (
              <Text key={index} style={{ color: syntaxColors.dialogue, fontWeight: '700' }}>
                {inner}
              </Text>
            );
          }
          if (
            (part.startsWith('"') && part.endsWith('"')) ||
            (part.startsWith('“') && part.endsWith('”')) ||
            (part.startsWith('「') && part.endsWith('」'))
          ) {
            return (
              <Text key={index} style={{ color: syntaxColors.dialogue, fontWeight: '500' }}>
                {part}
              </Text>
            );
          }
          if (part.startsWith('*')) {
            const inner = part.endsWith('*') && part.length > 2 ? part.slice(1, -1) : part.slice(1);
            return (
              <Text key={index} style={{ color: syntaxColors.narration, fontStyle: 'italic' }}>
                {inner}
              </Text>
            );
          }
          if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            return (
              <Text key={index} style={{ color: syntaxColors.thoughts, fontStyle: 'italic' }}>
                {part.slice(1, -1)}
              </Text>
            );
          }
          return (
            <Text key={index} style={{ color: isNovel ? '#e2e8f0' : colors.textPrimary }}>
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
      .replace(/\{\{user\}\}/gi, activeUserName)
      .replace(/<user>/gi, activeUserName)
      .replace(/\{\{char\}\}/gi, chatCharName)
      .replace(/<char>/gi, chatCharName);
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
                <Brain size={14} color="#d4ff00" />
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
                <Bookmark size={11} color="#0c0e14" />
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
                <Copy size={11} color="#d4ff00" />
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
          <View style={styles.msgImageContainer}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.msgInlineImage}
              resizeMode="cover"
            />
            {caption.length > 0 && (
              <Text style={styles.msgImageCaption}>{caption}</Text>
            )}
          </View>
        </View>
      );
    }

    return renderFormattedText(content, isUser, isNovel);
  };

  const totalTokens = messages.reduce((acc, m) => acc + (m.tokenCount || estimateTokens(m.content)), 0);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bgDark }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
      {/* ── Background Wallpaper, Gaussian Blur & Dark Overlay (Blueprint Section D) ── */}
      {appearance.enableWallpaper && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image
            source={{ uri: appearance.wallpaperUrl || character.coverUrl || character.avatar }}
            style={[
              StyleSheet.absoluteFill,
              Platform.OS === 'web' && appearance.blurRadius > 0
                ? ({ filter: `blur(${appearance.blurRadius}px)` } as any)
                : {},
            ]}
            resizeMode="cover"
            blurRadius={
              Platform.OS === 'web'
                ? undefined
                : appearance.blurRadius > 0
                ? Math.min(25, Math.max(1, Math.round(appearance.blurRadius * 2)))
                : 0
            }
          />
          <LinearGradient
            colors={[
              'rgba(12, 14, 20, 0.72)',
              `rgba(12, 14, 20, ${Math.max(0.58, appearance.overlayOpacity)})`,
              `rgba(12, 14, 20, ${Math.max(0.78, appearance.overlayOpacity)})`,
            ]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      {/* Top Header Bar — Clean Minimalist Neo-Anime Bar */}
      <View style={styles.header}>
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

        {/* 3-Dot Chat Control & Context Button (JanitorAI / SillyTavern Style) */}
        <TouchableOpacity
          style={styles.headerMoreBtn}
          onPress={() => setShowChatControlModal(true)}
          activeOpacity={0.8}
          accessibilityLabel="Open Chat Control Menu"
        >
          <MoreHorizontal size={20} color="#d4ff00" />
        </TouchableOpacity>
      </View>

      {/* Scenario & Alternate Greeting Sub-Header */}
      {character.scenarios && character.scenarios.length > 0 && (
        <View style={styles.subHeaderBar}>
          <TouchableOpacity
            style={styles.scenarioPill}
            onPress={() => setShowScenarioModal(true)}
          >
            <Play size={12} color="#D4FF00" style={{ marginRight: 5 }} />
            <Text style={styles.scenarioPillText} numberOfLines={1}>
              {currentScenario ? currentScenario.title : 'Select Scenario'}
            </Text>
            <ChevronDown size={14} color="#D4FF00" style={{ marginLeft: 4 }} />
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
            <RotateCw size={12} color="#D4FF00" style={{ marginRight: 4 }} />
            <Text style={styles.greetingCycleBtnText}>Cycle Next</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Messages Scroll Area */}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((msg, idx) => {
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
                        <Square size={13} color="#D4FF00" />
                      ) : (
                        <Volume2 size={13} color="rgba(255, 255, 255, 0.4)" />
                      )}
                    </TouchableOpacity>
                  )}
                </View>

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

                {/* Always-visible quick Regenerate & Continue bar on the latest assistant reply */}
                {isLastAssistant && !isStreaming && !isSelected && idx > 0 && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      style={styles.bubbleActionBtn}
                      onPress={() => handleRegenerate(idx)}
                      activeOpacity={0.8}
                    >
                      <RotateCcw size={12} color="#D4FF00" style={{ marginRight: 4 }} />
                      <Text style={styles.bubbleActionText}>Regenerate</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.bubbleActionBtn}
                      onPress={handleContinue}
                      activeOpacity={0.8}
                    >
                      <Play size={12} color="#D4FF00" style={{ marginRight: 4 }} />
                      <Text style={styles.bubbleActionText}>Continue</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Action Bar on Tap */}
                {isSelected && (
                  <View style={styles.bubbleActionRow}>
                    <TouchableOpacity style={styles.bubbleActionBtn} onPress={() => handleCopyMessage(msg)}>
                      <Copy size={13} color="#D4FF00" style={{ marginRight: 4 }} />
                      <Text style={styles.bubbleActionText}>
                        {copiedId === msg.id ? 'Copied!' : 'Copy'}
                      </Text>
                    </TouchableOpacity>
                    {isUser ? (
                      <>
                        <TouchableOpacity style={styles.bubbleActionBtn} onPress={() => handleStartEdit(msg)}>
                          <Edit2 size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.bubbleActionText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.bubbleActionBtn} onPress={() => handleRegenerate(idx)}>
                          <RotateCcw size={13} color="#D4FF00" style={{ marginRight: 4 }} />
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
                              <Square size={13} color="#D4FF00" style={{ marginRight: 4 }} />
                              <Text style={[styles.bubbleActionText, { color: '#D4FF00' }]}>Stop Voice</Text>
                            </>
                          ) : (
                            <>
                              <Volume2 size={13} color="#D4FF00" style={{ marginRight: 4 }} />
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
                            <Play size={13} color="#D4FF00" style={{ marginRight: 4 }} />
                            <Text style={styles.bubbleActionText}>Continue</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
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
                    isSelected && styles.bubbleSelected,
                  ]}
                  onPress={() => setSelectedMessageId(isSelected ? null : msg.id)}
                  activeOpacity={0.9}
                >
                  {isWaitingPlaceholder ? (
                    <Text style={[styles.bubbleBotText, { color: 'rgba(226, 232, 240, 0.55)', fontStyle: 'italic' }]}>
                      Writing...
                    </Text>
                  ) : (
                    <>
                      {msg.thought && (
                        <View style={styles.thoughtBox}>
                          <Text style={styles.thoughtText}>{msg.thought}</Text>
                        </View>
                      )}
                      {renderMessageContent(displayContent, isUser, false)}
                    </>
                  )}

                  {!isUser && (
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
                      <TouchableOpacity
                        style={styles.miniVoiceBtn}
                        onPress={() => ttsService.speak(msg.content, msg.id)}
                      >
                        {isSpeakingThis ? (
                          <Square size={12} color="#D4FF00" />
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

                {/* Always-visible quick Regenerate & Continue bar on the latest assistant bubble */}
                {isLastAssistant && !isStreaming && !isSelected && idx > 0 && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, alignSelf: 'flex-start' }}>
                    <TouchableOpacity
                      style={styles.bubbleActionBtn}
                      onPress={() => handleRegenerate(idx)}
                      activeOpacity={0.8}
                    >
                      <RotateCcw size={12} color="#D4FF00" style={{ marginRight: 4 }} />
                      <Text style={styles.bubbleActionText}>Regenerate</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.bubbleActionBtn}
                      onPress={handleContinue}
                      activeOpacity={0.8}
                    >
                      <Play size={12} color="#D4FF00" style={{ marginRight: 4 }} />
                      <Text style={styles.bubbleActionText}>Continue</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Action Bar on Tap */}
                {isSelected && (
                  <View style={[styles.bubbleActionRow, isUser ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
                    <TouchableOpacity style={styles.bubbleActionBtn} onPress={() => handleCopyMessage(msg)}>
                      <Copy size={13} color="#D4FF00" style={{ marginRight: 4 }} />
                      <Text style={styles.bubbleActionText}>
                        {copiedId === msg.id ? 'Copied!' : 'Copy'}
                      </Text>
                    </TouchableOpacity>
                    {isUser ? (
                      <>
                        <TouchableOpacity style={styles.bubbleActionBtn} onPress={() => handleStartEdit(msg)}>
                          <Edit2 size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.bubbleActionText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.bubbleActionBtn} onPress={() => handleRegenerate(idx)}>
                          <RotateCcw size={13} color="#D4FF00" style={{ marginRight: 4 }} />
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
                              <Square size={13} color="#D4FF00" style={{ marginRight: 4 }} />
                              <Text style={[styles.bubbleActionText, { color: '#D4FF00' }]}>Stop Voice</Text>
                            </>
                          ) : (
                            <>
                              <Volume2 size={13} color="#D4FF00" style={{ marginRight: 4 }} />
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
                            <Play size={13} color="#D4FF00" style={{ marginRight: 4 }} />
                            <Text style={styles.bubbleActionText}>Continue</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                    <TouchableOpacity style={styles.bubbleActionBtn} onPress={() => handleDeleteMessage(msg.id)}>
                      <Trash2 size={13} color="#FF6B6B" style={{ marginRight: 4 }} />
                      <Text style={[styles.bubbleActionText, { color: '#FF6B6B' }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {isStreaming && !fidgetOpen && (
          <View style={{ padding: 14, alignItems: 'center' }}>
            <NekoPulseLoader size={30} />
          </View>
        )}
      </ScrollView>

      {/* Refine / AI Writing Coach Preview Card */}
      {refinePreview && (
        <View style={styles.refineCard}>
          <View style={styles.refineHeader}>
            <Sparkles size={14} color={colors.lime} style={{ marginRight: 6 }} />
            <Text style={styles.refineTitle}>Polished by AI Coach</Text>
          </View>
          <Text style={styles.refineBody}>"{refinePreview}"</Text>
          <View style={styles.refineActionRow}>
            <TouchableOpacity
              style={styles.refineActionUse}
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
              {/* 1. Continue Character Reply */}
              <TouchableOpacity
                style={styles.actionDeckItem}
                onPress={() => {
                  setShowActionDeck(false);
                  handleContinue();
                }}
                disabled={isStreaming}
              >
                <ChevronsRight size={17} color="#d4ff00" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionDeckTitle}>Continue Character Reply</Text>
                  <Text style={styles.actionDeckSub}>Let {chatCharName} write the next sentence</Text>
                </View>
              </TouchableOpacity>

              {/* 1B. Regenerate Last Reply */}
              <TouchableOpacity
                style={styles.actionDeckItem}
                onPress={() => {
                  setShowActionDeck(false);
                  handleRegenerate();
                }}
                disabled={isStreaming}
              >
                <RotateCcw size={16} color="#d4ff00" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionDeckTitle}>Regenerate Response</Text>
                  <Text style={styles.actionDeckSub}>Roll a fresh AI reply for the last turn</Text>
                </View>
              </TouchableOpacity>

              {/* 1C. Warden Story Checkpoints & Memory */}
              <TouchableOpacity
                style={styles.actionDeckItem}
                onPress={() => {
                  setShowActionDeck(false);
                  setChatControlTab('memory');
                  setShowChatControlModal(true);
                }}
              >
                <Brain size={17} color="#d4ff00" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionDeckTitle}>Story Checkpoints & Memory</Text>
                  <Text style={styles.actionDeckSub}>Create, summarize or view &lt;memory&gt; points</Text>
                </View>
              </TouchableOpacity>

              {/* 2. Reading Style: Novel vs Bubble */}
              <TouchableOpacity
                style={styles.actionDeckItem}
                onPress={handleToggleChatStyle}
              >
                {chatStyle === 'novel' ? (
                  <BookOpen size={17} color="#d4ff00" style={{ marginRight: 10 }} />
                ) : (
                  <MessageCircle size={17} color="#d4ff00" style={{ marginRight: 10 }} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionDeckTitle}>
                    Reading Style: {chatStyle === 'novel' ? 'Novel Mode' : 'Bubble Mode'}
                  </Text>
                  <Text style={styles.actionDeckSub}>Tap to switch to {chatStyle === 'novel' ? 'Message Bubbles' : 'Novel Prose'}</Text>
                </View>
                <View style={styles.modeIndicatorBadge}>
                  <Text style={styles.modeIndicatorText}>{chatStyle.toUpperCase()}</Text>
                </View>
              </TouchableOpacity>

              {/* 3. Wallpaper & Appearance */}
              <TouchableOpacity
                style={styles.actionDeckItem}
                onPress={() => {
                  setShowActionDeck(false);
                  setShowAppearanceModal(true);
                }}
              >
                <Palette size={17} color="#d4ff00" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionDeckTitle}>Wallpaper & Appearance</Text>
                  <Text style={styles.actionDeckSub}>Upload custom wallpaper, adjust blur & scrim</Text>
                </View>
              </TouchableOpacity>

              {/* 4. Chat Sessions & Branching */}
              <TouchableOpacity
                style={styles.actionDeckItem}
                onPress={() => {
                  setShowActionDeck(false);
                  setShowSessionModal(true);
                }}
              >
                <Layers size={17} color="#d4ff00" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionDeckTitle}>Saved Scenarios & Sessions</Text>
                  <Text style={styles.actionDeckSub}>Switch roleplay branches or start fresh</Text>
                </View>
              </TouchableOpacity>

              {/* 5. Depict Scene Art */}
              <TouchableOpacity
                style={styles.actionDeckItem}
                onPress={() => {
                  setShowActionDeck(false);
                  handleOpenSceneDepict();
                }}
              >
                <ImageIcon size={17} color="#d4ff00" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionDeckTitle}>Depict Scene Illustration</Text>
                  <Text style={styles.actionDeckSub}>Generate AI visual of current scene</Text>
                </View>
              </TouchableOpacity>

              {/* 6. Refine / Polish Draft */}
              <TouchableOpacity
                style={styles.actionDeckItem}
                onPress={() => {
                  setShowActionDeck(false);
                  handleRefine();
                }}
                disabled={isRefining}
              >
                <Sparkles size={17} color="#d4ff00" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionDeckTitle}>
                    {isRefining ? 'Polishing...' : 'Refine & Polish Draft'}
                  </Text>
                  <Text style={styles.actionDeckSub}>AI roleplay style enhancer</Text>
                </View>
              </TouchableOpacity>

              {/* 7. [ooc] Out of Character */}
              <TouchableOpacity
                style={styles.actionDeckItem}
                onPress={() => {
                  setInputText(prev => (prev.startsWith('[ooc]') ? prev : `[ooc] ${prev}`));
                  setShowActionDeck(false);
                }}
              >
                <Text style={styles.actionDeckOoc}>[ooc]</Text>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.actionDeckTitle}>Out of Character Note</Text>
                  <Text style={styles.actionDeckSub}>Direct instruction to AI director</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Unified Expandable Composer Container (Matching Image 1) */}
          <View style={[styles.unifiedComposerCard, isInputExpanded && styles.unifiedComposerCardExpanded]}>
            <TextInput
              style={[styles.unifiedTextInput, isInputExpanded && styles.unifiedTextInputExpanded]}
              placeholder='Type your roleplay action or dialogue (*actions in asterisks*, "dialogue")...'
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              value={inputText}
              onChangeText={setInputText}
              multiline
              textAlignVertical="top"
            />

            {/* Bottom Inner Control Dock */}
            <View style={styles.composerControlRow}>
              {/* Left Controls: + (Action Deck) and Persona Avatar */}
              <View style={styles.composerLeftControls}>
                <TouchableOpacity
                  style={[styles.composerActionBtn, showActionDeck && styles.composerActionBtnActive]}
                  onPress={() => setShowActionDeck(prev => !prev)}
                  activeOpacity={0.8}
                  accessibilityLabel="Action Deck"
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
                    <Plus size={18} color={showActionDeck ? '#0c0e14' : '#d4ff00'} />
                  </Animated.View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.personaAvatarBtn}
                  onPress={() => {
                    setEditingPersonaName(persona.name);
                    setEditingPersonaPersonality(persona.personality || persona.description || '');
                    setShowPersonaModal(true);
                  }}
                  activeOpacity={0.8}
                  accessibilityLabel="Switch or edit active persona"
                >
                  {persona.avatar ? (
                    <Image source={{ uri: persona.avatar }} style={styles.personaAvatarImg} />
                  ) : (
                    <View style={styles.personaAvatarPlaceholder}>
                      <Text style={styles.personaAvatarInitial}>
                        {persona.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
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
                    style={styles.stopBtn}
                    onPress={() => aiProviderService.abortGeneration()}
                    activeOpacity={0.8}
                    accessibilityLabel="Stop response"
                  >
                    <Square size={16} color="#FFFFFF" fill="#FFFFFF" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.sendBtnLime, !inputText.trim() && styles.sendBtnDisabled]}
                    onPress={handleSend}
                    disabled={!inputText.trim()}
                    activeOpacity={0.8}
                    accessibilityLabel="Send message"
                  >
                    <Send size={16} color="#0c0e14" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

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
                        {conv.scenarioTitle || `Session #${conversations.length - idx}`}
                      </Text>
                      <Text style={styles.sessionMeta}>
                        {conv.messages?.length || 0} messages • {new Date(conv.updatedAt).toLocaleDateString()}
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

      {/* ================= MODAL: CHAT WALLPAPER & APPEARANCE (Blueprint Section D) ================= */}
      <BottomSheetModal
        visible={showAppearanceModal}
        onClose={() => setShowAppearanceModal(false)}
      >
            <View style={styles.appearanceHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Palette size={18} color="#d4ff00" />
                <Text style={styles.modalTitle}>Chat Wallpaper & Effects</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAppearanceModal(false)}>
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
              {/* Toggle Wallpaper */}
              <View style={styles.appearanceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appearanceLabel}>Character Wallpaper</Text>
                  <Text style={styles.appearanceSub}>Display background art behind messages</Text>
                </View>
                <TouchableOpacity
                  style={[styles.togglePill, appearance.enableWallpaper && styles.togglePillActive]}
                  onPress={() => saveChatAppearance({ enableWallpaper: !appearance.enableWallpaper })}
                  activeOpacity={0.8}
                >
                  <Animated.View
                    style={[
                      styles.toggleThumb,
                      {
                        transform: [
                          {
                            translateX: wallpaperToggleAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 20],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                </TouchableOpacity>
              </View>

              {/* Wallpaper Picker & URL Input */}
              {appearance.enableWallpaper && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.appearanceSectionTitle}>UPLOAD CUSTOM WALLPAPER</Text>
                  
                  {/* Upload from Device / Gallery Button */}
                  <TouchableOpacity
                    style={styles.uploadWallpaperBtn}
                    onPress={handlePickWallpaper}
                    activeOpacity={0.8}
                  >
                    <ImagePlus size={16} color="#0c0e14" style={{ marginRight: 6 }} />
                    <Text style={styles.uploadWallpaperText}>Upload / Pick from Gallery</Text>
                  </TouchableOpacity>

                  <Text style={[styles.appearanceSectionTitle, { marginTop: 14 }]}>OR IMAGE URL</Text>
                  <TextInput
                    style={styles.appearanceInput}
                    placeholder="Paste image URL (https://...)"
                    placeholderTextColor="#6b7280"
                    value={appearance.wallpaperUrl}
                    onChangeText={v => saveChatAppearance({ wallpaperUrl: v })}
                  />
                  <TouchableOpacity
                    style={styles.resetWallpaperBtn}
                    onPress={() => saveChatAppearance({ wallpaperUrl: character.coverUrl || character.avatar || '' })}
                    activeOpacity={0.7}
                  >
                    <RotateCcw size={12} color="#d4ff00" style={{ marginRight: 4 }} />
                    <Text style={styles.resetWallpaperText}>Reset to Default Character Art</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Darkness Overlay Opacity */}
              <View style={{ marginBottom: 18 }}>
                <Text style={styles.appearanceSectionTitle}>
                  DARKNESS OVERLAY ({(appearance.overlayOpacity * 100).toFixed(0)}%)
                </Text>
                <Text style={styles.appearanceSub}>Darkens wallpaper for crisp message readability</Text>
                <SmoothSlider
                  value={Math.round(appearance.overlayOpacity * 100)}
                  min={0}
                  max={98}
                  step={1}
                  onValueChange={val => saveChatAppearance({ overlayOpacity: val / 100 })}
                  minLabel="0% Clear"
                  maxLabel="98% Pitch"
                />
              </View>

              {/* Blur Intensity */}
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.appearanceSectionTitle}>
                  BLUR EFFECT ({appearance.blurRadius}px)
                </Text>
                <Text style={styles.appearanceSub}>Softens background details for aesthetic focus</Text>
                <SmoothSlider
                  value={appearance.blurRadius}
                  min={0}
                  max={24}
                  step={1}
                  onValueChange={val => saveChatAppearance({ blurRadius: val })}
                  minLabel="0px Sharp"
                  maxLabel="24px Cinematic"
                />
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.appearanceDoneBtn} onPress={() => setShowAppearanceModal(false)}>
              <Text style={styles.appearanceDoneText}>Apply & Close</Text>
            </TouchableOpacity>
      </BottomSheetModal>

      {/* ================= MODAL: QUICK PERSONA SWITCHER & PERSONALITY EDITOR ================= */}
      <BottomSheetModal
        visible={showPersonaModal}
        onClose={() => setShowPersonaModal(false)}
      >
            <View style={styles.appearanceHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Smile size={18} color="#d4ff00" />
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
                      {isCur && <UserCheck size={16} color="#d4ff00" />}
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
                    <Coins size={11} color="#d4ff00" style={{ marginRight: 3 }} />
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
      >
            <View style={styles.appearanceHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MoreHorizontal size={18} color="#d4ff00" />
                <Text style={styles.modalTitle}>Chat Control & Context</Text>
              </View>
              <TouchableOpacity onPress={() => setShowChatControlModal(false)}>
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Sub-Tabs: [ 🧠 Memory ] | [ ⚡ AI Model ] | [ 🎨 Text Colors ] */}
            <View style={{ flexDirection: 'row', gap: 6, marginHorizontal: 20, marginBottom: 14, marginTop: 4 }}>
              {[
                { id: 'memory', label: '🧠 Memory' },
                { id: 'model', label: '⚡ AI Model' },
                { id: 'syntax', label: '🎨 Text Colors' },
              ].map(tb => (
                <TouchableOpacity
                  key={tb.id}
                  style={[
                    styles.sliderPill,
                    chatControlTab === tb.id && styles.sliderPillActive,
                    { flex: 1, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
                  ]}
                  onPress={() => setChatControlTab(tb.id as any)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.sliderPillText,
                      chatControlTab === tb.id && styles.sliderPillTextActive,
                      { fontSize: 11.5, fontWeight: '700' },
                    ]}
                  >
                    {tb.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <Animated.View style={{ opacity: chatControlTabAnim }}>
              {/* TAB 1: Chat Memory & Warden Checkpoints */}
              {chatControlTab === 'memory' && (
                <View style={{ paddingHorizontal: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={styles.personaEditorLabel}>PERSISTENT MEMORY & CHECKPOINTS</Text>
                    <View style={styles.checkpointTagBadge}>
                      <Text style={styles.checkpointTagBadgeText}>&lt;memory&gt; standard</Text>
                    </View>
                  </View>
                  <Text style={{ color: '#9ca3af', fontSize: 11.5, lineHeight: 16, marginBottom: 10 }}>
                    Warden AI checkpoints inside &lt;memory&gt; tags are permanently injected into this companion's context window.
                  </Text>

                  {/* Dual Summarizers: Incremental Update & Full Story Rescan */}
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    <TouchableOpacity
                      style={[
                        styles.sliderPill,
                        { flex: 1, paddingVertical: 8, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
                      ]}
                      onPress={handleIncrementalCheckpoint}
                      disabled={isSummarizingMemory}
                      activeOpacity={0.8}
                    >
                      {isSummarizingMemory ? (
                        <ActivityIndicator size="small" color="#d4ff00" />
                      ) : (
                        <Zap size={14} color="#d4ff00" />
                      )}
                      <Text style={[styles.sliderPillText, { color: '#d4ff00', fontSize: 11, fontWeight: '700' }]}>
                        Update to Latest
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.sliderPill,
                        { flex: 1, paddingVertical: 8, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
                      ]}
                      onPress={handleFullRescanMemory}
                      disabled={isSummarizingMemory}
                      activeOpacity={0.8}
                    >
                      <RotateCw size={13} color="#FFFFFF" />
                      <Text style={[styles.sliderPillText, { color: '#FFFFFF', fontSize: 11, fontWeight: '700' }]}>
                        Full Story Rescan
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={{ color: '#9ca3af', fontSize: 10.5, marginBottom: 6 }}>
                    {!hasValidMemory(chatMemory)
                      ? `No checkpoints saved yet • (${messages.length} messages ready to summarize)`
                      : lastCheckpointIndex >= 0
                      ? `Checkpoint indexed up to turn #${lastCheckpointIndex + 1}${
                          messages.length - 1 > lastCheckpointIndex
                            ? ` • (${messages.length - 1 - lastCheckpointIndex} new turns ready to summarize)`
                            : ' • (All current messages synced)'
                        }`
                      : `Checkpoints active • (${messages.length} total messages)`}
                  </Text>

                  <TextInput
                    style={[
                      styles.personaPersonalityInput,
                      {
                        minHeight: 140,
                        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                        fontSize: 12,
                        lineHeight: 17,
                        borderWidth: 1,
                        borderColor: 'rgba(212, 255, 0, 0.25)',
                      },
                    ]}
                    value={chatMemory}
                    onChangeText={text => {
                      setChatMemory(text);
                      AsyncStorage.setItem(`@nekochat:chat_memory_${character.id}`, text);
                    }}
                    placeholder={`<memory>\n[Checkpoint #1 - The Meeting]\n- Met during the rainstorm.\n- Sloane shared her umbrella.\n- Agreed to travel north together.\n</memory>`}
                    placeholderTextColor="rgba(255, 255, 255, 0.35)"
                    multiline
                    numberOfLines={7}
                    textAlignVertical="top"
                  />

                  {memoryNoticeText ? (
                    <Text
                      style={{
                        color: memoryNoticeText.startsWith('⚠️') ? '#f87171' : '#d4ff00',
                        fontSize: 11.5,
                        fontWeight: '700',
                        marginTop: 4,
                        marginBottom: 4,
                      }}
                    >
                      {memoryNoticeText}
                    </Text>
                  ) : null}
                </View>
              )}

              {/* TAB 2: Per-Chat Model & Temperature Override */}
              {chatControlTab === 'model' && (
                <View style={{ paddingHorizontal: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={styles.personaEditorLabel}>ACTIVE AI ENGINE MODEL</Text>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      onPress={handleFetchChatModels}
                      disabled={loadingChatModels}
                    >
                      <RotateCw size={12} color="#d4ff00" />
                      <Text style={{ color: '#d4ff00', fontSize: 11, fontWeight: '700' }}>
                        {loadingChatModels ? 'Loading...' : 'Fetch Endpoint Models'}
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

                  <Text style={styles.personaEditorLabel}>OR ENTER CUSTOM MODEL ID FOR THIS CHAT</Text>
                  <TextInput
                    style={[styles.personaNameInput, { marginBottom: 14 }]}
                    value={chatModel}
                    onChangeText={v => handleSelectModel(v)}
                    placeholder={config?.model || 'e.g. deepseek-chat, gpt-4o, anthropic/claude-3.5-sonnet'}
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    autoCapitalize="none"
                  />

                  <Text style={styles.personaEditorLabel}>TEMPERATURE / CREATIVITY</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
                    {[
                      { val: 0.3, label: '0.3 Strict' },
                      { val: 0.7, label: '0.7 RP' },
                      { val: 1.0, label: '1.0 Creative' },
                      { val: 1.3, label: '1.3 Wild' },
                    ].map(t => (
                      <TouchableOpacity
                        key={t.val}
                        style={[
                          styles.sliderPill,
                          chatTemperature === t.val && styles.sliderPillActive,
                          { flex: 1, paddingVertical: 8, alignItems: 'center' },
                        ]}
                        onPress={() => handleSelectTemperature(t.val)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.sliderPillText, chatTemperature === t.val && styles.sliderPillTextActive, { fontSize: 10.5 }]}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* TAB 3: Text & Syntax Customization */}
              {chatControlTab === 'syntax' && (
                <View style={{ paddingHorizontal: 20 }}>
                  <Text style={styles.personaEditorLabel}>SPOKEN DIALOGUE COLOR (Quotes "...")</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                    {['#FFFFFF', '#d4ff00', '#38bdf8', '#fb7185', '#facc15'].map(col => (
                      <TouchableOpacity
                        key={col}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: col,
                          borderWidth: syntaxColors.dialogue === col ? 3 : 1,
                          borderColor: syntaxColors.dialogue === col ? '#FFFFFF' : 'rgba(255,255,255,0.2)',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                        onPress={() => handleUpdateSyntaxColors({ dialogue: col })}
                        activeOpacity={0.8}
                      >
                        {syntaxColors.dialogue === col && <Check size={14} color="#000000" />}
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.personaEditorLabel}>ACTION / NARRATION COLOR (*asterisks*)</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                    {['#94A3B8', '#cbd5e1', '#a3e635', '#64748b', '#e2e8f0'].map(col => (
                      <TouchableOpacity
                        key={col}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: col,
                          borderWidth: syntaxColors.narration === col ? 3 : 1,
                          borderColor: syntaxColors.narration === col ? '#FFFFFF' : 'rgba(255,255,255,0.2)',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                        onPress={() => handleUpdateSyntaxColors({ narration: col })}
                        activeOpacity={0.8}
                      >
                        {syntaxColors.narration === col && <Check size={14} color="#000000" />}
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.personaEditorLabel}>INNER THOUGHTS COLOR (`backticks`)</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                    {['#38BDF8', '#c084fc', '#facc15', '#34d399', '#f472b6'].map(col => (
                      <TouchableOpacity
                        key={col}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: col,
                          borderWidth: syntaxColors.thoughts === col ? 3 : 1,
                          borderColor: syntaxColors.thoughts === col ? '#FFFFFF' : 'rgba(255,255,255,0.2)',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                        onPress={() => handleUpdateSyntaxColors({ thoughts: col })}
                        activeOpacity={0.8}
                      >
                        {syntaxColors.thoughts === col && <Check size={14} color="#000000" />}
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.personaEditorLabel, { marginTop: 6 }]}>READING VIEW LAYOUT</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.sliderPill, chatStyle === 'bubble' && styles.sliderPillActive, { flex: 1, paddingVertical: 8, alignItems: 'center' }]}
                      onPress={() => {
                        setChatStyle('bubble');
                        AsyncStorage.setItem('@nekochat:chat_style', 'bubble');
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.sliderPillText, chatStyle === 'bubble' && styles.sliderPillTextActive]}>
                        💬 Chat Bubbles
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.sliderPill, chatStyle === 'novel' && styles.sliderPillActive, { flex: 1, paddingVertical: 8, alignItems: 'center' }]}
                      onPress={() => {
                        setChatStyle('novel');
                        AsyncStorage.setItem('@nekochat:chat_style', 'novel');
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.sliderPillText, chatStyle === 'novel' && styles.sliderPillTextActive]}>
                        📖 Novel View
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              </Animated.View>
            </ScrollView>

            <TouchableOpacity
              style={styles.appearanceDoneBtn}
              onPress={() => {
                AsyncStorage.setItem(`@nekochat:chat_memory_${character.id}`, chatMemory);
                setShowChatControlModal(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.appearanceDoneText}>Apply & Close</Text>
            </TouchableOpacity>
      </BottomSheetModal>
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
    backgroundColor: 'rgba(212, 255, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSessionBtn: {
    padding: 8,
    backgroundColor: 'rgba(212, 255, 0, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.25)',
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
    backgroundColor: 'rgba(212, 255, 0, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.2)',
  },
  scenarioPillText: {
    color: '#D4FF00',
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 240,
  },
  greetingCyclerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 255, 0, 0.06)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 255, 0, 0.15)',
  },
  greetingCyclerText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  greetingCycleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 255, 0, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  greetingCycleBtnText: {
    color: '#D4FF00',
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
    backgroundColor: colors.lime,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomLeftRadius: 4,
  },
  bubbleSelected: {
    borderColor: colors.lime,
    borderWidth: 1.5,
  },
  bubbleUserText: {
    color: '#000000',
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
    backgroundColor: '#1C2232',
    padding: 4,
    borderRadius: 12,
    marginTop: 6,
    gap: 8,
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
    backgroundColor: 'rgba(212, 255, 0, 0.05)',
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
    borderColor: 'rgba(212, 255, 0, 0.35)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  novelAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.35)',
    backgroundColor: 'rgba(212, 255, 0, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  novelAvatarFallbackText: {
    color: '#d4ff00',
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
    borderTopColor: 'rgba(212, 255, 0, 0.3)',
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
    backgroundColor: 'rgba(212, 255, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#d4ff00',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  modeIndicatorText: {
    color: '#d4ff00',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  actionDeckOoc: {
    color: '#d4ff00',
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
    shadowColor: '#d4ff00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  unifiedComposerCardExpanded: {
    borderColor: '#d4ff00',
    minHeight: 280,
    ...(Platform.OS === 'web' ? { height: 280 } : {}),
  },
  unifiedTextInput: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    minHeight: 52,
    maxHeight: 160,
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
    backgroundColor: '#d4ff00',
    borderColor: '#d4ff00',
  },
  personaAvatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#d4ff00',
    backgroundColor: '#12151e',
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
    color: '#d4ff00',
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
    backgroundColor: 'rgba(212, 255, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnLime: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#d4ff00',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#d4ff00',
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
    backgroundColor: 'rgba(212, 255, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.25)',
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
    borderColor: 'rgba(212, 255, 0, 0.3)',
    backgroundColor: 'rgba(212, 255, 0, 0.06)',
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
    color: '#D4FF00',
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
    borderColor: 'rgba(212, 255, 0, 0.25)',
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
    backgroundColor: 'rgba(212, 255, 0, 0.15)',
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
    borderColor: 'rgba(212, 255, 0, 0.3)',
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
    backgroundColor: '#12151e',
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
    backgroundColor: '#12151e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.25)',
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
    color: '#d4ff00',
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
    backgroundColor: '#d4ff00',
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 6,
  },
  uploadWallpaperText: {
    color: '#0c0e14',
    fontSize: 13,
    fontWeight: '800',
  },
  resetWallpaperBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  resetWallpaperText: {
    color: '#d4ff00',
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
    backgroundColor: '#d4ff00',
    borderColor: '#d4ff00',
  },
  sliderPillText: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '700',
  },
  sliderPillTextActive: {
    color: '#0c0e14',
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
    backgroundColor: '#d4ff00',
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
    backgroundColor: '#d4ff00',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 14,
  },
  appearanceDoneText: {
    color: '#0c0e14',
    fontSize: 14,
    fontWeight: '800',
  },
  personaEditorLabel: {
    color: '#d4ff00',
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
    borderColor: '#d4ff00',
    backgroundColor: 'rgba(212, 255, 0, 0.08)',
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
    borderColor: 'rgba(212, 255, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  personaSwitchInitial: {
    color: '#d4ff00',
    fontSize: 14,
    fontWeight: '800',
  },
  personaSwitchName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  personaSwitchNameActive: {
    color: '#d4ff00',
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
    borderTopColor: 'rgba(212, 255, 0, 0.3)',
  },
  charProfileBannerBox: {
    width: '100%',
    height: 190,
    position: 'relative',
    backgroundColor: '#0c0e14',
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
    color: '#d4ff00',
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
    borderColor: 'rgba(212, 255, 0, 0.3)',
  },
  tokenText: {
    color: '#d4ff00',
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
    borderColor: 'rgba(212, 255, 0, 0.35)',
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
    color: '#d4ff00',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  checkpointTagBadge: {
    backgroundColor: 'rgba(212, 255, 0, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.25)',
  },
  checkpointTagBadgeText: {
    color: '#d4ff00',
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
    color: '#d4ff00',
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
    backgroundColor: '#d4ff00',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  checkpointPinBtnText: {
    color: '#0c0e14',
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
    borderColor: 'rgba(212, 255, 0, 0.2)',
  },
  checkpointCopyBtnText: {
    color: '#d4ff00',
    fontSize: 11,
    fontWeight: '700',
  },
});
