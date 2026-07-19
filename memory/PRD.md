# VitaTracker – PRD (MVP)

## Vision
Sistema mobile brasileiro de Controle Inteligente de Peso, Nutrição e Bem-estar, competindo com MyFitnessPal, Noom, YAZIO, Fitbit. Interface premium inspirada em Apple Health / Whoop, com IA (Gemini) para análise nutricional por foto.

## Stack
- **Mobile**: Expo SDK 54 + React Native + Expo Router + Reanimated + Gesture Handler + react-native-svg
- **Backend**: FastAPI + Python (Motor async) + MongoDB
- **Auth**: JWT (email/senha) + Emergent-managed Google Auth
- **IA**: Google Gemini 2.5 Flash via Emergent LLM Key (análise de fotos de refeição)
- **Idioma**: Português (Brasil)

## Features MVP
### Autenticação
- Cadastro (nome, e-mail, senha ≥6)
- Login e-mail/senha (JWT 30 dias)
- Login com Google (Emergent-managed)
- Perfil no `/api/auth/me`
- Logout (invalida sessão)

### Onboarding
- Passo 1: Sexo + Idade
- Passo 2: Altura + Peso atual + Peso meta
- Passo 3: Objetivo (perder/manter/ganhar) + Nível de atividade
- Passo 4: Resumo do plano com meta calórica calculada (Mifflin-St Jeor)

### Dashboard (Início)
- Calorias restantes com progresso
- Macros (proteína, carbo, gordura)
- Hidratação (registro rápido 200/300/500ml)
- Peso atual + Meta
- Contagem de refeições
- CTA IA para escanear refeição

### Diário Alimentar
- Refeições agrupadas: Café, Almoço, Jantar, Lanches
- Adicionar via IA (foto)
- Deletar refeição
- Total de calorias do dia

### Escanear Refeição (IA)
- Câmera ou Galeria
- Envio base64 → Gemini 2.5 Flash
- Retorna: nome, porção, calorias, macros, dica
- Botão "Adicionar ao Diário"

### Progresso
- Cards: Peso atual, Meta, Variação
- Gráfico de peso (SVG line chart com meta e tendência)
- Range: 7d / 30d / 90d
- Registro de peso do dia
- Histórico das últimas 10 medições

### Perfil
- Nome, e-mail, provedor de auth (Google/E-mail)
- Metas & medidas (calorias, água, passos, peso, altura, objetivo)
- Segurança (biometria, 2FA, dispositivos) – placeholders "Em breve"
- Logout

## Endpoints REST (`/api`)
- POST /auth/register, /auth/login, /auth/google-session, /auth/logout
- GET /auth/me
- PUT /profile
- POST/GET /weight
- POST/GET /meals ; DELETE /meals/{id} ; POST /meals/analyze
- POST/GET /water, /exercises, /sleep, /mood
- GET /dashboard/summary

## Design tokens
- Personalidade: iOS-Native Clean (calming Sage Green #4A7258, warm off-white #F2F4F2)
- Radius pill para CTAs, cards com bordas suaves + shadows tier 1
- Tipografia bold para destaques, generous whitespace

## Próximas iterações
- Biometria (LocalAuthentication)
- 2FA por TOTP
- Recuperação de senha via e-mail
- Chat IA nutricionista
- Portais Admin/Nutri/Personal/Médico
- Integração com wearables (HealthKit/Google Fit)
- Streaks e gamificação
