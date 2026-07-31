// Central admin API: users, roles, licenses, audit log.
// All actions require caller to have role='admin' in user_roles.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) return json(401, { error: "Unauthorized" });

  const callerId = userData.user.id;
  const callerEmail = userData.user.email ?? null;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  // Verify caller is admin
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "admin")
    .maybeSingle();
  if (action === "me") return json(200, { user_id: callerId, email: callerEmail, is_admin: !!roleRow });
  if (!roleRow) return json(403, { error: "Admin access required" });

  const audit = async (
    a: string,
    targetType?: string,
    targetId?: string,
    targetEmail?: string,
    metadata?: Record<string, unknown>,
  ) => {
    await admin.from("admin_audit_log").insert({
      actor_id: callerId,
      actor_email: callerEmail,
      action: a,
      target_type: targetType ?? null,
      target_id: targetId ?? null,
      target_email: targetEmail ?? null,
      metadata: metadata ?? {},
    });
  };

  try {
    switch (action) {
      case "list": {
        // Users with role + active license
        const { data: users, error: uErr } = await admin.auth.admin.listUsers({
          page: 1,
          perPage: 500,
        });
        if (uErr) throw uErr;

        const ids = users.users.map((u) => u.id);
        const [{ data: profiles }, { data: roles }, { data: licenses }] = await Promise.all([
          admin.from("profiles").select("user_id, display_name").in("user_id", ids),
          admin.from("user_roles").select("user_id, role").in("user_id", ids),
          admin
            .from("licenses")
            .select("id, license_key, user_id, status, expires_at, plan_type, price_brl")
            .in("user_id", ids),
        ]);

        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        const roleMap = new Map<string, string[]>();
        (roles || []).forEach((r: any) => {
          const arr = roleMap.get(r.user_id) || [];
          arr.push(r.role);
          roleMap.set(r.user_id, arr);
        });
        const licenseMap = new Map<string, any>();
        (licenses || []).forEach((l: any) => {
          const existing = licenseMap.get(l.user_id);
          if (
            !existing ||
            (l.status === "active" && existing.status !== "active") ||
            (l.status === existing.status &&
              new Date(l.expires_at) > new Date(existing.expires_at))
          ) {
            licenseMap.set(l.user_id, l);
          }
        });

        const rows = users.users.map((u) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          display_name: (profileMap.get(u.id) as any)?.display_name ?? null,
          roles: roleMap.get(u.id) ?? [],
          license: licenseMap.get(u.id) ?? null,
        }));

        // Unlinked licenses for the "link" dropdown
        const { data: unlinked } = await admin
          .from("licenses")
          .select("id, license_key, status, expires_at, plan_type")
          .is("user_id", null)
          .order("created_at", { ascending: false });

        return json(200, { users: rows, unlinked_licenses: unlinked || [] });
      }

      case "create": {
        const { email, password, displayName, role, license } = body;
        if (!email || !password) return json(400, { error: "email e senha são obrigatórios" });
        if (String(password).length < 8)
          return json(400, { error: "A senha deve ter ao menos 8 caracteres" });

        const { data: newUser, error: cErr } = await admin.auth.admin.createUser({
          email: String(email).trim().toLowerCase(),
          password,
          email_confirm: true,
          user_metadata: {
            display_name: displayName || String(email).split("@")[0],
            created_by_admin: true,
          },
        });
        if (cErr || !newUser?.user) {
          const msg = cErr?.message || "Falha ao criar usuário";
          return json(400, {
            error: msg.includes("SIGNUPS_DISABLED")
              ? "O gatilho de cadastro bloqueou a criação. Rode a migração mais recente no banco."
              : msg,
          });
        }

        const { error: rErr } = await admin
          .from("user_roles")
          .upsert(
            { user_id: newUser.user.id, role: role === "admin" ? "admin" : "user" },
            { onConflict: "user_id,role" },
          );
        if (rErr) console.error("role insert error:", rErr.message);

        let createdLicense = null;
        if (license?.months) {
          const months = Math.max(1, Math.min(120, Number(license.months)));
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + months);
          const { data: keyData } = await admin.rpc("generate_license_key");
          const planType = license.plan_type || "monthly";
          const { data: lic, error: lErr } = await admin
            .from("licenses")
            .upsert(
              {
                user_id: newUser.user.id,
                license_key: keyData,
                status: "active",
                expires_at: expiresAt.toISOString(),
                plan_type: planType,
                price_brl: license.price_brl || 0,
                notes: license.notes || null,
                max_seats: planType === "family" ? 5 : 1,
              },
              { onConflict: "user_id" },
            )
            .select()
            .maybeSingle();
          if (lErr) {
            await audit("user.create", "user", newUser.user.id, email, { role, license_error: lErr.message });
            return json(400, { error: `Usuário criado, mas a licença falhou: ${lErr.message}` });
          }
          createdLicense = lic;
        }

        await audit("user.create", "user", newUser.user.id, email, {
          role,
          license: createdLicense,
        });
        return json(200, { user: newUser.user, license: createdLicense });
      }

      case "update_password": {
        const { user_id, password } = body;
        if (!user_id) return json(400, { error: "Selecione um usuário" });
        if (!password || String(password).length < 8)
          return json(400, { error: "A senha deve ter ao menos 8 caracteres" });
        const { data: upd, error } = await admin.auth.admin.updateUserById(user_id, {
          password: String(password),
        });
        if (error) {
          console.error("update_password error:", error);
          const m = error.message || "";
          if (m.toLowerCase().includes("pwned") || m.toLowerCase().includes("compromised"))
            return json(400, { error: "Senha vazada em bases públicas. Escolha outra senha." });
          if (m.toLowerCase().includes("same password"))
            return json(400, { error: "A nova senha é igual à atual." });
          return json(400, { error: m || "Falha ao alterar a senha" });
        }
        if (!upd?.user) return json(400, { error: "Usuário não encontrado" });
        await audit("user.password_reset", "user", user_id, upd.user.email ?? undefined);
        return json(200, { ok: true });
      }


      case "update_role": {
        const { user_id, role } = body;
        if (!user_id || !["admin", "user"].includes(role))
          return json(400, { error: "user_id and role required" });

        if (role === "user") {
          // anti-lockout: block removing last admin
          const { count } = await admin
            .from("user_roles")
            .select("*", { count: "exact", head: true })
            .eq("role", "admin");
          if ((count ?? 0) <= 1)
            return json(400, { error: "Não é possível remover o último administrador" });
          await admin.from("user_roles").delete().eq("user_id", user_id).eq("role", "admin");
        } else {
          await admin
            .from("user_roles")
            .upsert({ user_id, role: "admin" }, { onConflict: "user_id,role" });
        }
        await audit("user.role_change", "user", user_id, undefined, { new_role: role });
        return json(200, { ok: true });
      }

      case "delete": {
        const { user_id } = body;
        if (!user_id) return json(400, { error: "user_id required" });
        if (user_id === callerId)
          return json(400, { error: "Você não pode excluir a si mesmo" });

        const { count } = await admin
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user_id)
          .eq("role", "admin");
        if ((count ?? 0) > 0) {
          const { count: adminCount } = await admin
            .from("user_roles")
            .select("*", { count: "exact", head: true })
            .eq("role", "admin");
          if ((adminCount ?? 0) <= 1)
            return json(400, { error: "Não é possível excluir o último administrador" });
        }

        const { data: target } = await admin.auth.admin.getUserById(user_id);
        const { error } = await admin.auth.admin.deleteUser(user_id);
        if (error) return json(400, { error: error.message });
        await audit("user.delete", "user", user_id, target?.user?.email ?? undefined);
        return json(200, { ok: true });
      }

      case "link_license": {
        const { license_id, user_id } = body;
        if (!license_id || !user_id) return json(400, { error: "license_id and user_id required" });
        const { error } = await admin
          .from("licenses")
          .update({ user_id })
          .eq("id", license_id);
        if (error) return json(400, { error: error.message });
        await audit("license.link", "license", license_id, undefined, { user_id });
        return json(200, { ok: true });
      }

      case "unlink_license": {
        const { license_id } = body;
        if (!license_id) return json(400, { error: "license_id required" });
        await admin.from("licenses").update({ user_id: null }).eq("id", license_id);
        await audit("license.unlink", "license", license_id);
        return json(200, { ok: true });
      }

      case "create_license": {
        const { months, plan_type, price_brl, notes, user_id, max_seats } = body;
        const m = Math.max(1, Math.min(120, Number(months) || 1));
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + m);
        const { data: keyData } = await admin.rpc("generate_license_key");
        const pt = plan_type || "monthly";
        const seats = pt === "family" ? Math.max(2, Math.min(5, Number(max_seats) || 5)) : 1;
        const { data: lic, error } = await admin
          .from("licenses")
          .insert({
            license_key: keyData,
            status: "active",
            expires_at: expiresAt.toISOString(),
            plan_type: pt,
            price_brl: price_brl || 0,
            notes: notes || null,
            user_id: user_id || null,
            max_seats: seats,
          })
          .select()
          .single();
        if (error) return json(400, { error: error.message });
        await audit("license.create", "license", lic.id, undefined, {
          months: m,
          plan_type: pt,
          max_seats: seats,
        });
        return json(200, { license: lic });
      }

      case "update_license": {
        const { license_id, patch } = body;
        if (!license_id || !patch) return json(400, { error: "license_id and patch required" });
        const allowed: Record<string, unknown> = {};
        for (const k of ["status", "expires_at", "plan_type", "price_brl", "notes"]) {
          if (k in patch) allowed[k] = patch[k];
        }
        const { error } = await admin.from("licenses").update(allowed).eq("id", license_id);
        if (error) return json(400, { error: error.message });
        await audit("license.update", "license", license_id, undefined, { patch: allowed });
        return json(200, { ok: true });
      }

      case "extend_license": {
        const { license_id, months } = body;
        const m = Math.max(1, Math.min(120, Number(months) || 1));
        const { data: cur } = await admin
          .from("licenses")
          .select("expires_at")
          .eq("id", license_id)
          .maybeSingle();
        if (!cur) return json(404, { error: "license not found" });
        const base = new Date(cur.expires_at);
        const now = new Date();
        const start = base > now ? base : now;
        start.setMonth(start.getMonth() + m);
        await admin
          .from("licenses")
          .update({ expires_at: start.toISOString(), status: "active" })
          .eq("id", license_id);
        await audit("license.extend", "license", license_id, undefined, { months: m });
        return json(200, { ok: true, new_expires_at: start.toISOString() });
      }

      case "delete_license": {
        const { license_id } = body;
        if (!license_id) return json(400, { error: "license_id required" });
        await admin.from("licenses").delete().eq("id", license_id);
        await audit("license.delete", "license", license_id);
        return json(200, { ok: true });
      }

      case "list_licenses": {
        const { data: licenses, error } = await admin
          .from("licenses")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) return json(400, { error: error.message });
        return json(200, { licenses: licenses || [] });
      }

      case "audit_log": {
        const { data, error } = await admin
          .from("admin_audit_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) return json(400, { error: error.message });
        return json(200, { entries: data || [] });
      }

      default:
        return json(400, { error: `Unknown action: ${action}` });
    }
  } catch (e) {
    console.error("admin-users error:", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
