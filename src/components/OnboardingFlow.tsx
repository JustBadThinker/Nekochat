import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
  Linking,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowRight,
  ArrowLeft,
  Globe,
  Key,
  Lock,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Zap,
  Check,
  MessageSquare,
  Compass,
  User,
  Settings as SettingsIcon,
  Server,
  ShieldAlert,
} from 'lucide-react-native';
import { AppSettings, ProviderConfig } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { getScreenBg } from '../theme/skins';
import { useTranslation } from '../i18n/LanguageContext';
import { LANGUAGE_OPTIONS, UiLanguage, getDefaultLanguagePrompt } from '../i18n/translations';
import { NekoLogoSvg } from './NekoLogoSvg';
import { NekoSwitch } from './NekoSwitch';
import { storageService } from '../services/storageService';
import { aiProviderService } from '../services/aiProviderService';

interface OnboardingFlowProps {
  settings: AppSettings;
  config: ProviderConfig;
  onUpdateSettings: (next: AppSettings) => void;
  onUpdateConfig: (next: ProviderConfig) => void;
  onFinish: () => void;
}

type StepIndex = 0 | 1 | 2 | 3 | 4;

const TOUR_SLIDES = [
  {
    key: 'chats',
    title: 'My Chats & Accordion View',
    desc: 'Switch between 2-column Bento Grid and single-focus Dropdown Accordion. Manage multiple roleplay timelines per character, swipe responses, or play Neko Dash while waiting.',
    Icon: MessageSquare,
  },
  {
    key: 'discover',
    title: 'Discover & Match Mode',
    desc: 'Browse live JanitorAI (Datacat) & Chub.ai catalogs, swipe in Match Mode, or scroll the For You feed with personalized recommendations.',
    Icon: Compass,
  },
  {
    key: 'studio',
    title: 'Creative Studio',
    desc: 'Build custom characters, manage User Personas, import .JSON or .PNG SillyTavern cards, and attach keyword-triggered Codex Lorebooks.',
    Icon: User,
  },
  {
    key: 'settings',
    title: '100% Local & BYOK',
    desc: 'Your API keys, chats, themes, language prompts, and optional passcode stay private on your device. Change any setting anytime.',
    Icon: SettingsIcon,
  },
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  settings,
  config,
  onUpdateSettings,
  onUpdateConfig,
  onFinish,
}) => {
  const { palette, skin } = useTheme();
  const { t } = useTranslation();

  const [step, setStep] = useState<StepIndex>(0);
  const [ageConfirmed, setAgeConfirmed] = useState<boolean>(false);
  const stepAnim = useRef(new Animated.Value(1)).current;
  const stepSlide = useRef(new Animated.Value(0)).current;

  // Step 2: Language State
  const [selectedLang, setSelectedLang] = useState<UiLanguage>(settings.uiLanguage || 'en');
  const [autoLangPrompt, setAutoLangPrompt] = useState<boolean>(!!settings.autoLanguagePrompt);
  const [langPromptText, setLangPromptText] = useState<string>(
    settings.languageCustomPrompt || getDefaultLanguagePrompt(settings.uiLanguage || 'en')
  );

  // Step 3: API Setup State
  const [provMode, setProvMode] = useState<'gemini' | 'openrouter' | 'openai' | 'custom'>('gemini');
  const [customPreset, setCustomPreset] = useState<'anoman' | 'sumopod' | 'local' | 'other'>('anoman');
  const [endpoint, setEndpoint] = useState<string>('https://api.anoman.io/v1');
  const [apiKey, setApiKey] = useState<string>(config.apiKey || '');
  const [modelId, setModelId] = useState<string>(config.model || 'gemini-2.5-flash');
  const [fetchedModels, setFetchedModels] = useState<{ id: string; name?: string }[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [testingPing, setTestingPing] = useState(false);
  const [pingStatus, setPingStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Step 4: Passcode State (Optional)
  const [enablePasscode, setEnablePasscode] = useState<boolean>(!!settings.passcodeEnabled);
  const [pinInput, setPinInput] = useState<string>(settings.passcodePin || '');
  const [pinConfirm, setPinConfirm] = useState<string>(settings.passcodePin || '');
  const [pinError, setPinError] = useState<string>('');

  // Step 5: Tour Slide State
  const [tourIdx, setTourIdx] = useState<number>(0);
  const tourAnim = useRef(new Animated.Value(1)).current;

  const animateToStep = (nextStep: StepIndex, direction: 1 | -1 = 1) => {
    const outDur = Math.max(140, Math.round(skin.animation.enterDuration * 0.65));
    const inDur = skin.animation.enterDuration;
    Animated.parallel([
      Animated.timing(stepAnim, {
        toValue: 0,
        duration: outDur,
        easing: skin.animation.easing,
        useNativeDriver: true,
      }),
      Animated.timing(stepSlide, {
        toValue: -18 * direction,
        duration: outDur,
        easing: skin.animation.easing,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep(nextStep);
      stepSlide.setValue(22 * direction);
      Animated.parallel([
        Animated.timing(stepAnim, {
          toValue: 1,
          duration: inDur,
          easing: skin.animation.easing,
          useNativeDriver: true,
        }),
        Animated.timing(stepSlide, {
          toValue: 0,
          duration: inDur,
          easing: skin.animation.easing,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  useEffect(() => {
    stepAnim.setValue(0);
    stepSlide.setValue(18);
    Animated.parallel([
      Animated.timing(stepAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(stepSlide, {
        toValue: 0,
        duration: 320,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [stepAnim, stepSlide]);

  const handleChooseLanguage = async (lang: UiLanguage) => {
    const prevDef = getDefaultLanguagePrompt(selectedLang);
    const nextPrompt =
      !langPromptText.trim() || langPromptText.trim() === prevDef.trim()
        ? getDefaultLanguagePrompt(lang)
        : langPromptText;
    setSelectedLang(lang);
    setLangPromptText(nextPrompt);

    const updated: AppSettings = {
      ...settings,
      uiLanguage: lang,
      autoLanguagePrompt: autoLangPrompt,
      languageCustomPrompt: nextPrompt,
    };
    await storageService.saveSettings(updated);
    onUpdateSettings(updated);
  };

  const handleSaveLanguageAndNext = async () => {
    const updated: AppSettings = {
      ...settings,
      uiLanguage: selectedLang,
      autoLanguagePrompt: autoLangPrompt,
      languageCustomPrompt: langPromptText.trim() || getDefaultLanguagePrompt(selectedLang),
    };
    await storageService.saveSettings(updated);
    onUpdateSettings(updated);
    animateToStep(2, 1);
  };

  const selectProviderMode = (mode: 'gemini' | 'openrouter' | 'openai' | 'custom') => {
    setProvMode(mode);
    setPingStatus(null);
    setFetchedModels([]);
    if (mode === 'gemini') {
      setEndpoint('');
      setModelId('gemini-2.5-flash');
    } else if (mode === 'openrouter') {
      setEndpoint('https://openrouter.ai/api/v1');
      setModelId('deepseek/deepseek-chat');
    } else if (mode === 'openai') {
      setEndpoint('https://api.openai.com/v1');
      setModelId('gpt-4o-mini');
    } else {
      applyCustomPreset(customPreset);
    }
  };

  const applyCustomPreset = (preset: 'anoman' | 'sumopod' | 'local' | 'other') => {
    setCustomPreset(preset);
    setPingStatus(null);
    if (preset === 'anoman') {
      setEndpoint('https://api.anoman.io/v1');
      setModelId('deepseek-v4-flash-0731');
    } else if (preset === 'sumopod') {
      setEndpoint('https://ai.sumopod.com/v1');
      setModelId('gpt-4o-mini');
    } else if (preset === 'local') {
      setEndpoint('http://192.168.1.10:11434/v1');
      setModelId('llama3.2');
    }
  };

  const buildOnboardingProviderConfig = (): ProviderConfig => {
    const idMap = {
      gemini: 'prov_gemini',
      openrouter: 'prov_openrouter',
      openai: 'prov_openai',
      custom: 'prov_custom',
    };
    return {
      ...config,
      id: idMap[provMode],
      provider: provMode,
      providerType: provMode,
      baseUrl: provMode === 'gemini' ? '' : endpoint.trim(),
      customEndpoint: provMode === 'gemini' ? '' : endpoint.trim(),
      apiKey: apiKey.trim(),
      model: modelId.trim() || (provMode === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini'),
      defaultModel: modelId.trim() || (provMode === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini'),
      isDefault: true,
    };
  };

  const handleFetchModels = async () => {
    setFetchingModels(true);
    setPingStatus(null);
    try {
      const cfg = buildOnboardingProviderConfig();
      const list = await aiProviderService.fetchModels(cfg);
      setFetchedModels(list);
      if (list.length > 0 && !modelId.trim()) {
        setModelId(list[0].id);
      }
    } catch (err: any) {
      setPingStatus({ ok: false, msg: err?.message || 'Could not fetch models' });
    } finally {
      setFetchingModels(false);
    }
  };

  const handleTestApi = async () => {
    setTestingPing(true);
    setPingStatus(null);
    const cfg = buildOnboardingProviderConfig();
    try {
      if (provMode === 'gemini') {
        const res = await aiProviderService.pingService('gemini', cfg.apiKey, cfg.model);
        setPingStatus({
          ok: res.ok,
          msg: res.ok ? `Connected (${res.latencyMs}ms)` : res.error || 'Gemini connection failed',
        });
      } else {
        const res = await aiProviderService.pingCustomEndpoint(
          cfg.customEndpoint || 'https://api.openai.com/v1',
          cfg.apiKey,
          cfg.model
        );
        setPingStatus({
          ok: res.ok,
          msg: res.ok ? `Connected (${res.latencyMs}ms)` : res.error || 'Connection failed',
        });
      }
    } catch (err: any) {
      setPingStatus({ ok: false, msg: err?.message || 'Connection failed' });
    } finally {
      setTestingPing(false);
    }
  };

  const handleSaveApiAndNext = async (skip: boolean) => {
    if (!skip && (apiKey.trim() || provMode === 'custom')) {
      const cfg = buildOnboardingProviderConfig();
      await storageService.upsertProvider(cfg);
      await storageService.saveProviderConfig(cfg);
      onUpdateConfig(cfg);
    }
    animateToStep(3, 1);
  };

  const handleSavePasscodeAndNext = async (skip: boolean) => {
    if (!skip && enablePasscode) {
      if (!/^\d{4}$/.test(pinInput)) {
        setPinError('Please enter a 4-digit numeric passcode.');
        return;
      }
      if (pinInput !== pinConfirm) {
        setPinError('Passcodes do not match.');
        return;
      }
    }
    setPinError('');
    const updated: AppSettings = {
      ...settings,
      uiLanguage: selectedLang,
      autoLanguagePrompt: autoLangPrompt,
      languageCustomPrompt: langPromptText.trim() || getDefaultLanguagePrompt(selectedLang),
      passcodeEnabled: skip ? false : enablePasscode,
      passcodePin: skip || !enablePasscode ? '' : pinInput,
    };
    await storageService.saveSettings(updated);
    onUpdateSettings(updated);
    animateToStep(4, 1);
  };

  const handleTourNext = () => {
    if (tourIdx < TOUR_SLIDES.length - 1) {
      Animated.timing(tourAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setTourIdx(prev => prev + 1);
        Animated.timing(tourAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    } else {
      completeOnboarding();
    }
  };

  const completeOnboarding = async () => {
    const updated: AppSettings = {
      ...settings,
      uiLanguage: selectedLang,
      autoLanguagePrompt: autoLangPrompt,
      languageCustomPrompt: langPromptText.trim() || getDefaultLanguagePrompt(selectedLang),
      hasCompletedOnboarding: true,
    };
    await storageService.saveSettings(updated);
    onUpdateSettings(updated);
    onFinish();
  };

  const openExternal = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  const activeTour = TOUR_SLIDES[tourIdx];
  const TourIcon = activeTour.Icon;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: getScreenBg(palette, skin) }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Progress Dots */}
        <View style={styles.topBar}>
          {step > 0 ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => animateToStep((step - 1) as StepIndex, -1)}
              activeOpacity={0.75}
            >
              <ArrowLeft size={16} color="#e2e8f0" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 34 }} />
          )}

          <View style={styles.progressRow}>
            {[0, 1, 2, 3, 4].map(i => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  i === step && { width: 22, backgroundColor: palette.accent },
                  i < step && { backgroundColor: `rgba(${palette.accentRgb}, 0.55)` },
                ]}
              />
            ))}
          </View>

          {step === 4 ? (
            <TouchableOpacity onPress={completeOnboarding} activeOpacity={0.75}>
              <Text style={[styles.skipTopText, { color: palette.accent }]}>Skip</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 34 }} />
          )}
        </View>

        <Animated.View
          style={{
            flex: 1,
            opacity: stepAnim,
            transform: [{ translateX: stepSlide }],
          }}
        >
          {/* ── STEP 0: WELCOME ── */}
          {step === 0 && (
            <View style={styles.centerStage}>
              <View
                style={[
                  styles.logoGlow,
                  {
                    backgroundColor: `rgba(${palette.accentRgb}, 0.1)`,
                    borderColor: `rgba(${palette.accentRgb}, 0.35)`,
                  },
                ]}
              >
                <NekoLogoSvg size={64} color={palette.accent} />
              </View>

              <Text style={styles.welcomeTitle}>Welcome to NekoChat</Text>
              <Text style={styles.welcomeSub}>
                Yet another AI roleplay app. Set up your language, API key, and optional passcode below.
              </Text>

              <View style={styles.featurePillsRow}>
                <View style={styles.featurePill}>
                  <Sparkles size={13} color={palette.accent} />
                  <Text style={styles.featurePillText}>Local Storage</Text>
                </View>
                <View style={styles.featurePill}>
                  <Key size={13} color={palette.accent} />
                  <Text style={styles.featurePillText}>BYOK API</Text>
                </View>
                <View style={styles.featurePill}>
                  <Lock size={13} color={palette.accent} />
                  <Text style={styles.featurePillText}>Optional Lock</Text>
                </View>
              </View>

              <View
                style={{
                  width: '100%',
                  marginTop: 20,
                  padding: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: 'rgba(251, 113, 133, 0.35)',
                  backgroundColor: 'rgba(251, 113, 133, 0.08)',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <ShieldAlert size={16} color="#FB7185" />
                  <Text style={{ color: '#FDA4AF', fontSize: 13, fontWeight: '800' }}>
                    18+ Mature Content Notice
                  </Text>
                </View>
                <Text style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 18 }}>
                  NekoChat connects to community character catalogs (JanitorAI &amp; Chub.ai) and user-provided AI APIs that may include adult, NSFW, or mature fictional roleplay themes.
                </Text>

                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    marginTop: 12,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: 'rgba(255,255,255,0.08)',
                  }}
                  onPress={() => setAgeConfirmed(prev => !prev)}
                  activeOpacity={0.8}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      borderWidth: 1.5,
                      borderColor: ageConfirmed ? palette.accent : '#64748b',
                      backgroundColor: ageConfirmed ? palette.accent : 'transparent',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    {ageConfirmed && <Check size={13} color={palette.bgDark} />}
                  </View>
                  <Text style={{ color: '#f1f5f9', fontSize: 12, fontWeight: '700', flex: 1 }}>
                    I confirm that I am 18 years or older (or legal age in my region)
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  {
                    backgroundColor: palette.accent,
                    width: '100%',
                    marginTop: 18,
                    opacity: ageConfirmed ? 1 : 0.45,
                  },
                ]}
                disabled={!ageConfirmed}
                onPress={() => animateToStep(1, 1)}
                activeOpacity={0.85}
              >
                <Text style={[styles.primaryBtnText, { color: palette.bgDark }]}>Get Started</Text>
                <ArrowRight size={17} color={palette.bgDark} />
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 1: LANGUAGE ── */}
          {step === 1 && (
            <ScrollView style={styles.scrollStage} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              <View style={styles.stepHeader}>
                <Globe size={22} color={palette.accent} />
                <Text style={styles.stepTitle}>{t('settings.languageTitle')}</Text>
                <Text style={styles.stepSub}>{t('settings.languageSub')}</Text>
              </View>

              <View style={{ gap: 10, marginBottom: 16 }}>
                {LANGUAGE_OPTIONS.map(opt => {
                  const active = selectedLang === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.optionCard,
                        active && { borderColor: palette.accent, backgroundColor: `rgba(${palette.accentRgb}, 0.1)` },
                      ]}
                      onPress={() => handleChooseLanguage(opt.id)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={{ fontSize: 22 }}>{opt.flag}</Text>
                        <View>
                          <Text style={[styles.optionTitle, active && { color: palette.accent }]}>{opt.nativeName}</Text>
                          <Text style={styles.optionSub}>{opt.name}</Text>
                        </View>
                      </View>
                      {active && <Check size={18} color={palette.accent} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.cardBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardBoxTitle}>{t('settings.autoPromptLabel')}</Text>
                    <Text style={styles.cardBoxSub}>{t('settings.autoPromptHint')}</Text>
                  </View>
                  <NekoSwitch value={autoLangPrompt} onValueChange={setAutoLangPrompt} />
                </View>

                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>{t('settings.customPromptLabel')}</Text>
                <TextInput
                  style={[styles.input, { minHeight: 68, textAlignVertical: 'top' }]}
                  multiline
                  value={langPromptText}
                  onChangeText={setLangPromptText}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: palette.accent, marginTop: 16 }]}
                onPress={handleSaveLanguageAndNext}
                activeOpacity={0.85}
              >
                <Text style={[styles.primaryBtnText, { color: palette.bgDark }]}>Continue</Text>
                <ArrowRight size={17} color={palette.bgDark} />
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ── STEP 2: API SETUP ── */}
          {step === 2 && (
            <ScrollView style={styles.scrollStage} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              <View style={styles.stepHeader}>
                <Key size={22} color={palette.accent} />
                <Text style={styles.stepTitle}>Connect AI Engine</Text>
                <Text style={styles.stepSub}>
                  Pick an official provider or use Custom URL for proxies (Anoman, Sumopod) & Local AI servers.
                </Text>
              </View>

              {/* Provider Pills */}
              <View style={styles.provRow}>
                {(
                  [
                    { id: 'gemini', label: 'Gemini' },
                    { id: 'openrouter', label: 'OpenRouter' },
                    { id: 'openai', label: 'OpenAI' },
                    { id: 'custom', label: 'Custom URL' },
                  ] as const
                ).map(p => {
                  const active = provMode === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.provPill,
                        active && { borderColor: palette.accent, backgroundColor: `rgba(${palette.accentRgb}, 0.16)` },
                      ]}
                      onPress={() => selectProviderMode(p.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.provPillText, active && { color: palette.accent }]}>{p.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Quick Official Signup / Key Links */}
              {provMode !== 'custom' ? (
                <TouchableOpacity
                  style={styles.linkBanner}
                  onPress={() =>
                    openExternal(
                      provMode === 'gemini'
                        ? 'https://aistudio.google.com/apikey'
                        : provMode === 'openrouter'
                        ? 'https://openrouter.ai/keys'
                        : 'https://platform.openai.com/api-keys'
                    )
                  }
                  activeOpacity={0.8}
                >
                  <ExternalLink size={14} color={palette.accent} />
                  <Text style={[styles.linkBannerText, { color: palette.accent }]}>
                    {provMode === 'gemini'
                      ? 'Get a free API Key from Google AI Studio'
                      : provMode === 'openrouter'
                      ? 'Get an API Key from OpenRouter'
                      : 'Get an API Key from OpenAI Platform'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.cardBox}>
                  <Text style={styles.fieldLabel}>Custom URL Presets (Proxies & Local)</Text>
                  <View style={styles.provRow}>
                    {(
                      [
                        { id: 'anoman', label: 'Anoman' },
                        { id: 'sumopod', label: 'Sumopod' },
                        { id: 'local', label: 'Local AI' },
                        { id: 'other', label: 'Other' },
                      ] as const
                    ).map(cp => {
                      const active = customPreset === cp.id;
                      return (
                        <TouchableOpacity
                          key={cp.id}
                          style={[
                            styles.provPill,
                            active && { borderColor: palette.accent, backgroundColor: `rgba(${palette.accentRgb}, 0.16)` },
                          ]}
                          onPress={() => applyCustomPreset(cp.id)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.provPillText, active && { color: palette.accent }]}>{cp.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {customPreset === 'anoman' && (
                    <TouchableOpacity
                      style={[styles.linkBanner, { marginTop: 10, marginBottom: 0 }]}
                      onPress={() => openExternal('https://app.anoman.io/auth/signup?ref=8j5xefgu')}
                      activeOpacity={0.8}
                    >
                      <ExternalLink size={14} color={palette.accent} />
                      <Text style={[styles.linkBannerText, { color: palette.accent }]}>
                        Sign up on Anoman (Referral Link)
                      </Text>
                    </TouchableOpacity>
                  )}

                  {customPreset === 'sumopod' && (
                    <TouchableOpacity
                      style={[styles.linkBanner, { marginTop: 10, marginBottom: 0 }]}
                      onPress={() => openExternal('https://sumopod.com')}
                      activeOpacity={0.8}
                    >
                      <ExternalLink size={14} color={palette.accent} />
                      <Text style={[styles.linkBannerText, { color: palette.accent }]}>
                        Open Sumopod Official Site
                      </Text>
                    </TouchableOpacity>
                  )}

                  {customPreset === 'local' && (
                    <View style={styles.localGuideBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Server size={14} color={palette.accent} />
                        <Text style={[styles.localGuideTitle, { color: palette.accent }]}>
                          Local API Routing on Phone
                        </Text>
                      </View>
                      <Text style={styles.localGuideText}>
                        • <Text style={{ fontWeight: '700', color: '#f8fafc' }}>PC on same Wi-Fi</Text>: Use your PC&apos;s LAN IP instead of localhost:{'\n'}
                        {'  '}Ollama: <Text style={{ color: '#cbd5e1' }}>http://192.168.1.x:11434/v1</Text> (set <Text style={{ color: '#cbd5e1' }}>OLLAMA_HOST=0.0.0.0</Text>){'\n'}
                        {'  '}LM Studio: <Text style={{ color: '#cbd5e1' }}>http://192.168.1.x:1234/v1</Text> (enable Serve on LAN){'\n'}
                        {'  '}KoboldCpp: <Text style={{ color: '#cbd5e1' }}>http://192.168.1.x:5001/v1</Text>{'\n'}
                        • <Text style={{ fontWeight: '700', color: '#f8fafc' }}>On-Phone (Termux / PocketPal / llama.cpp)</Text>: Use <Text style={{ color: '#cbd5e1' }}>http://127.0.0.1:8080/v1</Text>. API Key can be left blank or any dummy text.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {provMode !== 'gemini' && (
                <>
                  <Text style={styles.fieldLabel}>Base URL (Endpoint)</Text>
                  <TextInput
                    style={styles.input}
                    value={endpoint}
                    onChangeText={setEndpoint}
                    placeholder="https://api.openai.com/v1"
                    placeholderTextColor="#64748b"
                    autoCapitalize="none"
                  />
                </>
              )}

              <Text style={styles.fieldLabel}>
                {customPreset === 'local' && provMode === 'custom' ? 'API Key (Optional for Local)' : 'API Key'}
              </Text>
              <TextInput
                style={styles.input}
                value={apiKey}
                onChangeText={setApiKey}
                placeholder={customPreset === 'local' && provMode === 'custom' ? 'Leave blank or enter local token' : 'sk-... or AIza...'}
                placeholderTextColor="#64748b"
                secureTextEntry
                autoCapitalize="none"
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <Text style={[styles.fieldLabel, { marginTop: 0 }]}>Model ID</Text>
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
                      <Text style={{ color: palette.accent, fontSize: 11.5, fontWeight: '700' }}>Fetch Models</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                value={modelId}
                onChangeText={setModelId}
                placeholder="gemini-2.5-flash"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
              />

              {fetchedModels.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  {fetchedModels.slice(0, 12).map(m => (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.modelChip,
                        modelId === m.id && { backgroundColor: palette.accent, borderColor: palette.accent },
                      ]}
                      onPress={() => setModelId(m.id)}
                    >
                      <Text style={[styles.modelChipText, modelId === m.id && { color: palette.bgDark }]}>
                        {m.name || m.id}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <TouchableOpacity
                style={styles.testBtn}
                onPress={handleTestApi}
                disabled={testingPing}
                activeOpacity={0.8}
              >
                <Zap size={14} color={palette.accent} />
                <Text style={[styles.testBtnText, { color: palette.accent }]}>
                  {testingPing ? 'Testing Connection...' : 'Test Connection'}
                </Text>
              </TouchableOpacity>

              {pingStatus && (
                <View
                  style={[
                    styles.pingBanner,
                    {
                      borderColor: pingStatus.ok ? 'rgba(74, 222, 128, 0.4)' : 'rgba(248, 113, 113, 0.4)',
                      backgroundColor: pingStatus.ok ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    },
                  ]}
                >
                  <Text style={{ color: pingStatus.ok ? '#86efac' : '#fca5a5', fontSize: 12, fontWeight: '600' }}>
                    {pingStatus.ok ? `✓ ${pingStatus.msg}` : `✕ ${pingStatus.msg}`}
                  </Text>
                </View>
              )}

              <View style={styles.btnPairRow}>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => handleSaveApiAndNext(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryBtnText}>Skip for now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 1, backgroundColor: palette.accent }]}
                  onPress={() => handleSaveApiAndNext(false)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.primaryBtnText, { color: palette.bgDark }]}>Save & Continue</Text>
                  <ArrowRight size={17} color={palette.bgDark} />
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* ── STEP 3: PASSCODE (OPTIONAL) ── */}
          {step === 3 && (
            <ScrollView style={styles.scrollStage} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              <View style={styles.stepHeader}>
                <Lock size={22} color={palette.accent} />
                <Text style={styles.stepTitle}>Passcode Lock (Optional)</Text>
                <Text style={styles.stepSub}>
                  Protect your private chats with a 4-digit PIN. You can enable, disable, or change it anytime in Settings.
                </Text>
              </View>

              <View style={styles.cardBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardBoxTitle}>Enable 4-Digit Passcode</Text>
                    <Text style={styles.cardBoxSub}>Ask for PIN when launching NekoChat</Text>
                  </View>
                  <NekoSwitch
                    value={enablePasscode}
                    onValueChange={val => {
                      setEnablePasscode(val);
                      setPinError('');
                    }}
                  />
                </View>

                {enablePasscode && (
                  <View style={{ marginTop: 14, gap: 10 }}>
                    <View>
                      <Text style={styles.fieldLabel}>Enter 4-Digit PIN</Text>
                      <TextInput
                        style={styles.input}
                        value={pinInput}
                        onChangeText={v => {
                          setPinError('');
                          setPinInput(v.replace(/\D/g, '').slice(0, 4));
                        }}
                        keyboardType="number-pad"
                        maxLength={4}
                        secureTextEntry
                        placeholder="••••"
                        placeholderTextColor="#64748b"
                      />
                    </View>
                    <View>
                      <Text style={styles.fieldLabel}>Confirm PIN</Text>
                      <TextInput
                        style={styles.input}
                        value={pinConfirm}
                        onChangeText={v => {
                          setPinError('');
                          setPinConfirm(v.replace(/\D/g, '').slice(0, 4));
                        }}
                        keyboardType="number-pad"
                        maxLength={4}
                        secureTextEntry
                        placeholder="••••"
                        placeholderTextColor="#64748b"
                      />
                    </View>
                    {pinError ? (
                      <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '600' }}>{pinError}</Text>
                    ) : null}
                  </View>
                )}
              </View>

              <View style={styles.btnPairRow}>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => handleSavePasscodeAndNext(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryBtnText}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 1, backgroundColor: palette.accent }]}
                  onPress={() => handleSavePasscodeAndNext(false)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.primaryBtnText, { color: palette.bgDark }]}>Continue</Text>
                  <ArrowRight size={17} color={palette.bgDark} />
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* ── STEP 4: ANIMATED TOUR ── */}
          {step === 4 && (
            <View style={styles.centerStage}>
              <Animated.View
                style={[
                  styles.tourCard,
                  {
                    borderColor: `rgba(${palette.accentRgb}, 0.32)`,
                    opacity: tourAnim,
                    transform: [
                      {
                        translateY: tourAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [12, 0],
                        }),
                      },
                      {
                        scale: tourAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.97, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View
                  style={[
                    styles.tourIconCircle,
                    { backgroundColor: `rgba(${palette.accentRgb}, 0.14)`, borderColor: `rgba(${palette.accentRgb}, 0.35)` },
                  ]}
                >
                  <TourIcon size={32} color={palette.accent} />
                </View>

                <Text style={styles.tourStepCounter}>
                  {tourIdx + 1} / {TOUR_SLIDES.length}
                </Text>
                <Text style={styles.tourTitle}>{activeTour.title}</Text>
                <Text style={styles.tourDesc}>{activeTour.desc}</Text>
              </Animated.View>

              <View style={styles.tourDotsRow}>
                {TOUR_SLIDES.map((s, idx) => (
                  <View
                    key={s.key}
                    style={[
                      styles.progressDot,
                      idx === tourIdx && { width: 20, backgroundColor: palette.accent },
                    ]}
                  />
                ))}
              </View>

              <View style={[styles.btnPairRow, { width: '100%', marginTop: 22 }]}>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={completeOnboarding}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryBtnText}>Skip Tour</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 1, backgroundColor: palette.accent }]}
                  onPress={handleTourNext}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.primaryBtnText, { color: palette.bgDark }]}>
                    {tourIdx < TOUR_SLIDES.length - 1 ? 'Next' : 'Start Chatting'}
                  </Text>
                  <ArrowRight size={17} color={palette.bgDark} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 6,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  skipTopText: {
    fontSize: 13,
    fontWeight: '700',
  },
  centerStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  logoGlow: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  welcomeTitle: {
    color: '#f8fafc',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  welcomeSub: {
    color: '#94a3b8',
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 10,
  },
  featurePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  featurePillText: {
    color: '#e2e8f0',
    fontSize: 11.5,
    fontWeight: '700',
  },
  scrollStage: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  stepHeader: {
    marginBottom: 16,
    gap: 6,
  },
  stepTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
  },
  stepSub: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 19,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  optionTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
  optionSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 1,
  },
  cardBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    marginBottom: 12,
  },
  cardBoxTitle: {
    color: '#f8fafc',
    fontSize: 13.5,
    fontWeight: '700',
  },
  cardBoxSub: {
    color: '#94a3b8',
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  fieldLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: 'rgba(12, 15, 24, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 13.5,
  },
  provRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  provPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  provPillText: {
    color: '#cbd5e1',
    fontSize: 11.5,
    fontWeight: '700',
  },
  linkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 10,
  },
  linkBannerText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  localGuideBox: {
    marginTop: 10,
    padding: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 14, 24, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  localGuideTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  localGuideText: {
    color: '#94a3b8',
    fontSize: 11.5,
    lineHeight: 17,
  },
  modelChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 6,
  },
  modelChipText: {
    color: '#e2e8f0',
    fontSize: 11.5,
    fontWeight: '600',
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  testBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  pingBanner: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnPairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryBtn: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
  tourCard: {
    width: '100%',
    backgroundColor: 'rgba(18, 22, 34, 0.9)',
    borderRadius: 24,
    padding: 26,
    borderWidth: 1,
    alignItems: 'center',
  },
  tourIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  tourStepCounter: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 6,
  },
  tourTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  tourDesc: {
    color: '#94a3b8',
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
  },
  tourDotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 18,
  },
});
