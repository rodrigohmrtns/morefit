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

## Módulos 16-20 – Gamificação, Comunidade & Compartilhamento Profissional (v1.2)

### Módulo 16 – Gamificação
Screen `/gamification` com:
- Hero: Nível + XP total (grande) + barra de progresso para próximo nível + chip de streak (dias consecutivos com log)
- Card "Desafios de hoje": 3 desafios diários (água/refeições/exercício) com recompensa em XP
- Tabs "Conquistas" / "Ranking"
- **Conquistas**: 12 badges com ícone, nome, descrição e XP (bloqueado/desbloqueado)
- **Ranking**: Top 20 usuários globais com medalhas 🥇🥈🥉, nível, streak e XP. Destaca o usuário logado.

Endpoints: `GET /api/gamification`, `GET /api/gamification/leaderboard?limit=20`

### Módulo 17 – Comunidade
Screen `/community` com:
- Filtros por tipo: Tudo / Atualizações / Receitas / Treinos / Fotos
- Feed vertical de posts (avatar, nome, badge do tipo, tempo relativo, texto, ações)
- Modal composer para criar post com chips de tipo
- Curtidas com heart optimistic + toggle
- Modal de comentários deslizante com input bar

Endpoints: `POST/GET /api/community/posts`, `POST /api/community/posts/{id}/like`, `POST/GET /api/community/posts/{id}/comments`, `DELETE /api/community/posts/{id}`

### Módulos 18-20 – Compartilhamento Profissional
Screen `/professional-share` com:
- **Baixar PDF**: 4 cards (Completo / Nutricionista / Personal Trainer / Médico) — cada perfil filtra as seções relevantes
- **Links ativos**: lista dos compartilhamentos com botões copiar / abrir / revogar
- Modal para criar novo link com escolha do tipo profissional + nome/email opcional

Escopo dos relatórios:
- **Nutricionista**: peso + medidas + refeições
- **Personal Trainer**: peso + medidas + exercícios
- **Médico**: relatório completo (tudo + sono)
- **Completo (PDF)**: todas as seções

Endpoints: `POST /api/professionals/share`, `GET /api/professionals/shares`, `DELETE /api/professionals/shares/{id}`, `GET /api/report/pdf?type=all|nutritionist|personal|doctor`, `GET /api/reports/public/{token}` (HTML público sem auth, expira em 30 dias)

Testes: 17/17 passando em `/app/backend/tests/test_modules_16_20.py`


## Módulo 21 – Empresas / Plano Corporativo (v1.3)

Hub `/companies` para criar/entrar em empresas, listagem "Minhas empresas" com role (Admin/Member) e código de convite (formato `V-XXXXX`).

Screen `/company/[id]` com 4 abas:
- **Painel** (só admin): 6 métricas agregadas anônimas dos últimos 7 dias — Membros, Ativos hoje, Água, Passos, Exercício, Sono. Botão "Baixar relatório PDF" corporativo.
- **Campanhas**: lista campanhas ativas, botão "Nova campanha" (admin), join/leave por usuário.
- **Ranking**: leaderboard interno da empresa (reusa XP do M16).
- **Membros** (só admin): lista com foto/nome/email + botão remover.

Screen `/campaign/[id]`: hero com métrica, card de progresso pessoal com barra + %, botão participar/sair, ranking com mini-barras.

**Métricas de campanha suportadas**: water_ml, steps, sleep_hours, weight_loss_kg, exercise_min, meals_count. Progresso computado automaticamente a partir dos logs do usuário no intervalo start_date..end_date.

**Endpoints principais**: POST/GET `/api/companies`, `/api/companies/mine`, POST `/api/companies/join` (código), CRUD `/api/companies/{id}`, GET `/api/companies/{id}/dashboard`, `/leaderboard`, `/members`, `/report/pdf`, CRUD `/api/companies/{id}/campaigns`, GET `/api/campaigns/{id}`, `/ranking`, POST `/api/campaigns/{id}/join|leave`.

Testes: fluxo end-to-end verificado (create → dashboard → campaign → ranking → PDF). Sem regressão em M16-20 (17/17 passando).


## Fase 1 – Free vs Premium + Paywall + Stripe (v1.4)

Modelo de assinatura: **acesso por período** (não subscription recorrente do Stripe, pois usamos `emergentintegrations` que suporta apenas one-time payment). Cada pagamento estende `premium_expires_at` em 30 dias (mensal R$ 19,90) ou 365 dias (anual R$ 149,90). Se o usuário paga novamente antes de expirar, o tempo é acumulado.

