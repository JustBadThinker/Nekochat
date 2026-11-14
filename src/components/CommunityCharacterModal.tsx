/**
 * CommunityCharacterModal.tsx
 * Strictly ported from Warden AI (c:\Users\kanto\Documents\Work\Apps\Wardenai\src\components\character\CommunityCharacterModal.tsx)
 * Matches Gambar 3 community character modal with 100% fidelity.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Platform,
  Linking,
  Animated,
  Easing,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import {
  X,
  Play,
  Heart,
  MessageSquare,
  Coins,
  CheckCircle2,
  Download,
  ExternalLink,
  UserCheck,
  UserPlus,
  Sparkles,
  ChevronDown,
} from 'lucide-react-native';
import { CommunityCharacter, CommunityCharacterDetail, Character } from '../types';
import { communityCatalogService } from '../services/communityCatalogService';
import { storageService } from '../services/storageService';
import { RichHtmlRenderer } from './RichHtmlRenderer';
import { GLASS } from '../theme/glassTheme';
import { LinearGradient } from 'expo-linear-gradient';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface GreetingAccordionItemProps {
  title: string;
  greet: string;
  isExpanded: boolean;
  onToggle: () => void;
  onStartWithGreeting: () => void;
}

const GreetingAccordionItem: React.FC<GreetingAccordionItemProps> = ({
  title,
  greet,
  isExpanded,
  onToggle,
  onStartWithGreeting,
}) => {
  const rotateAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const bodyFadeAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const bodySlideAnim = useRef(new Animated.Value(isExpanded ? 0 : -6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(rotateAnim, {
        toValue: isExpanded ? 1 : 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(bodyFadeAnim, {
        toValue: isExpanded ? 1 : 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(bodySlideAnim, {
        toValue: isExpanded ? 0 : -6,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [isExpanded, rotateAnim, bodyFadeAnim, bodySlideAnim]);

  const chevronRotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const preview = greet
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <View
      style={[
        styles.descCard,
        {
          marginBottom: 10,
          borderColor: isExpanded ? 'rgba(212, 255, 0, 0.35)' : '#1e2436',
        },
      ]}
    >
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        <View style={styles.accordionTitleWrap}>
          <Animated.View
            style={{
              marginRight: 6,
              transform: [{ rotate: chevronRotate }],
            }}
          >
            <ChevronDown size={16} color={isExpanded ? '#d4ff00' : '#9ca3af'} />
          </Animated.View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.altGreetTitle,
                { color: isExpanded ? '#d4ff00' : '#f1f5f9' },
              ]}
            >
              {title}
            </Text>
            {!isExpanded && preview.length > 0 && (
              <Text style={styles.accordionPreview} numberOfLines={1}>
                {preview}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.altChatBtn}
          onPress={onStartWithGreeting}
          activeOpacity={0.8}
        >
          <Play size={10} color="#000000" fill="#000000" style={{ marginRight: 3 }} />
          <Text style={[styles.altChatBtnText, { color: '#000000' }]}>Chat</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {isExpanded && (
        <Animated.View
          style={[
            styles.accordionBody,
            {
              opacity: bodyFadeAnim,
              transform: [{ translateY: bodySlideAnim }],
            },
          ]}
        >
          <RichHtmlRenderer content={greet} baseColor="#f1f5f9" />
        </Animated.View>
      )}
    </View>
  );
};

interface CommunityCharacterModalProps {
  character: CommunityCharacter | Character | null;
  visible: boolean;
  onClose: () => void;
  onStartChat: (character: any, detail?: CommunityCharacterDetail) => void;
  onImport?: (character: any, detail?: CommunityCharacterDetail) => void;
  onToggleFavorite?: (character: any, nextState?: boolean) => void;
  onTagClick?: (tagName: string) => void;
  onCreatorClick?: (creatorName: string, creatorId?: string) => void;
  onFollowChange?: () => void;
}

export const CommunityCharacterModal: React.FC<CommunityCharacterModalProps> = ({
  character,
  visible,
  onClose,
  onStartChat,
  onImport,
  onToggleFavorite,
  onTagClick,
  onCreatorClick,
  onFollowChange,
}) => {
  const [detail, setDetail] = useState<CommunityCharacterDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'scenario' | 'greeting' | 'gallery'>('overview');
  const [expandedGreetingIdx, setExpandedGreetingIdx] = useState<number | null>(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [imgError, setImgError] = useState(false);
  const tabFadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    tabFadeAnim.setValue(0);
    Animated.timing(tabFadeAnim, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeTab, tabFadeAnim]);

  const creatorName = character
    ? ('creatorName' in character ? character.creatorName : character.creator) || 'community'
    : 'community';

  const avatarUrl = character
    ? ('avatarUrl' in character ? character.avatarUrl : character.avatar) || ''
    : '';

  const cleanHandle = creatorName.replace(/^@/, '');

  useEffect(() => {
    if (character && visible) {
      setActiveTab('overview');
      setExpandedGreetingIdx(0);
      setImgError(false);

      storageService.isFollowingCreator(creatorName).then(setIsFollowing);
      storageService.isCommunityFavorite(character.id).then(setIsFav);

      communityCatalogService.getCharacterDetail(character.id).then(d => {
        setDetail(d);
      });
    } else {
      setDetail(null);
    }
  }, [character?.id, visible]);

  if (!character || !visible) return null;

  const handleToggleFollow = async () => {
    const next = await storageService.toggleFollowCreator(creatorName);
    setIsFollowing(next);
    onFollowChange?.();
  };

  const handleToggleFav = async () => {
    const next = await storageService.toggleCommunityFavorite(character as any);
    setIsFav(next);
    if (onToggleFavorite) onToggleFavorite(character, next);
  };

  const formatCount = (num: number) => {
    if (!num) return '0';
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num.toString();
  };

  const tokens = ('totalTokens' in character && character.totalTokens) ? character.totalTokens : 2200;
  const favorites = ('favoritesCount' in character && character.favoritesCount) ? character.favoritesCount : 5;
  const chats = ('chatCount' in character && character.chatCount)
    ? character.chatCount
    : ('totalChats' in character && character.totalChats)
    ? character.totalChats
    : 10;

  const tags = character.tags || [];
  const alternateGreetings = detail?.alternateGreetings || [];
  const scenarioText =
    (detail?.scenario || ('scenario' in character ? character.scenario : '') || '').trim();
  const overviewHtml =
    detail?.descriptionHtml ||
    ('description' in character ? character.description : '') ||
    detail?.shortDescription ||
    ('shortDescription' in character ? character.shortDescription : '') ||
    detail?.personality ||
    'JanitorAI-compatible character ready to roleplay.';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.modalCard} activeOpacity={1} onPress={(e: any) => e.stopPropagation?.()}>
          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* 1. TOP HERO ARTWORK BANNER (Matches Gambar 3)                       */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <View style={styles.heroBanner}>
            {!imgError && avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.heroImage}
                onError={() => setImgError(true)}
              />
            ) : (
              <View style={styles.heroFallback}>
                <Text style={styles.heroFallbackText}>{character.name.charAt(0)}</Text>
              </View>
            )}

            {/* Progressive Gradient Scrims */}
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(10, 12, 18, 0.78)', 'rgba(10, 12, 18, 0.32)', 'transparent']}
              locations={[0, 0.5, 1]}
              style={styles.heroTopScrim}
            />
            <LinearGradient
              pointerEvents="none"
              colors={[
                'transparent',
                'rgba(14, 17, 28, 0.42)',
                'rgba(14, 17, 28, 0.86)',
                'rgba(14, 17, 28, 0.98)',
              ]}
              locations={[0, 0.35, 0.75, 1]}
              style={styles.heroBottomScrim}
            />

            {/* Top-Left Badges: [ 18+ NSFW ] & [ 🔗 2.2k tokens ] */}
            <View style={styles.heroTopLeftBadges}>
              <View style={styles.nsfwPill}>
                <Text style={styles.nsfwPillText}>18+ NSFW</Text>
              </View>

              <View style={styles.tokensPill}>
                <Coins size={11} color="#d8b4fe" style={{ marginRight: 4 }} />
                <Text style={styles.tokensPillText}>{formatCount(tokens)} tokens</Text>
              </View>
            </View>

            {/* Top-Right Action Buttons: [ ▶ Chat ] [ 📥 ] [ ✕ ] */}
            <View style={styles.heroTopRightButtons}>
              <TouchableOpacity
                style={styles.heroChatBtn}
                onPress={() => {
                  onStartChat(character, detail || undefined);
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Play size={12} color="#000000" fill="#000000" style={{ marginRight: 4 }} />
                <Text style={styles.heroChatBtnText}>Chat</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.heroCircleBtn}
                onPress={() => {
                  if (avatarUrl) Linking.openURL(avatarUrl).catch(() => {});
                }}
                activeOpacity={0.7}
                accessibilityLabel="Download Card Artwork"
              >
                <Download size={15} color="#d8b4fe" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.heroCircleBtn}
                onPress={onClose}
                activeOpacity={0.7}
                accessibilityLabel="Close"
              >
                <X size={17} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Bottom Character Identity inside Hero */}
            <View style={styles.heroIdentity}>
              <Text style={styles.heroCharName} numberOfLines={2}>
                {character.name}
              </Text>

              <View style={styles.heroSubRow}>
                <TouchableOpacity
                  style={styles.creatorAttribution}
                  activeOpacity={0.75}
                  disabled={!onCreatorClick}
                  onPress={() => {
                    const resolvedCreatorId =
                      detail?.creatorId ||
                      ('creatorId' in character ? character.creatorId : undefined);
                    onCreatorClick?.(cleanHandle, resolvedCreatorId);
                  }}
                >
                  <Text style={styles.subTextBy}>by</Text>
                  <Text style={[styles.subTextCreator, onCreatorClick && { textDecorationLine: 'underline' }]}>
                    @{cleanHandle}
                  </Text>
                  <CheckCircle2 size={13} color="#d4ff00" style={{ marginLeft: 3 }} />
                </TouchableOpacity>

                {/* Follow @creator button */}
                <TouchableOpacity
                  style={[styles.heroFollowBtn, isFollowing && styles.heroFollowBtnActive]}
                  onPress={handleToggleFollow}
                  activeOpacity={0.8}
                >
                  {isFollowing ? (
                    <UserCheck size={11} color="#FFFFFF" style={{ marginRight: 3 }} />
                  ) : (
                    <UserPlus size={11} color="#FFFFFF" style={{ marginRight: 3 }} />
                  )}
                  <Text style={styles.heroFollowBtnText}>
                    {isFollowing ? 'Following' : `Follow @${cleanHandle}`}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.dotSeparator}>•</Text>

                <View style={styles.statInline}>
                  <Heart size={12} color="#f43f5e" fill="#f43f5e" style={{ marginRight: 3 }} />
                  <Text style={styles.statInlineText}>{formatCount(favorites)} favorites</Text>
                </View>

                <Text style={styles.dotSeparator}>•</Text>

                <View style={styles.statInline}>
                  <MessageSquare size={12} color="#9ca3af" style={{ marginRight: 3 }} />
                  <Text style={styles.statInlineText}>{formatCount(chats)} chats</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* 2. NAVIGATION TABS BAR (Matches Gambar 3)                           */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <View style={styles.tabsBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'overview' && styles.tabBtnActive]}
                onPress={() => setActiveTab('overview')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabBtnText, activeTab === 'overview' && styles.tabBtnTextActive]}>
                  Overview
                </Text>
              </TouchableOpacity>

              {scenarioText.length > 0 && (
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === 'scenario' && styles.tabBtnActive]}
                  onPress={() => setActiveTab('scenario')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabBtnText, activeTab === 'scenario' && styles.tabBtnTextActive]}>
                    Scenario
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'greeting' && styles.tabBtnActive]}
                onPress={() => setActiveTab('greeting')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabBtnText, activeTab === 'greeting' && styles.tabBtnTextActive]}>
                  Greeting Message{alternateGreetings.length > 0 ? ` (${1 + alternateGreetings.length})` : ''}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'gallery' && styles.tabBtnActive]}
                onPress={() => setActiveTab('gallery')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabBtnText, activeTab === 'gallery' && styles.tabBtnTextActive]}>
                  Gallery
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={styles.datacatLink}
              onPress={() => {
                Linking.openURL(`https://datacat.run/characters/${character.id}`).catch(() => {});
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.datacatLinkText}>Datacat Source</Text>
              <ExternalLink size={11} color="#d4ff00" style={{ marginLeft: 3 }} />
            </TouchableOpacity>
          </View>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* 3. SCROLLABLE TAB CONTENT AREA (Matches Gambar 3)                   */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentInner}>
            <Animated.View style={{ opacity: tabFadeAnim }}>
            {activeTab === 'overview' && (
              <View style={styles.overviewSection}>
                {/* Tag Chips Strip */}
                <View style={styles.tagChipsWrap}>
                  {tags.map((t: any, i: number) => {
                    const name = typeof t === 'string' ? t : t.name;
                    const clean = name.replace(/^[^\w\s]+/, '').trim();
                    return (
                      <TouchableOpacity
                        key={i}
                        style={styles.overviewTagChip}
                        onPress={() => onTagClick?.(clean)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.overviewTagText}>#{clean}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Section Header: DESCRIPTION */}
                <Text style={styles.sectionHeading}>DESCRIPTION</Text>

                {/* Inner Card with Rich HTML/Markdown Description (left/center/right text & inline images) */}
                <View style={styles.descCard}>
                  <RichHtmlRenderer content={overviewHtml} />
                </View>
              </View>
            )}

            {activeTab === 'scenario' && (
              <View style={styles.overviewSection}>
                <Text style={styles.sectionHeading}>ROLEPLAY SCENARIO & CONTEXT</Text>
                <View style={styles.descCard}>
                  <RichHtmlRenderer content={scenarioText} />
                </View>
              </View>
            )}

            {activeTab === 'greeting' && (() => {
              const defaultGreet =
                detail?.firstMessage ||
                ('firstMessage' in character ? character.firstMessage : '') ||
                `*${character.name} looks over at you quietly.* "Hello there. What brings you here?"`;
              const allGreetings = [defaultGreet, ...alternateGreetings];

              return (
                <View style={styles.overviewSection}>
                  <Text style={styles.sectionHeading}>
                    GREETING MESSAGES ({allGreetings.length})
                  </Text>
                  {allGreetings.map((greet, idx) => (
                    <GreetingAccordionItem
                      key={idx}
                      title={idx === 0 ? 'Greeting #1 (Default)' : `Alternate Greeting #${idx}`}
                      greet={greet}
                      isExpanded={expandedGreetingIdx === idx}
                      onToggle={() => {
                        LayoutAnimation.configureNext({
                          duration: 220,
                          update: { type: LayoutAnimation.Types.easeInEaseOut },
                          create: {
                            type: LayoutAnimation.Types.easeInEaseOut,
                            property: LayoutAnimation.Properties.opacity,
                          },
                          delete: {
                            type: LayoutAnimation.Types.easeInEaseOut,
                            property: LayoutAnimation.Properties.opacity,
                          },
                        });
                        setExpandedGreetingIdx(prev => (prev === idx ? null : idx));
                      }}
                      onStartWithGreeting={() => {
                        const customDetail = {
                          ...(detail || (character as any)),
                          firstMessage: greet,
                        };
                        onStartChat(character, customDetail);
                        onClose();
                      }}
                    />
                  ))}
                </View>
              );
            })()}

            {activeTab === 'gallery' && (() => {
              const galleryItems: Array<{ url: string; label: string }> = [];
              const seen = new Set<string>();
              const addGalleryUrl = (rawUrl?: string, label?: string) => {
                const cleaned = (rawUrl || '').trim().replace(/&amp;/g, '&');
                if (!cleaned || !/^https?:\/\//i.test(cleaned) || seen.has(cleaned)) return;
                seen.add(cleaned);
                galleryItems.push({ url: cleaned, label: label || `Description Media ${galleryItems.length}` });
              };

              addGalleryUrl(avatarUrl, 'Original Avatar HD');

              const descHtml = detail?.descriptionHtml || '';
              const htmlImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
              let m: RegExpExecArray | null;
              while ((m = htmlImgRegex.exec(descHtml)) !== null) {
                addGalleryUrl(m[1], `Artwork #${galleryItems.length}`);
              }
              const mdImgRegex = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi;
              while ((m = mdImgRegex.exec(descHtml)) !== null) {
                addGalleryUrl(m[2], m[1]?.trim() || `Artwork #${galleryItems.length}`);
              }

              return (
                <View style={styles.overviewSection}>
                  <Text style={styles.sectionHeading}>
                    CHARACTER MEDIA GALLERY ({galleryItems.length})
                  </Text>
                  <View style={styles.galleryGrid}>
                    {galleryItems.map((item, idx) => (
                      <TouchableOpacity
                        key={`${item.url}-${idx}`}
                        style={styles.galleryCard}
                        onPress={() => Linking.openURL(item.url).catch(() => {})}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri: item.url }} style={styles.galleryImage} />
                        <View style={styles.galleryOverlay}>
                          <Text style={styles.galleryLabel} numberOfLines={1}>{item.label}</Text>
                          <Download size={13} color="#d4ff00" />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })()}
            </Animated.View>
          </ScrollView>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* 4. STICKY BOTTOM ACTION FOOTER (Matches Gambar 3)                   */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <View style={styles.footerBar}>
            <View style={styles.footerLeftGroup}>
              {/* Heart Favorite Button */}
              <TouchableOpacity
                style={[styles.footerHeartBtn, isFav && styles.footerHeartBtnActive]}
                onPress={handleToggleFav}
                activeOpacity={0.7}
              >
                <Heart
                  size={16}
                  color={isFav ? '#f43f5e' : '#9ca3af'}
                  fill={isFav ? '#f43f5e' : 'transparent'}
                />
              </TouchableOpacity>

              {/* Import Card Button */}
              <TouchableOpacity
                style={styles.footerImportBtn}
                onPress={() => {
                  onImport?.(character, detail || undefined);
                }}
                activeOpacity={0.8}
              >
                <Download size={14} color="#d4ff00" style={{ marginRight: 6 }} />
                <Text style={styles.footerImportBtnText}>Import Card</Text>
              </TouchableOpacity>
            </View>

            {/* Glowing Wide Acid Lime Button: Start Roleplay Now */}
            <TouchableOpacity
              style={styles.footerStartBtn}
              onPress={() => {
                onStartChat(character, detail || undefined);
                onClose();
              }}
              activeOpacity={0.85}
            >
              <Play size={14} color="#000000" fill="#000000" style={{ marginRight: 6 }} />
              <Text style={styles.footerStartBtnText}>Start Roleplay Now</Text>
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
    backgroundColor: 'rgba(6, 8, 14, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 14,
    ...GLASS.backdrop,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '94%',
    backgroundColor: GLASS.bgModal,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: GLASS.borderBright,
    overflow: 'hidden',
    flex: 1,
    ...GLASS.backdropStrong,
    ...GLASS.shadow,
  },
  heroBanner: {
    width: '100%',
    height: 190,
    backgroundColor: '#0c0e14',
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#161324',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFallbackText: {
    fontSize: 48,
    fontWeight: '800',
    color: '#d4ff00',
  },
  heroTopScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
  },
  heroBottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  heroTopLeftBadges: {
    position: 'absolute',
    top: 12,
    left: 14,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nsfwPill: {
    backgroundColor: '#e11d48',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  nsfwPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  tokensPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  tokensPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#d8b4fe',
  },
  heroTopRightButtons: {
    position: 'absolute',
    top: 12,
    right: 14,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d4ff00',
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: 20,
    shadowColor: '#d4ff00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  heroChatBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#000000',
  },
  heroCircleBtn: {
    width: 29,
    height: 29,
    borderRadius: 14.5,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIdentity: {
    position: 'absolute',
    bottom: 10,
    left: 14,
    right: 14,
    zIndex: 10,
  },
  heroCharName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  heroSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  creatorAttribution: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subTextBy: {
    fontSize: 10.5,
    color: '#9ca3af',
    marginRight: 3,
  },
  subTextCreator: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroFollowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  heroFollowBtnActive: {
    backgroundColor: '#d4ff00',
    borderColor: '#d4ff00',
  },
  heroFollowBtnText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dotSeparator: {
    fontSize: 11,
    color: '#6b7280',
  },
  statInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statInlineText: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '500',
  },
  tabsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GLASS.bgSubtle,
    borderBottomWidth: 1,
    borderBottomColor: GLASS.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tabsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tabBtn: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#d4ff00',
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
  },
  tabBtnTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  datacatLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
  },
  datacatLinkText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#d4ff00',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#10131c',
  },
  modalContentInner: {
    padding: 14,
    paddingBottom: 24,
  },
  overviewSection: {},
  tagChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 12,
  },
  overviewTagChip: {
    backgroundColor: '#181c28',
    borderWidth: 1,
    borderColor: '#222736',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  overviewTagText: {
    fontSize: 10,
    color: '#d1d5db',
    fontWeight: '500',
  },
  sectionHeading: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#9ca3af',
    letterSpacing: 0.8,
    marginBottom: 7,
  },
  descCard: {
    backgroundColor: GLASS.bgSubtle,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS.border,
    padding: 12,
    ...GLASS.backdrop,
  },
  embeddedArtworkWrapper: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: '#0c0e14',
  },
  embeddedArtwork: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  descBodyText: {
    fontSize: 11.5,
    lineHeight: 17,
    color: '#d1d5db',
  },
  greetingMessageText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#e2e8f0',
    fontStyle: 'italic',
  },
  altGreetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2334',
    paddingBottom: 6,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  accordionTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  accordionPreview: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  accordionBody: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e2334',
  },
  altGreetTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d4ff00',
  },
  altChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 255, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  altChatBtnText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#d4ff00',
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  galleryCard: {
    width: '48%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#141824',
    borderWidth: 1,
    borderColor: '#1e2334',
    position: 'relative',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  galleryOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  galleryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: GLASS.border,
    backgroundColor: GLASS.bg,
    gap: 10,
    ...GLASS.backdrop,
  },
  footerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerHeartBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#181c28',
    borderWidth: 1,
    borderColor: '#222736',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerHeartBtnActive: {
    borderColor: 'rgba(244, 63, 94, 0.5)',
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
  },
  footerImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181c28',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  footerImportBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footerStartBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d4ff00',
    paddingVertical: 9.5,
    borderRadius: 10,
    shadowColor: '#d4ff00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
  footerStartBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
});
