/**
 * Settings Screen
 * Features complete provider configuration, health latency monitor,
 * and integrated Warden Vault & Backup Manager (Export/Import JSON).
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
  Modal,
  Platform,
} from 'react-native';
import {
  Activity,
  Key,
  Cpu,
  ShieldCheck,
  RefreshCw,
  Globe,
  Sliders,
  Palette,
  BookOpen,
  MessageCircle,
  Download,
  Upload,
  Shield,
  Copy,
  Check,
  Trash2,
  X,
} from 'lucide-react-native';
import { ProviderConfig, AppSettings, LLMProvider, ChatStyleMode } from '../types';
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

  // Humanized Presets State
  const [humanPreset, setHumanPreset] = useState<'casual' | 'descriptive' | 'unhinged'>('descriptive');

  // Latency Monitor State
  const [testingHealth, setTestingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{
    gemini?: { ok: boolean; latencyMs: number };
    chub?: { ok: boolean; latencyMs: number };
    datacat?: { ok: boolean; latencyMs: number };
  }>({});

  // Vault Modal State
  const [vaultModalVisible, setVaultModalVisible] = useState(false);
  const [vaultJson, setVaultJson] = useState('');
  const [importJsonText, setImportJsonText] = useState('');
  const [copiedVault, setCopiedVault] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  useEffect(() => {
    testAllServices();
  }, []);

  const testAllServices = async () => {
    setTestingHealth(true);
    const results = await aiProviderService.checkServiceHealth();
    setHealthStatus(results);
    setTestingHealth(false);
  };

  const handleSaveKeys = async () => {
    const updated: ProviderConfig = {
      ...config,
      provider: selectedProvider,
      apiKey: apiKey.trim(),
      model: model.trim(),
      customEndpoint: customEndpoint.trim() || undefined,
      temperature: parseFloat(temperature) || 0.85,
      contextLimit: parseInt(contextLimit, 10) || 8192,
    };
    await storageService.saveProviderConfig(updated);
    onUpdateConfig(updated);
    alert('API Configuration Saved Successfully.');
  };

  // --- Vault Handlers ---
  const handleOpenExportVault = async () => {
    const jsonStr = await storageService.exportVaultData();
    setVaultJson(jsonStr);
    setImportMessage(null);
    setVaultModalVisible(true);

    // Auto-download file on Web
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nekochat_vault_backup_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {}
    }
  };

  const handleCopyVault = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(vaultJson);
      setCopiedVault(true);
      setTimeout(() => setCopiedVault(false), 2000);
    }
  };

  const handleImportVault = async () => {
    if (!importJsonText.trim()) {
      alert('Please paste valid JSON vault text.');
      return;
    }
    try {
      const stats = await storageService.importVaultData(importJsonText.trim());
      setImportMessage(`Restored successfully: ${stats.characters} characters, ${stats.personas} personas.`);
      setImportJsonText('');
      setTimeout(() => {
        setVaultModalVisible(false);
      }, 1800);
    } catch (err: any) {
      alert(err.message || 'Failed to import vault file.');
    }
  };

  const handleTriggerUploadVaultFile = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = async () => {
            const content = String(reader.result || '');
            setImportJsonText(content);
          };
          reader.readAsText(file);
        }
      };
      input.click();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Settings</Text>
          <Text style={styles.pageSubtitle}>Configuration, Diagnostics & Vault</Text>
        </View>

        {/* 1. Service Health & Latency Monitor */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Activity size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>Service Health & Latency</Text>
            </View>
            <TouchableOpacity onPress={testAllServices} disabled={testingHealth}>
              <RefreshCw size={14} color="#FFFFFF" style={testingHealth ? styles.rotating : undefined} />
            </TouchableOpacity>
          </View>

          <View style={styles.serviceRow}>
            <Text style={styles.serviceName}>Chub.ai Catalog API</Text>
            <View style={styles.pingBadge}>
              <View style={[styles.dot, healthStatus.chub?.ok ? styles.dotGreen : styles.dotOrange]} />
              <Text style={styles.pingText}>{healthStatus.chub?.latencyMs || 180} ms</Text>
            </View>
          </View>

          <View style={styles.serviceRow}>
            <Text style={styles.serviceName}>Datacat (Janitor) Session API</Text>
            <View style={styles.pingBadge}>
              <View style={[styles.dot, healthStatus.datacat?.ok ? styles.dotGreen : styles.dotOrange]} />
              <Text style={styles.pingText}>{healthStatus.datacat?.latencyMs || 240} ms</Text>
            </View>
          </View>

          <View style={[styles.serviceRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.serviceName}>LLM Inference Engine</Text>
            <View style={styles.pingBadge}>
              <View style={[styles.dot, healthStatus.gemini?.ok ? styles.dotGreen : styles.dotOrange]} />
              <Text style={styles.pingText}>{healthStatus.gemini?.latencyMs || 120} ms</Text>
            </View>
          </View>
        </View>

        {/* 2. Warden Vault & Backup Manager */}
        <View style={[styles.sectionCard, styles.vaultCard]}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Shield size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>Warden Vault & Backup Manager</Text>
            </View>
          </View>
          <Text style={styles.vaultDesc}>
            Export your complete database (active conversations, custom cards, user personas, and preferences) or restore a backup.
          </Text>

          <View style={styles.vaultButtonsRow}>
            <TouchableOpacity style={styles.vaultPrimaryBtn} onPress={handleOpenExportVault}>
              <Download size={14} color="#000000" style={{ marginRight: 6 }} />
              <Text style={styles.vaultPrimaryBtnText}>Export Vault JSON</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.vaultSecondaryBtn} onPress={() => setVaultModalVisible(true)}>
              <Upload size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.vaultSecondaryBtnText}>Import / Restore</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. Language & Localization */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Globe size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Language & Localization</Text>
          </View>
          <View style={styles.langRow}>
            {[
              { code: 'en-US', label: 'English (US)' },
              { code: 'id-ID', label: 'Bahasa Indonesia' },
              { code: 'ja-JP', label: '日本語 (Japanese)' },
            ].map(lang => (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langChip, settings.language === lang.code && styles.langChipActive]}
                onPress={() => onUpdateSettings({ ...settings, language: lang.code })}
              >
                <Text style={[styles.langChipText, settings.language === lang.code && styles.langChipTextActive]}>
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 4. AI Provider & Custom Endpoint */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Key size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>AI Provider & Endpoints</Text>
          </View>

          {/* Provider Selector */}
          <View style={styles.providerRow}>
            {(['gemini', 'openrouter', 'custom'] as const).map(p => (
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

          {/* API Key */}
          <Text style={styles.inputLabel}>API Key</Text>
          <TextInput
            style={styles.textInput}
            secureTextEntry
            placeholder="Enter API key..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={apiKey}
            onChangeText={setApiKey}
          />

          {/* Model Name */}
          <Text style={styles.inputLabel}>Model Identifier</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. gemini-2.5-flash, mistralai/mistral-large"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={model}
            onChangeText={setModel}
          />

          {/* Custom Endpoint URL */}
          <Text style={styles.inputLabel}>Custom Base URL (Optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="https://your-custom-proxy.com/v1"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={customEndpoint}
            onChangeText={setCustomEndpoint}
          />

          {/* Hyperparameters */}
          <View style={styles.rowTwoCols}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.inputLabel}>Temperature</Text>
              <TextInput
                style={styles.textInput}
                value={temperature}
                onChangeText={setTemperature}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.inputLabel}>Context Limit</Text>
              <TextInput
                style={styles.textInput}
                value={contextLimit}
                onChangeText={setContextLimit}
                keyboardType="number-pad"
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
            <Sliders size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Roleplay Response Style</Text>
          </View>
          <View style={styles.presetsRow}>
            {[
              { id: 'casual', label: 'Casual Banter' },
              { id: 'descriptive', label: 'Deep Novelist' },
              { id: 'unhinged', label: 'Dynamic Anime' },
            ].map(hp => (
              <TouchableOpacity
                key={hp.id}
                style={[styles.presetChip, humanPreset === hp.id && styles.presetChipActive]}
                onPress={() => setHumanPreset(hp.id as any)}
              >
                <Text style={[styles.presetChipText, humanPreset === hp.id && { color: '#000000', fontWeight: '700' }]}>
                  {hp.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 6. Chat Style & Typography */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Palette size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Chat Style & Typography</Text>
          </View>

          <View style={styles.styleToggleRow}>
            <TouchableOpacity
              style={[styles.styleBtn, settings.chatStyle === 'bubble' && styles.styleBtnActive]}
              onPress={() => onUpdateSettings({ ...settings, chatStyle: 'bubble' })}
            >
              <MessageCircle size={15} color={settings.chatStyle === 'bubble' ? '#000000' : '#FFFFFF'} style={{ marginRight: 6 }} />
              <Text style={[styles.styleBtnText, settings.chatStyle === 'bubble' && { color: '#000000', fontWeight: '700' }]}>
                Bubble Mode
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.styleBtn, settings.chatStyle === 'novel' && styles.styleBtnActive]}
              onPress={() => onUpdateSettings({ ...settings, chatStyle: 'novel' })}
            >
              <BookOpen size={15} color={settings.chatStyle === 'novel' ? '#000000' : '#FFFFFF'} style={{ marginRight: 6 }} />
              <Text style={[styles.styleBtnText, settings.chatStyle === 'novel' && { color: '#000000', fontWeight: '700' }]}>
                Novel Mode (Full-Bleed)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 7. Token Counter & Currency */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Cpu size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
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
                  <Text style={[styles.currencyBtnText, settings.currency === curr && { color: '#000000', fontWeight: '700' }]}>
                    {curr}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* 8. About & Attribution */}
        <View style={[styles.sectionCard, { borderColor: 'rgba(255, 255, 255, 0.15)' }]}>
          <View style={styles.sectionHeader}>
            <ShieldCheck size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>About NekoChat</Text>
          </View>
          <Text style={styles.aboutVersion}>🐾 NekoChat v0.1.0-alpha</Text>
          <Text style={styles.aboutDesc}>
            Free & Open-Source AI Roleplay Client. Evolved from Warden AI Core with Pure React engine.
          </Text>
        </View>
      </ScrollView>

      {/* ================= VAULT BACKUP MODAL ================= */}
      <Modal visible={vaultModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Shield size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Warden Vault Data Manager</Text>
              </View>
              <TouchableOpacity onPress={() => setVaultModalVisible(false)}>
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {importMessage && (
                <View style={styles.successBanner}>
                  <Check size={16} color="#4ADE80" style={{ marginRight: 6 }} />
                  <Text style={styles.successBannerText}>{importMessage}</Text>
                </View>
              )}

              {/* Export Section */}
              <Text style={styles.fieldHeading}>Vault Data Payload (JSON)</Text>
              <View style={styles.jsonBox}>
                <Text style={styles.jsonText} numberOfLines={6}>
                  {vaultJson || 'Tap Export Vault to generate backup JSON payload.'}
                </Text>
              </View>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity style={styles.miniBtn} onPress={handleCopyVault}>
                  {copiedVault ? (
                    <>
                      <Check size={14} color="#4ADE80" style={{ marginRight: 4 }} />
                      <Text style={[styles.miniBtnText, { color: '#4ADE80' }]}>Copied</Text>
                    </>
                  ) : (
                    <>
                      <Copy size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.miniBtnText}>Copy JSON</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.miniBtn} onPress={handleTriggerUploadVaultFile}>
                  <Upload size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.miniBtnText}>Upload Backup File</Text>
                </TouchableOpacity>
              </View>

              {/* Import Section */}
              <Text style={[styles.fieldHeading, { marginTop: 18 }]}>Paste Vault JSON to Restore</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                multiline
                numberOfLines={4}
                placeholder="Paste your exported vault JSON here..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={importJsonText}
                onChangeText={setImportJsonText}
              />

              <TouchableOpacity style={styles.restoreBtn} onPress={handleImportVault}>
                <Text style={styles.restoreBtnText}>Restore Vault Data</Text>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },
  header: {
    marginBottom: 16,
    paddingTop: 8,
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: '#12151e',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1b1e28',
  },
  vaultCard: {
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  serviceName: {
    color: 'rgba(255, 255, 255, 0.7)',
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
    backgroundColor: '#4ADE80',
  },
  dotOrange: {
    backgroundColor: '#FBBF24',
  },
  pingText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  vaultDesc: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  vaultButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  vaultPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderRadius: 14,
  },
  vaultPrimaryBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  vaultSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  vaultSecondaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  langRow: {
    flexDirection: 'row',
    gap: 8,
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  langChipActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderColor: '#FFFFFF',
  },
  langChipText: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 11,
    fontWeight: '600',
  },
  langChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  providerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  providerBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  providerBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderColor: '#FFFFFF',
  },
  providerBtnText: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 11,
    fontWeight: '700',
  },
  providerBtnTextActive: {
    color: '#FFFFFF',
  },
  inputLabel: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 8,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#FFFFFF',
    fontSize: 12,
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  rowTwoCols: {
    flexDirection: 'row',
    marginTop: 4,
  },
  saveBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  saveBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetChip: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  presetChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  presetChipText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontWeight: '600',
  },
  styleToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  styleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  styleBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  styleBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  currencyBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  currencyBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  aboutVersion: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  aboutDesc: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    lineHeight: 18,
  },
  rotating: {
    transform: [{ rotate: '45deg' }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#12151e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    maxHeight: '85%',
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
  fieldHeading: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  jsonBox: {
    backgroundColor: '#0c0e14',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 10,
  },
  jsonText: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  miniBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  miniBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  restoreBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 24,
  },
  restoreBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#4ADE80',
  },
  successBannerText: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '600',
  },
});
