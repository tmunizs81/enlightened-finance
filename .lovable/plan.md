## Modo Família — SimplyFin

Compartilhamento de dados financeiros entre até 5 logins sob 1 licença família. Pool único: dados criados **após** entrar na família ficam visíveis a todos os membros; dados criados **antes** permanecem privados do dono original. 4 papéis: Owner, Admin, Member, Viewer. Zero mudança no que já existe — só adição.

---

### 1. Schema (migration)

**Novas tabelas**
- `families` — `id, name, owner_id, license_id, max_seats (default 5), created_at, updated_at`
- `family_members` — `id, family_id, user_id (unique), role (enum: owner|admin|member|viewer), joined_at`
- `family_invites` — `id, family_id, email, token, role, invited_by, expires_at (7d), accepted_at`
- Enum `family_role`

**Coluna nova em cada tabela de dados** (`family_id UUID NULL` + índice):
`accounts, transactions, budgets, goals, categories, tags, recurring_transactions, financial_rules, transaction_splits, transaction_tags, ai_insights, pending_ocr_transactions, achievements, streaks, weekly_challenges`

Regra: `family_id NULL` = privado do `user_id`; `family_id preenchido` = pool da família.

**Licenças** — adicionar coluna `max_seats INT DEFAULT 1`. `plan_type='family'` → `max_seats=5` automaticamente na criação via admin.

**Security definer functions**
- `get_user_family(uid)` → `family_id` (ou NULL)
- `get_family_role(uid, fid)` → `family_role`
- `has_family_permission(uid, fid, min_role)` — hierarquia viewer<member<admin<owner
- `has_active_family_license(uid)` — checa licença ativa do owner da família do usuário

**Trigger BEFORE INSERT** em cada tabela de dados: se `family_id` NULL e `auth.uid()` pertence a família → preenche automaticamente. Garante pool único sem alterar código do frontend.

**RLS reescrita** para todas as tabelas de dados:
- SELECT: `user_id = auth.uid() OR (family_id = get_user_family(auth.uid()))`
- INSERT: user_id = auth.uid() AND (family_id NULL OR permission ≥ member)
- UPDATE/DELETE: dono do registro OU (family_id da família AND permission ≥ member; viewer bloqueado)

### 2. Edge function `family-management`

Ações: `create_family, list_family, invite_member, list_invites, revoke_invite, accept_invite (via token), list_members, update_member_role, remove_member, leave_family, transfer_ownership`.
Validações: só Owner pode remover/transferir; Admin pode convidar e alterar roles≤member; verifica `max_seats`; verifica `has_active_family_license`; bloqueia último Owner de sair sem transferir.

### 3. Licença família no painel admin

`admin-users` action `create_license`: aceitar `plan_type='family'` → seta `max_seats=5` e `price_brl` conforme informado. UI de licenças ganha filtro "Família" e exibe seats ocupados/total (join com families).

### 4. Frontend

- **Nova página `/familia`** com abas: Visão geral, Membros, Convites, Configurações. Componente `FamilySection.tsx`.
- **`use-family.ts`** hook: retorna `{ family, myRole, members, isOwner, isAdmin, canWrite, seatsUsed, seatsMax }`.
- **`use-license.ts`** atualizado: se usuário não tem licença própria mas é membro de família com licença ativa → `isValid=true`.
- **`AppSidebar`**: novo item "Família" (só aparece se plan_type='family' na licença própria/herdada).
- **Página `/convite/:token`**: aceitar convite (mostra família, papel, botão "Aceitar" que chama edge function).
- **Badges no header** quando em modo família: chip com nome da família + papel.
- **Guardas por papel**: Viewer não vê botões de criar/editar/excluir (usa `canWrite` do hook).
- **Formulários** (transactions, accounts, etc.) não mudam — trigger DB cuida do `family_id` automaticamente.

### 5. Auditoria

Todas as ações em `family-management` logam em `admin_audit_log` (nova `target_type='family'`).

---

### Detalhes técnicos importantes

- **Não migrar dados existentes**: `family_id` começa NULL, permanece NULL — respeitado pela RLS.
- **Ao sair da família**: dados que o usuário criou com `family_id` preenchido **permanecem na família** (ele não os leva). Decisão explícita para evitar "roubo" de histórico compartilhado.
- **Transferência de ownership**: obrigatória antes do Owner sair; se Owner for excluído sem transferir, edge function bloqueia.
- **Índices**: `CREATE INDEX ON <tabela>(family_id) WHERE family_id IS NOT NULL` em todas as tabelas afetadas — evita full scan quando RLS avaliar `family_id = X`.
- **Preços**: licença família fica como preço configurável pelo admin (não hardcoded).
- **Grants** em todas as novas tabelas: `authenticated` (INSERT/SELECT/UPDATE/DELETE conforme RLS) + `service_role ALL`.

---

### Ordem de execução

1. Migration (novas tabelas, coluna, enum, functions, triggers, RLS, grants, índices)
2. Edge function `family-management`
3. Extensão de `admin-users` para plano família
4. Hooks (`use-family`, atualização de `use-license`)
5. Página `/familia` + componente + rota de convite
6. Sidebar + guardas de UI por papel
7. Atualização de memória do projeto (remover "NO shared/joint accounts" e documentar o novo modo família)

### Fora do escopo (não muda nada existente)

- Formulários e páginas atuais permanecem idênticos
- Bot Telegram continua individual (fase 2 se pedir)
- Backup B2 continua por usuário
- Nenhuma refatoração de código existente além do estritamente necessário (RLS + hook `use-license`)

Aprovar para eu executar em sequência.