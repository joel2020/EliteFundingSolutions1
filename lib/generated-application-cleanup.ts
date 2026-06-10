type GeneratedApplicationCleanupClient = {
  storage: {
    from: (bucket: string) => {
      remove: (paths: string[]) => Promise<unknown>;
    };
  };
  from: (table: string) => any;
};

function uniquePresent(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

export async function cleanupGeneratedApplicationArtifacts(
  supabase: GeneratedApplicationCleanupClient,
  args: {
    organizationId: string;
    storagePaths?: Array<string | null | undefined>;
    documentIds?: Array<string | null | undefined>;
  },
) {
  const storagePaths = uniquePresent(args.storagePaths || []);
  const documentIds = uniquePresent(args.documentIds || []);
  const cleanupTasks: Promise<unknown>[] = [];

  if (storagePaths.length) {
    cleanupTasks.push(supabase.storage.from('application-documents').remove(storagePaths));
  }

  if (documentIds.length) {
    cleanupTasks.push(
      supabase
        .from('documents')
        .delete()
        .eq('organization_id', args.organizationId)
        .in('id', documentIds),
    );
  }

  if (cleanupTasks.length) await Promise.allSettled(cleanupTasks);
}
