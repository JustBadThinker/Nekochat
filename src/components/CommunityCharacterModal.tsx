/**
 * Community Character Detail Modal
 * Adapted from Warden AI (CommunityCharacterModal.tsx).
 * Features rich overview, first message preview, creator follow, and instant chat transition.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import {
  X,
  Play,
  Heart,
  MessageSquare,
  Sparkles,
  UserCheck,
  UserPlus,
  Coins,
  Download,
  Share2,
} from 'lucide-react-native';
import { Character } from '../types';
import { storageService } from '../services/storageService';

interface CommunityCharacterModalProps {
  character: Character | null;
  visible: boolean;
  onClose: () => void;
  onStartChat: (character: Character) => void;
  onToggleFavorite?: (character: Character) => void;
}

export const CommunityCharacterModal: React.FC<CommunityCharacterModalProps> = ({
  character,
  visible,
  onClose,
  onStartChat,
  onToggleFavorite,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'greeting' | 'scenario'>('overview');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    if (character && visible) {
      setActiveTab('overview');
      storageService.isFollowingCreator(character.creator).then(setIsFollowing);
      storageService.isCommunityFavorite(character.id).then(setIsFav);
    }
  }, [character, visible]);

  if (!character || !visible) return null;

  const handleToggleFollow = async () => {
    const next = await storageService.toggleFollowCreator(character.creator);
    setIsFollowing(next);
  };

  const handleToggleFav = async () => {
    const next = await storageService.toggleCommunityFavorite(character);
    setIsFav(next);
    if (onToggleFavorite) onToggleFavorite(character);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          {/* Top Banner Artwork */}
          <View style={styles.bannerContainer}>
            <Image source={{ uri: character.avatar }} style={styles.bannerImage} />
            <View style={styles.bannerScrim} />

            {/* Pinned Top-Right Close Button */}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <X size={18} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Top Badges */}
            <View style={styles.bannerTopLeft}>
              <View style={styles.tagBadge}>
                <Text style={styles.tagBadgeText}>#{character.tags[0] || 'Anime'}</Text>
              </View>
            </View>

            {/* Character Title Info inside Scrim */}
            <View style={styles.bannerBottomInfo}>
              <Text style={styles.charName}>{character.name}</Text>
              <Text style={styles.charTagline} numberOfLines={1}>
                {character.tagline}
              </Text>
            </View>
          </View>

          {/* Creator & Social Action Strip */}
          <View style={styles.creatorStrip}>
            <View style={styles.creatorInfo}>
              <Text style={styles.creatorLabel}>Created by</Text>
              <Text style={styles.creatorHandle}>{character.creator}</Text>
            </View>

            <View style={styles.creatorActions}>
              <TouchableOpacity
                style={[styles.followBtn, isFollowing && styles.followBtnActive]}
                onPress={handleToggleFollow}
                activeOpacity={0.8}
              >
                {isFollowing ? (
                  <>
                    <UserCheck size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.followBtnText}>Following</Text>
                  </>
                ) : (
                  <>
                    <UserPlus size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.followBtnText}>Follow</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.iconRoundBtn, isFav && styles.iconRoundBtnFav]}
                onPress={handleToggleFav}
                activeOpacity={0.8}
              >
                <Heart
                  size={16}
                  color={isFav ? '#FF6B6B' : '#FFFFFF'}
                  fill={isFav ? '#FF6B6B' : 'transparent'}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Segmented Detail Tabs */}
          <View style={styles.tabsStrip}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'overview' && styles.tabBtnActive]}
              onPress={() => setActiveTab('overview')}
            >
              <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
                Overview
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'greeting' && styles.tabBtnActive]}
              onPress={() => setActiveTab('greeting')}
            >
              <Text style={[styles.tabText, activeTab === 'greeting' && styles.tabTextActive]}>
                First Message
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'scenario' && styles.tabBtnActive]}
              onPress={() => setActiveTab('scenario')}
            >
              <Text style={[styles.tabText, activeTab === 'scenario' && styles.tabTextActive]}>
                Scenario & Lore
              </Text>
            </TouchableOpacity>
          </View>

          {/* Scrollable Content */}
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {activeTab === 'overview' && (
              <View>
                <Text style={styles.sectionTitle}>Synopsis & Personality</Text>
                <Text style={styles.bodyParagraph}>
                  {character.personality || character.description}
                </Text>

                <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Tags & Tropes</Text>
                <View style={styles.tagsContainer}>
                  {character.tags.map((t, idx) => (
                    <View key={idx} style={styles.tagChip}>
                      <Text style={styles.tagChipText}>#{t}</Text>
                    </View>
                  ))}
                </View>

                {/* Community Stats */}
                <View style={styles.statsCard}>
                  <View style={styles.statCol}>
                    <MessageSquare size={14} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.statVal}>{character.totalChats || 140}</Text>
                    <Text style={styles.statSub}>Chats</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCol}>
                    <Coins size={14} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.statVal}>850</Text>
                    <Text style={styles.statSub}>Tokens</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCol}>
                    <Sparkles size={14} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.statVal}>100%</Text>
                    <Text style={styles.statSub}>Anime</Text>
                  </View>
                </View>
              </View>
            )}

            {activeTab === 'greeting' && (
              <View>
                <Text style={styles.sectionTitle}>Character's Opening Hook</Text>
                <View style={styles.greetingBox}>
                  <Text style={styles.greetingText}>
                    {character.firstMessage || '*Looks at you quietly.* "Hello."'}
                  </Text>
                </View>
                <Text style={styles.greetingHint}>
                  This is the exact greeting you will receive when initiating conversation.
                </Text>
              </View>
            )}

            {activeTab === 'scenario' && (
              <View>
                <Text style={styles.sectionTitle}>World Context & Roleplay Setting</Text>
                <View style={styles.scenarioBox}>
                  <Text style={styles.scenarioText}>
                    {character.scenario || character.description || 'No specific setting defined.'}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Sticky Bottom Actions */}
          <View style={styles.stickyFooter}>
            <TouchableOpacity
              style={styles.chatPrimaryBtn}
              onPress={() => {
                onClose();
                onStartChat(character);
              }}
              activeOpacity={0.8}
            >
              <Play size={15} color="#000000" fill="#000000" style={{ marginRight: 8 }} />
              <Text style={styles.chatPrimaryBtnText}>Start Roleplay Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0c0e14',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    height: '90%',
    overflow: 'hidden',
  },
  bannerContainer: {
    width: '100%',
    height: 190,
    position: 'relative',
    backgroundColor: '#000',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(12, 14, 20, 0.55)',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 9999,
  },
  bannerTopLeft: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  tagBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  tagBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  bannerBottomInfo: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
  },
  charName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  charTagline: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    marginTop: 2,
  },
  creatorStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#12151e',
  },
  creatorInfo: {
    flex: 1,
  },
  creatorLabel: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10,
  },
  creatorHandle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  creatorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  followBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderColor: '#FFFFFF',
  },
  followBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  iconRoundBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  iconRoundBtnFav: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderColor: '#FF6B6B',
  },
  tabsStrip: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  tabBtn: {
    paddingVertical: 8,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#FFFFFF',
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalScroll: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  bodyParagraph: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 13,
    lineHeight: 20,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagChipText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#12151e',
    borderRadius: 14,
    padding: 12,
    marginTop: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statCol: {
    alignItems: 'center',
  },
  statVal: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  statSub: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10,
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  greetingBox: {
    backgroundColor: '#12151e',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  greetingText: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  greetingHint: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
    marginTop: 8,
  },
  scenarioBox: {
    backgroundColor: '#12151e',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  scenarioText: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 20,
  },
  stickyFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#0c0e14',
  },
  chatPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 13,
    borderRadius: 16,
  },
  chatPrimaryBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
});
