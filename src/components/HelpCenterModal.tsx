import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Image,
  ImageSourcePropType,
} from 'react-native';
import {
  BookOpen,
  Search,
  X,
  ChevronRight,
  ArrowLeft,
  MessageSquare,
  Compass,
  Sliders,
  Sparkles,
  Key,
  Palette,
  HelpCircle,
} from 'lucide-react-native';
import { BottomSheetModal } from './BottomSheetModal';
import { useTheme } from '../theme/ThemeContext';
import { ThemePalette } from '../theme/colors';

export type HelpArticleId =
  | 'my-chats'
  | 'discover'
  | 'chat-room'
  | 'lorebooks'
  | 'ai-byok'
  | 'themes-neko';

interface HelpSection {
  heading: string;
  body: string;
  bullets?: string[];
  tip?: string;
}

interface HelpArticle {
  id: HelpArticleId;
  title: string;
  shortDesc: string;
  badge: string;
  keywords: string[];
  screenshot?: ImageSourcePropType;
  screenshotCaption?: string;
  sections: HelpSection[];
}

const SCREENSHOT_CHATS = require('../../docs/screenshots/chats-split.png');
const SCREENSHOT_CHAT = require('../../docs/screenshots/chat-split.png');
const SCREENSHOT_DISCOVER = require('../../docs/screenshots/discover.png');
const SCREENSHOT_SETTINGS = require('../../docs/screenshots/settings.png');
const SCREENSHOT_SKINS = require('../../docs/screenshots/skins-showcase.png');

