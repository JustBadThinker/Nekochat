/**
 * CapabilityMatrixModal.tsx
 * Simple 1-screen Compatibility Matrix showing Supported / Unsupported / Unknown
 * across all content categories, with separate Model vs Provider evidence and opt-in testing.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { X, ShieldCheck, Play, RotateCcw } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModal } from './BottomSheetModal';
import { useTheme } from '../theme/ThemeContext';
import type { ProviderConfig } from '../types';
import { normalizeEndpointIdentity } from '../services/promptBudget';
import {
  buildEffectiveMatrix,
  CapabilityMatrixData,
  CapabilityStatus,
  createEmptyMatrixData,
} from '../services/capabilityMatrix';
import {
  CAPABILITY_TEST_CONSENT_NOTICE,
  loadCapabilityMatrix,
  recordManualCapabilityResult,
  runCapabilityTests,
} from '../services/capabilityTester';
import { aiProviderService } from '../services/aiProviderService';

interface CapabilityMatrixModalProps {
  visible: boolean;
  onClose: () => void;
  config: ProviderConfig;
}

const STATUS_COLORS: Record<CapabilityStatus, { bg: string; text: string; label: string }> = {
  supported: { bg: 'rgba(16, 185, 129, 0.16)', text: '#34d399', label: 'Supported' },
  unsupported: { bg: 'rgba(239, 68, 68, 0.16)', text: '#f87171', label: 'Unsupported' },
  unknown: { bg: 'rgba(148, 163, 184, 0.14)', text: '#94a3b8', label: 'Unknown' },
};

export const CapabilityMatrixModal: React.FC<CapabilityMatrixModalProps> = ({
  visible,
  onClose,
  config,
}) => {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [matrix, setMatrix] = useState<CapabilityMatrixData>(createEmptyMatrixData);
  const [filterStatus, setFilterStatus] = useState<'all' | CapabilityStatus>('all');
  const [consentChecked, setConsentChecked] = useState(false);
  const [running, setRunning] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (visible) {
      loadCapabilityMatrix().then(setMatrix).catch(() => {});
      setErrorText('');
    }
  }, [visible]);

  const modelId = config.model || config.defaultModel || 'unknown-model';
  const endpointIdentity = normalizeEndpointIdentity(config);

  const rows = useMemo(
    () => buildEffectiveMatrix(matrix, { modelId, endpointIdentity }),
    [matrix, modelId, endpointIdentity]
  );

  const counts = useMemo(() => {
    let supported = 0;
    let unsupported = 0;
    let unknown = 0;
    for (const r of rows) {
      if (r.effectiveStatus === 'supported') supported++;
      else if (r.effectiveStatus === 'unsupported') unsupported++;
      else unknown++;
    }
    return { supported, unsupported, unknown };
  }, [rows]);

  const filteredRows = useMemo(
    () => (filterStatus === 'all' ? rows : rows.filter(r => r.effectiveStatus === filterStatus)),
    [rows, filterStatus]
  );

  const handleRunTests = async (profile: 'quick' | 'full' | 'single', categoryIds?: string[]) => {
    if (running) return;
    if (!consentChecked) {
      setErrorText('Please check the consent box below before sending test prompts.');
      return;
    }
    setErrorText('');
    setRunning(true);
    try {
      const updated = await runCapabilityTests({
        config,
        profile,
        categoryIds,
        consentGranted: true,
        existingData: matrix,
        transport: (cfg, prompt) => aiProviderService.probeCapabilityPrompt(cfg, prompt),
        onProgress: (done, total, label) => {
          setProgressText(`${done}/${total} · ${label}`);
        },
      });
      setMatrix(updated);
    } catch (err: any) {
      setErrorText(err?.message || 'Capability test failed');
    } finally {
      setRunning(false);
      setProgressText('');
    }
  };

  const handleCycleManual = async (catId: string, current: CapabilityStatus) => {
    const next: CapabilityStatus =
      current === 'unknown' ? 'supported' : current === 'supported' ? 'unsupported' : 'unknown';
    const updated = await recordManualCapabilityResult({
      config,
      categoryId: catId,
      modelStatus: next,
      providerStatus: next,
      notes: 'Manual user check',
      existingData: matrix,
    });
    setMatrix(updated);
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetStyle={{ paddingHorizontal: 0, paddingBottom: 0, height: '86%', maxHeight: '86%' }}
    >
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <ShieldCheck size={18} color={palette.accent} style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Compatibility Matrix</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {modelId} · {endpointIdentity}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
          <X size={18} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* Summary & Filter Pills */}
      <View style={styles.filterRow}>
        {([
          { id: 'all', label: `All (${rows.length})` },
          { id: 'supported', label: `Supported (${counts.supported})` },
          { id: 'unsupported', label: `Unsupported (${counts.unsupported})` },
          { id: 'unknown', label: `Unknown (${counts.unknown})` },
        ] as const).map(f => {
          const active = filterStatus === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => setFilterStatus(f.id)}
              style={[
                styles.filterPill,
                active && { backgroundColor: palette.accent, borderColor: palette.accent },
              ]}
            >
              <Text style={[styles.filterText, active && { color: '#000', fontWeight: '700' }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        nestedScrollEnabled
        contentContainerStyle={{ padding: 14, gap: 8 }}
      >
        {filteredRows.map(row => {
          const badge = STATUS_COLORS[row.effectiveStatus];
          const dateStr = row.testedAt ? new Date(row.testedAt).toLocaleDateString() : 'Not tested';
          const sourceLabel =
            row.evidenceSource === 'direct_test'
              ? 'Tested'
              : row.evidenceSource === 'user_reported'
                ? 'User reported'
                : row.evidenceSource === 'official_provider_doc'
                  ? 'Provider doc'
                  : 'Not tested';

          return (
            <View key={row.category.id} style={styles.rowCard}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.catName}>{row.category.label}</Text>
                <Text style={styles.metaText}>
                  Model: {row.modelStatus} · Provider: {row.providerStatus} · {sourceLabel} ({dateStr})
                  {row.isStale ? ' · Stale' : ''}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                  onPress={() => handleCycleManual(row.category.id, row.effectiveStatus)}
                  style={[styles.statusBadge, { backgroundColor: badge.bg }]}
                >
                  <Text style={[styles.statusText, { color: badge.text }]}>{badge.label}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleRunTests('single', [row.category.id])}
                  disabled={running}
                  style={styles.retestBtn}
                >
                  <RotateCcw size={13} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Opt-In Consent + Run Buttons */}
      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 12) }]}>
        <TouchableOpacity
          onPress={() => setConsentChecked(v => !v)}
          style={styles.consentRow}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.checkbox,
              consentChecked && { backgroundColor: palette.accent, borderColor: palette.accent },
            ]}
          >
            {consentChecked && <Text style={{ color: '#000', fontSize: 10, fontWeight: '900' }}>✓</Text>}
          </View>
          <Text style={styles.consentText}>{CAPABILITY_TEST_CONSENT_NOTICE}</Text>
        </TouchableOpacity>

        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <TouchableOpacity
            onPress={() => handleRunTests('quick')}
            disabled={running}
            style={[styles.runBtn, { backgroundColor: palette.accent }]}
          >
            {running ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Play size={13} color="#000" style={{ marginRight: 5 }} />
                <Text style={styles.runBtnText}>Quick Test (5)</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleRunTests('full')}
            disabled={running}
            style={[styles.runBtn, { backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151' }]}
          >
            <Text style={[styles.runBtnText, { color: '#e5e7eb' }]}>
              {running && progressText ? progressText : 'Full Test (22)'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: { fontSize: 15, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterText: { fontSize: 11, color: '#cbd5e1', fontWeight: '600' },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  catName: { fontSize: 13, fontWeight: '700', color: '#f8fafc' },
  metaText: { fontSize: 10.5, color: '#94a3b8', marginTop: 3 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  retestBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  footer: {
    padding: 14,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#6b7280',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  consentText: { flex: 1, fontSize: 10.5, color: '#9ca3af', lineHeight: 14 },
  errorText: { color: '#f87171', fontSize: 11, marginTop: 6 },
  runBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
  },
  runBtnText: { fontSize: 12.5, fontWeight: '700', color: '#000' },
});