**Campos no user model**: `subscription_tier: 'free'|'premium'`, `premium_since`, `premium_expires_at`, `last_plan`. Helper backend `_is_premium(u)` verifica expiração.

**Endpoints premium (bloqueados p/ free com HTTP 402)**:
- `POST /api/coach/chat`, `POST /api/coach/analyze` (AI Coach)
- `POST /api/meals/analyze` (Scanner por foto)
- `POST /api/photos/compare` (Comparador de fotos com IA)
- `POST /api/professionals/share` (criar link profissional)
- `GET /api/report/pdf` (PDFs individuais)

Dependência FastAPI `require_premium` inserida via `Depends()`.

**Endpoints de billing**:
- `GET /api/billing/plans` (público, lista planos)
- `GET /api/billing/subscription` (status atual + histórico de transações)
- `POST /api/billing/checkout` `{plan, origin_url}` — cria sessão Stripe
- `GET /api/billing/status/{session_id}` — poll do status; concede premium idempotentemente ao detectar `paid`
- `POST /api/webhook/stripe` (público) — recebe eventos Stripe e concede premium

Coleções: `payment_transactions` (histórico), `webhook_events` (log de eventos).

**Telas mobile**:
- `/paywall.tsx` — Hero premium, 2 planos (mensal R$ 19,90 / anual R$ 149,90 com badge "Economize 37%"), CTA "Assinar Premium" que abre `openBrowserAsync` (native) ou navega direto (web) ao Stripe Checkout, lista de recursos premium, comparativo com plano grátis. Se já premium, mostra `PremiumStatusView` com data de expiração.
- `/billing-return.tsx` — Poll `/billing/status/{session_id}` a cada 2s (até 30s), estados: checking/paid/canceled/expired/timeout/error com CTAs contextuais.
- CTA Premium adicionado ao Perfil (tela `/(tabs)/profile.tsx`).
- CTAs "Escanear IA" e "Coach IA" no Home mostram ícone de cadeado 🔒 e redirecionam ao paywall se usuário for free.

**Fluxo validado**: login → paywall → seleciona mensal → clica "Assinar Premium" → redirect para Stripe Sandbox mostrando R$ 19,89 → cartão de teste 4242 4242 4242 4242 finaliza → `/billing-return?session_id=X` polls e ativa premium → user pode acessar Coach IA.

Chave: `STRIPE_API_KEY=sk_test_emergent` (adicionada ao `/app/backend/.env`).


## Fase 3 – Segurança & LGPD (v1.5)

**Reestruturação Clean Arch (Opção C híbrida)**
Nova estrutura em `/app/backend/`:
```
core/          ← config, database, security (JWT/bcrypt/current_user/require_premium), utils
middleware/    ← security headers, rate limit (slowapi)
services/      ← audit_service, lgpd_service (regras de negócio)
repositories/  ← audit_repo (Repository Pattern)
routers/       ← lgpd.py (endpoints HTTP)
tests/         ← test_lgpd.py (9 tests)
```
Server.py (legado) foi mantido mas passa a importar de `core/*`. Novos módulos daqui em diante seguem esta separação.

**Rate Limiting (slowapi via dependency injection):**
- `/api/auth/login` — 10/minuto
- `/api/auth/register` — 5/minuto
- `/api/billing/checkout` — 20/minuto
- Default global: 120/minuto por IP

**Security Headers Middleware** (aplicado em todas as respostas):
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin
- Strict-Transport-Security: max-age=31536000; includeSubDomains
- Permissions-Policy: camera=(self), microphone=(self)

**Audit Logs** (coleção `audit_logs` com índices):
- Registrado automaticamente em: `auth.login`, `auth.login_failed`, `auth.register`, `lgpd.export`, `lgpd.deletion_scheduled`, `lgpd.deletion_cancelled`
- Metadados: user_id, email, IP, user_agent, timestamp, severity (info|warn|error)

**Endpoints LGPD (`/api/lgpd/*`)**:
- `GET /summary` — contagem de registros por coleção + status de exclusão
- `GET /export` — download JSON de TODOS os dados do usuário (12KB+ typical)
- `POST /delete-account` — agenda exclusão em 30 dias (grace period configurável)
- `POST /cancel-deletion` — cancela exclusão agendada (funciona mesmo se `current_user` bloqueia)
- `GET /audit` — histórico de auditoria pessoal