const HELP_ARTICLES: HelpArticle[] = [
  {
    id: 'lorebooks',
    title: 'Codex Lorebooks',
    shortDesc: 'Dynamic world-building & character lore injected only when keywords appear.',
    badge: 'Guide',
    keywords: ['lorebook', 'codex', 'script', 'janitor', 'sillytavern', 'trigger', 'keywords', 'world'],
    sections: [
      {
        heading: 'What is a Lorebook?',
        body: 'A Lorebook is a smart encyclopedia for your roleplay. Instead of stuffing 3,000 tokens of world history into every single message, Lorebook entries stay asleep until a trigger keyword (like a city name, magic system, or side character) appears in the conversation.',
        tip: 'Result: Better AI memory, lower token usage, and consistent world rules across long roleplays.',
      },
      {
        heading: 'How to Use a Lorebook on Any Character',
        body: 'You can attach your Codex Lorebooks to any character — including community cards from JanitorAI (Datacat) or Chub.ai:',
        bullets: [
          '1. Open Studio → Codex to create a Lorebook or paste SillyTavern V2 JSON / JanitorAI Scripts.',
          '2. Open any chat, tap ••• (Chat Control & Context) → Settings → Attached Lorebooks.',
          '3. Toggle ON the Lorebooks you want active for that character.',
        ],
      },
      {
        heading: 'Triggers, Constant Entries & Token Budget',
        body: 'Each entry supports primary Keys (comma-separated triggers), optional Secondary Keys (requires both to match), Constant mode (always active regardless of keywords), and Token Budget so lore never overflows your context.',
      },
    ],
  },
  {
    id: 'my-chats',
    title: 'My Chats & Branching',
    shortDesc: 'Grid vs Accordion views, multi-session scenarios, and clean timeline forks.',
    badge: 'Chats',
    keywords: ['chats', 'grid', 'accordion', 'branch', 'fork', 'session', 'scenario', 'trending'],
    screenshot: SCREENSHOT_CHATS,
    screenshotCaption: 'My Chats supports both 2-column Grid cards and expandable Accordion sessions.',
    sections: [
      {
        heading: 'Grid & Accordion Views',
        body: 'Switch between the 2-column Bento Grid and the compact Accordion list using the toggle pill next to My Chats. Tap any character to resume, start a new scenario, or manage saved sessions.',
      },
      {
        heading: 'Isolated Timeline Branching',
        body: 'Want to try a different plot twist without losing your current story? Tap Branch on any message in Chat Room to fork a new session up to that exact turn — with zero future memory leakage.',
      },
    ],
  },
  {
    id: 'discover',
    title: 'Discover & Smart Search',
    shortDesc: 'Browse JanitorAI (Datacat) & Chub.ai in Grid, For You, or Match Mode.',
    badge: 'Discover',
    keywords: ['discover', 'datacat', 'janitor', 'chub', 'search', 'tags', 'for you', 'tiktok', 'match', 'sfw', 'nsfw'],
    screenshot: SCREENSHOT_DISCOVER,
    screenshotCaption: 'Switch between Catalog Grid, For You (TikTok feed), and Match Mode from the top dropdown.',
    sections: [
      {
        heading: '3 Discovery Modes',
        body: 'Tap the top-left mode pill to switch between Catalog Grid (browse & filter), For You (full-screen vertical feed), and Match Mode (swipe deck). Use the source toggle on the right to switch between JanitorAI and Chub.ai.',
      },
      {
        heading: 'Smart #Tag Search',
        body: 'Combine tag chips (like #female) with #tags in the search bar (like #dominance, #ntr, #noncon, #comedy). NekoChat automatically strips literal # symbols and maps aliases like #dominance → #dominant so searches return accurate matches.',
      },
    ],
  },
  {
    id: 'chat-room',
    title: 'Chat Room, Story & Memory',
    shortDesc: 'Novel vs Bubble, Thinking drawer, response length, fonts, wallpapers & memory.',
    badge: 'Roleplay',
    keywords: ['novel', 'bubble', 'thinking', 'memory', 'font', 'wallpaper', 'ooc', 'length', 'shorter', 'standard'],
    screenshot: SCREENSHOT_CHAT,
    screenshotCaption: 'Switch freely between full-width Story/Novel prose and contained Bubble messages.',
    sections: [
      {
        heading: 'Novel vs. Bubble & Custom Fonts',
        body: 'Open ••• → Customize to toggle Novel (borderless story layout) or Bubble mode, pick Default / Serif / Mono / Light message fonts, adjust text size, and customize dialogue/narration colors.',
      },
      {
        heading: 'Thinking Drawer & Response Length',
        body: 'Tap Thinking above an AI reply to inspect the sanitized Nekochat Backend prompt and any AI Model reasoning (<think>) tokens inside a translucent scrollable window. Under Settings, choose Standard (6–9 paragraphs) or Shorter (concise, max 5 paragraphs).',
      },
      {
        heading: 'Long-Term Memory & [OOC]',
        body: 'Use ••• → Memory to auto-summarize older turns so characters remember plot points. Start a message with [OOC: ...] to talk directly to the AI co-writer out of character.',
      },
    ],
  },
  {
    id: 'ai-byok',
    title: 'AI Engines (BYOK) & Vault',
    shortDesc: 'Connect Gemini, OpenRouter, OpenAI, or local LAN models with zero-login privacy.',
    badge: 'BYOK',
    keywords: ['api', 'key', 'byok', 'gemini', 'openrouter', 'openai', 'tokens', 'vault', 'backup', 'passcode'],
    screenshot: SCREENSHOT_SETTINGS,
    screenshotCaption: 'Monitor live engine latency and configure your own API keys on-device.',
    sections: [
      {
        heading: 'Bring Your Own Key (Zero Login)',
        body: 'Your API keys stay strictly on your device (stored in hardware-backed SecureStore on native builds). NekoChat never uploads your keys or chats to any remote account.',
      },
      {
        heading: 'Generation Controls & .neko Vault',
        body: 'Tune Temperature, Top-P, Repetition Penalty (1.12–1.18 helps stop smaller models from repeating lines), and Max Output Tokens (including Unlimited). Export encrypted-clean .neko backups anytime from Data Vault.',
      },
    ],
  },
  {
    id: 'themes-neko',
    title: 'Skins, Palettes & Desk Neko',
    shortDesc: 'Customize UI skins, color palettes, smart wallpapers, and your Desk Neko companion.',
    badge: 'Skins',
    keywords: ['theme', 'skin', 'neko', 'oled', 'classic', 'material', 'hig', 'iphone', 'palette', 'cat', 'game'],
    screenshot: SCREENSHOT_SKINS,
    screenshotCaption: 'Four modular UI skins paired with live color palettes.',
    sections: [
      {
        heading: 'UI Skins & Color Palettes',
        body: 'Open Settings → Theming to switch between Neko OLED, Classic, Material You, and HIG (iPhone) layouts, and pair them with Midnight Cyber, Sakura Dusk, Amethyst, Cyan, or Warm Slate.',
      },
      {
        heading: 'Desk Neko Companion',
        body: 'Your pixel Neko walks, grooms, and naps on top of the chat input bar. You can drag/toss her gently or tap her to play the inline jump mini-game while waiting for replies.',
      },
    ],
  },
];

interface HelpCenterModalProps {
  visible: boolean;
  onClose: () => void;
  initialArticleId?: HelpArticleId | null;
}

