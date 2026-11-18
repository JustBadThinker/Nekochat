import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import {
  X,
  ArrowLeft,
  BadgeCheck,
  UserPlus,
  UserCheck,
  Users,
  MessageSquare,
  Sparkles,
  Calendar,
  Search,
  ExternalLink,
} from 'lucide-react-native';
import { CommunityCharacter } from '../types';
import {
  communityCatalogService,
  CommunityCreatorProfile,
} from '../services/communityCatalogService';
import { storageService } from '../services/storageService';
import { RichHtmlRenderer } from './RichHtmlRenderer';
import { CommunityCharacterCard } from './CommunityCharacterCard';
import { GLASS } from '../theme/glassTheme';

const NEKO_THEME = {
  bg: '#0B0D14',
  surface: GLASS.bg,
  surfaceElevated: GLASS.bgSubtle,
  border: GLASS.border,
  accent: '#d4ff00',
  text: '#F9FAFB',
  textSecondary: '#D1D5DB',
  textMuted: '#9CA3AF',
};

interface CreatorProfileModalProps {
  visible: boolean;
  creatorName: string | null;
  creatorId?: string;
  initialAvatarUrl?: string;
  catalogSource?: 'janitor' | 'chub' | 'local_db';
  sfwOnly?: boolean;
  onClose: () => void;
  onSelectCharacter: (character: CommunityCharacter) => void;
  onStartChat: (character: CommunityCharacter) => void;
  onImport?: (character: CommunityCharacter) => void;
  onFollowChange?: () => void;
}

