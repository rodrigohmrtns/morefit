#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Modules 16-20: Gamification (XP, Levels, Achievements, Global Ranking),
  Community (Feed with likes and comments), and Professional PDF sharing
  (separated by professional profile + complete report).

backend:
  - task: "Gamification leaderboard endpoint"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Added /api/gamification/leaderboard computing XP per user (streak + activity counts), sorts, returns top 20 + my_rank."
        -working: true
        -agent: "testing"
        -comment: "Verified: is_me flag correct, rank starts at 1, sorted desc, my_rank present. 17/17 tests pass."
  - task: "Report PDF filtered by professional type"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "GET /api/report/pdf?type=all|nutritionist|personal|doctor. Public HTML now at /api/reports/public/{token} (was /report/{token} — moved under /api because K8s ingress only forwards /api/*). Legacy /report/{token} delegate kept for backward compat."
        -working: true
        -agent: "testing"
        -comment: "PDF endpoint returns %PDF- bytes + correct filename per type. Public HTML: nutri has 'Refeições recentes' but NOT 'Sono'/'Exercícios'; personal has 'Exercícios' but not 'Refeições'; doctor has 'Sono'. All assertions pass."
  - task: "Community CRUD (posts, likes, comments)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Endpoints already present: POST /api/community/posts, GET list (kind filter), like toggle, comments GET/POST, DELETE post."
        -working: true
        -agent: "testing"
        -comment: "Full CRUD verified end-to-end via pytest: create → list → filter → like toggle → comment → delete."

frontend:
  - task: "Gamification screen (achievements + ranking)"
    implemented: true
    working: "NA"
    file: "frontend/app/gamification.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Screen with hero (level, xp bar, streak), daily challenges, tabs Conquistas/Ranking. Manually verified via screenshot — renders correctly."
  - task: "Community feed screen (posts, filter, likes, comments)"
    implemented: true
    working: "NA"
    file: "frontend/app/community.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Modal composer with kind chips, feed with filter chips, optimistic like toggle, comments in slide-up modal with input bar. Manually verified: post created + rendered."
  - task: "Professional share screen (PDF grid + share links)"
    implemented: true
    working: "NA"
    file: "frontend/app/professional-share.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "4-card PDF grid (Completo/Nutri/Personal/Doctor), download via fetch+blob on web, Sharing.shareAsync on native. Share links list with copy/open/revoke actions. Modal to create new link."
  - task: "Home dashboard CTAs for M16-20"
    implemented: true
    working: "NA"
    file: "frontend/app/(tabs)/index.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Added Conquistas + Comunidade paired CTA + full-width Compartilhar CTA below AI Coach row."

metadata:
  created_by: "main_agent"
  version: "1.2"
  test_sequence: 2
  run_ui: true

test_plan:
  current_focus:
    - "Gamification leaderboard endpoint"
    - "Report PDF filtered by professional type"
    - "Gamification screen (achievements + ranking)"
    - "Community feed screen (posts, filter, likes, comments)"
    - "Professional share screen (PDF grid + share links)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: |
      Modules 16-20 built. Backend already had gamification + community + share endpoints; added:
      (1) /api/gamification/leaderboard for global ranking,
      (2) /api/report/pdf now accepts `type` query param filtering sections per professional,
      (3) public /report/{token} HTML filters sections by share.professional_type.
      Frontend added 3 screens: gamification.tsx, community.tsx, professional-share.tsx, plus Home CTAs.
      Test credentials: ana@example.com / secret123 (in /app/memory/test_credentials.md).
      Please validate:
        - GET /api/gamification (already existed) still returns xp/level/achievements/challenges
        - GET /api/gamification/leaderboard returns items + my_rank + total_users
        - Community: create post → list → toggle like (twice, idempotent per user) → add comment → list comments → delete post
        - GET /api/report/pdf and /api/report/pdf?type=nutritionist return application/pdf bytes
        - Frontend flows: from Home, navigate to Gamification (toggle tabs), Comunidade (create/like/comment post), Compartilhar (create link + copy)

# ==================== Módulo 21: Empresas (v1.3) ====================

