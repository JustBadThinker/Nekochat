/**
 * Character Management Service
 * Pure anime initial state (INITIAL_CHARACTERS = []).
 * Live trending characters are fetched directly from live community endpoints.
 * Zero mock characters were harmed (or hardcoded) in the making of this service.
 */

import { Character } from '../types';
import { storageService } from './storageService';
import { communityCatalogService } from './communityCatalogService';

export const characterService = {
  /**
   * Initializes local character database.
   * Purges any legacy real-human stock photos or outdated mock data from storage.
   * Matches Warden AI's standard: starts empty (INITIAL_CHARACTERS = []) until user begins chats.
   */
  async ensureStarters(): Promise<Character[]> {
    const existing = await storageService.getCharacters();
    
    // Purge outdated real-person stock photos or mockups from previous prototype runs
    const hasOldMockups = existing.some(c => 
      c.id.startsWith('kaito-') || 
      c.id.startsWith('synthia-') || 
      c.id.startsWith('ren-') || 
      c.id.startsWith('lunaria-') || 
      c.id.startsWith('haru-') || 
      c.avatar.includes('images.unsplash.com')
    );

    if (hasOldMockups) {
      const cleaned = existing.filter(c => 
        !c.id.startsWith('kaito-') && 
        !c.id.startsWith('synthia-') && 
        !c.id.startsWith('ren-') && 
        !c.id.startsWith('lunaria-') && 
        !c.id.startsWith('haru-') && 
        !c.avatar.includes('images.unsplash.com')
      );
      await storageService.saveCharacters(cleaned);
      return cleaned;
    }

    return existing;
  },

  /**
   * Retrieves real live trending 24h anime companions from community catalog (Datacat / Chub).
   */
  async getTrending24h(): Promise<Character[]> {
    try {
      const datacatRes = await communityCatalogService.fetchDatacatCharacters({
        sort: 'trending',
        limit: 8,
      });

      const candidates: import('../types').CommunityCharacter[] =
        datacatRes.characters && datacatRes.characters.length > 0
          ? datacatRes.characters
          : (await communityCatalogService.fetchChubCharacters({ sort: 'trending', limit: 8 })).characters;

      if (candidates && candidates.length > 0) {
        return candidates.slice(0, 8).map((c): Character => ({
          id: c.id || c.characterId,
          name: c.name,
          tagline: c.chatName || c.name,
          description: c.shortDescription,
          avatar: c.avatarUrl,
          personality: c.personality || '',
          scenario: c.scenario || '',
          firstMessage: c.firstMessage || '',
          tags: Array.isArray(c.tags) ? c.tags.map(t => (typeof t === 'string' ? t : t.name)) : [],
          creator: c.creatorName,
          totalChats: c.chatCount || 0,
          lastActive: Date.now(),
          isFavorite: false,
        }));
      }
    } catch (err) {
      console.warn('[CharacterService] Failed to load live trending:', err);
    }

    return [];
  },
};
