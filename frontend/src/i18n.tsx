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
    food: 'Diário',
    progress: 'Progresso',
    profile: 'Perfil',
  },
  home: {
    greeting: 'Olá',
    weightCurrent: 'Peso atual',
    weightGoal: 'Meta',
    daysRemaining: 'dias restantes',
    caloriesRemaining: 'Calorias restantes',
    caloriesGoal: 'Meta',
    caloriesConsumed: 'Consumidas',
    caloriesBurned: 'Queimadas',
    protein: 'Proteína',
    carbs: 'Carbo',
    fat: 'Gordura',
    hydration: 'Hidratação',
    steps: 'Passos',
    sleep: 'Sono',
    activities: 'atividades',
    bodyComposition: 'Composição corporal',
    bodyCompositionSub: 'Peso, IMC, gordura, TMB, idade metabólica',
    fasting: 'Jejum Intermitente',
    fastingSub: 'Cronômetro, protocolos 16:8, 18:6, 20:4, OMAD',
    scanAI: 'Escanear com IA',
    scanAISub: 'Foto → macros em segundos',
    coachAI: 'Coach IA',
    coachAISub: 'Pergunte ao seu nutri',
    recipesTitle: 'Receitas IA',
    recipesSub: '3 receitas para seu objetivo em segundos',
    achievements: 'Conquistas',
    achievementsSub: 'XP, ranking global',
    community: 'Comunidade',
    communitySub: 'Feed & posts',
    shareWithPros: 'Compartilhar com profissionais',
    shareWithProsSub: 'PDF ou link para Nutri, Personal e Médico',
    companies: 'Empresas & Equipes',
    companiesSub: 'Plano corporativo, campanhas e desafios coletivos',
    progressPhotos: 'Fotos de progresso',
    viewAll: 'Ver todas',
    bmiUnder: 'Abaixo',
    bmiHealthy: 'Saudável',
    bmiOver: 'Sobrepeso',
    bmiObese: 'Obesidade',
  },
  food: {
    diaryTitle: 'Diário Alimentar',
    today: 'Hoje',
    kcalLogged: 'kcal registradas',
    breakfast: 'Café da manhã',
    lunch: 'Almoço',
    dinner: 'Jantar',
    snack: 'Lanches',
    addMeal: 'Adicionar refeição',
    addMore: 'Adicionar mais',
    scanAI: 'Scan IA',
  },
  progress: {
    title: 'Progresso',
    subtitle: 'Gráficos & tendências',
    daily: 'Diário',
    weekly: 'Semanal',
    monthly: 'Mensal',
    yearly: 'Anual',
    currentValue: 'atual',
    evolution: 'Evolução',
    avg: 'Média',
    min: 'Mín',
    max: 'Máx',
    weeklyTrend: 'Tendência semanal',
    predict30d: 'Previsão em 30 dias',
    showCompare: 'Comparar todas as métricas',
    hideCompare: 'Ocultar comparação',
    logNew: 'Registrar nova medição',
    inPeriod: 'no período',
    emptyChart: 'Registre mais medições para ver o gráfico.',
    metrics: {
      weight: 'Peso', bmi: 'IMC', body_fat: 'Gordura', muscle: 'Massa',
      water_pct: 'Água', arm: 'Braço', chest: 'Peito', abdomen: 'Abdômen',
      waist: 'Cintura', hip: 'Quadril', thigh: 'Coxa', calf: 'Panturrilha',
      neck: 'Pescoço', shoulders: 'Ombros',
    },
  },
  coach: {
    title: 'Coach IA',
    online: 'Online • Gemini 2.5 Flash',
    analyze: 'Analisar',
    analysisTitle: 'Sua análise',
    stagnation: 'Detectamos estagnação — hora de ajustar',
    strengths: 'Pontos fortes',
    opportunities: 'Oportunidades',
    nextActions: 'Próximas ações',
    welcomeTitle: 'Olá! Sou seu Coach IA',
    welcomeSub: 'Posso analisar sua evolução, sono, alimentação e sugerir metas. Como posso ajudar hoje?',
    placeholder: 'Pergunte ao seu coach…',
    suggest1: 'Como está minha evolução?',
    suggest2: 'O que posso melhorar na alimentação?',
    suggest3: 'Estou dormindo o suficiente?',
    suggest4: 'Me dê 3 metas para esta semana',
    suggest5: 'Como quebrar minha estagnação?',
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
    food: 'Diary',
    progress: 'Progress',
    profile: 'Profile',
  },
  home: {
    greeting: 'Hello',
    weightCurrent: 'Current weight',
    weightGoal: 'Goal',
    daysRemaining: 'days remaining',
    caloriesRemaining: 'Calories remaining',
    caloriesGoal: 'Goal',
    caloriesConsumed: 'Consumed',
    caloriesBurned: 'Burned',
    protein: 'Protein',
    carbs: 'Carbs',
    fat: 'Fat',
    hydration: 'Hydration',
    steps: 'Steps',
    sleep: 'Sleep',
    activities: 'activities',
    bodyComposition: 'Body composition',
    bodyCompositionSub: 'Weight, BMI, fat, BMR, metabolic age',
    fasting: 'Intermittent fasting',
    fastingSub: 'Timer, protocols 16:8, 18:6, 20:4, OMAD',
    scanAI: 'Scan with AI',
    scanAISub: 'Photo → macros in seconds',
    coachAI: 'AI Coach',
    coachAISub: 'Ask your nutri',
    recipesTitle: 'AI Recipes',
    recipesSub: '3 recipes for your goal in seconds',
    achievements: 'Achievements',
    achievementsSub: 'XP, global ranking',
    community: 'Community',
    communitySub: 'Feed & posts',
    shareWithPros: 'Share with professionals',
    shareWithProsSub: 'PDF or link for Nutri, Trainer and Doctor',
    companies: 'Companies & Teams',
    companiesSub: 'Corporate plan, campaigns and challenges',
    progressPhotos: 'Progress photos',
    viewAll: 'View all',
    bmiUnder: 'Underweight',
    bmiHealthy: 'Healthy',
    bmiOver: 'Overweight',
    bmiObese: 'Obesity',
  },
  food: {
    diaryTitle: 'Food Diary',
    today: 'Today',
    kcalLogged: 'kcal logged',
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snacks',
    addMeal: 'Add meal',
    addMore: 'Add more',
    scanAI: 'AI Scan',
  },
  progress: {
    title: 'Progress',
    subtitle: 'Charts & trends',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly',
    currentValue: 'current',
    evolution: 'Evolution',
    avg: 'Avg',
    min: 'Min',
    max: 'Max',
    weeklyTrend: 'Weekly trend',
    predict30d: '30-day forecast',
    showCompare: 'Compare all metrics',
    hideCompare: 'Hide comparison',
    logNew: 'Log new measurement',
    inPeriod: 'in period',
    emptyChart: 'Log more measurements to see the chart.',
    metrics: {
      weight: 'Weight', bmi: 'BMI', body_fat: 'Fat', muscle: 'Muscle',
      water_pct: 'Water', arm: 'Arm', chest: 'Chest', abdomen: 'Abdomen',
      waist: 'Waist', hip: 'Hip', thigh: 'Thigh', calf: 'Calf',
      neck: 'Neck', shoulders: 'Shoulders',
    },
  },
  coach: {
    title: 'AI Coach',
    online: 'Online • Gemini 2.5 Flash',
    analyze: 'Analyze',
    analysisTitle: 'Your analysis',
    stagnation: 'Stagnation detected — time to adjust',
    strengths: 'Strengths',
    opportunities: 'Opportunities',
    nextActions: 'Next actions',
    welcomeTitle: 'Hi! I\'m your AI Coach',
    welcomeSub: 'I can analyze your progress, sleep, meals and suggest goals. How can I help today?',
    placeholder: 'Ask your coach…',
    suggest1: 'How is my progress?',
    suggest2: 'What can I improve in my diet?',
    suggest3: 'Am I sleeping enough?',
    suggest4: 'Give me 3 goals for this week',
    suggest5: 'How to break my plateau?',
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
    food: 'Diario',
    progress: 'Progreso',
    profile: 'Perfil',
  },
  home: {
    greeting: 'Hola',
    weightCurrent: 'Peso actual',
    weightGoal: 'Objetivo',
    daysRemaining: 'días restantes',
    caloriesRemaining: 'Calorías restantes',
    caloriesGoal: 'Meta',
    caloriesConsumed: 'Consumidas',
    caloriesBurned: 'Quemadas',
    protein: 'Proteína',
    carbs: 'Carbs',
    fat: 'Grasa',
    hydration: 'Hidratación',
    steps: 'Pasos',
    sleep: 'Sueño',
    activities: 'actividades',
    bodyComposition: 'Composición corporal',
    bodyCompositionSub: 'Peso, IMC, grasa, TMB, edad metabólica',
    fasting: 'Ayuno intermitente',
    fastingSub: 'Cronómetro, protocolos 16:8, 18:6, 20:4, OMAD',
    scanAI: 'Escanear con IA',
    scanAISub: 'Foto → macros en segundos',
    coachAI: 'Coach IA',
    coachAISub: 'Pregúntale a tu nutri',
    recipesTitle: 'Recetas IA',
    recipesSub: '3 recetas para tu objetivo en segundos',
    achievements: 'Logros',
    achievementsSub: 'XP, ranking global',
    community: 'Comunidad',
    communitySub: 'Feed & posts',
    shareWithPros: 'Compartir con profesionales',
    shareWithProsSub: 'PDF o enlace para Nutri, Trainer y Médico',
    companies: 'Empresas & Equipos',
    companiesSub: 'Plan corporativo, campañas y desafíos',
    progressPhotos: 'Fotos de progreso',
    viewAll: 'Ver todas',
    bmiUnder: 'Bajo peso',
    bmiHealthy: 'Saludable',
    bmiOver: 'Sobrepeso',
    bmiObese: 'Obesidad',
  },
  food: {
    diaryTitle: 'Diario Alimentar',
    today: 'Hoy',
    kcalLogged: 'kcal registradas',
    breakfast: 'Desayuno',
    lunch: 'Almuerzo',
    dinner: 'Cena',
    snack: 'Snacks',
    addMeal: 'Agregar comida',
    addMore: 'Agregar más',
    scanAI: 'Escaneo IA',
  },
  progress: {
    title: 'Progreso',
    subtitle: 'Gráficos y tendencias',
    daily: 'Diario',
    weekly: 'Semanal',
    monthly: 'Mensual',
    yearly: 'Anual',
    currentValue: 'actual',
    evolution: 'Evolución',
    avg: 'Prom',
    min: 'Mín',
    max: 'Máx',
    weeklyTrend: 'Tendencia semanal',
    predict30d: 'Previsión 30 días',
    showCompare: 'Comparar todas las métricas',
    hideCompare: 'Ocultar comparación',
    logNew: 'Registrar nueva medición',
    inPeriod: 'en el período',
    emptyChart: 'Registra más mediciones para ver el gráfico.',
    metrics: {
      weight: 'Peso', bmi: 'IMC', body_fat: 'Grasa', muscle: 'Músculo',
      water_pct: 'Agua', arm: 'Brazo', chest: 'Pecho', abdomen: 'Abdomen',
      waist: 'Cintura', hip: 'Cadera', thigh: 'Muslo', calf: 'Pantorrilla',
      neck: 'Cuello', shoulders: 'Hombros',
    },
  },
  coach: {
    title: 'Coach IA',
    online: 'Online • Gemini 2.5 Flash',
    analyze: 'Analizar',
    analysisTitle: 'Tu análisis',
    stagnation: 'Estancamiento detectado — hora de ajustar',
    strengths: 'Fortalezas',
    opportunities: 'Oportunidades',
    nextActions: 'Próximas acciones',
    welcomeTitle: '¡Hola! Soy tu Coach IA',
    welcomeSub: 'Puedo analizar tu evolución, sueño, alimentación y sugerir metas. ¿Cómo puedo ayudar hoy?',
    placeholder: 'Pregúntale a tu coach…',
    suggest1: '¿Cómo va mi progreso?',
    suggest2: '¿Qué puedo mejorar en mi dieta?',
    suggest3: '¿Estoy durmiendo lo suficiente?',
    suggest4: 'Dame 3 metas para esta semana',
    suggest5: '¿Cómo romper mi estancamiento?',
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
