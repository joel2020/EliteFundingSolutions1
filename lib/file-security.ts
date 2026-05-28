const PDF_SIGNATURE = Buffer.from('%PDF-');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

const suspiciousPdfPatterns = [
  /\/JavaScript\b/i,
  /\/JS\b/i,
  /\/OpenAction\b/i,
  /\/AA\b/i,
  /\/Launch\b/i,
  /\/EmbeddedFile\b/i,
  /\/RichMedia\b/i,
];

export type FileSecurityResult = {
  ok: boolean;
  mimeType: string;
  extension: string;
  reason?: string;
};

function extensionFor(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

function startsWith(buffer: Buffer, signature: Buffer) {
  return buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature);
}

function looksLikeHeic(buffer: Buffer) {
  if (buffer.length < 12) return false;
  return buffer.subarray(4, 8).toString('ascii') === 'ftyp'
    && ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(buffer.subarray(8, 12).toString('ascii').toLowerCase());
}

export async function screenUploadedFile(
  file: File,
  options: {
    allowedExtensions: Set<string>;
    allowedMimeTypes: Set<string>;
    maxBytes: number;
    rejectActivePdf?: boolean;
  },
): Promise<FileSecurityResult> {
  const extension = extensionFor(file.name);
  const declaredType = file.type || 'application/octet-stream';

  if (file.size <= 0) {
    return { ok: false, mimeType: declaredType, extension, reason: 'File is empty.' };
  }

  if (file.size > options.maxBytes) {
    return { ok: false, mimeType: declaredType, extension, reason: 'File exceeds the maximum allowed size.' };
  }

  if (!options.allowedExtensions.has(extension) || (file.type && !options.allowedMimeTypes.has(file.type))) {
    return { ok: false, mimeType: declaredType, extension, reason: 'File type is not allowed.' };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isPdf = startsWith(buffer, PDF_SIGNATURE);
  const isPng = startsWith(buffer, PNG_SIGNATURE);
  const isJpg = startsWith(buffer, JPG_SIGNATURE);
  const isHeic = looksLikeHeic(buffer);
  const magicMatches = (
    (extension === 'pdf' && isPdf)
    || (extension === 'png' && isPng)
    || (['jpg', 'jpeg'].includes(extension) && isJpg)
    || (['heic', 'heif'].includes(extension) && isHeic)
  );

  if (!magicMatches) {
    return { ok: false, mimeType: declaredType, extension, reason: 'File content does not match its extension.' };
  }

  if (isPdf && options.rejectActivePdf) {
    const ascii = buffer.subarray(0, Math.min(buffer.length, 2 * 1024 * 1024)).toString('latin1');
    const matched = suspiciousPdfPatterns.find((pattern) => pattern.test(ascii));
    if (matched) {
      return { ok: false, mimeType: declaredType, extension, reason: 'PDF contains active or embedded content that is not allowed.' };
    }
  }

  return { ok: true, mimeType: declaredType, extension };
}
