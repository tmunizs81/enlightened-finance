import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BACKUP_TABLES = [
  "accounts",
  "categories",
  "transactions",
  "goals",
  "budgets",
  "recurring_transactions",
  "ai_insights",
] as const;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Use service role to read all user data and write to storage
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { action } = await req.json().catch(() => ({ action: "create" }));

    // === LIST BACKUPS ===
    if (action === "list") {
      const { data: files, error } = await supabase.storage
        .from("backups")
        .list(userId, { sortBy: { column: "created_at", order: "desc" }, limit: 30 });

      if (error) throw error;

      return new Response(
        JSON.stringify({ backups: (files || []).map((f: any) => ({ name: f.name, created_at: f.created_at, size: f.metadata?.size })) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === RESTORE BACKUP ===
    if (action === "restore") {
      const { filename } = await req.json().catch(() => ({ filename: null }));
      if (!filename) {
        return new Response(JSON.stringify({ error: "filename is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: fileData, error: dlErr } = await supabase.storage
        .from("backups")
        .download(`${userId}/${filename}`);

      if (dlErr || !fileData) {
        return new Response(JSON.stringify({ error: "Backup não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const backup = JSON.parse(await fileData.text());
      if (!backup.version || !backup.tables) {
        return new Response(JSON.stringify({ error: "Arquivo de backup inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tables = backup.tables as Record<string, any[]>;

      // Delete in reverse dependency order
      const deleteOrder = [...BACKUP_TABLES].reverse();
      for (const table of deleteOrder) {
        await supabase.from(table).delete().eq("user_id", userId);
      }

      // Insert in dependency order
      const insertOrder = ["accounts", "categories", "goals", "budgets", "transactions", "recurring_transactions", "ai_insights"];
      let totalRows = 0;

      for (const table of insertOrder) {
        const rows = tables[table];
        if (!rows || rows.length === 0) continue;

        const withUser = rows.map((row: any) => ({ ...row, user_id: userId }));
        const batchSize = 100;
        for (let i = 0; i < withUser.length; i += batchSize) {
          const batch = withUser.slice(i, i + batchSize);
          const { error } = await supabase.from(table).insert(batch);
          if (error) console.error(`Restore error on ${table}:`, error.message);
        }
        totalRows += rows.length;
      }

      return new Response(
        JSON.stringify({ success: true, totalRows }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === CREATE BACKUP (default) ===
    const backup: Record<string, any[]> = {};
    let totalRows = 0;

    for (const table of BACKUP_TABLES) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("user_id", userId);

      if (error) {
        console.error(`Error reading ${table}:`, error.message);
        continue;
      }

      backup[table] = (data || []).map(({ user_id, ...rest }: any) => rest);
      totalRows += backup[table].length;
    }

    const now = new Date();
    const filename = `backup-${now.toISOString().split("T")[0]}-${now.getHours().toString().padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}.json`;
    const filePath = `${userId}/${filename}`;

    const content = JSON.stringify({
      version: 1,
      exported_at: now.toISOString(),
      tables: backup,
    });

    const { error: uploadErr } = await supabase.storage
      .from("backups")
      .upload(filePath, new TextEncoder().encode(content), {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    // Keep only last 7 backups (cleanup old ones)
    const { data: allFiles } = await supabase.storage
      .from("backups")
      .list(userId, { sortBy: { column: "created_at", order: "desc" } });

    if (allFiles && allFiles.length > 7) {
      const toDelete = allFiles.slice(7).map((f: any) => `${userId}/${f.name}`);
      await supabase.storage.from("backups").remove(toDelete);
    }

    return new Response(
      JSON.stringify({ success: true, filename, totalRows, tables: Object.keys(backup).length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("auto-backup error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
