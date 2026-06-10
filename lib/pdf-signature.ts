const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_SIGNATURE_BYTES = 750 * 1024;
const MAX_SIGNATURE_DIMENSION = 4096;

export async function loadApplicationSignaturePng(supabase: any, application?: Record<string, any> | null) {
  const inlineSignature = decodePngDataUrl(application?.signature_data_url || application?.application_payload?.signature_data_url);
  if (inlineSignature) return inlineSignature;

  const storagePath = application?.signature_data_storage_path;
  if (!storagePath) return null;

  const { data, error } = await supabase.storage
    .from('application-documents')
    .download(storagePath);

  if (error || !data) return null;
  const buffer = Buffer.from(await data.arrayBuffer());
  return isValidSignaturePng(buffer) ? buffer : null;
}

export function decodePngDataUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const buffer = Buffer.from(match[1], 'base64');
  return isValidSignaturePng(buffer) ? buffer : null;
}

export function isValidSignaturePng(buffer: Buffer) {
  if (!buffer.length || buffer.length > MAX_SIGNATURE_BYTES || buffer.length < 33) return false;
  if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return false;
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return false;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return width > 0 && height > 0 && width <= MAX_SIGNATURE_DIMENSION && height <= MAX_SIGNATURE_DIMENSION;
}
