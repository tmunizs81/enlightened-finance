---
name: Family Mode
description: Family plan sharing up to 5 logins in a single data pool, 4 roles, license inheritance
type: feature
---
Modo Família permite até 5 logins compartilharem o mesmo pool de dados financeiros sob 1 licença família (plan_type='family', max_seats=5).

**Arquitetura**
- Tabelas: `families`, `family_members`, `family_invites` (token único, 7 dias)
- Coluna `family_id UUID NULL` em accounts, transactions, budgets, goals, categories, tags, recurring_transactions, financial_rules, ai_insights, pending_ocr_transactions, achievements, streaks, weekly_challenges
- Trigger `auto_fill_family_id` (BEFORE INSERT) preenche family_id automaticamente quando o usuário pertence a família
- RLS: dono OU membro da família (via `can_read_family` / `can_write_family`)
- Funções: `get_user_family`, `get_family_role`, `family_role_level`, `can_read_family`, `can_write_family`, `has_active_family_license`

**Papéis (hierarquia)**
- viewer (1) — só lê
- member (2) — cria/edita/exclui dados
- admin (3) — mesmo que member + gerencia convites e papéis member/viewer
- owner (4) — controle total: gerencia admins, transfere titularidade, exclui família

**Regras**
- Dados criados ANTES de entrar na família permanecem privados (family_id NULL)
- Dados criados APÓS entrar ficam no pool (family_id preenchido pelo trigger)
- Ao sair, dados criados no pool permanecem na família
- Owner deve transferir titularidade antes de sair
- Licença família herda para membros via `useLicense` (checa owner_id da família)

**Frontend**
- Página `/familia` com criar, convidar, membros, invites, transferir, excluir
- Página `/familia/convite/:token` para aceitar convite
- Hook `useFamily()` centraliza estado e chamadas à edge function
- Sidebar tem item "Família"

**Edge function** `family-management` — actions: get_my_family, create_family, update_family, invite_member, revoke_invite, get_invite_by_token, accept_invite, update_member_role, remove_member, leave_family, transfer_ownership, delete_family
