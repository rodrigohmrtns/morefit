# MoreFit — Monorepo

**Saúde inteligente. Sua jornada começa aqui.**

Site oficial: [www.morefit.com.br](https://www.morefit.com.br)

---

## Projetos

| Pasta | Projeto | Stack | Porta dev |
|---|---|---|---|
| **`frontend/`** | App mobile (iOS/Android/Web) | Expo SDK 54 + React Native + Expo Router | `3000` |
| **`backend/`** | API + regras de negócio | FastAPI + MongoDB + JWT + Stripe + Emergent LLM | `8001` |
| **`landing-web/`** | Site institucional | Next.js 14 + Tailwind + MDX blog | `3100` |
| **`portal-web/`** | Painel profissional (nutri/personal/médico) | Next.js 14 + Tailwind + React Query + Recharts | `3200` |
| **`.github/workflows/`** | CI/CD | GitHub Actions → Locaweb VPS via SCP/SSH | — |

## Domínios (produção — Locaweb)

- `www.morefit.com.br` → landing-web
- `app.morefit.com.br` → portal-web (profissionais)
- `api.morefit.com.br` → backend FastAPI
- Mobile: builds iOS/Android geradas via Emergent Publish

## Setup rápido de dev

```bash
# 1. Backend
cd backend
pip install -r requirements.txt
# Configure backend/.env com MONGO_URL, JWT_SECRET, EMERGENT_LLM_KEY, STRIPE_API_KEY
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# 2. Mobile
cd frontend
yarn install
npx expo start

# 3. Landing
cd landing-web
yarn install
yarn dev  # http://localhost:3100

# 4. Portal
cd portal-web
cp .env.example .env.local
yarn install
yarn dev  # http://localhost:3200
```

## Credenciais de teste (dev)

Ver `memory/test_credentials.md`.
- `ana@example.com` / `secret123` (Premium)
- `test@example.com` / `password123` (Free)

## Testes

```bash
# Backend (79+ testes)
cd backend && python -m pytest -q

# Type-checks
cd landing-web && yarn typecheck
cd portal-web && yarn typecheck
cd frontend && yarn tsc --noEmit
```

## Deploy

Automático via GitHub Actions ao dar push em `main`. Veja `.github/workflows/README.md`.

## Documentação por projeto

- [Mobile app](./frontend/README.md)
- [Backend API](./backend/README.md)
- [Landing site](./landing-web/README.md)
- [Portal profissional](./portal-web/README.md)
- [CI/CD](./.github/workflows/README.md)
