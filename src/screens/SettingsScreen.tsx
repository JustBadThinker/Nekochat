/**
 * Settings Screen
 * Features Service Health & Latency Monitor, Dynamic Model Selector,
 * Sanitized .neko Vault, and Project Attribution.
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
import { Activity, Key, Cpu, ShieldCheck, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react-native';
import { ProviderConfig, AppSettings, LLMProvider } from '../types';
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
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>(config.provider);
  const [model, setModel] = useState(config.model || 'gemini-2.5-flash');

  // Latency Monitor State
  const [testingHealth, setTestingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{
    gemini?: { ok: boolean; latencyMs: number };
    chub?: { ok: boolean; latencyMs: number };
    datacat?: { ok: boolean; latencyMs: number };
    openrouter?: { ok: boolean; latencyMs: number };
  }>({});

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

  useEffect(() => {
    testAllServices();
  }, []);

  const handleSaveKeys = async () => {
    const updated = await storageService.saveProviderConfig({
      provider: selectedProvider,
      apiKey,
      model,
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

          {/* Service Ping Rows */}
          <View style={styles.pingRow}>
            <Text style={styles.serviceName}>Active LLM Engine (Gemini)</Text>
            <View style={styles.pingBadge}>
              <View style={[styles.dot, healthStatus.gemini?.ok ? styles.dotGreen : styles.dotOrange]} />
              <Text style={styles.pingText}>{healthStatus.gemini?.latencyMs ? `${healthStatus.gemini.latencyMs}ms` : 'Offline'}</Text>
            </View>
          </View>

          <View style={styles.pingRow}>
            <Text style={styles.serviceName}>Chub Community API</Text>
            <View style={styles.pingBadge}>
              <View style={[styles.dot, healthStatus.chub?.ok ? styles.dotGreen : styles.dotOrange]} />
              <Text style={styles.pingText}>{healthStatus.chub?.latencyMs ? `${healthStatus.chub.latencyMs}ms` : '...'}</Text>
            </View>
          </View>

          <View style={styles.pingRow}>
            <Text style={styles.serviceName}>Datacat (Janitor Mirror)</Text>
            <View style={styles.pingBadge}>
              <View style={[styles.dot, healthStatus.datacat?.ok ? styles.dotGreen : styles.dotOrange]} />
              <Text style={styles.pingText}>{healthStatus.datacat?.latencyMs ? `${healthStatus.datacat.latencyMs}ms` : '...'}</Text>
            </View>
          </View>
        </View>

        {/* 2. API Key Hub */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Key size={16} color={colors.lime} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>API Key Hub</Text>
          </View>

          {/* Provider Selector */}
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

          {/* API Key Input */}
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

          {/* Model Selector */}
          <Text style={styles.inputLabel}>Model Slug</Text>
          <TextInput
            style={styles.textInput}
            value={model}
            onChangeText={setModel}
            placeholder="e.g. gemini-2.5-flash or deepseek/deepseek-v3"
            placeholderTextColor={colors.textMuted}
          />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveKeys}>
            <Text style={styles.saveBtnText}>Save API Configuration</Text>
          </TouchableOpacity>
        </View>

        {/* 3. Token & Currency Preferences */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Cpu size={16} color={colors.lime} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Token & Cost Tracker</Text>
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

        {/* 4. Project Attribution & Heritage */}
        <View style={[styles.sectionCard, { borderColor: 'rgba(204, 255, 0, 0.3)' }]}>
          <View style={styles.sectionHeader}>
            <ShieldCheck size={16} color={colors.lime} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>About NekoChat</Text>
          </View>
          <Text style={styles.aboutVersion}>🐾 NekoChat v0.1.0-alpha</Text>
          <Text style={styles.aboutDesc}>
            Free & Open-Source AI Roleplay Client. Built with React Native & Expo for zero-latency 120Hz companion interactions.
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
    padding: 20,
    paddingBottom: 110,
  },
  screenTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
  },
  sectionCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
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
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  serviceName: {
    color: colors.textSecondary,
    fontSize: 13,
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
    fontSize: 12,
    fontWeight: '600',
  },
  providerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
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
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: 10,
  },
  saveBtn: {
    backgroundColor: colors.lime,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  saveBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
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
    fontSize: 12,
    fontWeight: '700',
  },
  aboutVersion: {
    color: colors.lime,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  aboutDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  aboutAttribution: {
    color: colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
  },
});