function formatCompactNumber(n?: number): string {
  const num = Number(n || 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return String(num);
}

function formatMemberSince(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const CreatorProfileModal: React.FC<CreatorProfileModalProps> = ({
  visible,
  creatorName,
  creatorId,
  initialAvatarUrl,
  catalogSource = 'janitor',
  sfwOnly = false,
  onClose,
  onSelectCharacter,
  onStartChat,
  onImport,
  onFollowChange,
}) => {
  const colors = NEKO_THEME;
  const [profile, setProfile] = useState<CommunityCreatorProfile | null>(null);
  const [characters, setCharacters] = useState<CommunityCharacter[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingChars, setLoadingChars] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'latest' | 'popular' | 'trending'>('latest');
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  const cleanHandle = (creatorName || '').replace(/^@+/, '').trim();

  useEffect(() => {
    if (!visible || !cleanHandle) return;
    let cancelled = false;

    const loadCreatorData = async () => {
      setSearchQuery('');
      setProfile({
        creatorId,
        userName: cleanHandle,
        avatarUrl: initialAvatarUrl,
      });
      setCharacters([]);
      setLoadingProfile(true);
      setLoadingChars(true);

      try {
        const [follows, favs] = await Promise.all([
          storageService.getFollowedCreators(),
          storageService.getCommunityFavorites(),
        ]);
        if (cancelled) return;
        setIsFollowing(
          follows.some(f => f.replace(/^@+/, '').toLowerCase() === cleanHandle.toLowerCase())
        );
        setFavoriteIds(favs.map(f => f.id));
      } catch {}

      try {
        const effectiveSource: 'janitor' | 'chub' = catalogSource === 'chub' ? 'chub' : 'janitor';
        const charsRes = await communityCatalogService.fetchCreatorCharacters(cleanHandle, {
          source: effectiveSource,
          limit: 48,
          sort: sortMode,
          sfwOnly,
        });
        if (cancelled) return;
        setCharacters(charsRes.characters || []);

        const resolvedId =
          creatorId || charsRes.characters?.find(c => Boolean(c.creatorId))?.creatorId;

        const prof = await communityCatalogService.fetchCreatorProfile(
          cleanHandle,
          resolvedId,
          effectiveSource
        );
        if (cancelled) return;
        setProfile(prev => ({
          ...prev,
          ...prof,
          avatarUrl: prof.avatarUrl || prev?.avatarUrl || charsRes.characters?.[0]?.avatarUrl,
        }));
      } catch {
        // Keep fallback profile
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
          setLoadingChars(false);
        }
      }
    };

    void loadCreatorData();

    return () => {
      cancelled = true;
    };
  }, [visible, cleanHandle, creatorId, initialAvatarUrl, catalogSource, sfwOnly, sortMode]);

  const handleToggleFollow = async () => {
    if (!cleanHandle) return;
    const next = await storageService.toggleFollowCreator(cleanHandle);
    setIsFollowing(next);
    onFollowChange?.();
  };

  const handleToggleFavorite = async (char: CommunityCharacter) => {
    const next = await storageService.toggleCommunityFavorite(char as any);
    setFavoriteIds(prev =>
      next ? [...new Set([...prev, char.id])] : prev.filter(id => id !== char.id)
    );
  };

  const filteredCharacters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return characters;
    return characters.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.shortDescription.toLowerCase().includes(q) ||
        c.tags?.some(t => t.name.toLowerCase().includes(q))
    );
  }, [characters, searchQuery]);

  if (!visible || !cleanHandle) return null;

  const avatarUri = profile?.avatarUrl || initialAvatarUrl || characters[0]?.avatarUrl;
  const memberSince = formatMemberSince(profile?.profileCreatedAt);
  const hasHtmlBio = Boolean(profile?.aboutMeHtml && profile.aboutMeHtml.trim().length > 0);
  const botCountDisplay = profile?.charCount || characters.length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Top Bar (NekoChat Theme) */}
        <View
          style={[
            styles.topBar,
            { backgroundColor: colors.surface, borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            activeOpacity={0.75}
          >
            <ArrowLeft size={18} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.topTitleWrap}>
            <View style={styles.topTitleRow}>
              <Text style={[styles.topTitle, { color: colors.text }]} numberOfLines={1}>
                @{profile?.userName || cleanHandle}
              </Text>
              {profile?.creatorVerified && (
                <BadgeCheck size={16} color={colors.accent} style={{ marginLeft: 5 }} />
              )}
            </View>
            <Text style={[styles.topSubtitle, { color: colors.textMuted }]}>
              {catalogSource === 'janitor' ? 'JanitorAI Creator' : 'Chub.ai Creator'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleToggleFollow}
            style={[
              styles.followBtn,
              {
                backgroundColor: isFollowing ? colors.accent : colors.surfaceElevated,
                borderColor: isFollowing ? colors.accent : colors.border,
              },
            ]}
            activeOpacity={0.8}
          >
            {isFollowing ? (
              <UserCheck size={14} color={colors.bg} />
            ) : (
              <UserPlus size={14} color={colors.text} />
            )}
            <Text
              style={[
                styles.followBtnText,
                { color: isFollowing ? colors.bg : colors.text },
              ]}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, marginLeft: 8 }]}
            activeOpacity={0.75}
          >
            <X size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Hero Card (Default NekoChat Theme) */}
          <View
            style={[
              styles.profileCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.profileHeaderRow}>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={[styles.avatar, { borderColor: colors.accent }]}
                />
              ) : (
                <View
                  style={[
                    styles.avatar,
                    styles.avatarFallback,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.accent },
                  ]}
                >
                  <Text style={[styles.avatarInitial, { color: colors.accent }]}>
                    {cleanHandle.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.profileMetaCol}>
                <View style={styles.handleRow}>
                  <Text style={[styles.handleText, { color: colors.text }]} numberOfLines={1}>
                    @{profile?.userName || cleanHandle}
                  </Text>
                  {profile?.creatorVerified && (
                    <BadgeCheck size={16} color={colors.accent} style={{ marginLeft: 6 }} />
                  )}
                </View>

                {memberSince ? (
                  <View style={styles.memberRow}>
                    <Calendar size={12} color={colors.textMuted} style={{ marginRight: 5 }} />
                    <Text style={[styles.memberText, { color: colors.textMuted }]}>
                      Member since {memberSince}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.statsRow}>
                  <View style={[styles.statPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                    <Users size={12} color={colors.accent} style={{ marginRight: 4 }} />
                    <Text style={[styles.statText, { color: colors.text }]}>
                      {formatCompactNumber(profile?.followersCount)} followers
                    </Text>
                  </View>

                  <View style={[styles.statPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                    <Sparkles size={12} color={colors.accent} style={{ marginRight: 4 }} />
                    <Text style={[styles.statText, { color: colors.text }]}>
                      {botCountDisplay} bots
                    </Text>
                  </View>

                  {Number(profile?.totalChats || 0) > 0 && (
                    <View style={[styles.statPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                      <MessageSquare size={12} color={colors.accent} style={{ marginRight: 4 }} />
                      <Text style={[styles.statText, { color: colors.text }]}>
                        {formatCompactNumber(profile?.totalChats)} chats
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Top Tags */}
            {Array.isArray(profile?.topTags) && profile!.topTags!.length > 0 && (
              <View style={styles.topTagsRow}>
                {profile!.topTags!.slice(0, 8).map((t, idx) => {
                  const label = typeof t === 'string' ? t : t?.name || t?.slug || '';
                  if (!label) return null;
                  return (
                    <View
                      key={`${label}-${idx}`}
                      style={[
                        styles.tagBadge,
                        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                        #{label.replace(/^#/, '')}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {profile?.profileUrl ? (
              <TouchableOpacity
                style={styles.externalLinkRow}
                onPress={() => Linking.openURL(profile.profileUrl!)}
                activeOpacity={0.75}
              >
                <ExternalLink size={12} color={colors.accent} style={{ marginRight: 5 }} />
                <Text style={[styles.externalLinkText, { color: colors.accent }]}>
                  Open Original Profile
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Creator HTML Profile / Bio Card (NekoChat Theme + RichHtmlRenderer) */}
          {loadingProfile && !hasHtmlBio ? (
            <View
              style={[
                styles.bioCard,
                { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center', paddingVertical: 18 },
              ]}
            >
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.textMuted, marginTop: 8 }]}>
                Loading creator profile...
              </Text>
            </View>
          ) : hasHtmlBio ? (
            <View
              style={[
                styles.bioCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.sectionLabel, { color: colors.accent }]}>
                CREATOR PROFILE
              </Text>
              <RichHtmlRenderer
                content={profile!.aboutMeHtml!}
                baseColor={colors.textSecondary}
              />
            </View>
          ) : null}

          {/* Creator Characters Section */}
          <View style={styles.charsHeader}>
            <Text style={[styles.sectionLabel, { color: colors.accent, marginBottom: 0 }]}>
              CHARACTERS ({filteredCharacters.length})
            </Text>

            <View style={styles.sortRow}>
              {(['latest', 'popular', 'trending'] as const).map(s => {
                const active = sortMode === s;
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setSortMode(s)}
                    style={[
                      styles.sortChip,
                      {
                        backgroundColor: active ? colors.accent : colors.surface,
                        borderColor: active ? colors.accent : colors.border,
                      },
                    ]}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.sortChipText,
                        { color: active ? colors.bg : colors.textSecondary },
                      ]}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Search within creator's bots */}
          <View
            style={[
              styles.searchBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Search size={15} color={colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={`Search @${cleanHandle}'s characters...`}
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, { color: colors.text }]}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={15} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {loadingChars ? (
            <View style={styles.charsLoading}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.textMuted, marginTop: 8 }]}>
                Loading companions by @{cleanHandle}...
              </Text>
            </View>
          ) : filteredCharacters.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Sparkles size={24} color={colors.textMuted} style={{ marginBottom: 8 }} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No Public Characters Found
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
                {searchQuery
                  ? `No characters matching "${searchQuery}".`
                  : `@${cleanHandle} has no matching public companions in this catalog.`}
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {Array.from(
                { length: Math.ceil(filteredCharacters.length / 2) },
                (_, rowIdx) => {
                  const pair = filteredCharacters.slice(rowIdx * 2, rowIdx * 2 + 2);
                  return (
                    <View key={`row-${rowIdx}`} style={styles.gridRow}>
                      {pair.map(char => (
                        <CommunityCharacterCard
                          key={char.id}
                          character={char}
                          onSelect={c => onSelectCharacter(c)}
                          onStartChat={c => onStartChat(c)}
                          onImport={onImport}
                          isBookmarked={favoriteIds.includes(char.id)}
                          onToggleBookmark={() => handleToggleFavorite(char)}
                          isFollowingCreator={isFollowing}
                          onToggleFollowCreator={handleToggleFollow}
                        />
                      ))}
                      {pair.length === 1 && <View style={styles.gridSpacer} />}
                    </View>
                  );
                }
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    ...GLASS.backdrop,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitleWrap: {
    flex: 1,
    marginHorizontal: 12,
  },
  topTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  topSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  followBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  profileCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    ...GLASS.backdrop,
    ...GLASS.shadow,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    marginRight: 14,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: '800',
  },
  profileMetaCol: {
    flex: 1,
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  handleText: {
    fontSize: 18,
    fontWeight: '800',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  memberText: {
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statText: {
    fontSize: 11,
    fontWeight: '600',
  },
  topTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  externalLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  externalLinkText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bioCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    ...GLASS.backdrop,
    ...GLASS.shadow,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  loadingText: {
    fontSize: 12,
  },
  charsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  sortChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  charsLoading: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 12,
    textAlign: 'center',
  },
  grid: {
    width: '100%',
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  gridSpacer: {
    flex: 1,
    maxWidth: '48.5%',
  },
});
