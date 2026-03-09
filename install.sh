#!/bin/bash
set -euo pipefail

# ============================================
# FinanceAI - Installation Script
# Ubuntu 24.04 LTS
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${CYAN}[i]${NC} $1"; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     FinanceAI - Instalação           ║${NC}"
echo -e "${CYAN}║     Ubuntu 24.04 LTS                 ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

# ============================================
# 1. System Update & Dependencies
# ============================================
info "Atualizando sistema..."
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl wget git ca-certificates gnupg lsb-release
log "Sistema atualizado"

# ============================================
# 2. Install Docker
# ============================================
if ! command -v docker &> /dev/null; then
  info "Instalando Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable docker
  systemctl start docker
  log "Docker instalado"
else
  log "Docker já instalado"
fi

# ============================================
# 3. Configure Environment
# ============================================
ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
  info "Configurando variáveis de ambiente..."
  cat > "$ENV_FILE" <<EOF
# FinanceAI Environment Variables
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
APP_PORT=80
EOF
  warn "Edite o arquivo .env com suas credenciais do Supabase antes de continuar!"
  warn "Execute: nano .env"
  read -p "Pressione ENTER após configurar o .env..."
else
  log "Arquivo .env encontrado"
fi

# ============================================
# 4. Build & Start Containers
# ============================================
info "Construindo e iniciando containers..."
docker compose up -d --build
log "Containers iniciados"

# ============================================
# 5. Health Check
# ============================================
info "Verificando saúde dos serviços..."
sleep 5

MAX_RETRIES=10
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
  if curl -sf http://localhost:${APP_PORT:-80} > /dev/null 2>&1; then
    log "Aplicação respondendo na porta ${APP_PORT:-80}"
    break
  fi
  RETRY=$((RETRY + 1))
  info "Tentativa $RETRY/$MAX_RETRIES..."
  sleep 3
done

if [ $RETRY -eq $MAX_RETRIES ]; then
  warn "A aplicação pode estar demorando para iniciar. Verifique com: docker compose logs"
fi

# ============================================
# Summary
# ============================================
echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Instalação Concluída! 🚀         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  🌐 Acesse: ${CYAN}http://$(hostname -I | awk '{print $1}'):${APP_PORT:-80}${NC}"
echo ""
echo -e "  Comandos úteis:"
echo -e "    docker compose logs -f     # Ver logs"
echo -e "    docker compose restart     # Reiniciar"
echo -e "    docker compose down        # Parar"
echo ""