backend:
  - task: "Companies CRUD + membership + invite code"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Endpoints: POST/GET /api/companies, /api/companies/mine, /api/companies/join (by code), GET/PATCH/DELETE /api/companies/{id}, POST /api/companies/{id}/leave, GET/DELETE /api/companies/{id}/members. Codes format 'V-XXXXX'. Verified via curl: create → list → dashboard → PDF."
  - task: "Corporate dashboard aggregated (anonymized)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "GET /api/companies/{id}/dashboard returns member_count, active_today, engagement_pct, totals (water/steps/exercise/meals) + averages. GET /api/companies/{id}/leaderboard reuses gamification XP. GET /api/companies/{id}/report/pdf builds corporate PDF (admin only)."
  - task: "Company campaigns/challenges"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "POST/GET /api/companies/{id}/campaigns, POST /api/campaigns/{id}/join|leave, GET /api/campaigns/{id}, GET /api/campaigns/{id}/ranking. Metrics: water_ml, steps, sleep_hours, weight_loss_kg, exercise_min, meals_count. Auto-computes progress from user logs within date range."

frontend:
  - task: "Companies hub screen"
    implemented: true
    working: true
    file: "frontend/app/companies.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Hub with create/join buttons + list of my companies with role badge + invite code. Modal for create (name + industry + plan chips) and join (code input). Manually verified via screenshot."
  - task: "Company detail screen (4 tabs)"
    implemented: true
    working: true
    file: "frontend/app/company/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Dynamic route /company/[id] with tabs Painel (admin only stats), Campanhas, Ranking, Membros (admin). Corporate PDF download, member remove, leave/delete company actions. All 4 tabs render correctly per screenshot."
  - task: "Campaign detail screen"
    implemented: true
    working: true
    file: "frontend/app/campaign/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Hero card with metric icon, my progress card with pct + bar, join/leave button, ranking with mini progress bars per user."

agent_communication:
    -agent: "main"
    -message: |
      Módulo 21 (Empresas) entregue completo (Fase A). Backend + frontend testados manualmente via curl e screenshots.
      - Criei empresa "Acme Tech" (plano Business), código V-6GAK1
      - Dashboard corporativo com métricas agregadas anônimas (7d)
      - Campanha "30 dias de hidratação" criada e usuário participando
      - Ranking interno funcionando
      - PDF corporativo gerando 1.5KB
      - 17/17 testes de M16-20 continuam passando (sem regressão)
      Próxima fase (aguardando confirmação do user): M22 Notificações (Push + Email + Lembretes).


# ==================== Fase 1: Free vs Premium + Paywall + Stripe (v1.4) ====================

backend:
  - task: "Premium tier + require_premium guard"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Added _is_premium(u), require_premium Depends. User model has premium_expires_at + subscription_tier + premium_since + last_plan. Guarded: /coach/chat, /coach/analyze, /meals/analyze, /photos/compare, /professionals/share, /report/pdf. All return HTTP 402 for free users, 200 for premium (verified via curl)."
  - task: "Stripe checkout endpoints (billing)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "POST /api/billing/checkout (creates Stripe session via emergentintegrations, saves tx doc), GET /api/billing/status/{session_id} (polls + applies premium idempotently), POST /api/webhook/stripe (handler applies premium on paid event), GET /api/billing/plans, GET /api/billing/subscription. Verified real Stripe test session created: cs_test_a1YyrqpkkGHibBpIyi4sRgBIQd7zG0Y5aqDHhqtZCkoGgi79s8gvbmkHfu."

frontend:
  - task: "Paywall screen"
    implemented: true
    working: true
    file: "frontend/app/paywall.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Hero, 2 planos com Economize 37% badge, CTA que abre openBrowserAsync (native) ou window.location (web) ao Stripe. Lista 8 features premium + comparativo com free. Se already premium, mostra PremiumStatusView com data de expiração e botão de renovar. Screenshot mostra ótima UX."
  - task: "Billing return + status polling"
    implemented: true
    working: true
    file: "frontend/app/billing-return.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Polls /api/billing/status/{session_id} a cada 2s até 15 tentativas. Estados: checking/paid/canceled/expired/timeout/error com CTAs contextuais. Chama refresh() para atualizar user context após ativação."
  - task: "Premium CTAs no Perfil + Home locked"
    implemented: true
    working: true
    file: "frontend/app/(tabs)/profile.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Perfil tem card 'Desbloqueie o Premium' amarelo com ícone diamante (muda para 'Você é Premium' quando ativo). Home mostra 🔒 nos CTAs Coach IA e Scanner e redireciona ao paywall para users free."

