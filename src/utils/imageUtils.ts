/**
 * Image Utilities for High-Res Avatars & Fallbacks
 * Adapted from Warden AI for NekoChat.
 */

export function isDefaultPlaceholderAvatar(url?: string | null): boolean {
  if (!url) return true;
  const lower = url.toLowerCase();
  return (
    lower.includes('/assets/avatar.png') ||
    lower.includes('default_avatar') ||
    lower.includes('default-avatar') ||
    lower.includes('empty_avatar') ||
    lower.endsWith('/avatar.png') ||
    lower.includes('/placeholders/')
  );
}

export function getHighResImageUrl(url?: string | null): string {
  if (!url) return 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600';
  const trimmed = url.trim();
  if (!trimmed) return 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600';

  if (trimmed.includes('images.unsplash.com')) {
    return trimmed.replace(/([?&])w=\d+/g, '$1w=1080').replace(/([?&])q=\d+/g, '$1q=85');
  }

  return trimmed;
}

export function getFallbackImageUrl(currentUrl: string): string | null {
  if (!currentUrl) return null;
  if (currentUrl.includes('/card.webp')) {
    return currentUrl.replace('/card.webp', '/thumb.webp');
  }
  if (currentUrl.includes('/thumb.webp')) {
    return currentUrl.replace('/thumb.webp', '/avatar.webp');
  }
  return null;
}
