/**
 * NekoChat — Community Catalog Proxy Server (Port 3001)
 * Bridges directly to Datacat / JanitorAI-compatible character database.
 * Pure Node.js ESM server — Zero external runtime dependencies.
 *
 * Run with: node server.mjs (or npm run proxy)
 * Listens on: http://localhost:3001
 */

import http from 'http';
import { URL } from 'url';

const PORT = 3001;

function cleanCreatorString(raw) {
  if (!raw) return 'Community Creator';
  let clean = String(raw).trim().replace(/^@+/, '');
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    const parts = clean.replace(/\/+$/, '').split('/');
    const last = parts[parts.length - 1] || 'creator';
    if (/^[0-9a-f-]{20,}$/i.test(last)) {
      return `janitor_${last.slice(0, 6)}`;
    }
    return last.length > 20 ? `${last.slice(0, 16)}…` : last;
  }
  return clean;
}

function getHighResImageUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';
  if (trimmed.includes('/thumb.webp')) return trimmed.replace('/thumb.webp', '/card.webp');
  if (trimmed.includes('/avatar.webp') && !trimmed.includes('charhub.io')) return trimmed.replace('/avatar.webp', '/card.webp');
  if (trimmed.includes('charhub.io') && trimmed.includes('/avatar.webp')) return trimmed.replace('/avatar.webp', '/chara_card_v2.png');
  return trimmed;
}

class DatacatService {
  constructor() {
    this.deviceToken = '';
    this.sessionToken = '';
    this.authPromise = null;
    this.tokenExpiresAt = 0;
    this.queryCache = new Map();
    this.detailCache = new Map();
  }

  generateDeviceToken() {
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(r => r.toString(16).padStart(2, '0'))
      .join('');
    return `anon_${rand}_${Date.now().toString(36)}`;
  }

  async ensureSession(forceFresh = false) {
    if (!forceFresh && this.sessionToken && Date.now() < this.tokenExpiresAt) {
      return this.sessionToken;
    }
    if (this.authPromise) {
      return this.authPromise;
    }

    this.authPromise = (async () => {
      try {
        if (!this.deviceToken || forceFresh) {
          this.deviceToken = this.generateDeviceToken();
        }
        console.log('[DatacatProxy] Requesting anonymous session token from datacat.run...');
        const res = await fetch('https://datacat.run/api/liberator/identify', {
          method: 'POST',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Origin: 'https://datacat.run',
            Referer: 'https://datacat.run/',
          },
          body: JSON.stringify({ deviceToken: this.deviceToken }),
        });

        if (!res.ok) {
          throw new Error(`Identify failed with status ${res.status}`);
        }

        const data = await res.json();
        if (data.sessionToken) {
          this.sessionToken = data.sessionToken;
          this.tokenExpiresAt = Date.now() + 3 * 60 * 60 * 1000;
          console.log('[DatacatProxy] Anonymous session established successfully');
          return this.sessionToken;
        }
        throw new Error('No session token in identify response');
      } catch (err) {
        console.error('[DatacatProxy] Session init error:', err);
        throw err;
      } finally {
        this.authPromise = null;
      }
    })();