const getArticleIcon = (id: HelpArticleId, color: string) => {
  switch (id) {
    case 'lorebooks':
      return <BookOpen size={17} color={color} />;
    case 'my-chats':
      return <MessageSquare size={17} color={color} />;
    case 'discover':
      return <Compass size={17} color={color} />;
    case 'chat-room':
      return <Sliders size={17} color={color} />;
    case 'ai-byok':
      return <Key size={17} color={color} />;
    case 'themes-neko':
      return <Palette size={17} color={color} />;
  }
};

export const HelpCenterModal: React.FC<HelpCenterModalProps> = ({
  visible,
  onClose,
  initialArticleId = null,
}) => {
  const { palette, skin } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeArticleId, setActiveArticleId] = useState<HelpArticleId | null>(initialArticleId);
  const transitionAnim = useRef(new Animated.Value(initialArticleId ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      const targetId = initialArticleId || null;
      setActiveArticleId(targetId);
      setSearchQuery('');
      transitionAnim.setValue(targetId ? 1 : 0);
    }
  }, [visible, initialArticleId, transitionAnim]);

  const openArticle = (id: HelpArticleId) => {
    setActiveArticleId(id);
    transitionAnim.setValue(0);
    Animated.timing(transitionAnim, {
      toValue: 1,
      duration: Math.max(220, skin.animation.enterDuration),
      easing: skin.animation.easing,
      useNativeDriver: true,
    }).start();
  };

  const backToHome = () => {
    Animated.timing(transitionAnim, {
      toValue: 0,
      duration: Math.max(180, Math.round(skin.animation.enterDuration * 0.85)),
      easing: skin.animation.easing,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setActiveArticleId(null);
    });
  };

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return HELP_ARTICLES;
    return HELP_ARTICLES.filter(
      a =>
        a.title.toLowerCase().includes(q) ||
        a.shortDesc.toLowerCase().includes(q) ||
        a.keywords.some(k => k.includes(q)) ||
        a.sections.some(s => s.heading.toLowerCase().includes(q) || s.body.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const activeArticle = useMemo(
    () => HELP_ARTICLES.find(a => a.id === activeArticleId) || null,
    [activeArticleId]
  );

  return (
    <BottomSheetModal visible={visible} onClose={onClose} fullScreen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {activeArticle ? (
              <TouchableOpacity style={styles.backBtn} onPress={backToHome} activeOpacity={0.75}>
                <ArrowLeft size={16} color={palette.accent} />
              </TouchableOpacity>
            ) : (
              <View style={styles.iconBadge}>
                <HelpCircle size={17} color={palette.accent} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {activeArticle ? activeArticle.title : 'NekoChat Help Center'}
              </Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {activeArticle ? `${activeArticle.badge} · Step-by-step guide` : 'Guides, Lorebooks, BYOK & Tips'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.75}>
            <X size={18} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {!activeArticle ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero Search Card */}
            <View style={styles.heroCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Sparkles size={15} color={palette.accent} />
                <Text style={styles.heroTitle}>How can we help?</Text>
              </View>
              <View style={styles.searchBar}>
                <Search size={15} color="#64748b" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search lorebooks, novel mode, tags, API keys..."
                  placeholderTextColor="#64748b"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={14} color="#64748b" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Category Cards */}
            <View style={{ gap: 10 }}>
              {filteredArticles.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No guides matched &ldquo;{searchQuery}&rdquo;.</Text>
                </View>
              ) : (
                filteredArticles.map(article => (
                  <TouchableOpacity
                    key={article.id}
                    style={styles.topicCard}
                    onPress={() => openArticle(article.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.topicIconWrap}>
                      {getArticleIcon(article.id, palette.accent)}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <Text style={styles.topicTitle}>{article.title}</Text>
                        <View style={styles.topicBadge}>
                          <Text style={styles.topicBadgeText}>{article.badge}</Text>
                        </View>
                      </View>
                      <Text style={styles.topicDesc} numberOfLines={2}>
                        {article.shortDesc}
                      </Text>
                    </View>
                    <ChevronRight size={17} color="#64748b" />
                  </TouchableOpacity>
                ))
              )}
            </View>
          </ScrollView>
        ) : (
          <Animated.View
            style={{
              flex: 1,
              opacity: transitionAnim,
              transform: [
                {
                  translateX: transitionAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [26, 0],
                  }),
                },
              ],
            }}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {activeArticle.screenshot && (
                <View style={styles.screenshotCard}>
                  <Image
                    source={activeArticle.screenshot}
                    style={styles.screenshotImg}
                    resizeMode="cover"
                  />
                  {activeArticle.screenshotCaption && (
                    <Text style={styles.screenshotCaption}>{activeArticle.screenshotCaption}</Text>
                  )}
                </View>
              )}

              {activeArticle.sections.map((sec, idx) => (
                <View key={idx} style={styles.sectionCard}>
                  <Text style={styles.sectionHeading}>{sec.heading}</Text>
                  <Text style={styles.sectionBody}>{sec.body}</Text>
                  {sec.bullets && sec.bullets.length > 0 && (
                    <View style={styles.bulletList}>
                      {sec.bullets.map((b, bIdx) => (
                        <Text key={bIdx} style={styles.bulletText}>
                          {b}
                        </Text>
                      ))}
                    </View>
                  )}
                  {sec.tip && (
                    <View style={styles.tipBox}>
                      <Text style={styles.tipText}>{sec.tip}</Text>
                    </View>
                  )}
                </View>
              ))}

              <TouchableOpacity style={styles.backAllBtn} onPress={backToHome} activeOpacity={0.8}>
                <ArrowLeft size={14} color={palette.accent} />
                <Text style={styles.backAllText}>All Help Guides</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        )}
      </View>
    </BottomSheetModal>
  );
};