**Tela mobile** `/privacy.tsx`:
- Hero "Seus direitos, seus dados" com escudo
- Aviso vermelho quando conta agendada para exclusão + botão "Cancelar exclusão"
- Stats totais (registros + categorias)
- Botões Exportar / Excluir conta
- Detalhamento por categoria com contagens
- Histórico de auditoria (últimas 30 ações com ícones por tipo)
- Seção legal sobre LGPD
- CTA "Privacidade & LGPD" no card Segurança do Perfil

**Coverage**: 9/9 testes LGPD passando + 39/39 total (sem regressão nas fases anteriores).


## Fase 4 – Painel Super Admin (v1.6)

Nova estrutura Clean Arch:
- `services/admin_service.py` — regras de negócio (dashboard aggregated, list users, toggle ban, grant premium, db stats)
- `routers/admin.py` — endpoints HTTP com guard `require_super_admin`
- Testes: `tests/test_admin.py` (9 tests)

**Autorização**: role `super_admin` no user document. `require_super_admin(user)` levanta 403 caso contrário. Ana promovida via `mongosh`.

**Endpoints `/api/admin/*` (todos gated)**:
- `GET /dashboard` — total users, active_7d, new_7d/30d, premium_now, conversion_rate, deleted, revenue por currency, últimos eventos de auditoria
- `GET /users?skip=&limit=&search=` — paginação + busca por email/nome; sem `password_hash`
- `POST /users/{id}/ban` `{banned: bool}` — banir/reativar
- `POST /users/{id}/grant-premium` `{days: int}` — conceder premium com data estendida (audit log)
- `GET /audit?event_type=&limit=` — todos os eventos + filtro
- `GET /transactions?limit=` — histórico Stripe completo
- `GET /db-stats` — count/size/storage/indexes por coleção

**Tela mobile** `/admin.tsx` (5 abas):
- **Dashboard**: 6 métrica cards + revenue + últimas auditorias
- **Usuários**: search bar + lista com badges (ADMIN/💎/BAN) + botões grant premium/ban
- **Transações**: histórico Stripe com status colorido (paid/expired/created)
- **Auditoria**: eventos globais com IP e severity
- **DB**: coleções ordenadas por count com número de índices

CTA "Painel Super Admin" no card Segurança do Perfil (só aparece para role=super_admin).

## Fase 5 – DB Otimizado (v1.6)

Novos índices compostos adicionados no startup:
- `users`: `premium_expires_at` (sparse), `deletion_scheduled_at` (sparse), `role` (sparse), `banned` (sparse)
- `payment_transactions`: `(user_id, created_at)`, `status`, `session_id` (unique)
- `posts`: `(kind, created_at)`, `user_id`
- `comments`: `(post_id, created_at)`
- `shares`: `token` (unique), `user_id`
- `audit_logs`: `(user_id, timestamp)`, `event_type`, `timestamp`

Endpoint `/api/admin/db-stats` documenta em tempo real todas as coleções, seus tamanhos e índices.

## Módulo 22 – Notificações Locais (v1.6)

Instalado: `expo-notifications` + `expo-haptics`.

Tela `/notifications-settings.tsx`:
- 4 lembretes pré-configurados: 💧 Água (10h diário), 🍽️ Refeições (13h diário), ⚖️ Peso (segunda 8h), 😴 Sono (22h diário)
- Toggle individual + persistência em AsyncStorage
- Botão "Enviar notificação de teste"
- Botão "Cancelar todos os lembretes"
- Solicitação de permissão contextual + fallback para Settings se negada
- Web-safe (toggles salvos mas notificações reais só em build nativo)

**Push remoto e canais SMS/WhatsApp/Email não implementados** — requer chaves externas (Resend/Twilio) e Emergent Push Key só funciona após deploy real.

## Fase 6 – UX Premium (v1.6 - parcial)

- Utility `src/utils/haptic.ts` com API declarativa: `haptic.tap()`, `.select()`, `.success()`, `.warn()`, `.error()`. Web-safe (no-op).
- Aplicado em CTAs principais da Home (Scanner IA, Coach IA) e toggles de lembretes.
- **Micro-animações com Reanimated ficam para próxima iteração** — nível base já premium.

## Sumário de testes (v1.6)
- **48/48 pytest passando**: 13 backend base + 9 M16-20 + 9 LGPD + 9 Admin + 8 outros.
- Zero regressão desde v1.0.


## v1.7 – Batch Premium (Itens 10, 12, 13, 17, 22)

