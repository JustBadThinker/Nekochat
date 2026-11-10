/**
 * Floating Capsule Dock Bottom Navigation
 * Ref: Gambar 1 — Ergonomic, floating pill capsule with gradient active tab.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MessageSquare, Compass, FolderClosed, Settings } from 'lucide-react-native';
import { colors } from '../theme/colors';

export type TabScreen = 'chats' | 'discover' | 'vault' | 'settings';

interface CapsuleDockProps {
  activeTab: TabScreen;
  onTabChange: (tab: TabScreen) => void;
}

export const CapsuleDock: React.FC<CapsuleDockProps> = ({ activeTab, onTabChange }) => {
  return (
    <View style={styles.dockContainer}>
      <View style={styles.dockCapsule}>
        {/* Chats Tab */}
        <TouchableOpacity
          style={[styles.dockItem, activeTab === 'chats' && styles.dockItemActive]}
          onPress={() => onTabChange('chats')}
          activeOpacity={0.8}
        >
          <MessageSquare
            size={20}
            color={activeTab === 'chats' ? colors.dockActiveText : colors.textSecondary}
          />
          {activeTab === 'chats' && <Text style={styles.dockLabelActive}>Chats</Text>}
        </TouchableOpacity>

        {/* Discover Tab */}
        <TouchableOpacity
          style={[styles.dockItem, activeTab === 'discover' && styles.dockItemActive]}
          onPress={() => onTabChange('discover')}
          activeOpacity={0.8}
        >
          <Compass
            size={20}
            color={activeTab === 'discover' ? colors.dockActiveText : colors.textSecondary}
          />
          {activeTab === 'discover' && <Text style={styles.dockLabelActive}>Discover</Text>}
        </TouchableOpacity>

        {/* Vault Tab */}
        <TouchableOpacity
          style={[styles.dockItem, activeTab === 'vault' && styles.dockItemActive]}
          onPress={() => onTabChange('vault')}
          activeOpacity={0.8}
        >
          <FolderClosed
            size={20}
            color={activeTab === 'vault' ? colors.dockActiveText : colors.textSecondary}
          />
          {activeTab === 'vault' && <Text style={styles.dockLabelActive}>Vault</Text>}
        </TouchableOpacity>

        {/* Settings Tab */}
        <TouchableOpacity
          style={[styles.dockItem, activeTab === 'settings' && styles.dockItemActive]}
          onPress={() => onTabChange('settings')}
          activeOpacity={0.8}
        >
          <Settings
            size={20}
            color={activeTab === 'settings' ? colors.dockActiveText : colors.textSecondary}
          />
          {activeTab === 'settings' && <Text style={styles.dockLabelActive}>Settings</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dockContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99,
  },
  dockCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dockBg,
    borderRadius: 32,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  dockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    marginHorizontal: 2,
  },
  dockItemActive: {
    backgroundColor: colors.lime,
  },
  dockLabelActive: {
    color: colors.dockActiveText,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
});

