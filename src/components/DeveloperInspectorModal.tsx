/**
 * DeveloperInspectorModal.tsx
 * Studio-grade, theme-aware DevTools Console available when Developer Mode is enabled.
 * Tabs:
 * 1. Overview  — 4-KPI hero bar, 1-tap Quick Actions, Local Engine, MySQL Server & Proxy Health
 * 2. Prompt    — Stacked token composition bar, section breakdown, collapsible raw prompt, & Stream Telemetry
 * 3. Msgs      — Full 1->N persisted message explorer with role accent bars & tap-to-expand
 * 4. Recall    — Guided Top-of-Chat Recall Lab + collapsible persistent <memory> & SQLite facts
 * 5. Keys      — Searchable @nekochat:* AsyncStorage inspector with size bars & secret redaction
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import {
  Activity,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  Layers,
  Play,
  RefreshCw,
  Search,
  Server,
  Terminal,
  Trash2,
  X,
  Zap,
} from 'lucide-react-native';
import { BottomSheetModal, BottomSheetScrollView } from './BottomSheetModal';
import { useTheme } from '../theme/ThemeContext';
import { storageService } from '../services/storageService';
import { getSqliteConversationRepository, SessionMemoryRecord } from '../services/sqliteDatabase';
import { BackendDevDiagnostics, mysqlBackendService } from '../services/mysqlBackendService';
import {
  clearDevTelemetry,
  getLastPromptSnapshot,
  getNetworkTelemetry,
  LastPromptSnapshot,
  NetworkTelemetryEntry,
} from '../services/devTelemetry';
import { resolveContextBudget } from '../services/promptBudget';
import {
  buildStressTestConversationMessages,
  extractDistinctiveQueryFromMessage,
  RECENT_RAW_OVERLAP_TURNS,
  RecalledOlderMessage,
  redactSensitiveStorageValue,
  searchOlderMessagesInMemory,
  STRESS_TEST_PLANTED_FACTS,
} from '../services/memoryRecall';
import { getM3TonalContainer, getSubtleSurfaceBg, getSurfaceBg } from '../theme/skins';
import type { Character, Conversation, ProviderConfig } from '../types';

export type InspectorTab = 'overview' | 'prompt' | 'messages' | 'recall' | 'storage';

export interface DeveloperInspectorModalProps {
  visible: boolean;
  onClose: () => void;
  initialConversationId?: string | null;
  initialTab?: InspectorTab;
  config?: ProviderConfig;
}

type MessageSliceMode = 'top25' | 'checkpoint' | 'latest25' | 'all';
type RecallExcludeMode = '6' | '12' | '20' | 'half';

interface SqliteDiagnostics {
  engine: 'sqlite';
  dbName: string;
  schemaVersion: number;
  fts5Supported: boolean;
  conversationCount: number;
  messageCount: number;
  ftsRowCount: number;
  sessionMemoryCount: number;
  castMemberCount: number;
}

interface RawKeySummary {
  key: string;
  bytes: number;
  rawValue: string;
}

const STRESS_CONV_PREFIX = 'dev_stress_120_';
const STRESS_TITLE_PREFIX = '[DEV] 120-Msg Recall Stress Test';

const SECTION_SEGMENT_COLORS = [
  '#38BDF8',
  '#34D399',
  '#FBBF24',
  '#C084FC',
  '#FB7185',
  '#60A5FA',
  '#2DD4BF',
  '#F97316',
];

function getConversationMemoryStorageKey(convId: string) {
  return `@nekochat:chat_memory_${convId}`;
}

function getConversationCheckpointStorageKey(convId: string) {
  return `@nekochat:chat_checkpoint_idx_${convId}`;
}

function formatClockTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export const DeveloperInspectorModal: React.FC<DeveloperInspectorModalProps> = ({
  visible,
  onClose,
  initialConversationId,
  initialTab = 'overview',
  config,
}) => {
  const { palette, skin } = useTheme();
  const isM3 = skin.id === 'material';
  const surfaceBg = getSurfaceBg(palette, skin);
  const subtleBg = getSubtleSurfaceBg(palette, skin);
  const cardBg = isM3 ? getM3TonalContainer(palette, 'container') : subtleBg;
  const cardBorderWidth = isM3 ? 0 : 1;

  const [tab, setTab] = useState<InspectorTab>(initialTab);
  const [loading, setLoading] = useState(false);

  const [sqliteDiag, setSqliteDiag] = useState<SqliteDiagnostics | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [charactersById, setCharactersById] = useState<Record<string, Character>>({});
  const [rawKeys, setRawKeys] = useState<RawKeySummary[]>([]);
  const [activeProviderCfg, setActiveProviderCfg] = useState<ProviderConfig | undefined>(config);

  const [selectedConvId, setSelectedConvId] = useState<string | null>(initialConversationId || null);
  const selectedConvIdRef = useRef<string | null>(initialConversationId || null);
  selectedConvIdRef.current = selectedConvId;

  const [selectedStorageKey, setSelectedStorageKey] = useState<string | null>(null);
  const selectedStorageKeyRef = useRef<string | null>(null);
  selectedStorageKeyRef.current = selectedStorageKey;

  // Server & Telemetry State
  const [backendDiag, setBackendDiag] = useState<BackendDevDiagnostics | null>(null);
  const [probingBackend, setProbingBackend] = useState(false);
  const [lastPromptSnap, setLastPromptSnap] = useState<LastPromptSnapshot | null>(null);
  const [netLogs, setNetLogs] = useState<NetworkTelemetryEntry[]>([]);

  // Expandable UI toggles
  const [rawPromptExpanded, setRawPromptExpanded] = useState(false);
  const [expandedNetIds, setExpandedNetIds] = useState<Record<string, boolean>>({});
  const [expandedMsgIds, setExpandedMsgIds] = useState<Record<string, boolean>>({});
  const [savedMemoryExpanded, setSavedMemoryExpanded] = useState(false);
  const [recalledPromptExpanded, setRecalledPromptExpanded] = useState(false);

  // Filters & Stress Seeder
  const [seedingStress, setSeedingStress] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [msgSliceMode, setMsgSliceMode] = useState<MessageSliceMode>('top25');
  const [msgSearchFilter, setMsgSearchFilter] = useState('');
  const [storageSearchFilter, setStorageSearchFilter] = useState('');

  // Memory & Recall Lab
  const [convMemoryText, setConvMemoryText] = useState('');
  const [convCheckpointIdx, setConvCheckpointIdx] = useState<number>(-1);
  const [sessionMemories, setSessionMemories] = useState<SessionMemoryRecord[]>([]);
  const [recallQuery, setRecallQuery] = useState('');
  const [recallExcludeMode, setRecallExcludeMode] = useState<RecallExcludeMode>('20');
  const [recallRunning, setRecallRunning] = useState(false);
  const [recallHits, setRecallHits] = useState<RecalledOlderMessage[]>([]);
  const [recallEngineUsed, setRecallEngineUsed] = useState<string>('');
  const [recallHasRun, setRecallHasRun] = useState(false);

  const flashBanner = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), 2600);
  };

  const runBackendProbe = useCallback(async () => {
    setProbingBackend(true);
    try {
      const diag = await mysqlBackendService.getDevDiagnostics();
      setBackendDiag(diag);
      setNetLogs(getNetworkTelemetry());
    } finally {
      setProbingBackend(false);
    }
  }, []);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const [repo, convList, charList, allKeys, storedCfg] = await Promise.all([
        getSqliteConversationRepository(),
        storageService.getConversations(),
        storageService.getCharacters(),
        AsyncStorage.getAllKeys().catch(() => [] as string[]),
        storageService.getProviderConfig().catch(() => undefined),
      ]);

      if (repo) {
        const diag = await repo.getDiagnosticsSummary().catch(() => null);
        setSqliteDiag(diag);
      } else {
        setSqliteDiag(null);
      }

      const sortedConvs = [...convList].sort(
        (a, b) => (b.messages?.length || 0) - (a.messages?.length || 0)
      );
      setConversations(sortedConvs);

      const charMap: Record<string, Character> = {};
      for (const c of charList) {
        charMap[c.id] = c;
      }
      setCharactersById(charMap);
      setActiveProviderCfg(config || storedCfg);
      setLastPromptSnap(getLastPromptSnapshot());
      setNetLogs(getNetworkTelemetry());

      const nekoKeys = allKeys.filter(k => k.startsWith('@nekochat:'));
      if (nekoKeys.length > 0) {
        const pairs = await AsyncStorage.multiGet(nekoKeys).catch(() => [] as readonly [string, string | null][]);
        const summaries: RawKeySummary[] = pairs
          .map(([k, v]) => {
            const val = v ?? '';
            return { key: k, bytes: val.length, rawValue: val };
          })
          .sort((a, b) => b.bytes - a.bytes);
        setRawKeys(summaries);
        if (!selectedStorageKeyRef.current && summaries.length > 0) {
          setSelectedStorageKey(summaries[0].key);
        }
      } else {
        setRawKeys([]);
      }

      const curSelected = selectedConvIdRef.current;
      const preferredId =
        initialConversationId && sortedConvs.some(c => c.id === initialConversationId)
          ? initialConversationId
          : curSelected && sortedConvs.some(c => c.id === curSelected)
            ? curSelected
            : sortedConvs[0]?.id || null;
      setSelectedConvId(preferredId);
    } finally {
      setLoading(false);
    }
  }, [config, initialConversationId]);

  useEffect(() => {
    if (visible) {
      setTab(initialTab);
      loadSnapshot();
      runBackendProbe();
    }
  }, [visible, initialTab, loadSnapshot, runBackendProbe]);

  const selectedConv = useMemo(
    () => conversations.find(c => c.id === selectedConvId) || null,
    [conversations, selectedConvId]
  );

  // Load selected conversation's memory, checkpoint & SQLite structured memories
  useEffect(() => {
    let active = true;
    const loadConvMemory = async () => {
      if (!selectedConv) {
        if (active) {
          setConvMemoryText('');
          setConvCheckpointIdx(-1);
          setSessionMemories([]);
          setRecallHits([]);
          setRecallHasRun(false);
        }
        return;
      }

      const [savedMem, savedIdx, repo] = await Promise.all([
        AsyncStorage.getItem(getConversationMemoryStorageKey(selectedConv.id)).catch(() => null),
        AsyncStorage.getItem(getConversationCheckpointStorageKey(selectedConv.id)).catch(() => null),
        getSqliteConversationRepository(),
      ]);

      let structured: SessionMemoryRecord[] = [];
      if (repo) {
        structured = await repo
          .getSessionMemories(selectedConv.id, selectedConv.characterId)
          .catch(() => []);
      }

      if (!active) return;
      setConvMemoryText(savedMem || selectedConv.summary || '');
      const parsedIdx = savedIdx !== null ? parseInt(savedIdx, 10) : selectedConv.memoryCheckpoint ?? -1;
      setConvCheckpointIdx(Number.isNaN(parsedIdx) ? -1 : parsedIdx);
      setSessionMemories(structured);
      setRecallHits([]);
      setRecallHasRun(false);

      const firstMsg = selectedConv.messages?.[0];
      if (firstMsg) {
        const autoKw = extractDistinctiveQueryFromMessage(firstMsg.content);
        if (autoKw) {
          setRecallQuery(prev => (prev.trim() ? prev : autoKw));
        }
      }
    };

    loadConvMemory();
    return () => {
      active = false;
    };
  }, [selectedConv]);

  const totalMessagesAcrossChats = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.messages?.length || 0), 0),
    [conversations]
  );

  const totalStorageBytes = useMemo(
    () => rawKeys.reduce((sum, k) => sum + k.bytes, 0),
    [rawKeys]
  );

  const maxStorageKeyBytes = useMemo(
    () => rawKeys.reduce((max, k) => (k.bytes > max ? k.bytes : max), 1),
    [rawKeys]
  );

  const filteredRawKeys = useMemo(() => {
    const q = storageSearchFilter.trim().toLowerCase();
    if (!q) return rawKeys;
    return rawKeys.filter(k => k.key.toLowerCase().includes(q));
  }, [rawKeys, storageSearchFilter]);

  const stressConversations = useMemo(
    () =>
      conversations.filter(
        c => c.id.startsWith(STRESS_CONV_PREFIX) || c.title.startsWith(STRESS_TITLE_PREFIX)
      ),
    [conversations]
  );

  const resolvedBudget = useMemo(
    () => (activeProviderCfg ? resolveContextBudget(activeProviderCfg) : null),
    [activeProviderCfg]
  );

  const displayedMessages = useMemo(() => {
    const msgs = selectedConv?.messages || [];
    const indexed = msgs.map((m, i) => ({ msg: m, turnIndex: i }));

    const needle = msgSearchFilter.trim().toLowerCase();
    if (needle) {
      return indexed
        .filter(item => String(item.msg.content || '').toLowerCase().includes(needle))
        .slice(0, 120);
    }

    if (msgSliceMode === 'top25') {
      return indexed.slice(0, 25);
    }
    if (msgSliceMode === 'checkpoint') {
      if (convCheckpointIdx >= 0) {
        const start = Math.max(0, convCheckpointIdx - 10);
        return indexed.slice(start, start + 25);
      }
      return indexed.slice(0, 25);
    }
    if (msgSliceMode === 'latest25') {
      return indexed.slice(Math.max(0, indexed.length - 25));
    }
    return indexed.slice(0, 200);
  }, [selectedConv, msgSliceMode, msgSearchFilter, convCheckpointIdx]);

  const handleCopyText = async (label: string, text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      flashBanner(`Copied ${label}`);
    } catch {
      Share.share({ message: text }).catch(() => {});
    }
  };

  const handleCopyDebugReport = async () => {
    const report = {
      generatedAt: new Date().toISOString(),
      platform: Platform.OS,
      localDb: sqliteDiag || {
        engine: 'asyncstorage_web',
        conversations: conversations.length,
        totalMessages: totalMessagesAcrossChats,
        storageKeys: rawKeys.length,
        storageKb: Number((totalStorageBytes / 1024).toFixed(1)),
      },
      backend: backendDiag
        ? {
            baseUrl: backendDiag.baseUrl,
            health: backendDiag.health,
            stats: backendDiag.stats,
            communityProxy: backendDiag.communityProxy,
            rootProxy: backendDiag.rootProxy,
            authUser: backendDiag.storedUser,
          }
        : null,
      activeBudget: resolvedBudget,
      lastPrompt: lastPromptSnap
        ? {
            character: lastPromptSnap.characterName,
            model: lastPromptSnap.model,
            totalInputTokens: lastPromptSnap.totalInputTokens,
            contextLimit: lastPromptSnap.contextLimit,
            turnsKept: lastPromptSnap.turnsKept,
            turnsTrimmed: lastPromptSnap.turnsTrimmed,
            recallEngine: lastPromptSnap.recallEngine,
            recalledTurns: lastPromptSnap.recalledTurns,
            sections: lastPromptSnap.sections,
          }
        : null,
      recentNetworkLogs: netLogs.slice(0, 10),
    };
    await handleCopyText('debug report', JSON.stringify(report, null, 2));
  };

  const handleSeedStressChat = async () => {
    if (seedingStress) return;
    setSeedingStress(true);
    try {
      const charList = Object.values(charactersById);
      const targetChar = charList[0];
      const charId = targetChar?.id || selectedConv?.characterId || 'char_stress_dev';
      const charName = targetChar?.name || 'Lyra';
      const personas = await storageService.getPersonas().catch(() => []);
      const userName = personas[0]?.name || 'User';

      const convId = `${STRESS_CONV_PREFIX}${Date.now()}`;
      const seededMessages = buildStressTestConversationMessages({
        conversationId: convId,
        characterId: charId,
        charName,
        userName,
        totalTurns: 120,
      });

      const nowIso = new Date().toISOString();
      const syntheticConv: Conversation = {
        id: convId,
        userId: 'default_user',
        characterId: charId,
        personaId: personas[0]?.id || 'default_persona',
        providerId: activeProviderCfg?.id || 'prov_gemini',
        title: `${STRESS_TITLE_PREFIX} (${charName})`,
        modelName: activeProviderCfg?.model || activeProviderCfg?.defaultModel,
        messages: seededMessages,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await storageService.upsertConversation(syntheticConv);
      setSelectedConvId(convId);
      setRecallQuery(STRESS_TEST_PLANTED_FACTS[0].query);
      setRecallExcludeMode('20');
      await loadSnapshot();
      setTab('recall');
      flashBanner('Seeded 120-msg test chat — ready in Recall Lab');
    } finally {
      setSeedingStress(false);
    }
  };

  const handleCleanStressChats = async () => {
    if (stressConversations.length === 0) return;
    for (const c of stressConversations) {
      await AsyncStorage.removeItem(getConversationMemoryStorageKey(c.id)).catch(() => {});
      await AsyncStorage.removeItem(getConversationCheckpointStorageKey(c.id)).catch(() => {});
      await storageService.deleteConversation(c.id).catch(() => {});
    }
    if (selectedConv && stressConversations.some(s => s.id === selectedConv.id)) {
      setSelectedConvId(null);
    }
    await loadSnapshot();
    flashBanner(`Removed ${stressConversations.length} stress test chat(s)`);
  };

  const handlePullTurnOneKeyword = () => {
    const firstEligible = (selectedConv?.messages || []).find(
      m => (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim().length > 0
    );
    if (!firstEligible) return;
    const kw = extractDistinctiveQueryFromMessage(firstEligible.content);
    if (kw) setRecallQuery(kw);
  };

  const handleRunRecallTest = async (overrideQuery?: string) => {
    const effectiveQuery = (overrideQuery ?? recallQuery).trim();
    if (!selectedConv || !effectiveQuery || recallRunning) return;
    if (overrideQuery !== undefined) {
      setRecallQuery(overrideQuery);
    }
    setRecallRunning(true);
    try {
      const msgs = selectedConv.messages || [];
      const excludeCount =
        recallExcludeMode === 'half'
          ? Math.max(1, Math.floor(msgs.length / 2))
          : parseInt(recallExcludeMode, 10);
      const tailSliceStart = Math.max(0, msgs.length - excludeCount);
      const excludedIds = msgs
        .slice(tailSliceStart)
        .map(m => m.id)
        .filter((id): id is string => Boolean(id));

      const repo = await getSqliteConversationRepository();
      if (repo) {
        const sqlHits = await repo.searchOlderMessagesForConversation({
          conversationId: selectedConv.id,
          characterId: selectedConv.characterId,
          query: effectiveQuery,
          excludeMessageIds: excludedIds,
          maxSnippets: 3,
          maxTokens: 300,
        });
        if (sqlHits.length > 0) {
          setRecallEngineUsed('SQLite FTS5 / BM25');
          setRecallHits(
            sqlHits.map(h => ({
              messageId: h.messageId,
              role: h.role,
              turnIndex: h.turnIndex,
              content: h.content,
              score: Math.abs(h.bm25Score),
              matchedTerms: [],
              engine: 'sqlite_fts5',
            }))
          );
          setRecallHasRun(true);
          return;
        }
      }

      const memHits = searchOlderMessagesInMemory({
        history: msgs,
        query: effectiveQuery,
        excludeMessageIds: excludedIds,
        excludeAfterTurnIndex: tailSliceStart,
        maxSnippets: 3,
        maxTokens: 300,
      });
      setRecallEngineUsed(repo ? 'In-Memory BM25 Fallback' : 'Web AsyncStorage + BM25');
      setRecallHits(memHits);
      setRecallHasRun(true);
    } finally {
      setRecallRunning(false);
    }
  };

  const selectedRawEntry = useMemo(
    () => rawKeys.find(r => r.key === selectedStorageKey) || null,
    [rawKeys, selectedStorageKey]
  );

  const redactedPreview = useMemo(() => {
    if (!selectedRawEntry) return '';
    const masked = redactSensitiveStorageValue(selectedRawEntry.key, selectedRawEntry.rawValue);
    return masked.length > 6000 ? `${masked.slice(0, 6000)}\n\n... [truncated ${masked.length - 6000} chars]` : masked;
  }, [selectedRawEntry]);

  const charName = selectedConv
    ? charactersById[selectedConv.characterId]?.name || selectedConv.title
    : 'No chat';

  const monoFont = Platform.OS === 'ios' ? 'Courier' : 'monospace';
  const serverHealthy = Boolean(backendDiag?.health.ok && backendDiag?.health.mysqlConnected);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetStyle={[
        styles.sheet,
        {
          backgroundColor: surfaceBg,
          borderTopLeftRadius: Math.max(20, skin.cardRadius),
          borderTopRightRadius: Math.max(20, skin.cardRadius),
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 6 }}>
          <View style={styles.titleRow}>
            <Terminal size={16} color={palette.accent} />
            <Text style={styles.title}>Developer Console</Text>
            <View style={[styles.engineBadge, { backgroundColor: `rgba(${palette.accentRgb}, 0.16)` }]}>
              <Text style={[styles.engineBadgeText, { color: palette.accent }]}>
                {sqliteDiag ? (sqliteDiag.fts5Supported ? 'SQLite FTS5' : 'SQLite') : 'Web BM25'}
              </Text>
            </View>
          </View>
          <Text
            style={[styles.subtitle, statusBanner ? { color: palette.accent, fontWeight: '600' } : undefined]}
            numberOfLines={1}
          >
            {statusBanner ||
              `${conversations.length} chats · ${totalMessagesAcrossChats} msgs · ${(totalStorageBytes / 1024).toFixed(1)} KB`}
          </Text>
        </View>
        <TouchableOpacity onPress={handleCopyDebugReport} style={styles.iconBtn} activeOpacity={0.75}>
          <Copy size={14} color={palette.accent} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            loadSnapshot();
            runBackendProbe();
          }}
          style={styles.iconBtn}
          activeOpacity={0.75}
        >
          <RefreshCw size={14} color="#cbd5e1" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={styles.iconBtn} activeOpacity={0.75}>
          <X size={16} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* Equal-Width 5-Segment Mobile Tab Bar (never clips or needs scrolling) */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: cardBg,
            borderWidth: cardBorderWidth,
            borderColor: 'rgba(255, 255, 255, 0.08)',
          },
        ]}
      >
        {[
          { id: 'overview' as InspectorTab, label: 'Overview', Icon: Database, dot: backendDiag ? (serverHealthy ? '#34d399' : '#f87171') : undefined },
          { id: 'prompt' as InspectorTab, label: 'Prompt', Icon: Activity, dot: netLogs.length > 0 ? palette.accent : undefined },
          { id: 'messages' as InspectorTab, label: 'Msgs', Icon: Layers },
          { id: 'recall' as InspectorTab, label: 'Recall', Icon: Brain },
          { id: 'storage' as InspectorTab, label: 'Keys', Icon: Terminal },
        ].map(tItem => {
          const active = tab === tItem.id;
          const IconComp = tItem.Icon;
          return (
            <TouchableOpacity
              key={tItem.id}
              onPress={() => setTab(tItem.id)}
              activeOpacity={0.8}
              style={[
                styles.tabBtn,
                active && {
                  backgroundColor: `rgba(${palette.accentRgb}, 0.16)`,
                  borderWidth: isM3 ? 0 : 1,
                  borderColor: `rgba(${palette.accentRgb}, 0.4)`,
                },
              ]}
            >
              <View style={{ position: 'relative' }}>
                <IconComp size={14} color={active ? palette.accent : '#94a3b8'} />
                {tItem.dot && (
                  <View style={[styles.tabDot, { backgroundColor: tItem.dot }]} />
                )}
              </View>
              <Text style={[styles.tabText, active && { color: palette.accent, fontWeight: '700' }]} numberOfLines={1}>
                {tItem.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <BottomSheetScrollView
        style={styles.body}
        contentContainerStyle={{ paddingBottom: 28 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={styles.mutedText}>Syncing diagnostics...</Text>
          </View>
        )}

        {/* Horizontal Conversation Switcher Strip for Msgs & Recall */}
        {(tab === 'messages' || tab === 'recall') && conversations.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={[styles.sectionLabel, { marginBottom: 6 }]}>ACTIVE TARGET CONVERSATION</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {conversations.slice(0, 15).map(conv => {
                const active = conv.id === selectedConvId;
                const isStress = conv.title.startsWith(STRESS_TITLE_PREFIX);
                const cName = isStress
                  ? 'Stress 120'
                  : charactersById[conv.characterId]?.name || conv.title || 'Chat';
                const count = conv.messages?.length || 0;
                return (
                  <TouchableOpacity
                    key={conv.id}
                    onPress={() => setSelectedConvId(conv.id)}
                    activeOpacity={0.8}
                    style={[
                      styles.convPill,
                      {
                        backgroundColor: active ? `rgba(${palette.accentRgb}, 0.18)` : cardBg,
                        borderColor: active ? palette.accent : 'rgba(255,255,255,0.08)',
                        borderWidth: active ? 1.25 : cardBorderWidth,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active ? palette.accent : '#e2e8f0',
                        fontSize: 11.5,
                        fontWeight: active ? '700' : '600',
                      }}
                      numberOfLines={1}
                    >
                      {cName} · {count}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: OVERVIEW (KPI Hero + Quick Actions + Local Engine + MySQL) */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === 'overview' && (
          <View style={{ gap: 12 }}>
            {/* 4-Column KPI Hero Strip */}
            <View style={styles.kpiRow}>
              <View style={[styles.kpiCell, { backgroundColor: cardBg, borderWidth: cardBorderWidth }]}>
                <Text style={styles.kpiLabel}>Chats</Text>
                <Text style={styles.kpiValue}>
                  {sqliteDiag ? sqliteDiag.conversationCount : conversations.length}
                </Text>
              </View>
              <View style={[styles.kpiCell, { backgroundColor: cardBg, borderWidth: cardBorderWidth }]}>
                <Text style={styles.kpiLabel}>Msgs</Text>
                <Text style={[styles.kpiValue, { color: palette.accent }]}>
                  {sqliteDiag ? sqliteDiag.messageCount : totalMessagesAcrossChats}
                </Text>
              </View>
              <View style={[styles.kpiCell, { backgroundColor: cardBg, borderWidth: cardBorderWidth }]}>
                <Text style={styles.kpiLabel}>Storage</Text>
                <Text style={styles.kpiValue}>{(totalStorageBytes / 1024).toFixed(0)}KB</Text>
              </View>
              <View style={[styles.kpiCell, { backgroundColor: cardBg, borderWidth: cardBorderWidth }]}>
                <Text style={styles.kpiLabel}>MySQL</Text>
                <Text style={[styles.kpiValue, { color: serverHealthy ? '#34d399' : '#f87171' }]}>
                  {probingBackend && !backendDiag ? '...' : serverHealthy ? 'Live' : 'Off'}
                </Text>
              </View>
            </View>

            {/* Quick Action Strip */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <TouchableOpacity
                onPress={runBackendProbe}
                disabled={probingBackend}
                activeOpacity={0.82}
                style={[styles.actionBtn, { backgroundColor: cardBg, borderWidth: cardBorderWidth }]}
              >
                {probingBackend ? (
                  <ActivityIndicator size="small" color={palette.accent} />
                ) : (
                  <Server size={13} color={palette.accent} />
                )}
                <Text style={styles.actionBtnText}>Ping Server</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSeedStressChat}
                disabled={seedingStress}
                activeOpacity={0.85}
                style={[
                  styles.actionBtn,
                  { backgroundColor: palette.accent, borderWidth: 0 },
                ]}
              >
                {seedingStress ? (
                  <ActivityIndicator size="small" color={palette.bgDark} />
                ) : (
                  <Zap size={13} color={palette.bgDark} />
                )}
                <Text style={{ color: palette.bgDark, fontSize: 12, fontWeight: '800' }}>
                  Seed 120-Msg Chat
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCopyDebugReport}
                activeOpacity={0.82}
                style={[styles.actionBtn, { backgroundColor: cardBg, borderWidth: cardBorderWidth }]}
              >
                <Copy size={13} color="#cbd5e1" />
                <Text style={styles.actionBtnText}>Copy Report</Text>
              </TouchableOpacity>

              {stressConversations.length > 0 && (
                <TouchableOpacity
                  onPress={handleCleanStressChats}
                  activeOpacity={0.82}
                  style={[
                    styles.actionBtn,
                    { backgroundColor: 'rgba(248,113,113,0.12)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.35)' },
                  ]}
                >
                  <Trash2 size={13} color="#fda4af" />
                  <Text style={{ color: '#fda4af', fontSize: 11.5, fontWeight: '700' }}>
                    Clean Stress ({stressConversations.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Local Engine & Active Model Card */}
            <View style={[styles.card, { backgroundColor: cardBg, borderWidth: cardBorderWidth }]}>
              <Text style={styles.sectionLabel}>LOCAL RUNTIME & MODEL BUDGET</Text>
              <View style={styles.cleanList}>
                <View style={styles.cleanRow}>
                  <Text style={styles.cleanKey}>Storage Engine</Text>
                  <Text style={styles.cleanVal}>
                    {sqliteDiag ? `${sqliteDiag.dbName} v${sqliteDiag.schemaVersion}` : `AsyncStorage (${Platform.OS})`}
                  </Text>
                </View>
                <View style={styles.hairline} />
                <View style={styles.cleanRow}>
                  <Text style={styles.cleanKey}>Recall Engine</Text>
                  <Text style={[styles.cleanVal, { color: palette.accent }]}>
                    {sqliteDiag?.fts5Supported ? `SQLite FTS5 (${sqliteDiag.ftsRowCount} indexed)` : 'In-Memory BM25'}
                  </Text>
                </View>
                <View style={styles.hairline} />
                <View style={styles.cleanRow}>
                  <Text style={styles.cleanKey}>Continuity Buffer</Text>
                  <Text style={styles.cleanVal}>Last {RECENT_RAW_OVERLAP_TURNS} raw turns</Text>
                </View>
                {resolvedBudget && (
                  <>
                    <View style={styles.hairline} />
                    <View style={styles.cleanRow}>
                      <Text style={styles.cleanKey}>Active Model</Text>
                      <Text style={styles.cleanVal} numberOfLines={1}>
                        {resolvedBudget.rawModel || 'default'}
                      </Text>
                    </View>
                    <View style={styles.hairline} />
                    <View style={styles.cleanRow}>
                      <Text style={styles.cleanKey}>Context / Max Out</Text>
                      <Text style={[styles.cleanVal, { color: palette.accent }]}>
                        {resolvedBudget.contextLimit.toLocaleString()} ({resolvedBudget.contextSource}) · {resolvedBudget.maxOutputTokens || 'Unlim'}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* MySQL Server & Proxy Health Card */}
            <View style={[styles.card, { backgroundColor: cardBg, borderWidth: cardBorderWidth }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.sectionLabel}>MYSQL & PROXY PROBES</Text>
                {backendDiag && (
                  <Text style={{ color: '#64748B', fontSize: 10.5, fontFamily: monoFont }} numberOfLines={1}>
                    {backendDiag.baseUrl}
                  </Text>
                )}
              </View>

              {backendDiag ? (
                <>
                  <View style={styles.cleanList}>
                    {[
                      {
                        name: '/api/health (MySQL)',
                        probe: backendDiag.health,
                        tag: backendDiag.health.mysqlConnected ? backendDiag.health.database || 'OK' : 'Off',
                      },
                      {
                        name: '/api/dev/stats',
                        probe: backendDiag.stats,
                        tag: backendDiag.stats.uptimeSec !== undefined ? `up ${backendDiag.stats.uptimeSec}s` : 'Off',
                      },
                      {
                        name: '/api/community',
                        probe: backendDiag.communityProxy,
                        tag: backendDiag.communityProxy.ok ? 'OK' : 'Err',
                      },
                      {
                        name: '/health (Proxy)',
                        probe: backendDiag.rootProxy,
                        tag: backendDiag.rootProxy.ok ? 'OK' : 'Err',
                      },
                      {
                        name: '/api/auth/me',
                        probe: backendDiag.authProbe,
                        tag: backendDiag.storedUser ? `@${backendDiag.storedUser.username}` : 'Guest',
                      },
                    ].map((row, idx) => (
                      <React.Fragment key={row.name}>
                        {idx > 0 && <View style={styles.hairline} />}
                        <View style={styles.cleanRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                            <View
                              style={[
                                styles.statusDot,
                                { backgroundColor: row.probe.ok ? '#34d399' : '#f87171' },
                              ]}
                            />
                            <Text style={styles.cleanKey} numberOfLines={1}>{row.name}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ color: '#94A3B8', fontSize: 11 }}>{row.tag}</Text>
                            <View style={styles.latencyPill}>
                              <Text style={{ color: row.probe.ok ? '#34d399' : '#fca5a5', fontSize: 10.5, fontFamily: monoFont, fontWeight: '700' }}>
                                {row.probe.latencyMs}ms
                              </Text>
                            </View>
                          </View>
                        </View>
                      </React.Fragment>
                    ))}
                  </View>

                  {backendDiag.stats.ok && backendDiag.stats.counts && (
                    <View style={[styles.kpiRow, { marginTop: 4 }]}>
                      <View style={[styles.kpiMini, { backgroundColor: 'rgba(0,0,0,0.22)' }]}>
                        <Text style={styles.kpiLabel}>Users</Text>
                        <Text style={styles.kpiMiniVal}>{backendDiag.stats.counts.users}</Text>
                      </View>
                      <View style={[styles.kpiMini, { backgroundColor: 'rgba(0,0,0,0.22)' }]}>
                        <Text style={styles.kpiLabel}>Sessions</Text>
                        <Text style={styles.kpiMiniVal}>{backendDiag.stats.counts.sessions}</Text>
                      </View>
                      <View style={[styles.kpiMini, { backgroundColor: 'rgba(0,0,0,0.22)' }]}>
                        <Text style={styles.kpiLabel}>Chars</Text>
                        <Text style={styles.kpiMiniVal}>{backendDiag.stats.counts.characters}</Text>
                      </View>
                      <View style={[styles.kpiMini, { backgroundColor: 'rgba(0,0,0,0.22)' }]}>
                        <Text style={styles.kpiLabel}>Uploads</Text>
                        <Text style={styles.kpiMiniVal}>
                          {backendDiag.stats.uploads?.fileCount ?? 0}
                        </Text>
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.mutedText}>Checking server...</Text>
              )}
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: PROMPT BREAKDOWN & STREAM TELEMETRY                         */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === 'prompt' && (
          <View style={{ gap: 12 }}>
            {lastPromptSnap ? (
              <View style={[styles.card, { backgroundColor: cardBg, borderWidth: cardBorderWidth }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.sectionLabel}>LAST PROMPT COMPOSITION</Text>
                  <Text style={{ color: '#64748B', fontSize: 10.5, fontFamily: monoFont }}>
                    {formatClockTime(lastPromptSnap.timestamp)}
                  </Text>
                </View>

                <View style={styles.kpiRow}>
                  <View style={[styles.kpiMini, { backgroundColor: 'rgba(0,0,0,0.22)' }]}>
                    <Text style={styles.kpiLabel}>Input</Text>
                    <Text style={[styles.kpiMiniVal, { color: palette.accent }]}>
                      {lastPromptSnap.totalInputTokens}
                    </Text>
                  </View>
                  <View style={[styles.kpiMini, { backgroundColor: 'rgba(0,0,0,0.22)' }]}>
                    <Text style={styles.kpiLabel}>Used %</Text>
                    <Text style={styles.kpiMiniVal}>
                      {Math.min(
                        100,
                        Math.round((lastPromptSnap.totalInputTokens / Math.max(1, lastPromptSnap.contextLimit)) * 100)
                      )}%
                    </Text>
                  </View>
                  <View style={[styles.kpiMini, { backgroundColor: 'rgba(0,0,0,0.22)' }]}>
                    <Text style={styles.kpiLabel}>Turns</Text>
                    <Text style={styles.kpiMiniVal}>
                      {lastPromptSnap.turnsKept}/{lastPromptSnap.turnsKept + lastPromptSnap.turnsTrimmed}
                    </Text>
                  </View>
                  <View style={[styles.kpiMini, { backgroundColor: 'rgba(0,0,0,0.22)' }]}>
                    <Text style={styles.kpiLabel}>Recalled</Text>
                    <Text style={styles.kpiMiniVal}>
                      {lastPromptSnap.recalledTurns.length > 0
                        ? lastPromptSnap.recalledTurns.map(n => `#${n}`).join(',')
                        : '0'}
                    </Text>
                  </View>
                </View>

                {/* Stacked Proportional Bar */}
                <View style={styles.stackedTrack}>
                  {lastPromptSnap.sections.map((sec, idx) => (
                    <View
                      key={sec.label}
                      style={{
                        flex: Math.max(1, sec.tokens),
                        backgroundColor: SECTION_SEGMENT_COLORS[idx % SECTION_SEGMENT_COLORS.length],
                      }}
                    />
                  ))}
                </View>

                {/* Clean Legend List */}
                <View style={styles.cleanList}>
                  {lastPromptSnap.sections.map((sec, idx) => {
                    const pct = Math.max(
                      1,
                      Math.round((sec.tokens / Math.max(1, lastPromptSnap.totalInputTokens)) * 100)
                    );
                    const dotColor = SECTION_SEGMENT_COLORS[idx % SECTION_SEGMENT_COLORS.length];
                    return (
                      <View key={sec.label} style={styles.cleanRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                          <Text style={styles.cleanKey} numberOfLines={1}>{sec.label}</Text>
                        </View>
                        <Text style={{ color: '#cbd5e1', fontSize: 11.5, fontFamily: monoFont }}>
                          {sec.tokens} tok ({pct}%)
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Collapsible Raw System Prompt Drawer */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <TouchableOpacity
                    onPress={() => setRawPromptExpanded(v => !v)}
                    style={[styles.secondaryBtn, { borderColor: 'rgba(255,255,255,0.14)' }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      {rawPromptExpanded ? (
                        <ChevronDown size={13} color="#e2e8f0" />
                      ) : (
                        <ChevronRight size={13} color="#e2e8f0" />
                      )}
                      <Text style={{ color: '#e2e8f0', fontSize: 11.5, fontWeight: '700' }}>
                        {rawPromptExpanded ? 'Hide Raw System Prompt' : 'View Raw System Prompt'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleCopyText('system prompt', lastPromptSnap.fullSystemPrompt)}
                    style={[styles.miniActionBtn, { borderColor: `rgba(${palette.accentRgb}, 0.4)` }]}
                  >
                    <Copy size={13} color={palette.accent} />
                    <Text style={{ color: palette.accent, fontSize: 11.5, fontWeight: '700' }}>Copy</Text>
                  </TouchableOpacity>
                </View>

                {rawPromptExpanded && (
                  <Text style={[styles.codePreview, { fontFamily: monoFont }]}>
                    {lastPromptSnap.fullSystemPrompt}
                  </Text>
                )}
              </View>
            ) : (
              <View style={[styles.card, { backgroundColor: cardBg, borderWidth: cardBorderWidth }]}>
                <Text style={styles.sectionLabel}>LAST PROMPT COMPOSITION</Text>
                <Text style={styles.mutedText}>
                  Send a chat message first — exact section tokens, trimmed turns, and recall hits will appear here live.
                </Text>
              </View>
            )}

            {/* Stream & Network Telemetry Ring Buffer */}
            <View style={[styles.card, { backgroundColor: cardBg, borderWidth: cardBorderWidth }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.sectionLabel}>NETWORK TELEMETRY ({netLogs.length})</Text>
                {netLogs.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      clearDevTelemetry();
                      setNetLogs([]);
                      setLastPromptSnap(null);
                      flashBanner('Cleared telemetry logs');
                    }}
                  >
                    <Text style={{ color: '#94A3B8', fontSize: 11.5, fontWeight: '700' }}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>

              {netLogs.length > 0 ? (
                <View style={{ gap: 8, marginTop: 2 }}>
                  {netLogs.map(entry => {
                    const expanded = Boolean(expandedNetIds[entry.id]);
                    const accentBar = entry.ok ? '#34d399' : '#f87171';
                    return (
                      <TouchableOpacity
                        key={entry.id}
                        activeOpacity={0.85}
                        onPress={() =>
                          setExpandedNetIds(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))
                        }
                        style={[
                          styles.accentCard,
                          { backgroundColor: surfaceBg, borderLeftColor: accentBar },
                        ]}
                      >
                        <View style={styles.msgMetaRow}>
                          <Text style={{ color: '#F8FAFC', fontSize: 12, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                            {entry.label}{entry.model ? ` · ${entry.model}` : ''}
                          </Text>
                          <Text style={{ color: '#64748B', fontSize: 10.5, fontFamily: monoFont }}>
                            {formatClockTime(entry.timestamp)}
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                          <View style={[styles.metricPill, { backgroundColor: entry.ok ? 'rgba(52,211,153,0.14)' : 'rgba(248,113,113,0.16)' }]}>
                            <Text style={{ color: accentBar, fontSize: 10, fontWeight: '800' }}>
                              {entry.ok ? (entry.status ? `HTTP ${entry.status}` : 'OK') : `ERR${entry.status ? ` ${entry.status}` : ''}`}
                            </Text>
                          </View>
                          {typeof entry.ttfbMs === 'number' && (
                            <View style={styles.metricPill}>
                              <Text style={styles.metricPillText}>TTFB {entry.ttfbMs}ms</Text>
                            </View>
                          )}
                          {typeof entry.ttftMs === 'number' && (
                            <View style={styles.metricPill}>
                              <Text style={styles.metricPillText}>TTFT {entry.ttftMs}ms</Text>
                            </View>
                          )}
                          {typeof entry.totalMs === 'number' && (
                            <View style={styles.metricPill}>
                              <Text style={styles.metricPillText}>{entry.totalMs}ms</Text>
                            </View>
                          )}
                          {(typeof entry.promptTokens === 'number' || typeof entry.outputTokens === 'number') && (
                            <View style={styles.metricPill}>
                              <Text style={styles.metricPillText}>
                                {entry.promptTokens ?? 0}→{entry.outputTokens ?? 0} tok
                              </Text>
                            </View>
                          )}
                          {entry.streamMode && (
                            <View style={styles.metricPill}>
                              <Text style={styles.metricPillText}>{entry.streamMode}</Text>
                            </View>
                          )}
                        </View>

                        {expanded && (
                          <Text style={{ color: '#94A3B8', fontSize: 10.5, fontFamily: monoFont, marginTop: 6 }}>
                            {entry.endpoint}
                          </Text>
                        )}
                        {entry.error && (
                          <Text style={{ color: '#f87171', fontSize: 11, marginTop: 4 }}>
                            {entry.error}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.mutedText}>No LLM streams or probes logged yet.</Text>
              )}
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: MESSAGES (1 -> N)                                           */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === 'messages' && (
          <View style={{ gap: 10 }}>
            {selectedConv ? (
              <>
                <View style={styles.kpiRow}>
                  <View style={[styles.kpiCell, { backgroundColor: cardBg, borderWidth: cardBorderWidth }]}>
                    <Text style={styles.kpiLabel}>Stored</Text>
                    <Text style={[styles.kpiValue, { color: palette.accent }]}>
                      {selectedConv.messages?.length || 0}
                    </Text>
                  </View>
                  <View style={[styles.kpiCell, { backgroundColor: cardBg, borderWidth: cardBorderWidth }]}>
                    <Text style={styles.kpiLabel}>UI Mount</Text>
                    <Text style={styles.kpiValue}>6</Text>
                  </View>
                  <View style={[styles.kpiCell, { backgroundColor: cardBg, borderWidth: cardBorderWidth }]}>
                    <Text style={styles.kpiLabel}>Folded</Text>
                    <Text style={styles.kpiValue}>
                      {Math.max(0, (selectedConv.messages?.length || 0) - 6)}
                    </Text>
                  </View>
                  <View style={[styles.kpiCell, { backgroundColor: cardBg, borderWidth: cardBorderWidth }]}>
                    <Text style={styles.kpiLabel}>Checkpt</Text>
                    <Text style={styles.kpiValue}>
                      {convCheckpointIdx >= 0 ? `#${convCheckpointIdx + 1}` : '—'}
                    </Text>
                  </View>
                </View>

                <View style={styles.searchWrap}>
                  <Search size={14} color="#64748B" />
                  <TextInput
                    value={msgSearchFilter}
                    onChangeText={setMsgSearchFilter}
                    placeholder={`Search all ${selectedConv.messages?.length || 0} stored turns of ${charName}...`}
                    placeholderTextColor="#64748B"
                    style={styles.searchInput}
                  />
                  {msgSearchFilter.length > 0 && (
                    <TouchableOpacity onPress={() => setMsgSearchFilter('')}>
                      <X size={14} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={[styles.segmentedRow, { backgroundColor: cardBg, borderWidth: cardBorderWidth }]}>
                  {[
                    { id: 'top25' as MessageSliceMode, label: 'Top #1–25' },
                    { id: 'checkpoint' as MessageSliceMode, label: 'Checkpt' },
                    { id: 'latest25' as MessageSliceMode, label: 'Latest 25' },
                    { id: 'all' as MessageSliceMode, label: 'All' },
                  ].map(mode => {
                    const active = msgSliceMode === mode.id && !msgSearchFilter.trim();
                    return (
                      <TouchableOpacity
                        key={mode.id}
                        onPress={() => {
                          setMsgSearchFilter('');
                          setMsgSliceMode(mode.id);
                        }}
                        style={[
                          styles.segChip,
                          active && { backgroundColor: `rgba(${palette.accentRgb}, 0.18)` },
                        ]}
                      >
                        <Text style={{ color: active ? palette.accent : '#94A3B8', fontSize: 11, fontWeight: '700' }}>
                          {mode.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ gap: 8 }}>
                  {displayedMessages.map(({ msg, turnIndex }) => {
                    const msgKey = msg.id || `m-${turnIndex}`;
                    const expanded = Boolean(expandedMsgIds[msgKey]);
                    const estTokens = Math.ceil((msg.content?.length || 0) / 4);
                    const isHiddenAtLoad =
                      (selectedConv.messages?.length || 0) > 6 &&
                      turnIndex < (selectedConv.messages?.length || 0) - 6;
                    const barColor = msg.role === 'assistant' ? palette.accent : '#64748B';
                    return (
                      <TouchableOpacity
                        key={msgKey}
                        activeOpacity={0.85}
                        onPress={() =>
                          setExpandedMsgIds(prev => ({ ...prev, [msgKey]: !prev[msgKey] }))
                        }
                        style={[
                          styles.accentCard,
                          { backgroundColor: cardBg, borderLeftColor: barColor },
                        ]}
                      >
                        <View style={styles.msgMetaRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ color: barColor, fontSize: 11, fontWeight: '800', fontFamily: monoFont }}>
                              #{turnIndex + 1} · {msg.role.toUpperCase()}
                            </Text>
                            <View style={styles.metricPill}>
                              <Text style={styles.metricPillText}>
                                {isHiddenAtLoad ? 'Folded' : 'Visible'}
                              </Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ color: '#64748B', fontSize: 10.5, fontFamily: monoFont }}>
                              ~{estTokens} tok
                            </Text>
                            <TouchableOpacity
                              onPress={() => handleCopyText(`Turn #${turnIndex + 1}`, msg.content)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <Copy size={12} color="#94A3B8" />
                            </TouchableOpacity>
                          </View>
                        </View>
                        <Text style={styles.msgBodyPreview} numberOfLines={expanded ? undefined : 4}>
                          {msg.content}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {displayedMessages.length === 0 && (
                    <Text style={styles.mutedText}>No messages match that filter.</Text>
                  )}
                </View>
              </>
            ) : (
              <Text style={styles.mutedText}>No conversations stored yet.</Text>
            )}
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 4: RECALL LAB (Interactive Top-of-Chat Tester + Saved Memory)  */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === 'recall' && (
          <View style={{ gap: 12 }}>
            {selectedConv ? (
              <>
                {/* Guided Recall Lab at the top for immediate testing */}
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: cardBg,
                      borderWidth: 1,
                      borderColor: `rgba(${palette.accentRgb}, 0.32)`,
                    },
                  ]}
                >
                  <Text style={[styles.sectionLabel, { color: palette.accent }]}>
                    TOP-OF-CHAT RECALL LAB (TURN #1 → {selectedConv.messages?.length || 0})
                  </Text>
                  <Text style={styles.helperText}>
                    Simulates excluding recent turns and verifies whether keywords from the very top of this chat are still retrieved.
                  </Text>

                  {(selectedConv.id.startsWith(STRESS_CONV_PREFIX) ||
                    selectedConv.title.startsWith(STRESS_TITLE_PREFIX)) && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                      {STRESS_TEST_PLANTED_FACTS.map(f => (
                        <TouchableOpacity
                          key={f.turnNumber}
                          onPress={() => handleRunRecallTest(f.query)}
                          style={[
                            styles.metricPill,
                            {
                              backgroundColor: `rgba(${palette.accentRgb}, 0.16)`,
                              paddingHorizontal: 9,
                              paddingVertical: 5,
                            },
                          ]}
                        >
                          <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '700' }}>
                            ▶ {f.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <View style={[styles.searchWrap, { marginTop: 4 }]}>
                    <Search size={14} color="#64748B" />
                    <TextInput
                      value={recallQuery}
                      onChangeText={setRecallQuery}
                      placeholder="Keyword from Turn #1 (e.g. sapphire compass)..."
                      placeholderTextColor="#64748B"
                      style={styles.searchInput}
                    />
                    {recallQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setRecallQuery('')}>
                        <X size={14} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={[styles.segmentedRow, { backgroundColor: surfaceBg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }]}>
                    {[
                      { id: '6' as RecallExcludeMode, label: 'Excl 6' },
                      { id: '12' as RecallExcludeMode, label: 'Excl 12' },
                      { id: '20' as RecallExcludeMode, label: 'Excl 20' },
                      { id: 'half' as RecallExcludeMode, label: 'Excl Half' },
                    ].map(opt => {
                      const active = recallExcludeMode === opt.id;
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          onPress={() => setRecallExcludeMode(opt.id)}
                          style={[
                            styles.segChip,
                            active && { backgroundColor: `rgba(${palette.accentRgb}, 0.18)` },
                          ]}
                        >
                          <Text style={{ color: active ? palette.accent : '#94A3B8', fontSize: 11, fontWeight: '700' }}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={handlePullTurnOneKeyword}
                      style={[styles.secondaryBtn, { borderColor: 'rgba(255,255,255,0.16)' }]}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: '#e2e8f0', fontSize: 11.5, fontWeight: '700' }}>
                        Pull Turn #1 Keyword
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleRunRecallTest()}
                      style={[styles.primaryBtn, { backgroundColor: palette.accent }]}
                      disabled={recallRunning || !recallQuery.trim()}
                      activeOpacity={0.85}
                    >
                      {recallRunning ? (
                        <ActivityIndicator size="small" color={palette.bgDark} />
                      ) : (
                        <>
                          <Play size={13} color={palette.bgDark} />
                          <Text style={{ color: palette.bgDark, fontSize: 12, fontWeight: '800' }}>Run Recall</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  {recallHasRun && (
                    <View style={{ marginTop: 6, gap: 8 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingHorizontal: 10,
                          paddingVertical: 7,
                          borderRadius: 9,
                          backgroundColor: recallHits.length > 0 ? 'rgba(52,211,153,0.14)' : 'rgba(248,113,113,0.14)',
                        }}
                      >
                        <Text
                          style={{
                            color: recallHits.length > 0 ? '#34d399' : '#fca5a5',
                            fontSize: 11.5,
                            fontWeight: '800',
                          }}
                        >
                          {recallHits.length > 0 ? `PASS · ${recallHits.length} Hit(s) Found` : 'NO HIT Outside Excluded Window'}
                        </Text>
                        <Text style={{ color: '#cbd5e1', fontSize: 10.5, fontFamily: monoFont }}>
                          {recallEngineUsed}
                        </Text>
                      </View>

                      {recallHits.map(hit => (
                        <View
                          key={`${hit.messageId}-${hit.turnIndex}`}
                          style={[styles.accentCard, { backgroundColor: surfaceBg, borderLeftColor: palette.accent }]}
                        >
                          <View style={styles.msgMetaRow}>
                            <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '800', fontFamily: monoFont }}>
                              Turn #{hit.turnIndex + 1} · {hit.role.toUpperCase()}
                            </Text>
                            <Text style={{ color: '#94A3B8', fontSize: 10.5, fontFamily: monoFont }}>
                              score {hit.score.toFixed(2)}
                            </Text>
                          </View>
                          <Text style={{ color: '#E2E8F0', fontSize: 12, lineHeight: 17, marginTop: 3 }}>
                            {hit.content}
                          </Text>
                        </View>
                      ))}

                      {recallHits.length > 0 && (
                        <>
                          <TouchableOpacity
                            onPress={() => setRecalledPromptExpanded(v => !v)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                          >
                            {recalledPromptExpanded ? (
                              <ChevronDown size={13} color="#94A3B8" />
                            ) : (
                              <ChevronRight size={13} color="#94A3B8" />
                            )}
                            <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700' }}>
                              {recalledPromptExpanded ? 'Hide Prompt Block' : 'Preview Injected Prompt Block'}
                            </Text>
                          </TouchableOpacity>
                          {recalledPromptExpanded && (
                            <Text style={[styles.codePreview, { fontFamily: monoFont }]}>
                              {`[RECALLED EARLIER IN THIS SESSION]\n` +
                                recallHits
                                  .map(h => `- [${h.role === 'assistant' ? charName : 'User'}, Turn ${h.turnIndex + 1}]: ${h.content}`)
                                  .join('\n')}
                            </Text>
                          )}
                        </>
                      )}
                    </View>
                  )}
                </View>

                {/* Collapsible Saved Session Memory & SQLite State */}
                <View style={[styles.card, { backgroundColor: cardBg, borderWidth: cardBorderWidth }]}>
                  <TouchableOpacity
                    onPress={() => setSavedMemoryExpanded(v => !v)}
                    activeOpacity={0.8}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sectionLabel}>PERSISTENT SESSION MEMORY</Text>
                      <Text style={styles.detailLine}>
                        Checkpoint:{' '}
                        <Text style={{ color: palette.accent, fontWeight: '700' }}>
                          {convCheckpointIdx >= 0 ? `Turn #${convCheckpointIdx + 1}/${selectedConv.messages?.length || 0}` : 'None'}
                        </Text>{' '}
                        · ~{Math.ceil(convMemoryText.length / 4)} tok
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      {convMemoryText.trim().length > 0 && (
                        <TouchableOpacity onPress={() => handleCopyText('memory', convMemoryText)}>
                          <Copy size={13} color={palette.accent} />
                        </TouchableOpacity>
                      )}
                      {savedMemoryExpanded ? (
                        <ChevronDown size={16} color="#94A3B8" />
                      ) : (
                        <ChevronRight size={16} color="#94A3B8" />
                      )}
                    </View>
                  </TouchableOpacity>

                  {savedMemoryExpanded && (
                    <Text style={[styles.codePreview, { fontFamily: monoFont }]}>
                      {convMemoryText.trim() || '(No <memory> saved for this session yet.)'}
                    </Text>
                  )}
                </View>

                {sessionMemories.length > 0 && (
                  <View style={[styles.card, { backgroundColor: cardBg, borderWidth: cardBorderWidth }]}>
                    <Text style={styles.sectionLabel}>SQLITE STRUCTURED MEMORIES ({sessionMemories.length})</Text>
                    {sessionMemories.map(sm => (
                      <View key={sm.id} style={[styles.accentCard, { backgroundColor: surfaceBg, borderLeftColor: palette.accent }]}>
                        <Text style={{ color: palette.accent, fontSize: 10.5, fontWeight: '700' }}>
                          {sm.memoryType.toUpperCase()} · {sm.status}{sm.isPinned ? ' · PINNED' : ''}
                        </Text>
                        <Text style={{ color: '#e2e8f0', fontSize: 12, marginTop: 2 }}>{sm.content}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.mutedText}>Select or seed a conversation first.</Text>
            )}
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 5: RAW STORAGE (SEARCHABLE & REDACTED)                         */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === 'storage' && (
          <View style={{ gap: 10 }}>
            <View style={styles.searchWrap}>
              <Search size={14} color="#64748B" />
              <TextInput
                value={storageSearchFilter}
                onChangeText={setStorageSearchFilter}
                placeholder={`Filter ${rawKeys.length} @nekochat:* keys (secrets masked)...`}
                placeholderTextColor="#64748B"
                style={styles.searchInput}
              />
              {storageSearchFilter.length > 0 && (
                <TouchableOpacity onPress={() => setStorageSearchFilter('')}>
                  <X size={14} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            <View style={{ gap: 6 }}>
              {filteredRawKeys.map(item => {
                const active = item.key === selectedStorageKey;
                const widthPct = Math.max(4, Math.round((item.bytes / maxStorageKeyBytes) * 100));
                return (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => setSelectedStorageKey(item.key)}
                    activeOpacity={0.8}
                    style={[
                      styles.keyRow,
                      {
                        backgroundColor: active ? `rgba(${palette.accentRgb}, 0.14)` : cardBg,
                        borderColor: active ? palette.accent : 'rgba(255,255,255,0.08)',
                        borderWidth: active ? 1.25 : cardBorderWidth,
                      },
                    ]}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <Text
                          style={{ color: active ? palette.accent : '#e2e8f0', fontSize: 11.5, fontFamily: monoFont, flex: 1 }}
                          numberOfLines={1}
                        >
                          {item.key}
                        </Text>
                        <Text style={{ color: '#94A3B8', fontSize: 10.5, fontFamily: monoFont }}>
                          {(item.bytes / 1024).toFixed(1)} KB
                        </Text>
                      </View>
                      <View style={styles.secTrack}>
                        <View
                          style={[
                            styles.secFill,
                            { width: `${widthPct}%`, backgroundColor: active ? palette.accent : '#64748B' },
                          ]}
                        />
                      </View>
                    </View>
                    {active && <Check size={13} color={palette.accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedRawEntry && (
              <View style={[styles.card, { backgroundColor: cardBg, borderWidth: cardBorderWidth }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.sectionLabel, { flex: 1 }]} numberOfLines={1}>
                    {selectedRawEntry.key}
                  </Text>
                  <TouchableOpacity onPress={() => handleCopyText('redacted entry', redactedPreview)}>
                    <Copy size={14} color={palette.accent} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.codePreview, { fontFamily: monoFont }]}>{redactedPreview}</Text>
              </View>
            )}
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  engineBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  engineBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  subtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
  },
  iconBtn: {
    padding: 7,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    gap: 3,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 6,
    borderRadius: 9,
  },
  tabDot: {
    position: 'absolute',
    top: -1,
    right: -4,
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    padding: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionLabel: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCell: {
    flex: 1,
    borderRadius: 12,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  kpiLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  kpiValue: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  kpiMini: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  kpiMiniVal: {
    color: '#F8FAFC',
    fontSize: 12.5,
    fontWeight: '800',
    marginTop: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    borderRadius: 14,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    gap: 8,
  },
  cleanList: {
    gap: 6,
  },
  cleanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 2,
  },
  cleanKey: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '500',
  },
  cleanVal: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  hairline: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  latencyPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  stackedTrack: {
    flexDirection: 'row',
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
    gap: 1.5,
  },
  secTrack: {
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  secFill: {
    height: '100%',
    borderRadius: 999,
  },
  accentCard: {
    borderRadius: 10,
    borderLeftWidth: 3,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  metricPill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  metricPillText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '600',
  },
  detailLine: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
  },
  helperText: {
    color: '#94A3B8',
    fontSize: 11.5,
    lineHeight: 16,
  },
  convPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 12.5,
    paddingVertical: 0,
  },
  segmentedRow: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    gap: 3,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  segChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 7,
  },
  msgMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  msgBodyPreview: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  codePreview: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 10,
    padding: 10,
    color: '#E2E8F0',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
  },
  mutedText: {
    color: '#94A3B8',
    fontSize: 12,
  },
});
