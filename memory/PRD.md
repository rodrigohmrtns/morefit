# VitaTracker – PRD (v1.1 – Módulos 2 & 3)

## Vision
App mobile brasileiro premium de Controle Inteligente de Peso, Nutrição e Bem-estar. Estética inspirada em Whoop / Apple Health com acento lime (#C6F14B).

## Stack
- **Mobile**: Expo SDK 54 + React Native + Expo Router + Reanimated + react-native-svg + expo-image-picker
- **Backend**: FastAPI + Motor async + MongoDB
- **Auth**: JWT (email/senha) + Emergent-managed Google Auth
- **IA**: Google Gemini 2.5 Flash via Emergent LLM Key
- **Idioma**: pt-BR

## Módulo 1 – Autenticação (v1.0)
Registro, login e-mail/senha (JWT 30d), login Google (Emergent), logout, `/auth/me`.

## Módulo 2 – Perfil (v1.1)
Screen `/profile-edit` com:
- Foto de perfil (galeria, base64, avatar circular com badge)
- Nome, Sexo (Masculino/Feminino/Outro)
- Data de nascimento (dd/mm/aaaa validada)
- Altura, Peso Inicial, Peso Atual (registra novo), Peso Meta
- Objetivo: Perder Peso, Ganhar Massa, Manter Peso, **Melhorar Saúde**
- Data-meta (dd/mm/aaaa) para "dias restantes"

Perfil (tab) inclui:
- Header com ícone de edição
- Avatar clicável (leva para edição)
- **Aparência**: Claro / Escuro / Sistema (persistido em AsyncStorage)
- Metas & Medidas
- Segurança (biometria/2FA – "Em breve")
- Logout

## Módulo 3 – Dashboard (v1.1)
Cards implementados na home (`/(tabs)/index.tsx`):
- **Frase motivacional** do dia (endpoint `/api/motivation` — 10 frases determinísticas)
- **Hero dark**: Peso Atual + Meta + Dias Restantes + IMC (com classificação)
- **Calorias**: restantes + progresso + meta/consumidas/queimadas
- **Macros**: proteína / carbo / gordura em cards pastel
- **Hidratação** (card sky, botões +200/+300/+500 ml)
- **Passos** (card lavender, +500 no toque)
- **Sono** (card peach, comparado com meta)
- **Exercícios** (card mint, minutos totais)
- **CTAs**: Escanear com IA (lime) e Coach IA (dark)
- **Fotos de progresso**: strip horizontal com botão adicionar

## Backend – novos endpoints
- `GET /api/motivation` – frase motivacional do dia
- `POST/GET/DELETE /api/photos` – fotos de progresso (base64)
- `POST /api/steps` – passos do dia (upsert por data)
- `GET /api/dashboard/summary` – agora retorna: bmi, days_remaining, steps, sleep, exercises, photos, weight (current/starting/goal)
- Campo `photo_base64`, `target_date`, `daily_sleep_hours_goal` em `users`
- Novo valor de goal: `improve_health`

## Screens novos
- `/profile-edit` – edição completa do perfil
- `/photos` – lista de fotos de progresso com add/delete
- `/coach` – tela do Coach IA (placeholder com dicas)

## Design System – v1.1
- **Modo Claro & Escuro** com toggle sistema/claro/escuro persistido
- Acento **lime #C6F14B** substitui sage green
- Superfícies pastel: peach, lavender, coral, mint, sky, butter
- Cards com radius 24, chips 999
- Tipografia bold + generous whitespace

## Testado
- Backend endpoints (13/13 no MVP + novos endpoints testados via curl)
- Frontend: onboarding, login, home (light + dark), profile (com toggle de tema), profile-edit

## Próximas iterações
- Chat IA real no /coach (streaming Gemini)
- Biometria (expo-local-authentication)
- 2FA por TOTP
- Recuperação de senha via SendGrid/Resend
- Streaks / gamificação
- **Monetização Premium**: paywall com scan-IA ilimitado + Coach IA + relatório semanal
