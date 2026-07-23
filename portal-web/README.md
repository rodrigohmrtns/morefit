# MoreFit — Portal Profissional

Painel web para nutricionistas, personais e médicos parceiros MoreFit.

**URL de produção:** `app.morefit.com.br` (sugestão)

## Stack
- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS
- @tanstack/react-query
- react-hook-form + zod
- Recharts (gráficos)
- Axios com interceptador JWT

## Auth compartilhado

O portal **reutiliza o mesmo backend FastAPI e o mesmo JWT** do app mobile — não há sistema de auth próprio. O profissional entra com o e-mail/senha que já usa no app MoreFit.

Fluxo:
1. Usuário loga → `POST /api/auth/login` → recebe JWT
2. Token é salvo em cookie `mf_token` (SameSite=Lax, secure em prod)
3. Middleware Next.js redireciona `/` → `/login` se não houver cookie
4. Após login, o portal verifica `role ∈ {nutritionist, personal, doctor, admin}` chamando `GET /api/auth/me`
5. Se o role não bater, mostra erro e não redireciona ao dashboard

⚠️ **Ação de backend necessária** (backlog): adicionar endpoint `GET /api/professionals/patients` e `GET /api/professionals/patients/{user_id}` para listar/obter pacientes vinculados. O UI já está pronto para consumi-los assim que ficarem disponíveis (retorna array vazio graciosamente).

## Dev local
```bash
cd portal-web
cp .env.example .env.local   # edite NEXT_PUBLIC_API_URL se preciso
yarn install
yarn dev                     # http://localhost:3200
```

## Build de produção
```bash
yarn build
yarn start                   # http://localhost:3200
```

## Deploy — Locaweb VPS/Cloud Node.js

Igual ao landing (PM2 + Nginx). Exemplo:
```bash
# no VPS
cd /var/www/morefit-portal/portal-web
yarn install --frozen-lockfile
yarn build
pm2 start "yarn start" --name morefit-portal
pm2 save
```

Nginx:
```nginx
server {
  server_name app.morefit.com.br;
  location / {
    proxy_pass http://localhost:3200;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```
```bash
sudo certbot --nginx -d app.morefit.com.br
```

## Estrutura
```
portal-web/
├── app/
│   ├── layout.tsx                    (QueryProvider + globals.css)
│   ├── page.tsx                      (redirect → /dashboard)
│   ├── (auth)/login/page.tsx         (login com role-check)
│   └── (dashboard)/
│       ├── layout.tsx                (sidebar + user chip + logout)
│       ├── dashboard/page.tsx        (visão geral + stats)
│       ├── patients/page.tsx         (lista + busca)
│       ├── patient/[id]/page.tsx     (perfil detalhado + gráfico + tabelas + PDF)
│       ├── reports/page.tsx          (placeholder — em breve)
│       └── settings/page.tsx         (perfil + notificações + segurança)
├── lib/
│   ├── api.ts                        (axios client + typed helpers)
│   ├── query-provider.tsx            (React Query context)
│   └── utils.ts                      (cn helper)
├── middleware.ts                     (auth guard — protege / e subrotas)
└── tailwind.config.ts
```
