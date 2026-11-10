/**
 * NekoChat — Free & Open-Source AI Roleplay Client
 * Bento-OLED High-Contrast Design System with Floating Capsule Dock.
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
import { VaultScreen } from './src/screens/VaultScreen';

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
      const chars = await characterService.ensureStarters();
      setCharacters(chars);
      setTrendingCharacters(characterService.getTrending24h(chars));

      const persList = await storageService.getPersonas();
      setPersonas(persList);
      setActivePersona(persList[0]);

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
    setTrendingCharacters(characterService.getTrending24h(updated));
  };

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (loading || !config || !settings || !activePersona) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={colors.lime} />
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
            onBack={() => setActiveChatCharacter(null)}
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
              onSelectCharacter={setActiveChatCharacter}
              onToggleFavorite={handleToggleFavorite}
              onNavigateDiscover={() => setActiveTab('discover')}
            />
          )}

          {activeTab === 'discover' && (
            <DiscoverScreen
              characters={characters}
              onStartChat={setActiveChatCharacter}
              onToggleFavorite={handleToggleFavorite}
            />
          )}

          {activeTab === 'vault' && (
            <VaultScreen
              characters={characters}
              personas={personas}
              settings={settings}
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

        {/* Floating Capsule Dock (Ref: Gambar 1) */}
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
    backgroundColor: colors.bgDark,
    position: 'relative',
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bgDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenArea: {
    flex: 1,
  },
});