agent_communication:
    -agent: "main"
    -message: |
      Fase 1 (Paywall + Stripe) entregue e funcionando end-to-end.
      Modelo: pagamento one-time via Stripe (test key sk_test_emergent) que estende premium_expires_at em 30/365 dias.
      Fluxo real testado: login → /paywall → seleciona plano → checkout Stripe abre com R$19,89 → cartão 4242 finaliza → poll → premium ativado.
      Endpoints protegidos por Depends(require_premium): coach/chat, coach/analyze, meals/analyze, photos/compare, professionals/share, report/pdf.
      Cobertura de testes M16-20: continua 17/17 passando (backend, tests atualizados quando removi require_premium indireto).
      Aguardando feedback do user para iniciar Fase 2 (Mercado Pago) ou pular para Fase 3 (Segurança/LGPD).


# ==================== Fase 3: Segurança & LGPD (v1.5) ====================

backend:
  - task: "Reestruturação Clean Arch (core/routers/services/repositories/middleware)"
    implemented: true
    working: true
    file: "backend/{core,routers,services,repositories,middleware}/"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Extraído config, database, security, utils para core/. server.py legado ainda existe mas importa de core/. Novos módulos seguem separação HTTP router → application service → data repository."
  - task: "Rate limiting (slowapi via dependency)"
    implemented: true
    working: true
    file: "backend/middleware/security.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Approach com Depends() em vez de @limiter.limit decorator (evita conflitos com from __future__ import annotations). Aplicado em /auth/login (10/min), /auth/register (5/min), /billing/checkout (20/min)."
  - task: "Security headers middleware"
    implemented: true
    working: true
    file: "backend/middleware/security.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "5 headers aplicados: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS, Permissions-Policy. Validado via test."
  - task: "Audit service + repository"
    implemented: true
    working: true
    file: "backend/services/audit_service.py, backend/repositories/audit_repo.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Audit gravado automático em login (sucesso+falha), register, export, deletion_scheduled, deletion_cancelled. Metadados: user_id, ip, user_agent, timestamp, severity."
  - task: "LGPD service (export + delete + cancel)"
    implemented: true
    working: true
    file: "backend/services/lgpd_service.py, backend/routers/lgpd.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "5 endpoints: /lgpd/summary, /export (JSON), /delete-account (grace 30d), /cancel-deletion, /audit. USER_OWNED_COLLECTIONS documentado explicitamente. Password_hash nunca vaza no export."

frontend:
  - task: "Privacy screen (/privacy)"
    implemented: true
    working: true
    file: "frontend/app/privacy.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Screen com hero LGPD, aviso quando conta scheduled for deletion + botão cancelar, stats (total + categorias), botões export/delete, detalhamento por categoria, histórico de auditoria com ícones por tipo, seção legal. CTA no Perfil (card Segurança)."

tests:
  - task: "LGPD test coverage"
    implemented: true
    working: true
    file: "backend/tests/test_lgpd.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "9 tests cobrindo security headers, audit logs (login/failed_login), LGPD summary/export/delete/cancel, rate limiting. Zero regressão: 39/39 total (13 backend + 9 LGPD + 17 M16-20). Adicionei fixture premium_auth_headers em backend_test.py para gates."

agent_communication:
    -agent: "main"
    -message: |
      Fase 3 (Segurança & LGPD) entregue com Clean Arch light:
      - Reestruturação: core/, routers/, services/, repositories/, middleware/
      - Rate limiting via slowapi (dependency-based, evita conflito com from __future__ annotations)
      - 5 security headers aplicados
      - Audit trail automático em eventos sensíveis
      - LGPD completo: export JSON, delete c/ grace period 30d, cancel, summary, audit
      - Tela mobile Privacy funcionando (validada com screenshot)
      - 39/39 pytest passando (0 regressões)
      Próximas fases pendentes: Mercado Pago, Painel Super Admin, DB otimizado, UX Premium, Notificações.


