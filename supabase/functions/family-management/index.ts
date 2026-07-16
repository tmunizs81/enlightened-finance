// Family management API — create family, invite/accept, manage members, roles, ownership.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const roleLevel = (r: string) =>
  ({ viewer: 1, member: 2, admin: 3, owner: 4 })[r as string] ?? 0;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: u, error: uErr } = await userClient.auth.getUser(token);
  if (uErr || !u?.user) return json(401, { error: "Unauthorized" });
  const uid = u.user.id;
  const email = (u.user.email ?? "").toLowerCase();

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  // Helper: my family membership
  const myMembership = async () => {
    const { data } = await admin
      .from("family_members")
      .select("id, family_id, role")
      .eq("user_id", uid)
      .maybeSingle();
    return data;
  };

  // Helper: audit log entry
  const audit = async (a: string, targetId?: string, metadata?: Record<string, unknown>) => {
    await admin.from("admin_audit_log").insert({
      actor_id: uid,
      actor_email: email,
      action: `family.${a}`,
      target_type: "family",
      target_id: targetId ?? null,
      metadata: metadata ?? {},
    });
  };

  try {
    switch (action) {
      case "get_my_family": {
        const m = await myMembership();
        if (!m) return json(200, { family: null, my_role: null, members: [], invites: [] });
        const [{ data: family }, { data: members }, { data: invites }] = await Promise.all([
          admin.from("families").select("*").eq("id", m.family_id).maybeSingle(),
          admin.from("family_members").select("*").eq("family_id", m.family_id),
          admin
            .from("family_invites")
            .select("*")
            .eq("family_id", m.family_id)
            .is("accepted_at", null),
        ]);

        // enrich members with email/display_name via admin API
        const ids = (members || []).map((x: any) => x.user_id);
        const enriched: any[] = [];
        for (const mem of members || []) {
          const { data: userInfo } = await admin.auth.admin.getUserById(mem.user_id);
          const { data: profile } = await admin
            .from("profiles")
            .select("display_name")
            .eq("user_id", mem.user_id)
            .maybeSingle();
          enriched.push({
            ...mem,
            email: userInfo?.user?.email ?? null,
            display_name: profile?.display_name ?? null,
          });
        }

        return json(200, {
          family,
          my_role: m.role,
          members: enriched,
          invites: invites || [],
          seats_used: (members || []).length,
          seats_max: family?.max_seats ?? 5,
          _ids: ids,
        });
      }

      case "create_family": {
        const { name } = body;
        if (!name || String(name).trim().length < 2)
          return json(400, { error: "Nome da família obrigatório (mín. 2 caracteres)" });

        // must have a family license and not be in a family yet
        const existing = await myMembership();
        if (existing) return json(400, { error: "Você já pertence a uma família" });

        const { data: license } = await admin
          .from("licenses")
          .select("id, status, expires_at, plan_type, max_seats")
          .eq("user_id", uid)
          .eq("plan_type", "family")
          .eq("status", "active")
          .gt("expires_at", new Date().toISOString())
          .order("expires_at", { ascending: false })
          .maybeSingle();

        if (!license)
          return json(403, {
            error: "É necessária uma licença família ativa para criar uma família",
          });

        const { data: fam, error: fErr } = await admin
          .from("families")
          .insert({
            name: String(name).trim(),
            owner_id: uid,
            license_id: license.id,
            max_seats: license.max_seats || 5,
          })
          .select()
          .single();
        if (fErr) return json(400, { error: fErr.message });

        await admin
          .from("family_members")
          .insert({ family_id: fam.id, user_id: uid, role: "owner" });

        await audit("create", fam.id, { name });
        return json(200, { family: fam });
      }

      case "update_family": {
        const m = await myMembership();
        if (!m || m.role !== "owner") return json(403, { error: "Apenas o dono pode editar" });
        const { name } = body;
        const { error } = await admin
          .from("families")
          .update({ name: String(name).trim() })
          .eq("id", m.family_id);
        if (error) return json(400, { error: error.message });
        await audit("update", m.family_id, { name });
        return json(200, { ok: true });
      }

      case "invite_member": {
        const m = await myMembership();
        if (!m || roleLevel(m.role) < 3)
          return json(403, { error: "Apenas admin/owner podem convidar" });
        const { email: inviteEmail, role } = body;
        if (!inviteEmail) return json(400, { error: "E-mail obrigatório" });
        const inviteRole = ["viewer", "member", "admin"].includes(role) ? role : "member";
        if (inviteRole === "admin" && m.role !== "owner")
          return json(403, { error: "Apenas o dono pode convidar admins" });

        // check seat availability (members + pending invites, ignoring expired ones)
        const nowIso = new Date().toISOString();
        const normalizedEmail = String(inviteEmail).toLowerCase().trim();
        const [
          { count: memberCount },
          { data: fam },
          { count: pendingCount },
          { data: dupInvite },
        ] = await Promise.all([
          admin
            .from("family_members")
            .select("*", { count: "exact", head: true })
            .eq("family_id", m.family_id),
          admin.from("families").select("max_seats").eq("id", m.family_id).maybeSingle(),
          admin
            .from("family_invites")
            .select("*", { count: "exact", head: true })
            .eq("family_id", m.family_id)
            .is("accepted_at", null)
            .gt("expires_at", nowIso),
          admin
            .from("family_invites")
            .select("id")
            .eq("family_id", m.family_id)
            .eq("email", normalizedEmail)
            .is("accepted_at", null)
            .gt("expires_at", nowIso)
            .maybeSingle(),
        ]);

        const maxSeats = fam?.max_seats ?? 5;
        const used = (memberCount ?? 0) + (pendingCount ?? 0);
        if (used >= maxSeats)
          return json(400, {
            error: `Limite de ${maxSeats} assentos atingido (${memberCount ?? 0} membro(s) + ${pendingCount ?? 0} convite(s) pendente(s)). Revogue um convite ou remova um membro antes de convidar novamente.`,
            code: "SEATS_FULL",
            seats_used: used,
            seats_max: maxSeats,
            members: memberCount ?? 0,
            pending_invites: pendingCount ?? 0,
          });
        if (dupInvite)
          return json(400, {
            error: `Já existe um convite pendente para ${normalizedEmail}.`,
            code: "DUPLICATE_INVITE",
          });

        const { data: inv, error } = await admin
          .from("family_invites")
          .insert({
            family_id: m.family_id,
            email: normalizedEmail,
            role: inviteRole,
            invited_by: uid,
          })
          .select()
          .single();
        if (error) return json(400, { error: error.message });
        await audit("invite", inv.id, {
          email: normalizedEmail,
          role: inviteRole,
          seats_used_after: used + 1,
          seats_max: maxSeats,
        });
        return json(200, {
          invite: inv,
          seats_used: used + 1,
          seats_max: maxSeats,
        });
      }

      case "revoke_invite": {
        const m = await myMembership();
        if (!m || roleLevel(m.role) < 3) return json(403, { error: "Sem permissão" });
        const { invite_id } = body;
        await admin
          .from("family_invites")
          .delete()
          .eq("id", invite_id)
          .eq("family_id", m.family_id);
        await audit("revoke_invite", invite_id);
        return json(200, { ok: true });
      }

      case "get_invite_by_token": {
        const { token: invToken } = body;
        if (!invToken) return json(400, { error: "Token obrigatório" });
        const { data: inv } = await admin
          .from("family_invites")
          .select("*, families(name, owner_id)")
          .eq("token", invToken)
          .maybeSingle();
        if (!inv) return json(404, { error: "Convite não encontrado" });
        if (inv.accepted_at) return json(400, { error: "Convite já utilizado" });
        if (new Date(inv.expires_at) < new Date())
          return json(400, { error: "Convite expirado" });
        return json(200, { invite: inv });
      }

      case "accept_invite": {
        const { token: invToken } = body;
        const { data: inv } = await admin
          .from("family_invites")
          .select("*")
          .eq("token", invToken)
          .maybeSingle();
        if (!inv) return json(404, { error: "Convite não encontrado" });
        if (inv.accepted_at) return json(400, { error: "Convite já utilizado" });
        if (new Date(inv.expires_at) < new Date())
          return json(400, { error: "Convite expirado" });
        if (inv.email.toLowerCase() !== email)
          return json(403, { error: "Este convite é para outro e-mail" });

        const existing = await myMembership();
        if (existing) return json(400, { error: "Você já pertence a uma família" });

        // seat check
        const { count } = await admin
          .from("family_members")
          .select("*", { count: "exact", head: true })
          .eq("family_id", inv.family_id);
        const { data: fam } = await admin
          .from("families")
          .select("max_seats")
          .eq("id", inv.family_id)
          .maybeSingle();
        if ((count ?? 0) >= (fam?.max_seats ?? 5))
          return json(400, { error: "Família cheia" });

        await admin
          .from("family_members")
          .insert({ family_id: inv.family_id, user_id: uid, role: inv.role });
        await admin
          .from("family_invites")
          .update({ accepted_at: new Date().toISOString() })
          .eq("id", inv.id);
        await audit("accept_invite", inv.id, { family_id: inv.family_id });
        return json(200, { ok: true, family_id: inv.family_id });
      }

      case "update_member_role": {
        const m = await myMembership();
        if (!m) return json(403, { error: "Sem permissão" });
        const { member_id, role } = body;
        if (!["viewer", "member", "admin", "owner"].includes(role))
          return json(400, { error: "Papel inválido" });
        if (role === "owner") return json(400, { error: "Use transfer_ownership" });
        const { data: target } = await admin
          .from("family_members")
          .select("*")
          .eq("id", member_id)
          .eq("family_id", m.family_id)
          .maybeSingle();
        if (!target) return json(404, { error: "Membro não encontrado" });
        if (target.role === "owner") return json(400, { error: "Não pode alterar o dono" });
        // admin can change viewer<->member only; owner can change anything except owner
        if (m.role !== "owner" && (roleLevel(role) >= 3 || roleLevel(target.role) >= 3))
          return json(403, { error: "Apenas o dono pode gerenciar admins" });
        await admin.from("family_members").update({ role }).eq("id", member_id);
        await audit("update_role", member_id, { role });
        return json(200, { ok: true });
      }

      case "remove_member": {
        const m = await myMembership();
        if (!m || roleLevel(m.role) < 3)
          return json(403, { error: "Apenas admin/owner podem remover" });
        const { member_id } = body;
        const { data: target } = await admin
          .from("family_members")
          .select("*")
          .eq("id", member_id)
          .eq("family_id", m.family_id)
          .maybeSingle();
        if (!target) return json(404, { error: "Membro não encontrado" });
        if (target.role === "owner") return json(400, { error: "Não pode remover o dono" });
        if (target.user_id === uid) return json(400, { error: "Use leave_family" });
        if (target.role === "admin" && m.role !== "owner")
          return json(403, { error: "Apenas o dono pode remover admins" });
        await admin.from("family_members").delete().eq("id", member_id);
        await audit("remove_member", member_id, { user_id: target.user_id });
        return json(200, { ok: true });
      }

      case "leave_family": {
        const m = await myMembership();
        if (!m) return json(400, { error: "Você não está em uma família" });
        if (m.role === "owner")
          return json(400, {
            error: "Owner deve transferir a titularidade antes de sair",
          });
        await admin.from("family_members").delete().eq("id", m.id);
        await audit("leave", m.family_id);
        return json(200, { ok: true });
      }

      case "transfer_ownership": {
        const m = await myMembership();
        if (!m || m.role !== "owner")
          return json(403, { error: "Apenas o dono pode transferir" });
        const { new_owner_user_id } = body;
        const { data: target } = await admin
          .from("family_members")
          .select("*")
          .eq("user_id", new_owner_user_id)
          .eq("family_id", m.family_id)
          .maybeSingle();
        if (!target) return json(404, { error: "Novo dono não é membro da família" });
        // swap roles
        await admin
          .from("family_members")
          .update({ role: "owner" })
          .eq("id", target.id);
        await admin.from("family_members").update({ role: "admin" }).eq("id", m.id);
        await admin
          .from("families")
          .update({ owner_id: new_owner_user_id })
          .eq("id", m.family_id);
        await audit("transfer_ownership", m.family_id, { new_owner: new_owner_user_id });
        return json(200, { ok: true });
      }

      case "delete_family": {
        const m = await myMembership();
        if (!m || m.role !== "owner")
          return json(403, { error: "Apenas o dono pode excluir a família" });
        await admin.from("families").delete().eq("id", m.family_id);
        await audit("delete", m.family_id);
        return json(200, { ok: true });
      }

      default:
        return json(400, { error: `Ação desconhecida: ${action}` });
    }
  } catch (e) {
    console.error("family-management error:", e);
    return json(500, { error: e instanceof Error ? e.message : "Erro desconhecido" });
  }
});
