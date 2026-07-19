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

## Módulo 4 – Controle de Peso (v1.2)
Screen `/weight-log` com:
- Hero lime com peso em destaque
- Data (dd/mm/aaaa) e Hora (HH:MM)
- Origem: **Manual** ou **Balança Bluetooth** (hint "em breve")
- Observação (textarea)
- Composição corporal opcional: gordura %, massa muscular kg, água %, cintura cm, quadril cm

Análises expostas em Progress:
- Peso Atual, Diferença no período, Média/Mín/Máx
- **Tendência semanal** (regressão linear per-day × 7)
- **Peso Previsto em 30 dias** (extrapolação da regressão)
- Marcador previsto (círculo lime dashed) no gráfico

## Módulo 5 – Gráficos (v1.2)
Progress tab agora suporta:
- **Períodos**: Diário (7d), Semanal (30d), Mensal (180d), Anual (730d)
- **Métricas**: Peso, IMC, Gordura, Massa, Água, Cintura, Quadril
- **Comparação**: grid 2x com mini-charts de todas as métricas
- IMC derivado de altura + peso, formato profissional com trend line + área

Endpoints:
- `GET /api/analytics/weight?metric=<m>&period=<p>` → series + stats
- `GET /api/analytics/compare?period=<p>` → todas as métricas para comparação

## Módulo 7 – Medidas Corporais (v1.3)
Weight-log estendido com **9 medidas cm**: Braço, Peito, Abdômen, Cintura, Quadril, Coxa, Panturrilha, Pescoço, Ombros — seção colapsável "Medidas corporais".
Progress tab agora expõe **14 métricas** total (peso, IMC, gordura, massa, água, + 9 medidas), cada uma com gráfico individual e comparação.

## Módulo 8 – Hidratação (v1.3)
Screen `/water` com:
- Hero sky com valor + meta + progresso + %
- Registro rápido (150/200/300/500/750 ml)
- **Meta diária editável** (persistida via `PUT /profile { daily_water_ml_goal }`)
- **Lembretes** com switch (persistido em AsyncStorage; notificações reais requerem build nativo)
- Lista "Hoje" com hora de cada registro
- Histórico de 14 dias com barras de progresso

## Módulo 9 – Alimentação (v1.3)
Screen `/food-add` com 4 tabs:
- **Buscar**: banco curado com 20 alimentos pt-BR (calorias + macros) e busca instantânea
- **Favoritos**: lista persistente por usuário (`POST/GET/DELETE /foods/favorites`)
- **Barra**: lookup via **OpenFoodFacts** (`GET /foods/barcode/{code}` — API pública gratuita, produtos BR)
- **Manual**: cadastro livre (nome + macros)
Modal de porções para confirmar quantidade antes de salvar.

## Módulo 10 – Jejum Intermitente (v1.3)
Screen `/fasting` com:
- **Cronômetro anel SVG** com % de progresso (tick a cada segundo)
- Protocolos: **16:8, 18:6, 20:4, OMAD** com descrição e badge lime
- Iniciar / Encerrar com um toque
- Histórico com ícone de status (✔ concluído, ⏱ parcial, ✕ cancelado) e barra
- Endpoints: `POST /fasting/start`, `POST /fasting/stop`, `GET /fasting/current`, `GET /fasting`, `DELETE /fasting/{id}`
Screen `/photos` com 3 tabs:
- **Álbum** – grid 2 colunas com data + delete
- **Linha do tempo** – agrupado por mês, scroll horizontal
- **Comparador IA** – seleção Antes/Depois com scroll horizontal de thumbnails, botão "Sugerir par" (primeiro + último), botão **"Analisar com IA"** (Gemini 2.5 Flash)

Análise IA retorna:
- `progress_score` (0-100) com badge lime
- `summary` (frase resumo)
- `changes` (lista de mudanças observadas)
- `encouragement` (mensagem motivacional)

Endpoint: `POST /api/photos/compare` `{ photo_id_before, photo_id_after }`

## Próximas iterações
- Chat IA real no /coach (streaming Gemini)
- Biometria (expo-local-authentication)
- 2FA por TOTP
- Recuperação de senha via SendGrid/Resend
- Streaks / gamificação
- **Monetização Premium**: paywall com scan-IA ilimitado + Coach IA + relatório semanal
