export async function loadApplicationSignaturePng(supabase: any, application?: Record<string, any> | null) {
  const inlineSignature = decodePngDataUrl(application?.signature_data_url || application?.application_payload?.signature_data_url);
  if (inlineSignature) return inlineSignature;

  const storagePath = application?.signature_data_storage_path;
  if (!storagePath) return null;

  const { data, error } = await supabase.storage
    .from('application-documents')
    .download(storagePath);

  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export function decodePngDataUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const buffer = Buffer.from(match[1], 'base64');
  return buffer.length ? buffer : null;
}
