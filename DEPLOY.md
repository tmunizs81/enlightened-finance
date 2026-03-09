# 🚀 Guia Completo de Deploy - FinanceAI

## Deploy em Servidor Ubuntu 24.04 LTS

### 📋 Pré-requisitos

- Servidor Ubuntu 24.04 LTS com acesso root
- Mínimo 2GB RAM e 20GB disco
- IP público do servidor
- Portas 80 e 443 liberadas no firewall

---

## 🎯 Instalação Rápida (Recomendado)

### Opção 1: Script Automático

Execute **um único comando** no seu servidor:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/tmunizs81/enlightened-finance/main/install.sh)
```

✅ Instala tudo automaticamente: Docker, código e sobe a aplicação!

---

## 📖 Instalação Manual (Passo a Passo)

### 1. Acessar o Servidor

```bash
ssh root@SEU_IP_DO_SERVIDOR
```

### 2. Atualizar o Sistema

```bash
apt update && apt upgrade -y
apt install -y curl wget git ca-certificates gnupg
```

### 3. Instalar Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh
systemctl enable docker
systemctl start docker
```

Verificar instalação:
```bash
docker --version
docker compose version
```

### 4. Clonar o Repositório

**Opção A - Repositório Público:**
```bash
cd /opt
git clone https://github.com/tmunizs81/enlightened-finance.git financeai
cd financeai
```

**Opção B - Repositório Privado:**
```bash
# Criar Personal Access Token no GitHub
# Settings → Developer Settings → Personal Access Tokens → Generate new token

cd /opt
git clone https://SEU_TOKEN@github.com/tmunizs81/enlightened-finance.git financeai
cd financeai
```

### 5. Criar Arquivo .env

O arquivo `.env` não vai para o GitHub por segurança. Crie manualmente:

```bash
cat > .env << 'EOF'
VITE_SUPABASE_PROJECT_ID="difwlzancpnvwkiyhmll"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpZndsemFuY3BudndraXlobWxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDExNzQsImV4cCI6MjA4ODU3NzE3NH0.dvVOViHFILd5fGOuDifbnW47aQQGpUoQ8ZOz-SaiLTY"
VITE_SUPABASE_URL="https://difwlzancpnvwkiyhmll.supabase.co"
EOF
```

Verificar:
```bash
cat .env
```

### 6. Iniciar a Aplicação

```bash
docker compose up -d --build
```

Aguarde 2-3 minutos para o build completar.

### 7. Verificar Status

```bash
# Ver containers rodando
docker compose ps

# Ver logs em tempo real
docker compose logs -f

# (Pressione Ctrl+C para sair dos logs)
```

### 8. Descobrir o IP e Acessar

```bash
hostname -I | awk '{print $1}'
```

Abra no navegador:
```
http://SEU_IP
```

---

## 🔧 Comandos Úteis

### Ver logs da aplicação
```bash
cd /opt/financeai
docker compose logs -f
```

### Reiniciar a aplicação
```bash
docker compose restart
```

### Parar a aplicação
```bash
docker compose down
```

### Atualizar a aplicação (após push no GitHub)
```bash
cd /opt/financeai
git pull
docker compose down
docker compose up -d --build
```

### Ver uso de recursos
```bash
docker stats
```

### Ver status dos containers
```bash
docker compose ps
```

### Acessar o container (debug)
```bash
docker exec -it financeai-app sh
```

### Limpar logs antigos
```bash
docker compose logs --tail=100
```

---

## 🐛 Solução de Problemas

### Aplicação não inicia

```bash
# Verificar logs
docker compose logs

# Verificar se a porta 80 está livre
netstat -tulpn | grep :80

# Reconstruir do zero
docker compose down -v
docker compose up -d --build
```

### Erro: Authentication failed no git clone

**Solução 1 - Tornar repositório público:**
- GitHub → seu repo → Settings → Danger Zone → Change visibility → Public

**Solução 2 - Usar Personal Access Token:**
```bash
git clone https://SEU_TOKEN@github.com/tmunizs81/enlightened-finance.git financeai
```

### Erro: Arquivo .env não encontrado

```bash
cd /opt/financeai
cat > .env << 'EOF'
VITE_SUPABASE_PROJECT_ID="difwlzancpnvwkiyhmll"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpZndsemFuY3BudndraXlobWxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDExNzQsImV4cCI6MjA4ODU3NzE3NH0.dvVOViHFILd5fGOuDifbnW47aQQGpUoQ8ZOz-SaiLTY"
VITE_SUPABASE_URL="https://difwlzancpnvwkiyhmll.supabase.co"
EOF
```

### Erro: npm ci failed

Já corrigido no Dockerfile (usa `npm install` em vez de `npm ci`).

### Docker não instalado

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

### Porta 80 já em uso

```bash
# Ver o que está usando a porta
netstat -tulpn | grep :80

# Parar serviço (ex: Apache)
systemctl stop apache2
systemctl disable apache2
```

### Sem espaço em disco

```bash
# Limpar containers e imagens antigas
docker system prune -a

# Ver uso de disco
df -h
```

---

## 🌐 Configurar Domínio Personalizado (Opcional)

### 1. Apontar Domínio para o Servidor

No painel do seu provedor de domínio, crie um registro A:

```
Type: A
Name: @ (ou subdomínio)
Value: SEU_IP_DO_SERVIDOR
TTL: 3600
```

Aguarde 10-30 minutos para propagação DNS.

### 2. Instalar Certificado SSL (HTTPS)

```bash
# Instalar Certbot
apt install -y certbot python3-certbot-nginx

# Obter certificado (substitua seudominio.com)
certbot certonly --standalone -d seudominio.com -d www.seudominio.com
```

