import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = "https://62jntnb98f-bot.github.io";
const BUCKET = "bsh-archiv";
const MAX_BYTES = 50 * 1024 * 1024;

function corsHeaders(origin: string | null) {
  const headers = new Headers({
    "cache-control": "no-store, no-cache, must-revalidate",
    "pragma": "no-cache",
    "vary": "Origin",
    "x-content-type-options": "nosniff",
  });
  if (!origin || origin === ALLOWED_ORIGIN) {
    headers.set("access-control-allow-origin", ALLOWED_ORIGIN);
  }
  return headers;
}

function jsonReply(req: Request, status: number, body: unknown) {
  const headers = corsHeaders(req.headers.get("origin"));
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

function safeDownloadName(value: unknown) {
  const raw = typeof value === "string" ? value : "BSH-TXT.txt";
  const leaf = raw.split(/[\\/]/).pop() || "BSH-TXT.txt";
  const safe = leaf.replace(/[^A-Za-z0-9._() -]/g, "_").replace(/[\r\n"]/g, "_").slice(0, 180);
  return safe.toLowerCase().endsWith(".txt") ? safe : "BSH-TXT.txt";
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    if (origin && origin !== ALLOWED_ORIGIN) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        ...Object.fromEntries(corsHeaders(origin)),
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
        "access-control-max-age": "86400",
      },
    });
  }

  if (req.method !== "GET") return jsonReply(req, 405, { error: "Nur GET ist erlaubt." });
  if (origin && origin !== ALLOWED_ORIGIN) return jsonReply(req, 403, { error: "Herkunft nicht erlaubt." });

  const supabaseUrl = Deno.env.get("ARCHIV_TEST_SUPABASE_URL");
  const serviceKey = Deno.env.get("ARCHIV_TEST_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return jsonReply(req, 503, { error: "Archivkonfiguration ist unvollständig." });
  }

  const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return jsonReply(req, 400, { error: "Archiv-ID ist ungültig." });
  }

  try {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: record, error: recordError } = await admin
      .from("bsh_archiv_metadaten")
      .select("id, bucket_name, objektpfad, original_dateiname, archiv_status, geloescht_am")
      .eq("id", id)
      .maybeSingle();

    if (recordError) {
      console.error("Archivmetadatenabfrage fehlgeschlagen:", recordError.code);
      return jsonReply(req, 503, { error: "Archivdatei kann derzeit nicht geprüft werden." });
    }
    if (!record) return jsonReply(req, 404, { error: "Archivdatei nicht gefunden." });

    if (
      record.archiv_status !== "archiviert" ||
      record.geloescht_am !== null ||
      record.bucket_name !== BUCKET ||
      typeof record.objektpfad !== "string" ||
      !record.objektpfad
    ) {
      return jsonReply(req, 404, { error: "Archivdatei ist nicht verfügbar." });
    }

    // Zusätzliche Plausibilitätsprüfung: nur erwartete Jahr/Stationsordner und SHA256-Dateinamen.
    const pathMatch = record.objektpfad.match(/^(\d{4})\/([A-Z0-9_-]{2,32})\/([a-f0-9]{64})-[A-Za-z0-9._-]{1,160}$/i);
    if (!pathMatch) {
      console.error("Ungültiger Archivobjektpfad für ID:", id);
      return jsonReply(req, 404, { error: "Archivdatei ist nicht verfügbar." });
    }

    const { data: file, error: storageError } = await admin.storage
      .from(BUCKET)
      .download(record.objektpfad);

    if (storageError || !file) {
      console.error("Archivdatei konnte nicht abgerufen werden:", storageError?.message ?? "kein Dateiinhalt");
      return jsonReply(req, 404, { error: "Datei ist im Archivspeicher nicht verfügbar." });
    }
    if (file.size < 1 || file.size > MAX_BYTES) {
      return jsonReply(req, 413, { error: "Archivdatei ist leer oder größer als 50 MB." });
    }

    const headers = corsHeaders(origin);
    headers.set("content-type", "application/octet-stream");
    headers.set("content-length", String(file.size));
    headers.set("content-disposition", `attachment; filename="${safeDownloadName(record.original_dateiname)}"`);
    return new Response(file.stream(), { status: 200, headers });
  } catch (error) {
    console.error("BSH-Archivabruf fehlgeschlagen:", error instanceof Error ? error.message : "unbekannter Fehler");
    return jsonReply(req, 503, { error: "Archivdatei kann derzeit nicht abgerufen werden." });
  }
});
