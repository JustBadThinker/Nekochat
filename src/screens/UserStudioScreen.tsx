/**
 * User Studio Screen
 * Dedicated user workspace featuring:
 * 1. My Character Cards: User-created cards with creator controls, edit, chat, and JSON export.
 * 2. My Personas: Full persona roster with photo upload/compression, editing, and default persona switcher.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { GLASS } from '../theme/glassTheme';
import { useTheme } from '../theme/ThemeContext';
import { UiSkinTokens, getCardSurfaceStyle, getScreenBg } from '../theme/skins';
import { useTranslation } from '../i18n/LanguageContext';
import { BottomSheetModal } from '../components/BottomSheetModal';
import { AnimatedTabTransition } from '../components/SmoothTransition';
import {
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  Check,
  Upload,
  MessageSquare,
  Layers,
  User,
  X,
  Download,
  Globe,
  FileText,
  AlertCircle,
  BookOpen,
  HelpCircle,
} from 'lucide-react-native';
import { Character, Persona, Lorebook, LorebookEntry } from '../types';
import { storageService } from '../services/storageService';
import { characterImportService } from '../services/characterImportService';
import { parseJanitorLorebookJson } from '../services/lorebookService';
import { compressImageFile, ANIME_DEFAULT_FALLBACK } from '../utils/imageUtils';
import { ThemePalette } from '../theme/colors';
import { CharacterCreatorScreen } from './CharacterCreatorScreen';
import { HelpCenterModal } from '../components/HelpCenterModal';

interface UserStudioScreenProps {
  onStartChat: (character: Character) => void;
  activePersona: Persona;
  onUpdateActivePersona: (persona: Persona) => void;
  onScrollDirectionChange?: (visible: boolean) => void;
}

export const UserStudioScreen: React.FC<UserStudioScreenProps> = ({
  onStartChat,
  activePersona,
  onUpdateActivePersona,
  onScrollDirectionChange,
}) => {
  const lastScrollYRef = useRef(0);
  const { palette, skin } = useTheme();
  const styles = useMemo(() => createStyles(palette, skin), [palette, skin]);
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'cards' | 'personas' | 'lorebooks'>('cards');
  const [userCharacters, setUserCharacters] = useState<Character[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [lorebooks, setLorebooks] = useState<Lorebook[]>([]);
  const [helpLorebookVisible, setHelpLorebookVisible] = useState(false);

  // Character Modal State
  const [charModalVisible, setCharModalVisible] = useState(false);
  const [creatorDraftChar, setCreatorDraftChar] = useState<Character | null>(null);

  // Persona Modal State
  const [personaModalVisible, setPersonaModalVisible] = useState(false);
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);
  const [personaName, setPersonaName] = useState('');
  const [personaPronouns, setPersonaPronouns] = useState('');
  const [personaAvatar, setPersonaAvatar] = useState('');
  const [personaDescription, setPersonaDescription] = useState('');
  const [personaAppearance, setPersonaAppearance] = useState('');
  const [personaPersonality, setPersonaPersonality] = useState('');
  const [personaLorebookIds, setPersonaLorebookIds] = useState<string[]>([]);
  const [isPersonaDefault, setIsPersonaDefault] = useState(false);

  // JanitorAI Lorebook JSON Paste-Import State
  const [loreImportVisible, setLoreImportVisible] = useState(false);
  const [loreImportTitle, setLoreImportTitle] = useState('');
  const [loreImportJson, setLoreImportJson] = useState('');
  const [loreImportError, setLoreImportError] = useState<string | null>(null);

  // Lorebook Modal State
  const [lorebookModalVisible, setLorebookModalVisible] = useState(false);
  const [editingLorebookId, setEditingLorebookId] = useState<string | null>(null);
  const [lbTitle, setLbTitle] = useState('');
  const [lbDescription, setLbDescription] = useState('');
  const [lbScanDepth, setLbScanDepth] = useState('2');
  const [lbTokenBudget, setLbTokenBudget] = useState('1024');
  const [lbEntries, setLbEntries] = useState<LorebookEntry[]>([]);

  // File Upload Helper
  const [isUploading, setIsUploading] = useState(false);

  // Character Import Modal State
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importMode, setImportMode] = useState<'text' | 'url'>('text');
  const [importRawText, setImportRawText] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const applyImportedCardData = (data: any) => {
    setCreatorDraftChar({
      id: '',
      name: data.name || '',
      tagline: data.subtitle || data.shortDescription || 'Roleplay Companion',
      description: data.shortDescription || data.background || '',
      avatar: data.avatarUrl || ANIME_DEFAULT_FALLBACK,
      personality: data.personality || '',
      scenario: data.background || '',
      systemPrompt: data.systemPrompt || data.exampleDialogue || '',
      firstMessage: data.firstMessage || '',
      tags: data.tags || ['Anime', 'Roleplay'],
      creator: '@User',
      isUserCreated: true,
      contentRating: data.contentRating || 'SFW',
      totalChats: 0,
      lastActive: Date.now(),
    });

    setImportModalVisible(false);
    setImportRawText('');
    setImportUrl('');
    setCharModalVisible(true);
  };

  const handlePickCharacterFile = async () => {
    setImportError(null);
    setImportLoading(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'image/png', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) {
        return;
      }
      const file = picked.assets[0];
      const lowerName = (file.name || '').toLowerCase();
      const isPng = lowerName.endsWith('.png') || file.mimeType === 'image/png';

      let res;
      if (isPng) {
        if (Platform.OS === 'web' && (file as any).file) {
          res = await characterImportService.parsePngCard((file as any).file);
        } else if (file.uri) {
          const base64 = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          res = await characterImportService.parsePngCard(base64);
        } else {
          setImportError('Unable to read selected PNG file.');
          return;
        }
      } else {
        let content = '';
        if (Platform.OS === 'web' && (file as any).file) {
          content = await (file as any).file.text();
        } else if (file.uri) {
          content = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
        }
        if (!content.trim()) {
          setImportError('Selected file is empty.');
          return;
        }
        res = characterImportService.parseManualText(content.trim());
      }

      if (res.success && res.data) {
        applyImportedCardData(res.data);
      } else {
        setImportError(res.error || 'Failed to parse character file.');
      }
    } catch (err: any) {
      setImportError(err?.message || 'Error reading character file.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportSubmit = async () => {
    setImportError(null);
    setImportLoading(true);
    try {
      let res;
      if (importMode === 'url') {
        if (!importUrl.trim()) {
          setImportError('Please enter a community character URL.');
          setImportLoading(false);
          return;
        }
        res = await characterImportService.fetchCommunityCharacter(importUrl.trim());
      } else {
        if (!importRawText.trim()) {
          setImportError('Please paste JSON card or W++ character text.');
          setImportLoading(false);
          return;
        }
        res = characterImportService.parseManualText(importRawText.trim());
      }

      if (res.success && res.data) {
        applyImportedCardData(res.data);
      } else {
        setImportError(res.error || 'Failed to parse character data.');
      }
    } catch (err: any) {
      setImportError(err.message || 'Error importing character.');
    } finally {
      setImportLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const chars = await storageService.getUserCharacters();
      setUserCharacters(chars);
      const pers = await storageService.getPersonas();
      setPersonas(pers);
      const lbs = await storageService.getLorebooks();
      setLorebooks(lbs);
    } catch {}
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Image Upload Handler (Web File Input + Native Expo ImagePicker) ---
  const handleTriggerUpload = async (_target: 'char' | 'persona') => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          setIsUploading(true);
          try {
            const compressed = await compressImageFile(file, 320);
            setPersonaAvatar(compressed);
          } catch {
            alert('Failed to process image');
          } finally {
            setIsUploading(false);
          }
        }
      };
      input.click();
      return;
    }

    setIsUploading(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Needed', 'Please allow photo library access to upload an image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setPersonaAvatar(uri);
      }
    } catch (err) {
      console.warn('Image picker error:', err);
      Alert.alert('Upload Error', 'Could not pick image from library.');
    } finally {
      setIsUploading(false);
    }
  };

  // --- Character Modal Handlers ---
  const handleOpenCreateChar = () => {
    setCreatorDraftChar(null);
    setCharModalVisible(true);
  };

  const handleOpenEditChar = (char: Character) => {
    setCreatorDraftChar(char);
    setCharModalVisible(true);
  };

  const handleDeleteCharacter = async (id: string) => {
    if (confirm('Are you sure you want to delete this custom character?')) {
      await storageService.deleteUserCharacter(id);
      await loadData();
    }
  };

  // --- Persona Modal Handlers ---
  const handleOpenCreatePersona = () => {
    setEditingPersonaId(null);
    setPersonaName('');
    setPersonaPronouns('they/them');
    setPersonaAvatar(ANIME_DEFAULT_FALLBACK);
    setPersonaDescription('');
    setPersonaAppearance('');
    setPersonaPersonality('');
    setPersonaLorebookIds([]);
    setIsPersonaDefault(personas.length === 0);
    setPersonaModalVisible(true);
  };

  const handleOpenEditPersona = (pers: Persona) => {
    setEditingPersonaId(pers.id);
    setPersonaName(pers.name);
    setPersonaPronouns(pers.pronouns || 'they/them');
    setPersonaAvatar(pers.avatar || ANIME_DEFAULT_FALLBACK);
    setPersonaDescription(pers.description || '');
    setPersonaAppearance(pers.appearance || '');
    setPersonaPersonality(pers.personality || '');
    setPersonaLorebookIds(pers.lorebookIds || []);
    setIsPersonaDefault(!!pers.isDefault);
    setPersonaModalVisible(true);
  };

  const handleSavePersona = async () => {
    if (!personaName.trim()) {
      alert('Please provide a persona name.');
      return;
    }

    const persona: Persona = {
      id: editingPersonaId || `persona_${Date.now()}`,
      name: personaName.trim(),
      pronouns: personaPronouns.trim(),
      avatar: personaAvatar.trim() || ANIME_DEFAULT_FALLBACK,
      description: personaDescription.trim() || 'An observant companion.',
      appearance: personaAppearance.trim() || undefined,
      personality: personaPersonality.trim() || undefined,
      lorebookIds: personaLorebookIds.length > 0 ? personaLorebookIds : undefined,
      isDefault: isPersonaDefault,
    };

    await storageService.upsertPersona(persona);
    if (isPersonaDefault) {
      await storageService.setDefaultPersona(persona.id);
    }
    if (isPersonaDefault || persona.id === activePersona?.id) {
      onUpdateActivePersona(persona);
    }
    await loadData();
    setPersonaModalVisible(false);
  };

  const handleSetDefaultPersona = async (pers: Persona) => {
    await storageService.setDefaultPersona(pers.id);
    onUpdateActivePersona(pers);
    await loadData();
  };

  const handleDeletePersona = async (id: string) => {
    if (personas.length <= 1) {
      alert('You must maintain at least one persona profile.');
      return;
    }
    if (confirm('Are you sure you want to delete this persona?')) {
      await storageService.deletePersona(id);
      await loadData();
    }
  };

  // --- Lorebook Codex Handlers ---
  const handleOpenCreateLorebook = () => {
    setEditingLorebookId(null);
    setLbTitle('');
    setLbDescription('');
    setLbScanDepth('2');
    setLbTokenBudget('1024');
    setLbEntries([]);
    setLorebookModalVisible(true);
  };

  const handleOpenEditLorebook = (lb: Lorebook) => {
    setEditingLorebookId(lb.id);
    setLbTitle(lb.title);
    setLbDescription(lb.description || '');
    setLbScanDepth(String(lb.scanDepth || 2));
    setLbTokenBudget(String(lb.tokenBudget || 1024));
    setLbEntries(lb.entries || []);
    setLorebookModalVisible(true);
  };

  const handleAddLorebookEntry = () => {
    const newEntry: LorebookEntry = {
      id: `entry_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      title: `Codex Entry #${lbEntries.length + 1}`,
      keys: [],
      content: '',
      priority: 10,
      enabled: true,
    };
    setLbEntries([...lbEntries, newEntry]);
  };

  const handleUpdateLorebookEntry = (idx: number, updates: Partial<LorebookEntry>) => {
    const updated = [...lbEntries];
    updated[idx] = { ...updated[idx], ...updates };
    setLbEntries(updated);
  };

  const handleDeleteLorebookEntry = (idx: number) => {
    setLbEntries(lbEntries.filter((_, i) => i !== idx));
  };

  const handleImportLorebookJson = (jsonString: string) => {
    const res = parseJanitorLorebookJson(jsonString, lbTitle.trim() || undefined);
    if (!res.success || !res.lorebook) {
      alert(res.error || 'Could not parse lorebook JSON.');
      return;
    }
    if (!lbTitle.trim()) setLbTitle(res.lorebook.title);
    if (!lbDescription.trim() && res.lorebook.description) setLbDescription(res.lorebook.description);
    setLbEntries(prev => [...prev, ...res.lorebook!.entries]);
    alert(`Successfully imported ${res.lorebook.entries.length} lorebook entries!`);
  };

  const handleSaveLorebook = async () => {
    if (!lbTitle.trim()) {
      alert('Please provide a Lorebook title.');
      return;
    }

    let finalEntries = lbEntries;
    let finalDescription = lbDescription.trim();
    if (
      finalEntries.length === 0 &&
      /^[\[{]|\b(?:var|let|const)\b|context\.(?:chat|character)/.test(finalDescription)
    ) {
      const autoParsed = parseJanitorLorebookJson(finalDescription, lbTitle.trim());
      if (autoParsed.success && autoParsed.lorebook && autoParsed.lorebook.entries.length > 0) {
        finalEntries = autoParsed.lorebook.entries;
        finalDescription = autoParsed.lorebook.description;
      }
    }

    const lorebook: Lorebook = {
      id: editingLorebookId || `lorebook_${Date.now()}`,
      userId: 'user',
      title: lbTitle.trim(),
      description: finalDescription,
      scanDepth: parseInt(lbScanDepth, 10) || 2,
      tokenBudget: parseInt(lbTokenBudget, 10) || 1024,
      recursiveScanning: false,
      entries: finalEntries,
      isPublic: false,
      createdAt: new Date().toISOString(),
    };

    await storageService.upsertLorebook(lorebook);
    await loadData();
    setLorebookModalVisible(false);
  };

  const handleDeleteLorebook = async (id: string) => {
    if (confirm('Are you sure you want to delete this Lorebook codex?')) {
      await storageService.deleteLorebook(id);
      await loadData();
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: getScreenBg(palette, skin) }]}>
      <StatusBar style="light" />

      {/* Screen Title & Segmented Navigation */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('studio.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('studio.subtitle')}</Text>
        </View>

        {/* Tab Segment Switcher */}
        <View style={styles.segmentPill}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'cards' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('cards')}
          >
            <Layers size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
            <Text style={[styles.segmentText, activeTab === 'cards' && styles.segmentTextActive]}>
              {t('studio.cards')} ({userCharacters.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'personas' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('personas')}
          >
            <User size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
            <Text style={[styles.segmentText, activeTab === 'personas' && styles.segmentTextActive]}>
              {t('studio.personas')} ({personas.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'lorebooks' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('lorebooks')}
          >
            <BookOpen size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
            <Text style={[styles.segmentText, activeTab === 'lorebooks' && styles.segmentTextActive]}>
              {t('studio.codex')} ({lorebooks.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
      >
        <AnimatedTabTransition transitionKey={activeTab}>
        {/* ================= TAB 1: MY CARDS ================= */}
        {activeTab === 'cards' && (
          <View>
            {/* Action Row */}
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1, minWidth: 150 }}>
                <Text style={styles.sectionHeading}>{t('studio.myCards')}</Text>
                <Text style={styles.sectionDesc}>{t('studio.myCardsSub')}</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity
                  style={styles.importButton}
                  onPress={() => setImportModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Download size={15} color={palette.accent} style={{ marginRight: 6 }} />
                  <Text style={styles.importButtonText}>{t('studio.import')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={handleOpenCreateChar}
                  activeOpacity={0.8}
                >
                  <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.createButtonText}>{t('studio.createCard')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Empty State */}
            {userCharacters.length === 0 ? (
              <View style={styles.emptyCardBox}>
                <View style={styles.emptyIconCircle}>
                  <Sparkles size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.emptyTitle}>{t('studio.noCards')}</Text>
                <Text style={styles.emptyDesc}>
                  {t('studio.noCardsSub')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={handleOpenCreateChar}
                  >
                    <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.emptyActionBtnText}>{t('studio.createCard')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.emptyActionBtn, { backgroundColor: `rgba(${palette.accentRgb}, 0.12)`, borderColor: `rgba(${palette.accentRgb}, 0.3)` }]}
                    onPress={() => setImportModalVisible(true)}
                  >
                    <Download size={16} color={palette.accent} style={{ marginRight: 6 }} />
                    <Text style={[styles.emptyActionBtnText, { color: palette.accent }]}>{t('studio.importCard')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Character Card List */
              <View style={styles.cardsGrid}>
                {userCharacters.map(char => (
                  <View key={char.id} style={[styles.cardItem, getCardSurfaceStyle(palette, skin)]}>
                    <Image source={{ uri: char.avatar }} style={styles.cardItemBanner} />
                    <View style={styles.cardItemBody}>
                      <View style={styles.cardItemHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardItemName}>{char.name}</Text>
                          <Text style={styles.cardItemTagline} numberOfLines={1}>
                            {char.tagline}
                          </Text>
                        </View>
                        <View style={styles.ratingBadge}>
                          <Text style={styles.ratingBadgeText}>{char.contentRating || 'SFW'}</Text>
                        </View>
                      </View>

                      <Text style={styles.cardItemScenario} numberOfLines={2}>
                        {char.scenario}
                      </Text>

                      {/* Card Tags */}
                      <View style={styles.tagsRow}>
                        {char.tags.slice(0, 3).map((tag, idx) => (
                          <View key={idx} style={styles.tagPill}>
                            <Text style={styles.tagPillText}>#{tag}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Card Actions */}
                      <View style={styles.cardActionsRow}>
                        <TouchableOpacity
                          style={styles.chatNowBtn}
                          onPress={() => onStartChat(char)}
                        >
                          <MessageSquare size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.chatNowBtnText}>Chat Now</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.iconActionBtn}
                          onPress={() => handleOpenEditChar(char)}
                        >
                          <Edit2 size={16} color="#FFFFFF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.iconActionBtn}
                          onPress={() => handleDeleteCharacter(char.id)}
                        >
                          <Trash2 size={16} color="#FF6B6B" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ================= TAB 2: MY PERSONAS ================= */}
        {activeTab === 'personas' && (
          <View>
            {/* Action Row */}
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1, minWidth: 150 }}>
                <Text style={styles.sectionHeading}>User Personas</Text>
                <Text style={styles.sectionDesc}>Select how AI characters perceive you</Text>
              </View>
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleOpenCreatePersona}
                activeOpacity={0.8}
              >
                <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.createButtonText}>Add Persona</Text>
              </TouchableOpacity>
            </View>

            {/* Persona List */}
            <View style={styles.personaList}>
              {personas.map(pers => {
                const isActive = pers.id === activePersona.id || pers.isDefault;
                return (
                  <View
                    key={pers.id}
                    style={[styles.personaItem, isActive && styles.personaItemActive]}
                  >
                    <Image source={{ uri: pers.avatar || ANIME_DEFAULT_FALLBACK }} style={styles.personaAvatar} />

                    <View style={styles.personaInfo}>
                      <View style={styles.personaTitleRow}>
                        <Text style={styles.personaName}>{pers.name}</Text>
                        {pers.pronouns ? (
                          <View style={styles.pronounPill}>
                            <Text style={styles.pronounText}>{pers.pronouns}</Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={styles.personaDesc} numberOfLines={2}>
                        {pers.description || 'No description provided.'}
                      </Text>

                      {isActive && (
                        <View style={styles.activePill}>
                          <Check size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.activePillText}>Active Persona</Text>
                        </View>
                      )}
                    </View>

                    {/* Persona Actions */}
                    <View style={styles.personaActionsCol}>
                      {!isActive && (
                        <TouchableOpacity
                          style={styles.setActiveBtn}
                          onPress={() => handleSetDefaultPersona(pers)}
                        >
                          <Text style={styles.setActiveBtnText}>Select</Text>
                        </TouchableOpacity>
                      )}

                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                        <TouchableOpacity
                          style={styles.iconMiniBtn}
                          onPress={() => handleOpenEditPersona(pers)}
                        >
                          <Edit2 size={14} color="#FFFFFF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.iconMiniBtn}
                          onPress={() => handleDeletePersona(pers.id)}
                        >
                          <Trash2 size={14} color="#FF6B6B" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ================= TAB 3: MY LOREBOOKS ================= */}
        {activeTab === 'lorebooks' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1, minWidth: 150 }}>
                <Text style={styles.sectionHeading}>{t('studio.codexTitle')}</Text>
                <Text style={styles.sectionDesc}>{t('studio.codexSub')}</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity
                  style={styles.importButton}
                  onPress={() => setHelpLorebookVisible(true)}
                  activeOpacity={0.8}
                >
                  <HelpCircle size={14} color={palette.accent} style={{ marginRight: 5 }} />
                  <Text style={styles.importButtonText}>What is a Lorebook?</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.importButton}
                  onPress={() => {
                    setLoreImportTitle('');
                    setLoreImportJson('');
                    setLoreImportError(null);
                    setLoreImportVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Upload size={14} color={palette.accent} style={{ marginRight: 5 }} />
                  <Text style={styles.importButtonText}>Import Janitor JSON</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={handleOpenCreateLorebook}
                  activeOpacity={0.8}
                >
                  <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.createButtonText}>{t('studio.addLorebook')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {lorebooks.length === 0 ? (
              <View style={styles.emptyCardBox}>
                <View style={styles.emptyIconCircle}>
                  <BookOpen size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.emptyTitle}>{t('studio.noLorebooks')}</Text>
                <Text style={styles.emptyDesc}>
                  {t('studio.codexSub')}
                </Text>
                <TouchableOpacity
                  style={[styles.createButton, { marginTop: 12 }]}
                  onPress={handleOpenCreateLorebook}
                >
                  <Text style={styles.createButtonText}>{t('studio.createFirstLorebook')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.personaList}>
                {lorebooks.map(lb => (
                  <View key={lb.id} style={styles.lorebookCard}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Text style={styles.lorebookTitle}>{lb.title}</Text>
                        <View style={styles.lorebookBadge}>
                          <Text style={styles.lorebookBadgeText}>
                            {lb.entries?.length || 0} entries
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.lorebookDesc} numberOfLines={2}>
                        {lb.description || 'No description provided.'}
                      </Text>
                      <Text style={styles.lorebookMeta}>
                        Scan Depth: {lb.scanDepth || 2} turns • Budget: {lb.tokenBudget || 1024} tokens
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 6, marginLeft: 8 }}>
                      <TouchableOpacity
                        style={styles.iconMiniBtn}
                        onPress={() => handleOpenEditLorebook(lb)}
                      >
                        <Edit2 size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconMiniBtn}
                        onPress={() => handleDeleteLorebook(lb.id)}
                      >
                        <Trash2 size={14} color="#FF6B6B" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
        </AnimatedTabTransition>
      </ScrollView>

      {/* ================= MODAL: IMPORT CHARACTER ================= */}
      <BottomSheetModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
        sheetStyle={{ maxHeight: '90%' }}
      >
        <View style={styles.modalHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Download size={18} color={palette.accent} />
            <Text style={styles.modalTitle}>{t('studio.importModalTitle')}</Text>
          </View>
          <TouchableOpacity onPress={() => setImportModalVisible(false)}>
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
          {/* Import Mode Tabs */}
          <View style={styles.segmentPill}>
            <TouchableOpacity
              style={[styles.segmentBtn, importMode === 'text' && styles.segmentBtnActive]}
              onPress={() => setImportMode('text')}
            >
              <FileText size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={[styles.segmentText, importMode === 'text' && styles.segmentTextActive]}>
                JSON / W++ Text
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, importMode === 'url' && styles.segmentBtnActive]}
              onPress={() => setImportMode('url')}
            >
              <Globe size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={[styles.segmentText, importMode === 'url' && styles.segmentTextActive]}>
                Community URL
              </Text>
            </TouchableOpacity>
          </View>

          {importMode === 'text' ? (
            <View style={{ marginTop: 16 }}>
              <TouchableOpacity
                style={[
                  styles.saveSubmitBtn,
                  {
                    marginBottom: 14,
                    backgroundColor: `rgba(${palette.accentRgb}, 0.14)`,
                    borderWidth: 1,
                    borderColor: `rgba(${palette.accentRgb}, 0.45)`,
                  },
                ]}
                onPress={handlePickCharacterFile}
                disabled={importLoading}
                activeOpacity={0.8}
              >
                <Upload size={16} color={palette.accent} style={{ marginRight: 8 }} />
                <Text style={[styles.saveSubmitBtnText, { color: palette.accent }]}>
                  {t('studio.uploadFileBtn')}
                </Text>
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>{t('studio.orPaste')}</Text>
              <TextInput
                style={[styles.textInput, { height: 160, textAlignVertical: 'top' }]}
                placeholder={`Paste Character Card JSON (V1, V2, V3, Tavern, Warden) or manual W++ text:\n\nName: Luna\nPersonality: Playful and energetic...\nScenario: Lost in the cyber city...\nFirst Message: "Hey there! Need a hand?"`}
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                multiline
                value={importRawText}
                onChangeText={setImportRawText}
              />
              <Text style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: 11, marginTop: 4 }}>
                Supports Chara Card V1/V2/V3, SillyTavern, JanitorAI format, and raw roleplay prompts.
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.fieldLabel}>Community Character URL</Text>
              <TextInput
                style={styles.textInput}
                placeholder="https://datacat.run/characters/... or jannyai.com/..."
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                value={importUrl}
                onChangeText={setImportUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Text style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: 11, marginTop: 4 }}>
                Enter a public character URL from Datacat, JannyAI, or JanitorAI.
              </Text>
            </View>
          )}

          {importError && (
            <View style={styles.errorBanner}>
              <AlertCircle size={16} color="#FF6B6B" style={{ marginRight: 6 }} />
              <Text style={styles.errorBannerText}>{importError}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveSubmitBtn, { marginTop: 24, backgroundColor: palette.accent }]}
            onPress={handleImportSubmit}
            disabled={importLoading}
            activeOpacity={0.8}
          >
            {importLoading ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <>
                <Download size={16} color="#000000" style={{ marginRight: 6 }} />
                <Text style={[styles.saveSubmitBtnText, { color: '#000000' }]}>
                  {t('studio.parseLoad')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </BottomSheetModal>

      {/* ================= FULL-SCREEN PAGE: CREATE / EDIT CHARACTER ================= */}
      <CharacterCreatorScreen
        visible={charModalVisible}
        editingCharacter={creatorDraftChar}
        fallbackAvatar={ANIME_DEFAULT_FALLBACK}
        onCancel={() => setCharModalVisible(false)}
        onSave={async nextChar => {
          await storageService.upsertUserCharacter(nextChar);
          await storageService.upsertCharacter(nextChar);
          await loadData();
          setCharModalVisible(false);
        }}
      />

      {/* ================= MODAL: IMPORT JANITORAI LOREBOOK JSON ================= */}
      <BottomSheetModal
        visible={loreImportVisible}
        onClose={() => setLoreImportVisible(false)}
        sheetStyle={{ maxHeight: '88%' }}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Import JanitorAI Lorebook / Script JSON</Text>
          <TouchableOpacity onPress={() => setLoreImportVisible(false)}>
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Lorebook Title (Optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Cyberpunk World Lore"
            placeholderTextColor="#666"
            value={loreImportTitle}
            onChangeText={setLoreImportTitle}
          />
          <Text style={styles.fieldLabel}>Paste JanitorAI Lorebook JSON or JS Script *</Text>
          <TextInput
            style={[styles.textInput, styles.textArea, { minHeight: 160 }]}
            placeholder={'Paste JanitorAI Lorebook JSON or JS Script (var ... = context.chat...)'}
            placeholderTextColor="#666"
            multiline
            value={loreImportJson}
            onChangeText={v => {
              setLoreImportJson(v);
              setLoreImportError(null);
            }}
          />
          {loreImportError ? (
            <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
              {loreImportError}
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.saveSubmitBtn}
            onPress={async () => {
              const res = parseJanitorLorebookJson(loreImportJson, loreImportTitle);
              if (!res.success || !res.lorebook) {
                setLoreImportError(res.error || 'Could not parse lorebook JSON.');
                return;
              }
              await storageService.upsertLorebook(res.lorebook);
              await loadData();
              setLoreImportVisible(false);
            }}
          >
            <Text style={styles.saveSubmitBtnText}>Import to Codex</Text>
          </TouchableOpacity>
        </ScrollView>
      </BottomSheetModal>

      {/* ================= MODAL: ADD / EDIT PERSONA ================= */}
      <BottomSheetModal
        visible={personaModalVisible}
        onClose={() => setPersonaModalVisible(false)}
        sheetStyle={{ maxHeight: '90%' }}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {editingPersonaId ? 'Edit Persona' : 'Add New Persona'}
          </Text>
          <TouchableOpacity onPress={() => setPersonaModalVisible(false)}>
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
          {/* Persona Avatar Preview & Upload */}
          <View style={styles.uploadRow}>
            <Image source={{ uri: personaAvatar || ANIME_DEFAULT_FALLBACK }} style={styles.uploadPreviewRound} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.fieldLabel}>Persona Avatar</Text>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => handleTriggerUpload('persona')}
              >
                <Upload size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.uploadButtonText}>
                  {isUploading ? 'Compressing...' : 'Upload Photo'}
                </Text>
              </TouchableOpacity>
              <TextInput
                style={[styles.textInput, { marginTop: 8 }]}
                placeholder="Or enter image URL..."
                placeholderTextColor="#666"
                value={personaAvatar}
                onChangeText={setPersonaAvatar}
              />
            </View>
          </View>

          {/* Persona Name */}
          <Text style={styles.fieldLabel}>Persona Display Name *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Master, Sensei, Ren, Detective"
            placeholderTextColor="#666"
            value={personaName}
            onChangeText={setPersonaName}
          />

          {/* Pronouns / Role */}
          <Text style={styles.fieldLabel}>Pronouns / Title</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. he/him, Master, Adventurer"
            placeholderTextColor="#666"
            value={personaPronouns}
            onChangeText={setPersonaPronouns}
          />

          {/* Persona Description */}
          <Text style={styles.fieldLabel}>Persona Description (Backstory, Appearance, Personality & RP Traits)</Text>
          <TextInput
            style={[styles.textInput, styles.textArea, { minHeight: 120 }]}
            placeholder="Describe your character's backstory, appearance, personality, mannerisms, and roleplay traits..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={6}
            value={personaDescription}
            onChangeText={setPersonaDescription}
          />

          {/* Attached Codex Lorebooks for this Persona */}
          {lorebooks.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.fieldLabel}>Codex Lorebooks for this Persona</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {lorebooks.map(lb => {
                  const active = personaLorebookIds.includes(lb.id);
                  return (
                    <TouchableOpacity
                      key={lb.id}
                      onPress={() =>
                        setPersonaLorebookIds(prev =>
                          prev.includes(lb.id) ? prev.filter(x => x !== lb.id) : [...prev, lb.id]
                        )
                      }
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: active ? palette.accent : 'rgba(255,255,255,0.14)',
                        backgroundColor: active ? `rgba(${palette.accentRgb}, 0.16)` : 'rgba(255,255,255,0.04)',
                      }}
                    >
                      <Text style={{ color: active ? palette.accent : '#cbd5e1', fontSize: 12, fontWeight: '700' }}>
                        {active ? '✓ ' : ''}{lb.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Set as Default Toggle */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setIsPersonaDefault(!isPersonaDefault)}
          >
            <View style={[styles.checkboxBox, isPersonaDefault && styles.checkboxBoxActive]}>
              {isPersonaDefault && <Check size={14} color="#FFFFFF" />}
            </View>
            <Text style={styles.checkboxLabel}>Set as Default Active Persona</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleSavePersona}>
            <Text style={styles.saveSubmitBtnText}>Save Persona</Text>
          </TouchableOpacity>
        </ScrollView>
      </BottomSheetModal>

      {/* ================= MODAL: ADD / EDIT LOREBOOK ================= */}
      <BottomSheetModal
        visible={lorebookModalVisible}
        onClose={() => setLorebookModalVisible(false)}
        sheetStyle={{ maxHeight: '90%' }}
      >
        <View style={styles.modalHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <BookOpen size={18} color={palette.accent} />
            <Text style={styles.modalTitle}>
              {editingLorebookId ? 'Edit Codex Lorebook' : 'New Codex Lorebook'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setLorebookModalVisible(false)}>
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
          <Text style={styles.fieldLabel}>Lorebook Title *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. World of Eldoria, Guild Rules, Magic System"
            placeholderTextColor="#666"
            value={lbTitle}
            onChangeText={setLbTitle}
          />

          <Text style={styles.fieldLabel}>Codex Summary / Description</Text>
          <TextInput
            style={[styles.textInput, styles.textArea, { minHeight: 48 }]}
            placeholder="Brief summary of lore topics covered in this codex..."
            placeholderTextColor="#666"
            multiline
            value={lbDescription}
            onChangeText={setLbDescription}
          />

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Scan Depth (turns)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="2"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={lbScanDepth}
                onChangeText={setLbScanDepth}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Token Budget</Text>
              <TextInput
                style={styles.textInput}
                placeholder="1024"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={lbTokenBudget}
                onChangeText={setLbTokenBudget}
              />
            </View>
          </View>

          {/* Entries Section */}
          <View style={[styles.subSectionHeader, { marginTop: 16 }]}>
            <Text style={styles.subSectionTitle}>
              Codex Keyword Entries ({lbEntries.length})
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                style={[styles.addMiniBtn, { backgroundColor: `rgba(${palette.accentRgb}, 0.12)`, borderColor: `rgba(${palette.accentRgb}, 0.4)` }]}
                onPress={async () => {
                  try {
                    const picked = await DocumentPicker.getDocumentAsync({
                      type: ['application/json', '*/*'],
                      copyToCacheDirectory: true,
                    });
                    if (picked.canceled || !picked.assets?.[0]) return;
                    const file = picked.assets[0];
                    let content = '';
                    if (Platform.OS === 'web' && (file as any).file) {
                      content = await (file as any).file.text();
                    } else if (file.uri) {
                      content = await FileSystem.readAsStringAsync(file.uri, {
                        encoding: FileSystem.EncodingType.UTF8,
                      });
                    }
                    if (content) handleImportLorebookJson(content);
                  } catch { }
                }}
                activeOpacity={0.8}
                accessibilityLabel="Import JanitorAI or SillyTavern Lorebook JSON"
              >
                <Download size={13} color={palette.accent} style={{ marginRight: 4 }} />
                <Text style={styles.addMiniBtnText}>Import JSON</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.addMiniBtn}
                onPress={handleAddLorebookEntry}
                activeOpacity={0.8}
              >
                <Plus size={13} color={palette.accent} style={{ marginRight: 4 }} />
                <Text style={styles.addMiniBtnText}>Add Entry</Text>
              </TouchableOpacity>
            </View>
          </View>

          {lbEntries.map((entry, eIdx) => (
            <View key={entry.id} style={styles.subItemCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={styles.subItemIndex}>{entry.title || `Entry #${eIdx + 1}`}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => handleUpdateLorebookEntry(eIdx, { enabled: !entry.enabled })}
                    style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: entry.enabled ? `rgba(${palette.accentRgb}, 0.15)` : 'rgba(255, 255, 255, 0.08)' }}
                  >
                    <Text style={{ color: entry.enabled ? palette.accent : '#888', fontSize: 10, fontWeight: '700' }}>
                      {entry.enabled ? 'ACTIVE' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteLorebookEntry(eIdx)}>
                    <Trash2 size={13} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              </View>
              <TextInput
                style={[styles.textInput, { marginBottom: 6 }]}
                placeholder="Entry Title (e.g. Ancient Ruins of Zeth)"
                placeholderTextColor="#666"
                value={entry.title}
                onChangeText={v => handleUpdateLorebookEntry(eIdx, { title: v })}
              />
              <TextInput
                style={[styles.textInput, { marginBottom: 6 }]}
                placeholder="Trigger Keywords (comma-separated, e.g. Zeth, ruins, ancient shrine)"
                placeholderTextColor="#666"
                value={entry.keys.join(', ')}
                onChangeText={v => handleUpdateLorebookEntry(eIdx, { keys: v.split(',').map(k => k.trim()).filter(Boolean) })}
              />
              <TextInput
                style={[styles.textInput, styles.textArea, { minHeight: 60 }]}
                placeholder="World lore content injected into LLM context when keyword matches..."
                placeholderTextColor="#666"
                multiline
                value={entry.content}
                onChangeText={v => handleUpdateLorebookEntry(eIdx, { content: v })}
              />
            </View>
          ))}

          <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleSaveLorebook}>
            <Text style={styles.saveSubmitBtnText}>Save Codex Lorebook</Text>
          </TouchableOpacity>
        </ScrollView>
      </BottomSheetModal>

      <HelpCenterModal
        visible={helpLorebookVisible}
        onClose={() => setHelpLorebookVisible(false)}
        initialArticleId="lorebooks"
      />
    </SafeAreaView>
  );
};

const createStyles = (palette: ThemePalette, skin: UiSkinTokens) => {
  const screenBg = getScreenBg(palette, skin);
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: screenBg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  segmentPill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: skin.pillRadius + 8,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 20,
  },
  segmentBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  segmentText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionHeading: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionDesc: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    marginTop: 2,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: skin.buttonRadius,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `rgba(${palette.accentRgb}, 0.1)`,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.3)`,
  },
  importButtonText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 80, 80, 0.12)',
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 80, 80, 0.25)',
  },
  errorBannerText: {
    color: '#FF6B6B',
    fontSize: 12,
    flex: 1,
  },
  emptyCardBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderStyle: 'dashed',
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyDesc: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cardsGrid: {
    gap: 16,
  },
  cardItem: {
    backgroundColor: GLASS.bg,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GLASS.borderBright,
    ...GLASS.backdrop,
    ...GLASS.shadow,
  },
  cardItemBanner: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },
  cardItemBody: {
    padding: 14,
  },
  cardItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  cardItemName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cardItemTagline: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginTop: 2,
  },
  ratingBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ratingBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  cardItemScenario: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tagPillText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 10,
  },
  chatNowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  chatNowBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  iconActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  personaList: {
    gap: 12,
  },
  personaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.bgSurface,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1b1e28',
  },
  personaItemActive: {
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: '#151924',
  },
  personaAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#000',
  },
  personaInfo: {
    flex: 1,
    marginLeft: 12,
  },
  personaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  personaName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  pronounPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pronounText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    fontWeight: '600',
  },
  personaDesc: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 11,
    marginTop: 3,
    lineHeight: 16,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  activePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  personaActionsCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  setActiveBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  setActiveBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  iconMiniBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: palette.bgSurface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalBody: {
    padding: 18,
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadPreview: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  uploadPreviewRound: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  fieldLabel: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 13,
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  ratingToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 16,
  },
  ratingToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  ratingToggleBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: '#FFFFFF',
  },
  ratingToggleText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '700',
  },
  ratingToggleTextActive: {
    color: '#FFFFFF',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxBoxActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  checkboxLabel: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  saveSubmitBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  saveSubmitBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  subSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  subSectionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  addMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: `rgba(${palette.accentRgb}, 0.12)`,
  },
  addMiniBtnText: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  subItemCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  subItemIndex: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: '600',
  },
  lorebookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS.bg,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS.borderBright,
    ...GLASS.backdrop,
    ...GLASS.shadow,
  },
  lorebookTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  lorebookBadge: {
    backgroundColor: `rgba(${palette.accentRgb}, 0.15)`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  lorebookBadgeText: {
    color: palette.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  lorebookDesc: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  lorebookMeta: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 10,
    marginTop: 4,
  },
});
};

