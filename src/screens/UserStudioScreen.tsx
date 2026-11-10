/**
 * User Studio Screen
 * Dedicated user workspace featuring:
 * 1. My Character Cards: User-created cards with creator controls, edit, chat, and JSON export.
 * 2. My Personas: Full persona roster with photo upload/compression, editing, and default persona switcher.
 */

import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react-native';
import { Character, Persona } from '../types';
import { colors } from '../theme/colors';
import { storageService } from '../services/storageService';
import { compressImageFile, ANIME_DEFAULT_FALLBACK } from '../utils/imageUtils';

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
  const [activeTab, setActiveTab] = useState<'cards' | 'personas'>('cards');
  const [userCharacters, setUserCharacters] = useState<Character[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
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
  const [charRating, setCharRating] = useState<'SFW' | 'NSFW'>('SFW');

  // Persona Modal State
  const [personaModalVisible, setPersonaModalVisible] = useState(false);
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);
  const [personaName, setPersonaName] = useState('');
  const [personaPronouns, setPersonaPronouns] = useState('');
  const [personaAvatar, setPersonaAvatar] = useState('');
  const [personaDescription, setPersonaDescription] = useState('');
  const [isPersonaDefault, setIsPersonaDefault] = useState(false);

  // File Upload Helper
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTarget, setUploadTarget] = useState<'char' | 'persona'>('char');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const chars = await storageService.getUserCharacters();
      setUserCharacters(chars);
      const pers = await storageService.getPersonas();
      setPersonas(pers);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Image Upload Handler (HTML File Input for Web) ---
  const handleTriggerUpload = (target: 'char' | 'persona') => {
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
    setCharModalVisible(true);
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
      totalChats: 0,
      lastActive: Date.now(),
      isFavorite: false,
    };

    await storageService.upsertUserCharacter(character);
    // Also save to active characters list so it can be chatted with
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
    setIsPersonaDefault(personas.length === 0);
    setPersonaModalVisible(true);
  };

  const handleOpenEditPersona = (pers: Persona) => {
    setEditingPersonaId(pers.id);
    setPersonaName(pers.name);
    setPersonaPronouns(pers.pronouns || 'they/them');
    setPersonaAvatar(pers.avatar || ANIME_DEFAULT_FALLBACK);
    setPersonaDescription(pers.description || '');
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
      isDefault: isPersonaDefault,
    };

    await storageService.upsertPersona(persona);
    if (isPersonaDefault) {
      await storageService.setDefaultPersona(persona.id);
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
            <Layers size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={[styles.segmentText, activeTab === 'cards' && styles.segmentTextActive]}>
              My Cards ({userCharacters.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'personas' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('personas')}
          >
            <User size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={[styles.segmentText, activeTab === 'personas' && styles.segmentTextActive]}>
              My Personas ({personas.length})
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
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleOpenCreateChar}
                activeOpacity={0.8}
              >
                <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.createButtonText}>Create Card</Text>
              </TouchableOpacity>
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
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={handleOpenCreateChar}
                >
                  <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.emptyActionBtnText}>Create Your First Card</Text>
                </TouchableOpacity>
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
      </ScrollView>

      {/* ================= MODAL: CREATE / EDIT CHARACTER ================= */}
      <Modal visible={charModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
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

              <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleSaveCharacter}>
                <Text style={styles.saveSubmitBtnText}>Save Character Card</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: ADD / EDIT PERSONA ================= */}
      <Modal visible={personaModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
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
              <Text style={styles.fieldLabel}>Appearance & Lore Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Describe your appearance, personality, and background as the AI companion will perceive you during chats..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
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
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0c0e14',
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
    backgroundColor: '#12151e',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1b1e28',
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
    backgroundColor: '#12151e',
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#12151e',
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
});
