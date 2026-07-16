// Offsite backup to Backblaze B2 (S3-compatible)
// - Full dump of all public tables (all users) as gzipped JSON
// - Uploaded via AWS SigV4 to B2 bucket
// - Retention: last 30 daily backups (older objects deleted)
// - Failure alert: sends Telegram message using any admin's telegram_bot_token
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("gzip");
  const stream = new Blob([bytes]).stream().pipeThrough(cs);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLES = [
  "accounts",
  "achievements",
  "ai_insights",
  "budgets",
  "categories",
  "financial_rules",
  "goals",
  "licenses",
  "pending_ocr_transactions",
  "profiles",
  "recurring_transactions",
  "streaks",
  "tags",
  "transaction_splits",
  "transaction_tags",
  "transactions",
  "user_roles",
  "weekly_challenges",
];

const RETENTION_DAYS = 30;

async function notifyFailure(supabase: any, errorMsg: string) {
  try {
    const chatId = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID");
    if (!chatId) return;

    // Reuse any admin's bot token from profiles
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(5);

    if (!admins?.length) return;

    const adminIds = admins.map((a: any) => a.user_id);
    const { data: profile } = await supabase
      .from("profiles")
      .select("telegram_bot_token")
      .in("user_id", adminIds)
      .not("telegram_bot_token", "is", null)
      .limit(1)
      .maybeSingle();

    const token = profile?.telegram_bot_token;
    if (!token) return;

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🚨 <b>Offsite Backup FALHOU</b>\n\n<code>${errorMsg.slice(0, 500)}</code>\n\nVerifique os logs da Edge Function <code>offsite-backup</code>.`,
        parse_mode: "HTML",
      }),
    });
  } catch (e) {
    console.error("notifyFailure error:", e);
  }
}

async function listB2Objects(aws: AwsClient, endpoint: string, bucket: string, prefix: string) {
  const url = `https://${endpoint}/${bucket}?list-type=2&prefix=${encodeURIComponent(prefix)}`;
  const res = await aws.fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`B2 list failed [${res.status}]: ${await res.text()}`);
  const xml = await res.text();
  const keys: { key: string; lastModified: string }[] = [];
  const regex = /<Contents>[\s\S]*?<Key>([^<]+)<\/Key>[\s\S]*?<LastModified>([^<]+)<\/LastModified>/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    keys.push({ key: m[1], lastModified: m[2] });
  }
  return keys;
}

async function deleteB2Object(aws: AwsClient, endpoint: string, bucket: string, key: string) {
  const url = `https://${endpoint}/${bucket}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
  const res = await aws.fetch(url, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    console.error(`B2 delete ${key} failed [${res.status}]: ${await res.text()}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const B2_KEY_ID = Deno.env.get("B2_KEY_ID");
    const B2_APPLICATION_KEY = Deno.env.get("B2_APPLICATION_KEY");
    const B2_BUCKET = Deno.env.get("B2_BUCKET");
    const B2_ENDPOINT = Deno.env.get("B2_ENDPOINT");
    const B2_REGION = Deno.env.get("B2_REGION");

    if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET || !B2_ENDPOINT || !B2_REGION) {
      throw new Error("Missing B2_* secrets");
    }

    // 1. Dump all tables
    const dump: Record<string, any[]> = {};
    let totalRows = 0;
    const errors: string[] = [];

    for (const table of TABLES) {
      const { data, error } = await supabase.from(table).select("*");
      if (error) {
        errors.push(`${table}: ${error.message}`);
        dump[table] = [];
        continue;
      }
      dump[table] = data || [];
      totalRows += dump[table].length;
    }

    const now = new Date();
    const stamp = `${now.toISOString().slice(0, 10)}-${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}`;

    const payload = {
      version: 1,
      exported_at: now.toISOString(),
      total_rows: totalRows,
      table_count: TABLES.length,
      partial_errors: errors,
      tables: dump,
    };

    // 2. Serialize + gzip
    const jsonBytes = new TextEncoder().encode(JSON.stringify(payload));
    const gzipped = await gzip(jsonBytes);

    const filename = `daily/full-${stamp}.json.gz`;

    // 3. Upload to B2 via S3 SigV4
    const aws = new AwsClient({
      accessKeyId: B2_KEY_ID,
      secretAccessKey: B2_APPLICATION_KEY,
      service: "s3",
      region: B2_REGION,
    });

    const uploadUrl = `https://${B2_ENDPOINT}/${B2_BUCKET}/${filename}`;
    const uploadRes = await aws.fetch(uploadUrl, {
      method: "PUT",
      body: gzipped,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Length": String(gzipped.length),
      },
    });

    if (!uploadRes.ok) {
      throw new Error(`B2 upload failed [${uploadRes.status}]: ${await uploadRes.text()}`);
    }

    // 4. Rotate: delete daily/* older than RETENTION_DAYS
    const objects = await listB2Objects(aws, B2_ENDPOINT, B2_BUCKET, "daily/");
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let deleted = 0;
    for (const obj of objects) {
      if (new Date(obj.lastModified).getTime() < cutoff) {
        await deleteB2Object(aws, B2_ENDPOINT, B2_BUCKET, obj.key);
        deleted++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        filename,
        bytes: gzipped.length,
        rows: totalRows,
        tables: TABLES.length,
        deleted_old: deleted,
        partial_errors: errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("offsite-backup error:", msg);
    await notifyFailure(supabase, msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
