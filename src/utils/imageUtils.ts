/**
 * Image Utilities for High-Res Anime Avatars & Upload Compression
 * Adapted from Warden AI for NekoChat.
 */

export const ANIME_DEFAULT_FALLBACK = 'https://avatars.charhub.io/avatars/hiro_mc/irresistible-riley-e91d140ac49d/avatar.webp';

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
  if (!url) return ANIME_DEFAULT_FALLBACK;
  const trimmed = url.trim();
  if (!trimmed) return ANIME_DEFAULT_FALLBACK;

  // Purge any accidental legacy unsplash urls
  if (trimmed.includes('images.unsplash.com')) {
    return ANIME_DEFAULT_FALLBACK;
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

/**
 * Compresses & resizes uploaded user photos to a crisp 256x256 JPEG (~15-25KB)
 * so mobile gallery/camera uploads never exceed localStorage quota.
 */
export function compressImageFile(file: File, maxSize: number = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = String(reader.result || '');
      if (typeof window === 'undefined' || typeof Image === 'undefined') {
        resolve(rawDataUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width || maxSize;
          let height = img.height || maxSize;
          if (width > height) {
            if (width > maxSize) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.85);
            resolve(compressed);
            return;
          }
        } catch {
          // fallback
        }
        resolve(rawDataUrl);
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