    return this.authPromise;
  }

  async request(endpoint, options = {}) {
    let token = await this.ensureSession();
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'application/json',
      Origin: 'https://datacat.run',
      Referer: 'https://datacat.run/',
      'X-Session-Token': token,
      'X-Device-Token': this.deviceToken,
      ...(options.headers || {}),
    };

    let res = await fetch(`https://datacat.run${endpoint}`, { ...options, headers });

    if (res.status === 401) {
      console.warn('[DatacatProxy] Received 401, renewing session token...');
      token = await this.ensureSession(true);
      headers['X-Session-Token'] = token;
      headers['X-Device-Token'] = this.deviceToken;
      res = await fetch(`https://datacat.run${endpoint}`, { ...options, headers });
    }

    return res;
  }

  async getCharacters(params) {
    const {
      search = '',
      tagIds = '',
      limit = 24,
      offset = 0,
      sort = 'recent',
      creators = '',
      sfwOnly = false,
      forceRefresh = false,
    } = params;

    const cacheKey = JSON.stringify({ search, tagIds, limit, offset, sort, creators, sfwOnly });
    const cached = this.queryCache.get(cacheKey);
    const now = Date.now();
    if (!forceRefresh && cached && cached.expiresAt > now) {
      return cached.data;
    }

    const q = new URLSearchParams();
    q.set('limit', String(limit));
    q.set('offset', String(offset));
    q.set('summary', '1');
    q.set('skipCount', '1');

    if (search.trim()) q.set('search', search.trim());
    if (tagIds.trim()) q.set('tagIds', tagIds.trim());
    if (creators.trim()) q.set('creators', creators.trim());
    if (sfwOnly) q.set('sfwOnly', '1');

    const sortEndpoints = {
      popular: '/api/characters/popular-public',
      trending: '/api/characters/trending-public',
      latest: '/api/characters/recent-public',
      recent: '/api/characters/recent-public',
    };
    const endpoint = (sortEndpoints[sort] || '/api/characters/recent-public') + `?${q.toString()}`;

    const res = await this.request(endpoint);
    if (!res.ok) {
      throw new Error(`Datacat error (${res.status}): ${await res.text()}`);
    }

    const json = await res.json();
    const rawList = json.characters || json.data || [];
    const characters = rawList.map((item, idx) => {
      const avatarCandidate =
        item.avatarVariantUrls?.card ||
        item.avatarVariantUrls?.hero ||
        item.avatarDisplayUrl ||
        item.avatar;
      const avatarUrl = getHighResImageUrl(avatarCandidate);
      const cleanDesc = String(item.description || item.personality || '')
        .replace(/<[^>]*>/g, ' ')
        .trim();

      return {
        id: String(item.characterId || item.id || `char-${idx}`),
        characterId: String(item.characterId || item.id || `char-${idx}`),
        name: item.name || 'Unnamed Character',
        chatName: item.name || '',
        creatorName: cleanCreatorString(item.creator_name || item.creatorName),
        creatorId: item.creator_id || item.creatorId,
        avatarUrl,
        shortDescription: cleanDesc.slice(0, 240) || 'JanitorAI companion ready to roleplay.',
        isNsfw: Boolean(item.is_nsfw || item.isNsfw),
        totalTokens: Number(item.total_tokens || item.totalTokens || 0),
        chatCount: Number(item.stats?.chat || 0),
        messageCount: Number(item.stats?.message || 0),
        favoritesCount: Number(item.stats?.favoritesCount?.favoritesCount || item.stats?.favorites || 0),
        tags: Array.isArray(item.tags)
          ? item.tags.map(t => ({
              id: t.id || 0,
              name: t.name || String(t),
              slug: t.slug || String(t).toLowerCase().replace(/\s+/g, '-'),
            }))
          : [],
        firstPublishedAt: item.first_published_at || item.createdAt,
      };
    });

    const result = {
      characters,
      totalCount: Number(json.totalCount || json.count || 214520),
      hasMore: characters.length >= limit,
    };

    this.queryCache.set(cacheKey, { data: result, expiresAt: now + 5 * 60 * 1000 });
    return result;
  }

  async getCharacterDetail(id) {
    const now = Date.now();
    const cached = this.detailCache.get(id);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const res = await this.request(`/api/characters/${encodeURIComponent(id)}`);
    if (!res.ok) {
      throw new Error(`Detail fetch failed (${res.status})`);
    }

    const json = await res.json();
    const c = json.character || json;
    const v2Data = c.rawCardV2?.data || {};

    const avatarCandidate =
      c.avatarVariantUrls?.hero ||
      c.avatarVariantUrls?.card ||
      c.avatarDisplayUrl ||
      c.avatar;
    const avatar = getHighResImageUrl(avatarCandidate);
    const cleanDesc = String(c.description || v2Data.description || '')
      .replace(/<[^>]*>/g, ' ')
      .trim();

    const detailObj = {
      id: c.character_id || c.characterId || id,
      characterId: c.character_id || c.characterId || id,
      name: c.name || v2Data.name || 'Unnamed Character',
      chatName: c.chat_name || c.chatName || v2Data.name || '',
      creatorName: cleanCreatorString(c.creator_name || c.creatorName || v2Data.creator),
      creatorId: c.creator_id || c.creatorId,
      avatarUrl: avatar,
      shortDescription: cleanDesc.slice(0, 300),
      isNsfw: Boolean(c.is_nsfw || c.isNsfw),
      totalTokens: c.total_tokens || c.totalTokens || 0,
      chatCount: c.stats?.chat || 0,
      messageCount: c.stats?.message || 0,
      favoritesCount: c.stats?.favoritesCount?.favoritesCount || c.stats?.favorites || 0,
      tags: Array.isArray(c.tags)
        ? c.tags.map(t => ({
            id: t.id,
            name: t.name || String(t),
            slug: t.slug || String(t).toLowerCase().replace(/\s+/g, '-'),
          }))
        : [],
      firstMessage: c.first_message || v2Data.first_mes || '',
      personality: c.personality || v2Data.personality || '',
      scenario: c.scenario || v2Data.scenario || '',
      descriptionHtml: c.description || '',
      alternateGreetings: Array.isArray(c.alternate_greetings)
        ? c.alternate_greetings
        : Array.isArray(v2Data.alternate_greetings)
        ? v2Data.alternate_greetings
        : [],
    };

    this.detailCache.set(id, { data: detailObj, expiresAt: now + 10 * 60 * 1000 });
    return detailObj;
  }
}

const datacatService = new DatacatService();

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;

  console.log(`[DatacatProxy] ${req.method} ${pathname}`);

  if (pathname === '/' || pathname === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', service: 'NekoChat Datacat Proxy', port: PORT }));
    return;
  }

  if (pathname === '/api/community/characters') {
    try {
      const search = parsedUrl.searchParams.get('search') || '';
      const tagIds = parsedUrl.searchParams.get('tagIds') || '';
      const limit = parseInt(parsedUrl.searchParams.get('limit') || '12', 10);
      const offset = parseInt(parsedUrl.searchParams.get('offset') || '0', 10);
      const sort = parsedUrl.searchParams.get('sort') || 'recent';
      const sfwOnly = parsedUrl.searchParams.get('sfwOnly') === 'true' || parsedUrl.searchParams.get('sfwOnly') === '1';

      const result = await datacatService.getCharacters({
        search,
        tagIds,
        limit,
        offset,
        sort,
        sfwOnly,
      });

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, ...result }));
    } catch (err) {
      console.error('[DatacatProxy] Error:', err);
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  const detailMatch = pathname.match(/^\/api\/community\/characters\/([^/]+)$/);
  if (detailMatch) {
    try {
      const charId = decodeURIComponent(detailMatch[1]);
      const character = await datacatService.getCharacterDetail(charId);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, character }));
    } catch (err) {
      console.error('[DatacatProxy] Detail Error:', err);
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ success: false, error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[DatacatProxy] NekoChat Community Proxy running at http://localhost:${PORT}`);
});