const createStyles = (palette: ThemePalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 6,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    headerLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingRight: 10,
    },
    iconBadge: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: `rgba(${palette.accentRgb}, 0.14)`,
      borderWidth: 1,
      borderColor: `rgba(${palette.accentRgb}, 0.3)`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: `rgba(${palette.accentRgb}, 0.14)`,
      borderWidth: 1,
      borderColor: `rgba(${palette.accentRgb}, 0.35)`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      color: '#f8fafc',
      fontSize: 16,
      fontWeight: '800',
    },
    headerSub: {
      color: '#94a3b8',
      fontSize: 11.5,
      marginTop: 1,
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.05)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      paddingVertical: 14,
      paddingBottom: 32,
      gap: 12,
    },
    heroCard: {
      backgroundColor: palette.bgSurface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: `rgba(${palette.accentRgb}, 0.22)`,
    },
    heroTitle: {
      color: '#f8fafc',
      fontSize: 15,
      fontWeight: '700',
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(0,0,0,0.32)',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    searchInput: {
      flex: 1,
      color: '#f8fafc',
      fontSize: 13.5,
      paddingVertical: 2,
    },
    topicCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: palette.bgSurface,
      borderRadius: 14,
      padding: 13,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.07)',
    },
    topicIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 11,
      backgroundColor: `rgba(${palette.accentRgb}, 0.12)`,
      borderWidth: 1,
      borderColor: `rgba(${palette.accentRgb}, 0.25)`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topicTitle: {
      color: '#f8fafc',
      fontSize: 14,
      fontWeight: '700',
    },
    topicBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: `rgba(${palette.accentRgb}, 0.14)`,
    },
    topicBadgeText: {
      color: palette.accent,
      fontSize: 10,
      fontWeight: '700',
    },
    topicDesc: {
      color: '#94a3b8',
      fontSize: 12,
      lineHeight: 17,
    },
    emptyCard: {
      padding: 24,
      alignItems: 'center',
      backgroundColor: palette.bgSurface,
      borderRadius: 14,
    },
    emptyText: {
      color: '#94a3b8',
      fontSize: 13,
    },
    screenshotCard: {
      backgroundColor: palette.bgSurface,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    screenshotImg: {
      width: '100%',
      height: 170,
      backgroundColor: '#080a10',
    },
    screenshotCaption: {
      color: '#94a3b8',
      fontSize: 11.5,
      padding: 10,
    },
    sectionCard: {
      backgroundColor: palette.bgSurface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.07)',
      gap: 8,
    },
    sectionHeading: {
      color: palette.accent,
      fontSize: 14,
      fontWeight: '800',
    },
    sectionBody: {
      color: '#cbd5e1',
      fontSize: 13,
      lineHeight: 19,
    },
    bulletList: {
      gap: 6,
      marginTop: 2,
    },
    bulletText: {
      color: '#e2e8f0',
      fontSize: 12.5,
      lineHeight: 18,
    },
    tipBox: {
      marginTop: 4,
      padding: 10,
      borderRadius: 10,
      backgroundColor: `rgba(${palette.accentRgb}, 0.1)`,
      borderLeftWidth: 3,
      borderLeftColor: palette.accent,
    },
    tipText: {
      color: '#e2e8f0',
      fontSize: 12,
      lineHeight: 17,
    },
    backAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 11,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: `rgba(${palette.accentRgb}, 0.3)`,
      backgroundColor: `rgba(${palette.accentRgb}, 0.08)`,
    },
    backAllText: {
      color: palette.accent,
      fontSize: 13,
      fontWeight: '700',
    },
  });
