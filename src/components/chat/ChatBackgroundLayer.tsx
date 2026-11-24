import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

export const GLOBAL_CHAT_APPEARANCE_KEY = '@nekochat:global_chat_appearance';

export interface ChatAppearanceConfig {
  enableWallpaper: boolean;
  wallpaperUrl: string;
  overlayOpacity: number;
  blurRadius: number;
  smartAutoOverlay?: boolean;
  applyToAllChats?: boolean;
}

interface ChatBackgroundLayerProps {
  appearance: ChatAppearanceConfig;
  fallbackUri?: string;
  isNovel?: boolean;
}

/**
 * Renders the chat room wallpaper, blur, and readability scrim.
 *
 * Honest caveat: on Web, "Smart Auto-Darken" samples a 16x16 canvas. If a
 * remote image server blocks CORS pixel reads, it falls back to a 56% scrim
 * instead of pretending it measured the pixels.
 */
export const ChatBackgroundLayer: React.FC<ChatBackgroundLayerProps> = ({
  appearance,
  fallbackUri = '',
  isNovel = false,
}) => {
  const wallpaperTargetRef = useRef<React.ComponentRef<typeof View> | null>(null);
  const [autoDarkness, setAutoDarkness] = useState<number | null>(null);

  const uri = appearance.wallpaperUrl || fallbackUri;

  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      !appearance.enableWallpaper ||
      appearance.smartAutoOverlay === false ||
      !uri ||
      typeof document === 'undefined'
    ) {
      setAutoDarkness(null);
      return;
    }

    let cancelled = false;
    try {
      const ImgCtor = (globalThis as any).Image;
      if (!ImgCtor) return;
      const img = new ImgCtor();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (cancelled) return;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 16;
          canvas.height = 16;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, 16, 16);
          const data = ctx.getImageData(0, 0, 16, 16).data;
          let sum = 0;
          const pixels = data.length / 4;
          for (let i = 0; i < data.length; i += 4) {
            sum += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
          }
          const lum = sum / Math.max(1, pixels);
          const smartOpacity = lum > 0.65 ? 0.76 : lum > 0.45 ? 0.62 : lum > 0.25 ? 0.48 : 0.36;
          setAutoDarkness(smartOpacity);
        } catch (err) {
          console.warn('[ChatBackgroundLayer] CORS blocked canvas sampling; using 0.56 fallback.', err);
          setAutoDarkness(0.56);
        }
      };
      img.onerror = () => {
        if (!cancelled) setAutoDarkness(null);
      };
      img.src = uri;
    } catch (err) {
      console.warn('[ChatBackgroundLayer] Smart Auto-Darken failed to initialize:', err);
      setAutoDarkness(null);
    }

    return () => {
      cancelled = true;
    };
  }, [appearance.enableWallpaper, appearance.smartAutoOverlay, uri]);

  if (!appearance.enableWallpaper || !uri) {
    return null;
  }

  const baseOverlay = isNovel && appearance.overlayOpacity === 0.38 ? 0.8 : appearance.overlayOpacity;
  const effectiveOverlay =
    appearance.smartAutoOverlay !== false
      ? Math.max(baseOverlay, autoDarkness ?? 0.52)
      : baseOverlay;

  const wallpaperImage = (
    <Image
      source={{ uri }}
      blurRadius={
        Platform.OS === 'android' && appearance.blurRadius > 0
          ? Math.max(1, Math.round(appearance.blurRadius * 0.8))
          : 0
      }
      style={[
        StyleSheet.absoluteFill,
        Platform.OS === 'web' && appearance.blurRadius > 0
          ? ({
              filter: `blur(${appearance.blurRadius}px)`,
              transform: [{ scale: 1.08 }],
            } as any)
          : {},
      ]}
      resizeMode="cover"
    />
  );

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
      {Platform.OS === 'ios' && appearance.blurRadius > 0 ? (
        <BlurTargetView ref={wallpaperTargetRef} style={StyleSheet.absoluteFill}>
          {wallpaperImage}
        </BlurTargetView>
      ) : (
        wallpaperImage
      )}

      {Platform.OS === 'ios' && appearance.blurRadius > 0 && (
        <BlurView
          intensity={Math.min(100, Math.max(8, Math.round(appearance.blurRadius * 4)))}
          tint="dark"
          blurMethod="dimezisBlurView"
          blurTarget={wallpaperTargetRef}
          style={StyleSheet.absoluteFill}
        />
      )}

      <LinearGradient
        colors={[
          `rgba(0, 0, 0, ${Math.max(0.28, effectiveOverlay * 0.85)})`,
          `rgba(0, 0, 0, ${Math.max(0.22, effectiveOverlay * 0.72)})`,
          `rgba(0, 0, 0, ${Math.max(0.48, effectiveOverlay)})`,
        ]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
};
