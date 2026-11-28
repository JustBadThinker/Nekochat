/**
 * DeveloperInspectorModal.tsx
 * Live on-device diagnostic sheet available when Developer Mode is enabled.
 * Inspects:
 * 1. DB & Health (SQLite WAL/FTS5 vs Web AsyncStorage, counts, active context budget)
 * 2. Messages (1 -> N) full persisted conversation inspector (verifies Turn #1..100+ exist beyond the 6-msg UI slice)
 * 3. Memory & Recall Lab (persisted <memory>, checkpoints, SQLite session_memories, & interactive Turn #1 recall test)
 * 4. Raw Storage (@nekochat:* AsyncStorage explorer with automatic secret redaction)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
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
  Brain,
  Check,
  Copy,
  Database,
  Layers,
  Play,
  RefreshCw,
  Search,
  Terminal,
  X,
} from 'lucide-react-native';
import { BottomSheetModal, BottomSheetScrollView } from './BottomSheetModal';
import { useTheme } from '../theme/ThemeContext';
import { storageService } from '../services/storageService';
import { getSqliteConversationRepository, SessionMemoryRecord } from '../services/sqliteDatabase';
import { resolveContextBudget } from '../services/promptBudget';
import {
  extractDistinctiveQueryFromMessage,
  RECENT_RAW_OVERLAP_TURNS,
  RecalledOlderMessage,
  redactSensitiveStorageValue,
  searchOlderMessagesInMemory,
} from '../services/memoryRecall';
import { getSubtleSurfaceBg, getSurfaceBg } from '../theme/skins';
import type { Character, Conversation, ProviderConfig } from '../types';

export interface DeveloperInspectorModalProps {
  visible: boolean;
  onClose: () => void;
  initialConversationId?: string | null;
  config?: ProviderConfig;
}

type InspectorTab = 'db' | 'messages' | 'memory' | 'storage';
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

function getConversationMemoryStorageKey(convId: string) {
  return `@nekochat:chat_memory_${convId}`;
}

function getConversationCheckpointStorageKey(convId: string) {
  return `@nekochat:chat_checkpoint_idx_${convId}`;
}

export const DeveloperInspectorModal: React.FC<DeveloperInspectorModalProps> = ({
  visible,
  onClose,
  initialConversationId,
  config,
}) => {
  const { palette, skin } = useTheme();
  const surfaceBg = getSurfaceBg(palette, skin);
  const subtleBg = getSubtleSurfaceBg(palette, skin);

  const [tab, setTab] = useState<InspectorTab>('db');
  const [loading, setLoading] = useState(false);

  const [sqliteDiag, setSqliteDiag] = useState<SqliteDiagnostics | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [charactersById, setCharactersById] = useState<Record<string, Character>>({});
  const [rawKeys, setRawKeys] = useState<RawKeySummary[]>([]);
  const [activeProviderCfg, setActiveProviderCfg] = useState<ProviderConfig | undefined>(config);

  const [selectedConvId, setSelectedConvId] = useState<string | null>(initialConversationId || null);

  // Messages tab controls
  const [msgSliceMode, setMsgSliceMode] = useState<MessageSliceMode>('top25');
  const [msgSearchFilter, setMsgSearchFilter] = useState('');

  // Memory & Recall tab state
  const [convMemoryText, setConvMemoryText] = useState('');
  const [convCheckpointIdx, setConvCheckpointIdx] = useState<number>(-1);
  const [sessionMemories, setSessionMemories] = useState<SessionMemoryRecord[]>([]);
  const [recallQuery, setRecallQuery] = useState('');
  const [recallExcludeMode, setRecallExcludeMode] = useState<RecallExcludeMode>('6');
  const [recallRunning, setRecallRunning] = useState(false);
  const [recallHits, setRecallHits] = useState<RecalledOlderMessage[]>([]);
  const [recallEngineUsed, setRecallEngineUsed] = useState<string>('');
  const [recallHasRun, setRecallHasRun] = useState(false);

  // Raw Storage tab state
  const [selectedStorageKey, setSelectedStorageKey] = useState<string | null>(null);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

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
        if (!selectedStorageKey && summaries.length > 0) {
          setSelectedStorageKey(summaries[0].key);
        }
      } else {
        setRawKeys([]);
      }

      const preferredId =
        initialConversationId && sortedConvs.some(c => c.id === initialConversationId)
          ? initialConversationId
          : selectedConvId && sortedConvs.some(c => c.id === selectedConvId)
            ? selectedConvId
            : sortedConvs[0]?.id || null;
      setSelectedConvId(preferredId);
    } finally {
      setLoading(false);
    }
  }, [config, initialConversationId, selectedConvId, selectedStorageKey]);

  useEffect(() => {
    if (visible) {
      loadSnapshot();
    }
  }, [visible, loadSnapshot]);

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
      if (firstMsg && !recallQuery.trim()) {
        const autoKw = extractDistinctiveQueryFromMessage(firstMsg.content);
        if (autoKw) setRecallQuery(autoKw);
      }
    };

    loadConvMemory();
    return () => {
      active = false;
    };
  }, [selectedConv, recallQuery]);

  const totalMessagesAcrossChats = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.messages?.length || 0), 0),
    [conversations]
  );

  const totalStorageBytes = useMemo(
    () => rawKeys.reduce((sum, k) => sum + k.bytes, 0),
    [rawKeys]
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
      setCopiedNotice(`Copied ${label}`);
      setTimeout(() => setCopiedNotice(null), 2000);
    } catch {
      Share.share({ message: text }).catch(() => {});
    }
  };

  const handlePullTurnOneKeyword = () => {
    const firstEligible = (selectedConv?.messages || []).find(
      m => (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim().length > 0
    );
    if (!firstEligible) return;
    const kw = extractDistinctiveQueryFromMessage(firstEligible.content);
    if (kw) setRecallQuery(kw);
  };

  const handleRunRecallTest = async () => {
    if (!selectedConv || !recallQuery.trim() || recallRunning) return;
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
          query: recallQuery.trim(),
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
        query: recallQuery.trim(),
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

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetStyle={[
        styles.sheet,
        {
          backgroundColor: getSurfaceBg(palette, skin),
          borderTopLeftRadius: Math.max(20, skin.cardRadius),
          borderTopRightRadius: Math.max(20, skin.cardRadius),
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={styles.titleRow}>
            <Terminal size={16} color={palette.accent} style={{ marginRight: 7 }} />
            <Text style={styles.title}>Developer Inspector</Text>
            <View style={[styles.engineBadge, { backgroundColor: `rgba(${palette.accentRgb}, 0.16)` }]}>
              <Text style={[styles.engineBadgeText, { color: palette.accent }]}>
                {sqliteDiag ? (sqliteDiag.fts5Supported ? 'SQLITE + FTS5' : 'SQLITE') : 'WEB + BM25'}
              </Text>
            </View>
          </View>
          <Text style={styles.subtitle} numberOfLines={1}>
            {copiedNotice || `${conversations.length} chats · ${totalMessagesAcrossChats} msgs · ${(totalStorageBytes / 1024).toFixed(1)} KB storage`}
          </Text>
        </View>
        <TouchableOpacity onPress={loadSnapshot} style={styles.iconBtn} activeOpacity={0.75}>
          <RefreshCw size={15} color="#cbd5e1" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={styles.iconBtn} activeOpacity={0.75}>
          <X size={17} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* 4-Tab Bar */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: subtleBg,
            borderWidth: skin.id === 'material' ? 0 : 1,
          },
        ]}
      >
        {[
          { id: 'db' as InspectorTab, label: 'DB', Icon: Database },
          { id: 'messages' as InspectorTab, label: 'Msgs 1→N', Icon: Layers },
          { id: 'memory' as InspectorTab, label: 'Recall', Icon: Brain },
          { id: 'storage' as InspectorTab, label: 'Raw Keys', Icon: Terminal },
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
                  borderWidth: skin.id === 'material' ? 0 : 1,
                  borderColor: `rgba(${palette.accentRgb}, 0.42)`,
                },
              ]}
            >
              <IconComp size={13} color={active ? palette.accent : '#94a3b8'} />
              <Text style={[styles.tabText, active && { color: palette.accent, fontWeight: '700' }]}>
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
            <Text style={styles.mutedText}>Reading local database & AsyncStorage...</Text>
          </View>
        )}

        {/* Conversation Selector for Messages & Memory tabs */}
        {(tab === 'messages' || tab === 'memory') && conversations.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.sectionLabel}>INSPECT CONVERSATION</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {conversations.slice(0, 12).map(conv => {
                const active = conv.id === selectedConvId;
                const cName = charactersById[conv.characterId]?.name || conv.title || 'Chat';
                const count = conv.messages?.length || 0;
                return (
                  <TouchableOpacity
                    key={conv.id}
                    onPress={() => setSelectedConvId(conv.id)}
                    activeOpacity={0.8}
                    style={[
                      styles.convPill,
                      {
                        backgroundColor: active ? `rgba(${palette.accentRgb}, 0.16)` : subtleBg,
                        borderColor: active ? palette.accent : 'rgba(255,255,255,0.1)',
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
                      {cName} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* TAB 1: DB & HEALTH */}
        {tab === 'db' && (
          <View style={{ gap: 10 }}>
            <View style={[styles.card, { backgroundColor: subtleBg }]}>
              <Text style={styles.sectionLabel}>STORAGE ENGINE</Text>
              <View style={styles.kvGrid}>
                <View style={styles.kvBox}>
                  <Text style={styles.kvLabel}>Platform</Text>
                  <Text style={styles.kvValue}>{Platform.OS.toUpperCase()}</Text>
                </View>
                <View style={styles.kvBox}>
                  <Text style={styles.kvLabel}>Primary DB</Text>
                  <Text style={[styles.kvValue, { color: palette.accent }]}>
                    {sqliteDiag ? `${sqliteDiag.dbName} (v${sqliteDiag.schemaVersion})` : 'AsyncStorage (Web)'}
                  </Text>
                </View>
                <View style={styles.kvBox}>
                  <Text style={styles.kvLabel}>Conversations</Text>
                  <Text style={styles.kvValue}>
                    {sqliteDiag ? sqliteDiag.conversationCount : conversations.length}
                  </Text>
                </View>
                <View style={styles.kvBox}>
                  <Text style={styles.kvLabel}>Persisted Messages</Text>
                  <Text style={styles.kvValue}>
                    {sqliteDiag ? sqliteDiag.messageCount : totalMessagesAcrossChats}
                  </Text>
                </View>
                <View style={styles.kvBox}>
                  <Text style={styles.kvLabel}>Recall Engine</Text>
                  <Text style={styles.kvValue}>
                    {sqliteDiag?.fts5Supported ? `FTS5 (${sqliteDiag.ftsRowCount} idx)` : 'In-Memory BM25'}
                  </Text>
                </View>
                <View style={styles.kvBox}>
                  <Text style={styles.kvLabel}>SQLite Memories</Text>
                  <Text style={styles.kvValue}>{sqliteDiag ? sqliteDiag.sessionMemoryCount : 0}</Text>
                </View>
                <View style={styles.kvBox}>
                  <Text style={styles.kvLabel}>Cast Members</Text>
                  <Text style={styles.kvValue}>{sqliteDiag ? sqliteDiag.castMemberCount : 'N/A (Web)'}</Text>
                </View>
                <View style={styles.kvBox}>
                  <Text style={styles.kvLabel}>AsyncStorage Keys</Text>
                  <Text style={styles.kvValue}>
                    {rawKeys.length} ({(totalStorageBytes / 1024).toFixed(1)} KB)
                  </Text>
                </View>
              </View>
            </View>

            {resolvedBudget && (
              <View style={[styles.card, { backgroundColor: subtleBg }]}>
                <Text style={styles.sectionLabel}>ACTIVE MODEL CONTEXT & CONTINUITY</Text>
                <Text style={styles.detailLine}>
                  Model: <Text style={{ color: '#fff', fontWeight: '700' }}>{resolvedBudget.rawModel || 'default'}</Text>
                </Text>
                <Text style={styles.detailLine}>
                  Endpoint: <Text style={{ color: '#cbd5e1', fontFamily: monoFont, fontSize: 11 }}>{resolvedBudget.endpointIdentity}</Text>
                </Text>
                <Text style={styles.detailLine}>
                  Context Limit: <Text style={{ color: palette.accent, fontWeight: '700' }}>{resolvedBudget.contextLimit}</Text> ({resolvedBudget.contextSource}) · Max Output: {resolvedBudget.maxOutputTokens || 'Unlimited'}
                </Text>
                <Text style={styles.detailLine}>
                  Raw Continuity Buffer: <Text style={{ color: '#fff', fontWeight: '700' }}>Last {RECENT_RAW_OVERLAP_TURNS} turns</Text> kept even with &quot;Memory replaces old messages&quot; ON.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* TAB 2: MESSAGES (1 -> N) */}
        {tab === 'messages' && (
          <View style={{ gap: 10 }}>
            {selectedConv ? (
              <>
                <View style={[styles.card, { backgroundColor: subtleBg }]}>
                  <Text style={styles.sectionLabel}>STORED VS. UI WINDOW ({charName.toUpperCase()})</Text>
                  <View style={styles.kvGrid}>
                    <View style={styles.kvBox}>
                      <Text style={styles.kvLabel}>Total Stored</Text>
                      <Text style={[styles.kvValue, { color: palette.accent }]}>
                        {selectedConv.messages?.length || 0} msgs
                      </Text>
                    </View>
                    <View style={styles.kvBox}>
                      <Text style={styles.kvLabel}>Initial UI Render</Text>
                      <Text style={styles.kvValue}>6 msgs (UI-only)</Text>
                    </View>
                    <View style={styles.kvBox}>
                      <Text style={styles.kvLabel}>Hidden Above</Text>
                      <Text style={styles.kvValue}>
                        {Math.max(0, (selectedConv.messages?.length || 0) - 6)} msgs
                      </Text>
                    </View>
                    <View style={styles.kvBox}>
                      <Text style={styles.kvLabel}>Checkpoint Index</Text>
                      <Text style={styles.kvValue}>
                        {convCheckpointIdx >= 0 ? `Turn #${convCheckpointIdx + 1}` : 'None'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.searchWrap}>
                  <Search size={14} color="#64748b" />
                  <TextInput
                    value={msgSearchFilter}
                    onChangeText={setMsgSearchFilter}
                    placeholder="Search across ALL stored messages (#1 to end)..."
                    placeholderTextColor="#64748b"
                    style={styles.searchInput}
                  />
                  {msgSearchFilter.length > 0 && (
                    <TouchableOpacity onPress={() => setMsgSearchFilter('')}>
                      <X size={14} color="#94a3b8" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    { id: 'top25' as MessageSliceMode, label: 'Top #1–25' },
                    { id: 'checkpoint' as MessageSliceMode, label: 'Checkpoint' },
                    { id: 'latest25' as MessageSliceMode, label: 'Latest 25' },
                    { id: 'all' as MessageSliceMode, label: 'All (up to 200)' },
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
                          styles.sliceChip,
                          {
                            backgroundColor: active ? `rgba(${palette.accentRgb}, 0.18)` : subtleBg,
                            borderColor: active ? palette.accent : 'rgba(255,255,255,0.1)',
                          },
                        ]}
                      >
                        <Text style={{ color: active ? palette.accent : '#cbd5e1', fontSize: 11, fontWeight: '700' }}>
                          {mode.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ gap: 8 }}>
                  {displayedMessages.map(({ msg, turnIndex }) => {
                    const estTokens = Math.ceil((msg.content?.length || 0) / 4);
                    const isHiddenAtLoad =
                      (selectedConv.messages?.length || 0) > 6 &&
                      turnIndex < (selectedConv.messages?.length || 0) - 6;
                    return (
                      <View
                        key={msg.id || `m-${turnIndex}`}
                        style={[styles.msgRow, { backgroundColor: surfaceBg, borderColor: 'rgba(255,255,255,0.08)' }]}
                      >
                        <View style={styles.msgMetaRow}>
                          <Text style={[styles.msgTurnTag, { color: palette.accent, fontFamily: monoFont }]}>
                            #{turnIndex + 1} · {msg.role.toUpperCase()}
                          </Text>
                          <Text style={styles.msgStatsText}>
                            ~{estTokens} tok{isHiddenAtLoad ? ' · folded above' : ' · visible initially'}
                          </Text>
                        </View>
                        <Text style={styles.msgBodyPreview} numberOfLines={5}>
                          {msg.content}
                        </Text>
                      </View>
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

        {/* TAB 3: MEMORY & RECALL LAB */}
        {tab === 'memory' && (
          <View style={{ gap: 12 }}>
            {selectedConv ? (
              <>
                <View style={[styles.card, { backgroundColor: subtleBg }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.sectionLabel}>PERSISTENT SESSION MEMORY</Text>
                    <TouchableOpacity
                      onPress={() => handleCopyText('memory', convMemoryText)}
                      disabled={!convMemoryText.trim()}
                    >
                      <Copy size={13} color={convMemoryText.trim() ? palette.accent : '#475569'} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.detailLine}>
                    Checkpoint Index:{' '}
                    <Text style={{ color: palette.accent, fontWeight: '700' }}>
                      {convCheckpointIdx >= 0 ? `Turn #${convCheckpointIdx + 1} of ${selectedConv.messages?.length || 0}` : 'Not created yet'}
                    </Text>{' '}
                    · ~{Math.ceil(convMemoryText.length / 4)} tokens
                  </Text>
                  <Text style={[styles.codePreview, { fontFamily: monoFont }]}>
                    {convMemoryText.trim() || '(No <memory> saved for this session yet.)'}
                  </Text>
                </View>

                {sessionMemories.length > 0 && (
                  <View style={[styles.card, { backgroundColor: subtleBg }]}>
                    <Text style={styles.sectionLabel}>SQLITE STRUCTURED MEMORIES ({sessionMemories.length})</Text>
                    {sessionMemories.map(sm => (
                      <View key={sm.id} style={styles.structuredRow}>
                        <Text style={{ color: palette.accent, fontSize: 10.5, fontWeight: '700' }}>
                          {sm.memoryType.toUpperCase()} · {sm.status}{sm.isPinned ? ' · PINNED' : ''}
                        </Text>
                        <Text style={{ color: '#e2e8f0', fontSize: 12, marginTop: 2 }}>{sm.content}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Interactive Top-of-Chat Recall Lab */}
                <View style={[styles.card, { backgroundColor: subtleBg, borderColor: `rgba(${palette.accentRgb}, 0.3)` }]}>
                  <Text style={[styles.sectionLabel, { color: palette.accent }]}>
                    TOP-OF-CHAT RECALL LAB (TURN #1 → 100+)
                  </Text>
                  <Text style={styles.helperText}>
                    Tests whether keywords from Turn #1 at the very top of this chat can still be recalled when the recent prompt window is excluded.
                  </Text>

                  <View style={[styles.searchWrap, { marginTop: 8 }]}>
                    <Search size={14} color="#64748b" />
                    <TextInput
                      value={recallQuery}
                      onChangeText={setRecallQuery}
                      placeholder="Keyword from Turn #1 (e.g. name, oath, item)..."
                      placeholderTextColor="#64748b"
                      style={styles.searchInput}
                    />
                  </View>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {[
                      { id: '6' as RecallExcludeMode, label: 'Exclude last 6' },
                      { id: '12' as RecallExcludeMode, label: 'Exclude last 12' },
                      { id: '20' as RecallExcludeMode, label: 'Exclude last 20' },
                      { id: 'half' as RecallExcludeMode, label: 'Exclude half' },
                    ].map(opt => {
                      const active = recallExcludeMode === opt.id;
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          onPress={() => setRecallExcludeMode(opt.id)}
                          style={[
                            styles.sliceChip,
                            {
                              backgroundColor: active ? `rgba(${palette.accentRgb}, 0.18)` : surfaceBg,
                              borderColor: active ? palette.accent : 'rgba(255,255,255,0.1)',
                            },
                          ]}
                        >
                          <Text style={{ color: active ? palette.accent : '#cbd5e1', fontSize: 11, fontWeight: '700' }}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity
                      onPress={handlePullTurnOneKeyword}
                      style={[styles.secondaryBtn, { borderColor: 'rgba(255,255,255,0.16)' }]}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: '#e2e8f0', fontSize: 11.5, fontWeight: '700' }}>
                        Pull Keyword from Turn #1
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleRunRecallTest}
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
                    <View style={{ marginTop: 12, gap: 6 }}>
                      <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700' }}>
                        Engine: {recallEngineUsed} · Hits: {recallHits.length}
                      </Text>
                      {recallHits.length > 0 ? (
                        <>
                          {recallHits.map(hit => (
                            <View key={`${hit.messageId}-${hit.turnIndex}`} style={styles.hitBox}>
                              <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '800', fontFamily: monoFont }}>
                                Turn #{hit.turnIndex + 1} · {hit.role.toUpperCase()} · score {hit.score.toFixed(2)}
                              </Text>
                              <Text style={{ color: '#e2e8f0', fontSize: 12, marginTop: 3 }}>{hit.content}</Text>
                            </View>
                          ))}
                          <Text style={[styles.codePreview, { fontFamily: monoFont }]}>
                            {`[RECALLED EARLIER IN THIS SESSION]\n` +
                              recallHits
                                .map(h => `- [${h.role === 'assistant' ? charName : 'User'}, Turn ${h.turnIndex + 1}]: ${h.content}`)
                                .join('\n')}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.mutedText}>
                          No older turns outside the excluded tail matched &quot;{recallQuery}&quot;. Try &quot;Pull Keyword from Turn #1&quot; or a larger chat.
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </>
            ) : (
              <Text style={styles.mutedText}>Select or start a conversation first.</Text>
            )}
          </View>
        )}

        {/* TAB 4: RAW STORAGE (REDACTED) */}
        {tab === 'storage' && (
          <View style={{ gap: 10 }}>
            <Text style={styles.helperText}>
              Keys stored in AsyncStorage (API keys, PINs, tokens & hashes are automatically masked).
            </Text>
            <View style={{ gap: 6 }}>
              {rawKeys.map(item => {
                const active = item.key === selectedStorageKey;
                return (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => setSelectedStorageKey(item.key)}
                    activeOpacity={0.8}
                    style={[
                      styles.keyRow,
                      {
                        backgroundColor: active ? `rgba(${palette.accentRgb}, 0.14)` : subtleBg,
                        borderColor: active ? palette.accent : 'rgba(255,255,255,0.08)',
                      },
                    ]}
                  >
                    <Text
                      style={{ color: active ? palette.accent : '#e2e8f0', fontSize: 11.5, fontFamily: monoFont, flex: 1 }}
                      numberOfLines={1}
                    >
                      {item.key}
                    </Text>
                    <Text style={{ color: '#94a3b8', fontSize: 11, fontFamily: monoFont }}>
                      {(item.bytes / 1024).toFixed(1)} KB
                    </Text>
                    {active && <Check size={13} color={palette.accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedRawEntry && (
              <View style={[styles.card, { backgroundColor: subtleBg }]}>
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
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
    letterSpacing: 0.6,
  },
  subtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    gap: 4,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: 9,
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 11.5,
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
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    gap: 6,
  },
  kvGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  kvBox: {
    width: '48%',
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  kvLabel: {
    color: '#94A3B8',
    fontSize: 10,
  },
  kvValue: {
    color: '#F8FAFC',
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 2,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
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
  sliceChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  msgRow: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  msgMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  msgTurnTag: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  msgStatsText: {
    color: '#64748B',
    fontSize: 10.5,
  },
  msgBodyPreview: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 17,
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
  structuredRow: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 9,
    padding: 8,
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
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  hitBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderRadius: 10,
    padding: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  mutedText: {
    color: '#94A3B8',
    fontSize: 12,
  },
});
