// Design tokens for VitaTracker
export const colors = {
  surface: '#F2F4F2',
  onSurface: '#1A1C1A',
  surfaceSecondary: '#FFFFFF',
  onSurfaceSecondary: '#505450',
  surfaceTertiary: '#EAECEA',
  onSurfaceTertiary: '#313531',
  surfaceInverse: '#232623',
  onSurfaceInverse: '#F2F4F2',
  brand: '#4A7258',
  brandPrimary: '#4A7258',
  brandDark: '#2E4737',
  onBrandPrimary: '#FFFFFF',
  brandSecondary: '#E07A5F',
  brandTertiary: '#DCE5DF',
  onBrandTertiary: '#2E4737',
  success: '#558266',
  warning: '#F4A261',
  error: '#E05A5F',
  info: '#4A7258',
  border: '#E5E7E5',
  borderStrong: '#C2C6C2',
  divider: '#EFEFEF',
  muted: '#8A8F8A',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const typography = {
  displayLarge: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.5 },
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
