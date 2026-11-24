import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Check,
  ImagePlus,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  Eye,
  Edit3,
  MessageSquare,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Character, ContentRating } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { getCardSurfaceStyle, getScreenBg, getSurfaceBg } from '../theme/skins';
import { estimateTokens } from '../services/tokenOptimizerService';
import { compressImageFile } from '../utils/imageUtils';

interface CharacterCreatorScreenProps {
  visible: boolean;
  editingCharacter?: Character | null;
  fallbackAvatar: string;
  onCancel: () => void;
  onSave: (character: Character) => Promise<void> | void;
}

const SUGGESTED_TAGS = [
  'Anime',
  'Roleplay',
  'Romance',
  'Fantasy',
  'Slice of Life',
  'Sci-Fi',
  'Mystery',
  'Modern',
];

export const CharacterCreatorScreen: React.FC<CharacterCreatorScreenProps> = ({
  visible,
  editingCharacter,
  fallbackAvatar,
  onCancel,
  onSave,
}) => {
  const { palette, skin } = useTheme();

  const [name, setName] = useState('');
  const [chatName, setChatName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState(fallbackAvatar);
  const [tags, setTags] = useState<string[]>(['Anime', 'Roleplay']);
  const [tagInput, setTagInput] = useState('');
  const [rating, setRating] = useState<ContentRating>('SFW');
  const [personality, setPersonality] = useState('');
  const [scenario, setScenario] = useState('');
  const [greetings, setGreetings] = useState<string[]>(['']);
  const [activeGreetingIdx, setActiveGreetingIdx] = useState(0);
  const [greetingPreviewMode, setGreetingPreviewMode] = useState(false);
  const [exampleDialogs, setExampleDialogs] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (editingCharacter) {
      setName(editingCharacter.name || '');
      setChatName(editingCharacter.chatName || '');
      setBio(editingCharacter.tagline || editingCharacter.description || '');
      setAvatar(editingCharacter.avatar || fallbackAvatar);
      setTags(editingCharacter.tags?.length ? editingCharacter.tags.slice(0, 10) : ['Anime', 'Roleplay']);
      setRating(editingCharacter.contentRating || 'SFW');
      setPersonality(editingCharacter.personality || '');
      setScenario(editingCharacter.scenario || '');
      const allG = [
        editingCharacter.firstMessage || '',
        ...(editingCharacter.alternateGreetings || []),
      ].filter((g, i) => i === 0 || g.trim().length > 0);
      setGreetings(allG.length > 0 ? allG : ['']);
      setActiveGreetingIdx(0);
      setExampleDialogs(editingCharacter.systemPrompt || '');
    } else {
      setName('');
      setChatName('');
      setBio('');
      setAvatar(fallbackAvatar);
      setTags(['Anime', 'Roleplay']);
      setRating('SFW');
      setPersonality('');
      setScenario('');
      setGreetings(['']);
      setActiveGreetingIdx(0);
      setExampleDialogs('');
    }
    setTagInput('');
    setGreetingPreviewMode(false);
  }, [visible, editingCharacter, fallbackAvatar]);

  const personalityTokens = useMemo(() => estimateTokens(personality), [personality]);
  const scenarioTokens = useMemo(() => estimateTokens(scenario), [scenario]);
  const currentGreeting = greetings[activeGreetingIdx] ?? '';
  const greetingTokens = useMemo(() => estimateTokens(currentGreeting), [currentGreeting]);
  const exampleTokens = useMemo(() => estimateTokens(exampleDialogs), [exampleDialogs]);
  const totalDefTokens = personalityTokens + scenarioTokens + greetingTokens + exampleTokens;

  const handlePickAvatar = async () => {
    try {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            const compressed = await compressImageFile(file, 720);
            setAvatar(compressed);
          }
        };
        input.click();
        return;
      }
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.85,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setAvatar(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
      }
    } catch {}
  };

  const handleAddTag = (raw: string) => {
    const clean = raw.trim().replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 21);
    if (!clean || tags.length >= 10) return;
    if (!tags.some(t => t.toLowerCase() === clean.toLowerCase())) {
      setTags(prev => [...prev, clean]);
    }
    setTagInput('');
  };

  const handleSave = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      alert('Please enter a Character Name / Title.');
      return;
    }
    setSaving(true);
    try {
      const cleanGreetings = greetings.map(g => g.trim()).filter(Boolean);
      const firstMessage =
        cleanGreetings[0] || `*${chatName.trim() || cleanName} looks over and greets you.* "Hello."`;
      const alternateGreetings = cleanGreetings.slice(1);

      const nextChar: Character = {
        ...(editingCharacter || {}),
        id: editingCharacter?.id || `user_char_${Date.now()}`,
        name: cleanName,
        chatName: chatName.trim() || undefined,
        tagline: bio.trim() || 'Custom AI Companion',
        description: bio.trim() || scenario.trim() || personality.trim() || 'A user-created companion.',
        avatar: avatar.trim() || fallbackAvatar,
        personality: personality.trim() || 'Warm, attentive, and responsive.',
        scenario: scenario.trim() || 'Meeting in a comfortable setting.',
        systemPrompt: exampleDialogs.trim() || undefined,
        firstMessage,
        alternateGreetings: alternateGreetings.length > 0 ? alternateGreetings : undefined,
        tags: tags.length > 0 ? tags : ['Anime', 'Custom'],
        creator: editingCharacter?.creator || '@User',
        isUserCreated: true,
        contentRating: rating,
        scenarios: editingCharacter?.scenarios || [],
        totalChats: editingCharacter?.totalChats || 0,
        lastActive: Date.now(),
        isFavorite: editingCharacter?.isFavorite || false,
      };
      await onSave(nextChar);
    } finally {
      setSaving(false);
    }
  };

  const cardSurface = getCardSurfaceStyle(palette, skin);
  const inputSurface = {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: skin.inputRadius,
    borderWidth: skin.id === 'material' ? 0 : 1,
    borderColor: 'rgba(255,255,255,0.1)',
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView style={[styles.safe, { backgroundColor: getScreenBg(palette, skin) }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View
            style={[
              styles.header,
              {
                borderBottomColor: 'rgba(255,255,255,0.08)',
                backgroundColor: getSurfaceBg(palette, skin),
              },
            ]}
          >
            <TouchableOpacity onPress={onCancel} style={styles.headerBackBtn} activeOpacity={0.75}>
              <ArrowLeft size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>
                {editingCharacter ? 'Edit Character' : 'Create Character'}
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 11.5 }}>
                {totalDefTokens} definition tokens • 100% Local
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
              style={[
                styles.saveBtn,
                { backgroundColor: palette.accent, borderRadius: skin.buttonRadius, opacity: saving ? 0.6 : 1 },
              ]}
            >
              <Check size={15} color={palette.bgDark} />
              <Text style={[styles.saveBtnText, { color: palette.bgDark }]}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Avatar & Live Card Preview */}
            <View style={[cardSurface, styles.sectionCard]}>
              <Text style={styles.sectionHeading}>Avatar &amp; Card Preview</Text>
              <View style={styles.previewRow}>
                <TouchableOpacity
                  onPress={handlePickAvatar}
                  activeOpacity={0.8}
                  style={[styles.uploadDropZone, inputSurface]}
                >
                  <ImagePlus size={22} color={palette.accent} />
                  <Text style={{ color: '#e2e8f0', fontSize: 12.5, fontWeight: '700', marginTop: 6 }}>
                    Select Avatar
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center', marginTop: 2 }}>
                    Tap to pick image or paste URL below
                  </Text>
                </TouchableOpacity>

                {/* Live NekoChat Preview Card */}
                <View
                  style={[
                    styles.liveCardPreview,
                    {
                      borderRadius: skin.cardRadius,
                      borderColor: `rgba(${palette.accentRgb}, 0.38)`,
                      backgroundColor: palette.bgDark,
                    },
                  ]}
                >
                  <Image source={{ uri: avatar || fallbackAvatar }} style={styles.liveCardImg} />
                  <View style={styles.liveCardTopBadge}>
                    <MessageSquare size={10} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>0</Text>
                  </View>
                  <View style={styles.liveCardFooter}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }} numberOfLines={1}>
                      {name.trim() || 'Untitled'}
                    </Text>
                    <Text style={{ color: palette.accent, fontSize: 10, fontWeight: '700' }}>
                      {rating === 'NSFW' ? '18+ NSFW' : 'SFW'} • {totalDefTokens}t
                    </Text>
                  </View>
                </View>
              </View>

              <TextInput
                style={[styles.input, inputSurface, { marginTop: 10 }]}
                value={avatar}
                onChangeText={setAvatar}
                placeholder="Or paste Avatar Image URL..."
                placeholderTextColor="#64748b"
                autoCapitalize="none"
              />
            </View>

            {/* 2. Identity */}
            <View style={[cardSurface, styles.sectionCard]}>
              <Text style={styles.sectionHeading}>Identity</Text>

              <Text style={styles.label}>Title / Name *</Text>
              <TextInput
                style={[styles.input, inputSurface]}
                value={name}
                onChangeText={setName}
                placeholder="A unique name for your character"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.label}>Chat Name (Optional)</Text>
              <TextInput
                style={[styles.input, inputSurface]}
                value={chatName}
                onChangeText={setChatName}
                placeholder="Nickname shown in chat & LLM prompt"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.label}>Bio / Tagline *</Text>
              <TextInput
                style={[styles.textArea, inputSurface, { minHeight: 74 }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Short bio or hook shown on the character card..."
                placeholderTextColor="#64748b"
                multiline
              />
            </View>

            {/* 3. Tags & Content Rating */}
            <View style={[cardSurface, styles.sectionCard]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Tag size={15} color={palette.accent} />
                <Text style={[styles.sectionHeading, { marginBottom: 0 }]}>Tags &amp; Content Rating</Text>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {tags.map(tg => (
                  <TouchableOpacity
                    key={tg}
                    onPress={() => setTags(prev => prev.filter(x => x !== tg))}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: skin.pillRadius,
                      backgroundColor: `rgba(${palette.accentRgb}, 0.16)`,
                      borderWidth: 1,
                      borderColor: `rgba(${palette.accentRgb}, 0.35)`,
                    }}
                  >
                    <Text style={{ color: palette.accent, fontSize: 12, fontWeight: '700' }}>{tg}</Text>
                    <Text style={{ color: palette.accent, fontSize: 12 }}>×</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.input, inputSurface, { flex: 1 }]}
                  value={tagInput}
                  onChangeText={setTagInput}
                  onSubmitEditing={() => handleAddTag(tagInput)}
                  placeholder={`Add tag (${tags.length}/10)...`}
                  placeholderTextColor="#64748b"
                  returnKeyType="done"
                />
                <TouchableOpacity
                  onPress={() => handleAddTag(tagInput)}
                  style={{
                    backgroundColor: palette.accent,
                    borderRadius: skin.buttonRadius,
                    paddingHorizontal: 14,
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: palette.bgDark, fontSize: 12.5, fontWeight: '800' }}>Add</Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {SUGGESTED_TAGS.filter(s => !tags.includes(s)).map(s => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => handleAddTag(s)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: skin.pillRadius,
                        backgroundColor: 'rgba(255,255,255,0.06)',
                      }}
                    >
                      <Text style={{ color: '#cbd5e1', fontSize: 11.5 }}>+ {s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={[styles.label, { marginTop: 14 }]}>Content Rating</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {(['SFW', 'NSFW'] as const).map(r => {
                  const active = rating === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setRating(r)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: skin.buttonRadius,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: active ? palette.accent : 'rgba(255,255,255,0.12)',
                        backgroundColor: active ? `rgba(${palette.accentRgb}, 0.16)` : 'rgba(255,255,255,0.04)',
                      }}
                    >
                      <Text style={{ color: active ? palette.accent : '#cbd5e1', fontSize: 13, fontWeight: '800' }}>
                        {r === 'SFW' ? 'SFW (All-Ages)' : 'NSFW (18+ Mature)'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 4. Definition */}
            <View style={[cardSurface, styles.sectionCard]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={15} color={palette.accent} />
                  <Text style={[styles.sectionHeading, { marginBottom: 0 }]}>Definition</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {['{{char}}', '{{user}}'].map(macro => (
                    <TouchableOpacity
                      key={macro}
                      onPress={() => setPersonality(prev => (prev ? `${prev} ${macro}` : macro))}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: skin.pillRadius,
                        backgroundColor: 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '700' }}>{macro}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 10 }}>
                The heart of your character — how they speak, behave, and what they know.
              </Text>

              <View style={styles.labelRow}>
                <Text style={styles.label}>Personality *</Text>
                <Text style={styles.tokenCount}>{personalityTokens} tokens</Text>
              </View>
              <TextInput
                style={[styles.textArea, inputSurface, { minHeight: 110 }]}
                value={personality}
                onChangeText={setPersonality}
                placeholder="Describe personality, traits, voice, and behavior..."
                placeholderTextColor="#64748b"
                multiline
              />

              <View style={styles.labelRow}>
                <Text style={styles.label}>Scenario</Text>
                <Text style={styles.tokenCount}>{scenarioTokens} tokens</Text>
              </View>
              <TextInput
                style={[styles.textArea, inputSurface, { minHeight: 90 }]}
                value={scenario}
                onChangeText={setScenario}
                placeholder="Outline the setting and circumstances of the conversation..."
                placeholderTextColor="#64748b"
                multiline
              />

              {/* Multi-Greeting Tabs */}
              <View style={styles.labelRow}>
                <Text style={styles.label}>Initial Messages ({greetings.length}/10)</Text>
                <Text style={styles.tokenCount}>{greetingTokens} tokens</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  {greetings.map((_, idx) => {
                    const active = idx === activeGreetingIdx;
                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => setActiveGreetingIdx(idx)}
                        style={{
                          paddingHorizontal: 11,
                          paddingVertical: 6,
                          borderRadius: skin.pillRadius,
                          backgroundColor: active ? `rgba(${palette.accentRgb}, 0.18)` : 'rgba(255,255,255,0.06)',
                          borderWidth: 1,
                          borderColor: active ? palette.accent : 'transparent',
                        }}
                      >
                        <Text style={{ color: active ? palette.accent : '#cbd5e1', fontSize: 12, fontWeight: '700' }}>
                          Message {idx + 1}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {greetings.length < 10 && (
                    <TouchableOpacity
                      onPress={() => {
                        setGreetings(prev => [...prev, '']);
                        setActiveGreetingIdx(greetings.length);
                      }}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: skin.pillRadius,
                        backgroundColor: 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <Plus size={14} color={palette.accent} />
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => setGreetingPreviewMode(false)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: skin.pillRadius,
                      backgroundColor: !greetingPreviewMode ? 'rgba(255,255,255,0.12)' : 'transparent',
                    }}
                  >
                    <Edit3 size={12} color="#e2e8f0" />
                    <Text style={{ color: '#e2e8f0', fontSize: 11.5, fontWeight: '600' }}>Write</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setGreetingPreviewMode(true)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: skin.pillRadius,
                      backgroundColor: greetingPreviewMode ? 'rgba(255,255,255,0.12)' : 'transparent',
                    }}
                  >
                    <Eye size={12} color="#e2e8f0" />
                    <Text style={{ color: '#e2e8f0', fontSize: 11.5, fontWeight: '600' }}>Preview</Text>
                  </TouchableOpacity>
                </View>

                {greetings.length > 1 && (
                  <TouchableOpacity
                    onPress={() => {
                      const next = greetings.filter((_, i) => i !== activeGreetingIdx);
                      setGreetings(next);
                      setActiveGreetingIdx(Math.max(0, activeGreetingIdx - 1));
                    }}
                  >
                    <Trash2 size={14} color="#f87171" />
                  </TouchableOpacity>
                )}
              </View>

              {greetingPreviewMode ? (
                <View style={[styles.textArea, inputSurface, { minHeight: 110 }]}>
                  <Text style={{ color: '#e2e8f0', fontSize: 13.5, lineHeight: 20 }}>
                    {(currentGreeting || 'Nothing written yet.')
                      .replace(/\{\{char\}\}/gi, chatName.trim() || name.trim() || 'Character')
                      .replace(/\{\{user\}\}/gi, 'You')}
                  </Text>
                </View>
              ) : (
                <TextInput
                  style={[styles.textArea, inputSurface, { minHeight: 110 }]}
                  value={currentGreeting}
                  onChangeText={val =>
                    setGreetings(prev => prev.map((g, i) => (i === activeGreetingIdx ? val : g)))
                  }
                  placeholder="The first message from your character (*italic* for actions, quotes for speech)..."
                  placeholderTextColor="#64748b"
                  multiline
                />
              )}

              <View style={styles.labelRow}>
                <Text style={styles.label}>Example Dialogs &amp; Rules</Text>
                <Text style={styles.tokenCount}>{exampleTokens} tokens</Text>
              </View>
              <TextInput
                style={[styles.textArea, inputSurface, { minHeight: 100 }]}
                value={exampleDialogs}
                onChangeText={setExampleDialogs}
                placeholder={'{{char}}: Hey there.\n{{user}}: Hi!\n{{char}}: Nice to meet you :)'}
                placeholderTextColor="#64748b"
                multiline
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  saveBtnText: { fontSize: 13.5, fontWeight: '800' },
  scrollContent: { padding: 16, gap: 14, paddingBottom: 40 },
  sectionCard: { padding: 16 },
  sectionHeading: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginBottom: 10 },
  previewRow: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  uploadDropZone: {
    flex: 1,
    minHeight: 148,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  liveCardPreview: {
    width: 112,
    height: 148,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  liveCardImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  liveCardTopBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  liveCardFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 7,
    backgroundColor: 'rgba(10,12,18,0.82)',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 6,
  },
  label: { color: '#e2e8f0', fontSize: 13, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  tokenCount: { color: '#94a3b8', fontSize: 11.5, fontWeight: '600' },
  input: { color: '#FFFFFF', fontSize: 13.5, paddingHorizontal: 12, paddingVertical: 10 },
  textArea: {
    color: '#FFFFFF',
    fontSize: 13.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
});
