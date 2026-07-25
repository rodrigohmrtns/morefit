# MoreFit — Auditoria de segurança e itens pendentes

**Data:** 23/07/2026
**Escopo:** app mobile, backend FastAPI, portal profissional, landing, infraestrutura.

Este documento lista **o que já está implementado** e **o que falta** para atingir um nível de segurança adequado a um produto SaaS de saúde que trata dados sensíveis (LGPD art. 5º, II).

---

## ✅ O que já está implementado

| Item | Status | Onde |
|---|---|---|
| Autenticação JWT | ✅ | `backend/routers/auth.py`, `deps.py::current_user` |
| Hash de senha bcrypt | ✅ | `backend/core/security.py` |
| CORS restrito | ✅ | `backend/server.py` |
| Rate limiting básico (SlowAPI) | ✅ | `backend/middleware/security.py` |
| Guards por role em endpoints admin | ✅ | `backend/routers/admin.py` |
| Guard `_require_professional()` no portal | ✅ | `backend/routers/professional.py` |
| Endpoints LGPD (exportar / apagar dados) | ✅ | `backend/routers/lgpd.py` |
| Audit log de ações sensíveis | ✅ | `backend/services/audit.py` |
| Middleware anti-brute-force em login | ✅ | `backend/routers/auth.py` (throttle por IP+email) |
| Sanitização de PDF (nomes de arquivo) | ✅ | `backend/routers/professional.py` |
| HTTPS end-to-end (via Nginx + Certbot) | ✅ | infra guide |
| Headers de segurança (HSTS, XFO, CSP básico) | ✅ | Next.js configs + Nginx |
| Testes de segurança (auth, brute-force, role guards) | ✅ | `backend/tests/*.py` (79 testes) |

---

## 🔴 Gaps CRÍTICOS — resolver antes do go-live

### 1. **Rotação e cofre de segredos** 🔴
**Risco:** `JWT_SECRET`, `EMERGENT_LLM_KEY`, `STRIPE_API_KEY` hoje ficam em `.env` no VPS e provavelmente em backups não criptografados.

**Ação:**
- Migrar segredos para **cofre gerenciado**: AWS Secrets Manager, HashiCorp Vault ou (mais simples) Doppler / 1Password Connect.
- Rotacionar `JWT_SECRET` a cada 90 dias com dupla-chave (permite grace-period).
- Nunca versionar `.env` — ok, já está no `.gitignore`.

### 2. **Criptografia em repouso do MongoDB** 🔴
**Risco:** Se alguém acessar disco do VPS, todos os dados de saúde ficam legíveis.

