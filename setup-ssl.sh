#!/bin/bash
# ============================================
# 🔒 Setup SSL - FinanceAI
# Instala Certbot, gera certificado SSL
# e configura renovação automática via systemd
# ============================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔══════════════════════════════════════╗"
echo "║   🔒 FinanceAI - Setup SSL          ║"
echo "║   Certificado HTTPS Automático      ║"
echo "╚══════════════════════════════════════╝"
echo -e "${NC}"

# Verificar root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ Execute como root: sudo bash setup-ssl.sh${NC}"
  exit 1
fi

# Solicitar domínio
read -p "📌 Digite seu domínio (ex: meusite.com): " DOMAIN

if [ -z "$DOMAIN" ]; then
  echo -e "${RED}❌ Domínio não pode ser vazio!${NC}"
  exit 1
fi

read -p "📌 Deseja incluir www.$DOMAIN? (s/n): " INCLUDE_WWW
read -p "📌 Digite seu email para notificações do Let's Encrypt: " EMAIL

if [ -z "$EMAIL" ]; then
  echo -e "${RED}❌ Email é obrigatório!${NC}"
  exit 1
fi

APP_DIR="/opt/financeai"

# Verificar se a aplicação existe
if [ ! -d "$APP_DIR" ]; then
  echo -e "${RED}❌ Diretório $APP_DIR não encontrado. Instale o FinanceAI primeiro.${NC}"
  exit 1
fi

# ============================================
# 1. Instalar Certbot
# ============================================
echo -e "\n${YELLOW}📦 [1/6] Instalando Certbot...${NC}"
apt update -qq
apt install -y certbot > /dev/null 2>&1
echo -e "${GREEN}✅ Certbot instalado: $(certbot --version 2>&1)${NC}"

# ============================================
# 2. Parar container para liberar porta 80
# ============================================
echo -e "\n${YELLOW}⏸️  [2/6] Parando containers temporariamente...${NC}"
cd "$APP_DIR"
docker compose down 2>/dev/null || true
echo -e "${GREEN}✅ Containers parados${NC}"

# ============================================
# 3. Gerar certificado SSL
# ============================================
echo -e "\n${YELLOW}🔐 [3/6] Gerando certificado SSL...${NC}"

CERTBOT_DOMAINS="-d $DOMAIN"
if [ "$INCLUDE_WWW" = "s" ] || [ "$INCLUDE_WWW" = "S" ]; then
  CERTBOT_DOMAINS="$CERTBOT_DOMAINS -d www.$DOMAIN"
fi

certbot certonly \
  --standalone \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  $CERTBOT_DOMAINS

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Falha ao gerar certificado. Verifique:${NC}"
  echo "   - DNS do domínio aponta para este servidor?"
  echo "   - Portas 80 e 443 estão liberadas no firewall?"
  echo -e "\n${YELLOW}🔄 Reiniciando containers...${NC}"
  docker compose up -d
  exit 1
fi

echo -e "${GREEN}✅ Certificado gerado com sucesso!${NC}"

# ============================================
# 4. Configurar Nginx para SSL
# ============================================
echo -e "\n${YELLOW}⚙️  [4/6] Configurando Nginx para SSL...${NC}"

cat > "$APP_DIR/nginx.conf" << NGINX_EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Redirecionar HTTP para HTTPS
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    # Certificados SSL
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    # Configurações SSL modernas
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;

    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://ai.gateway.lovable.dev; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://ai.gateway.lovable.dev;" always;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX_EOF

echo -e "${GREEN}✅ Nginx configurado com SSL${NC}"

# ============================================
# 5. Atualizar docker-compose.yml para SSL
# ============================================
echo -e "\n${YELLOW}🐳 [5/6] Atualizando Docker Compose...${NC}"

cat > "$APP_DIR/docker-compose.yml" << COMPOSE_EOF
# T2-SimplyFin Docker Compose (SSL)

services:
  financeai:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        VITE_SUPABASE_URL: \${VITE_SUPABASE_URL}
        VITE_SUPABASE_PUBLISHABLE_KEY: \${VITE_SUPABASE_PUBLISHABLE_KEY}
        VITE_SUPABASE_PROJECT_ID: \${VITE_SUPABASE_PROJECT_ID}
    container_name: financeai-app
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    env_file:
      - .env
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:80"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    networks:
      - financeai-network

networks:
  financeai-network:
    driver: bridge
COMPOSE_EOF

echo -e "${GREEN}✅ Docker Compose atualizado${NC}"

# ============================================
# 6. Configurar renovação automática (systemd)
# ============================================
echo -e "\n${YELLOW}🔄 [6/6] Configurando renovação automática...${NC}"

cat > /etc/systemd/system/certbot-renew.service << 'SERVICE_EOF'
[Unit]
Description=Renovar certificado SSL Let's Encrypt
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --quiet --deploy-hook "docker compose -f /opt/financeai/docker-compose.yml exec financeai nginx -s reload"
SERVICE_EOF

cat > /etc/systemd/system/certbot-renew.timer << 'TIMER_EOF'
[Unit]
Description=Timer para renovação automática do SSL

[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
TIMER_EOF

systemctl daemon-reload
systemctl enable --now certbot-renew.timer

echo -e "${GREEN}✅ Renovação automática configurada (2x por dia)${NC}"

# ============================================
# Iniciar aplicação
# ============================================
echo -e "\n${YELLOW}🚀 Iniciando aplicação com SSL...${NC}"
cd "$APP_DIR"
docker compose up -d --build

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   🎉 SSL instalado com sucesso!          ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                          ║${NC}"
echo -e "${GREEN}║   🌐 https://$DOMAIN${NC}"
echo -e "${GREEN}║                                          ║${NC}"
echo -e "${GREEN}║   📋 Comandos úteis:                     ║${NC}"
echo -e "${GREEN}║   • certbot certificates                 ║${NC}"
echo -e "${GREEN}║   • systemctl status certbot-renew.timer ║${NC}"
echo -e "${GREEN}║   • certbot renew --dry-run              ║${NC}"
echo -e "${GREEN}║                                          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