# ==================== Fases 4+5+M22+6: Admin+DB+Notif+UX (v1.6) ====================

backend:
  - task: "Super Admin service + router"
    implemented: true
    working: true
    file: "backend/services/admin_service.py, backend/routers/admin.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "7 endpoints: /dashboard, /users (com search+paginação), /users/{id}/ban, /users/{id}/grant-premium, /audit, /transactions, /db-stats. Guard require_super_admin. Ana promovida a super_admin. 9/9 tests em test_admin.py passando."
  - task: "DB otimizado (índices compostos)"
    implemented: true
    working: true
    file: "backend/server.py (init_indexes)"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Adicionados 15+ índices em users, payment_transactions, posts, comments, shares, audit_logs. Verificados via /admin/db-stats: 19 coleções, users tem 7 índices, audit_logs 4, payment_transactions 4."

frontend:
  - task: "Painel Super Admin (/admin)"
    implemented: true
    working: true
    file: "frontend/app/admin.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "5 abas: Dashboard (6 métricas + revenue + auditoria), Usuários (search + grant/ban), Transações (Stripe), Auditoria global, DB stats. Guard client-side por role. CTA no Perfil (só super_admin). Validado com screenshot."
  - task: "Notificações locais (/notifications-settings)"
    implemented: true
    working: true
    file: "frontend/app/notifications-settings.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "4 lembretes pré-configurados (Água/Refeições/Peso/Sono) com toggles individuais, permissão contextual, teste imediato, cancel-all. Persistência em AsyncStorage. Web-safe. IMPORTANT: notificações REAIS só funcionam após publicar via Emergent Deploy (não em Expo Go)."
  - task: "UX Premium: haptic feedback"
    implemented: true
    working: true
    file: "frontend/src/utils/haptic.ts"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "API declarativa haptic.tap/select/success/warn/error. Web-safe. Aplicado em Home CTAs e toggles."

tests:
  - task: "Admin test coverage"
    implemented: true
    working: true
    file: "backend/tests/test_admin.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "9 tests cobrindo access control (403 non-admin), dashboard, list users com search, grant premium com audit, filter audit, db-stats, transactions. Zero regressão: 48/48 total (13 base + 9 M16-20 + 9 LGPD + 9 Admin + outros)."

agent_communication:
    -agent: "main"
    -message: |
      Fases 4, 5, M22 (parcial) e 6 (parcial) entregues em uma sessão:
      - Painel Super Admin completo com 5 abas
      - 15+ índices compostos adicionados no MongoDB
      - Lembretes locais via expo-notifications (4 reminders default)
      - Haptic feedback via expo-haptics em CTAs principais
      - 48/48 tests passando (0 regressão)

      PENDENTE (precisa de chaves ou features externas):
      - Fase 2 Mercado Pago (precisa MP_ACCESS_TOKEN)
      - M22 Push remoto Emergent (precisa deploy real)
      - M22 Email (precisa Resend/SendGrid)
      - M22 SMS/WhatsApp (precisa Twilio)
      - Fase 6 completa (Reanimated animations + skeletons — próxima iteração)



backend:
  - task: "AI Recipes endpoint (Item 13)"
    implemented: true
    working: true
    file: "backend/server.py POST /api/coach/recipes"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "Endpoint POST /coach/recipes gera 3 receitas via Gemini 2.5 Flash. Body: {meal_type, dietary_restrictions?, max_calories?, goal?}. Retorna {recipes:[{name, emoji, time_min, servings, ingredients, instructions, macros, tags}]}. Gated por require_premium. Testado com Ana (promovida premium): retornou receita 'Frango Grelhado com Salada Tropical e Quinoa' com macros completos."

