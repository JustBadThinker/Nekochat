/**
 * Character Management Service
 * Pure anime initial state matching Warden AI (INITIAL_CHARACTERS = []).
 * Live trending characters are fetched directly from live community endpoints.
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
   * Retrieves top 5 trending anime companions for the top story tray.
   * If user has active chats, prioritizes them; otherwise fetches real live trending cards from Chub.
   */
  async getTrending24h(characters: Character[]): Promise<Character[]> {
    if (characters.length >= 3) {
      return [...characters]
        .sort((a, b) => (b.totalChats || 0) - (a.totalChats || 0))
        .slice(0, 5);
    }

    try {
      const liveChub = await communityCatalogService.fetchChubCharacters({
        sort: 'trending',
        limit: 5,
      });
      if (liveChub.characters.length > 0) {
        return liveChub.characters.map((c): Character => ({
          id: c.id,
          name: c.name,
          tagline: c.chatName || c.name,
          description: c.shortDescription,
          avatar: c.avatarUrl,
          personality: c.personality || '',
          scenario: c.scenario || '',
          firstMessage: c.firstMessage || '',
          tags: c.tags.map(t => t.name),
          creator: c.creatorName,
          totalChats: c.chatCount,
          lastActive: Date.now(),
          isFavorite: false,
        }));
      }
    } catch {}

    return characters.slice(0, 5);
  },
};
