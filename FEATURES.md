# 📋 T2-SimplyFin - Lista Completa de Funcionalidades

> Sistema completo de gestão financeira pessoal com inteligência artificial integrada.

---

## 🎯 Módulos Principais

### 📊 Dashboard
- **Cards de resumo**: Receitas, Despesas, Saldo e Economia do mês
- **Gráfico de fluxo de caixa**: Visualização de entradas e saídas ao longo do tempo
- **Gráfico de pizza por categoria**: Distribuição de gastos por categoria
- **Score financeiro**: Pontuação de 0-100 baseada em economia, metas e orçamento
- **Heatmap de gastos**: Visualização de padrões de gastos por dia/hora
- **Comparativo mensal**: Comparação de receitas e despesas entre meses
- **Comparativo anual**: Visão de desempenho financeiro ao longo do ano
- **Modo foco**: Interface simplificada para visualização rápida

### 💳 Transações
- **Cadastro de receitas e despesas**: Formulário completo com data, valor, categoria e conta
- **Filtros avançados**: Por tipo, categoria, conta, período e status
- **Busca por descrição**: Localização rápida de transações
- **Edição e exclusão**: Gerenciamento completo das transações
- **Status de pagamento**: Controle de transações pagas/pendentes
- **Notas e observações**: Campo para anotações adicionais
- **Upload de recibos**: Anexo de comprovantes às transações

### 🔄 Transações Recorrentes
- **Cadastro de recorrências**: Contas fixas mensais (salário, aluguel, assinaturas)
- **Dia do mês configurável**: Escolha do dia de vencimento
- **Ativação/desativação**: Controle de recorrências ativas
- **Geração automática**: Sistema cria transações automaticamente no dia configurado
- **Categorização**: Vinculação com categorias existentes

### 💰 Orçamentos
- **Orçamento por categoria**: Definição de limites mensais por categoria
- **Acompanhamento de gastos**: Visualização do consumo vs. orçamento
- **Alertas de limite**: Notificações ao se aproximar do limite
- **Histórico mensal**: Comparativo de orçamentos entre meses

### 🎯 Metas Financeiras
- **Criação de metas**: Definição de objetivos com valor alvo
- **Prazo/deadline**: Data limite para atingir a meta
- **Progresso visual**: Barra de progresso e porcentagem
- **Cores e ícones**: Personalização visual das metas
- **Projeção de conclusão**: IA calcula data estimada de conclusão

### 🏦 Contas Bancárias
- **Múltiplas contas**: Gerenciamento de várias contas/carteiras
- **Tipos de conta**: Corrente, Poupança, Investimento, Carteira
- **Cores personalizadas**: Identificação visual de cada conta
- **Saldo individual e total**: Visualização consolidada
- **Instituição financeira**: Campo para nome do banco

### 🏆 Conquistas (Gamificação)
- **Sistema de XP**: Pontos de experiência por ações financeiras
- **Badges desbloqueáveis**: Conquistas por metas atingidas
- **Progresso de conquistas**: Acompanhamento de cada achievement
- **Streaks**: Sequências de dias com boas práticas financeiras

---

## 🤖 Funcionalidades de Inteligência Artificial

### 💬 Assistente de IA (Chat)
- **Consultas em linguagem natural**: Pergunte sobre suas finanças
- **Análise de gastos**: "Quanto gastei com alimentação?"
- **Dicas personalizadas**: Sugestões baseadas no seu perfil
- **Histórico de conversas**: Contexto mantido durante a sessão

### 📈 Insights Automáticos
- **Geração periódica**: IA analisa dados e gera insights
- **Tipos de insight**: Alertas, Dicas, Padrões identificados
- **Marcação como lido**: Controle de insights visualizados

### 🔮 Previsão de Saldo (ML)
- **Projeção de 30 dias**: Estimativa de saldo futuro
- **Baseado em padrões**: Análise de transações recorrentes
- **Cenários otimista/pessimista**: Range de previsão

### ⚠️ Detecção de Anomalias
- **Identificação automática**: Gastos fora do padrão
- **Comparação com média**: Transações 2x+ acima da média da categoria
- **Explicação por IA**: Análise e sugestões sobre anomalias

### 💡 Sugestões de Orçamento
- **Baseado em histórico**: IA sugere valores de orçamento
- **Por categoria**: Sugestões específicas para cada categoria
- **Justificativa**: Explicação do motivo da sugestão

### 🚨 Alertas Preditivos
- **Previsão de estouro**: IA prevê quando você vai estourar o orçamento
- **Dias de antecedência**: Alerta antes do problema acontecer
- **Dicas de economia**: Sugestões específicas para evitar o estouro
- **Limite seguro diário**: Quanto você pode gastar por dia

### 📊 Score Financeiro com IA
- **Pontuação 0-100**: Avaliação geral da saúde financeira
- **Breakdown detalhado**: Economia, Metas, Orçamento, Saúde
- **Explicação personalizada**: IA explica o que está afetando seu score
- **Ações recomendadas**: Passos concretos para melhorar

### 📅 Resumo Semanal
- **Análise automática**: Resumo da última semana
- **Comparativos**: Receitas vs. Despesas
- **Top categorias**: Maiores gastos da semana
- **Dica da semana**: Conselho personalizado

