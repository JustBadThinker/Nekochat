/**
 * ModelDropdown — Animated dropdown selector for per-chat AI Engine Model override.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native';
import { ChevronDown, Check, Cpu } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { GLASS } from '../theme/glassTheme';
import { useTheme } from '../theme/ThemeContext';
import { runToggleAnimation } from '../theme/animations';

export interface ModelOption {
  id: string;
  label: string;
  isDefault?: boolean;
}

interface ModelDropdownProps {
  selectedModel: string;
  defaultModelLabel: string;
  options: ModelOption[];
  onSelect: (modelId: string) => void;
}

export const ModelDropdown: React.FC<ModelDropdownProps> = ({
  selectedModel,
  defaultModelLabel,
  options,
  onSelect,
}) => {
  const { skin } = useTheme();
  const [open, setOpen] = useState(false);
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    runToggleAnimation(anim, open, skin.animation);
  }, [open, anim, skin.animation]);

  const chevronRotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const menuTranslateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 0],
  });

  const activeLabel = !selectedModel
    ? `Default Engine Model (${defaultModelLabel})`
    : options.find(o => o.id === selectedModel)?.label || selectedModel;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.trigger, open && styles.triggerOpen]}
        onPress={() => setOpen(prev => !prev)}
        activeOpacity={0.85}
      >
        <View style={styles.triggerLeft}>
          <Cpu size={14} color={colors.lime} style={{ marginRight: 8 }} />
          <Text style={styles.triggerText} numberOfLines={1}>
            {activeLabel}
          </Text>
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <ChevronDown size={16} color="#9ca3af" />
        </Animated.View>
      </TouchableOpacity>

      {open && (
        <Animated.View
          style={[
            styles.dropdownMenu,
            {
              opacity: anim,
              transform: [{ translateY: menuTranslateY }],
            },
          ]}
        >
          <ScrollView
            style={styles.scrollList}
            nestedScrollEnabled
            showsVerticalScrollIndicator={true}
          >
            {/* Default Engine Model option */}
            <TouchableOpacity
              style={[styles.optionRow, !selectedModel && styles.optionRowActive]}
              onPress={() => {
                onSelect('');
                setOpen(false);
              }}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.optionText, !selectedModel && styles.optionTextActive]}
                numberOfLines={1}
              >
                Default Engine Model ({defaultModelLabel})
              </Text>
              {!selectedModel && <Check size={14} color={colors.lime} />}
            </TouchableOpacity>

            {options.map(opt => {
              const isSelected = selectedModel === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.optionRow, isSelected && styles.optionRowActive]}
                  onPress={() => {
                    onSelect(opt.id);
                    setOpen(false);
                  }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[styles.optionText, isSelected && styles.optionTextActive]}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                  {isSelected && <Check size={14} color={colors.lime} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 14,
    zIndex: 20,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GLASS.bgSubtle,
    borderWidth: 1,
    borderColor: GLASS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...GLASS.backdrop,
  },
  triggerOpen: {
    borderColor: colors.lime,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  triggerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  dropdownMenu: {
    marginTop: 6,
    backgroundColor: GLASS.bgModal,
    borderWidth: 1,
    borderColor: GLASS.borderBright,
    borderRadius: 14,
    overflow: 'hidden',
    ...GLASS.backdropStrong,
    ...GLASS.shadow,
  },
  scrollList: {
    maxHeight: 200,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  optionRowActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  optionText: {
    color: '#cbd5e1',
    fontSize: 12.5,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  optionTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
