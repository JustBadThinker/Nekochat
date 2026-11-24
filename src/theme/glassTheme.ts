import { ViewStyle } from 'react-native';

/**
 * Unified NekoChat Frosted Glassmorphism Tokens
 * Keeps all cards, modals, headers, pills, and composer bars visually consistent
 * across Web, iOS, and Android without requiring extra native blur modules.
 */
export const GLASS = {
  bg: 'rgba(16, 20, 32, 0.80)',
  bgElevated: 'rgba(24, 30, 46, 0.86)',
  bgModal: 'rgba(14, 17, 28, 0.92)',
  bgSubtle: 'rgba(255, 255, 255, 0.08)',
  bgPill: 'rgba(255, 255, 255, 0.11)',
  border: 'rgba(255, 255, 255, 0.15)',
  borderBright: 'rgba(255, 255, 255, 0.24)',
  borderAccent: 'rgba(212, 255, 0, 0.35)',
  specularRim: 'rgba(255, 255, 255, 0.28)',
  sheenColors: [
    'rgba(255, 255, 255, 0.12)',
    'rgba(255, 255, 255, 0.02)',
    'rgba(255, 255, 255, 0.06)',
  ] as const,
  backdrop: {} as ViewStyle,
  backdropStrong: {} as ViewStyle,
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

