# 🚀 Guia de Deploy - FinanceAI

## Parte 3: Deploy em Servidor Ubuntu 24.04

### Pré-requisitos
- Servidor Ubuntu 24.04 LTS com acesso root
- IP público do servidor
- Portas 80 e 443 liberadas no firewall

---

## 📋 Passo a Passo

### 1. Acesse seu servidor
```bash
ssh root@SEU_IP_DO_SERVIDOR
```

### 2. Baixe e execute o script de instalação
```bash
curl -fsSL https://raw.githubusercontent.com/tmunizs81/enlightened-finance/main/install.sh -o install.sh
chmod +x install.sh
sudo bash install.sh
```

**O script fará tudo automaticamente:**
- ✅ Clonar o repositório
- ✅ Atualizar o sistema
- ✅ Instalar Docker
- ✅ Construir e iniciar a aplicação

### 3. Aguarde a conclusão
O processo leva cerca de 5-10 minutos. Você verá:
```
╔══════════════════════════════════════╗
║     Instalação Concluída! 🚀         ║
╚══════════════════════════════════════╝

🌐 Acesse: http://SEU_IP:80
```

### 4. Acesse a aplicação
Abra no navegador:
```
http://SEU_IP_DO_SERVIDOR
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

### Atualizar a aplicação
```bash
git pull
docker compose up -d --build
```

### Ver status dos containers
```bash
docker compose ps
```

### Limpar logs
```bash
docker compose logs --tail=100
```

---

## 🌐 Configurar Domínio (Opcional)

### 1. Aponte seu domínio para o IP do servidor
No painel do seu provedor de domínio, crie um registro A:
```
Type: A
Name: @
Value: SEU_IP_DO_SERVIDOR
TTL: 3600
```

### 2. Instalar SSL com Let's Encrypt
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d seudominio.com -d www.seudominio.com
```

### 3. Atualizar nginx.conf
```bash
nano /opt/financeai/nginx.conf
```

Altere a linha:
```nginx
server_name _;
```

Para:
```nginx
server_name seudominio.com www.seudominio.com;
```

### 4. Reiniciar
```bash
docker compose restart
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

### Erro de permissão
```bash
# Execute como root
sudo su
cd /opt/financeai
```

### Docker não instalado
```bash
# Reinstalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

### Erro de conexão com Supabase
Verifique se as variáveis no `.env` estão corretas:
```bash
cat .env
```

---

## 📊 Monitoramento

### Ver uso de recursos
```bash
docker stats
```

### Ver logs em tempo real
```bash
docker compose logs -f --tail=50
```

### Verificar saúde do container
```bash
docker inspect financeai-app | grep Health
```

---

## 🔒 Segurança

### Firewall básico
```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Atualizar sistema regularmente
```bash
apt update && apt upgrade -y
```

---

## 📱 Testar Mobile

Acesse do seu celular:
```
http://SEU_IP_DO_SERVIDOR
```

Ou com domínio:
```
https://seudominio.com
```

---

## ✅ Checklist de Deploy

- [ ] Servidor Ubuntu 24.04 configurado
- [ ] Acesso root via SSH
- [ ] Git instalado e repositório clonado
- [ ] Arquivo `.env` configurado
- [ ] Script `install.sh` executado
- [ ] Aplicação acessível via browser
- [ ] Logs verificados (sem erros)
- [ ] Domínio configurado (opcional)
- [ ] SSL instalado (opcional)
- [ ] Backup configurado

---

## 🎯 Próximos Passos

1. ✅ **Configure backups automáticos**
2. ✅ **Configure um domínio personalizado**
3. ✅ **Instale certificado SSL**
4. ✅ **Configure monitoramento**
5. ✅ **Documente suas credenciais**

---

## 💡 Dicas

- Use `screen` ou `tmux` para manter sessões ativas
- Configure alertas de monitoramento
- Faça backup do arquivo `.env`
- Documente mudanças importantes
- Teste antes de atualizar em produção

---

**Pronto! Sua aplicação FinanceAI está no ar! 🎉**