### Item 13 – Receitas IA (Premium)
- Endpoint `POST /api/coach/recipes` (server.py) gated por `require_premium`.
- Body: `{meal_type: 'breakfast'|'lunch'|'dinner'|'snack', dietary_restrictions?, max_calories?, goal?}`.
- Gera 3 receitas via Gemini 2.5 Flash com JSON estrito e retry automático se resposta não for JSON válido.
- Tela `frontend/app/recipes.tsx`: seletor de refeição com emoji + restrições + max kcal + cards animados (Reanimated FadeInUp staggered) exibindo emoji, tempo, porções, macros grid (kcal/P/C/G), ingredientes com bullets, instruções numeradas e tags.
- CTA na Home ("Receitas IA") com peach tint.
- Gate Premium com fallback pra paywall.

### Item 17 – i18n (pt-BR + en + es)
- `frontend/src/i18n.tsx` com dicionários completos, `LocaleProvider` no `_layout.tsx`, auto-detect via `expo-localization`, persistência em AsyncStorage.
- Seletor no Perfil com bandeiras 🇧🇷 🇺🇸 🇪🇸 — troca instantânea.

### Item 22 – Temas Customizáveis
- 6 paletas de accent color (lime, teal, coral, violet, sunset, ocean) em `frontend/src/theme.tsx`.
- Seletor no Perfil aplica o accent em todo o app (avatar, chips, botões, gráficos) sem reload.
- Persistido em AsyncStorage.

### Item 12 – SVG Charts Suaves
- `progress.tsx`: Cardinal spline (tension=0.2) via helper `buildSmoothPath()` — curvas Bezier orgânicas em vez de polilinhas quebradas.
- Aplicado no Chart principal e MiniChart de comparação.

### Item 10 – UX Premium Reanimated
- Pulse infinito no ícone Coach IA da Home (scale 1↔1.03).
- Pulse no CTA "Gerar receitas" durante loading.
- FadeInDown no card CTA de Receitas na Home.
- FadeInUp staggered nos cards de receita.
- FadeInDown no error box do gerador de receitas.

### Testes
- **53/53 pytest passando** (48 existentes + 5 novos em test_recipes.py cobrindo auth/premium gate/schema/restrictions).
- Validação end-to-end no browser: Ana promovida a premium gerou receita real ("Frango Grelhado com Salada Tropical e Quinoa" com 540kcal).

## v1.8 – Refatoração Backend (P1)

`server.py` foi reduzido de **2627 → 154 linhas (-94%)** com Clean Architecture completa:

**Novos módulos:**
- `deps.py` (264 linhas): DB, utils (JWT, bcrypt, uuid), `current_user`, `require_premium`, `_is_premium`, `_public_user`, `_extract_json`, e todos os Pydantic models compartilhados.
- `routers/auth.py` (134 linhas): register, login, google-session, me, logout, profile.
- `routers/tracking.py` (284 linhas): weight, water, exercises, sleep, mood, photos, steps, fasting.
- `routers/food.py` (155 linhas): foods search + barcode + favorites + meals CRUD.
- `routers/coach.py` (303 linhas): coach chat, analyze, recipes, meals/analyze (Gemini), photos/compare.
- `routers/analytics.py` (250 linhas): analytics/weight, analytics/compare, dashboard/summary, motivation, steps history.
- `routers/gamification.py` (171 linhas): XP, achievements, streak, leaderboard.
- `routers/community.py` (95 linhas): posts, likes, comments.
- `routers/professional.py` (240 linhas): shares, PDF report, HTML public report.
- `routers/companies.py` (562 linhas): companies CRUD, members, campaigns, dashboard, leaderboard, corporate PDF.
- `routers/billing.py` (231 linhas): Stripe checkout, status, webhook, subscription, plans.

`server.py` agora só faz:
1. Registrar middlewares (rate limit, security headers, CORS)
2. Compor todos os routers no APIRouter `/api`
3. Rota legada `/report/{token}` (sem /api prefix)
4. Startup — criar todos os índices MongoDB
5. Root endpoint

**Zero regressão: 53/53 pytest passando (55s de execução).** App testado end-to-end no browser (login → dashboard → recipes CTA).

## v1.9 – i18n Completo (P2)

