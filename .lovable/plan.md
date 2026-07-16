# Central de Gestão Comercial (Configurações)

## Objetivo
Consolidar em **Configurações → Gestão** (visível só para admins) todo o controle operacional do modelo comercial: quem usa o sistema, quem administra, e quais licenças mensais estão ativas/vencidas/revogadas. Substitui a necessidade de navegar entre `/admin/licenses` e outras telas isoladas.

## Estrutura da nova seção

Nova seção `AdminManagementSection` renderizada em `Configurações` apenas quando `useUserRole().isAdmin === true`. Layout com **3 abas** (shadcn `Tabs`):

```text
┌─ Configurações ────────────────────────────────┐
│                                                │
│  [Alterar Senha] [Notificações] [Atalhos]      │
│                                                │
│  ┌─ 🛡️  GESTÃO (só admin) ─────────────────┐  │
│  │                                          │  │
│  │  [ Usuários ] [ Admins ] [ Licenças ]    │  │
│  │  ─────────────                           │  │
│  │  ... conteúdo da aba ativa ...           │  │
│  └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

### Aba 1 — Usuários
Lista todos os usuários do sistema com:
- Email, nome de exibição, data de cadastro, último login
- Badge de role (Admin / Usuário)
- Badge de status da licença (Ativa até dd/mm/aaaa · Vencida · Sem licença)
- Busca por email/nome
- Ações por linha:
  - **Resetar senha** (define nova senha via modal)
  - **Promover a admin** / **Rebaixar para usuário**
  - **Vincular licença existente** (dropdown com licenças sem dono)
  - **Excluir usuário** (com dialog de confirmação — apaga em `auth.users` cascade)
- Botão topo: **+ Novo Usuário** (email, senha, role, opção de já criar+vincular licença de X meses)

### Aba 2 — Admins
Sub-visão filtrada da lista com só admins + destaque para operações sensíveis:
- Lista compacta de todos os `user_roles.role = 'admin'`
- Bloqueia auto-rebaixamento (não pode remover o próprio admin se for o último)
- Alerta se existir mais de 1 conta com mesmo email raiz (ex.: `tmunizs@proton.me` vs `tmunizs@proton.ne` — typos)
- Botão limpar contas órfãs (typos de email detectados)

### Aba 3 — Licenças
Reutiliza a lógica atual de `AdminLicenses.tsx` embutida como componente:
- Cards de KPI: **Total** · **Ativas** · **Vencidas** · **Revogadas** · **Receita Mensal Recorrente estimada**
- Tabela de licenças com filtros (status, período, plano)
- Ações por linha: editar validade, revogar, renovar por +1 mês / +12 meses, transferir para outro usuário
- Botão **+ Gerar Licença** (chave gerada por `generate_license_key()` já existente)
- **Novo:** campo `plan_type` (mensal / anual / vitalícia) e `price_brl` para RMR

## Backend

### Nova edge function `admin-users`
Substitui/expande `create-user`. Endpoint único com actions:
- `list` — retorna todos os usuários (email, created_at, last_sign_in_at + join com profiles + role + licença ativa)
- `create` — cria user + role + opcionalmente licença
- `update_password` — reseta senha de qualquer user
- `update_role` — promove/rebaixa (com trava: mín. 1 admin)
- `delete` — apaga user via `auth.admin.deleteUser` (cascade em profiles/user_roles/licenses)
- `link_license` — vincula licença existente a um usuário

Todas as actions:
1. Verificam JWT do chamador via `getClaims`
2. Confirmam que ele tem role admin em `user_roles`
3. Usam `SERVICE_ROLE_KEY` para operações administrativas

### Migração de schema (opcional, se aprovar campos comerciais)
Adiciona colunas em `licenses`:
- `plan_type text` (default `'monthly'`) — enum lógico: `monthly`/`yearly`/`lifetime`
- `price_brl numeric(10,2)` (default 0) — preço mensal para cálculo de RMR
- `notes text` — observações internas do admin

Cria índice `licenses(user_id, status)` para query rápida de "licença ativa do usuário X".

## Como o admin acessa
1. Login como admin em `/auth`
2. Sidebar → **Configurações**
3. Rola até o card **🛡️ Gestão** (só aparece se admin)
4. Clica na aba desejada

A rota antiga `/admin/licenses` continua funcionando (não removo pra não quebrar bookmarks), mas o link no sidebar passa a apontar para `/settings#gestao` (ancora que abre a aba Licenças diretamente).

## Segurança
- Toda a lógica sensível fica na edge function `admin-users` — nunca no cliente
- Frontend só chama a função via `supabase.functions.invoke` com JWT
- RLS em `licenses` já protege leitura direta (só admin ou dono)
- Trava anti-lockout: última conta admin não pode se auto-rebaixar nem se auto-deletar
- Log de auditoria: cada ação administrativa insere linha em nova tabela `admin_audit_log` (quem fez, o quê, quando, alvo) — útil para compliance quando escalar

## Fora de escopo (não faço nesta entrega)
- Cobrança automática (Stripe/Paddle) — próximo épico
- Portal self-service pro cliente comprar licença sozinho — depende de pagamento primeiro
- Envio de email transacional (licença criada, expirando, renovada) — precisa configurar domínio de envio primeiro
- Multi-tenancy real (workspaces/famílias) — está bloqueado pela memória atual do projeto

## Perguntas antes de codar
1. **Confirmar campos comerciais em `licenses`**: quer que eu adicione `plan_type` + `price_brl` + `notes` na tabela? (Sem isso, o KPI de Receita Mensal não sai.)
2. **Log de auditoria**: quer a tabela `admin_audit_log` já nesta entrega, ou deixa pra depois?
3. **Excluir usuário**: quando um usuário é deletado, o que fazer com as transações financeiras dele?
   - **A)** Cascade — apaga tudo (padrão atual, agressivo)
   - **B)** Manter transações órfãs em tabela `deleted_users_archive` (compliance / auditoria)
4. **Endpoint público de compra**: não implemento agora, mas quer que eu já deixe as licenças com `activation_url` (link único do tipo `/activate/{key}`) para uso futuro com checkout?
