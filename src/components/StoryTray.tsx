/**
 * Top Trending / Algorithmic Recommendations Tray
 * Displays genuine community trending 24h companions, or top 3 recommended
 * companions (FYP) when user pattern is detected (affinity >= 50%) separated
 * from the live 24h trending feed.
 */

import React , { useMemo } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Flame, Zap } from 'lucide-react-native';
import { Character } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { ThemePalette } from '../theme/colors';

export interface StoryTrayProps {
  recommendations?: Character[];
  trendingCharacters: Character[];
  onOpenStory: (character: Character, index: number) => void;
}

export const StoryTray: React.FC<StoryTrayProps> = ({
  recommendations = [],
  trendingCharacters = [],
  onOpenStory,
}) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const topRecs = (recommendations || []).slice(0, 3);
  const hasRecommendations = topRecs.length > 0;
  const hasTrending = trendingCharacters && trendingCharacters.length > 0;

  if (!hasRecommendations && !hasTrending) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleContainer}>
          {hasRecommendations ? (
            <Zap size={15} color={palette.accent} style={{ marginRight: 6 }} />
          ) : (
            <Flame size={15} color={palette.accent} style={{ marginRight: 6 }} />
          )}
          <Text style={styles.headerTitle}>
            {hasRecommendations ? 'For You & Trending' : 'Trending 24h'}
          </Text>
        </View>
        <Text
          style={[
            styles.headerBadge,
            {
              color: palette.accent,
              backgroundColor: `rgba(${palette.accentRgb}, 0.12)`,
              borderColor: `rgba(${palette.accentRgb}, 0.25)`,
            },
          ]}
        >
          {hasRecommendations ? '⚡ FYP + 24h Feed' : 'Live Community'}
        </Text>
      </View>

      <ScrollView
        horizontal
        nestedScrollEnabled={true}
        directionalLockEnabled={true}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 1. Algorithmic Top 3 For You (Rendered at front if affinity >= 50%) */}
        {hasRecommendations &&
          topRecs.map((char, index) => (
            <TouchableOpacity
              key={`rec_${char.id}`}
              style={styles.storyItem}
              onPress={() => onOpenStory(char, index)}
              activeOpacity={0.8}
            >
              <View style={[styles.avatarRing, styles.recAvatarRing]}>
                <Image source={{ uri: char.avatar }} style={styles.avatarImage} />
                <View style={styles.recTinyBadge}>
                  <Text style={styles.recTinyBadgeText}>FYP</Text>
                </View>
              </View>
              <Text style={[styles.storyName, { color: palette.accent }]} numberOfLines={1}>
                {char.name}
              </Text>
            </TouchableOpacity>
          ))}

        {/* 2. Stylish Separator Badge Between FYP and Trending 24h */}
        {hasRecommendations && hasTrending && (
          <View style={styles.traySeparator}>
            <View style={styles.traySeparatorPill}>
              <Flame size={12} color={palette.accent} style={{ marginRight: 3 }} />
              <Text style={styles.traySeparatorText}>24h Trending</Text>
            </View>
          </View>
        )}

        {/* 3. Community Trending 24h Feed */}
        {trendingCharacters.map((char, index) => {
          const actualIndex = topRecs.length + index;
          return (
            <TouchableOpacity
              key={`trend_${char.id}`}
              style={styles.storyItem}
              onPress={() => onOpenStory(char, actualIndex)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.avatarRing,
                  {
                    borderColor: index === 0 ? palette.accent : 'rgba(255, 255, 255, 0.35)',
                  },
                ]}
              >
                <Image source={{ uri: char.avatar }} style={styles.avatarImage} />
              </View>
              <Text style={styles.storyName} numberOfLines={1}>
                {char.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerBadge: {
    color: palette.accent,
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: `rgba(${palette.accentRgb}, 0.12)`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.25)`,
  },
  scrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  storyItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 68,
  },
  avatarRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    padding: 2.5,
    borderWidth: 1.5,
    backgroundColor: palette.bgDark,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  recAvatarRing: {
    borderColor: palette.accent,
    borderWidth: 2,
    shadowColor: palette.accent,
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  recTinyBadge: {
    position: 'absolute',
    bottom: -3,
    backgroundColor: palette.accent,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    zIndex: 5,
  },
  recTinyBadgeText: {
    color: '#000000',
    fontSize: 8,
    fontWeight: '900',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  storyName: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  traySeparator: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    height: 62,
  },
  traySeparatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.3)`,
  },
  traySeparatorText: {
    color: '#e2e8f0',
    fontSize: 10,
    fontWeight: '700',
  },
});
