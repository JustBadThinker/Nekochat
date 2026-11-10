/**
 * NekoChat — Free & Open-Source AI Roleplay Client
 * Bento-OLED High-Contrast Design System with Minimalist Floating Navigation Dock.
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Character, Persona, ProviderConfig, AppSettings } from './src/types';
import { colors } from './src/theme/colors';
import { storageService } from './src/services/storageService';
import { characterService } from './src/services/characterService';
import { CapsuleDock, TabScreen } from './src/components/CapsuleDock';
import { SplashScreen } from './src/components/SplashScreen';
import { ChatsScreen } from './src/screens/ChatsScreen';
import { DiscoverScreen } from './src/screens/DiscoverScreen';
import { ChatRoomScreen } from './src/screens/ChatRoomScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { UserStudioScreen } from './src/screens/UserStudioScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabScreen>('chats');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [trendingCharacters, setTrendingCharacters] = useState<Character[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [config, setConfig] = useState<ProviderConfig | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeChatCharacter, setActiveChatCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      // 1. Load active chat characters (clean initial state, purged of any mock data)
      const chars = await characterService.ensureStarters();
      setCharacters(chars);

      // 2. Load trending 24h characters (fetched live or genuine anime)
      const trending = await characterService.getTrending24h(chars);
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
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async (character: Character) => {
    await storageService.toggleFavorite(character.id);
    const updated = await storageService.getCharacters();
    setCharacters(updated);
  };

  const handleStartChat = async (character: Character) => {
    // Ensure character is saved into active characters list
    await storageService.upsertCharacter(character);
    const updated = await storageService.getCharacters();
    setCharacters(updated);
    setActiveChatCharacter(character);
  };

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (loading || !config || !settings || !activePersona) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  // Active Chat Screen (Full-Screen overlay)
  if (activeChatCharacter) {
    return (
      <View style={styles.webFrame}>
        <View style={styles.appContainer}>
          <StatusBar style="light" />
          <ChatRoomScreen
            character={activeChatCharacter}
            persona={activePersona}
            personas={personas}
            onSelectPersona={setActivePersona}
            config={config}
            onBack={async () => {
              setActiveChatCharacter(null);
              // Refresh active chat characters on return
              const updated = await storageService.getCharacters();
              setCharacters(updated);
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.webFrame}>
      <View style={styles.appContainer}>
        <StatusBar style="light" />

        {/* Screen Render based on activeTab */}
        <View style={styles.screenArea}>
          {activeTab === 'chats' && (
            <ChatsScreen
              characters={characters}
              trendingCharacters={trendingCharacters}
              onSelectCharacter={handleStartChat}
              onToggleFavorite={handleToggleFavorite}
              onNavigateDiscover={() => setActiveTab('discover')}
              onNavigateStudio={() => setActiveTab('studio')}
            />
          )}

          {activeTab === 'discover' && (
            <DiscoverScreen
              characters={characters}
              onStartChat={handleStartChat}
              onToggleFavorite={handleToggleFavorite}
            />
          )}

          {activeTab === 'studio' && (
            <UserStudioScreen
              onStartChat={handleStartChat}
              activePersona={activePersona}
              onUpdateActivePersona={setActivePersona}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsScreen
              config={config}
              onUpdateConfig={setConfig}
              settings={settings}
              onUpdateSettings={setSettings}
            />
          )}
        </View>

        {/* Minimalist Floating Capsule Dock (Warden AI Monochrome Style) */}
        <CapsuleDock activeTab={activeTab} onTabChange={setActiveTab} />
      </View>
    </View>
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
    maxWidth: 480, // Clamps perfectly to mobile smartphone frame on Edge/Firefox
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
