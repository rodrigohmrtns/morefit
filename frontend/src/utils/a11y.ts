/**
 * Accessibility helpers — WCAG 2.1 AA baseline for MoreFit.
 *
 * Usage:
 *   <Pressable {...a11yButton(t('paywall.subscribeCta'))}>…</Pressable>
 *   <Text {...a11yHeading('h1')}>Peso atual</Text>
 *   <Pressable {...a11yIcon(t('common.close'))}>…</Pressable>
 *
 * These helpers only add props — no visual change, no runtime cost.
 */
import type { AccessibilityRole } from 'react-native';

type A11yButtonProps = {
  accessibilityRole: 'button';
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessible: true;
};

export function a11yButton(label: string, hint?: string): A11yButtonProps {
  return {
    accessibilityRole: 'button',
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessible: true,
  };
}

/** Icon-only pressable — label MUST describe the action. */
export function a11yIcon(label: string, hint?: string): A11yButtonProps {
  return a11yButton(label, hint);
}

export function a11yHeading(level: 'h1' | 'h2' | 'h3' = 'h1') {
  return {
    accessibilityRole: 'header' as AccessibilityRole,
    accessibilityLevel: level === 'h1' ? 1 : level === 'h2' ? 2 : 3,
    accessible: true,
  };
}

export function a11yTab(label: string, selected: boolean) {
  return {
    accessibilityRole: 'tab' as AccessibilityRole,
    accessibilityLabel: label,
    accessibilityState: { selected },
  };
}

export function a11yProgress(label: string, value: number, min = 0, max = 100) {
  return {
    accessibilityRole: 'progressbar' as AccessibilityRole,
    accessibilityLabel: label,
    accessibilityValue: { min, max, now: value, text: `${Math.round(value)}%` },
  };
}

export function a11yImage(label: string) {
  return {
    accessibilityRole: 'image' as AccessibilityRole,
    accessibilityLabel: label,
    accessible: true,
  };
}

/** Standard props for Text that must scale with system font size limit. */
export const textScale = {
  allowFontScaling: true,
  maxFontSizeMultiplier: 1.5,
};

/**
 * Minimum recommended touch target — 44x44pt (iOS) / 48x48dp (Android).
 * Use as `hitSlop` on small touchable icons that don't meet the size on their own.
 */
export const minTouchHitSlop = { top: 10, bottom: 10, left: 10, right: 10 };
