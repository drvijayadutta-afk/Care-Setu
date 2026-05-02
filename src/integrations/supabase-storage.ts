import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";
const BUCKET = "patient-records";

// Only initialise if credentials are present
const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    : null;

function assertClient() {
  if (!supabase) {
    throw new Error(
      "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars."
    );
  }
  return supabase;
}

export async function generateUploadUrl(
  storagePath: string,
  fileType: string
): Promise<{ uploadUrl: string }> {
  const client = assertClient();
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    throw new Error(`Failed to generate upload URL: ${error?.message}`);
  }

  return { uploadUrl: data.signedUrl };
}

export async function generateDownloadUrl(
  storagePath: string
): Promise<{ downloadUrl: string }> {
  const client = assertClient();
  // 15-minute expiry — never permanent public URLs for PHI
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 900);

  if (error || !data) {
    throw new Error(`Failed to generate download URL: ${error?.message}`);
  }

  return { downloadUrl: data.signedUrl };
}

export async function downloadFileBytes(storagePath: string): Promise<Buffer> {
  const client = assertClient();
  const { data, error } = await client.storage
    .from(BUCKET)
    .download(storagePath);

  if (error || !data) {
    throw new Error(`Failed to download file: ${error?.message}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function deleteFile(storagePath: string): Promise<void> {
  const client = assertClient();
  const { error } = await client.storage.from(BUCKET).remove([storagePath]);
  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}
