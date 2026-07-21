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

