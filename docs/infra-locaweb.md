# Infraestrutura MoreFit — VPS Locaweb (setup completo)

Guia passo a passo para deixar **backend + landing + portal** rodando num VPS Ubuntu 22.04 da Locaweb, com HTTPS, backups e CI/CD.

## 📋 Pré-requisitos

Antes de começar, você precisa:

- [ ] VPS Locaweb (mínimo recomendado: **2 vCPU, 4 GB RAM, 60 GB SSD** — plano *Cloud Server 2* ou superior)
- [ ] Domínio `morefit.com.br` já registrado (Registro.br)
- [ ] Acesso ao painel DNS (Locaweb ou Registro.br)
- [ ] Chave SSH gerada localmente (`ssh-keygen -t ed25519`)

---

## 🌐 1. DNS — configurar antes de tudo

No painel DNS aponte estes registros para o IP do VPS (`X.X.X.X`):

| Tipo | Nome | Valor | TTL |
|---|---|---|---|
| A | `@` | `X.X.X.X` | 3600 |
| A | `www` | `X.X.X.X` | 3600 |
| A | `app` | `X.X.X.X` | 3600 |
| A | `api` | `X.X.X.X` | 3600 |
| CNAME | `*` (opcional) | `morefit.com.br.` | 3600 |
| MX | `@` | seu provedor de e-mail (ex: Google Workspace) | 3600 |
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` | 3600 |

**Aguarde 15-60 min** para propagar. Confira com `dig morefit.com.br`.

---

## 🖥 2. Setup inicial do VPS (uma vez só)

### 2.1 Acesso e usuário de deploy

```bash
# SSH inicial como root
ssh root@X.X.X.X

# Cria usuário dedicado 'deploy' (nunca use root para deploys)
adduser deploy
usermod -aG sudo deploy

# Configura acesso SSH sem senha para o novo usuário
mkdir -p /home/deploy/.ssh
# Cole sua chave pública em:
nano /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh

# Endurece o SSH
nano /etc/ssh/sshd_config
#   PermitRootLogin no
#   PasswordAuthentication no
#   Port 2222         (opcional, mas recomendado)
systemctl reload sshd
```

### 2.2 Firewall UFW

```bash
sudo apt update && sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 2222/tcp      # ou 22, se não mudou
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2.3 Fail2ban (protege SSH e Nginx)

```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

### 2.4 Node 20 + PM2 + Yarn

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential
sudo npm i -g pm2 yarn

# PM2 auto-start no boot
pm2 startup systemd -u deploy --hp /home/deploy
# Copie e execute o comando que ele imprime
```

### 2.5 Python 3.11 (backend)

```bash
sudo apt install -y python3.11 python3.11-venv python3-pip
```

### 2.6 MongoDB 7 (banco de dados)

**Opção A — MongoDB no próprio VPS** (mais simples, ok até ~5k usuários):
```bash
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | \
  sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl enable --now mongod

# ⚠️ SEGURANÇA — ative auth
mongosh
> use admin
> db.createUser({ user: "morefit_admin", pwd: "SENHA_FORTE_AQUI", roles: ["root"] })
> exit

sudo nano /etc/mongod.conf
# Descomente/edite:
#   security:
#     authorization: enabled
#   net:
#     bindIp: 127.0.0.1        # NUNCA 0.0.0.0
sudo systemctl restart mongod
```

