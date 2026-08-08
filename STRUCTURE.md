# Documentação da Estrutura SimplyFin (v13.4.0)

Este documento descreve a finalidade de cada diretório e arquivo principal do sistema SimplyFin.

## 📁 Estrutura de Diretórios e Arquivos

### 🌐 Raiz do Projeto
- `index.html`: Ponto de entrada HTML do aplicativo.
- `package.json` / `bun.lock` / `package-lock.json`: Dependências e scripts do Node.js.
- `docker-compose.yml` / `Dockerfile`: Configurações para deploy via Docker (VPS Ubuntu 24.04).
- `nginx.conf`: Configurações do Proxy Nginx para a VPS.
- `tailwind.config.ts` / `postcss.config.js`: Configurações de estilo (Tailwind CSS).
- `vite.config.ts` / `tsconfig.json`: Configurações de build (Vite) e TypeScript.
- `install.sh` / `setup-ssl.sh`: Scripts utilitários para configuração inicial da VPS e SSL.

### 🎨 Frontend (`/src`)
- `main.tsx`: Inicializa o React e o QueryClient.
- `App.tsx`: Roteamento principal do sistema (React Router).
- `index.css` / `App.css`: Estilos globais e componentes básicos.

#### `/pages` (Páginas principais)
- `Landing.tsx`: Home comercial (Landing Page).
- `Auth.tsx` / `Signup.tsx`: Login e Cadastro (com trava de novos usuários).
- `Index.tsx`: Dashboard principal minimalista (Modo Foco).
- `Transactions.tsx`: Gestão de entradas e saídas.
- `Settings.tsx`: Configurações de Perfil, Telegram, IA e Backups.
- `Family.tsx`: Gestão do Modo Família (Assentos/Convites).
- `Plans.tsx` / `Checkout.tsx`: Sistema comercial (Stripe/Asaas).
- `Insights.tsx` / `Reports.tsx`: IA e Gerador de relatórios (jsPDF).

#### `/components` (Componentes reutilizáveis)
- `/ui`: Componentes base do Shadcn/UI (Button, Input, etc.).
- `/layout`: Componentes de estrutura (Sidebar, Navbar, BuildFooter).
- `/settings`: Seções específicas da página de configurações (Admin, Telegram).
- `/forms`: Formulários reutilizáveis para contas e transações.

#### `/hooks` (Lógica de estado e efeitos)
- `use-auth.ts`: Gerencia sessão do Supabase.
- `use-license.ts`: Verifica validade da assinatura.
- `use-family.ts`: Lógica de compartilhamento família.
- `use-push-notifications.ts`: Configura notificações via navegador.

#### `/lib` e `/utils`
- `build-info.ts`: Metadados da versão atual (Commit/Build Time).
- `reportGenerator.ts`: Lógica para gerar PDFs de relatórios.
- `utils.ts`: Utilitários de classes CSS e formatação.

### ⚡ Backend (`/supabase`)
- `config.toml`: Configuração do projeto Supabase.

#### `/functions` (Edge Functions - Deno)
- `telegram-webhook/index.ts`: **Motor Principal (Engine V13.4)**. Processa mensagens e fotos do Telegram, faz OCR com Gemini e salva rascunhos.
- `family-management`: Lógica de convites e limites do Modo Família.
- `auto-backup`: Gerencia backups manuais e automáticos na nuvem.
- `stripe-webhook` / `asaas-webhook`: Processa notificações de pagamento.
- `ai-insights` / `auto-categorize`: Processamento inteligente de dados financeiros.

#### `/migrations` (Banco de Dados - SQL)
- Arquivos `.sql`: Define o esquema do banco, tabelas (`profiles`, `transactions`, `telegram_drafts`, `families`), Políticas RLS e GRANTs de acesso.

---

## 🛠️ O Motor de Telegram (Engine V13.4)
O arquivo `supabase/functions/telegram-webhook/index.ts` é o cérebro da integração. Ele:
1. Recebe o Webhook do Telegram.
2. Identifica o usuário pelo `chat_id`.
3. Usa o `telegram_bot_token` específico do usuário para baixar mídias.
4. Converte imagens para Base64.
5. Envia para o **Google Gemini** (`gemini-flash-latest`) extrair JSON (valor, descrição, tipo).
6. Salva em `telegram_drafts`.
7. Envia o card de confirmação interativo de volta ao usuário.
