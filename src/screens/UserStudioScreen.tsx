/**
 * User Studio Screen
 * Dedicated user workspace featuring:
 * 1. My Character Cards: User-created cards with creator controls, edit, chat, and JSON export.
 * 2. My Personas: Full persona roster with photo upload/compression, editing, and default persona switcher.
 */

import React, { useState, useEffect, useRef , useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  StyleSheet,
  SafeAreaView,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { GLASS } from '../theme/glassTheme';
import { useTheme } from '../theme/ThemeContext';
import { BottomSheetModal } from '../components/BottomSheetModal';
import {
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  Star,
  Check,
  Upload,
  MessageSquare,
  Share2,
  Layers,
  User,
  Shield,
  X,
  Download,
  Globe,
  FileText,
  AlertCircle,
  BookOpen,
} from 'lucide-react-native';
import { Character, CharacterScenario, Persona, ContentRating, Lorebook, LorebookEntry } from '../types';
import { colors } from '../theme/colors';
import { storageService } from '../services/storageService';
import { characterImportService } from '../services/characterImportService';
import { compressImageFile, ANIME_DEFAULT_FALLBACK } from '../utils/imageUtils';
import { ThemePalette } from '../theme/colors';

interface UserStudioScreenProps {
  onStartChat: (character: Character) => void;
  activePersona: Persona;
  onUpdateActivePersona: (persona: Persona) => void;
}

export const UserStudioScreen: React.FC<UserStudioScreenProps> = ({
  onStartChat,
  activePersona,
  onUpdateActivePersona,
}) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [activeTab, setActiveTab] = useState<'cards' | 'personas' | 'lorebooks'>('cards');
  const [userCharacters, setUserCharacters] = useState<Character[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [lorebooks, setLorebooks] = useState<Lorebook[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Character Modal State
  const [charModalVisible, setCharModalVisible] = useState(false);
  const [editingCharId, setEditingCharId] = useState<string | null>(null);
  const [charName, setCharName] = useState('');
  const [charTagline, setCharTagline] = useState('');
  const [charAvatar, setCharAvatar] = useState('');
  const [charPersonality, setCharPersonality] = useState('');
  const [charScenario, setCharScenario] = useState('');
  const [charFirstMessage, setCharFirstMessage] = useState('');
  const [charTags, setCharTags] = useState('Anime, Roleplay');
  const [charRating, setCharRating] = useState<ContentRating>('SFW');
  const [charScenarios, setCharScenarios] = useState<CharacterScenario[]>([]);
  const [charAlternateGreetings, setCharAlternateGreetings] = useState<string[]>([]);

  // Persona Modal State
  const [personaModalVisible, setPersonaModalVisible] = useState(false);
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);
  const [personaName, setPersonaName] = useState('');
  const [personaPronouns, setPersonaPronouns] = useState('');
  const [personaAvatar, setPersonaAvatar] = useState('');
  const [personaDescription, setPersonaDescription] = useState('');
  const [personaAppearance, setPersonaAppearance] = useState('');
  const [personaPersonality, setPersonaPersonality] = useState('');
  const [isPersonaDefault, setIsPersonaDefault] = useState(false);

  // Lorebook Modal State
  const [lorebookModalVisible, setLorebookModalVisible] = useState(false);
  const [editingLorebookId, setEditingLorebookId] = useState<string | null>(null);
  const [lbTitle, setLbTitle] = useState('');
  const [lbDescription, setLbDescription] = useState('');
  const [lbScanDepth, setLbScanDepth] = useState('2');
  const [lbTokenBudget, setLbTokenBudget] = useState('1024');
  const [lbEntries, setLbEntries] = useState<LorebookEntry[]>([]);

  // File Upload Helper
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTarget, setUploadTarget] = useState<'char' | 'persona'>('char');
  const [isUploading, setIsUploading] = useState(false);

  // Character Import Modal State
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importMode, setImportMode] = useState<'text' | 'url'>('text');
  const [importRawText, setImportRawText] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

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
        setCharName(res.data.name);
        setCharTagline(res.data.subtitle || res.data.shortDescription || 'Roleplay Companion');
        setCharAvatar(res.data.avatarUrl || ANIME_DEFAULT_FALLBACK);
        setCharPersonality(res.data.personality);
        setCharScenario(res.data.background);
        setCharFirstMessage(res.data.firstMessage);
        setCharTags(res.data.tags.join(', '));
        setCharRating(res.data.contentRating);
        setEditingCharId(null);

        setImportModalVisible(false);
        setImportRawText('');
        setImportUrl('');
        setCharModalVisible(true);
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
    setIsLoading(true);
    try {
      const chars = await storageService.getUserCharacters();
      setUserCharacters(chars);
      const pers = await storageService.getPersonas();
      setPersonas(pers);
      const lbs = await storageService.getLorebooks();
      setLorebooks(lbs);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Image Upload Handler (Web File Input + Native Expo ImagePicker) ---
  const handleTriggerUpload = async (target: 'char' | 'persona') => {
    setUploadTarget(target);
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
            if (target === 'char') {
              setCharAvatar(compressed);
            } else {
              setPersonaAvatar(compressed);
            }
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
        if (target === 'char') {
          setCharAvatar(uri);
        } else {
          setPersonaAvatar(uri);
        }
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
    setEditingCharId(null);
    setCharName('');
    setCharTagline('');
    setCharAvatar(ANIME_DEFAULT_FALLBACK);
    setCharPersonality('');
    setCharScenario('');
    setCharFirstMessage('');
    setCharTags('Anime, Roleplay');
    setCharRating('SFW');
    setCharScenarios([]);
    setCharAlternateGreetings([]);
    setCharModalVisible(true);
  };

  const handleOpenEditChar = (char: Character) => {
    setEditingCharId(char.id);
    setCharName(char.name);
    setCharTagline(char.tagline);
    setCharAvatar(char.avatar);
    setCharPersonality(char.personality);
    setCharScenario(char.scenario);
    setCharFirstMessage(char.firstMessage);
    setCharTags(char.tags.join(', '));
    setCharRating(char.contentRating || 'SFW');
    setCharScenarios(char.scenarios || []);
    setCharAlternateGreetings(char.alternateGreetings || []);
    setCharModalVisible(true);
  };

  const handleAddCharScenario = () => {
    const newScen: CharacterScenario = {
      id: `scen_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      characterId: editingCharId || 'user_char',
      title: `Scenario #${charScenarios.length + 1}`,
      description: '',
      openingMessage: '',
      scenarioInstructions: '',
      displayOrder: charScenarios.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setCharScenarios([...charScenarios, newScen]);
  };

  const handleUpdateCharScenario = (idx: number, field: keyof CharacterScenario, val: string) => {
    const updated = [...charScenarios];
    updated[idx] = { ...updated[idx], [field]: val };
    setCharScenarios(updated);
  };

  const handleDeleteCharScenario = (idx: number) => {
    setCharScenarios(charScenarios.filter((_, i) => i !== idx));
  };

  const handleAddCharGreeting = () => {
    setCharAlternateGreetings([...charAlternateGreetings, '']);
  };

  const handleUpdateCharGreeting = (idx: number, val: string) => {
    const updated = [...charAlternateGreetings];
    updated[idx] = val;
    setCharAlternateGreetings(updated);
  };

  const handleDeleteCharGreeting = (idx: number) => {
    setCharAlternateGreetings(charAlternateGreetings.filter((_, i) => i !== idx));
  };

  const handleSaveCharacter = async () => {
    if (!charName.trim()) {
      alert('Please provide a character name.');
      return;
    }

    const tagList = charTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const character: Character = {
      id: editingCharId || `user_char_${Date.now()}`,
      name: charName.trim(),
      tagline: charTagline.trim() || 'Custom AI Companion',
      description: charScenario.trim() || charPersonality.trim() || 'A user-created anime companion.',
      avatar: charAvatar.trim() || ANIME_DEFAULT_FALLBACK,
      personality: charPersonality.trim() || 'Warm, attentive, and responsive.',
      scenario: charScenario.trim() || 'Meeting in a comfortable room.',
      firstMessage: charFirstMessage.trim() || `*${charName} looks up and greets you.* "Hello."`,
      tags: tagList.length > 0 ? tagList : ['Anime', 'Custom'],
      creator: '@User',
      isUserCreated: true,
      contentRating: charRating,
      scenarios: charScenarios.filter(s => s.title.trim()),
      alternateGreetings: charAlternateGreetings.filter(g => g.trim()),
      totalChats: 0,
      lastActive: Date.now(),
      isFavorite: false,
    };

    await storageService.upsertUserCharacter(character);
    await storageService.upsertCharacter(character);
    await loadData();
    setCharModalVisible(false);
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
    try {
      const parsed = JSON.parse(jsonString);
      const title = parsed.title || parsed.name || 'Imported Lorebook';
      const desc = parsed.description || '';

      let rawEntries: any[] = [];
      if (Array.isArray(parsed.entries)) {
        rawEntries = parsed.entries;
      } else if (parsed.entries && typeof parsed.entries === 'object') {
        rawEntries = Object.values(parsed.entries);
      }

      const imported: LorebookEntry[] = rawEntries.map((e, idx) => {
        let keys: string[] = [];
        if (Array.isArray(e.keys)) keys = e.keys;
        else if (Array.isArray(e.key)) keys = e.key;
        else if (typeof e.keys === 'string') keys = e.keys.split(',').map((k: string) => k.trim());
        else if (typeof e.key === 'string') keys = e.key.split(',').map((k: string) => k.trim());

        return {
          id: `entry_${Date.now()}_${idx}`,
          lorebookId: editingLorebookId || 'new',
          title: e.title || e.comment || e.name || `Entry #${idx + 1}`,
          keys: keys.filter(Boolean),
          content: e.content || e.text || '',
          enabled: e.enabled !== false,
          priority: typeof e.order === 'number' ? e.order : 100,
        };
      });

      setLbTitle(title);
      if (desc) setLbDescription(desc);
      if (imported.length > 0) {
        setLbEntries(prev => [...prev, ...imported]);
        alert(`Successfully imported ${imported.length} lorebook entries from Janitor / SillyTavern JSON format!`);
      } else {
        alert('Parsed JSON successfully, but no entries were found in the file.');
      }
    } catch (err: any) {
      alert(`Invalid Lorebook JSON format: ${err.message || 'Syntax error'}`);
    }
  };

  const handleSaveLorebook = async () => {
    if (!lbTitle.trim()) {
      alert('Please provide a Lorebook title.');
      return;
    }

    const lorebook: Lorebook = {
      id: editingLorebookId || `lorebook_${Date.now()}`,
      userId: 'user',
      title: lbTitle.trim(),
      description: lbDescription.trim(),
      scanDepth: parseInt(lbScanDepth, 10) || 2,
      tokenBudget: parseInt(lbTokenBudget, 10) || 1024,
      recursiveScanning: false,
      entries: lbEntries,
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Screen Title & Segmented Navigation */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Studio</Text>
          <Text style={styles.headerSubtitle}>User Cards & Personas</Text>
        </View>

        {/* Tab Segment Switcher */}
        <View style={styles.segmentPill}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'cards' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('cards')}
          >
            <Layers size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
            <Text style={[styles.segmentText, activeTab === 'cards' && styles.segmentTextActive]}>
              Cards ({userCharacters.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'personas' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('personas')}
          >
            <User size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
            <Text style={[styles.segmentText, activeTab === 'personas' && styles.segmentTextActive]}>
              Personas ({personas.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'lorebooks' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('lorebooks')}
          >
            <BookOpen size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
            <Text style={[styles.segmentText, activeTab === 'lorebooks' && styles.segmentTextActive]}>
              Codex ({lorebooks.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ================= TAB 1: MY CARDS ================= */}
        {activeTab === 'cards' && (
          <View>
            {/* Action Row */}
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionHeading}>My Character Cards</Text>
                <Text style={styles.sectionDesc}>Custom characters created by you</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={styles.importButton}
                  onPress={() => setImportModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Download size={15} color={palette.accent} style={{ marginRight: 6 }} />
                  <Text style={styles.importButtonText}>Import</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={handleOpenCreateChar}
                  activeOpacity={0.8}
                >
                  <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.createButtonText}>Create Card</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Empty State */}
            {userCharacters.length === 0 ? (
              <View style={styles.emptyCardBox}>
                <View style={styles.emptyIconCircle}>
                  <Sparkles size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.emptyTitle}>No Custom Cards Yet</Text>
                <Text style={styles.emptyDesc}>
                  Create your own anime roleplay companion with custom world lore, personality traits, and first messages.
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={handleOpenCreateChar}
                  >
                    <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.emptyActionBtnText}>Create Card</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.emptyActionBtn, { backgroundColor: `rgba(${palette.accentRgb}, 0.12)`, borderColor: `rgba(${palette.accentRgb}, 0.3)` }]}
                    onPress={() => setImportModalVisible(true)}
                  >
                    <Download size={16} color={palette.accent} style={{ marginRight: 6 }} />
                    <Text style={[styles.emptyActionBtnText, { color: palette.accent }]}>Import Card</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Character Card List */
              <View style={styles.cardsGrid}>
                {userCharacters.map(char => (
                  <View key={char.id} style={styles.cardItem}>
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
              <View>
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
              <View>
                <Text style={styles.sectionHeading}>Codex Lorebooks</Text>
                <Text style={styles.sectionDesc}>World lore & keyword-triggered memories</Text>
              </View>
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleOpenCreateLorebook}
                activeOpacity={0.8}
              >
                <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.createButtonText}>Add Lorebook</Text>
              </TouchableOpacity>
            </View>

            {lorebooks.length === 0 ? (
              <View style={styles.emptyCardBox}>
                <View style={styles.emptyIconCircle}>
                  <BookOpen size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.emptyTitle}>No Lorebooks Created</Text>
                <Text style={styles.emptyDesc}>
                  Lorebooks inject worldbuilding lore, character history, and specific rules dynamically when matching keywords appear in chat.
                </Text>
                <TouchableOpacity
                  style={[styles.createButton, { marginTop: 12 }]}
                  onPress={handleOpenCreateLorebook}
                >
                  <Text style={styles.createButtonText}>Create First Lorebook</Text>
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
                <Text style={styles.modalTitle}>Import Character Card</Text>
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
                  <Text style={styles.fieldLabel}>Card JSON or W++ Prompt Text</Text>
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
                      Parse & Load into Studio
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
      </BottomSheetModal>

      {/* ================= MODAL: CREATE / EDIT CHARACTER ================= */}
      <BottomSheetModal
        visible={charModalVisible}
        onClose={() => setCharModalVisible(false)}
        sheetStyle={{ maxHeight: '90%' }}
      >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCharId ? 'Edit Character Card' : 'Create New Character'}
              </Text>
              <TouchableOpacity onPress={() => setCharModalVisible(false)}>
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Character Avatar Preview & Upload */}
              <View style={styles.uploadRow}>
                <Image source={{ uri: charAvatar || ANIME_DEFAULT_FALLBACK }} style={styles.uploadPreview} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.fieldLabel}>Character Avatar</Text>
                  <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={() => handleTriggerUpload('char')}
                  >
                    <Upload size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.uploadButtonText}>
                      {isUploading ? 'Compressing...' : 'Upload Image'}
                    </Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.textInput, { marginTop: 8 }]}
                    placeholder="Or enter image URL..."
                    placeholderTextColor="#666"
                    value={charAvatar}
                    onChangeText={setCharAvatar}
                  />
                </View>
              </View>

              {/* Name */}
              <Text style={styles.fieldLabel}>Character Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Kuroha Raven"
                placeholderTextColor="#666"
                value={charName}
                onChangeText={setCharName}
              />

              {/* Tagline */}
              <Text style={styles.fieldLabel}>Tagline / Title</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. The Reserved Senior with a Secret Warmth"
                placeholderTextColor="#666"
                value={charTagline}
                onChangeText={setCharTagline}
              />

              {/* Scenario */}
              <Text style={styles.fieldLabel}>Scenario & Initial Context</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Describe where and when you encounter this companion..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={3}
                value={charScenario}
                onChangeText={setCharScenario}
              />

              {/* Personality */}
              <Text style={styles.fieldLabel}>Personality & Behavioral Traits</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="e.g. Tsundere, protective, sarcastic, soft when alone with user..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={3}
                value={charPersonality}
                onChangeText={setCharPersonality}
              />

              {/* First Message */}
              <Text style={styles.fieldLabel}>First Greeting Message</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="*He looks at you quietly.* 'Took you long enough.'"
                placeholderTextColor="#666"
                multiline
                numberOfLines={3}
                value={charFirstMessage}
                onChangeText={setCharFirstMessage}
              />

              {/* Tags */}
              <Text style={styles.fieldLabel}>Tags (comma-separated)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Anime, Romance, Fantasy, Tsundere"
                placeholderTextColor="#666"
                value={charTags}
                onChangeText={setCharTags}
              />

              {/* Content Rating */}
              <Text style={styles.fieldLabel}>Content Rating</Text>
              <View style={styles.ratingToggleRow}>
                <TouchableOpacity
                  style={[styles.ratingToggleBtn, charRating === 'SFW' && styles.ratingToggleBtnActive]}
                  onPress={() => setCharRating('SFW')}
                >
                  <Text style={[styles.ratingToggleText, charRating === 'SFW' && styles.ratingToggleTextActive]}>
                    SFW
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.ratingToggleBtn, charRating === 'NSFW' && styles.ratingToggleBtnActive]}
                  onPress={() => setCharRating('NSFW')}
                >
                  <Text style={[styles.ratingToggleText, charRating === 'NSFW' && styles.ratingToggleTextActive]}>
                    NSFW (18+)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Alternate Scenarios Section */}
              <View style={styles.subSectionHeader}>
                <Text style={styles.subSectionTitle}>
                  Alternate Scenarios ({charScenarios.length})
                </Text>
                <TouchableOpacity
                  style={styles.addMiniBtn}
                  onPress={handleAddCharScenario}
                >
                  <Plus size={13} color={palette.accent} style={{ marginRight: 4 }} />
                  <Text style={styles.addMiniBtnText}>Add Scenario</Text>
                </TouchableOpacity>
              </View>

              {charScenarios.map((scen, sIdx) => (
                <View key={scen.id} style={styles.subItemCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={styles.subItemIndex}>Scenario #{sIdx + 1}</Text>
                    <TouchableOpacity onPress={() => handleDeleteCharScenario(sIdx)}>
                      <Trash2 size={13} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.textInput, { marginBottom: 6 }]}
                    placeholder="Scenario Title (e.g. Rainy Day Shelter)"
                    placeholderTextColor="#666"
                    value={scen.title}
                    onChangeText={v => handleUpdateCharScenario(sIdx, 'title', v)}
                  />
                  <TextInput
                    style={[styles.textInput, styles.textArea, { marginBottom: 6, minHeight: 48 }]}
                    placeholder="Scenario premise & environment context..."
                    placeholderTextColor="#666"
                    multiline
                    value={scen.description}
                    onChangeText={v => handleUpdateCharScenario(sIdx, 'description', v)}
                  />
                  <TextInput
                    style={[styles.textInput, styles.textArea, { marginBottom: 6, minHeight: 48 }]}
                    placeholder="Scenario opening greeting message..."
                    placeholderTextColor="#666"
                    multiline
                    value={scen.openingMessage || ''}
                    onChangeText={v => handleUpdateCharScenario(sIdx, 'openingMessage', v)}
                  />
                  <TextInput
                    style={[styles.textInput, { minHeight: 38 }]}
                    placeholder="Scenario system directive (e.g. Focus on intimate warmth)"
                    placeholderTextColor="#666"
                    value={scen.scenarioInstructions || ''}
                    onChangeText={v => handleUpdateCharScenario(sIdx, 'scenarioInstructions', v)}
                  />
                </View>
              ))}

              {/* Alternate Greetings Section */}
              <View style={styles.subSectionHeader}>
                <Text style={styles.subSectionTitle}>
                  Alternate Greetings ({charAlternateGreetings.length})
                </Text>
                <TouchableOpacity
                  style={styles.addMiniBtn}
                  onPress={handleAddCharGreeting}
                >
                  <Plus size={13} color={palette.accent} style={{ marginRight: 4 }} />
                  <Text style={styles.addMiniBtnText}>Add Greeting</Text>
                </TouchableOpacity>
              </View>

              {charAlternateGreetings.map((greet, gIdx) => (
                <View key={`greet_${gIdx}`} style={[styles.subItemCard, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                  <TextInput
                    style={[styles.textInput, styles.textArea, { flex: 1, minHeight: 44 }]}
                    placeholder={`Alternate Greeting #${gIdx + 1}...`}
                    placeholderTextColor="#666"
                    multiline
                    value={greet}
                    onChangeText={v => handleUpdateCharGreeting(gIdx, v)}
                  />
                  <TouchableOpacity onPress={() => handleDeleteCharGreeting(gIdx)} style={{ padding: 6 }}>
                    <Trash2 size={14} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleSaveCharacter}>
                <Text style={styles.saveSubmitBtnText}>Save Character Card</Text>
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
                    onPress={() => {
                      if (Platform.OS === 'web' && typeof document !== 'undefined') {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.json,application/json';
                        input.onchange = (e: any) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (re: any) => {
                            handleImportLorebookJson(re.target.result);
                          };
                          reader.readAsText(file);
                        };
                        input.click();
                      } else {
                        const promptJson = prompt('Paste JanitorAI or SillyTavern Lorebook JSON:');
                        if (promptJson) handleImportLorebookJson(promptJson);
                      }
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
    </SafeAreaView>
  );
};

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bgDark,
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
    borderRadius: 24,
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
    borderRadius: 20,
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

