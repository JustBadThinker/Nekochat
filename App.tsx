/**
 * NekoChat — Free & Open-Source AI Roleplay Client
 * Bento-OLED High-Contrast Design System with Minimalist Floating Navigation Dock.
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, ScrollView, Dimensions, Animated, BackHandler } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { Character, Persona, ProviderConfig, AppSettings } from './src/types';
import { colors, applyThemePalette, getThemePalette } from './src/theme/colors';
import { ThemeProvider } from './src/theme/ThemeContext';
import { LanguageProvider } from './src/i18n/LanguageContext';
import { storageService } from './src/services/storageService';
import { characterService } from './src/services/characterService';
import { communityCatalogService } from './src/services/communityCatalogService';
import { CapsuleDock, TabScreen } from './src/components/CapsuleDock';
import { SplashScreen } from './src/components/SplashScreen';
import { OnboardingFlow } from './src/components/OnboardingFlow';
import { PasscodeGate } from './src/components/PasscodeGate';
import { ChatsScreen } from './src/screens/ChatsScreen';
import { DiscoverScreen } from './src/screens/DiscoverScreen';
import { ChatRoomScreen } from './src/screens/ChatRoomScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { UserStudioScreen } from './src/screens/UserStudioScreen';

const TABS: TabScreen[] = ['chats', 'discover', 'studio', 'settings'];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabScreen>('chats');
  const [isDiscoverMatchMode, setIsDiscoverMatchMode] = useState(false);
  const [isDockVisible, setIsDockVisible] = useState(true);
  const [pagerWidth, setPagerWidth] = useState<number>(() => {
    const w = Dimensions.get('window').width;
    return Platform.OS === 'web' ? Math.min(w, 1080) : w;
  });
  const pagerRef = useRef<any>(null);
  const dockBlurTargetRef = useRef<React.ComponentRef<typeof View> | null>(null);
  const scrollSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatRoomEnterAnim = useRef(new Animated.Value(0)).current;
  const tabHistoryRef = useRef<TabScreen[]>(['chats']);

  const [characters, setCharacters] = useState<Character[]>([]);
  const [trendingCharacters, setTrendingCharacters] = useState<Character[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [config, setConfig] = useState<ProviderConfig | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeChatCharacter, setActiveChatCharacter] = useState<Character | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Inject smooth high-refresh web animations and interactive physics
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'nekochat-global-animations';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          @keyframes cardEnter {
            from {
              opacity: 0;
              transform: translateY(10px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes pulseDot {
            0%, 100% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.25); opacity: 1; }
          }
          body, #root {
            background-color: #050608 !important;
            user-select: none;
            -webkit-user-select: none;
            -webkit-tap-highlight-color: transparent;
          }
          input, textarea {
            user-select: text !important;
            -webkit-user-select: text !important;
          }
          /* Interactive tap physics & card spring transitions */
          [role="button"], button {
            cursor: pointer !important;
            transition: transform 0.16s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.16s ease !important;
          }
          [role="button"]:active, button:active {
            transform: scale(0.97) !important;
          }
        `;
        document.head.appendChild(style);
      }
    }
    initApp();
  }, []);

  const initApp = async () => {
    try {
      // 1. Load active chat characters (clean initial state, purged of any mock data)
      const chars = await characterService.ensureStarters();
      setCharacters(chars);

      // 2. Load trending 24h characters (fetched live from community catalog)
      const trending = await characterService.getTrending24h();
      setTrendingCharacters(trending);

      // 3. Load personas
      const persList = await storageService.getPersonas();
      setPersonas(persList);
      const defaultPers = persList.find(p => p.isDefault) || persList[0];
      setActivePersona(defaultPers);

      // 4. Load configs
      const provCfg = await storageService.getProviderConfig();
      setConfig(provCfg);

      const appSet = await storageService.getSettings();
      setSettings(appSet);
      applyThemePalette(appSet.theme || 'midnight');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (settings?.theme) {
      applyThemePalette(settings.theme);
    }
  }, [settings?.theme, activeTab, activeChatCharacter, showSplash]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onBackPress = () => {
      if (activeChatCharacter) {
        setActiveChatCharacter(null);
        setActiveConversationId(null);
        storageService.getCharacters().then(updated => setCharacters(updated)).catch(() => {});
        return true;
      }
      if (activeTab !== 'chats') {
        const hist = tabHistoryRef.current;
        let targetTab: TabScreen = 'chats';
        if (hist.length > 1) {
          hist.pop();
          targetTab = hist[hist.length - 1] || 'chats';
        } else {
          tabHistoryRef.current = ['chats'];
        }
        setActiveTab(targetTab);
        const idx = TABS.indexOf(targetTab);
        if (idx >= 0 && pagerRef.current && pagerWidth > 0) {
          pagerRef.current.scrollTo({ x: idx * pagerWidth, animated: true });
        }
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [activeChatCharacter, activeTab, pagerWidth]);

  useEffect(() => {
    if (activeChatCharacter) {
      chatRoomEnterAnim.setValue(0);
      Animated.spring(chatRoomEnterAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 9,
        tension: 90,
      }).start();
    }
  }, [activeChatCharacter?.id]);

  const handleToggleFavorite = async (character: Character) => {
    await storageService.toggleFavorite(character.id);
    const updated = await storageService.getCharacters();
    setCharacters(updated);
  };

  const handleDeleteCharacter = async (characterId: string) => {
    await storageService.deleteCharacter(characterId);
    const updated = await storageService.getCharacters();
    setCharacters(updated);
  };

  const handleStartChat = async (character: any, detail?: any, conversationId?: string) => {
    let resolvedDetail = detail;
    const rawFirst = String(detail?.firstMessage || character.firstMessage || '').trim();
    const isPlaceholderGreeting =
      !rawFirst ||
      /look at you (quietly|attentively)\.?[\*]?$/i.test(rawFirst);

    if (!resolvedDetail && isPlaceholderGreeting && (character.characterId || character.id)) {
      try {
        const lookupId = String(character.characterId || character.id);
        resolvedDetail = await Promise.race([
          communityCatalogService.getCharacterDetail(lookupId, {
            fullPath: character.fullPath,
            source: character.source,
          }),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 4500)),
        ]);
      } catch {}
    }

    // Normalize character whether it's CommunityCharacter, Character, or raw JSON
    const fullChar: Character = {
      id: character.id || character.characterId || `char_${Date.now()}`,
      name: character.name || 'Unnamed Companion',
      chatName: resolvedDetail?.chatName || character.chatName || '',
      subtitle: resolvedDetail?.chatName || character.chatName || character.subtitle || '',
      tagline: character.tagline || (character.creatorName ? `Created by @${character.creatorName}` : 'Roleplay Companion'),
      avatar: character.avatar || character.avatarUrl || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500',
      description: resolvedDetail?.personality || resolvedDetail?.descriptionHtml || character.shortDescription || character.description || 'Expressive companion ready to chat.',
      firstMessage: resolvedDetail?.firstMessage || character.firstMessage || `*${character.name || 'They'} look at you attentively.*`,
      personality: resolvedDetail?.personality || character.personality || character.shortDescription || '',
      scenario: resolvedDetail?.scenario || character.scenario || '',
      tags: Array.isArray(character.tags)
        ? character.tags.map((t: any) => typeof t === 'string' ? t : (t?.name || t?.slug || String(t)))
        : ['anime'],
      isFavorite: !!character.isFavorite,
      contentRating: character.isNsfw ? 'NSFW' : 'SFW',
      creator: character.creator || character.creatorName || 'community',
      alternateGreetings:
        (Array.isArray(resolvedDetail?.alternateGreetings) && resolvedDetail.alternateGreetings.length > 0
          ? resolvedDetail.alternateGreetings
          : character.alternateGreetings) || [],
      chatCount: character.chatCount || 0,
      totalTokens: character.totalTokens || 850,
      updatedAt: new Date().toISOString(),
    };

    // Open ChatRoom immediately without blocking on storage read/write
    setActiveConversationId(conversationId || null);
    setActiveChatCharacter(fullChar);

    // Persist character into active characters list in the background
    storageService
      .upsertCharacter(fullChar)
      .then(() => storageService.getCharacters())
      .then(updated => setCharacters(updated))
      .catch(() => {});
  };

  const [isPasscodeUnlocked, setIsPasscodeUnlocked] = useState(false);
  const [forceShowOnboarding, setForceShowOnboarding] = useState(false);

  const appReady = !loading && Boolean(config && settings && activePersona);

  if (showSplash || loading || !config || !settings || !activePersona) {
    return <SplashScreen isReady={appReady} onFinish={() => setShowSplash(false)} />;
  }

  // Active theme background tokens
  const currentTheme = settings?.theme || 'midnight';
  const currentSkin = settings?.uiSkin || 'bento';
  const activePalette = applyThemePalette(currentTheme);
  const themeBg = activePalette.bgDark;
  const webFrameBg = activePalette.webFrameBg;

  if (!settings.hasCompletedOnboarding || forceShowOnboarding) {
    return (
      <SafeAreaProvider>
        <ThemeProvider themeId={currentTheme} uiSkin={currentSkin}>
          <LanguageProvider language={settings?.uiLanguage || 'en'}>
            <View style={[styles.webFrame, { backgroundColor: webFrameBg }]}>
              <View style={[styles.appContainer, { backgroundColor: themeBg }]}>
                <StatusBar style="light" />
                <OnboardingFlow
                  settings={settings}
                  config={config}
                  onUpdateSettings={setSettings}
                  onUpdateConfig={setConfig}
                  onFinish={() => {
                    setForceShowOnboarding(false);
                    setIsPasscodeUnlocked(true);
                  }}
                />
              </View>
            </View>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  if (settings.passcodeEnabled && settings.passcodePin && !isPasscodeUnlocked) {
    return (
      <SafeAreaProvider>
        <ThemeProvider themeId={currentTheme} uiSkin={currentSkin}>
          <LanguageProvider language={settings?.uiLanguage || 'en'}>
            <View style={[styles.webFrame, { backgroundColor: webFrameBg }]}>
              <View style={[styles.appContainer, { backgroundColor: themeBg }]}>
                <StatusBar style="light" />
                <PasscodeGate
                  expectedPin={settings.passcodePin}
                  onUnlock={() => setIsPasscodeUnlocked(true)}
                />
              </View>
            </View>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  const handleTabChange = (tab: TabScreen, recordHistory = true) => {
    setIsDockVisible(true);
    if (recordHistory && tab !== activeTab) {
      const hist = tabHistoryRef.current;
      if (hist[hist.length - 1] !== tab) {
        tabHistoryRef.current = [...hist.slice(-9), tab];
      }
    }
    setActiveTab(tab);
    const idx = TABS.indexOf(tab);
    if (idx >= 0 && pagerRef.current && pagerWidth > 0) {
      pagerRef.current.scrollTo({ x: idx * pagerWidth, animated: true });
    }
  };

  const syncTabFromOffset = (offsetX: number) => {
    if (pagerWidth <= 0) return;
    const idx = Math.max(0, Math.min(TABS.length - 1, Math.round(offsetX / pagerWidth)));
    const nextTab = TABS[idx];
    if (nextTab && nextTab !== activeTab) {
      const hist = tabHistoryRef.current;
      if (hist[hist.length - 1] !== nextTab) {
        tabHistoryRef.current = [...hist.slice(-9), nextTab];
      }
      setActiveTab(nextTab);
    }
  };

  // Active Chat Screen (Full-Screen overlay with smooth entrance animation)
  if (activeChatCharacter) {
    return (
      <SafeAreaProvider>
      <ThemeProvider themeId={currentTheme} uiSkin={currentSkin}>
      <LanguageProvider language={settings?.uiLanguage || 'en'}>
      <View style={[styles.webFrame, { backgroundColor: webFrameBg }]}>
        <Animated.View
          style={[
            styles.appContainer,
            {
              backgroundColor: themeBg,
              opacity: chatRoomEnterAnim,
              transform: [
                {
                  translateX: chatRoomEnterAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [Math.min(pagerWidth || 380, 420), 0],
                  }),
                },
              ],
            },
          ]}
        >
          <StatusBar style="light" />
          <ChatRoomScreen
            character={activeChatCharacter}
            persona={activePersona}
            personas={personas}
            onSelectPersona={setActivePersona}
            config={config}
            initialConversationId={activeConversationId || undefined}
            onBack={() => {
              Animated.timing(chatRoomEnterAnim, {
                toValue: 0,
                duration: 210,
                useNativeDriver: true,
              }).start(async () => {
                setActiveChatCharacter(null);
                setActiveConversationId(null);
                // Refresh active chat characters on return
                const updated = await storageService.getCharacters();
                setCharacters(updated);
              });
            }}
          />
        </Animated.View>
      </View>
      </LanguageProvider>
      </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
    <ThemeProvider themeId={currentTheme} uiSkin={currentSkin}>
    <LanguageProvider language={settings?.uiLanguage || 'en'}>
    <View style={[styles.webFrame, { backgroundColor: webFrameBg }]}>
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[styles.appContainer, { backgroundColor: themeBg }]}
      >
        <StatusBar style="light" />

        {/* Horizontal Swipeable Pager across Chats, Discover, Studio, Settings */}
        <BlurTargetView
          ref={dockBlurTargetRef}
          style={styles.screenArea}
          onLayout={e => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && Math.abs(w - pagerWidth) > 1) {
              setPagerWidth(w);
              const idx = TABS.indexOf(activeTab);
              setTimeout(() => {
                pagerRef.current?.scrollTo({ x: idx * w, animated: false });
              }, 0);
            }
          }}
        >
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            scrollEnabled={!(activeTab === 'discover' && isDiscoverMatchMode)}
            showsHorizontalScrollIndicator={false}
            bounces={false}
            nestedScrollEnabled
            scrollEventThrottle={16}
            onMomentumScrollEnd={e => syncTabFromOffset(e.nativeEvent.contentOffset.x)}
            onScroll={e => {
              const x = e.nativeEvent.contentOffset.x;
              if (scrollSettleTimer.current) clearTimeout(scrollSettleTimer.current);
              scrollSettleTimer.current = setTimeout(() => {
                syncTabFromOffset(x);
              }, 90);
            }}
            style={{ flex: 1 }}
          >
            <View style={{ width: pagerWidth, height: '100%' }}>
              <ChatsScreen
                characters={characters}
                trendingCharacters={trendingCharacters}
                userPersona={activePersona}
                onSelectCharacter={handleStartChat}
                onToggleFavorite={handleToggleFavorite}
                onDeleteCharacter={handleDeleteCharacter}
                onNavigateDiscover={() => handleTabChange('discover')}
                onNavigateStudio={() => handleTabChange('studio')}
                onScrollDirectionChange={setIsDockVisible}
              />
            </View>

            <View style={{ width: pagerWidth, height: '100%' }}>
              <DiscoverScreen
                characters={characters}
                activePersona={activePersona}
                onStartChat={handleStartChat}
                onToggleFavorite={handleToggleFavorite}
                onMatchModeChange={setIsDiscoverMatchMode}
                onScrollDirectionChange={setIsDockVisible}
              />
            </View>

            <View style={{ width: pagerWidth, height: '100%' }}>
              <UserStudioScreen
                onStartChat={handleStartChat}
                activePersona={activePersona}
                onUpdateActivePersona={setActivePersona}
                onScrollDirectionChange={setIsDockVisible}
              />
            </View>

            <View style={{ width: pagerWidth, height: '100%' }}>
              <SettingsScreen
                config={config}
                onUpdateConfig={setConfig}
                settings={settings}
                onUpdateSettings={setSettings}
                onReplayOnboarding={() => setForceShowOnboarding(true)}
                onScrollDirectionChange={setIsDockVisible}
              />
            </View>
          </ScrollView>
        </BlurTargetView>

        {/* Minimalist Floating Capsule Dock (hidden in Discover Match/For You modes) */}
        {!(activeTab === 'discover' && isDiscoverMatchMode) && (
          <CapsuleDock
            activeTab={activeTab}
            onTabChange={handleTabChange}
            blurTargetRef={dockBlurTargetRef}
            visible={isDockVisible}
          />
        )}
      </SafeAreaView>
    </View>
    </LanguageProvider>
    </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  webFrame: {
    flex: 1,
    backgroundColor: '#050608',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 1080, // Responsive container: fluidly expands to tablets, foldables, and desktop Edge browsers
    backgroundColor: '#0c0e14',
    position: 'relative',
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0c0e14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenArea: {
    flex: 1,
  },
});
