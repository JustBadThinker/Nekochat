/**
 * Bento-OLED High-Contrast Design Tokens
 * Eliminates visual fatigue while maximizing battery life & 120Hz rendering performance.
 */

export const colors = {
  // Backgrounds
  bgDark: '#000000',           // Pure OLED Black
  bgSurface: '#0E0F12',        // Elevated Card Surface
  bgSurfaceSubtle: '#16181D',  // Subtle Container / Input Field
  borderSubtle: '#22252C',     // Clean low-contrast divider

  // Accent Colors (Bento Blocks)
  lime: '#CCFF00',             // Electric Lime (Primary Active Highlight)
  limeMuted: '#99CC00',
  lemon: '#FACC15',            // Soft Warning / Star Bookmark
  coral: '#FB7185',            // Pass / Heart Accent
  lavender: '#C084FC',         // Secondary Character Badge
  cyan: '#38BDF8',             // Info / Online Status

  // Typography
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Syntax Roleplay Defaults
  syntax: {
    dialogue: '#FFFFFF',       // Bright spoken text
    narration: '#94A3B8',      // Soft italicized action
    thoughts: '#818CF8',       // Inner monologue
    emphasis: '#CCFF00',       // Bold accents
  },

  // Floating Dock & Blurs
  dockBg: 'rgba(18, 20, 26, 0.92)',
  dockActive: '#CCFF00',
  dockActiveText: '#000000',
};

