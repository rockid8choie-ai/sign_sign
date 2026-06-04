import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Sb = SupabaseClient<Database>;
export const BUCKET = "documents";

export const paths = {
  original: (docId: string) => `${docId}/original.pdf`,
  signature: (docId: string, fieldId: string) => `${docId}/sig_${fieldId}.png`,
  signed: (docId: string) => `${docId}/signed.pdf`,
  cert: (docId: string) => `${docId}/certificate.pdf`,
};

export async function uploadBytes(
  sb: Sb,
  path: string,
  bytes: Uint8Array | ArrayBuffer,
  contentType: string
) {
  const body = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`storage upload 실패: ${error.message}`);
  return path;
}

export async function downloadBytes(sb: Sb, path: string): Promise<Uint8Array> {
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`storage download 실패: ${error?.message}`);
  return new Uint8Array(await data.arrayBuffer());
}