frontend:
  - task: "AI Recipes screen (/recipes)"
    implemented: true
    working: true
    file: "frontend/app/recipes.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Tela premium: seletor de refeição (Café/Almoço/Jantar/Lanche), restrições, max kcal. Renderiza receitas com emoji, tempo, porções, macros (kcal/P/C/G), ingredientes com bullets, instruções numeradas, tags. Reanimated FadeInUp staggered. Premium gate integrado (paywall link). Validado end-to-end no browser."
  - task: "i18n (pt-BR + en + es)"
    implemented: true
    working: true
    file: "frontend/src/i18n.tsx, frontend/app/_layout.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "LocaleProvider wrappado no _layout. 3 idiomas (PT/EN/ES) com auto-detect via expo-localization + persistência AsyncStorage. Seletor no Perfil funcional — trocando pra Português muda instantaneamente todas as labels traduzidas."
  - task: "Custom accent colors (item 22)"
    implemented: true
    working: true
    file: "frontend/src/theme.tsx, frontend/app/(tabs)/profile.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "6 paletas: lime, teal, coral, violet, sunset, ocean. Seletor no Perfil aplica accent instantaneamente em todo app (avatar, chips, botões) via applyAccent(base, key). Persistido em AsyncStorage."
  - task: "SVG smooth Bezier charts (item 12)"
    implemented: true
    working: true
    file: "frontend/app/(tabs)/progress.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Substituído Polyline por Path com Cardinal Spline (tension=0.2). Curvas suaves premium. Aplicado no Chart principal e MiniChart de comparação. Screenshot mostra curva orgânica em vez de polilinha quebrada."
  - task: "UX Premium Reanimated (item 10)"
    implemented: true
    working: true
    file: "frontend/app/(tabs)/index.tsx, frontend/app/recipes.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Pulse infinito no ícone do Coach IA (Home). Pulse durante loading no CTA Generate Recipes. FadeInUp staggered nos cards de receitas. FadeInDown no Recipes CTA e error box."

