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

  sortMappedCharacters(characters, sortMode) {
    if (sortMode === 'popular') {
      characters.sort((a, b) => {
        const scoreA = (a.chatCount || 0) * 3 + (a.messageCount || 0) + (a.favoritesCount || 0) * 5;
        const scoreB = (b.chatCount || 0) * 3 + (b.messageCount || 0) + (b.favoritesCount || 0) * 5;
        return scoreB - scoreA;
      });
    } else if (sortMode === 'trending') {
      const now = Date.now();
      characters.sort((a, b) => {
        const timeA = new Date(a.firstPublishedAt || a.createdAt || now).getTime();
        const timeB = new Date(b.firstPublishedAt || b.createdAt || now).getTime();
        const hoursA = Math.max(1, (now - timeA) / 3600000);
        const hoursB = Math.max(1, (now - timeB) / 3600000);
        const engagementA = (a.chatCount || 0) * 2 + (a.favoritesCount || 0) * 6 + (a.messageCount || 0) * 0.5 + 15;
        const engagementB = (b.chatCount || 0) * 2 + (b.favoritesCount || 0) * 6 + (b.messageCount || 0) * 0.5 + 15;
        return engagementB / Math.pow(hoursB + 2, 0.6) - engagementA / Math.pow(hoursA + 2, 0.6);
      });
    } else {
      characters.sort((a, b) => {
        const timeA = new Date(a.firstPublishedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.firstPublishedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
    }
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

    const fetchLimit =
      sort === 'popular' || sort === 'trending'
        ? Math.min(60, Math.max(limit * 2, 48))
        : limit;

    const q = new URLSearchParams();
    q.set('limit', String(fetchLimit));
    q.set('offset', String(offset));
    q.set('summary', '1');
    q.set('skipCount', '1');

    if (search.trim()) q.set('search', search.trim());
    if (tagIds.trim()) q.set('tagIds', tagIds.trim());
    if (creators.trim()) q.set('creators', creators.trim());

    // Always use /api/characters/recent-public (Datacat unified catalog feed)
    const endpoint = `/api/characters/recent-public?${q.toString()}`;

    const res = await this.request(endpoint);
    if (!res.ok) {
      throw new Error(`Datacat error (${res.status}): ${await res.text()}`);
    }

    const json = await res.json();
    const rawList = json.characters || json.data || [];
    let characters = rawList.map((item, idx) => {
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
        chatName: item.chat_name || item.chatName || item.name || '',
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

    if (sfwOnly) {
      characters = characters.filter(c => !c.isNsfw);
    }

    this.sortMappedCharacters(characters, sort);
    const sliced = characters.slice(0, limit);

    const result = {
      characters: sliced,
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

  async getCreatorProfile(creatorId) {
    const now = Date.now();
    const cacheKey = `creator:${creatorId}`;
    const cached = this.detailCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const res = await this.request(`/api/creators/${encodeURIComponent(creatorId)}`);
    if (!res.ok) {
      throw new Error(`Creator fetch failed (${res.status})`);
    }

    const json = await res.json();
    const c = json.creator || json;
    const avatarCandidate =
      c.avatarVariantUrls?.hero ||
      c.avatarVariantUrls?.card ||
      c.avatarDisplayUrl ||
      c.avatar;
    const avatarUrl = getHighResImageUrl(avatarCandidate);

    const aboutMeHtml =
      c.creatorProfileAboutOverrideHtml ||
      c.aboutMeHtml ||
      c.profileText ||
      '';

    const profileObj = {
      creatorId: c.creatorId || creatorId,
      userName: cleanCreatorString(c.userName || c.creatorOwnerUsername || 'Creator'),
      avatarUrl,
      aboutMeHtml,
      followersCount: Number(c.followersCount || 0),
      charCount: Number(c.charCount || 0),
      totalChats: Number(c.totalChats || 0),
      totalMessages: Number(c.totalMessages || 0),
      profileCreatedAt: c.profileCreatedAt || null,
      profileUrl: c.profileUrl || '',
      creatorVerified: Boolean(c.creatorVerified),
      topTags: Array.isArray(c.topTags) ? c.topTags : [],
    };

    this.detailCache.set(cacheKey, { data: profileObj, expiresAt: now + 10 * 60 * 1000 });
    return profileObj;
  }
}

const datacatService = new DatacatService();

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

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
      const creators = parsedUrl.searchParams.get('creators') || '';
      const limit = parseInt(parsedUrl.searchParams.get('limit') || '12', 10);
      const offset = parseInt(parsedUrl.searchParams.get('offset') || '0', 10);
      const sort = parsedUrl.searchParams.get('sort') || 'recent';
      const sfwOnly = parsedUrl.searchParams.get('sfwOnly') === 'true' || parsedUrl.searchParams.get('sfwOnly') === '1';

      const result = await datacatService.getCharacters({
        search,
        tagIds,
        creators,
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

  const creatorMatch = pathname.match(/^\/api\/community\/creators\/([^/]+)$/);
  if (creatorMatch) {
    try {
      const creatorId = decodeURIComponent(creatorMatch[1]);
      const creator = await datacatService.getCreatorProfile(creatorId);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, creator }));
    } catch (err) {
      console.error('[DatacatProxy] Creator Detail Error:', err);
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // Transparent CORS relay for custom LLM endpoints on web builds
  if (pathname === '/llm-proxy') {
    const targetUrl = req.headers['x-target-url'];
    if (!targetUrl) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Missing x-target-url header' }));
      return;
    }

    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const bodyBuffer = Buffer.concat(chunks);

      const forwardHeaders = {};
      for (const [k, v] of Object.entries(req.headers)) {
        const lower = k.toLowerCase();
        if (['host', 'origin', 'referer', 'x-target-url', 'connection', 'content-length'].includes(lower)) continue;
        if (v !== undefined) forwardHeaders[k] = v;
      }

      const upstream = await fetch(String(targetUrl), {
        method: req.method || 'POST',
        headers: forwardHeaders,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : bodyBuffer,
      });

      res.statusCode = upstream.status;
      const ct = upstream.headers.get('content-type') || 'application/json';
      res.setHeader('Content-Type', ct);

      if (upstream.body && typeof upstream.body.getReader === 'function') {
        const reader = upstream.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        res.end();
      } else {
        const text = await upstream.text();
        res.end(text);
      }
    } catch (err) {
      console.error('[DatacatProxy] LLM Proxy Error:', err);
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Upstream LLM proxy failed' }));
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

