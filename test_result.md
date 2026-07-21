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

