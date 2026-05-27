import { createHash } from 'crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type ContractSigningPdfInput = {
  originalPdfBytes?: Uint8Array | null;
  contractId: string;
  businessName: string;
  contractType: string;
  signerName: string;
  signerEmail: string;
  signerUserId: string;
  signedAt: string;
  signerIp: string;
  signerUserAgent: string;
  esignConsentText: string;
};

function sha256(bytes: Uint8Array | Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

export async function buildSignedContractPdf(input: ContractSigningPdfInput) {
  let pdfDoc: PDFDocument;
  const originalHash = input.originalPdfBytes?.length ? sha256(input.originalPdfBytes) : null;

  try {
    pdfDoc = input.originalPdfBytes?.length
      ? await PDFDocument.load(input.originalPdfBytes)
      : await PDFDocument.create();
  } catch {
    pdfDoc = await PDFDocument.create();
  }

  const page = pdfDoc.addPage([612, 792]);
  const { height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const draw = (text: string, x: number, y: number, size = 10, useBold = false) => {
    page.drawText(text, {
      x,
      y,
      size,
      font: useBold ? bold : font,
      color: rgb(0.05, 0.09, 0.16),
    });
  };

  draw('Elite Funding Solutions', 48, height - 58, 16, true);
  draw('Electronic Signature Certificate', 48, height - 82, 20, true);
  draw('This page records the electronic signature event for the attached contract.', 48, height - 108, 10);

  const rows = [
    ['Business', input.businessName || 'Not provided'],
    ['Contract type', input.contractType || 'Contract'],
    ['Contract ID', input.contractId],
    ['Signer', input.signerName],
    ['Signer email', input.signerEmail],
    ['Signer user ID', input.signerUserId],
    ['Signed at', input.signedAt],
    ['Signer IP', input.signerIp || 'Unavailable'],
    ['User agent', input.signerUserAgent || 'Unavailable'],
  ];

  let y = height - 148;
  for (const [label, value] of rows) {
    draw(label, 48, y, 9, true);
    for (const line of wrapText(value, 68)) {
      draw(line, 170, y, 9);
      y -= 14;
    }
    y -= 4;
  }

  y -= 8;
  draw('E-SIGN Consent', 48, y, 11, true);
  y -= 18;
  for (const line of wrapText(input.esignConsentText, 90)) {
    draw(line, 48, y, 9);
    y -= 13;
  }

  y -= 14;
  draw('Typed Signature', 48, y, 11, true);
  y -= 32;
  page.drawLine({
    start: { x: 48, y },
    end: { x: 320, y },
    thickness: 1,
    color: rgb(0.15, 0.23, 0.37),
  });
  draw(input.signerName, 54, y + 10, 18, true);
  draw('Signature applied electronically by the signer named above.', 48, y - 18, 9);

  if (originalHash) {
    draw('Original file SHA-256', 48, 84, 8, true);
    draw(originalHash, 48, 70, 7);
  }

  const signedBytes = await pdfDoc.save();
  return {
    bytes: signedBytes,
    originalHash,
    signedHash: sha256(Buffer.from(signedBytes)),
  };
}
