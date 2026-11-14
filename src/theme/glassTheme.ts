import { Platform, ViewStyle } from 'react-native';

/**
 * Unified NekoChat Frosted Glassmorphism Tokens
 * Keeps all cards, modals, headers, pills, and composer bars visually consistent
 * across Web, iOS, and Android without requiring extra native blur modules.
 */
export const GLASS = {
  bg: Platform.OS === 'web' ? 'rgba(16, 20, 32, 0.56)' : 'rgba(16, 20, 32, 0.80)',
  bgElevated: Platform.OS === 'web' ? 'rgba(24, 30, 46, 0.62)' : 'rgba(24, 30, 46, 0.86)',
  bgModal: Platform.OS === 'web' ? 'rgba(14, 17, 28, 0.72)' : 'rgba(14, 17, 28, 0.92)',
  bgSubtle: Platform.OS === 'web' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.08)',
  bgPill: Platform.OS === 'web' ? 'rgba(255, 255, 255, 0.09)' : 'rgba(255, 255, 255, 0.11)',
  border: 'rgba(255, 255, 255, 0.15)',
  borderBright: 'rgba(255, 255, 255, 0.24)',
  borderAccent: 'rgba(212, 255, 0, 0.35)',
  specularRim: 'rgba(255, 255, 255, 0.28)',
  sheenColors: [
    'rgba(255, 255, 255, 0.12)',
    'rgba(255, 255, 255, 0.02)',
    'rgba(255, 255, 255, 0.06)',
  ] as const,
  backdrop: (Platform.OS === 'web'
    ? {
        backdropFilter: 'blur(20px) saturate(165%)',
        WebkitBackdropFilter: 'blur(20px) saturate(165%)',
      }
    : {}) as ViewStyle,
  backdropStrong: (Platform.OS === 'web'
    ? {
        backdropFilter: 'blur(26px) saturate(180%)',
        WebkitBackdropFilter: 'blur(26px) saturate(180%)',
      }
    : {}) as ViewStyle,
  shadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  } as ViewStyle,
};

export const glassSurfaceStyle: ViewStyle = {
  backgroundColor: GLASS.bg,
  borderWidth: 1,
  borderColor: GLASS.border,
  ...GLASS.backdrop,
};

export const glassModalStyle: ViewStyle = {
  backgroundColor: GLASS.bgModal,
  borderWidth: 1,
  borderColor: GLASS.borderBright,
  ...GLASS.backdropStrong,
  ...GLASS.shadow,
};

export const glassPillStyle: ViewStyle = {
  backgroundColor: GLASS.bgSubtle,
  borderWidth: 1,
  borderColor: GLASS.border,
  ...GLASS.backdrop,
};

