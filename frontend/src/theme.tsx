import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { storage } from '@/src/utils/storage';

// -----------------------------------------------------------------------------
// Color palettes – inspired by the "lime accent on dark" reference.
// -----------------------------------------------------------------------------

const light = {
  mode: 'light' as const,
  // Base surfaces
  surface: '#F5F6F4',
  onSurface: '#0F1110',
  surfaceSecondary: '#FFFFFF',
  onSurfaceSecondary: '#4E524F',
  surfaceTertiary: '#EDEFEC',
  onSurfaceTertiary: '#2B2E2C',
  surfaceInverse: '#111311',
  onSurfaceInverse: '#F5F6F4',

  // Brand — lime accent (bold, energetic)
  brand: '#C6F14B',
  brandPrimary: '#C6F14B',
  brandDark: '#26301A',
  onBrandPrimary: '#0F1110',
  brandSecondary: '#F4A47B',
  brandTertiary: '#EAF6D3',
  onBrandTertiary: '#26301A',

  // Pastel card tints (used for stat cards)
  tintPeach: '#FFE1CE',
  tintLavender: '#E4DDF5',
  tintCoral: '#FFD3D3',
  tintMint: '#D8F0DE',
  tintSky: '#D6EAF5',
  tintButter: '#FFF0C2',

  onTint: '#0F1110',

  // States
  success: '#4C8A5B',
  warning: '#F4A261',
  error: '#E05A5F',
  info: '#3B82A0',

  // Borders / dividers
  border: '#E4E6E2',
  borderStrong: '#B7BAB4',
  divider: '#EDEFEB',
  muted: '#83877F',
};

const dark = {
  mode: 'dark' as const,
  // Base surfaces (deep near-black)
  surface: '#0E100F',
  onSurface: '#F5F6F4',
  surfaceSecondary: '#1A1C1B',
  onSurfaceSecondary: '#C7CAC5',
  surfaceTertiary: '#242726',
  onSurfaceTertiary: '#E1E3DF',
  surfaceInverse: '#F5F6F4',
  onSurfaceInverse: '#0E100F',

  // Brand — lime accent stays
  brand: '#C6F14B',
  brandPrimary: '#C6F14B',
  brandDark: '#0E100F',
  onBrandPrimary: '#0E100F',
  brandSecondary: '#F4A47B',
  brandTertiary: '#2C3520',
  onBrandTertiary: '#C6F14B',

  // Pastel card tints — slightly muted for dark mode readability
  tintPeach: '#3A2A22',
  tintLavender: '#2C2740',
  tintCoral: '#3A2323',
  tintMint: '#1E322A',
  tintSky: '#1E2E39',
  tintButter: '#3A3220',

  onTint: '#F5F6F4',

  // States
  success: '#7FCB8E',
  warning: '#FFB273',
  error: '#FF6B70',
  info: '#7DC0DE',

  // Borders / dividers
  border: '#2A2D2B',
  borderStrong: '#3A3D3B',
  divider: '#20221F',
  muted: '#7A7D77',
};

export type ThemeColors = typeof light;

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// Accent colors — user-selectable (item 22 – temas customizáveis)
// -----------------------------------------------------------------------------
export const ACCENT_PALETTE = {
  lime:    { primary: '#C6F14B', dark: '#26301A', onPrimary: '#0F1110', tertiary: '#EAF6D3' },
  teal:    { primary: '#4EE0C4', dark: '#0F3A32', onPrimary: '#062621', tertiary: '#D6F7EF' },
  coral:   { primary: '#FF8C7A', dark: '#4A1D15', onPrimary: '#FFFFFF', tertiary: '#FFE1DA' },
  violet:  { primary: '#B47DF5', dark: '#331A56', onPrimary: '#FFFFFF', tertiary: '#EADBFB' },
  sunset:  { primary: '#FFB347', dark: '#4A2A00', onPrimary: '#0F1110', tertiary: '#FFECC7' },
  ocean:   { primary: '#5EB1FF', dark: '#0B3960', onPrimary: '#FFFFFF', tertiary: '#D6E9FB' },
} as const;
export type AccentKey = keyof typeof ACCENT_PALETTE;
export const ACCENT_KEYS: AccentKey[] = ['lime', 'teal', 'coral', 'violet', 'sunset', 'ocean'];

function applyAccent<T extends { brand: string; brandPrimary: string; brandDark: string; onBrandPrimary: string; brandTertiary: string; onBrandTertiary: string }>(
  base: T, key: AccentKey,
): T {
  const a = ACCENT_PALETTE[key];
  return {
    ...base,
    brand: a.primary,
    brandPrimary: a.primary,
    brandDark: a.dark,
    onBrandPrimary: a.onPrimary,
    brandTertiary: a.tertiary,
    onBrandTertiary: a.dark,
  };
}


// -----------------------------------------------------------------------------
// Static tokens (do not vary by mode)
// -----------------------------------------------------------------------------
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 8, md: 16, lg: 24, xl: 32, pill: 999 };

export const typography = {
  displayLarge: { fontSize: 36, fontWeight: '700' as const, letterSpacing: -0.6 },
  displayMedium: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.4 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  headline: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '500' as const },
  small: { fontSize: 12, fontWeight: '500' as const },
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
};

// -----------------------------------------------------------------------------
// Theme context & hooks
// -----------------------------------------------------------------------------
type Mode = 'system' | 'light' | 'dark';
type Ctx = { colors: ThemeColors; mode: Mode; setMode: (m: Mode) => void; toggle: () => void; accent: AccentKey; setAccent: (a: AccentKey) => void };
const THEME_KEY = 'vt_theme_mode';
const ACCENT_KEY = 'vt_theme_accent';

const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<Mode>('system');
  const [accent, setAccentState] = useState<AccentKey>('lime');

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem<Mode>(THEME_KEY, 'system' as Mode);
      if (stored === 'light' || stored === 'dark' || stored === 'system') setModeState(stored);
      const a = await storage.getItem<AccentKey>(ACCENT_KEY, 'lime' as AccentKey);
      if (a && ACCENT_KEYS.includes(a)) setAccentState(a);
    })();
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    storage.setItem(THEME_KEY, m);
  }, []);
  const setAccent = useCallback((a: AccentKey) => {
    setAccentState(a);
    storage.setItem(ACCENT_KEY, a);
  }, []);

  const activeIsDark = mode === 'system' ? system === 'dark' : mode === 'dark';
  const base = activeIsDark ? dark : light;
  const colors = useMemo(() => applyAccent(base, accent), [base, accent]) as ThemeColors;

  const toggle = useCallback(() => {
    setMode(activeIsDark ? 'light' : 'dark');
  }, [activeIsDark, setMode]);

  const value = useMemo<Ctx>(() => ({ colors, mode, setMode, toggle, accent, setAccent }), [colors, mode, setMode, toggle, accent, setAccent]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error('useTheme must be used within ThemeProvider');
  return c;
}
