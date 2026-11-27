/**
 * ThemeStoreModal — Snappy in-app Theme Store backed by GitHub (`themes/index.json`).
 * Displays instant live UI previews (plus remote screenshots when provided),
 * category filtering, template motion specs, and 1-tap Install & Apply.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ArrowLeft,
  Check,
  Download,
  Palette,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react-native';
import { BottomSheetModal, BottomSheetScrollView } from './BottomSheetModal';
import { useTheme } from '../theme/ThemeContext';
import { runTabFadeAnimation } from '../theme/animations';
import { NekoThemePack, ThemePackManifestItem } from '../theme/themePackSchema';
import {
  getCatalogSync,
  getInstalledThemePacksSync,
  getPreviewPackSync,
  hydrateInstalledThemePacks,
  installThemePack,
  refreshThemeCatalog,
  uninstallThemePack,
} from '../services/themeStoreService';

interface ThemeStoreModalProps {
  visible: boolean;
  activePackId?: string | null;
  onClose: () => void;
  onApplyPack: (pack: NekoThemePack) => Promise<void> | void;
  onPackUninstalled?: (packId: string) => Promise<void> | void;
}

const FILTER_TAGS = ['All', 'Installed', 'Pastel', 'Neon', 'Minimal', 'Retro'] as const;
type FilterTag = (typeof FILTER_TAGS)[number];

const BASE_SKIN_LABELS: Record<string, string> = {
  bento: 'Neko Bento',
  ios: 'HIG Liquid Glass',
  material: 'Material 3',
  janitor: 'Classic',
};

const ThemeLivePreview: React.FC<{
  item: ThemePackManifestItem;
  packDetail: NekoThemePack | null;
  large?: boolean;
}> = ({ item, packDetail, large = false }) => {
  const [imgFailed, setImgFailed] = useState(false);

  const bgDark = packDetail?.palette.bgDark || item.previewSwatches[0] || '#0c0e14';
  const bgSurface = packDetail?.palette.bgSurface || item.previewSwatches[1] || '#12151e';
  const accent = packDetail?.palette.accent || item.previewSwatches[2] || '#D4FF00';
  const accentMuted = packDetail?.palette.accentMuted || item.previewSwatches[3] || accent;
  const dockBg = packDetail?.palette.dockBg || bgSurface;
  const userBubbleBg = packDetail?.surfaces?.userBubbleBg || `${accent}33`;
  const aiBubbleBg = packDetail?.surfaces?.aiBubbleBg || bgSurface;

  const cardRadius = Math.min(20, packDetail?.geometry?.cardRadius ?? 16);
  const bubbleRadius = Math.min(18, packDetail?.geometry?.bubbleRadius ?? 14);
  const tailRadius = Math.min(8, packDetail?.geometry?.bubbleTailRadius ?? 4);
  const buttonRadius = Math.min(999, packDetail?.geometry?.buttonRadius ?? 12);
  const dockRadius = Math.min(22, packDetail?.geometry?.dockRadius ?? 18);
  const lipWidth =
    packDetail?.baseSkin === 'bento' ? (packDetail?.surfaces?.keycapLipWidth ?? 3) : 1;

  const hasRemoteShot = Boolean(item.previewImage && !imgFailed);

  return (
    <View
      style={[
        styles.previewBox,
        {
          height: large ? 178 : 112,
          backgroundColor: bgDark,
          borderRadius: Math.max(10, cardRadius),
          borderColor: `${accent}44`,
        },
      ]}
    >
      {/* Miniature Live NekoChat Preview */}
      <View style={styles.previewInner}>
        {/* Mini Header */}
        <View style={styles.previewMiniHeader}>
          <View style={[styles.previewAvatarDot, { backgroundColor: accent }]} />
          <View style={[styles.previewBar, { width: large ? 86 : 62, backgroundColor: bgSurface }]} />
          <View
            style={[
              styles.previewBadgePill,
              { backgroundColor: `${accent}26`, borderColor: `${accent}66`, borderRadius: buttonRadius },
            ]}
          >
            <Text style={[styles.previewBadgeText, { color: accent }]}>{item.badge}</Text>
          </View>
        </View>

        {/* Mini Chat Bubbles */}
        <View style={styles.previewBubblesArea}>
          <View
            style={[
              styles.previewAiBubble,
              {
                backgroundColor: aiBubbleBg,
                borderTopLeftRadius: bubbleRadius,
                borderTopRightRadius: bubbleRadius,
                borderBottomRightRadius: bubbleRadius,
                borderBottomLeftRadius: tailRadius,
                borderColor: 'rgba(255,255,255,0.12)',
                borderBottomWidth: lipWidth,
                borderBottomColor: 'rgba(0,0,0,0.45)',
              },
            ]}
          >
            <View style={[styles.previewLine, { width: large ? '78%' : '70%', backgroundColor: 'rgba(255,255,255,0.72)' }]} />
            {large && (
              <View style={[styles.previewLine, { width: '48%', backgroundColor: 'rgba(255,255,255,0.38)', marginTop: 5 }]} />
            )}
          </View>

          <View
            style={[
              styles.previewUserBubble,
              {
                backgroundColor: userBubbleBg,
                borderTopLeftRadius: bubbleRadius,
                borderTopRightRadius: bubbleRadius,
                borderBottomLeftRadius: bubbleRadius,
                borderBottomRightRadius: tailRadius,
                borderColor: `${accent}88`,
              },
            ]}
          >
            <View style={[styles.previewLine, { width: large ? 104 : 74, backgroundColor: accent }]} />
          </View>
        </View>

        {/* Mini Dock / Composer */}
        <View
          style={[
            styles.previewMiniDock,
            {
              backgroundColor: dockBg,
              borderRadius: dockRadius,
              borderColor: `${accent}44`,
            },
          ]}
        >
          <View style={[styles.previewDockPill, { backgroundColor: accent, borderRadius: buttonRadius }]} />
          <View style={[styles.previewDockDot, { backgroundColor: accentMuted }]} />
          <View style={[styles.previewDockDot, { backgroundColor: 'rgba(255,255,255,0.28)' }]} />
        </View>
      </View>

      {/* Remote Screenshot Overlay when provided by the theme pack */}
      {hasRemoteShot && (
        <Image
          source={{ uri: item.previewImage }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setImgFailed(true)}
        />
      )}
    </View>
  );
};