### 🏅 Desafios Semanais
- **Gerados por IA**: Desafios personalizados baseados no seu perfil
- **Recompensa em XP**: Pontos por completar desafios
- **Progresso em tempo real**: Acompanhamento do desafio
- **Tipos variados**: Economia, registro de transações, metas

### 🔔 Alertas Inteligentes
- **Contas a vencer**: Lembretes de transações pendentes
- **Metas próximas do prazo**: Alertas de deadlines
- **Gastos elevados**: Notificação de gastos acima do normal
- **Economia detectada**: Parabenização por bom comportamento

---

## 📱 Integrações

### 🤖 Bot do Telegram
- **Registro via chat**: Cadastre transações pelo Telegram
- **Consultas rápidas**: Veja saldo e gastos pelo bot
- **Notificações**: Receba alertas no Telegram
- **OCR de recibos**: Envie fotos de recibos para cadastro automático
- **Comandos disponíveis**:
  - `/saldo` - Ver saldo atual
  - `/gastos` - Resumo de gastos do mês
  - `/meta` - Status das metas
  - Envio de texto para registrar transação
  - Envio de foto para OCR de recibo

---

## 📊 Relatórios

### 📈 Relatórios Financeiros
- **Por período**: Mensal, trimestral, anual
- **Por categoria**: Detalhamento de gastos
- **Comparativos**: Entre períodos
- **Exportação PDF**: Geração de relatórios em PDF

---

## ⚡ Regras Financeiras (Automação)

### 🔧 Regras Personalizadas
- **Condições configuráveis**: Valor, categoria, período
- **Ações automáticas**: Alertas, notificações
- **Ativação/desativação**: Controle de regras ativas
- **Histórico de execução**: Quando a regra foi acionada

---

## 🔐 Segurança e Conta

### 👤 Autenticação
- **Email e senha**: Login tradicional
- **Verificação de email**: Confirmação de conta
- **Logout por inatividade**: Segurança automática
- **Row Level Security**: Isolamento de dados por usuário

### ⚙️ Configurações
- **Perfil do usuário**: Nome, avatar
- **Integração Telegram**: Configuração do bot
- **Tema claro/escuro**: Personalização visual
- **Backup automático**: Exportação periódica de dados

### 🔑 Licenciamento
- **Verificação de licença**: Controle de acesso
- **Status da licença**: Visualização de validade
- **Painel admin**: Gerenciamento de licenças (admin)

---

## 📱 PWA (Progressive Web App)

### 📲 Instalação
- **Instalar no dispositivo**: Funciona como app nativo
- **Ícones personalizados**: 192px e 512px
- **Funciona offline**: Cache de dados essenciais
- **Notificações push**: Alertas mesmo com app fechado

---

## 🛠️ Tecnologias

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **UI Components**: Shadcn/ui, Radix UI
- **Gráficos**: Recharts
- **Animações**: Framer Motion
- **Backend**: Lovable Cloud (Supabase)
- **Banco de dados**: PostgreSQL
- **IA**: Lovable AI Gateway (Gemini, GPT)
- **Edge Functions**: Deno (Supabase Functions)

---

## 📁 Estrutura de Edge Functions

| Função | Descrição |
|--------|-----------|
| `chat` | Assistente de IA conversacional |
| `generate-insights` | Geração de insights automáticos |
| `financial-score` | Cálculo do score financeiro |
| `balance-forecast` | Previsão de saldo futuro |
| `ai-anomalies` | Detecção de anomalias com IA |
| `ai-budget-suggest` | Sugestões de orçamento |
| `ai-score-explain` | Explicação do score por IA |
| `predictive-alerts` | Alertas preditivos de orçamento |
| `weekly-summary` | Resumo semanal automático |
| `weekly-challenges` | Geração de desafios semanais |
| `smart-alerts` | Sistema de alertas inteligentes |
| `auto-categorize` | Categorização automática de transações |
| `process-recurring` | Processamento de transações recorrentes |
| `telegram-webhook` | Integração com bot do Telegram |
| `achievements` | Sistema de conquistas |
| `auto-backup` | Backup automático de dados |
| `create-user` | Criação de perfil de usuário |
| `spending-monitor` | Monitoramento de gastos |
| `monthly-summary` | Resumo mensal |

---

## 📊 Tabelas do Banco de Dados

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Perfis de usuário |
| `accounts` | Contas bancárias |
| `categories` | Categorias de transação |
| `transactions` | Transações financeiras |
| `budgets` | Orçamentos mensais |
| `goals` | Metas financeiras |
| `recurring_transactions` | Transações recorrentes |
| `ai_insights` | Insights gerados por IA |
| `achievements` | Conquistas do usuário |
| `streaks` | Sequências de ações |
| `weekly_challenges` | Desafios semanais |
| `financial_rules` | Regras de automação |
| `licenses` | Licenças de usuário |
| `user_roles` | Funções de usuário (admin/user) |
| `pending_ocr_transactions` | Transações OCR pendentes |

---

## 🚀 Versão

**Versão atual**: 1.0.0

**Última atualização**: Março 2026

---

*Desenvolvido com ❤️ usando Lovable*
