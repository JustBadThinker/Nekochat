/**
 * Minimalist Floating Navigation Dock
 * Styled strictly after Warden AI:
 * Pure monochrome white icons (#FFFFFF), clean labels, zero background gradient bubbles.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MessageSquare, Compass, User, Settings } from 'lucide-react-native';

export type TabScreen = 'chats' | 'discover' | 'studio' | 'settings';

interface CapsuleDockProps {
  activeTab: TabScreen;
  onTabChange: (tab: TabScreen) => void;
}

export const CapsuleDock: React.FC<CapsuleDockProps> = ({ activeTab, onTabChange }) => {
  return (
    <View style={styles.dockContainer}>
      <View style={styles.dockCapsule}>
        {/* 1. Chats Tab */}
        <TouchableOpacity
          style={[styles.dockItem, activeTab === 'chats' && styles.dockItemActive]}
          onPress={() => onTabChange('chats')}
          activeOpacity={0.8}
        >
          <MessageSquare
            size={19}
            color="#FFFFFF"
            style={{ opacity: activeTab === 'chats' ? 1 : 0.45 }}
          />
          {activeTab === 'chats' ? (
            <Text style={styles.dockLabelActive}>Chats</Text>
          ) : (
            <Text style={styles.dockLabelInactive}>Chats</Text>
          )}
          {activeTab === 'chats' && <View style={styles.activeDot} />}
        </TouchableOpacity>

        {/* 2. Discover Tab */}
        <TouchableOpacity
          style={[styles.dockItem, activeTab === 'discover' && styles.dockItemActive]}
          onPress={() => onTabChange('discover')}
          activeOpacity={0.8}
        >
          <Compass
            size={19}
            color="#FFFFFF"
            style={{ opacity: activeTab === 'discover' ? 1 : 0.45 }}
          />
          {activeTab === 'discover' ? (
            <Text style={styles.dockLabelActive}>Discover</Text>
          ) : (
            <Text style={styles.dockLabelInactive}>Discover</Text>
          )}
          {activeTab === 'discover' && <View style={styles.activeDot} />}
        </TouchableOpacity>

        {/* 3. Studio (User Cards & Personas) Tab */}
        <TouchableOpacity
          style={[styles.dockItem, activeTab === 'studio' && styles.dockItemActive]}
          onPress={() => onTabChange('studio')}
          activeOpacity={0.8}
        >
          <User
            size={19}
            color="#FFFFFF"
            style={{ opacity: activeTab === 'studio' ? 1 : 0.45 }}
          />
          {activeTab === 'studio' ? (
            <Text style={styles.dockLabelActive}>Studio</Text>
          ) : (
            <Text style={styles.dockLabelInactive}>Studio</Text>
          )}
          {activeTab === 'studio' && <View style={styles.activeDot} />}
        </TouchableOpacity>

        {/* 4. Settings Tab */}
        <TouchableOpacity
          style={[styles.dockItem, activeTab === 'settings' && styles.dockItemActive]}
          onPress={() => onTabChange('settings')}
          activeOpacity={0.8}
        >
          <Settings
            size={19}
            color="#FFFFFF"
            style={{ opacity: activeTab === 'settings' ? 1 : 0.45 }}
          />
          {activeTab === 'settings' ? (
            <Text style={styles.dockLabelActive}>Settings</Text>
          ) : (
            <Text style={styles.dockLabelInactive}>Settings</Text>
          )}
          {activeTab === 'settings' && <View style={styles.activeDot} />}
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
    backgroundColor: '#0c0e14',
    borderRadius: 32,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  dockItem: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginHorizontal: 2,
    minWidth: 64,
  },
  dockItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  dockLabelActive: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  dockLabelInactive: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  activeDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },
});
