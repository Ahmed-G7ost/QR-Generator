import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import { PDFDocument, rgb } from "pdf-lib";
import { generateStyledQRBytes, DEFAULT_QR_STYLE } from "./qrStyler";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

// ── Phase constants ───────────────────────────────────────────────────────────

export const PHASES = {
  EXTRACTING: "extracting",
  GENERATING_QR: "generating_qr",
  LAYOUT: "layout",
  MERGING: "merging",
  SAVING: "saving",
  DONE: "done",
};

// ── Cancellation ─────────────────────────────────────────────────────────────

export class CancelToken {
  constructor() { this._cancelled = false; }
  cancel() { this._cancelled = true; }
  get cancelled() { return this._cancelled; }
  throwIfCancelled() {
    if (this._cancelled) throw new CancelledError();
  }
}

class CancelledError extends Error {
  constructor() { super("Cancelled"); this.isCancelledError = true; }
}

export function isCancelledError(e) {
  return e?.isCancelledError === true;
}

// ── Download helper ───────────────────────────────────────────────────────────

export function downloadBlob(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── PDF text extraction ───────────────────────────────────────────────────────

async function extractTextFromPdf(file) {
  const reader = new FileReader();
  const buf = await new Promise((res, rej) => {
    reader.onload = (e) => res(e.target.result);
    reader.onerror = rej;
    reader.readAsArrayBuffer(file);
  });

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it) => it.str).join(" ");
    pages.push(text);
  }

  return pages;
}

// ── Parse credentials from page text ─────────────────────────────────────────

function parseCredentials(text) {
  const records = [];

  // Pattern: "username:XXX password:YYY" or "user:X pass:Y"
  const patterns = [
    /(?:user(?:name)?|login|account)[:\s]+(\S+)\s+(?:pass(?:word)?|pwd|secret)[:\s]+(\S+)/gi,
    /(\d{6,})\s+(\d{4,})/g, // number number (common for ISP cards)
    /([a-zA-Z0-9_.-]{3,})\s+([a-zA-Z0-9_.-]{3,})/g, // word word
  ];

  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(text)) !== null) {
      const u = m[1].trim();
      const p = m[2].trim();
      if (u && p && u.length >= 3 && p.length >= 3) {
        records.push({ username: u, password: p });
      }
    }
    if (records.length > 0) break;
  }

  return records;
}

// ── Main processor ────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {File}   opts.sourcePdfFile
 * @param {File}   opts.designPdfFile
 * @param {string} opts.server
 * @param {number} opts.totalCards
 * @param {number} opts.cols
 * @param {number} opts.rows
 * @param {object} opts.qrStyle
 * @param {CancelToken} opts.cancelToken
 * @param {Function} opts.onProgress
 */
export async function processPdfs({
  sourcePdfFile,
  designPdfFile,
  server,
  totalCards,
  cols,
  rows,
  qrStyle = DEFAULT_QR_STYLE,
  cancelToken,
  onProgress,
}) {
  const report = (phase, percent, extra = {}) =>
    onProgress?.({ phase, percent, ...extra });

  // ── 1. Extract data from source PDF ───────────────────────────────────────
  report(PHASES.EXTRACTING, 5);
  cancelToken?.throwIfCancelled();

  const pages = await extractTextFromPdf(sourcePdfFile);
  const allText = pages.join("\n");
  let records = [];

  // Try per-page parsing first
  for (const pageText of pages) {
    const recs = parseCredentials(pageText);
    records.push(...recs);
  }

  // Fallback: parse whole document
  if (records.length === 0) {
    records = parseCredentials(allText);
  }

  // Limit to totalCards
  if (records.length === 0) {
    // Create placeholder records if parsing failed
    for (let i = 0; i < totalCards; i++) {
      records.push({ username: `user${String(i + 1).padStart(4, "0")}`, password: `pass${String(i + 1).padStart(4, "0")}` });
    }
  }

  records = records.slice(0, totalCards);
  const itemsCount = records.length;

  report(PHASES.EXTRACTING, 20, { current: itemsCount, total: itemsCount });
  cancelToken?.throwIfCancelled();

  // ── 2. Read design PDF ────────────────────────────────────────────────────
  const designBytes = await new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = (e) => res(e.target.result);
    reader.onerror = rej;
    reader.readAsArrayBuffer(designPdfFile);
  });

  // ── 3. Generate QR codes ──────────────────────────────────────────────────
  report(PHASES.GENERATING_QR, 25, { workers: 1 });
  const qrImages = [];
  for (let i = 0; i < records.length; i++) {
    cancelToken?.throwIfCancelled();
    const rec = records[i];
    let qrText = "";
    if (server) {
      qrText = `${server}/login?username=${encodeURIComponent(rec.username)}&password=${encodeURIComponent(rec.password)}`;
    } else {
      qrText = `${rec.username}:${rec.password}`;
    }
    const pngBytes = await generateStyledQRBytes(qrText, qrStyle, 200);
    qrImages.push(pngBytes);
    report(PHASES.GENERATING_QR, 25 + Math.round((i / records.length) * 35), {
      current: i + 1,
      total: records.length,
      workers: 1,
    });
  }

  // ── 4. Layout: create output PDF ─────────────────────────────────────────
  report(PHASES.LAYOUT, 65);
  cancelToken?.throwIfCancelled();

  const templateDoc = await PDFDocument.load(new Uint8Array(designBytes));
  const [templatePage] = templateDoc.getPages();
  const pageW = templatePage.getWidth();
  const pageH = templatePage.getHeight();

  const cardsPerPage = cols * rows;
  const numPages = Math.ceil(records.length / cardsPerPage);
  const outDoc = await PDFDocument.create();

  const cellW = pageW / cols;
  const cellH = pageH / rows;
  const qrPad = Math.min(cellW, cellH) * 0.1;
  const qrDim = Math.min(cellW, cellH) - qrPad * 2;

  // ── 5. Merge ──────────────────────────────────────────────────────────────
  report(PHASES.MERGING, 70);

  for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
    cancelToken?.throwIfCancelled();

    // Copy template page
    const [copiedPage] = await outDoc.copyPages(templateDoc, [0]);
    outDoc.addPage(copiedPage);
    const outPage = outDoc.getPages()[pageIdx];

    for (let cardIdx = 0; cardIdx < cardsPerPage; cardIdx++) {
      const globalIdx = pageIdx * cardsPerPage + cardIdx;
      if (globalIdx >= qrImages.length) break;

      const col = cardIdx % cols;
      const row = Math.floor(cardIdx / cols);

      const x = col * cellW + qrPad;
      const y = pageH - (row + 1) * cellH + qrPad;

      try {
        const pngImage = await outDoc.embedPng(qrImages[globalIdx]);
        outPage.drawImage(pngImage, {
          x,
          y,
          width: qrDim,
          height: qrDim,
        });
      } catch {
        // Skip failed QR
      }
    }

    report(PHASES.MERGING, 70 + Math.round((pageIdx / numPages) * 20), {
      current: (pageIdx + 1) * cardsPerPage,
      total: records.length,
    });
  }

  // ── 6. Save ───────────────────────────────────────────────────────────────
  report(PHASES.SAVING, 92);
  cancelToken?.throwIfCancelled();

  const pdfBytes = await outDoc.save();
  const ts = new Date().toISOString().slice(0, 10);
  const filename = `qr_cards_${ts}.pdf`;

  report(PHASES.DONE, 100, { current: itemsCount, total: itemsCount });
  return { pdfBytes, filename, itemsCount };
}
