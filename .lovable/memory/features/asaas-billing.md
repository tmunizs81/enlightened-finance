---
name: Asaas Billing
description: Assinatura recorrente via Asaas (Pix/Boleto/Cartão), trial 7d, tolerância 3d
type: feature
---
Sistema comercial SaaS com Asaas como gateway.

**Planos** (hardcoded em `asaas-checkout/index.ts` e `Plans.tsx`):
- Individual R$ 24,90/mês → `plan_type=monthly`, `max_seats=1`
- Família R$ 49,90/mês → `plan_type=family`, `max_seats=5`

**Fluxo**
1. Signup: trigger `handle_new_user` seta `profiles.trial_ends_at = now + 7 days`
2. `useLicense` detecta trial ativo → `source='trial'`, `inTrial=true`
3. Usuário vai em `/planos` → escolhe plano + Pix/Boleto/Cartão + CPF/CNPJ
4. `asaas-checkout` cria customer + subscription MONTHLY (nextDueDate=amanhã), salva `asaas_customer_id`/`asaas_subscription_id` na licenses (status=blocked, pending)
5. Retorna `invoiceUrl` → redireciona para pagamento no Asaas
6. Pagamento confirmado → webhook `asaas-webhook` seta status=active, expires_at=+30d, grace_until=+33d
7. Renovação: Asaas gera nova cobrança automaticamente todo mês; webhook estende expires_at
8. Atraso: `PAYMENT_OVERDUE` marca `last_payment_status=overdue`, status permanece active até `grace_until`
9. Após grace_until: cron `licenses-enforce-grace` (03:00 diário) bloqueia
10. `LicenseBanner` no AppLayout mostra trial/grace/expirado

**Secrets necessários**
- `ASAAS_API_KEY` — API key Asaas (`$aact_...`)
- `ASAAS_WEBHOOK_TOKEN` — token combinado com Asaas p/ validar webhooks
- `ASAAS_ENV` — `sandbox` (default) ou `production`

**Setup do webhook**
Cadastrar em asaas.com → Configurações → Notificações → Webhooks:
- URL: `https://<project>.functions.supabase.co/asaas-webhook`
- Token: mesmo valor de `ASAAS_WEBHOOK_TOKEN`
- Eventos: todos de payment e subscription

**Cron**
`licenses-enforce-grace` deve ser agendado diariamente via pg_cron (não incluído — chamar via `select cron.schedule(...)`).

**Compatibilidade**
- Licenças manuais criadas pelo admin (sem asaas_subscription_id) continuam funcionando; webhook e cron só tocam quem tem asaas_subscription_id ou grace_until definidos.
- Licença família herdada (`useLicense` source='family') não é afetada.