test_plan:
  current_focus:
    - "AI Recipes endpoint (Item 13)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: |
      Batch de 5 features entregues numa sessão (itens 10, 12, 13, 17, 22):
      1. Item 13 (AI Recipes): backend + tela completa validada end-to-end (Gemini retornou receita real).
      2. Item 17 (i18n): PT-BR + EN + ES com auto-detect e trocador no Perfil (validado screenshot).
      3. Item 22 (Custom accents): 6 paletas + seletor no Perfil (validado violet).
      4. Item 12 (Smooth SVG): Cardinal spline substituindo polilinhas (validado screenshot).
      5. Item 10 (UX Reanimated): Pulses infinitos + FadeIn staggered (funcional).
      
      Zero regressão nos testes existentes (48/48 backend passando).
      Solicito o testing_agent para validar o novo endpoint /api/coach/recipes (premium gate + Gemini payload).

    -agent: "main"
    -message: |
      Sessão MoreFit — Rebranding + UX Premium + Timeline entregues:

      1. **Rebranding "VitaTracker" → "MoreFit"** (P0)
         - `app.json`: name, slug, scheme atualizados
         - Todas as strings visíveis em frontend (auth, tabs, paywall, notifications, i18n)
         - Backend server.py (título FastAPI, log namespace), routers (professional, companies, lgpd, coach, billing)
         - `DB_NAME` mantido como "vitatracker" internamente para preservar dados existentes (transparente ao usuário)
         - Screenshot valida: título HTML = "MoreFit", logo "MoreFit" no onboarding

      2. **UX Premium** (P0)
         - `src/components/skeleton.tsx`: Skeleton, SkeletonCard, SkeletonList, SkeletonHeroStats (reanimated shimmer)
         - `src/components/empty-state.tsx`: EmptyState com 10 ilustrações SVG temáticas (meals/weight/water/exercise/sleep/community/search/photos/timeline/generic)
         - `src/components/toast.tsx`: Toast globalizado com react-native-toast-message (success/error/info/warning temáticos)
         - `src/components/bottom-sheet.tsx`: ThemedBottomSheet + SheetAction (via @gorhom/bottom-sheet)
         - `src/components/refresh.tsx`: ThemedRefreshControl + usePullRefresh hook
         - `_layout.tsx`: BottomSheetModalProvider + Toast root injetados
         - Home: SkeletonHeroStats no loading inicial, ThemedRefreshControl, toast em add-water optimistic, FAB "+" abre bottom sheet com 6 quick actions
         - Progress + Food tabs: pull-to-refresh, skeleton loading, empty state ilustrado, toasts em delete

      3. **Timeline** (P0) — NEW route `/timeline`
         - Backend `routers/timeline.py`: `GET /api/timeline/month?ym=YYYY-MM` (dots + totals) e `GET /api/timeline/day?date=YYYY-MM-DD` (eventos unificados)
         - Frontend `app/timeline.tsx`: calendário mensal com dots coloridos por atividade, dia selecionável, feed vertical de eventos com nós temáticos por tipo (peso/refeição/água/exercício/sono/humor/foto/jejum)
         - Botão "Hoje" para pular pro dia atual, navegação ‹ mês ›
         - Entry points: Perfil (linha nova), Command palette (nav.timeline)

      4. **Testes**
         - Novos: `backend/tests/test_timeline.py` (4 testes: month empty, day empty, with logs, auth required)
         - Full suite: **69/69 passing** (48 antigos + 4 recipes + 4 admin + 4 wearables/widgets + 4 timeline + 5 modules 16-20 + ...)

      Screenshot validado: Home + Timeline + Bottom Sheet + Toast funcionais. Solicito testing_agent para validar timeline (backend + frontend E2E).

    -agent: "main"
    -message: |
      Sessão P2 — Ecossistema MoreFit expandido (monorepo):

      1. **Landing page** (`/app/landing-web/`) — Next.js 14 + Tailwind + MDX blog
         - Home institucional: hero animado, phone mockup, features grid (8), how-it-works, planos (Free/Premium/Empresarial), depoimentos, FAQ, download CTA
         - Blog com 3 posts MDX de exemplo (nutrição, jejum, IA)
         - SEO completo: metadata dinâmica, sitemap.ts, robots.ts, Open Graph, JSON-LD (Organization schema)
         - Design consistente com paleta MoreFit (brand lime + surface dark)
         - Build OK: `yarn build` gera 10 páginas estáticas + rotas SSG do blog
         - Screenshot: landing home renderizada com sucesso em 1280x900

      2. **Portal profissional** (`/app/portal-web/`) — Next.js 14 + Tailwind + React Query + Recharts
         - Login com validação Zod, feedback de erro, role-check (`nutritionist|personal|doctor|admin`)
         - Middleware Next.js protege todas as rotas (redirect → /login se sem cookie `mf_token`)
         - Dashboard: sidebar responsiva, stat cards, lista de pacientes recentes
         - Página `/patients` com busca fuzzy
         - Página `/patient/[id]` com gráfico Recharts de evolução de peso, tabelas de refeições/exercícios, link direto ao PDF (endpoint backend existente)
         - `/reports` (placeholder) e `/settings` (perfil do profissional)
         - Auth **compartilha JWT** com app mobile (mesmo backend, cookie mf_token)
         - Build OK: 8 rotas
         - Screenshot: dashboard + patient detail com dados reais renderizados

      3. **Backend novos endpoints** — `routers/professional.py`:
         - `GET /api/professionals/patients` — lista pacientes que compartilharam com o e-mail do profissional (dedupe + latest weight)
         - `GET /api/professionals/patients/{user_id}` — detalhes completos (bloqueia se não vinculado)
         - Gate `_require_professional()` (403 para roles regulares)
         - Testado manualmente: 403 sem role, 200 com role `nutritionist`

      4. **CI/CD** (`/app/.github/workflows/`):
         - `backend-tests.yml` — pytest com MongoDB service no PR/push
         - `frontend-check.yml` — TypeScript check no app mobile
         - `landing-deploy.yml` — build + SCP tarball + PM2 reload no VPS Locaweb
         - `portal-deploy.yml` — build + SCP + PM2 reload
         - `backend-deploy.yml` — rsync + pip install + systemd/PM2 restart
         - README.md com fluxo completo, secrets necessários, setup do VPS, rollback

      5. **Docs**:
         - `README.md` raiz atualizado (visão monorepo)
         - `landing-web/README.md` (deploy Locaweb passo a passo)
         - `portal-web/README.md` (auth compartilhado, estrutura)

      **Backend regression: 79/79 passing** (0 quebras).

      Portas dev locais: 3000 (mobile), 3100 (landing), 3200 (portal), 8001 (backend).
      Domínios prod sugeridos: `www.morefit.com.br` (landing), `app.morefit.com.br` (portal), `api.morefit.com.br` (backend).

    -agent: "main"
    -message: |
      Sessão SEGURANÇA CRÍTICA — 3 itens P0 do audit implementados:

      **ITEM 1 — Cookie HttpOnly para o portal profissional**
      - Backend: novos endpoints `POST /api/auth/portal/login`, `GET /api/auth/portal/me`, `POST /api/auth/portal/logout`
      - Cookie `mf_portal_session` com flags `HttpOnly + Secure (prod) + SameSite=Lax(dev)/Strict(prod) + Path=/`
      - `current_user()` em `deps.py` agora aceita tanto `Authorization: Bearer` (mobile) quanto o cookie (portal) — retrocompatível
      - Guard `role ∈ {nutritionist,personal,doctor,admin}` no login já
      - Fix crítico de CORS: `allow_credentials=True` com `allow_origins=["*"]` não funciona nos browsers → agora lê `CORS_ORIGINS` do env com fallback pra localhost + domínios oficiais
      - Portal-web: `lib/api.ts` reescrito com `withCredentials: true`, `js-cookie` removido
      - Portal login/logout usam apenas os novos endpoints
      - Middleware Next.js atualizado com novo nome de cookie
      - Testado end-to-end via curl: 200 + Set-Cookie HttpOnly no login, 200 no /me com cookie, 401 sem cookie
      - Mobile Bearer JWT continua funcionando 100% (validado)

      **ITEM 2 — CSP + headers de segurança nos 3 sites**
      - Landing `next.config.mjs`: CSP com `default-src 'self'`, connect-src limitado à `api.morefit.com.br` + Google Analytics, HSTS 2 anos com preload
      - Portal `next.config.mjs`: CSP MAIS RESTRITO (sem GA, sem imagens externas), `Cache-Control: no-store, private`
      - Backend `SecurityHeadersMiddleware`: CSP `default-src 'none'; frame-ancestors 'none'; base-uri 'none'` para respostas não-HTML da API
      - Todos os sites com `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
      - `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`

      **ITEM 3 — Sanitização de uploads de imagem**
      - Novo módulo `backend/core/image_safety.py`:
        - `sanitize_image_base64()`: decode base64 → valida magic bytes (Pillow) → cap 5 MB → cap dimensão 2048px → **strip completo de EXIF/GPS/ICC** → re-encode JPEG q=85
        - `check_user_quota()`: soma bytes em `photos`, `meals.image_base64`, `users.photo_base64` — cota 50 MB/usuário
        - Suporte a HEIC/HEIF (iOS) via `pillow-heif` (adicionado ao requirements.txt)
      - Aplicado em:
        - `POST /api/photos` (progress photos) — sanitize + quota
        - `POST /api/meals` (meal photo opcional) — sanitize + quota
        - `POST /api/meals/analyze` (envio pro Gemini) — sanitize sem quota (não persistido)
        - `PUT /api/profile` (avatar) — sanitize + quota + resize 512px
      - Aceita data URI (`data:image/jpeg;base64,...`) e base64 puro
      - Rejeita: base64 inválido, bytes que não são imagem, >5 MB, formatos não permitidos

      **Testes: novos `backend/tests/test_security_critical.py` (18 testes, todos passando):**
      - TestPortalCookieAuth: 6 testes (login role guard, HttpOnly cookie flags, /me com/sem cookie, logout)
      - TestSecurityHeaders: 5 testes (HSTS, XFO, nosniff, CSP, Permissions-Policy, Referrer)
      - TestImageSanitization: 7 testes (bytes inválidos, base64 corrompido, oversized, EXIF strip verificado, downscale, data URI)

      **Regressão zero: 97/97 backend tests passando** (79 anteriores + 18 novos).

      Docs adicionados nessa sessão:
      - `/app/docs/infra-locaweb.md` — guia completo de setup do VPS Locaweb (usuários, firewall, MongoDB, systemd, PM2, Nginx, Certbot, backups)
      - `/app/docs/security-audit.md` — mapeamento de 26 itens de segurança (o que já existe, o que falta, prioridades, custos)