**Ação:**
- Se usar MongoDB Atlas: já vem com **encryption at rest** ativado por padrão. **Recomendado.**
- Se auto-hospedar: ativar [MongoDB Enterprise Encryption](https://www.mongodb.com/docs/manual/core/security-encryption-at-rest/) OU LUKS full-disk encryption no VPS.
- **PII sensível** (endereço, telefone, CPF) deve ser criptografado no nível de campo com [MongoDB Client-Side Field Level Encryption (CSFLE)](https://www.mongodb.com/docs/manual/core/csfle/).

### 3. **Sanitização de uploads (fotos)** 🔴
**Risco:** Hoje aceitamos base64 direto no `POST /photos`, sem validação de tipo/tamanho/EXIF.

**Ação:**
- Validar magic bytes (Pillow: `Image.open` + `verify()`).
- Limitar tamanho: 5 MB por foto, 50 MB total por usuário.
- Strip EXIF (metadados GPS podem vazar localização).
- Preferível: mover storage para **S3/Backblaze/Cloudflare R2** com URLs assinadas e nunca servir bytes direto do backend.

### 4. **CSP (Content Security Policy)** 🔴
**Risco:** Se um XSS passar, atacante pode exfiltrar tokens JWT.

**Ação:**
Configurar CSP restrito nos 3 sites Next.js. Exemplo para o portal:
```typescript
// portal-web/next.config.mjs
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",  // Next requer inline em dev — ajustar em prod
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://api.morefit.com.br",
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
}
```

### 5. **2FA (dois fatores) opcional** 🔴
**Risco:** Roubo de senha compromete conta (dados de saúde + histórico).

**Ação:**
- Implementar TOTP (Google Authenticator, Authy) via `pyotp` — dias de implementação.
- Endpoints `POST /api/auth/2fa/setup`, `POST /api/auth/2fa/verify`, `POST /api/auth/2fa/disable`.
- **Obrigatório** para roles `admin`, `doctor` e `nutritionist`.

### 6. **Cookie de portal — flags de segurança** 🔴
**Risco:** Hoje o portal salva JWT em cookie **acessível ao JS** (via `js-cookie`).

**Ação:**
- Migrar para cookie **HttpOnly + Secure + SameSite=Strict**, setado pelo backend em `Set-Cookie`.
- Requer endpoint `POST /api/auth/login-portal` que retorna cookie ao invés de body.
- Bloqueia XSS token theft.

---

## 🟠 Gaps IMPORTANTES — próximos 30 dias

### 7. **Detecção de anomalias / login suspeito** 🟠
- Logar IP, User-Agent e geolocalização em cada login.
- Se login vier de país/dispositivo novo, disparar e-mail "foi você?".
- Bloquear login após 5 falhas seguidas no mesmo IP por 15 min (já tem parte disso — endurecer).

### 8. **Password policy** 🟠
- Hoje: mínimo 6 caracteres. Insuficiente.
- Ação: mínimo 12, exigir 1 número + 1 símbolo, bloquear top 10k senhas comuns (biblioteca `zxcvbn`).
- Bloquear reuso das últimas 5 senhas.
- Forçar troca a cada 180 dias (opcional — hoje o NIST não recomenda).

### 9. **Backup restaurável e testado** 🟠
- Hoje: script de `mongodump` cron. Nunca testamos restaurar.
- Ação: executar drill de restore **mensal** em ambiente staging. Documentar tempo (RTO) e perda de dados aceitável (RPO).

### 10. **WAF (Web Application Firewall)** 🟠
- Nginx com `limit_req` é fraco contra ataques sofisticados.
- Ação: colocar **Cloudflare Free** na frente (proxy `cloudflare-orange`).
- Ganhos: DDoS mitigation, bot detection, WAF rules OWASP Top 10, CDN grátis, analytics.

### 11. **Consentimento LGPD explícito no cadastro** 🟠
- Hoje: form de signup não tem checkbox "Aceito Política de Privacidade".
- Ação: adicionar checkboxes obrigatórios (política + termos) com timestamp salvo no user document.
- Guardar por 5 anos (art. 27, LGPD).

### 12. **DPO (Data Protection Officer)** 🟠
- LGPD art. 41 exige DPO nomeado.
- Ação: nomear responsável interno + criar página `/privacidade` no landing com contato do DPO.
- E-mail sugerido: `dpo@morefit.com.br` (obrigatório existir e responder).

### 13. **Endpoint de portabilidade LGPD (art. 18)** 🟠
- Já existe `/api/lgpd/export` (JSON). Ok para o dev.
- Ação: garantir formato aberto (CSV além de JSON) e assinatura digital do dump para não repudio.

### 14. **Deletar conta ≠ anonimizar** 🟠
- Hoje `DELETE /api/lgpd/account` remove o registro. Isso pode conflitar com necessidade legal de guardar audit logs.
- Ação: anonimizar (`email → deleted_X@deleted.local`, remover `name` e `photo_base64`) ao invés de deletar. Manter user_id nos logs.

### 15. **Testes de segurança automatizados** 🟠
- Já temos 79 testes de unidade/integração.
- Adicionar:
  - [Bandit](https://bandit.readthedocs.io) no backend (SAST Python)
  - `npm audit` / `yarn audit` no CI (SCA JS)
  - [Snyk](https://snyk.io) ou [Dependabot](https://github.com/dependabot) para deps
  - Semgrep com regras OWASP no CI

### 16. **Logs de acesso a dados sensíveis** 🟠
- Cada visualização de dados de outro usuário (profissional vendo paciente) deve gerar registro no audit log.
- Ação: hoje temos audit em algumas ações — expandir para **toda** leitura sensível do portal profissional.

---

## 🟡 Gaps MENORES — melhoria contínua

### 17. **API versioning** 🟡
- Todos endpoints estão em `/api/`. Sem versão.
- Ação futura: `/api/v1/`, `/api/v2/` — deprecar controladamente.

### 18. **Idempotência em POST críticos** 🟡
- Pagamentos, deletes, exports.
- Ação: aceitar header `Idempotency-Key` (UUID do cliente) e cachear por 24h.

### 19. **Assinatura de webhooks** 🟡
- Webhooks do Stripe já verificam signature (ok).
- Se você criar webhooks para o portal (paciente novo, etc), assinar HMAC com secret compartilhado.

### 20. **Rate limit por usuário (não só IP)** 🟡
- Hoje: `slowapi` limita por IP.
- Ação: adicionar limite por `user_id` em endpoints caros (IA, PDFs, exports). Evita abuso interno.

### 21. **Isolamento de VPCs / rede** 🟡
- Hoje: MongoDB no mesmo VPS que o backend. Ok pra MVP.
- Ação: separar em subnet privada quando escalar. MongoDB Atlas já fornece isso.

### 22. **Auditoria de dependências** 🟡
- 100+ libs no `package.json` e `requirements.txt`.
- Ação: revisar mensalmente CVEs abertos + atualizar libs críticas trimestralmente.

### 23. **Termo de Uso & Privacidade completos** 🟡
- Landing hoje aponta pra `/privacidade`, `/termos`, `/cookies` — todas 404.
- Ação: escrever com advogado especialista em LGPD (custo estimado: R$ 3-8k) e publicar antes do go-live.

### 24. **Retenção de dados após inatividade** 🟡
- LGPD sugere apagar dados de contas sem uso por 12+ meses.
- Ação: job diário que envia email de aviso após 10 meses de inatividade + apaga aos 12.

### 25. **CSRF (Cross-Site Request Forgery)** 🟡
- Se migrar para cookie HttpOnly (item #6), CSRF vira risco.
- Ação: gerar CSRF token por sessão e validar em todos endpoints que mutam dados (`POST/PUT/PATCH/DELETE`).

### 26. **Ofuscação de erros em produção** 🟡
- FastAPI em dev retorna traceback em 500. Em prod deve retornar `{"detail": "Erro interno"}` genérico.
- Ação: middleware que só detalha erro se `X-Debug-Token` (só admins) presente.

---

## 🎯 Priorização recomendada

**Semana 1 (antes do go-live):**
1. Migrar cookie JWT do portal → HttpOnly (#6)
2. Sanitização de uploads de foto (#3)
3. CSP restrito (#4)
4. Cloudflare grátis na frente do Nginx (#10)
5. Consentimento LGPD explícito no cadastro (#11)
6. Termos e Privacidade escritos (#23)

**Mês 1:**
7. MongoDB Atlas (encryption at rest grátis) — item #2
8. 2FA obrigatório para profissionais (#5)
9. Password policy endurecida (#8)
10. Drill de backup restore (#9)

**Trimestre 1:**
11. Cofre de segredos (Doppler/Vault) (#1)
12. Anonimização em vez de delete (#14)
13. SAST/SCA no CI (Bandit + Snyk) (#15)
14. Detecção de login suspeito + e-mail alerta (#7)

**Contínuo:**
- Audit trimestral por consultor externo (pentest anual)
- Bug bounty (HackerOne) quando tiver usuários pagos

---

## 💰 Custo estimado

| Item | Custo mensal aproximado |
|---|---|
| Cloudflare Free | R$ 0 |
| MongoDB Atlas M10 | US$ 57 (~R$ 320) |
| Sentry (10k events) | Grátis |
| UptimeRobot | Grátis |
| Doppler (secrets) | US$ 0-15 (~R$ 0-85) |
| Snyk (open source) | Grátis |
| Advogado LGPD (setup) | R$ 3-8k (uma vez) |
| Pentest anual | R$ 15-30k (uma vez/ano) |

---

## 📚 Referências

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [OWASP ASVS 4.0](https://owasp.org/www-project-application-security-verification-standard/)
- [LGPD — Lei 13.709/2018](http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [ANPD — Guia de Segurança da Informação](https://www.gov.br/anpd/pt-br/documentos-e-publicacoes/guia_seguranca_informacao_ago22.pdf)
- [NIST 800-63B — Digital Identity](https://pages.nist.gov/800-63-3/sp800-63b.html)