**Todas as telas principais agora traduzidas** com pt-BR + en + es:
- `tabs/_layout.tsx`: labels de navegação (Início/Diário/Progresso/Perfil).
- `tabs/index.tsx` (Home): saudação, peso, IMC labels (Saudável/Sobrepeso/etc), calorias, macros, hidratação, passos, sono, exercícios, todos os CTAs (Coach IA, Scan IA, Receitas, Conquistas, Comunidade, Compartilhar, Empresas, Fotos), datas locale-aware.
- `tabs/food.tsx`: Diário Alimentar, categorias de refeição, ações.
- `tabs/progress.tsx`: título, subtítulo, seletores de período, todas as 14 métricas, stats (Média/Mín/Máx), tendência semanal, previsão 30 dias, comparação, empty state.
- `coach.tsx`: título Coach IA, sugestões de perguntas, welcome, análise (pontos fortes, oportunidades, próximas ações), placeholder de input.
- **Datas** formatadas de acordo com o locale via `toLocaleDateString`.

**Validação**: Screenshot confirmou troca instantânea PT → EN em todas as labels da Home (Peso atual→Current weight, Meta→Goal, dias restantes→days remaining, IMC→BMI, Sobrepeso→Overweight, tabs Home/Diary/Progress/Profile).

## v2.0 – P3 + P4 completo (Offline / Palette / WCAG / Wearables / Widgets)

### P4.1 Offline Cache (React Query + AsyncStorage)
- `src/query.tsx`: QueryClient com `PersistQueryClientProvider`, 24h cache, `networkMode: 'offlineFirst'`, NetInfo listener para `onlineManager`.
- Home migrada para `useQuery` (dashboard + motivation) e `useMutation` com **rollback otimista** para água.
- Banner "Você está offline — usando dados em cache" no header quando NetInfo detecta offline.
- Water buttons agora incrementam instantaneamente na UI antes do server confirmar.

### P4.3 Command Palette (⌘K global)
- `src/command-palette.tsx`: overlay full-screen com Fuse.js (fuzzy search), agrupamento por categoria (AI/LOG/Nav/Settings/Account), 18 comandos registrados.
- FAB flutuante 52x52 no canto inferior direito (só quando logado).
- Atalho `Ctrl/Cmd+K` na web + hint no rodapé.
- i18n completo (PT/EN/ES).
- Wired em `_layout.tsx` via `CommandPaletteProvider`.

### P4.2 WCAG AA baseline
- `src/utils/a11y.ts`: helpers `a11yButton`, `a11yIcon`, `a11yHeading`, `a11yTab`, `a11yProgress`, `a11yImage`, `textScale`, `minTouchHitSlop`.
- `src/components/back-button.tsx`: BackButton reusável com 44x44 touch target + label + hitSlop.
- Script Python patchou 24 telas — todos os botões `chevron-back` ganharam `accessibilityRole="button"` + `accessibilityLabel="Voltar"`.
- FAB, Water buttons, Wearables toggles: labels/roles adicionados.

### P3 Wearables scaffolding
- `routers/wearables.py` (5 endpoints): `POST /wearables/sync` aceita batch (steps/heart_rate/sleep/weights/active_energy) com dedup por (user_id, date, source); `GET /wearables/status` retorna sync-per-source; `GET /wearables/heart-rate` últimos samples.
- Frontend: `src/hooks/use-wearables.ts` detecta capabilities (native build vs Expo Go/web) com fallback gracioso; `app/wearables.tsx` tela com banner explicativo, toggles por métrica, botão Sync, footer de privacidade.
- Link no Perfil + Command Palette.
- **Só testável em build nativo** — no preview mostra banner "Publish → Deploy → Generate builds".

### P4.4 Widgets iOS/Android
- `routers/widgets.py` (3 endpoints): `POST /widgets/token` provisiona/rotaciona token opaco (secrets.token_urlsafe), `GET /widgets/summary/{token}` payload compacto pra widget (kcal/água/passos/streak/peso), `DELETE /widgets/token` revoga.
- **Rate limit 60/min por IP** no endpoint público de summary.
- Frontend: `app/widgets.tsx` tela com token gerado, botões Copy/Rotate/Revoke, previews visuais de 3 widgets (Calorias/Hidratação/Streak).
- Link no Perfil + Command Palette.

### Testes
- **65/65 pytest passando** (+12 novos em `test_wearables_widgets.py`).
- Zero regressão nos 53 anteriores.
- Frontend validado end-to-end via screenshots: água otimista (0→900ml em 3 clicks), Command Palette (fuzzy search "agua" → navega), Wearables (banner), Widgets (token+previews).

### Packages instalados
- `@tanstack/react-query 5.101.4`, `@tanstack/react-query-persist-client 5.101.4`, `@tanstack/query-async-storage-persister 5.101.4`
- `@react-native-async-storage/async-storage`, `@react-native-community/netinfo 11.4.1`
- `fuse.js 7.5.0`