export const ThemeStoreModal: React.FC<ThemeStoreModalProps> = ({
  visible,
  activePackId,
  onClose,
  onApplyPack,
  onPackUninstalled,
}) => {
  const { palette, skin } = useTheme();
  const [catalog, setCatalog] = useState<ThemePackManifestItem[]>(() => getCatalogSync());
  const [installedIds, setInstalledIds] = useState<string[]>(() =>
    getInstalledThemePacksSync().map(p => p.id)
  );
  const [selectedFilter, setSelectedFilter] = useState<FilterTag>('All');
  const [selectedItem, setSelectedItem] = useState<ThemePackManifestItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyPackId, setBusyPackId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const viewFadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    setSelectedItem(null);
    setNotice(null);
    let cancelled = false;

    const syncCatalog = async () => {
      await hydrateInstalledThemePacks();
      if (cancelled) return;
      setInstalledIds(getInstalledThemePacksSync().map(p => p.id));
      setCatalog(getCatalogSync());
      setRefreshing(true);
      const res = await refreshThemeCatalog();
      if (cancelled) return;
      setCatalog(res.items);
      setRefreshing(false);
    };

    void syncCatalog();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    runTabFadeAnimation(viewFadeAnim, skin.animation, 0.25);
  }, [selectedItem?.id, viewFadeAnim, skin.animation]);

  const installedSet = useMemo(() => new Set(installedIds), [installedIds]);

  const filteredCatalog = useMemo(() => {
    if (selectedFilter === 'All') return catalog;
    if (selectedFilter === 'Installed') {
      return catalog.filter(item => installedSet.has(item.id));
    }
    const target = selectedFilter.toLowerCase();
    return catalog.filter(item => item.tags.some(t => t.toLowerCase() === target));
  }, [catalog, selectedFilter, installedSet]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setNotice(null);
    const res = await refreshThemeCatalog();
    setCatalog(res.items);
    setRefreshing(false);
    if (!res.fromNetwork && res.error) {
      setNotice(`Showing cached catalog (${res.error}).`);
    } else {
      setNotice(`Catalog synced (${res.items.length} themes).`);
    }
  };

  const handleInstallOrApply = async (item: ThemePackManifestItem, applyAfter: boolean) => {
    setBusyPackId(item.id);
    setNotice(null);
    try {
      const existing = getInstalledThemePacksSync().find(p => p.id === item.id);
      const pack = existing || (await installThemePack(item));
      setInstalledIds(getInstalledThemePacksSync().map(p => p.id));
      if (applyAfter) {
        await onApplyPack(pack);
        setNotice(`${pack.name} applied.`);
      } else {
        setNotice(`${pack.name} installed.`);
      }
    } catch (err: any) {
      setNotice(err?.message || 'Failed to install theme pack.');
    } finally {
      setBusyPackId(null);
    }
  };

  const handleUninstall = async (item: ThemePackManifestItem) => {
    setBusyPackId(item.id);
    try {
      await uninstallThemePack(item.id);
      setInstalledIds(getInstalledThemePacksSync().map(p => p.id));
      if (activePackId === item.id) {
        await onPackUninstalled?.(item.id);
      }
      setNotice(`${item.name} uninstalled.`);
    } finally {
      setBusyPackId(null);
    }
  };

  const detailPack = selectedItem ? getPreviewPackSync(selectedItem.id) : null;
  const isDetailInstalled = selectedItem ? installedSet.has(selectedItem.id) : false;
  const isDetailActive = selectedItem ? activePackId === selectedItem.id : false;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      fullScreen
      sheetStyle={{ paddingHorizontal: 16 }}
    >
      {/* Store Header */}
      <View style={styles.headerRow}>
        {selectedItem ? (
          <TouchableOpacity
            onPress={() => setSelectedItem(null)}
            style={[styles.iconBtn, { backgroundColor: palette.bgSurfaceSubtle }]}
            activeOpacity={0.75}
          >
            <ArrowLeft size={17} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View style={[styles.iconBtn, { backgroundColor: `rgba(${palette.accentRgb}, 0.16)` }]}>
            <Palette size={17} color={palette.accent} />
          </View>
        )}

        <View style={{ flex: 1, marginHorizontal: 10 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {selectedItem ? selectedItem.name : 'Theme Store'}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {selectedItem
              ? `by @${selectedItem.author} • v${selectedItem.version}`
              : `${catalog.length} optional themes • GitHub synced`}
          </Text>
        </View>

        {!selectedItem && (
          <TouchableOpacity
            onPress={handleRefresh}
            disabled={refreshing}
            style={[styles.iconBtn, { backgroundColor: palette.bgSurfaceSubtle, marginRight: 8 }]}
            activeOpacity={0.75}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={palette.accent} />
            ) : (
              <RefreshCw size={15} color={palette.accent} />
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={onClose}
          style={[styles.iconBtn, { backgroundColor: palette.bgSurfaceSubtle }]}
          activeOpacity={0.75}
        >
          <X size={17} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {notice ? (
        <View
          style={[
            styles.noticeBanner,
            {
              backgroundColor: `rgba(${palette.accentRgb}, 0.12)`,
              borderColor: `rgba(${palette.accentRgb}, 0.35)`,
            },
          ]}
        >
          <Sparkles size={13} color={palette.accent} />
          <Text style={[styles.noticeText, { color: palette.accent }]} numberOfLines={2}>
            {notice}
          </Text>
        </View>
      ) : null}

      <Animated.View style={{ flex: 1, opacity: viewFadeAnim }}>
        {!selectedItem ? (
          <>
            {/* Filter Chips */}
            <View style={styles.filterRow}>
              {FILTER_TAGS.map(tag => {
                const isSelected = selectedFilter === tag;
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => setSelectedFilter(tag)}
                    activeOpacity={0.8}
                    style={[
                      styles.filterChip,
                      {
                        borderRadius: skin.pillRadius,
                        backgroundColor: isSelected ? palette.accent : palette.bgSurfaceSubtle,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: isSelected ? '#0B0D12' : '#CBD5E1' },
                      ]}
                    >
                      {tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <BottomSheetScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {filteredCatalog.length === 0 ? (
                <View style={[styles.emptyBox, { backgroundColor: palette.bgSurface }]}>
                  <Text style={styles.emptyTitle}>No themes in &ldquo;{selectedFilter}&rdquo;</Text>
                  <Text style={styles.emptyDesc}>
                    Tap All to browse every theme pack or install one to see it here.
                  </Text>
                </View>
              ) : (
                filteredCatalog.map(item => {
                  const isInstalled = installedSet.has(item.id);
                  const isActive = activePackId === item.id;
                  const isBusy = busyPackId === item.id;
                  const previewPack = getPreviewPackSync(item.id);

                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.85}
                      onPress={() => setSelectedItem(item)}
                      style={[
                        styles.themeCard,
                        {
                          backgroundColor: palette.bgSurface,
                          borderRadius: skin.cardRadius,
                          borderColor: isActive
                            ? palette.accent
                            : 'rgba(255, 255, 255, 0.1)',
                        },
                      ]}
                    >
                      <ThemeLivePreview item={item} packDetail={previewPack} />

                      <View style={styles.cardBody}>
                        <View style={styles.cardTitleRow}>
                          <Text style={styles.cardTitle} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <View
                            style={[
                              styles.skinPill,
                              { backgroundColor: palette.bgSurfaceSubtle },
                            ]}
                          >
                            <Text style={styles.skinPillText}>
                              {BASE_SKIN_LABELS[item.baseSkin] || item.baseSkin}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.cardDesc} numberOfLines={2}>
                          {item.description}
                        </Text>

                        <View style={styles.cardFooterRow}>
                          <View style={{ flex: 1 }}>
                            <View style={styles.swatchesRow}>
                              {item.previewSwatches.map((hex, i) => (
                                <View
                                  key={`${item.id}-sw-${i}`}
                                  style={[styles.swatchDot, { backgroundColor: hex }]}
                                />
                              ))}
                              <Text style={styles.motionText} numberOfLines={1}>
                                {item.motionSummary}
                              </Text>
                            </View>
                          </View>

                          <TouchableOpacity
                            disabled={isBusy}
                            onPress={() => {
                              if (!isActive) {
                                void handleInstallOrApply(item, true);
                              }
                            }}
                            activeOpacity={0.82}
                            style={[
                              styles.actionBtn,
                              {
                                borderRadius: Math.min(18, skin.buttonRadius),
                                backgroundColor: isActive
                                  ? `rgba(${palette.accentRgb}, 0.18)`
                                  : isInstalled
                                    ? palette.bgSurfaceSubtle
                                    : palette.accent,
                                borderColor: isActive ? palette.accent : 'transparent',
                                borderWidth: isActive ? 1 : 0,
                              },
                            ]}
                          >
                            {isBusy ? (
                              <ActivityIndicator
                                size="small"
                                color={isInstalled ? palette.accent : '#0A0D12'}
                              />
                            ) : isActive ? (
                              <>
                                <Check size={13} color={palette.accent} />
                                <Text style={[styles.actionBtnText, { color: palette.accent }]}>
                                  Active
                                </Text>
                              </>
                            ) : isInstalled ? (
                              <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>
                                Apply
                              </Text>
                            ) : (
                              <>
                                <Download size={13} color="#0A0D12" />
                                <Text style={[styles.actionBtnText, { color: '#0A0D12' }]}>
                                  Install
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </BottomSheetScrollView>
          </>
        ) : (
          <BottomSheetScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <ThemeLivePreview item={selectedItem} packDetail={detailPack} large />

            <View style={[styles.detailCard, { backgroundColor: palette.bgSurface, borderRadius: skin.cardRadius }]}>
              <Text style={styles.detailDesc}>{selectedItem.description}</Text>

              <View style={styles.tagRow}>
                <View style={[styles.metaChip, { backgroundColor: palette.bgSurfaceSubtle }]}>
                  <Text style={styles.metaChipText}>
                    Base: {BASE_SKIN_LABELS[selectedItem.baseSkin] || selectedItem.baseSkin}
                  </Text>
                </View>
                {selectedItem.tags.map(tag => (
                  <View
                    key={tag}
                    style={[styles.metaChip, { backgroundColor: `rgba(${palette.accentRgb}, 0.14)` }]}
                  >
                    <Text style={[styles.metaChipText, { color: palette.accent }]}>#{tag}</Text>
                  </View>
                ))}
              </View>

              {/* Specs Grid */}
              <View style={styles.specsGrid}>
                <View style={[styles.specCell, { backgroundColor: palette.bgSurfaceSubtle }]}>
                  <Text style={styles.specLabel}>ANIMATION</Text>
                  <Text style={styles.specValue}>{selectedItem.motionSummary}</Text>
                  <Text style={styles.specSub}>
                    Mode: {detailPack?.animation?.mode || 'spring'} • Easing:{' '}
                    {Array.isArray(detailPack?.animation?.easing)
                      ? 'custom bezier'
                      : detailPack?.animation?.easing || 'default'}
                  </Text>
                </View>

                <View style={[styles.specCell, { backgroundColor: palette.bgSurfaceSubtle }]}>
                  <Text style={styles.specLabel}>GEOMETRY</Text>
                  <Text style={styles.specValue}>
                    Card {detailPack?.geometry?.cardRadius ?? 20}px • Bubble{' '}
                    {detailPack?.geometry?.bubbleRadius ?? 20}px
                  </Text>
                  <Text style={styles.specSub}>
                    Sheet {detailPack?.geometry?.sheetRadius ?? 26}px • Surface:{' '}
                    {detailPack?.surfaces?.surfaceMode || 'skin default'}
                  </Text>
                </View>
              </View>

              {/* Swatches Row */}
              <Text style={[styles.specLabel, { marginTop: 14, marginBottom: 8 }]}>PALETTE SWATCHES</Text>
              <View style={styles.detailSwatches}>
                {selectedItem.previewSwatches.map((hex, i) => (
                  <View key={`d-sw-${i}`} style={[styles.detailSwatchItem, { backgroundColor: palette.bgSurfaceSubtle }]}>
                    <View style={[styles.detailSwatchColor, { backgroundColor: hex }]} />
                    <Text style={styles.detailSwatchHex}>{hex}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Primary Install / Apply / Uninstall Controls */}
            <View style={styles.detailActions}>
              <TouchableOpacity
                disabled={busyPackId === selectedItem.id || isDetailActive}
                onPress={() => void handleInstallOrApply(selectedItem, true)}
                activeOpacity={0.85}
                style={[
                  styles.primaryDetailBtn,
                  {
                    borderRadius: skin.buttonRadius,
                    backgroundColor: isDetailActive
                      ? `rgba(${palette.accentRgb}, 0.2)`
                      : palette.accent,
                    borderWidth: isDetailActive ? 1 : 0,
                    borderColor: palette.accent,
                  },
                ]}
              >
                {busyPackId === selectedItem.id ? (
                  <ActivityIndicator size="small" color={isDetailActive ? palette.accent : '#0A0D12'} />
                ) : isDetailActive ? (
                  <>
                    <Check size={16} color={palette.accent} />
                    <Text style={[styles.primaryDetailBtnText, { color: palette.accent }]}>
                      Currently Active
                    </Text>
                  </>
                ) : isDetailInstalled ? (
                  <>
                    <Check size={16} color="#0A0D12" />
                    <Text style={[styles.primaryDetailBtnText, { color: '#0A0D12' }]}>
                      Apply Theme Now
                    </Text>
                  </>
                ) : (
                  <>
                    <Download size={16} color="#0A0D12" />
                    <Text style={[styles.primaryDetailBtnText, { color: '#0A0D12' }]}>
                      Install & Apply Theme
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {isDetailInstalled && (
                <TouchableOpacity
                  disabled={busyPackId === selectedItem.id}
                  onPress={() => void handleUninstall(selectedItem)}
                  activeOpacity={0.8}
                  style={[
                    styles.uninstallBtn,
                    { borderRadius: skin.buttonRadius },
                  ]}
                >
                  <Trash2 size={16} color="#FB7185" />
                  <Text style={styles.uninstallBtnText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          </BottomSheetScrollView>
        )}
      </Animated.View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 11.5,
    marginTop: 1,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 28,
    gap: 12,
  },
  emptyBox: {
    padding: 20,
    borderRadius: 18,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyDesc: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
  },
  themeCard: {
    borderWidth: 1.25,
    padding: 12,
    gap: 10,
  },
  previewBox: {
    overflow: 'hidden',
    borderWidth: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  previewInner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  previewMiniHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewAvatarDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  previewBar: {
    height: 8,
    borderRadius: 4,
  },
  previewBadgePill: {
    marginLeft: 'auto',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
  },
  previewBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  previewBubblesArea: {
    gap: 5,
    marginVertical: 4,
  },
  previewAiBubble: {
    alignSelf: 'flex-start',
    width: '68%',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 1,
  },
  previewUserBubble: {
    alignSelf: 'flex-end',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 1,
  },
  previewLine: {
    height: 5,
    borderRadius: 3,
  },
  previewMiniDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
  },
  previewDockPill: {
    width: 24,
    height: 7,
  },
  previewDockDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  cardBody: {
    gap: 6,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  skinPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  skinPillText: {
    color: '#CBD5E1',
    fontSize: 10.5,
    fontWeight: '700',
  },
  cardDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  swatchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  swatchDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  motionText: {
    color: '#94A3B8',
    fontSize: 11,
    marginLeft: 4,
    flexShrink: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  detailCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  detailDesc: {
    color: '#E2E8F0',
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 12,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  metaChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metaChipText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  specsGrid: {
    gap: 8,
  },
  specCell: {
    padding: 11,
    borderRadius: 12,
  },
  specLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 3,
  },
  specValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  specSub: {
    color: '#94A3B8',
    fontSize: 11.5,
    marginTop: 2,
  },
  detailSwatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailSwatchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  detailSwatchColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  detailSwatchHex: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  detailActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryDetailBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
  },
  primaryDetailBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  uninstallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: 'rgba(251, 113, 133, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.35)',
  },
  uninstallBtnText: {
    color: '#FB7185',
    fontSize: 13,
    fontWeight: '700',
  },
});
