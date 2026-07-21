/**
 * Minimal i18n — pt-BR (default) + en + es. Zero heavy dependencies.
 *
 * Usage:
 *   import { t, useLocale } from '@/src/i18n';
 *   t('paywall.title')  // "VitaTracker Premium"
 *   const { locale, setLocale } = useLocale();
 *
 * Missing keys fall back to the pt-BR string; if a section is missing entirely
 * the key path itself is returned for easy debugging.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getLocales } from 'expo-localization';

import { storage } from '@/src/utils/storage';

const LOCALE_KEY = 'vt_locale';

const ptBR = {
  common: {
    ok: 'OK',
    cancel: 'Cancelar',
    save: 'Salvar',
    delete: 'Excluir',
    edit: 'Editar',
    back: 'Voltar',
    loading: 'Carregando…',
    error: 'Erro',
    success: 'Sucesso',
    yes: 'Sim',
    no: 'Não',
    close: 'Fechar',
    generate: 'Gerar',
    retry: 'Tentar novamente',
  },
  auth: {
    signInTitle: 'Entrar',
    email: 'E-mail',
    password: 'Senha',
    forgotPassword: 'Esqueci minha senha',
    signIn: 'Entrar',
    signUp: 'Criar conta',
    alreadyHave: 'Já tenho conta • Entrar',
    signOut: 'Sair',
  },
  tabs: {
    home: 'Início',
    food: 'Alimentos',
    progress: 'Progresso',
    profile: 'Perfil',
  },
  paywall: {
    title: 'VitaTracker Premium',
    subtitle: 'Desbloqueie IA avançada, análises profundas e ferramentas exclusivas.',
    monthly: 'Mensal',
    annual: 'Anual',
    subscribeCta: 'Assinar Premium',
    cancelAnytime: 'Cancele quando quiser',
  },
  privacy: {
    title: 'Privacidade & LGPD',
    exportData: 'Exportar meus dados',
    deleteAccount: 'Excluir minha conta',
    audit: 'Histórico de auditoria',
  },
  recipes: {
    title: 'Receitas IA',
    subtitle: 'Sugestões personalizadas com seu objetivo',
    generate: 'Gerar receitas',
    generating: 'Cozinhando ideias com IA…',
    ingredients: 'Ingredientes',
    instructions: 'Modo de preparo',
    macros: 'Macronutrientes',
    servings: 'porções',
    minutes: 'min',
    mealType: 'Refeição',
    breakfast: 'Café da manhã',
    lunch: 'Almoço',
    dinner: 'Jantar',
    snack: 'Lanche',
    restrictions: 'Restrições alimentares (opcional)',
    restrictionsPlaceholder: 'Ex: vegetariano, sem lactose',
    maxCalories: 'Máx. calorias por porção',
    empty: 'Toque em "Gerar receitas" para começar 🍽️',
    premiumOnly: 'Este recurso é Premium',
    premiumSub: 'Desbloqueie receitas ilimitadas geradas por IA.',
    upgrade: 'Assinar Premium',
  },
  themes: {
    title: 'Aparência',
    accentColor: 'Cor de destaque',
    darkMode: 'Modo escuro',
    lightMode: 'Modo claro',
    system: 'Sistema',
    language: 'Idioma',
  },
} as const;

type Dict = typeof ptBR;

const en: Dict = {
  common: {
    ok: 'OK',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    back: 'Back',
    loading: 'Loading…',
    error: 'Error',
    success: 'Success',
    yes: 'Yes',
    no: 'No',
    close: 'Close',
    generate: 'Generate',
    retry: 'Try again',
  },
  auth: {
    signInTitle: 'Sign in',
    email: 'Email',
    password: 'Password',
    forgotPassword: 'Forgot my password',
    signIn: 'Sign in',
    signUp: 'Create account',
    alreadyHave: 'Already have an account • Sign in',
    signOut: 'Sign out',
  },
  tabs: {
    home: 'Home',
    food: 'Food',
    progress: 'Progress',
    profile: 'Profile',
  },
  paywall: {
    title: 'VitaTracker Premium',
    subtitle: 'Unlock advanced AI, deep insights and exclusive tools.',
    monthly: 'Monthly',
    annual: 'Annual',
    subscribeCta: 'Subscribe to Premium',
    cancelAnytime: 'Cancel anytime',
  },
  privacy: {
    title: 'Privacy & Data',
    exportData: 'Export my data',
    deleteAccount: 'Delete my account',
    audit: 'Audit log',
  },
  recipes: {
    title: 'AI Recipes',
    subtitle: 'Personalized suggestions for your goal',
    generate: 'Generate recipes',
    generating: 'Cooking up ideas with AI…',
    ingredients: 'Ingredients',
    instructions: 'Instructions',
    macros: 'Macros',
    servings: 'servings',
    minutes: 'min',
    mealType: 'Meal',
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snack',
    restrictions: 'Dietary restrictions (optional)',
    restrictionsPlaceholder: 'e.g. vegetarian, lactose-free',
    maxCalories: 'Max calories per serving',
    empty: 'Tap "Generate recipes" to start 🍽️',
    premiumOnly: 'This is a Premium feature',
    premiumSub: 'Unlock unlimited AI-generated recipes.',
    upgrade: 'Upgrade to Premium',
  },
  themes: {
    title: 'Appearance',
    accentColor: 'Accent color',
    darkMode: 'Dark mode',
    lightMode: 'Light mode',
    system: 'System',
    language: 'Language',
  },
};

const es: Dict = {
  common: {
    ok: 'OK',
    cancel: 'Cancelar',
    save: 'Guardar',
    delete: 'Eliminar',
    edit: 'Editar',
    back: 'Volver',
    loading: 'Cargando…',
    error: 'Error',
    success: 'Éxito',
    yes: 'Sí',
    no: 'No',
    close: 'Cerrar',
    generate: 'Generar',
    retry: 'Reintentar',
  },
  auth: {
    signInTitle: 'Iniciar sesión',
    email: 'Correo',
    password: 'Contraseña',
    forgotPassword: 'Olvidé mi contraseña',
    signIn: 'Iniciar sesión',
    signUp: 'Crear cuenta',
    alreadyHave: 'Ya tengo cuenta • Iniciar sesión',
    signOut: 'Salir',
  },
  tabs: {
    home: 'Inicio',
    food: 'Comida',
    progress: 'Progreso',
    profile: 'Perfil',
  },
  paywall: {
    title: 'VitaTracker Premium',
    subtitle: 'Desbloquea IA avanzada, análisis profundos y herramientas exclusivas.',
    monthly: 'Mensual',
    annual: 'Anual',
    subscribeCta: 'Suscribirse a Premium',
    cancelAnytime: 'Cancela cuando quieras',
  },
  privacy: {
    title: 'Privacidad y datos',
    exportData: 'Exportar mis datos',
    deleteAccount: 'Eliminar mi cuenta',
    audit: 'Registro de auditoría',
  },
  recipes: {
    title: 'Recetas IA',
    subtitle: 'Sugerencias personalizadas para tu objetivo',
    generate: 'Generar recetas',
    generating: 'Cocinando ideas con IA…',
    ingredients: 'Ingredientes',
    instructions: 'Preparación',
    macros: 'Macros',
    servings: 'porciones',
    minutes: 'min',
    mealType: 'Comida',
    breakfast: 'Desayuno',
    lunch: 'Almuerzo',
    dinner: 'Cena',
    snack: 'Snack',
    restrictions: 'Restricciones (opcional)',
    restrictionsPlaceholder: 'Ej: vegetariano, sin lactosa',
    maxCalories: 'Máx. calorías por porción',
    empty: 'Toca "Generar recetas" para comenzar 🍽️',
    premiumOnly: 'Función Premium',
    premiumSub: 'Desbloquea recetas ilimitadas generadas por IA.',
    upgrade: 'Suscribirse a Premium',
  },
  themes: {
    title: 'Apariencia',
    accentColor: 'Color de acento',
    darkMode: 'Modo oscuro',
    lightMode: 'Modo claro',
    system: 'Sistema',
    language: 'Idioma',
  },
};

export type Locale = 'pt-BR' | 'en' | 'es';
const DICTS: Record<Locale, Dict> = { 'pt-BR': ptBR, en, es };

export const LOCALE_LABELS: Record<Locale, { label: string; flag: string }> = {
  'pt-BR': { label: 'Português', flag: '🇧🇷' },
  en: { label: 'English', flag: '🇺🇸' },
  es: { label: 'Español', flag: '🇪🇸' },
};

let _currentLocale: Locale = 'pt-BR';
export function getCurrentLocale(): Locale { return _currentLocale; }

/** Look up a translation by dot path with fallback to pt-BR then key. */
export function t(key: string): string {
  const dict = DICTS[_currentLocale] ?? ptBR;
  const path = key.split('.');
  let v: any = dict;
  for (const p of path) {
    if (v == null) break;
    v = v[p];
  }
  if (typeof v === 'string') return v;
  // fallback to pt-BR
  let w: any = ptBR;
  for (const p of path) {
    if (w == null) break;
    w = w[p];
  }
  return typeof w === 'string' ? w : key;
}

type Ctx = { locale: Locale; setLocale: (l: Locale) => void; t: (key: string) => string };
const LocaleCtx = createContext<Ctx | null>(null);

function detectDeviceLocale(): Locale {
  try {
    const dev = getLocales()?.[0]?.languageTag?.toLowerCase() ?? '';
    if (dev.startsWith('pt')) return 'pt-BR';
    if (dev.startsWith('es')) return 'es';
    return 'en';
  } catch { return 'pt-BR'; }
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('pt-BR');

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem<string>(LOCALE_KEY, '' as any);
      if (stored === 'pt-BR' || stored === 'en' || stored === 'es') {
        _currentLocale = stored;
        setLocaleState(stored);
        return;
      }
      const detected = detectDeviceLocale();
      _currentLocale = detected;
      setLocaleState(detected);
    })();
  }, []);

  const setLocale = (l: Locale) => {
    _currentLocale = l;
    setLocaleState(l);
    storage.setItem(LOCALE_KEY, l);
  };

  const value = useMemo(() => ({ locale, setLocale, t }), [locale]);
  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

export function useLocale(): Ctx {
  const c = useContext(LocaleCtx);
  if (!c) return { locale: 'pt-BR', setLocale: () => {}, t };
  return c;
}