### 3. Configurar Nginx para SSL

```bash
nano /opt/financeai/nginx.conf
```

Adicione/altere:

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name seudominio.com www.seudominio.com;

    ssl_certificate /etc/letsencrypt/live/seudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seudominio.com/privkey.pem;

    # Redirecionar HTTP para HTTPS
    if ($scheme != "https") {
        return 301 https://$host$request_uri;
    }

    root /usr/share/nginx/html;
    index index.html;

    # ... resto da configuração ...
}
```

### 4. Atualizar docker-compose.yml para SSL

```bash
nano /opt/financeai/docker-compose.yml
```

Adicione volumes para certificados:

```yaml
services:
  financeai:
    # ... resto da configuração ...
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
```

### 5. Reiniciar

```bash
docker compose down
docker compose up -d
```

### 6. Renovação Automática do SSL

```bash
# Testar renovação
certbot renew --dry-run

# Adicionar ao cron (renovação automática)
crontab -e

# Adicionar esta linha:
0 3 * * * certbot renew --quiet && docker compose -f /opt/financeai/docker-compose.yml restart
```

---

## 🔒 Segurança Básica

### Firewall (UFW)

```bash
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS
ufw enable
ufw status
```

### Atualizar Sistema Regularmente

```bash
# Criar script de atualização
cat > /root/update.sh << 'EOF'
#!/bin/bash
apt update
apt upgrade -y
docker system prune -f
EOF

chmod +x /root/update.sh

# Adicionar ao cron (semanal)
crontab -e
# Adicionar: 0 3 * * 0 /root/update.sh
```

### Mudar Senha do Root

```bash
passwd
```

### Desabilitar Login Root SSH (opcional)

```bash
nano /etc/ssh/sshd_config
# Alterar: PermitRootLogin no
systemctl restart sshd
```

---

## 📊 Monitoramento

### Ver uso de recursos em tempo real

```bash
docker stats
```

### Logs em tempo real

```bash
docker compose logs -f --tail=50
```

### Verificar saúde do container

```bash
docker inspect financeai-app | grep Health
```

### Configurar alertas (opcional)

Instalar Netdata para monitoramento visual:
```bash
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
```

Acessar: `http://SEU_IP:19999`

---

## 📱 Testar em Dispositivos

### Desktop
```
http://SEU_IP
ou
https://seudominio.com
```

### Mobile
Use o mesmo endereço acima no navegador do celular.

---

## ✅ Checklist de Deploy

- [ ] Servidor Ubuntu 24.04 configurado
- [ ] Acesso root via SSH
- [ ] Docker instalado e rodando
- [ ] Repositório clonado em `/opt/financeai`
- [ ] Arquivo `.env` criado
- [ ] `docker compose up -d --build` executado
- [ ] Aplicação acessível via `http://SEU_IP`
- [ ] Logs verificados (sem erros críticos)
- [ ] Domínio apontado (opcional)
- [ ] SSL instalado (opcional)
- [ ] Firewall configurado
- [ ] Backup configurado (ver próxima seção)

---

## 💾 Backup e Restore

### Backup do Banco de Dados

O banco de dados está no Supabase (cloud), backups automáticos já estão ativos.

Para exportar dados:
1. Acesse o Lovable Cloud
2. Cloud → Database → Selecione a tabela
3. Clique em Export

### Backup do Código

```bash
# Fazer backup do .env
cp /opt/financeai/.env /root/financeai-env-backup

# O código está no GitHub (já é backup)
```

### Restore em Novo Servidor

Basta seguir este guia do zero no novo servidor! 🎉

---

## 🎯 Próximos Passos Recomendados

1. ✅ **Configurar domínio personalizado**
2. ✅ **Instalar certificado SSL (HTTPS)**
3. ✅ **Configurar firewall (UFW)**
4. ✅ **Configurar monitoramento (Netdata)**
5. ✅ **Documentar suas credenciais em local seguro**
6. ✅ **Testar em diferentes dispositivos**
7. ✅ **Configurar alertas de erro**
8. ✅ **Fazer backup regular do .env**

---

## 💡 Dicas Importantes

- **Use `screen` ou `tmux`** para manter sessões SSH ativas
- **Documente mudanças importantes** em um arquivo CHANGELOG
- **Teste antes de atualizar** em produção
- **Monitore logs regularmente**: `docker compose logs -f`
- **Mantenha o sistema atualizado**: `apt update && apt upgrade`
- **Não compartilhe credenciais** (senhas, tokens) publicamente

---

## 🆘 Suporte

### Logs do Docker
```bash
docker compose logs -f
```

### Logs do Sistema
```bash
journalctl -xe
```

### Status de Serviços
```bash
systemctl status docker
```

### Reiniciar Tudo
```bash
cd /opt/financeai
docker compose down
docker compose up -d --build
```

---

## 📚 Recursos Adicionais

- [Documentação Docker](https://docs.docker.com/)
- [Lovable Cloud Docs](https://docs.lovable.dev/)
- [Supabase Docs](https://supabase.com/docs)
- [Let's Encrypt](https://letsencrypt.org/)
- [Nginx Docs](https://nginx.org/en/docs/)

---

**Pronto! Sua aplicação FinanceAI está no ar! 🎉**

---

## 📝 Changelog

### v1.0.0 - 2026-03-09
- ✅ Deploy inicial funcionando
- ✅ Docker + Docker Compose configurado
- ✅ Nginx como proxy reverso
- ✅ Build otimizado com Node 20
- ✅ Health checks configurados
- ✅ Integração com Supabase Cloud
- ✅ Manual completo de instalação

---

*Criado com ❤️ usando Lovable*
