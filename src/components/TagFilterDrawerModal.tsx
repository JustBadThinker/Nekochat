/**
 * TagFilterDrawerModal.tsx
 * Strictly ported from Warden AI (c:\Users\kanto\Documents\Work\Apps\Wardenai\src\components\character\TagFilterDrawer.tsx)
 * Multi-category community tag drawer with accordion expand/collapse.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import {
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Check,
  RotateCcw,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GLASS } from '../theme/glassTheme';

interface TagCategoryItem {
  id: string;
  label: string;
  defaultExpanded?: boolean;
  pills: { label: string; slug: string }[];
}

const CATEGORIES: TagCategoryItem[] = [
  {
    id: 'gender',
    label: 'Character Gender',
    defaultExpanded: true,
    pills: [
      { label: 'Male', slug: 'male' },
      { label: 'Female', slug: 'female' },
      { label: 'Non-binary', slug: 'nonbinary' },
      { label: 'Any Gender', slug: 'any' },
    ],
  },
  {
    id: 'romance',
    label: 'Romance & Attraction',
    defaultExpanded: true,
    pills: [
      { label: 'Fluff', slug: 'fluff' },
      { label: 'Enemies to Lovers', slug: 'enemiestolovers' },
      { label: 'Slow Burn', slug: 'slowburn' },
      { label: 'Straight', slug: 'straight' },
      { label: 'Yaoi / MLM', slug: 'mlm' },
      { label: 'Yuri / WLW', slug: 'wlw' },
    ],
  },
  {
    id: 'personality',
    label: 'Personality Archetype',
    defaultExpanded: true,
    pills: [
      { label: 'Tsundere', slug: 'tsundere' },
      { label: 'Yandere', slug: 'yandere' },
      { label: 'Kuudere', slug: 'kuudere' },
      { label: 'Dandere', slug: 'dandere' },
      { label: 'Dominant', slug: 'dominant' },
      { label: 'Submissive', slug: 'submissive' },
      { label: 'Gentle', slug: 'gentle' },
      { label: 'Possessive', slug: 'possessive' },
    ],
  },
  {
    id: 'genre',
    label: 'Genre & World',
    pills: [
      { label: 'Anime', slug: 'anime' },
      { label: 'Fantasy / Magic', slug: 'magical' },
      { label: 'Cyberpunk', slug: 'cyberpunk' },
      { label: 'Sci-Fi', slug: 'scifi' },
      { label: 'Modern / Slice of Life', slug: 'sliceoflife' },
      { label: 'Game / RPG', slug: 'game' },
      { label: 'Horror', slug: 'horror' },
    ],
  },
  {
    id: 'species',
    label: 'Species & Heritage',
    pills: [
      { label: 'Human', slug: 'human' },
      { label: 'Demi-Human', slug: 'demihuman' },
      { label: 'Non-human', slug: 'nonhuman' },
      { label: 'Furry', slug: 'furry' },
      { label: 'Monster / Creature', slug: 'monster' },
      { label: 'Vampire', slug: 'vampire' },
      { label: 'Elf', slug: 'elf' },
    ],
  },
  {
    id: 'power',
    label: 'Power Dynamics & Roles',
    pills: [
      { label: 'Hero', slug: 'hero' },
      { label: 'Villain', slug: 'villain' },
      { label: 'Royalty', slug: 'royalty' },
      { label: 'Bodyguard', slug: 'bodyguard' },
      { label: 'Mafia / Criminal', slug: 'mafia' },
      { label: 'Mentor / Master', slug: 'mentor' },
    ],
  },
  {
    id: 'themes',
    label: 'Narrative Tone & Themes',
    pills: [
      { label: 'Angst', slug: 'angst' },
      { label: 'Comedy', slug: 'comedy' },
      { label: 'Wholesome', slug: 'wholesome' },
      { label: 'Drama', slug: 'drama' },
      { label: 'Mystery', slug: 'mystery' },
    ],
  },
];

interface TagFilterDrawerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedTagSlugs: string[];
  onToggleTag: (slug: string) => void;
  onClearTags: () => void;
  onApply: () => void;
  matchingCount?: number;
}

export const TagFilterDrawerModal: React.FC<TagFilterDrawerModalProps> = ({
  visible,
  onClose,
  selectedTagSlugs,
  onToggleTag,
  onClearTags,
  onApply,
  matchingCount = 200000,
}) => {
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    gender: true,
    romance: true,
    personality: true,
  });

  const toggleCat = (id: string) => {
    setExpandedCats(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(6, 8, 14, 0.12)', 'rgba(6, 8, 14, 0.48)', 'rgba(6, 8, 14, 0.88)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity style={styles.sheetContainer} activeOpacity={1} onPress={(e: any) => e.stopPropagation?.()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <SlidersHorizontal size={17} color="#d4ff00" style={{ marginRight: 8 }} />
              <Text style={styles.headerTitle}>Filter Characters by Tags</Text>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* Body: Accordion categories */}
          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
            {CATEGORIES.map(cat => {
              const isExpanded = Boolean(expandedCats[cat.id]);
              const activeCount = cat.pills.filter(p =>
                selectedTagSlugs.includes(p.slug)
              ).length;

              return (
                <View key={cat.id} style={styles.categoryBlock}>
                  <TouchableOpacity
                    style={styles.categoryHeader}
                    onPress={() => toggleCat(cat.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.categoryTitleRow}>
                      <Text style={styles.categoryTitle}>{cat.label}</Text>
                      {activeCount > 0 && (
                        <View style={styles.catActiveBadge}>
                          <Text style={styles.catActiveBadgeText}>{activeCount}</Text>
                        </View>
                      )}
                    </View>

                    {isExpanded ? (
                      <ChevronUp size={16} color="#9ca3af" />
                    ) : (
                      <ChevronDown size={16} color="#9ca3af" />
                    )}
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.pillsWrap}>
                      {cat.pills.map(pill => {
                        const isSelected = selectedTagSlugs.includes(pill.slug);
                        return (
                          <TouchableOpacity
                            key={pill.slug}
                            style={[styles.pill, isSelected && styles.pillSelected]}
                            onPress={() => onToggleTag(pill.slug)}
                            activeOpacity={0.8}
                          >
                            {isSelected && (
                              <Check size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                            )}
                            <Text
                              style={[
                                styles.pillText,
                                isSelected && styles.pillTextSelected,
                              ]}
                            >
                              #{pill.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={onClearTags}
              activeOpacity={0.7}
            >
              <RotateCcw size={13} color="#9ca3af" style={{ marginRight: 4 }} />
              <Text style={styles.resetBtnText}>Reset All</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.applyBtn}
              onPress={() => {
                onApply();
                onClose();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.applyBtnText}>
                Apply Filters {selectedTagSlugs.length > 0 ? `(${selectedTagSlugs.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    ...GLASS.backdrop,
  },
  sheetContainer: {
    backgroundColor: GLASS.bgModal,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: GLASS.borderBright,
    maxHeight: '85%',
    flex: 1,
    ...GLASS.backdropStrong,
    ...GLASS.shadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1b1e28',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeBtn: {
    padding: 4,
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  categoryBlock: {
    marginBottom: 14,
    backgroundColor: GLASS.bgSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GLASS.border,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  catActiveBadge: {
    backgroundColor: '#d4ff00',
    borderRadius: 9,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 7,
  },
  catActiveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0c0e14',
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1f2e',
    borderWidth: 1,
    borderColor: '#262d40',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pillSelected: {
    backgroundColor: '#d4ff00',
    borderColor: '#d4ff00',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9ca3af',
  },
  pillTextSelected: {
    color: '#000000',
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1b1e28',
    backgroundColor: '#0c0e14',
    gap: 12,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#151824',
    borderWidth: 1,
    borderColor: '#222736',
  },
  resetBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#9ca3af',
  },
  applyBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#d4ff00',
    shadowColor: '#d4ff00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  applyBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#000000',
  },
});

