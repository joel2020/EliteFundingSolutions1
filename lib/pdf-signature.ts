export async function loadApplicationSignaturePng(supabase: any, application?: Record<string, any> | null) {
  const storagePath = application?.signature_data_storage_path;
  if (!storagePath) return null;

  const { data, error } = await supabase.storage
    .from('application-documents')
    .download(storagePath);

  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
