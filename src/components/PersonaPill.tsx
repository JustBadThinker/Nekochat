/**
 * Keyboard-Docked Slim Persona Pill
 * Ref: Blueprint Section 3.C — Docks cleanly above the input bar so user always knows who they are roleplaying as.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Platform } from 'react-native';
import { GestureDetector, useNativeGesture } from 'react-native-gesture-handler';
import { User, ChevronDown, Check } from 'lucide-react-native';
import { Persona } from '../types';
import { colors } from '../theme/colors';
import { GLASS } from '../theme/glassTheme';
import { useTheme } from '../theme/ThemeContext';
import { BottomSheetModal, useBottomSheetGesture } from './BottomSheetModal';

interface PersonaPillProps {
  personas: Persona[];
  activePersona: Persona;
  onSelectPersona: (persona: Persona) => void;
}

const PersonaListSheetContent: React.FC<{
  personas: Persona[];
  activePersona: Persona;
  accentColor: string;
  accentRgb: string;
  onSelectPersona: (persona: Persona) => void;
  onClose: () => void;
}> = ({ personas, activePersona, accentColor, accentRgb, onSelectPersona, onClose }) => {
  const gestureCtx = useBottomSheetGesture();
  const nativeListGesture = useNativeGesture(
    gestureCtx?.sheetPanGesture
      ? {
          disableReanimated: true,
          simultaneousWith: gestureCtx.sheetPanGesture,
        }
      : { disableReanimated: true }
  );

  return (
    <>
      <Text style={styles.modalTitle}>Switch Persona</Text>
      <GestureDetector gesture={nativeListGesture}>
        <FlatList
          data={personas}
          keyExtractor={item => item.id}
          bounces={false}
          overScrollMode="never"
          scrollEnabled={!gestureCtx?.isSheetDragging}
          scrollEventThrottle={16}
          onScroll={e => {
            gestureCtx?.setScrollAtTop(e.nativeEvent.contentOffset.y <= 2);
          }}
          renderItem={({ item }) => {
            const isSelected = item.id === activePersona.id;
            return (
              <TouchableOpacity
                style={[
                  styles.personaItem,
                  isSelected && {
                    backgroundColor: `rgba(${accentRgb}, 0.08)`,
                    borderWidth: 1,
                    borderColor: accentColor,
                  },
                ]}
                onPress={() => {
                  onSelectPersona(item);
                  onClose();
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.personaName, isSelected && { color: accentColor }]}>
                    {item.name}
                  </Text>
                  <Text style={styles.personaDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                </View>
                {isSelected && <Check size={18} color={accentColor} />}
              </TouchableOpacity>
            );
          }}
        />
      </GestureDetector>
    </>
  );
};

export const PersonaPill: React.FC<PersonaPillProps> = ({
  personas,
  activePersona,
  onSelectPersona,
}) => {
  const { palette } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.pillContainer}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <User size={12} color={palette.accent} style={{ marginRight: 4 }} />
        <Text style={styles.pillText} numberOfLines={1}>
          Playing as: <Text style={styles.pillName}>{activePersona.name}</Text>
        </Text>
        <ChevronDown size={12} color={colors.textSecondary} style={{ marginLeft: 4 }} />
      </TouchableOpacity>

      {/* Quick Persona Switcher Modal */}
      <BottomSheetModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        sheetStyle={{ maxHeight: '62%' }}
      >
        <PersonaListSheetContent
          personas={personas}
          activePersona={activePersona}
          accentColor={palette.accent}
          accentRgb={palette.accentRgb}
          onSelectPersona={onSelectPersona}
          onClose={() => setModalVisible(false)}
        />
      </BottomSheetModal>
    </>
  );
};

const styles = StyleSheet.create({
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginBottom: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  pillText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  pillName: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 8, 14, 0.62)',
    justifyContent: 'center',
    padding: 24,
    ...GLASS.backdrop,
    ...(Platform.OS === 'web'
      ? ({
          backgroundColor: 'transparent',
          backgroundImage:
            'linear-gradient(to bottom, rgba(6, 8, 14, 0.12) 0%, rgba(6, 8, 14, 0.48) 50%, rgba(6, 8, 14, 0.88) 100%)',
        } as any)
      : {}),
  },
  modalContent: {
    backgroundColor: GLASS.bgModal,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: GLASS.borderBright,
    maxHeight: 350,
    ...GLASS.backdropStrong,
    ...GLASS.shadow,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  personaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  personaName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  personaDesc: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
});

