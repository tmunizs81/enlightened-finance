
# SimplyFin Comercial — Integração Asaas

## Escopo confirmado
- **Gateway:** Asaas (Pix, Boleto, Cartão)
- **Planos:** Individual R$ 24,90/mês • Família (até 5) R$ 49,90/mês
- **Recorrência:** Assinatura automática (cartão renova sozinho; Pix/boleto o Asaas reemite)
- **Trial:** 7 dias grátis, SEM cartão obrigatório
- **Bloqueio:** 3 dias de tolerância após vencimento, com banner de aviso
- **Modo Família:** licença de família continua funcionando (herança via `useLicense` já implementada)

---

## 1. Mudanças no banco (1 migration)

**`profiles`:** adicionar `trial_ends_at TIMESTAMPTZ` — preenchido automaticamente no signup com `now() + 7 days` via trigger na `handle_new_user`.

**`licenses`:** adicionar
- `asaas_subscription_id TEXT` — id da assinatura no Asaas
- `asaas_customer_id TEXT` — id do cliente no Asaas
- `next_charge_at TIMESTAMPTZ` — próxima cobrança prevista
- `last_payment_status TEXT` — `pending | confirmed | overdue | refunded`
- `grace_until TIMESTAMPTZ` — vencimento + 3 dias (calculado no webhook)

**Nova tabela `payment_events`** (auditoria imutável de tudo que o Asaas manda):
- `provider TEXT DEFAULT 'asaas'`, `event_type`, `payment_id`, `subscription_id`, `customer_id`, `payload JSONB`, `processed_at`

RLS: só admins leem `payment_events`; usuário lê a própria licença (já existe).

---

## 2. Página pública `/planos`

Rota nova (protegida por login), 2 cards lado a lado com CTA "Assinar":
- Individual — R$ 24,90/mês
- Família (até 5) — R$ 49,90/mês

Se o usuário está em trial, mostra "Faltam X dias de trial". Se já tem licença ativa, mostra "Plano atual" com botão "Gerenciar" (link pro portal Asaas).

Ao clicar "Assinar" → chama edge function `asaas-checkout` → recebe URL de pagamento do Asaas → redireciona.

---

## 3. Edge Functions (3 novas)

### `asaas-checkout` (com JWT)
Recebe `{ plan: "individual" | "family", billing_type: "PIX" | "BOLETO" | "CREDIT_CARD" }`:
1. Cria/reutiliza customer no Asaas (via email do usuário)
2. Cria subscription mensal (`cycle: MONTHLY`, valor conforme plano)
3. Salva `asaas_customer_id` + `asaas_subscription_id` no `licenses` com `status='pending'`
4. Retorna `invoiceUrl` (pra Pix/boleto) ou `paymentLink` (pra cartão tokenizado no Asaas Checkout)

### `asaas-webhook` (sem JWT — Asaas chama direto)
Valida token de assinatura (header `asaas-access-token` comparado com secret `ASAAS_WEBHOOK_TOKEN`).
Registra em `payment_events` e trata os eventos:
- `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` → licença `active`, `expires_at = now + 30d`, `grace_until = expires_at + 3d`
- `PAYMENT_OVERDUE` → mantém `active` até `grace_until`, marca `last_payment_status='overdue'`
- `SUBSCRIPTION_DELETED` / `PAYMENT_REFUNDED` → `blocked`
- `PAYMENT_CREATED` (nova cobrança gerada) → atualiza `next_charge_at`

### `licenses-enforce-grace` (cron diário 03:00)
Varre licenças com `grace_until < now()` e `status != 'blocked'` → marca `blocked`. Rede de segurança caso o webhook falhe.

---

## 4. Frontend — ajustes

### `use-license.ts`
Adicionar campo `inGrace: boolean` e `daysUntilBlock: number`. Considerar licença "válida" enquanto `grace_until > now()`, mesmo com `expires_at` passado.

### Banner de tolerância
Componente `<GraceBanner />` no `AppLayout`: aparece amarelo se `inGrace`, com CTA "Renovar agora" → `/planos`.

### Trial no signup
Novo usuário: banner azul discreto "Você tem 7 dias de trial. Assinar plano". Após trial, se sem assinatura, bloqueia (mesmo fluxo de `grace_until`).

### Admin
Na `AdminManagementSection`, adicionar coluna "Assinatura Asaas" mostrando `asaas_subscription_id` + `last_payment_status`, e botão "Ver eventos" abrindo modal com últimos `payment_events` daquele usuário.

---

## 5. Setup Asaas (você faz)

Depois que aprovar o plano, você:
1. Cria conta em https://www.asaas.com (grátis)
2. Configurações → Integrações → **API Key** (começa com `$aact_...`)
3. Configurações → Notificações → **Webhooks** → adiciona URL do `asaas-webhook` (te passo depois do deploy) e escolhe um **token** de sua invenção
4. Me passa **API Key** e **token do webhook** — eu salvo como secret (`ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`)

Enquanto isso, deixo tudo pronto usando sandbox (`sandbox.asaas.com`) — troca só o env `ASAAS_ENV=production` depois.

---

## 6. Ordem de execução

```text
1. Migration (schema + trial trigger)
2. Edge functions (checkout + webhook + cron)
3. Página /planos + banner grace + trial
4. Ajustes use-license (grace period)
5. Admin: coluna assinatura + eventos
6. Deploy → você configura webhook no Asaas
7. Teste E2E em sandbox
8. Vira produção
```

Nada quebra o que já existe: licenças manuais (admin) continuam funcionando; modo família idem. O webhook só toca licenças que têm `asaas_subscription_id`.

Aprova esse plano e eu já começo pela migration + edge functions?