**Opção B — MongoDB Atlas (recomendado em produção):**
- Crie cluster gratuito em [mongodb.com/atlas](https://www.mongodb.com/atlas)
- Whitelist do IP do VPS
- Use a connection string (ex: `mongodb+srv://user:pass@cluster.mongodb.net/morefit`)
- Benefícios: backups automáticos, alta disponibilidade, sem manutenção

### 2.7 Nginx + Certbot (SSL grátis)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

---

## 📁 3. Estrutura de diretórios recomendada

Crie a árvore no VPS como usuário `deploy`:

```bash
sudo mkdir -p /var/www/{morefit-landing,morefit-portal,morefit-backend}
sudo mkdir -p /var/www/morefit-landing/{releases,current}
sudo mkdir -p /var/www/morefit-portal/{releases,current}
sudo chown -R deploy:deploy /var/www/morefit-*

# Diretório de backups
sudo mkdir -p /var/backups/morefit && sudo chown deploy:deploy /var/backups/morefit
```

Resultado final:
```
/var/www/
├── morefit-landing/
│   ├── releases/          ← tarballs .tar.gz das últimas 5 versões (rollback)
│   └── current/           ← versão em produção (código Next.js)
│       ├── .next/
│       ├── public/
│       ├── content/posts/*.mdx
│       ├── node_modules/
│       └── package.json
├── morefit-portal/
│   ├── releases/
│   └── current/
│       ├── .next/
│       ├── public/
│       ├── middleware.ts
│       ├── node_modules/
│       └── package.json
└── morefit-backend/
    ├── venv/              ← virtualenv Python
    ├── core/
    ├── routers/
    ├── services/
    ├── server.py
    ├── requirements.txt
    └── .env               ← ⚠️ chmod 600 e OWNER deploy:deploy

/var/backups/morefit/
├── mongo-YYYYMMDD.gz      ← dump diário do MongoDB
└── ...                    ← retenção 30 dias
```

---

## 🔧 4. Configurar cada serviço

### 4.1 Backend FastAPI (systemd)

```bash
cd /var/www/morefit-backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install "uvicorn[standard]" gunicorn

# Cria .env (⚠️ substitua os valores reais)
cat > .env << 'EOF'
MONGO_URL=mongodb://morefit_admin:SENHA_FORTE_AQUI@127.0.0.1:27017/morefit?authSource=admin
DB_NAME=morefit
JWT_SECRET=troque_isto_por_uma_string_aleatoria_de_64_chars
EMERGENT_LLM_KEY=sk-emergent-...
STRIPE_API_KEY=sk_live_...
CORS_ORIGINS=https://www.morefit.com.br,https://app.morefit.com.br
EOF
chmod 600 .env
```

Systemd unit:
```bash
sudo tee /etc/systemd/system/morefit-backend.service << 'EOF'
[Unit]
Description=MoreFit FastAPI Backend
After=network.target mongod.service

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/var/www/morefit-backend
Environment="PATH=/var/www/morefit-backend/venv/bin"
EnvironmentFile=/var/www/morefit-backend/.env
ExecStart=/var/www/morefit-backend/venv/bin/gunicorn server:app \
  -w 4 -k uvicorn.workers.UvicornWorker \
  -b 127.0.0.1:8001 \
  --access-logfile /var/log/morefit/backend-access.log \
  --error-logfile /var/log/morefit/backend-error.log
Restart=always
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

sudo mkdir -p /var/log/morefit && sudo chown deploy:deploy /var/log/morefit
sudo systemctl daemon-reload
sudo systemctl enable --now morefit-backend
sudo systemctl status morefit-backend
```

### 4.2 Landing + Portal com PM2

```bash
# Landing
cd /var/www/morefit-landing/current
yarn install --production --frozen-lockfile
pm2 start "yarn start" --name morefit-landing --cwd /var/www/morefit-landing/current

# Portal
cd /var/www/morefit-portal/current
echo "NEXT_PUBLIC_API_URL=https://api.morefit.com.br" > .env.local
yarn install --production --frozen-lockfile
pm2 start "yarn start" --name morefit-portal --cwd /var/www/morefit-portal/current

pm2 save
pm2 list
```

### 4.3 Nginx — proxy reverso + HTTPS

```bash
sudo tee /etc/nginx/sites-available/morefit << 'EOF'
# ─── LANDING ─────────────────────────────────────────
server {
    listen 80;
    server_name morefit.com.br www.morefit.com.br;
    # Redirect apex → www
    if ($host = morefit.com.br) {
        return 301 https://www.morefit.com.br$request_uri;
    }
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl http2;
    server_name www.morefit.com.br;

    # SSL — preenchido pelo certbot
    # ssl_certificate ...;
    # ssl_certificate_key ...;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }
}

# ─── PORTAL ──────────────────────────────────────────
server {
    listen 443 ssl http2;
    server_name app.morefit.com.br;
    # ssl_certificate ... (certbot)

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    client_max_body_size 5M;

    location / {
        proxy_pass http://127.0.0.1:3200;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# ─── BACKEND API ─────────────────────────────────────
server {
    listen 443 ssl http2;
    server_name api.morefit.com.br;
    # ssl_certificate ... (certbot)

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # CORS gerenciado pelo FastAPI (não duplique aqui)

    client_max_body_size 15M;

    # Rate limiting básico (endurecimento adicional)
    limit_req_zone $binary_remote_addr zone=morefit_api:10m rate=10r/s;
    limit_req zone=morefit_api burst=20 nodelay;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/morefit /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 4.4 SSL grátis (Let's Encrypt)

```bash
sudo certbot --nginx \
  -d morefit.com.br -d www.morefit.com.br \
  -d app.morefit.com.br \
  -d api.morefit.com.br \
  --email seu@email.com --agree-tos --no-eff-email --redirect

# Renovação automática já é agendada (cron ou systemd timer). Confirme:
sudo systemctl status certbot.timer
```

---

## 💾 5. Backups automáticos

### 5.1 Script de backup do MongoDB

```bash
sudo tee /usr/local/bin/backup-mongo.sh << 'EOF'
#!/bin/bash
set -e
DATE=$(date +%F)
BACKUP_DIR=/var/backups/morefit
mkdir -p "$BACKUP_DIR"

# Dump comprimido
mongodump --uri="mongodb://morefit_admin:SENHA_FORTE_AQUI@127.0.0.1:27017/morefit?authSource=admin" \
  --archive="$BACKUP_DIR/mongo-$DATE.gz" --gzip

# Retenção: 30 dias
find "$BACKUP_DIR" -name "mongo-*.gz" -mtime +30 -delete

# (Opcional) enviar pra S3/Backblaze/Wasabi:
# aws s3 cp "$BACKUP_DIR/mongo-$DATE.gz" s3://morefit-backups/mongo/
EOF

sudo chmod +x /usr/local/bin/backup-mongo.sh
sudo chown deploy:deploy /usr/local/bin/backup-mongo.sh

# Cron diário às 3h da manhã
sudo crontab -u deploy -e
# Adicione a linha:
# 0 3 * * * /usr/local/bin/backup-mongo.sh >> /var/log/morefit/backup.log 2>&1
```

### 5.2 Backup do `.env` do backend (contém segredos)

Nunca versione. Faça snapshot manual pra um cofre seguro (1Password, Bitwarden, KeepassXC).

---

## 📊 6. Monitoramento

### 6.1 Logs centralizados

```bash
# Backend
sudo tail -f /var/log/morefit/backend-*.log
sudo journalctl -u morefit-backend -f

# Nginx
sudo tail -f /var/log/nginx/{access,error}.log

# PM2
pm2 logs morefit-landing
pm2 logs morefit-portal
```

### 6.2 Uptime / alertas (recomendado)

- [UptimeRobot](https://uptimerobot.com) (grátis até 50 monitors) — HTTP check nos 3 domínios
- [Sentry](https://sentry.io) — captura de erros no backend + Next.js (SDK simples)
- [BetterStack Logtail](https://betterstack.com) — se quiser logs agregados

### 6.3 Métricas do servidor

```bash
sudo apt install -y htop iotop nload
```

Ou instale [Netdata](https://www.netdata.cloud) (dashboard web bonito e leve):
```bash
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
```

---

## 🔄 7. Fluxo de deploy final

Quando você fizer `git push origin main` no GitHub:

```mermaid
graph LR
  A[git push main] --> B{Path alterado?}
  B -->|backend/**| C[backend-deploy.yml]
  B -->|landing-web/**| D[landing-deploy.yml]
  B -->|portal-web/**| E[portal-deploy.yml]
  C --> F[rsync + pip install + systemctl restart]
  D --> G[SCP tarball + pm2 reload]
  E --> G
  F --> H[api.morefit.com.br atualizado]
  G --> I[www + app.morefit.com.br atualizados]
```

**Zero downtime:**
- Backend: gunicorn com múltiplos workers → systemd faz reload gracioso
- Next.js: `pm2 reload` (não `restart`) reinicia workers 1 a 1

---

## 🩺 8. Health checks (após deploy)

Rode este script periodicamente:
```bash
curl -f https://www.morefit.com.br/ | grep -q "MoreFit" && echo "✅ landing"
curl -f https://app.morefit.com.br/login | grep -q "Portal" && echo "✅ portal"
curl -f https://api.morefit.com.br/api/ | grep -q "MoreFit" && echo "✅ backend"
```

---

## 📦 9. Estrutura final resumida

```
Locaweb VPS (Ubuntu 22.04)
├── Usuários: root (bloqueado via SSH), deploy (sudo, chave SSH)
├── Firewall UFW: 22/2222, 80, 443
├── Fail2ban: SSH + Nginx auth
├── Serviços rodando:
│   ├── mongod           :27017 (bind 127.0.0.1)
│   ├── morefit-backend  :8001  (systemd, gunicorn 4 workers)
│   ├── morefit-landing  :3100  (pm2, Node 20)
│   ├── morefit-portal   :3200  (pm2, Node 20)
│   └── nginx            :80/443 (proxy reverso + SSL)
├── Backups: /var/backups/morefit (cron diário 3h)
└── Logs: /var/log/morefit/ + journalctl + pm2 logs
```

---

## 🧑‍🎓 Onboarding de profissionais

Depois que tudo estiver rodando, para promover um usuário ao portal profissional:

```bash
ssh deploy@api.morefit.com.br
mongosh mongodb://morefit_admin:PASS@127.0.0.1:27017/morefit?authSource=admin

# Promove por e-mail
db.users.updateOne(
  { email: "nutri@exemplo.com" },
  { $set: { role: "nutritionist" } }
)
```

Ou (recomendado) criar um endpoint admin `POST /api/admin/users/{id}/role` e chamar via portal admin.

---

## ✅ Checklist de go-live

- [ ] DNS propagado (`dig` confirma)
- [ ] Firewall UFW ativo com só 3 portas
- [ ] SSH: sem root, sem senha, porta 2222 (opcional)
- [ ] MongoDB com auth habilitado, bind 127.0.0.1
- [ ] `.env` do backend com `chmod 600` e `JWT_SECRET` forte (64+ chars)
- [ ] SSL A+ nos 3 domínios (teste em [ssllabs.com](https://www.ssllabs.com/ssltest/))
- [ ] HSTS preload configurado
- [ ] Nginx rate limit habilitado
- [ ] PM2 e systemd auto-start no boot
- [ ] Backup diário do MongoDB
- [ ] UptimeRobot monitorando os 3 domínios
- [ ] Sentry capturando erros (backend + Next.js)
- [ ] Secrets do GitHub configurados (LOCAWEB_HOST, USER, SSH_KEY, PORTAL_API_URL)
- [ ] Deploy CI/CD testado (push de teste em `main`)
