# 💰 FinanceAI - Gerenciador Financeiro Inteligente

Aplicação web completa de gestão financeira pessoal com inteligência artificial integrada, desenvolvida com React, TypeScript, Tailwind CSS e Lovable Cloud.

![FinanceAI](https://img.shields.io/badge/Status-Production-success)
![License](https://img.shields.io/badge/License-MIT-blue)
![Version](https://img.shields.io/badge/Version-1.0.0-orange)

---

## ✨ Funcionalidades Principais

### 📊 Dashboard Inteligente
- Visão geral das finanças com gráficos interativos
- Análise de fluxo de caixa
- Previsão de saldo futuro
- Distribuição de gastos por categoria

### 💳 Gestão de Transações
- Cadastro rápido de receitas e despesas
- Upload e OCR de recibos
- Categorização automática
- Filtros e busca avançada

### 🎯 Metas Financeiras
- Definição de objetivos
- Acompanhamento de progresso
- Alertas de deadline
- Visualização de conquistas

### 📅 Transações Recorrentes
- Automação de contas fixas
- Assinaturas e mensalidades
- Geração automática de lançamentos

### 🤖 Assistente de IA
- Chat interativo para consultas
- Insights financeiros personalizados
- Análise de padrões de gastos
- Sugestões de economia

### 📱 Telegram Bot
- Registro de transações via chat
- Consultas de saldo e gastos
- Notificações de metas
- Resumos diários automáticos

### 🔐 Segurança e Privacidade
- Autenticação segura (email + Google)
- Dados criptografados
- Row Level Security (RLS)
- Backup automático

---

## 🚀 Deploy em Produção

### Opção 1: Script Automático (Recomendado)

Execute no seu servidor Ubuntu 24.04:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/tmunizs81/enlightened-finance/main/install.sh)
```

### Opção 2: Manual Completo

Leia o guia detalhado: **[DEPLOY.md](DEPLOY.md)**

Inclui:
- ✅ Instalação passo a passo no Ubuntu 24.04
- ✅ Configuração de domínio e SSL
- ✅ Segurança e firewall
- ✅ Monitoramento e backup
- ✅ Troubleshooting completo

---

## 🛠️ Tecnologias Utilizadas

### Frontend
- **React 18** - Interface moderna e reativa
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização utility-first
- **Shadcn/ui** - Componentes acessíveis
- **Recharts** - Gráficos interativos
- **Framer Motion** - Animações fluidas
- **React Router** - Navegação SPA

### Backend
- **Lovable Cloud** - Backend completo (Supabase)
- **PostgreSQL** - Banco de dados relacional
- **Edge Functions** - Lógica serverless
- **Row Level Security** - Segurança de dados

### Integrações
- **Lovable AI** - Modelos de IA (Gemini, GPT)
- **Telegram API** - Bot de conversação
- **OCR** - Extração de dados de recibos

### DevOps
- **Docker** - Containerização
- **Docker Compose** - Orquestração
- **Nginx** - Proxy reverso
- **GitHub Actions** - CI/CD (futuro)

---

## 📁 Estrutura do Projeto

```
enlightened-finance/
├── src/
│   ├── components/       # Componentes React
│   │   ├── chat/        # Chat de IA
│   │   ├── dashboard/   # Gráficos e cards
│   │   ├── forms/       # Formulários
│   │   ├── layout/      # Layout principal
│   │   └── ui/          # Componentes base
│   ├── hooks/           # Custom hooks
│   ├── pages/           # Páginas da aplicação
│   ├── lib/             # Utilitários
│   └── integrations/    # Integrações externas
├── supabase/
│   ├── functions/       # Edge Functions
│   └── migrations/      # Migrações do banco
├── public/              # Arquivos estáticos
├── Dockerfile           # Build da aplicação
├── docker-compose.yml   # Configuração Docker
├── nginx.conf           # Configuração Nginx
└── install.sh           # Script de instalação
```

---

## 🧪 Desenvolvimento Local

### Pré-requisitos

- Node.js 20+
- npm ou bun

### Instalação

```bash
# Clonar repositório
git clone https://github.com/tmunizs81/enlightened-finance.git
cd enlightened-finance

# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

Acesse: `http://localhost:5173`

### Variáveis de Ambiente

Já configuradas automaticamente pelo Lovable Cloud:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

---

## 📊 Banco de Dados

### Tabelas Principais

- **profiles** - Perfis de usuário
- **accounts** - Contas bancárias
- **categories** - Categorias de transação
- **transactions** - Transações financeiras
- **budgets** - Orçamentos mensais
- **goals** - Metas financeiras
- **recurring_transactions** - Transações recorrentes
- **ai_insights** - Insights gerados por IA
- **pending_ocr_transactions** - Transações OCR pendentes

### Segurança (RLS)

Todas as tabelas possuem políticas RLS:
- Usuários só acessam seus próprios dados
- Validações no lado do servidor
- Triggers para auditoria

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Add: MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

---

## 📝 Roadmap

### v1.1 (Em Breve)
- [ ] App mobile nativo
- [ ] Exportação de relatórios PDF
- [ ] Integração com bancos (Open Banking)
- [ ] Modo multi-moeda
- [ ] Temas personalizáveis

### v1.2 (Futuro)
- [ ] Investimentos e carteiras
- [ ] Split de despesas (grupos)
- [ ] Planejamento tributário
- [ ] API pública

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja [LICENSE](LICENSE) para mais informações.

---

## 👤 Autor

**tmunizs81**

- GitHub: [@tmunizs81](https://github.com/tmunizs81)
- Projeto: [enlightened-finance](https://github.com/tmunizs81/enlightened-finance)

---

## 🙏 Agradecimentos

- [Lovable](https://lovable.dev) - Plataforma de desenvolvimento
- [Supabase](https://supabase.com) - Backend e infraestrutura
- [Shadcn/ui](https://ui.shadcn.com) - Biblioteca de componentes
- Comunidade open-source

---

## 📞 Suporte

Encontrou um bug ou tem uma sugestão?

- 🐛 [Reporte um bug](https://github.com/tmunizs81/enlightened-finance/issues)
- 💡 [Sugira uma feature](https://github.com/tmunizs81/enlightened-finance/issues)

---

## 🌟 Dê uma Estrela!

Se este projeto te ajudou, considere dar uma ⭐ no GitHub!

---

**Desenvolvido com ❤️ usando Lovable**

---

## 📚 Links Úteis

- [Deploy Guide](DEPLOY.md) - Guia completo de instalação
- [Lovable Docs](https://docs.lovable.dev) - Documentação oficial
- [Supabase Docs](https://supabase.com/docs) - Documentação Supabase
- [React Docs](https://react.dev) - Documentação React
