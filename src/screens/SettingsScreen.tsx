/**
 * Settings Screen (Complete Blueprint Implementation)
 * Full feature parity with Warden AI & NekoChat Master Blueprint.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import {
  Activity,
  Key,
  Cpu,
  ShieldCheck,
  RefreshCw,
  Globe,
  User,
  Sliders,
  Palette,
  BookOpen,
  MessageCircle,
  FileCode,
  Download,
} from 'lucide-react-native';
import { ProviderConfig, AppSettings, LLMProvider, ChatStyleMode, Persona } from '../types';
import { colors } from '../theme/colors';
import { storageService } from '../services/storageService';
import { aiProviderService } from '../services/aiProviderService';

interface SettingsScreenProps {
  config: ProviderConfig;
  onUpdateConfig: (cfg: ProviderConfig) => void;
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  config,
  onUpdateConfig,
  settings,
  onUpdateSettings,
}) => {
  // Provider config state
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>(config.provider);
  const [model, setModel] = useState(config.model || 'gemini-2.5-flash');
  const [customEndpoint, setCustomEndpoint] = useState(config.customEndpoint || '');
  const [temperature, setTemperature] = useState(String(config.temperature || '0.85'));
  const [contextLimit, setContextLimit] = useState(String(config.contextLimit || '8192'));

  // Persona State
  const [personaName, setPersonaName] = useState('Ren');
  const [personaAppearance, setPersonaAppearance] = useState('Messy dark hair, leather jacket, 178cm');
  const [personaPersonality, setPersonaPersonality] = useState('Relaxed college student with a curious mind');
  const [personaSaved, setPersonaSaved] = useState(false);

  // Humanized Presets State
  const [humanPreset, setHumanPreset] = useState<'casual' | 'descriptive' | 'unhinged'>('descriptive');

  // Latency Monitor State
  const [testingHealth, setTestingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{
    gemini?: { ok: boolean; latencyMs: number };
    chub?: { ok: boolean; latencyMs: number };
    datacat?: { ok: boolean; latencyMs: number };
  }>({});

  useEffect(() => {
    loadPersona();
    testAllServices();
  }, []);

  const loadPersona = async () => {
    const persList = await storageService.getPersonas();
    if (persList.length > 0) {
      setPersonaName(persList[0].name);
      setPersonaAppearance(persList[0].description.split('\n')[0] || '');
      setPersonaPersonality(persList[0].description.split('\n')[1] || persList[0].description);
    }
  };

  const handleSavePersona = async () => {
    const updated: Persona = {
      id: 'default-user',
      name: personaName,
      description: `${personaAppearance}\n${personaPersonality}`,
      isDefault: true,
    };
    await storageService.savePersonas([updated]);
    setPersonaSaved(true);
    setTimeout(() => setPersonaSaved(false), 2000);
  };

  const testAllServices = async () => {
    setTestingHealth(true);
    const [chubRes, datacatRes, geminiRes] = await Promise.all([
      aiProviderService.pingService('chub'),
      aiProviderService.pingService('datacat'),
      aiProviderService.pingService('gemini', apiKey),
    ]);

    setHealthStatus({
      chub: chubRes,
      datacat: datacatRes,
      gemini: geminiRes,
    });
    setTestingHealth(false);
  };

  const handleApplyPreset = (preset: 'gemini' | 'openrouter' | 'ollama' | 'kobold' | 'deepseek') => {
    if (preset === 'gemini') {
      setSelectedProvider('gemini');
      setModel('gemini-2.5-flash');
      setCustomEndpoint('');
    } else if (preset === 'openrouter') {
      setSelectedProvider('openrouter');
      setModel('deepseek/deepseek-chat');
      setCustomEndpoint('https://openrouter.ai/api/v1/chat/completions');
    } else if (preset === 'ollama') {
      setSelectedProvider('custom');
      setModel('llama3.3');
      setCustomEndpoint('http://localhost:11434/v1/chat/completions');
    } else if (preset === 'kobold') {
      setSelectedProvider('custom');
      setModel('koboldcpp');
      setCustomEndpoint('http://localhost:5001/v1/chat/completions');
    } else if (preset === 'deepseek') {
      setSelectedProvider('custom');
      setModel('deepseek-chat');
      setCustomEndpoint('https://api.deepseek.com/v1/chat/completions');
    }
  };

  const handleSaveKeys = async () => {
    const updated = await storageService.saveProviderConfig({
      provider: selectedProvider,
      apiKey,
      model,
      customEndpoint,
      temperature: parseFloat(temperature) || 0.85,
      contextLimit: parseInt(contextLimit, 10) || 8192,
    });
    onUpdateConfig(updated);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.screenTitle}>Settings</Text>

        {/* 1. Service Health & Latency Monitor */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Activity size={16} color={colors.lime} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Service Health & Latency</Text>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={testAllServices}
              disabled={testingHealth}
            >
              {testingHealth ? (
                <ActivityIndicator size="small" color={colors.lime} />
              ) : (
                <RefreshCw size={14} color={colors.lime} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.pingRow}>
            <Text style={styles.serviceName}>LLM Engine (Gemini / Custom)</Text>
            <View style={styles.pingBadge}>
              <View style={[styles.dot, healthStatus.gemini?.ok ? styles.dotGreen : styles.dotOrange]} />
              <Text style={styles.pingText}>{healthStatus.gemini?.latencyMs ? `${healthStatus.gemini.latencyMs}ms` : 'Offline'}</Text>
            </View>
          </View>

          <View style={styles.pingRow}>
            <Text style={styles.serviceName}>Chub Community API</Text>
            <View style={styles.pingBadge}>
              <View style={[styles.dot, healthStatus.chub?.ok ? styles.dotGreen : styles.dotOrange]} />
              <Text style={styles.pingText}>{healthStatus.chub?.latencyMs ? `${healthStatus.chub.latencyMs}ms` : 'Online'}</Text>
            </View>
          </View>

          <View style={styles.pingRow}>
            <Text style={styles.serviceName}>Datacat (Janitor Mirror)</Text>
            <View style={styles.pingBadge}>
              <View style={[styles.dot, healthStatus.datacat?.ok ? styles.dotGreen : styles.dotOrange]} />
              <Text style={styles.pingText}>{healthStatus.datacat?.latencyMs ? `${healthStatus.datacat.latencyMs}ms` : 'Online'}</Text>
            </View>
          </View>
        </View>

        {/* 2. Language Preference */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Globe size={16} color={colors.lime} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Language Preferences</Text>
          </View>
          <View style={styles.langRow}>
            {[
              { code: 'en-US', label: 'English (US)' },
              { code: 'id-ID', label: 'Bahasa Indonesia' },
              { code: 'ja-JP', label: '日本語' },
            ].map(l => (
              <TouchableOpacity
                key={l.code}
                style={[styles.langChip, settings.language === l.code && styles.langChipActive]}
                onPress={() => onUpdateSettings({ ...settings, language: l.code })}
              >
                <Text style={[styles.langChipText, settings.language === l.code && styles.langChipTextActive]}>
                  {l.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 3. Persona Profile Manager */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <User size={16} color={colors.lime} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Persona Profile Manager</Text>
          </View>

          <Text style={styles.inputLabel}>Persona Name</Text>
          <TextInput
            style={styles.textInput}
            value={personaName}
            onChangeText={setPersonaName}
            placeholder="e.g. Ren"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.inputLabel}>Appearance & Physical Description</Text>
          <TextInput
            style={styles.textInput}
            value={personaAppearance}
            onChangeText={setPersonaAppearance}
            placeholder="e.g. Messy dark hair, leather jacket, 178cm"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.inputLabel}>Personality & Backstory</Text>
          <TextInput
            style={[styles.textInput, { height: 60 }]}
            value={personaPersonality}
            onChangeText={setPersonaPersonality}
            placeholder="e.g. Relaxed college student with a curious mind"
            placeholderTextColor={colors.textMuted}
            multiline
          />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSavePersona}>
            <Text style={styles.saveBtnText}>{personaSaved ? 'Saved! ✓' : 'Save Persona Profile'}</Text>
          </TouchableOpacity>
        </View>

        {/* 4. API Key & Custom Endpoints */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Key size={16} color={colors.lime} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>API Engine & Custom Endpoints</Text>
          </View>

          <Text style={styles.inputLabel}>Quick Presets</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsRow}>
            <TouchableOpacity style={styles.presetChip} onPress={() => handleApplyPreset('gemini')}>
              <Text style={styles.presetChipText}>🟢 Gemini AI Studio</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => handleApplyPreset('openrouter')}>
              <Text style={styles.presetChipText}>🟣 OpenRouter</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => handleApplyPreset('ollama')}>
              <Text style={styles.presetChipText}>🦙 Ollama Local</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => handleApplyPreset('kobold')}>
              <Text style={styles.presetChipText}>⚔️ KoboldAI</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => handleApplyPreset('deepseek')}>
              <Text style={styles.presetChipText}>🤖 DeepSeek Direct</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.providerRow}>
            {(['gemini', 'openrouter', 'custom'] as LLMProvider[]).map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.providerBtn, selectedProvider === p && styles.providerBtnActive]}
                onPress={() => setSelectedProvider(p)}
              >
                <Text style={[styles.providerBtnText, selectedProvider === p && styles.providerBtnTextActive]}>
                  {p.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {selectedProvider === 'custom' && (
            <>
              <Text style={styles.inputLabel}>Custom API Base URL (OpenAI-compatible)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. http://localhost:11434/v1/chat/completions"
                placeholderTextColor={colors.textMuted}
                value={customEndpoint}
                onChangeText={setCustomEndpoint}
              />
            </>
          )}

          <Text style={styles.inputLabel}>
            {selectedProvider === 'gemini' ? 'Google AI Studio Key (Free)' : 'API Key'}
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="Paste your API key here..."
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={apiKey}
            onChangeText={setApiKey}
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 2 }}>
              <Text style={styles.inputLabel}>Model Slug</Text>
              <TextInput
                style={styles.textInput}
                value={model}
                onChangeText={setModel}
                placeholder="e.g. gemini-2.5-flash or llama3.3"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Temp</Text>
              <TextInput
                style={styles.textInput}
                value={temperature}
                onChangeText={setTemperature}
                placeholder="0.85"
                keyboardType="numeric"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveKeys}>
            <Text style={styles.saveBtnText}>Save API Configuration</Text>
          </TouchableOpacity>
        </View>

        {/* 5. Humanized Response Presets */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Sliders size={16} color={colors.lime} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Humanized Response Presets</Text>
          </View>
          <View style={styles.presetsRow}>
            {[
              { id: 'casual', label: 'Casual / Natural' },
              { id: 'descriptive', label: 'Deep Descriptive' },
              { id: 'unhinged', label: 'Expressive / Dynamic' },
            ].map(hp => (
              <TouchableOpacity
                key={hp.id}
                style={[styles.presetChip, humanPreset === hp.id && styles.presetChipActive]}
                onPress={() => setHumanPreset(hp.id as any)}
              >
                <Text style={[styles.presetChipText, humanPreset === hp.id && { color: '#000' }]}>
                  {hp.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 6. Chat Style & Syntax Colors */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Palette size={16} color={colors.lime} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Chat Style & Typography</Text>
          </View>

          <Text style={styles.inputLabel}>Default Chat Style</Text>
          <View style={styles.styleToggleRow}>
            <TouchableOpacity
              style={[styles.styleBtn, settings.chatStyle === 'bubble' && styles.styleBtnActive]}
              onPress={() => onUpdateSettings({ ...settings, chatStyle: 'bubble' })}
            >
              <MessageCircle size={16} color={settings.chatStyle === 'bubble' ? '#000' : colors.textSecondary} style={{ marginRight: 6 }} />
              <Text style={[styles.styleBtnText, settings.chatStyle === 'bubble' && { color: '#000' }]}>
                Bubble Mode
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.styleBtn, settings.chatStyle === 'novel' && styles.styleBtnActive]}
              onPress={() => onUpdateSettings({ ...settings, chatStyle: 'novel' })}
            >
              <BookOpen size={16} color={settings.chatStyle === 'novel' ? '#000' : colors.textSecondary} style={{ marginRight: 6 }} />
              <Text style={[styles.styleBtnText, settings.chatStyle === 'novel' && { color: '#000' }]}>
                Novel Mode (Full-Bleed)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 7. Token Counter & Currency Tracker */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Cpu size={16} color={colors.lime} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Token Counter & Currency</Text>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.serviceName}>Currency Display</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(['IDR', 'USD'] as const).map(curr => (
                <TouchableOpacity
                  key={curr}
                  style={[styles.currencyBtn, settings.currency === curr && styles.currencyBtnActive]}
                  onPress={() => onUpdateSettings({ ...settings, currency: curr })}
                >
                  <Text style={[styles.currencyBtnText, settings.currency === curr && { color: '#000' }]}>
                    {curr}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* 8. About & Project Attribution */}
        <View style={[styles.sectionCard, { borderColor: 'rgba(204, 255, 0, 0.3)' }]}>
          <View style={styles.sectionHeader}>
            <ShieldCheck size={16} color={colors.lime} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>About NekoChat</Text>
          </View>
          <Text style={styles.aboutVersion}>🐾 NekoChat v0.1.0-alpha</Text>
          <Text style={styles.aboutDesc}>
            Free & Open-Source AI Roleplay Client. Forked & evolved from the Warden AI Core.
          </Text>
          <Text style={styles.aboutAttribution}>
            Based on the NekoChat Project: https://github.com/kanto/NekoChat
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
  },
  screenTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
  },
  sectionCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  refreshBtn: {
    padding: 4,
  },
  pingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  serviceName: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  pingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  dotGreen: {
    backgroundColor: colors.lime,
  },
  dotOrange: {
    backgroundColor: colors.lemon,
  },
  pingText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  langRow: {
    flexDirection: 'row',
    gap: 8,
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  langChipActive: {
    backgroundColor: 'rgba(204, 255, 0, 0.15)',
    borderColor: colors.lime,
  },
  langChipText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  langChipTextActive: {
    color: colors.lime,
  },
  providerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  presetChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  presetChipActive: {
    backgroundColor: colors.lime,
    borderColor: colors.lime,
  },
  presetChipText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  providerBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  providerBtnActive: {
    backgroundColor: colors.lime,
  },
  providerBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  providerBtnTextActive: {
    color: '#000',
  },
  inputLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 4,
    marginTop: 6,
  },
  textInput: {
    backgroundColor: colors.bgDark,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: colors.textPrimary,
    fontSize: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: 8,
  },
  saveBtn: {
    backgroundColor: colors.lime,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
  },
  styleToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  styleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  styleBtnActive: {
    backgroundColor: colors.lime,
    borderColor: colors.lime,
  },
  styleBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currencyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  currencyBtnActive: {
    backgroundColor: colors.lime,
  },
  currencyBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  aboutVersion: {
    color: colors.lime,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  aboutDesc: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 6,
  },
  aboutAttribution: {
    color: colors.textMuted,
    fontSize: 10,
    fontStyle: 'italic',
  },
});
