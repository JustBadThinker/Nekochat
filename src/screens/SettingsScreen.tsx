/**
 * SettingsScreen.tsx
 * Bento-OLED Redesign for NekoChat (Pure React Native)
 * Layout requested by user:
 * 1. [Monitor Health & Latency] - BESAR (Large Dashboard on Top)
 * 2. 2-Column Bento Grid below: Each tile opens an interactive Pop-Up Modal
 * 3. Simplified Custom API Key by default with instant Auto-Test Ping
 * 4. Theming & Appearance Modal
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform,
  Linking,
  Image,
} from 'react-native';
import {
  Activity,
  Key,
  Palette,
  ShieldCheck,
  Cpu,
  Users,
  Sparkles,
  RefreshCw,
  Check,
  X,
  Eye,
  EyeOff,
  Download,
  Upload,
  Copy,
  ExternalLink,
  Zap,
  Volume2,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Globe,
  Lock,
  HelpCircle,
} from 'lucide-react-native';
import { ProviderConfig, AppSettings, Persona } from '../types';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { storageService } from '../services/storageService';
import { GLASS } from '../theme/glassTheme';
import { aiProviderService } from '../services/aiProviderService';
import { wardenVaultService } from '../services/wardenVaultService';
import { ttsService, VOICE_PROFILES, TtsConfig, DEFAULT_TTS_CONFIG } from '../services/ttsService';
import { imageGenService, IMAGE_STYLE_OPTIONS, ImageGenConfig, DEFAULT_IMAGE_GEN_CONFIG, ImageStylePreset } from '../services/imageGenService';
import { colors, applyThemePalette, ThemeId, ThemePalette, THEME_PALETTES } from '../theme/colors';
import { UI_SKINS, UiSkinId, getCardSurfaceStyle } from '../theme/skins';
import { APP_VERSION_LABEL } from '../constants/appInfo';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../i18n/LanguageContext';
import { LANGUAGE_OPTIONS, UiLanguage, getDefaultLanguagePrompt } from '../i18n/translations';
import { NekoLogoSvg } from '../components/NekoLogoSvg';
import { BottomSheetModal } from '../components/BottomSheetModal';
import { HelpCenterModal } from '../components/HelpCenterModal';
import { NekoSwitch } from '../components/NekoSwitch';

interface SettingsScreenProps {
  config: ProviderConfig;
  onUpdateConfig: (cfg: ProviderConfig) => void;
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
  onReplayOnboarding?: () => void;
  onScrollDirectionChange?: (visible: boolean) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  config,
  onUpdateConfig,
  settings,
  onUpdateSettings,
  onReplayOnboarding,
  onScrollDirectionChange,
}) => {
  const lastScrollYRef = useRef(0);
  const { palette, skin } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(palette), [palette]);
  // Modal Visibility State
  const [activeModal, setActiveModal] = useState<
    'api' | 'theming' | 'language' | 'passcode' | 'vault' | 'personas' | 'tokens' | 'about' | 'voice' | 'image' | 'help' | null
  >(null);

  const [passcodeEnabledDraft, setPasscodeEnabledDraft] = useState<boolean>(!!settings.passcodeEnabled);
  const [passcodePinDraft, setPasscodePinDraft] = useState<string>(settings.passcodePin || '');
  const [passcodeConfirmDraft, setPasscodeConfirmDraft] = useState<string>(settings.passcodePin || '');
  const [passcodeError, setPasscodeError] = useState<string>('');

  const [selectedUiLang, setSelectedUiLang] = useState<UiLanguage>(settings.uiLanguage || 'en');
  const [autoLangPrompt, setAutoLangPrompt] = useState<boolean>(!!settings.autoLanguagePrompt);
  const [langCustomPrompt, setLangCustomPrompt] = useState<string>(
    settings.languageCustomPrompt || getDefaultLanguagePrompt(settings.uiLanguage || 'en')
  );

  // Health Monitor State (100% Genuine Probes — Zero Mock Data)
  const [testingHealth, setTestingHealth] = useState(false);
  const [hasTested, setHasTested] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{
    llm: { ok: boolean; latencyMs: number; label: string; error?: string };
    chub: { ok: boolean; latencyMs: number; error?: string };
    datacat: { ok: boolean; latencyMs: number; error?: string };
    imageGen: { ok: boolean; latencyMs: number; error?: string };
  }>({
    llm: { ok: false, latencyMs: 0, label: config?.model || 'LLM Engine' },
    chub: { ok: false, latencyMs: 0 },
    datacat: { ok: false, latencyMs: 0 },
    imageGen: { ok: false, latencyMs: 0 },
  });

  // Voice TTS State
  const [ttsConfig, setTtsConfig] = useState<TtsConfig>(DEFAULT_TTS_CONFIG);
  const [isTestingVoice, setIsTestingVoice] = useState(false);

  // Image Gen State
  const [imageConfig, setImageConfig] = useState<ImageGenConfig>(DEFAULT_IMAGE_GEN_CONFIG);
  const [isTestingImage, setIsTestingImage] = useState(false);
  const [imageTestResult, setImageTestResult] = useState<{ ok: boolean; url?: string; error?: string } | null>(null);

  // Multi-Provider Profiles State
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(config.id || 'prov_gemini');
  const [fetchingModels, setFetchingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string }[]>([]);

  // API Config State (Custom Endpoint First)
  const [customEndpoint, setCustomEndpoint] = useState(
    config.customEndpoint || 'https://api.openai.com/v1'
  );
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [model, setModel] = useState(config.model || 'gpt-4o');
  const [showKey, setShowKey] = useState(false);
  const [testingPing, setTestingPing] = useState(false);
  const [pingResult, setPingResult] = useState<{ ok: boolean; latencyMs: number; error?: string } | null>(null);
  const [testingNsfw, setTestingNsfw] = useState(false);
  const [nsfwTestResult, setNsfwTestResult] = useState<{
    ok: boolean;
    supported: boolean;
    latencyMs: number;
    reason?: string;
  } | null>(null);

  // Unified AI Engine Tabs (LLM Text Gen, Scene Art, Voice TTS)
  const [aiModalTab, setAiModalTab] = useState<'llm' | 'image' | 'voice'>('llm');

  // Theming State
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(
    (settings?.theme as ThemeId) || 'midnight'
  );
  const [selectedSkin, setSelectedSkin] = useState<UiSkinId>(
    (settings?.uiSkin as UiSkinId) || 'bento'
  );

  // Vault State
  const [vaultJson, setVaultJson] = useState('');
  const [importJsonText, setImportJsonText] = useState('');
  const [copiedVault, setCopiedVault] = useState(false);
  const [vaultNotice, setVaultNotice] = useState<string | null>(null);

  // Personas State
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<string>('default-user');

  // Token Limits & Advanced Sampling State
  const [contextLimit, setContextLimit] = useState(String(config.contextLimit || 8192));
  const [currency, setCurrency] = useState<'IDR' | 'USD'>('IDR');
  const [showAdvancedSampling, setShowAdvancedSampling] = useState(false);
  const [truncationStrategy, setTruncationStrategy] = useState<'rolling' | 'smart' | 'lorebook'>('smart');
  const [maxTokens, setMaxTokens] = useState<string>(
    config.maxTokens === 0 ? '0' : String(config.maxTokens || '4096')
  );
  const [temperature, setTemperature] = useState<string>(String(config.temperature || '0.7'));
  const [topP, setTopP] = useState<string>(String(config.topP || '0.95'));
  const [repPenalty, setRepPenalty] = useState<string>(String(config.repetitionPenalty || '1.15'));

  useEffect(() => {
    testAllServices();
    loadPersonas();
    loadProviders();
    loadMediaConfigs();
  }, []);

  useEffect(() => {
    if (settings?.theme) {
      setSelectedTheme(settings.theme as any);
    }
  }, [settings?.theme]);

  const loadMediaConfigs = async () => {
    try {
      const tc = await ttsService.loadConfig();
      setTtsConfig(tc);
      const ic = await imageGenService.loadConfig();
      setImageConfig(ic);
    } catch {}
  };

  const handleSaveTtsConfig = async (updates: Partial<TtsConfig>) => {
    const updated = await ttsService.saveConfig(updates);
    setTtsConfig(updated);
  };

  const handleTestVoice = async () => {
    setIsTestingVoice(true);
    try {
      await ttsService.speak('Hello! NekoChat speech synthesis is operational.', 'test_voice_sample', ttsConfig);
    } catch (e: any) {
      alert(`Voice test error: ${e?.message || 'Failed'}`);
    } finally {
      setIsTestingVoice(false);
    }
  };

  const handleSaveImageConfig = async (updates: Partial<ImageGenConfig>) => {
    const updated = await imageGenService.saveConfig(updates);
    setImageConfig(updated);
  };

  const handleTestImageGen = async () => {
    setIsTestingImage(true);
    setImageTestResult(null);
    try {
      const res = await imageGenService.generateImage('masterpiece ultra-detailed anime catgirl with silver hair in neon city', imageConfig);
      setImageTestResult({ ok: true, url: res.imageUrl });
    } catch (err: any) {
      setImageTestResult({ ok: false, error: err.message || 'Image generation failed' });
    } finally {
      setIsTestingImage(false);
    }
  };

  const loadProviders = async () => {
    try {
      const list = await storageService.getProviders();
      setProviders(list);
      const active =
        list.find(p => p.isDefault && p.apiKey) ||
        (config?.apiKey ? config : null) ||
        list.find(p => p.apiKey) ||
        list.find(p => p.isDefault) ||
        list[0];
      if (active) {
        const inferredId =
          active.id ||
          (active.provider === 'openrouter'
            ? 'prov_openrouter'
            : active.provider === 'openai'
            ? 'prov_openai'
            : active.provider === 'custom' || active.customEndpoint
            ? 'prov_custom'
            : 'prov_gemini');
        setSelectedProviderId(inferredId);
        setCustomEndpoint(active.baseUrl || active.customEndpoint || '');
        setApiKey(active.apiKey || '');
        setModel(active.model || active.defaultModel || (inferredId.includes('gemini') ? 'gemini-2.5-flash' : 'gpt-4o-mini'));
      }
    } catch {}
  };

  const handleSelectProvider = (provId: string) => {
    setSelectedProviderId(provId);
    setPingResult(null);
    setAvailableModels([]);

    const found = providers.find(p => p.id === provId);
    if (found) {
      setCustomEndpoint(
        found.baseUrl ||
          found.customEndpoint ||
          (provId === 'prov_openrouter'
            ? 'https://openrouter.ai/api/v1'
            : provId === 'prov_gemini'
            ? ''
            : 'https://api.openai.com/v1')
      );
      setApiKey(found.apiKey || apiKey || '');
      setModel(found.model || found.defaultModel || (provId.includes('gemini') ? 'gemini-2.5-flash' : 'gpt-4o-mini'));
    } else {
      if (provId === 'prov_gemini') {
        setCustomEndpoint('');
        setModel('gemini-2.5-flash');
      } else if (provId === 'prov_openrouter') {
        setCustomEndpoint('https://openrouter.ai/api/v1');
        setModel('anthropic/claude-3.5-sonnet');
      } else if (provId === 'prov_openai') {
        setCustomEndpoint('https://api.openai.com/v1');
        setModel('gpt-4o-mini');
      } else {
        setCustomEndpoint(customEndpoint || 'https://api.openai.com/v1');
        setModel(model || 'gpt-4o-mini');
      }
    }
  };

  const buildUpdatedProviderConfig = (): ProviderConfig => {
    const provType = selectedProviderId.includes('gemini')
      ? 'gemini'
      : selectedProviderId.includes('openrouter')
      ? 'openrouter'
      : selectedProviderId.includes('openai')
      ? 'openai'
      : 'custom';

    const cleanEndpoint = customEndpoint.trim();
    const defaultModelForType =
      provType === 'gemini'
        ? 'gemini-2.5-flash'
        : provType === 'openrouter'
        ? 'anthropic/claude-3.5-sonnet'
        : 'gpt-4o-mini';

    return {
      ...config,
      id: selectedProviderId,
      provider: provType,
      providerType: provType,
      baseUrl: cleanEndpoint,
      customEndpoint: cleanEndpoint,
      apiKey: apiKey.trim(),
      model: model.trim() || defaultModelForType,
      defaultModel: model.trim() || defaultModelForType,
      isDefault: true,
    };
  };

  const persistProviderConfigQuietly = async (): Promise<ProviderConfig> => {
    const updated = buildUpdatedProviderConfig();
    await storageService.upsertProvider(updated);
    await storageService.setDefaultProvider(updated.id || selectedProviderId);
    await storageService.saveProviderConfig(updated);
    onUpdateConfig(updated);
    const refreshed = await storageService.getProviders();
    setProviders(refreshed);
    return updated;
  };

  const handleFetchModels = async () => {
    setFetchingModels(true);
    try {
      const updated = await persistProviderConfigQuietly();
      const list = await aiProviderService.fetchModels(updated);
      setAvailableModels(list);
      if (list.length > 0 && (!model.trim() || (updated.provider !== 'gemini' && /^gemini/i.test(model)))) {
        setModel(list[0].id);
      }
    } catch (err: any) {
      setPingResult({ ok: false, latencyMs: 0, error: err.message });
    } finally {
      setFetchingModels(false);
    }
  };

  const testAllServices = async (overrideCfg?: ProviderConfig) => {
    setTestingHealth(true);
    const results = await aiProviderService.checkServiceHealth(overrideCfg || config);
    setHealthStatus(results);
    setHasTested(true);
    setTestingHealth(false);
  };

  const loadPersonas = async () => {
    try {
      const list = await storageService.getPersonas();
      setPersonas(list);
      const def = list.find(p => p.isDefault) || list[0];
      if (def) setActivePersonaId(def.id);
    } catch {}
  };

  // Auto-Test Ping for Custom API (also persists the config so testing immediately activates it)
  const handleAutoTestPing = async () => {
    setTestingPing(true);
    setPingResult(null);
    const updated = await persistProviderConfigQuietly();

    if (updated.provider === 'gemini' && !updated.customEndpoint) {
      const ping = await aiProviderService.pingService('gemini', updated.apiKey, updated.model);
      setPingResult({
        ok: ping.ok,
        latencyMs: ping.latencyMs,
        error: ping.ok ? undefined : ping.error || 'Invalid Gemini API Key',
      });
    } else if (updated.provider === 'openrouter' && (!updated.customEndpoint || updated.customEndpoint.includes('openrouter.ai'))) {
      const ping = await aiProviderService.pingService('openrouter', updated.apiKey);
      setPingResult({ ok: ping.ok, latencyMs: ping.latencyMs, error: ping.ok ? undefined : 'Invalid OpenRouter Key' });
    } else {
      const res = await aiProviderService.pingCustomEndpoint(updated.customEndpoint || 'https://api.openai.com/v1', updated.apiKey, updated.model);
      setPingResult(res);
    }
    setTestingPing(false);
  };

  // Test whether the active model/endpoint allows consenting adult (18+) NSFW roleplay
  const handleTestNsfwCapability = async () => {
    setTestingNsfw(true);
    setNsfwTestResult(null);
    const updated = await persistProviderConfigQuietly();
    const res = await aiProviderService.testNsfwCapability(updated);
    setNsfwTestResult(res);
    setTestingNsfw(false);
  };

  const handleSaveApi = async () => {
    const updated = await persistProviderConfigQuietly();
    setActiveModal(null);
    testAllServices(updated);
  };

  const handleOpenExportVault = async () => {
    const jsonStr = await storageService.exportVaultData();
    setVaultJson(jsonStr);
    setVaultNotice('Vault backup ready to copy or download.');
  };

  const handleDownloadVaultFile = async () => {
    const jsonStr = vaultJson || (await storageService.exportVaultData());
    setVaultJson(jsonStr);

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nekochat_vault_${Date.now()}.neko`;
        a.click();
        URL.revokeObjectURL(url);
        setVaultNotice('Sanitized backup file (.neko) downloaded successfully!');
      } catch (err: any) {
        setVaultNotice(`Download error: ${err.message}`);
      }
    } else {
      // Native Mobile (Android APK & iOS) - offline zero-hosting file export
      try {
        const fileUri = `${FileSystem.cacheDirectory}nekochat_vault_${Date.now()}.neko`;
        await FileSystem.writeAsStringAsync(fileUri, jsonStr, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Save NekoChat Backup (.neko)',
          UTI: 'public.json',
        });
        setVaultNotice('Backup saved successfully via native share sheet!');
      } catch (err: any) {
        setVaultNotice(`Export error: ${err.message}`);
      }
    }
  };

  const handlePickVaultFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/json', '*/*'],
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        const file = res.assets[0];
        let content = '';
        if (Platform.OS === 'web' && file.file) {
          content = await file.file.text();
        } else if (file.uri) {
          content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
        }
        if (content) {
          setImportJsonText(content);
          setVaultNotice(`Loaded "${file.name || 'backup'}". Tap "Restore / Import Backup" below.`);
        }
      }
    } catch (err: any) {
      setVaultNotice(`File picker error: ${err.message}`);
    }
  };

  const handleSelectThemeInstant = async (themeId: ThemeId) => {
    setSelectedTheme(themeId);
    applyThemePalette(themeId);
    const updated: AppSettings = { ...settings, theme: themeId };
    await storageService.saveSettings(updated);
    onUpdateSettings(updated);
  };

  const handleSelectSkinInstant = async (skinId: UiSkinId) => {
    setSelectedSkin(skinId);
    const updated: AppSettings = { ...settings, uiSkin: skinId };
    await storageService.saveSettings(updated);
    onUpdateSettings(updated);
  };

  const handleApplyTheme = async () => {
    applyThemePalette(selectedTheme);
    const updated: AppSettings = { ...settings, theme: selectedTheme as any };
    await storageService.saveSettings(updated);
    onUpdateSettings(updated);
    setActiveModal(null);
  };

  const handleSelectUiLanguage = async (lang: UiLanguage) => {
    const prevDefault = getDefaultLanguagePrompt(selectedUiLang);
    const isUsingDefault =
      !langCustomPrompt.trim() || langCustomPrompt.trim() === prevDefault.trim();
    const nextPrompt = isUsingDefault ? getDefaultLanguagePrompt(lang) : langCustomPrompt;

    setSelectedUiLang(lang);
    setLangCustomPrompt(nextPrompt);

    const updated: AppSettings = {
      ...settings,
      uiLanguage: lang,
      autoLanguagePrompt: autoLangPrompt,
      languageCustomPrompt: nextPrompt,
    };
    await storageService.saveSettings(updated);
    onUpdateSettings(updated);
  };

  const handleSaveLanguageSettings = async () => {
    const updated: AppSettings = {
      ...settings,
      uiLanguage: selectedUiLang,
      autoLanguagePrompt: autoLangPrompt,
      languageCustomPrompt: langCustomPrompt.trim() || getDefaultLanguagePrompt(selectedUiLang),
    };
    await storageService.saveSettings(updated);
    onUpdateSettings(updated);
    setActiveModal(null);
  };

  const handleCopyVault = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(vaultJson);
      setCopiedVault(true);
      setTimeout(() => setCopiedVault(false), 2000);
    }
  };

  const handleImportVault = async () => {
    if (!importJsonText.trim()) return;
    try {
      const trimmed = importJsonText.trim();
      if (trimmed.includes('WARDEN_VAULT_V1') || trimmed.includes('"format":"warden"') || trimmed.includes('"format": "warden"')) {
        const res = await wardenVaultService.importVault(trimmed);
        if (res.success) {
          setVaultNotice(`Restored from .warden vault: ${res.stats.charactersAdded} companions, ${res.stats.personasAdded} personas, ${res.stats.conversationsAdded} chats.`);
          setImportJsonText('');
          setTimeout(() => setActiveModal(null), 1500);
          return;
        } else {
          setVaultNotice(`Import error: ${res.error || 'Failed to decrypt .warden vault'}`);
          return;
        }
      }
      const stats = await storageService.importVaultData(trimmed);
      setVaultNotice(`Restored: ${stats.characters} companions, ${stats.personas} personas.`);
      setImportJsonText('');
      setTimeout(() => setActiveModal(null), 1500);
    } catch (err: any) {
      setVaultNotice(`Import error: ${err.message || 'Invalid format'}`);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.bgDark }]}
      contentContainerStyle={styles.contentContainer}
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
      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 1. LARGE HEALTH & LATENCY MONITOR DASHBOARD (User Requested)        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <View style={[styles.healthCardBig, { backgroundColor: palette.bgSurface }]}>
        <View style={styles.healthCardHeader}>
          <View style={styles.healthTitleRow}>
            <Activity size={18} color={palette.accent} style={{ marginRight: 8 }} />
            <Text style={styles.healthTitle}>{t('settings.healthTitle')}</Text>
          </View>

          <TouchableOpacity
            style={styles.healthPingBtn}
            onPress={() => { testAllServices(); }}
            disabled={testingHealth}
            activeOpacity={0.8}
          >
            <RefreshCw
              size={12}
              color="#000000"
              style={[testingHealth && { transform: [{ rotate: '45deg' }] }, { marginRight: 4 }]}
            />
            <Text style={styles.healthPingBtnText}>
              {testingHealth ? 'Testing...' : 'Test All'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 4 Health Status Bars (100% Real Live Readings — Zero Fake Latency) */}
        <View style={styles.healthGrid}>
          {/* Service 1: Active LLM Engine */}
          <View style={styles.healthItemBox}>
            <View style={styles.healthItemTop}>
              <View
                style={
                  !hasTested
                    ? styles.statusDotGray
                    : healthStatus.llm.ok
                    ? styles.statusDotGreen
                    : styles.statusDotRed
                }
              />
              <Text style={styles.healthItemName} numberOfLines={1}>
                LLM Engine ({healthStatus.llm.label})
              </Text>
            </View>
            <Text style={healthStatus.llm.ok ? styles.latencyText : styles.latencyTextOffline}>
              {!hasTested ? 'Testing...' : healthStatus.llm.ok ? `${healthStatus.llm.latencyMs}ms` : 'Offline'}
            </Text>
            <Text style={styles.statusLabelText} numberOfLines={1}>
              {!hasTested
                ? 'Testing connection...'
                : healthStatus.llm.ok
                ? '🟢 Optimal Connection'
                : `🔴 ${healthStatus.llm.error || 'Check API Key'}`}
            </Text>
          </View>

          {/* Service 2: Chub.ai Community API */}
          <View style={styles.healthItemBox}>
            <View style={styles.healthItemTop}>
              <View
                style={
                  !hasTested
                    ? styles.statusDotGray
                    : healthStatus.chub.ok
                    ? styles.statusDotGreen
                    : styles.statusDotRed
                }
              />
              <Text style={styles.healthItemName} numberOfLines={1}>
                Chub.ai Catalog
              </Text>
            </View>
            <Text style={healthStatus.chub.ok ? styles.latencyText : styles.latencyTextOffline}>
              {!hasTested ? 'Testing...' : healthStatus.chub.ok ? `${healthStatus.chub.latencyMs}ms` : 'Offline'}
            </Text>
            <Text style={styles.statusLabelText} numberOfLines={1}>
              {!hasTested
                ? 'Testing connection...'
                : healthStatus.chub.ok
                ? '🟢 Online & Synced'
                : `🔴 ${healthStatus.chub.error || 'Catalog Unreachable'}`}
            </Text>
          </View>

          {/* Service 3: Datacat Janitor Mirror */}
          <View style={styles.healthItemBox}>
            <View style={styles.healthItemTop}>
              <View
                style={
                  !hasTested
                    ? styles.statusDotGray
                    : healthStatus.datacat.ok
                    ? styles.statusDotGreen
                    : styles.statusDotRed
                }
              />
              <Text style={styles.healthItemName} numberOfLines={1}>
                Datacat / Janitor
              </Text>
            </View>
            <Text style={healthStatus.datacat.ok ? styles.latencyText : styles.latencyTextOffline}>
              {!hasTested ? 'Testing...' : healthStatus.datacat.ok ? `${healthStatus.datacat.latencyMs}ms` : 'Offline'}
            </Text>
            <Text style={styles.statusLabelText} numberOfLines={1}>
              {!hasTested
                ? 'Testing connection...'
                : healthStatus.datacat.ok
                ? '🟢 Connected Session'
                : `🔴 ${healthStatus.datacat.error || 'Proxy Offline (Port 3001)'}`}
            </Text>
          </View>

          {/* Service 4: Image Generation Engine */}
          <View style={styles.healthItemBox}>
            <View style={styles.healthItemTop}>
              <View
                style={
                  !hasTested
                    ? styles.statusDotGray
                    : healthStatus.imageGen.ok
                    ? styles.statusDotGreen
                    : styles.statusDotRed
                }
              />
              <Text style={styles.healthItemName} numberOfLines={1}>
                Image Gen (Flux)
              </Text>
            </View>
            <Text style={healthStatus.imageGen.ok ? styles.latencyText : styles.latencyTextOffline}>
              {!hasTested ? 'Testing...' : healthStatus.imageGen.ok ? `${healthStatus.imageGen.latencyMs}ms` : 'Offline'}
            </Text>
            <Text style={styles.statusLabelText} numberOfLines={1}>
              {!hasTested
                ? 'Testing connection...'
                : healthStatus.imageGen.ok
                ? '🟢 Ready for Render'
                : `🔴 ${healthStatus.imageGen.error || 'Image Service Offline'}`}
            </Text>
          </View>
        </View>
      </View>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 2. ADAPTIVE CONTROL PANEL (Bento Grid / M3 List / iOS InsetGrouped)*/}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Text style={styles.gridSectionHeading}>{t('settings.controlPanel')}</Text>

      {(() => {
        const controlItems = [
          {
            key: 'api',
            Icon: Key,
            title: t('settings.aiEngine'),
            subtitle: t('settings.aiEngineSub'),
            badge: '3 Engines Active',
            accentBadge: true,
            onPress: () => {
              setAiModalTab('llm');
              setActiveModal('api');
            },
          },
          {
            key: 'theming',
            Icon: Palette,
            title: t('settings.theming'),
            subtitle: t('settings.themingSub'),
            badge: `${skin.badge} • ${selectedTheme.charAt(0).toUpperCase() + selectedTheme.slice(1)}`,
            accentBadge: false,
            onPress: () => setActiveModal('theming'),
          },
          {
            key: 'vault',
            Icon: ShieldCheck,
            title: t('settings.dataVault'),
            subtitle: t('settings.dataVaultSub'),
            badge: 'Sanitized',
            accentBadge: false,
            onPress: () => setActiveModal('vault'),
          },
          {
            key: 'personas',
            Icon: Users,
            title: t('settings.personas'),
            subtitle: t('settings.personasSub'),
            badge: `${personas.length} ${t('studio.personas')}`,
            accentBadge: false,
            onPress: () => setActiveModal('personas'),
          },
          {
            key: 'tokens',
            Icon: Cpu,
            title: t('settings.tokens'),
            subtitle: t('settings.tokensSub'),
            badge: `${contextLimit} BPE`,
            accentBadge: false,
            onPress: () => setActiveModal('tokens'),
          },
          {
            key: 'language',
            Icon: Globe,
            title:
              t('nav.settings') === 'Pengaturan'
                ? 'Bahasa'
                : t('nav.settings') === '設定'
                  ? '言語'
                  : t('nav.settings') === 'Paramètres'
                    ? 'Langue'
                    : 'Language',
            subtitle: t('settings.languageSub'),
            badge: `${(LANGUAGE_OPTIONS.find(l => l.id === selectedUiLang) || LANGUAGE_OPTIONS[0]).flag} ${(LANGUAGE_OPTIONS.find(l => l.id === selectedUiLang) || LANGUAGE_OPTIONS[0]).nativeName}`,
            accentBadge: false,
            onPress: () => setActiveModal('language'),
          },
          {
            key: 'passcode',
            Icon: Lock,
            title: 'Passcode Lock',
            subtitle: 'App PIN & First-Time Tour',
            badge: settings.passcodeEnabled && settings.passcodePin ? 'Enabled' : 'Off',
            accentBadge: false,
            onPress: () => {
              setPasscodeEnabledDraft(!!settings.passcodeEnabled);
              setPasscodePinDraft(settings.passcodePin || '');
              setPasscodeConfirmDraft(settings.passcodePin || '');
              setPasscodeError('');
              setActiveModal('passcode');
            },
          },
          {
            key: 'help',
            Icon: HelpCircle,
            title: 'Help & Guides',
            subtitle: 'Lorebooks, BYOK, Skins & Tips',
            badge: '6 Guides',
            accentBadge: true,
            onPress: () => setActiveModal('help'),
          },
          {
            key: 'about',
            Icon: Sparkles,
            title: t('settings.about'),
            subtitle: `${APP_VERSION_LABEL} • Open-Source`,
            badge: 'FOSS',
            accentBadge: false,
            onPress: () => setActiveModal('about'),
          },
        ];

        if (skin.settingsLayout === 'ios_inset_grouped') {
          return (
            <View
              style={{
                borderRadius: 12,
                backgroundColor: 'rgba(28, 28, 30, 0.86)',
                borderWidth: 0.5,
                borderColor: 'rgba(255, 255, 255, 0.14)',
                overflow: 'hidden',
                marginBottom: 16,
              }}
            >
              {controlItems.map((item, idx) => {
                const IconComp = item.Icon;
                return (
                  <TouchableOpacity
                    key={item.key}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      borderBottomWidth: idx < controlItems.length - 1 ? 0.5 : 0,
                      borderBottomColor: 'rgba(255, 255, 255, 0.1)',
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 7,
                        backgroundColor: item.accentBadge ? palette.accent : `rgba(${palette.accentRgb}, 0.18)`,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <IconComp size={16} color={item.accentBadge ? '#000000' : palette.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '500' }}>{item.title}</Text>
                      <Text style={{ color: 'rgba(235, 235, 245, 0.55)', fontSize: 12, marginTop: 1 }} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    </View>
                    <Text style={{ color: 'rgba(235, 235, 245, 0.5)', fontSize: 13, marginRight: 2 }} numberOfLines={1}>
                      {item.badge}
                    </Text>
                    <ChevronRight size={16} color="rgba(235, 235, 245, 0.35)" />
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        }

        if (skin.settingsLayout === 'm3_list') {
          return (
            <View style={{ gap: 10, marginBottom: 16 }}>
              {controlItems.map(item => {
                const IconComp = item.Icon;
                return (
                  <TouchableOpacity
                    key={item.key}
                    onPress={item.onPress}
                    activeOpacity={0.85}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderRadius: skin.cardRadius,
                      backgroundColor: palette.bgSurfaceSubtle,
                      gap: 14,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: `rgba(${palette.accentRgb}, 0.16)`,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <IconComp size={18} color={palette.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>{item.title}</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 8,
                        backgroundColor: item.accentBadge
                          ? `rgba(${palette.accentRgb}, 0.22)`
                          : 'rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: item.accentBadge ? palette.accent : '#cbd5e1',
                        }}
                      >
                        {item.badge}
                      </Text>
                    </View>
                    <ChevronRight size={18} color="#94a3b8" />
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        }

        return (
          <View style={styles.bentoTwoGrid}>
            {controlItems.map(item => {
              const IconComp = item.Icon;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.bentoTile, getCardSurfaceStyle(palette, skin)]}
                  onPress={item.onPress}
                  activeOpacity={0.8}
                >
                  <View style={[styles.tileIconCircle, { borderRadius: skin.pillRadius === 999 ? 18 : 10 }]}>
                    <IconComp size={18} color={palette.accent} />
                  </View>
                  <Text style={styles.tileTitle}>{item.title}</Text>
                  <Text style={styles.tileSubtitle}>{item.subtitle}</Text>
                  <View
                    style={[
                      item.accentBadge ? styles.tileBadgeLime : styles.tileBadge,
                      { borderRadius: skin.pillRadius },
                    ]}
                  >
                    <Text style={item.accentBadge ? styles.tileBadgeLimeText : styles.tileBadgeText}>
                      {item.badge}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 3. MODALS / POP-UPS (Triggered on Tile Click)                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      {/* MODAL 1: API Key & Custom Endpoint with Instant Auto-Test */}
      <BottomSheetModal visible={activeModal === 'api'} onClose={() => setActiveModal(null)} sheetStyle={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Key size={16} color={palette.accent} style={{ marginRight: 6 }} />
                <Text style={styles.modalTitle}>{t('settings.aiModalTitle')}</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <X size={16} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* AI Engine Sub-Tabs: [ 🧠 Text LLM ] | [ 🎨 Scene Art ] | [ 🎙️ Voice TTS ] */}
            <View style={{ flexDirection: 'row', gap: 6, marginHorizontal: 20, marginBottom: 12, marginTop: 4 }}>
              {[
                { id: 'llm', label: `🧠 ${t('settings.textLlm')}` },
                { id: 'image', label: `🎨 ${t('settings.sceneArt')}` },
                { id: 'voice', label: `🎙️ ${t('settings.voiceTts')}` },
              ].map(tb => {
                const isActive = aiModalTab === tb.id;
                return (
                  <TouchableOpacity
                    key={tb.id}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 10,
                      alignItems: 'center',
                      backgroundColor: isActive ? palette.accent : 'rgba(255, 255, 255, 0.05)',
                      borderWidth: 1,
                      borderColor: isActive ? palette.accent : 'rgba(255, 255, 255, 0.1)',
                    }}
                    onPress={() => setAiModalTab(tb.id as any)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: isActive ? palette.bgDark : '#9ca3af' }}>
                      {tb.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <ScrollView style={styles.modalBody}>
              {aiModalTab === 'llm' && (
                <>
                  <Text style={styles.inputLabel}>{t('settings.selectProvider')}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
                    {[
                      { id: 'prov_gemini', name: 'Gemini' },
                      { id: 'prov_openrouter', name: 'OpenRouter' },
                      { id: 'prov_openai', name: 'OpenAI' },
                      { id: 'prov_custom', name: 'Custom Proxy' },
                    ].map(p => {
                      const isActive = selectedProviderId === p.id;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={{
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 10,
                            alignItems: 'center',
                            backgroundColor: isActive ? `rgba(${palette.accentRgb}, 0.15)` : 'rgba(255, 255, 255, 0.05)',
                            borderWidth: 1,
                            borderColor: isActive ? palette.accent : 'rgba(255, 255, 255, 0.1)',
                          }}
                          onPress={() => handleSelectProvider(p.id)}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: isActive ? palette.accent : '#9ca3af' }}>
                            {p.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {selectedProviderId !== 'prov_gemini' && (
                    <>
                      <Text style={styles.inputLabel}>{t('settings.baseUrl')}</Text>
                      <TextInput
                        style={styles.inputBox}
                        value={customEndpoint}
                        onChangeText={setCustomEndpoint}
                        placeholder="https://api.openai.com/v1"
                        placeholderTextColor="#6b7280"
                        autoCapitalize="none"
                      />
                    </>
                  )}

                  <Text style={styles.inputLabel}>{t('settings.apiKey')}</Text>
                  <View style={styles.inputPasswordRow}>
                    <TextInput
                      style={styles.inputPasswordText}
                      value={apiKey}
                      onChangeText={setApiKey}
                      placeholder="sk-..."
                      placeholderTextColor="#6b7280"
                      secureTextEntry={!showKey}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity onPress={() => setShowKey(!showKey)} style={{ padding: 6 }}>
                      {showKey ? <EyeOff size={16} color="#9ca3af" /> : <Eye size={16} color="#9ca3af" />}
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                    <Text style={styles.inputLabel}>{t('settings.modelId')}</Text>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      onPress={handleFetchModels}
                      disabled={fetchingModels}
                    >
                      {fetchingModels ? (
                        <ActivityIndicator size="small" color={palette.accent} />
                      ) : (
                        <>
                          <RefreshCw size={12} color={palette.accent} />
                          <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '700' }}>{t('settings.fetchModels')}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.inputBox}
                    value={model}
                    onChangeText={setModel}
                    placeholder="gpt-4o, claude-3-5-sonnet, deepseek-v3"
                    placeholderTextColor="#6b7280"
                    autoCapitalize="none"
                  />

                  {availableModels.length > 0 && (
                    <View style={{ marginTop: 8, marginBottom: 12 }}>
                      <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 11, marginBottom: 6 }}>
                        Select from fetched catalog:
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                        {availableModels.slice(0, 15).map(m => (
                          <TouchableOpacity
                            key={m.id}
                            style={{
                              backgroundColor: model === m.id ? palette.accent : 'rgba(255, 255, 255, 0.06)',
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 8,
                              marginRight: 6,
                            }}
                            onPress={() => setModel(m.id)}
                          >
                            <Text style={{ color: model === m.id ? '#000' : '#fff', fontSize: 11, fontWeight: '600' }}>
                              {m.name || m.id}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Instant Auto-Test Ping Button */}
                  <TouchableOpacity
                    style={styles.autoTestBtn}
                    onPress={handleAutoTestPing}
                    disabled={testingPing}
                    activeOpacity={0.8}
                  >
                    <Zap size={14} color="#000000" style={{ marginRight: 6 }} />
                    <Text style={styles.autoTestBtnText}>
                      {testingPing ? 'Pinging...' : `⚡ ${t('settings.testConn')}`}
                    </Text>
                  </TouchableOpacity>

                  {pingResult && (
                    <View
                      style={[
                        styles.pingResultBox,
                        pingResult.ok ? styles.pingSuccess : styles.pingFailure,
                      ]}
                    >
                      <Text style={pingResult.ok ? styles.pingTextSuccess : styles.pingTextFailure}>
                        {pingResult.ok
                          ? `✓ Connection Successful (${pingResult.latencyMs}ms)`
                          : `✕ Ping Failed: ${pingResult.error || 'Check URL and Key'}`}
                      </Text>
                    </View>
                  )}

                  {/* NSFW / 18+ Roleplay Capability Test */}
                  <TouchableOpacity
                    style={[
                      styles.autoTestBtn,
                      {
                        marginTop: 8,
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        borderWidth: 1,
                        borderColor: colors.borderSubtle,
                      },
                    ]}
                    onPress={handleTestNsfwCapability}
                    disabled={testingNsfw || testingPing}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.autoTestBtnText, { color: colors.textPrimary }]}>
                      {testingNsfw ? 'Testing NSFW Capability...' : '🔞 Test NSFW Support'}
                    </Text>
                  </TouchableOpacity>

                  {nsfwTestResult && (
                    <View
                      style={[
                        styles.pingResultBox,
                        nsfwTestResult.ok && nsfwTestResult.supported
                          ? styles.pingSuccess
                          : styles.pingFailure,
                      ]}
                    >
                      <Text
                        style={
                          nsfwTestResult.ok && nsfwTestResult.supported
                            ? styles.pingTextSuccess
                            : styles.pingTextFailure
                        }
                      >
                        {!nsfwTestResult.ok
                          ? `✕ Test Failed: ${nsfwTestResult.reason || 'Check URL and Key'}`
                          : nsfwTestResult.supported
                            ? `✓ NSFW / 18+ Roleplay Supported (${nsfwTestResult.latencyMs}ms)`
                            : `✕ This model does not support NSFW (${nsfwTestResult.reason || 'Blocked by model'})`}
                      </Text>
                    </View>
                  )}
                </>
              )}

              {aiModalTab === 'image' && (
                <>
                  {/* Enable Toggle */}
                  <TouchableOpacity
                    style={styles.toggleRow}
                    onPress={() => handleSaveImageConfig({ enabled: !imageConfig.enabled })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.toggleTitle}>Enable Scene Art Generation</Text>
                      <Text style={styles.toggleDesc}>Depict visual scenes from roleplay context</Text>
                    </View>
                    <View style={[styles.toggleSwitch, imageConfig.enabled && styles.toggleSwitchActive]}>
                      <View style={[styles.toggleThumb, imageConfig.enabled && styles.toggleThumbActive]} />
                    </View>
                  </TouchableOpacity>

                  {/* Provider Selection */}
                  <Text style={[styles.sectionSub, { marginTop: 14 }]}>Image Provider Engine</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                    {[
                      { id: 'pollinations', label: 'Pollinations (Zero-Key)' },
                      { id: 'openai', label: 'OpenAI DALL-E' },
                      { id: 'custom', label: 'Flux / Custom' },
                    ].map(p => {
                      const isSel = imageConfig.provider === p.id;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={[styles.radioChip, isSel && styles.radioChipActive]}
                          onPress={() => handleSaveImageConfig({ provider: p.id as any })}
                        >
                          <Text style={[styles.radioChipText, isSel && styles.radioChipTextActive]}>
                            {p.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {imageConfig.provider !== 'pollinations' && (
                    <>
                      <Text style={styles.inputLabel}>Base URL / Endpoint</Text>
                      <TextInput
                        style={styles.inputBox}
                        placeholder="https://api.openai.com/v1"
                        placeholderTextColor="#666"
                        value={imageConfig.baseUrl}
                        onChangeText={v => handleSaveImageConfig({ baseUrl: v })}
                      />

                      <Text style={styles.inputLabel}>API Key</Text>
                      <TextInput
                        style={styles.inputBox}
                        placeholder="sk-..."
                        placeholderTextColor="#666"
                        secureTextEntry
                        value={imageConfig.apiKey}
                        onChangeText={v => handleSaveImageConfig({ apiKey: v })}
                      />

                      <Text style={styles.inputLabel}>Model Name</Text>
                      <TextInput
                        style={styles.inputBox}
                        placeholder={imageConfig.provider === 'openai' ? 'dall-e-3' : 'flux-schnell'}
                        placeholderTextColor="#666"
                        value={imageConfig.model}
                        onChangeText={v => handleSaveImageConfig({ model: v })}
                      />
                    </>
                  )}

                  {/* Test Generate Image Button */}
                  <TouchableOpacity
                    style={[styles.autoTestBtn, { marginTop: 16 }]}
                    onPress={handleTestImageGen}
                    disabled={isTestingImage}
                    activeOpacity={0.8}
                  >
                    {isTestingImage ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <>
                        <ImageIcon size={14} color="#000000" style={{ marginRight: 6 }} />
                        <Text style={styles.autoTestBtnText}>🎨 Test Generate Sample Scene</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {imageTestResult && (
                    <View style={{ marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: imageTestResult.ok ? `rgba(${palette.accentRgb}, 0.1)` : 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: imageTestResult.ok ? palette.accent : '#ef4444' }}>
                      <Text style={{ color: imageTestResult.ok ? palette.accent : '#ef4444', fontSize: 12, fontWeight: '700' }}>
                        {imageTestResult.ok ? '✓ Image Generation Operational!' : `✕ Error: ${imageTestResult.error}`}
                      </Text>
                    </View>
                  )}
                </>
              )}

              {aiModalTab === 'voice' && (
                <>
                  {/* Enable Toggle */}
                  <TouchableOpacity
                    style={styles.toggleRow}
                    onPress={() => handleSaveTtsConfig({ enabled: !ttsConfig.enabled })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.toggleTitle}>Enable Speech Synthesis</Text>
                      <Text style={styles.toggleDesc}>Character voice playback on companion messages</Text>
                    </View>
                    <View style={[styles.toggleSwitch, ttsConfig.enabled && styles.toggleSwitchActive]}>
                      <View style={[styles.toggleThumb, ttsConfig.enabled && styles.toggleThumbActive]} />
                    </View>
                  </TouchableOpacity>

                  {/* Dialogue Only Toggle */}
                  <TouchableOpacity
                    style={styles.toggleRow}
                    onPress={() => handleSaveTtsConfig({ dialogueOnly: !ttsConfig.dialogueOnly })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.toggleTitle}>Dialogue Only</Text>
                      <Text style={styles.toggleDesc}>Reads spoken quotes {'"..."'} and skips asterisk actions *...*</Text>
                    </View>
                    <View style={[styles.toggleSwitch, ttsConfig.dialogueOnly && styles.toggleSwitchActive]}>
                      <View style={[styles.toggleThumb, ttsConfig.dialogueOnly && styles.toggleThumbActive]} />
                    </View>
                  </TouchableOpacity>

                  {/* Speed Preset Selector */}
                  <Text style={[styles.sectionSub, { marginTop: 14 }]}>Playback Speed</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                    {[0.8, 1.0, 1.2, 1.4].map(spd => {
                      const isSel = Math.abs(ttsConfig.speed - spd) < 0.05;
                      return (
                        <TouchableOpacity
                          key={`spd_${spd}`}
                          style={[styles.radioChip, isSel && styles.radioChipActive]}
                          onPress={() => handleSaveTtsConfig({ speed: spd })}
                        >
                          <Text style={[styles.radioChipText, isSel && styles.radioChipTextActive]}>
                            {spd}x
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Test Voice Button */}
                  <TouchableOpacity
                    style={[styles.autoTestBtn, { marginTop: 16 }]}
                    onPress={handleTestVoice}
                    disabled={isTestingVoice}
                    activeOpacity={0.8}
                  >
                    {isTestingVoice ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <>
                        <Volume2 size={14} color="#000000" style={{ marginRight: 6 }} />
                        <Text style={styles.autoTestBtnText}>🎙️ Test Voice Speech</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveApi}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>
                  {aiModalTab === 'llm' ? t('settings.saveApi') : t('chats.done')}
                </Text>
              </TouchableOpacity>
            </View>
      </BottomSheetModal>

      {/* MODAL 2: Theming & Visuals */}
      <BottomSheetModal visible={activeModal === 'theming'} onClose={() => setActiveModal(null)} sheetStyle={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Palette size={16} color={palette.accent} style={{ marginRight: 6 }} />
                <Text style={styles.modalTitle}>Theming & Appearance</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <X size={16} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.sectionSub}>UI Design & Surface Skin (Applies Instantly)</Text>
              {Object.values(UI_SKINS).map(sk => {
                const isSelected = selectedSkin === sk.id;
                return (
                  <TouchableOpacity
                    key={sk.id}
                    style={[
                      styles.themeOptionCard,
                      { borderRadius: sk.cardRadius },
                      isSelected && [styles.themeOptionActive, { borderColor: palette.accent }],
                    ]}
                    onPress={() => handleSelectSkinInstant(sk.id)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: sk.cardRadius > 20 ? 16 : sk.cardRadius * 0.65,
                          backgroundColor: palette.bgDark,
                          borderWidth: Math.max(1, sk.cardBorderWidth),
                          borderColor: isSelected ? palette.accent : `rgba(${palette.accentRgb}, 0.4)`,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '800' }}>
                          {sk.badge}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.themeOptionName, isSelected && { color: palette.accent }]}>
                          {sk.name}
                        </Text>
                        <Text style={styles.themeOptionDesc}>{sk.desc}</Text>
                      </View>
                    </View>
                    {isSelected && <Check size={16} color={palette.accent} />}
                  </TouchableOpacity>
                );
              })}

              <Text style={[styles.sectionSub, { marginTop: 14 }]}>{t('settings.selectThemeSub')}</Text>
              {Object.values(THEME_PALETTES).map(th => {
                const isSelected = selectedTheme === th.id;
                return (
                  <TouchableOpacity
                    key={th.id}
                    style={[
                      styles.themeOptionCard,
                      isSelected && [styles.themeOptionActive, { borderColor: th.accent }],
                    ]}
                    onPress={() => handleSelectThemeInstant(th.id)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          backgroundColor: th.bgDark,
                          borderWidth: 1.5,
                          borderColor: th.accent,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <NekoLogoSvg size={30} color={th.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.themeOptionName, isSelected && { color: th.accent }]}>
                          {th.name}
                        </Text>
                        <Text style={styles.themeOptionDesc}>{th.desc}</Text>
                      </View>
                    </View>
                    {isSelected && <Check size={16} color={th.accent} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleApplyTheme}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>{t('settings.applyTheme')}</Text>
              </TouchableOpacity>
            </View>
      </BottomSheetModal>

      {/* MODAL: Language & AI Auto-Prompt */}
      <BottomSheetModal visible={activeModal === 'language'} onClose={() => setActiveModal(null)} sheetStyle={styles.modalSheet}>
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleRow}>
            <Globe size={16} color={palette.accent} style={{ marginRight: 6 }} />
            <Text style={styles.modalTitle}>{t('settings.languageTitle')}</Text>
          </View>
          <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionSub}>{t('settings.languageSub')}</Text>

          {/* 4 Language Options: English, Japanese, French, Indonesian */}
          <View style={{ gap: 8, marginBottom: 16 }}>
            {LANGUAGE_OPTIONS.map(opt => {
              const isSelected = selectedUiLang === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.themeOptionCard,
                    isSelected && [styles.themeOptionActive, { borderColor: palette.accent, backgroundColor: `rgba(${palette.accentRgb}, 0.1)` }],
                  ]}
                  onPress={() => handleSelectUiLanguage(opt.id)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 18 }}>{opt.flag}</Text>
                    <View>
                      <Text style={[styles.themeOptionName, isSelected && { color: palette.accent }]}>{opt.nativeName}</Text>
                      <Text style={styles.themeOptionDesc}>{opt.name}</Text>
                    </View>
                  </View>
                  {isSelected && <Check size={16} color={palette.accent} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Auto-add language prompt toggle */}
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
              marginBottom: 14,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#f8fafc', fontSize: 13.5, fontWeight: '700' }}>
                  {t('settings.autoPromptLabel')}
                </Text>
                <Text style={{ color: '#94a3b8', fontSize: 11.5, marginTop: 3, lineHeight: 16 }}>
                  {t('settings.autoPromptHint')}
                </Text>
              </View>
              <NekoSwitch
                value={autoLangPrompt}
                onValueChange={async val => {
                  setAutoLangPrompt(val);
                  const updated: AppSettings = {
                    ...settings,
                    uiLanguage: selectedUiLang,
                    autoLanguagePrompt: val,
                    languageCustomPrompt: langCustomPrompt.trim() || getDefaultLanguagePrompt(selectedUiLang),
                  };
                  await storageService.saveSettings(updated);
                  onUpdateSettings(updated);
                }}
              />
            </View>

            {/* Editable Custom Prompt for Language */}
            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={[styles.inputLabel, { marginBottom: 0 }]}>
                  {t('settings.customPromptLabel')}
                </Text>
                <TouchableOpacity
                  onPress={() => setLangCustomPrompt(getDefaultLanguagePrompt(selectedUiLang))}
                  activeOpacity={0.75}
                >
                  <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '700' }}>
                    {t('settings.resetPrompt')}
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.inputBox, { minHeight: 76, textAlignVertical: 'top' }]}
                multiline
                placeholder={getDefaultLanguagePrompt(selectedUiLang)}
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={langCustomPrompt}
                onChangeText={setLangCustomPrompt}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSaveLanguageSettings}
            activeOpacity={0.8}
          >
            <Text style={styles.saveBtnText}>{t('settings.saveLanguage')}</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>

      {/* MODAL: Passcode Lock & Replay Onboarding */}
      <BottomSheetModal visible={activeModal === 'passcode'} onClose={() => setActiveModal(null)} sheetStyle={styles.modalSheet}>
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleRow}>
            <Lock size={16} color={palette.accent} style={{ marginRight: 6 }} />
            <Text style={styles.modalTitle}>Passcode Lock & Tour</Text>
          </View>
          <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
              marginBottom: 14,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#f8fafc', fontSize: 13.5, fontWeight: '700' }}>
                  Require 4-Digit Passcode
                </Text>
                <Text style={{ color: '#94a3b8', fontSize: 11.5, marginTop: 3 }}>
                  Lock NekoChat on launch with a local PIN.
                </Text>
              </View>
              <NekoSwitch
                value={passcodeEnabledDraft}
                onValueChange={val => {
                  setPasscodeEnabledDraft(val);
                  setPasscodeError('');
                }}
              />
            </View>

            {passcodeEnabledDraft && (
              <View style={{ marginTop: 14, gap: 10 }}>
                <View>
                  <Text style={styles.inputLabel}>4-Digit Passcode</Text>
                  <TextInput
                    style={styles.inputBox}
                    value={passcodePinDraft}
                    onChangeText={v => {
                      setPasscodeError('');
                      setPasscodePinDraft(v.replace(/\D/g, '').slice(0, 4));
                    }}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                    placeholder="••••"
                    placeholderTextColor="#6b7280"
                  />
                </View>
                <View>
                  <Text style={styles.inputLabel}>Confirm Passcode</Text>
                  <TextInput
                    style={styles.inputBox}
                    value={passcodeConfirmDraft}
                    onChangeText={v => {
                      setPasscodeError('');
                      setPasscodeConfirmDraft(v.replace(/\D/g, '').slice(0, 4));
                    }}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                    placeholder="••••"
                    placeholderTextColor="#6b7280"
                  />
                </View>
                {passcodeError ? (
                  <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '600' }}>{passcodeError}</Text>
                ) : null}
              </View>
            )}
          </View>

          {onReplayOnboarding && (
            <TouchableOpacity
              style={[
                styles.autoTestBtn,
                { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
              ]}
              onPress={() => {
                setActiveModal(null);
                onReplayOnboarding();
              }}
              activeOpacity={0.8}
            >
              <Sparkles size={14} color={palette.accent} style={{ marginRight: 6 }} />
              <Text style={[styles.autoTestBtnText, { color: palette.accent }]}>
                Replay First-Time Setup & Tour
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={async () => {
              if (passcodeEnabledDraft) {
                if (!/^\d{4}$/.test(passcodePinDraft)) {
                  setPasscodeError('Please enter a 4-digit numeric passcode.');
                  return;
                }
                if (passcodePinDraft !== passcodeConfirmDraft) {
                  setPasscodeError('Passcodes do not match.');
                  return;
                }
              }
              const updated: AppSettings = {
                ...settings,
                passcodeEnabled: passcodeEnabledDraft,
                passcodePin: passcodeEnabledDraft ? passcodePinDraft : '',
              };
              await storageService.saveSettings(updated);
              onUpdateSettings(updated);
              setActiveModal(null);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.saveBtnText}>Save Passcode Settings</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>

      {/* MODAL 3: Data Vault & Sanitizer */}
      <BottomSheetModal visible={activeModal === 'vault'} onClose={() => setActiveModal(null)} sheetStyle={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <ShieldCheck size={16} color={palette.accent} style={{ marginRight: 6 }} />
                <Text style={styles.modalTitle}>Neko Data Vault & Sanitizer</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <X size={16} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.vaultInfoText}>
                Zero-Key Sanitization: Exported .neko files are 100% stripped of your API keys and credentials, safe to share with friends or communities.
              </Text>

              <TouchableOpacity
                style={styles.exportBtn}
                onPress={handleDownloadVaultFile}
                activeOpacity={0.8}
              >
                <Download size={14} color="#000000" style={{ marginRight: 6 }} />
                <Text style={styles.exportBtnText}>Export Sanitized Backup (.neko)</Text>
              </TouchableOpacity>

              {vaultJson ? (
                <View style={styles.vaultSnippetBox}>
                  <TouchableOpacity style={styles.copySnippetBtn} onPress={handleCopyVault}>
                    <Copy size={13} color={palette.accent} style={{ marginRight: 4 }} />
                    <Text style={styles.copySnippetText}>{copiedVault ? 'Copied!' : 'Copy JSON'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.vaultSnippetText} numberOfLines={3}>
                    {vaultJson.slice(0, 180)}...
                  </Text>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 6 }}>
                <Text style={styles.inputLabel}>Restore from .neko or .warden JSON</Text>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: `rgba(${palette.accentRgb}, 0.1)`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: `rgba(${palette.accentRgb}, 0.3)` }}
                  onPress={handlePickVaultFile}
                  activeOpacity={0.8}
                >
                  <Upload size={12} color={palette.accent} style={{ marginRight: 4 }} />
                  <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '700' }}>Pick File</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.inputBox, { height: 75, textAlignVertical: 'top' }]}
                multiline
                value={importJsonText}
                onChangeText={setImportJsonText}
                placeholder="Paste exported vault JSON text here..."
                placeholderTextColor="#6b7280"
              />

              <TouchableOpacity
                style={styles.importActionBtn}
                onPress={handleImportVault}
                activeOpacity={0.8}
              >
                <Upload size={14} color={palette.accent} style={{ marginRight: 6 }} />
                <Text style={styles.importActionBtnText}>Restore / Import Backup</Text>
              </TouchableOpacity>

              {vaultNotice && <Text style={styles.vaultNoticeText}>{vaultNotice}</Text>}
            </ScrollView>
      </BottomSheetModal>

      {/* MODAL 4: Persona Studio */}
      <BottomSheetModal visible={activeModal === 'personas'} onClose={() => setActiveModal(null)} sheetStyle={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Users size={16} color={palette.accent} style={{ marginRight: 6 }} />
                <Text style={styles.modalTitle}>User Personas & Identity</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <X size={16} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {personas.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.personaItem, activePersonaId === p.id && styles.personaItemActive]}
                  onPress={() => {
                    setActivePersonaId(p.id);
                    storageService.setDefaultPersona(p.id);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.personaAvatarWrap}>
                    <Text style={styles.personaAvatarInitial}>{p.name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personaName}>{p.name}</Text>
                    <Text style={styles.personaDesc} numberOfLines={1}>
                      {p.description || 'No description provided'}
                    </Text>
                  </View>
                  {activePersonaId === p.id && <Check size={16} color={palette.accent} />}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => setActiveModal(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
      </BottomSheetModal>

      {/* MODAL 5: Token Limits & Cost */}
      <BottomSheetModal visible={activeModal === 'tokens'} onClose={() => setActiveModal(null)} sheetStyle={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Cpu size={16} color={palette.accent} style={{ marginRight: 6 }} />
                <Text style={styles.modalTitle}>Token Limits & Context Window</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <X size={16} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Maximum Context Window</Text>
              <View style={styles.tokenPillRow}>
                {['4096', '8192', '16384', '32768'].map(limit => (
                  <TouchableOpacity
                    key={limit}
                    style={[styles.tokenPill, contextLimit === limit && styles.tokenPillActive]}
                    onPress={() => setContextLimit(limit)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.tokenPillText,
                        contextLimit === limit && styles.tokenPillTextActive,
                      ]}
                    >
                      {limit} BPE
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Cost Estimation Currency</Text>
              <View style={styles.tokenPillRow}>
                {(['IDR', 'USD'] as const).map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.tokenPill, currency === c && styles.tokenPillActive]}
                    onPress={() => setCurrency(c)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.tokenPillText,
                        currency === c && styles.tokenPillTextActive,
                      ]}
                    >
                      {c === 'IDR' ? 'Rupiah (IDR)' : 'US Dollar (USD)'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Advanced Sampling Controls Dropdown */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: `rgba(${palette.accentRgb}, 0.08)`,
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: `rgba(${palette.accentRgb}, 0.25)`,
                  marginTop: 18,
                  marginBottom: 10,
                }}
                onPress={() => setShowAdvancedSampling(!showAdvancedSampling)}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Cpu size={15} color={palette.accent} />
                  <Text style={{ color: palette.accent, fontSize: 13, fontWeight: '700' }}>
                    Advanced Sampling & Context Truncation
                  </Text>
                </View>
                <ChevronDown
                  size={16}
                  color={palette.accent}
                  style={{ transform: [{ rotate: showAdvancedSampling ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>

              {showAdvancedSampling && (
                <View style={{ backgroundColor: '#161922', padding: 12, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                  {/* Context Truncation Strategy */}
                  <Text style={styles.inputLabel}>Context Truncation Strategy</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                    {[
                      { id: 'rolling', label: 'Rolling Window', sub: 'Trim oldest' },
                      { id: 'smart', label: 'Smart Summary', sub: 'Balanced' },
                      { id: 'lorebook', label: 'Lorebook First', sub: 'Protect keys' },
                    ].map(st => (
                      <TouchableOpacity
                        key={st.id}
                        style={[
                          styles.tokenPill,
                          truncationStrategy === st.id && styles.tokenPillActive,
                          { flex: 1, paddingVertical: 6, alignItems: 'center' },
                        ]}
                        onPress={() => setTruncationStrategy(st.id as any)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.tokenPillText, truncationStrategy === st.id && styles.tokenPillTextActive, { fontSize: 11 }]}>
                          {st.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Max Output Tokens */}
                  <Text style={styles.inputLabel}>{t('settings.maxOutputTokens')}</Text>
                  <View style={[styles.tokenPillRow, { marginBottom: 8 }]}>
                    {[
                      { val: '0', label: t('settings.unlimited') },
                      { val: '1024', label: '1K' },
                      { val: '4096', label: '4K' },
                      { val: '8192', label: '8K' },
                      { val: '15000', label: '15K' },
                    ].map(tok => (
                      <TouchableOpacity
                        key={tok.val}
                        style={[styles.tokenPill, maxTokens === tok.val && styles.tokenPillActive, { flex: 1, alignItems: 'center' }]}
                        onPress={() => setMaxTokens(tok.val)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.tokenPillText, maxTokens === tok.val && styles.tokenPillTextActive, { fontSize: 11.5 }]}>
                          {tok.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={[styles.inputBox, { marginBottom: 6 }]}
                    value={maxTokens}
                    onChangeText={v => setMaxTokens(v.replace(/\D/g, ''))}
                    keyboardType="number-pad"
                    placeholder="Custom max output tokens (0 = Unlimited)"
                    placeholderTextColor="#64748b"
                  />
                  {(() => {
                    const parsedOut = maxTokens === '0' ? 0 : parseInt(maxTokens, 10) || 0;
                    const parsedCtx = parseInt(contextLimit, 10) || 16384;
                    if (parsedOut > 0 && parsedOut >= parsedCtx) {
                      return (
                        <Text style={{ color: '#fbbf24', fontSize: 11, marginBottom: 10 }}>
                          Warning: Output limit ({parsedOut}) meets or exceeds configured context limit ({parsedCtx}). Provider limits remain authoritative.
                        </Text>
                      );
                    }
                    return (
                      <Text style={{ color: '#64748b', fontSize: 11, marginBottom: 10 }}>
                        Enter any custom token limit (e.g. 16384, 32768) or 0 for Unlimited (no client-side cap sent).
                      </Text>
                    );
                  })()}

                  {/* Temperature */}
                  <Text style={styles.inputLabel}>Temperature (Creativity: {temperature})</Text>
                  <View style={[styles.tokenPillRow, { marginBottom: 12 }]}>
                    {[
                      { val: '0.3', label: '0.3 (Strict)' },
                      { val: '0.7', label: '0.7 (RP Default)' },
                      { val: '1.0', label: '1.0 (Creative)' },
                      { val: '1.3', label: '1.3 (Chaotic)' },
                    ].map(t => (
                      <TouchableOpacity
                        key={t.val}
                        style={[styles.tokenPill, temperature === t.val && styles.tokenPillActive, { flex: 1, alignItems: 'center' }]}
                        onPress={() => setTemperature(t.val)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.tokenPillText, temperature === t.val && styles.tokenPillTextActive, { fontSize: 10 }]}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Top-P */}
                  <Text style={styles.inputLabel}>Top-P Sampling ({topP})</Text>
                  <View style={[styles.tokenPillRow, { marginBottom: 12 }]}>
                    {['0.70', '0.85', '0.95', '1.00'].map(p => (
                      <TouchableOpacity
                        key={p}
                        style={[styles.tokenPill, topP === p && styles.tokenPillActive, { flex: 1, alignItems: 'center' }]}
                        onPress={() => setTopP(p)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.tokenPillText, topP === p && styles.tokenPillTextActive]}>
                          {p}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Repetition Penalty */}
                  <Text style={styles.inputLabel}>Repetition Penalty ({repPenalty})</Text>
                  <View style={styles.tokenPillRow}>
                    {[
                      { val: '1.00', label: 'Off' },
                      { val: '1.05', label: 'Light' },
                      { val: '1.15', label: 'Default' },
                      { val: '1.25', label: 'Strict' },
                    ].map(r => (
                      <TouchableOpacity
                        key={r.val}
                        style={[styles.tokenPill, repPenalty === r.val && styles.tokenPillActive, { flex: 1, alignItems: 'center' }]}
                        onPress={() => setRepPenalty(r.val)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.tokenPillText, repPenalty === r.val && styles.tokenPillTextActive, { fontSize: 10 }]}>
                          {r.val} ({r.label})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={async () => {
                  const nextContextLimit = parseInt(contextLimit, 10) || 8192;
                  const nextMaxTokens = maxTokens === '0' ? 0 : (parseInt(maxTokens, 10) || 4096);
                  const activeModelKey = String(config.model || config.defaultModel || '').trim();
                  const nextModelLimits = { ...(config.modelContextLimits || {}) };
                  if (activeModelKey) {
                    nextModelLimits[activeModelKey] = {
                      ...(nextModelLimits[activeModelKey] || {}),
                      contextLimit: nextContextLimit,
                      maxOutputTokens: nextMaxTokens,
                      updatedAt: Date.now(),
                    };
                  }
                  const updated: ProviderConfig = {
                    ...config,
                    contextLimit: nextContextLimit,
                    maxTokens: nextMaxTokens,
                    userConfiguredContextLimit: true,
                    userConfiguredMaxTokens: true,
                    modelContextLimits: nextModelLimits,
                    temperature: parseFloat(temperature) || 0.7,
                    topP: parseFloat(topP) || 0.95,
                    repetitionPenalty: parseFloat(repPenalty) || 1.15,
                  };
                  await storageService.saveProviderConfig(updated);
                  if (updated.id) {
                    await storageService.upsertProvider(updated);
                  }
                  onUpdateConfig(updated);
                  setActiveModal(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>Save Sampling & Limits</Text>
              </TouchableOpacity>
            </View>
      </BottomSheetModal>

      {/* MODAL: Voice & Speech Synthesis */}
      <BottomSheetModal visible={activeModal === 'voice'} onClose={() => setActiveModal(null)} sheetStyle={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Volume2 size={16} color={palette.accent} style={{ marginRight: 6 }} />
                <Text style={styles.modalTitle}>Voice & Speech Synthesis</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <X size={16} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Enable Toggle */}
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => handleSaveTtsConfig({ enabled: !ttsConfig.enabled })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Enable Speech Synthesis</Text>
                  <Text style={styles.toggleDesc}>Character voice playback on companion messages</Text>
                </View>
                <View style={[styles.toggleSwitch, ttsConfig.enabled && styles.toggleSwitchActive]}>
                  <View style={[styles.toggleThumb, ttsConfig.enabled && styles.toggleThumbActive]} />
                </View>
              </TouchableOpacity>

              {/* Dialogue Only Toggle */}
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => handleSaveTtsConfig({ dialogueOnly: !ttsConfig.dialogueOnly })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Dialogue Only</Text>
                  <Text style={styles.toggleDesc}>Reads spoken quotes {'"..."'} and skips asterisk actions *...*</Text>
                </View>
                <View style={[styles.toggleSwitch, ttsConfig.dialogueOnly && styles.toggleSwitchActive]}>
                  <View style={[styles.toggleThumb, ttsConfig.dialogueOnly && styles.toggleThumbActive]} />
                </View>
              </TouchableOpacity>

              {/* Speed Preset Selector */}
              <Text style={[styles.sectionSub, { marginTop: 14 }]}>Playback Speed</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {[0.8, 1.0, 1.2, 1.4].map(spd => {
                  const isSel = Math.abs(ttsConfig.speed - spd) < 0.05;
                  return (
                    <TouchableOpacity
                      key={`spd_${spd}`}
                      style={[styles.radioChip, isSel && styles.radioChipActive]}
                      onPress={() => handleSaveTtsConfig({ speed: spd })}
                    >
                      <Text style={[styles.radioChipText, isSel && styles.radioChipTextActive]}>
                        {spd}x
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Pitch Selector */}
              <Text style={styles.sectionSub}>Pitch</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {[0.8, 1.0, 1.2].map(pt => {
                  const isSel = Math.abs(ttsConfig.pitch - pt) < 0.05;
                  return (
                    <TouchableOpacity
                      key={`pt_${pt}`}
                      style={[styles.radioChip, isSel && styles.radioChipActive]}
                      onPress={() => handleSaveTtsConfig({ pitch: pt })}
                    >
                      <Text style={[styles.radioChipText, isSel && styles.radioChipTextActive]}>
                        {pt === 1.0 ? 'Normal (1.0)' : pt < 1.0 ? 'Lower (0.8)' : 'Higher (1.2)'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Voice Profiles Roster */}
              <Text style={styles.sectionSub}>Character Voice Profile</Text>
              <View style={{ gap: 8, marginBottom: 16 }}>
                {VOICE_PROFILES.map(vp => {
                  const isSel = ttsConfig.voiceId === vp.id;
                  return (
                    <TouchableOpacity
                      key={vp.id}
                      style={[styles.voiceItemCard, isSel && styles.voiceItemCardActive]}
                      onPress={() => handleSaveTtsConfig({ voiceId: vp.id })}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.voiceItemName, isSel && { color: palette.accent }]}>{vp.name}</Text>
                          <View style={styles.voiceGenderBadge}>
                            <Text style={styles.voiceGenderBadgeText}>{vp.gender}</Text>
                          </View>
                        </View>
                        <Text style={styles.voiceArchetype}>{vp.archetype}</Text>
                        <Text style={styles.voiceDesc} numberOfLines={1}>{vp.description}</Text>
                      </View>
                      {isSel && <Check size={16} color={palette.accent} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.saveBtn, isTestingVoice && { opacity: 0.7 }]}
                onPress={handleTestVoice}
                disabled={isTestingVoice}
                activeOpacity={0.8}
              >
                {isTestingVoice ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Volume2 size={16} color="#000" style={{ marginRight: 6 }} />
                    <Text style={styles.saveBtnText}>Test Voice Playback</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
      </BottomSheetModal>

      {/* MODAL: Scene Art & Image Generation */}
      <BottomSheetModal visible={activeModal === 'image'} onClose={() => setActiveModal(null)} sheetStyle={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <ImageIcon size={16} color={palette.accent} style={{ marginRight: 6 }} />
                <Text style={styles.modalTitle}>Scene Art & Image Generation</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <X size={16} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Enable Toggle */}
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => handleSaveImageConfig({ enabled: !imageConfig.enabled })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Enable Scene Art Generation</Text>
                  <Text style={styles.toggleDesc}>Depict visual scenes from roleplay context</Text>
                </View>
                <View style={[styles.toggleSwitch, imageConfig.enabled && styles.toggleSwitchActive]}>
                  <View style={[styles.toggleThumb, imageConfig.enabled && styles.toggleThumbActive]} />
                </View>
              </TouchableOpacity>

              {/* Provider Selection */}
              <Text style={[styles.sectionSub, { marginTop: 14 }]}>Image Provider Engine</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {[
                  { id: 'pollinations', label: 'Pollinations (Zero-Key)' },
                  { id: 'openai', label: 'OpenAI DALL-E' },
                  { id: 'custom', label: 'Flux / Custom' },
                ].map(p => {
                  const isSel = imageConfig.provider === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.radioChip, isSel && styles.radioChipActive]}
                      onPress={() => handleSaveImageConfig({ provider: p.id as any })}
                    >
                      <Text style={[styles.radioChipText, isSel && styles.radioChipTextActive]}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {imageConfig.provider !== 'pollinations' && (
                <>
                  <Text style={styles.inputLabel}>Base URL / Endpoint</Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder="https://api.openai.com/v1"
                    placeholderTextColor="#666"
                    value={imageConfig.baseUrl}
                    onChangeText={v => handleSaveImageConfig({ baseUrl: v })}
                  />

                  <Text style={styles.inputLabel}>API Key</Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder="sk-..."
                    placeholderTextColor="#666"
                    secureTextEntry
                    value={imageConfig.apiKey}
                    onChangeText={v => handleSaveImageConfig({ apiKey: v })}
                  />

                  <Text style={styles.inputLabel}>Model Name</Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder={imageConfig.provider === 'openai' ? 'dall-e-3' : 'flux-schnell'}
                    placeholderTextColor="#666"
                    value={imageConfig.model}
                    onChangeText={v => handleSaveImageConfig({ model: v })}
                  />
                </>
              )}

              {/* Default Style Preset */}
              <Text style={styles.sectionSub}>Default Aesthetic Style</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {IMAGE_STYLE_OPTIONS.map(st => {
                  const isSel = imageConfig.style === st.id;
                  return (
                    <TouchableOpacity
                      key={st.id}
                      style={[styles.radioChip, isSel && styles.radioChipActive]}
                      onPress={() => handleSaveImageConfig({ style: st.id })}
                    >
                      <Text style={[styles.radioChipText, isSel && styles.radioChipTextActive]}>
                        {st.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Aspect Ratio */}
              <Text style={styles.sectionSub}>Aspect Ratio</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {(['portrait', 'square', 'landscape'] as const).map(ar => {
                  const isSel = imageConfig.aspectRatio === ar;
                  return (
                    <TouchableOpacity
                      key={ar}
                      style={[styles.radioChip, isSel && styles.radioChipActive]}
                      onPress={() => handleSaveImageConfig({ aspectRatio: ar })}
                    >
                      <Text style={[styles.radioChipText, isSel && styles.radioChipTextActive]}>
                        {ar.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {imageTestResult?.url && (
                <View style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: palette.accent }}>
                  <Image source={{ uri: imageTestResult.url }} style={{ width: '100%', height: 200 }} resizeMode="cover" />
                </View>
              )}

              {imageTestResult?.error && (
                <View style={{ backgroundColor: 'rgba(255, 107, 107, 0.15)', padding: 10, borderRadius: 10, marginBottom: 12 }}>
                  <Text style={{ color: '#FF6B6B', fontSize: 12 }}>{imageTestResult.error}</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.saveBtn, isTestingImage && { opacity: 0.7 }]}
                onPress={handleTestImageGen}
                disabled={isTestingImage}
                activeOpacity={0.8}
              >
                {isTestingImage ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Sparkles size={16} color="#000" style={{ marginRight: 6 }} />
                    <Text style={styles.saveBtnText}>Test Image Generation</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
      </BottomSheetModal>

      {/* MODAL 6: About NekoChat */}
      <BottomSheetModal visible={activeModal === 'about'} onClose={() => setActiveModal(null)} sheetStyle={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Sparkles size={16} color={palette.accent} style={{ marginRight: 6 }} />
                <Text style={styles.modalTitle}>About NekoChat</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <X size={16} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.aboutCard}>
                <View style={{ alignItems: 'center', marginBottom: 10 }}>
                  <NekoLogoSvg size={48} color={colors.lime} />
                </View>
                <Text style={styles.aboutTitle}>NekoChat</Text>
                <Text style={styles.aboutVersion}>{APP_VERSION_LABEL} • Open-Source</Text>
                <Text style={styles.aboutDesc}>
                  Yet another AI roleplay app. Built with Expo and React Native for people who want a local, bring-your-own-key chat client.
                </Text>

                <TouchableOpacity
                  style={styles.repoLinkBtn}
                  onPress={() => Linking.openURL('https://github.com/JustBadThinker/nekochat').catch(() => {})}
                  activeOpacity={0.8}
                >
                  <ExternalLink size={13} color="#000000" style={{ marginRight: 5 }} />
                  <Text style={styles.repoLinkBtnText}>Source Code & Upstream</Text>
                </TouchableOpacity>

                {/* Open-Source & Ecosystem Credits */}
                <View style={{ marginTop: 18, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)', paddingTop: 14 }}>
                  <Text style={{ color: palette.accent, fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginBottom: 10 }}>
                    OPEN-SOURCE & COMMUNITY CREDITS
                  </Text>

                  {[
                    {
                      title: 'Warden AI',
                      desc: 'Architectural blueprint, Datacat proxy protocol, and community catalog scraper foundation.',
                      badge: 'Architecture',
                    },
                    {
                      title: 'SillyTavern',
                      desc: 'World Info / Lorebook specification, character card V2 format, and roleplay token ergonomics.',
                      badge: 'Standards',
                    },
                    {
                      title: 'JanitorAI & Chub.ai',
                      desc: 'Open companion character ecosystem, prompt metadata conventions, and community catalog feed.',
                      badge: 'Ecosystem',
                    },
                    {
                      title: 'Expo & React Native',
                      desc: 'Cross-platform mobile native runtime, gesture responders, and high-performance native drivers.',
                      badge: 'Framework',
                    },
                  ].map((credit, i) => (
                    <View
                      key={i}
                      style={{
                        backgroundColor: '#161922',
                        padding: 10,
                        borderRadius: 10,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>{credit.title}</Text>
                        <View style={{ backgroundColor: `rgba(${palette.accentRgb}, 0.12)`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ color: palette.accent, fontSize: 9.5, fontWeight: '800' }}>{credit.badge}</Text>
                        </View>
                      </View>
                      <Text style={{ color: '#9ca3af', fontSize: 11, lineHeight: 15 }}>{credit.desc}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
      </BottomSheetModal>

      <HelpCenterModal
        visible={activeModal === 'help'}
        onClose={() => setActiveModal(null)}
      />
    </ScrollView>
  );
};

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  contentContainer: {
    padding: 14,
    paddingBottom: 110,
  },
  healthCardBig: {
    backgroundColor: '#0f121d',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1e2436',
    padding: 14,
    marginBottom: 18,
  },
  healthCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  healthTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  healthPingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.accent,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 8,
  },
  healthPingBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#000000',
  },
  healthGrid: {
    gap: 8,
  },
  healthItemBox: {
    backgroundColor: '#151926',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e2436',
    padding: 10,
  },
  healthItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  statusDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.accent,
    marginRight: 6,
  },
  statusDotRed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f43f5e',
    marginRight: 6,
  },
  statusDotGray: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#64748b',
    marginRight: 6,
  },
  healthItemName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#e2e8f0',
    flex: 1,
  },
  latencyText: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.accent,
    marginTop: 2,
  },
  latencyTextOffline: {
    fontSize: 14,
    fontWeight: '800',
    color: '#f43f5e',
    marginTop: 2,
  },
  statusLabelText: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 1,
  },
  gridSectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9ca3af',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  bentoTwoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  bentoTile: {
    width: '48.2%',
    backgroundColor: GLASS.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS.borderBright,
    padding: 12,
    marginBottom: 2,
    justifyContent: 'space-between',
    ...GLASS.backdrop,
    ...GLASS.shadow,
    minHeight: 120,
  },
  tileIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#171c2b',
    borderWidth: 1,
    borderColor: '#242b3d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  tileTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  tileSubtitle: {
    fontSize: 10,
    color: '#9ca3af',
    lineHeight: 14,
    marginTop: 2,
  },
  tileBadgeLime: {
    alignSelf: 'flex-start',
    backgroundColor: `rgba(${palette.accentRgb}, 0.15)`,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.4)`,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 8,
  },
  tileBadgeLimeText: {
    fontSize: 9,
    fontWeight: '800',
    color: palette.accent,
  },
  tileBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#171c2b',
    borderWidth: 1,
    borderColor: '#242b3d',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 8,
  },
  tileBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9ca3af',
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
    backgroundColor: '#0f121d',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: '#1e2436',
    maxHeight: '86%',
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2436',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
    flex: 1,
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#9ca3af',
    marginBottom: 5,
    marginTop: 8,
  },
  inputBox: {
    backgroundColor: '#151926',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e2436',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 11.5,
    color: '#FFFFFF',
  },
  inputPasswordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151926',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e2436',
    paddingHorizontal: 10,
  },
  inputPasswordText: {
    flex: 1,
    fontSize: 11.5,
    color: '#FFFFFF',
    paddingVertical: 9,
  },
  autoTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 14,
  },
  autoTestBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  pingResultBox: {
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  pingSuccess: {
    backgroundColor: `rgba(${palette.accentRgb}, 0.12)`,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.4)`,
  },
  pingFailure: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
  },
  pingTextSuccess: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.accent,
  },
  pingTextFailure: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fb7185',
  },
  modalFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#1e2436',
    backgroundColor: '#0c0e15',
  },
  saveBtn: {
    backgroundColor: palette.accent,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#000000',
  },
  sectionSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    marginBottom: 8,
  },
  themeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GLASS.bgSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GLASS.border,
    padding: 12,
    ...GLASS.backdrop,
    marginBottom: 8,
  },
  themeOptionActive: {
    borderColor: palette.accent,
    backgroundColor: `rgba(${palette.accentRgb}, 0.08)`,
  },
  themeOptionName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  themeOptionDesc: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
  vaultInfoText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#9ca3af',
    marginBottom: 12,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 10,
  },
  exportBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#000000',
  },
  vaultSnippetBox: {
    backgroundColor: '#151926',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e2436',
    padding: 10,
    marginBottom: 10,
  },
  copySnippetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: '#1c2232',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  copySnippetText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: palette.accent,
  },
  vaultSnippetText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#9ca3af',
  },
  importActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171c2b',
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.4)`,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 8,
  },
  importActionBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: palette.accent,
  },
  vaultNoticeText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.accent,
    textAlign: 'center',
    marginTop: 10,
  },
  personaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151926',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e2436',
    padding: 10,
    marginBottom: 8,
  },
  personaItemActive: {
    borderColor: palette.accent,
  },
  personaAvatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e2436',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  personaAvatarInitial: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.accent,
  },
  personaName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  personaDesc: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 1,
  },
  tokenPillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tokenPill: {
    backgroundColor: '#151926',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e2436',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tokenPillActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  tokenPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
  },
  tokenPillTextActive: {
    color: '#000000',
  },
  aboutCard: {
    backgroundColor: GLASS.bgSubtle,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS.border,
    padding: 14,
    alignItems: 'center',
    ...GLASS.backdrop,
  },
  aboutTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.accent,
  },
  aboutVersion: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    marginTop: 2,
    marginBottom: 8,
  },
  aboutDesc: {
    fontSize: 11,
    lineHeight: 16,
    color: '#e2e8f0',
    textAlign: 'center',
    marginBottom: 14,
  },
  repoLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  repoLinkBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#151926',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e2436',
    padding: 12,
    marginBottom: 10,
  },
  toggleTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  toggleDesc: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    marginTop: 2,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
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
    backgroundColor: '#000000',
  },
  radioChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#151926',
    borderWidth: 1,
    borderColor: '#1e2436',
  },
  radioChipActive: {
    borderColor: palette.accent,
    backgroundColor: `rgba(${palette.accentRgb}, 0.12)`,
  },
  radioChipText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  radioChipTextActive: {
    color: palette.accent,
  },
  voiceItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS.bgSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GLASS.border,
    padding: 12,
    ...GLASS.backdrop,
  },
  voiceItemCardActive: {
    borderColor: palette.accent,
    backgroundColor: `rgba(${palette.accentRgb}, 0.06)`,
  },
  voiceItemName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  voiceGenderBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  voiceGenderBadgeText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  voiceArchetype: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  voiceDesc: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    marginTop: 2,
  },
});
