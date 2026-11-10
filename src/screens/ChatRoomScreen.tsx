/**
 * Chat Room Screen
 * Supports Novel Mode & Bubble Mode, Persona Pill, Syntax Color Coding,
 * and Context-Aware AI Writing Coach (Refine).
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { ArrowLeft, Send, Plus, BookOpen, MessageCircle, Sparkles, X, Check, RotateCw } from 'lucide-react-native';
import { Character, ChatMessage, Persona, ProviderConfig, ChatStyleMode } from '../types';
import { colors } from '../theme/colors';
import { aiProviderService } from '../services/aiProviderService';
import { storageService } from '../services/storageService';
import { calculateCost, estimateTokens } from '../services/tokenOptimizerService';
import { PersonaPill } from '../components/PersonaPill';

interface ChatRoomScreenProps {
  character: Character;
  persona: Persona;
  personas: Persona[];
  onSelectPersona: (p: Persona) => void;
  config: ProviderConfig;
  onBack: () => void;
}

export const ChatRoomScreen: React.FC<ChatRoomScreenProps> = ({
  character,
  persona,
  personas,
  onSelectPersona,
  config,
  onBack,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatStyle, setChatStyle] = useState<ChatStyleMode>('bubble');
  const [showActionDeck, setShowActionDeck] = useState(false);

  // Refine / AI Writing Coach State
  const [isRefining, setIsRefining] = useState(false);
  const [refinePreview, setRefinePreview] = useState<string | null>(null);

  const scrollViewRef = useRef<any>(null);

  useEffect(() => {
    loadChat();
  }, [character.id]);

  const loadChat = async () => {
    const history = await storageService.getMessages(character.id);
    if (history.length === 0) {
      // Insert first message
      const first: ChatMessage = {
        id: `first-${Date.now()}`,
        characterId: character.id,
        role: 'assistant',
        content: character.firstMessage,
        timestamp: Date.now(),
      };
      await storageService.saveMessages(character.id, [first]);
      setMessages([first]);
    } else {
      setMessages(history);
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    setInputText('');
    setShowActionDeck(false);

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      characterId: character.id,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const updated = [...messages, userMsg];
    setMessages(updated);
    await storageService.appendMessage(character.id, userMsg);

    // Scroll to bottom
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    // AI Stream Response
    setIsStreaming(true);
    let incomingAssistantText = '';

    const assistantPlaceholderId = `bot-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantPlaceholderId,
      characterId: character.id,
      role: 'assistant',
      content: '...',
      timestamp: Date.now(),
    };

    setMessages([...updated, assistantMsg]);

    await aiProviderService.streamChat(
      character,
      updated,
      text,
      persona,
      config,
      {
        onChunk: chunk => {
          incomingAssistantText += chunk;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantPlaceholderId ? { ...m, content: incomingAssistantText } : m
            )
          );
          scrollViewRef.current?.scrollToEnd({ animated: false });
        },
        onError: err => {
          setIsStreaming(false);
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantPlaceholderId
                ? { ...m, content: `⚠️ Error: ${err.message}` }
                : m
            )
          );
        },
        onComplete: async (fullText, tokenCount, thought) => {
          setIsStreaming(false);
          const finalMsg: ChatMessage = {
            id: assistantPlaceholderId,
            characterId: character.id,
            role: 'assistant',
            content: fullText,
            thought,
            tokenCount,
            timestamp: Date.now(),
          };
          await storageService.appendMessage(character.id, finalMsg);
          setMessages(prev =>
            prev.map(m => (m.id === assistantPlaceholderId ? finalMsg : m))
          );
        },
      }
    );
  };

  // AI Writing Coach (Refine)
  const handleRefine = async () => {
    if (!inputText.trim()) return;
    setIsRefining(true);
    setShowActionDeck(false);

    const lastBot = messages.filter(m => m.role === 'assistant').pop()?.content || '';
    const polished = await aiProviderService.refineMessage(
      inputText,
      character,
      lastBot,
      persona,
      config
    );

    setRefinePreview(polished);
    setIsRefining(false);
  };

  const totalTokens = messages.reduce((acc, m) => acc + (m.tokenCount || estimateTokens(m.content)), 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <Image source={{ uri: character.avatar }} style={styles.headerAvatar} />

        <View style={{ flex: 1 }}>
          <Text style={styles.charHeaderName} numberOfLines={1}>
            {character.name}
          </Text>
          <Text style={styles.costBadge}>
            {totalTokens} tokens • {calculateCost(totalTokens, 'IDR')}
          </Text>
        </View>

        {/* Novel vs Bubble Style Switcher */}
        <TouchableOpacity
          style={styles.styleSwitcher}
          onPress={() => setChatStyle(prev => (prev === 'bubble' ? 'novel' : 'bubble'))}
        >
          {chatStyle === 'bubble' ? (
            <MessageCircle size={18} color={colors.lime} />
          ) : (
            <BookOpen size={18} color={colors.lime} />
          )}
        </TouchableOpacity>
      </View>

      {/* Messages Scroll Area */}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map(msg => {
          const isUser = msg.role === 'user';

          if (chatStyle === 'novel') {
            // Novel Mode (Full-bleed literature flow)
            return (
              <View key={msg.id} style={styles.novelRow}>
                <Text style={styles.novelSpeaker}>
                  {isUser ? persona.name : character.name}
                </Text>
                <Text style={isUser ? styles.novelUserText : styles.novelBotText}>
                  {msg.content}
                </Text>
              </View>
            );
          }

          // Bubble Mode (Modern Messenger)
          return (
            <View
              key={msg.id}
              style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowBot]}
            >
              {!isUser && (
                <Image source={{ uri: character.avatar }} style={styles.bubbleAvatar} />
              )}
              <View
                style={[
                  styles.bubbleContainer,
                  isUser ? styles.bubbleUser : styles.bubbleBot,
                ]}
              >
                {msg.thought && (
                  <View style={styles.thoughtBox}>
                    <Text style={styles.thoughtText}>{msg.thought}</Text>
                  </View>
                )}
                <Text style={isUser ? styles.bubbleUserText : styles.bubbleBotText}>
                  {msg.content}
                </Text>
              </View>
            </View>
          );
        })}

        {isStreaming && (
          <View style={{ padding: 12, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.lime} />
          </View>
        )}
      </ScrollView>

      {/* Refine / AI Writing Coach Preview Card */}
      {refinePreview && (
        <View style={styles.refineCard}>
          <View style={styles.refineHeader}>
            <Sparkles size={14} color={colors.lime} style={{ marginRight: 6 }} />
            <Text style={styles.refineTitle}>Polished by AI Coach</Text>
          </View>
          <Text style={styles.refineBody}>"{refinePreview}"</Text>
          <View style={styles.refineActionRow}>
            <TouchableOpacity
              style={styles.refineActionUse}
              onPress={() => {
                setInputText(refinePreview);
                setRefinePreview(null);
              }}
            >
              <Check size={14} color="#000" style={{ marginRight: 4 }} />
              <Text style={styles.refineActionUseText}>Use this</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.refineActionDiscard} onPress={() => setRefinePreview(null)}>
              <X size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.refineActionDiscardText}>Discard</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bottom Composer Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.composerWrapper}>
          {/* Persona Pill Docked Smoothly Above Input Bar */}
          <PersonaPill
            personas={personas}
            activePersona={persona}
            onSelectPersona={onSelectPersona}
          />

          {/* Action Deck Popup (Inside + button) */}
          {showActionDeck && (
            <View style={styles.actionDeck}>
              <TouchableOpacity
                style={styles.actionDeckItem}
                onPress={handleRefine}
                disabled={isRefining}
              >
                <Sparkles size={16} color={colors.lime} style={{ marginRight: 8 }} />
                <Text style={styles.actionDeckText}>
                  {isRefining ? 'Polishing...' : 'Refine / Polish Draft'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionDeckItem}
                onPress={() => {
                  setInputText(prev => (prev.startsWith('[ooc]') ? prev : `[ooc] ${prev}`));
                  setShowActionDeck(false);
                }}
              >
                <Text style={styles.actionDeckOoc}>[ooc]</Text>
                <Text style={styles.actionDeckText}>Ask Out of Character</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Composer Input Bar */}
          <View style={styles.composerBar}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setShowActionDeck(prev => !prev)}
            >
              <Plus size={20} color={colors.lime} />
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              placeholder="Type your message or action..."
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
            />

            <TouchableOpacity
              style={[styles.sendBtn, !inputText.trim() && { opacity: 0.4 }]}
              onPress={handleSend}
              disabled={!inputText.trim() || isStreaming}
            >
              <Send size={18} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.bgSurface,
  },
  iconBtn: {
    padding: 8,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.lime,
  },
  charHeaderName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  costBadge: {
    color: colors.textMuted,
    fontSize: 11,
  },
  styleSwitcher: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  novelRow: {
    marginBottom: 16,
  },
  novelSpeaker: {
    color: colors.lime,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  novelBotText: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 22,
  },
  novelUserText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-end',
  },
  bubbleRowBot: {
    justifyContent: 'flex-start',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 4,
  },
  bubbleContainer: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bubbleBot: {
    backgroundColor: colors.bgSurface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  bubbleUser: {
    backgroundColor: colors.lime,
    borderBottomRightRadius: 4,
  },
  bubbleBotText: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 20,
  },
  bubbleUserText: {
    color: '#000',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  thoughtBox: {
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    padding: 8,
    borderRadius: 10,
    marginBottom: 6,
    borderLeftWidth: 2,
    borderLeftColor: colors.lavender,
  },
  thoughtText: {
    color: colors.lavender,
    fontSize: 11,
    fontStyle: 'italic',
  },
  composerWrapper: {
    backgroundColor: colors.bgSurface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgDark,
    borderRadius: 24,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  actionBtn: {
    padding: 8,
  },
  textInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    maxHeight: 100,
    paddingHorizontal: 8,
  },
  sendBtn: {
    backgroundColor: colors.lime,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionDeck: {
    backgroundColor: colors.bgSurface,
    borderRadius: 16,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  actionDeckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  actionDeckText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  actionDeckOoc: {
    color: colors.coral,
    fontWeight: '800',
    marginRight: 8,
    fontSize: 12,
  },
  refineCard: {
    backgroundColor: 'rgba(14, 15, 18, 0.95)',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.lime,
  },
  refineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  refineTitle: {
    color: colors.lime,
    fontSize: 12,
    fontWeight: '700',
  },
  refineBody: {
    color: colors.textPrimary,
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  refineActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  refineActionUse: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lime,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  refineActionUseText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
  },
  refineActionDiscard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  refineActionDiscardText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
});
