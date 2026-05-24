/**
 * Client-side PDF processor — mirrors A7D_QR.py logic 1:1, but rewritten as
 * a STAGED pipeline that keeps the UI thread responsive:
 *
 *   1. EXTRACTING      — read source PDF text & pull (12-digit, 6-digit) pairs
 *   2. GENERATING_QR   — generate every QR PNG in parallel via a Worker Pool
 *   3. LAYOUT          — drop each QR onto its A4 grid cell (yields to UI)
 *   4. MERGING         — interleave design pages with QR pages
 *   5. SAVING          — serialize the final PDF
 *
 * Supports a CancelToken so the user can abort at any time.
 */

import * as pdfjsLib from "pdfjs-dist/build/pdf";
import { PDFDocument } from "pdf-lib";
import { QrWorkerPool, recommendedPoolSize } from "./workerPool";
import { generateStyledQrPng } from "../components/QrStyleCustomizer";

// Configure pdf.js worker (served from /public)
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ""}/pdf.worker.min.js`;

// A4 dimensions in points (same as reportlab A4)
const A4_WIDTH = 595.2755905511812;
const A4_HEIGHT = 841.8897637795276;

// QR raster size in pixels. 200px is sharp for typical card printing
// (a QR cell of ~150pt @ 200px ≈ 140 DPI, well above the 150 DPI print floor),
// and optimized for smaller file sizes.
const QR_PIXEL_SIZE = 200;

export const PHASES = {
  EXTRACTING: "extracting",
  GENERATING_QR: "generating_qr",
  LAYOUT: "layout",
  MERGING: "merging",
  SAVING: "saving",
  DONE: "done",
};

/** Yield back to the browser so it can paint / handle events. */
const yieldToUI = () => new Promise((r) => setTimeout(r, 0));

export class CancelToken {
  constructor() {
    this.cancelled = false;
    this._listeners = [];
  }
  cancel() {
    if (this.cancelled) return;
    this.cancelled = true;
    for (const cb of this._listeners) {
      try {
        cb();
      } catch (_) {
        /* noop */
      }
    }
  }
  onCancel(cb) {
    if (this.cancelled) cb();
    else this._listeners.push(cb);
  }
  throwIfCancelled() {
    if (this.cancelled) {
      const err = new Error("CANCELLED");
      err.cancelled = true;
      throw err;
    }
  }
}

export function isCancelledError(err) {
  return !!(err && (err.cancelled || err.message === "CANCELLED"));
}

/**
 * Extract (username, password) pairs from a PDF file.
 * Matches \b\d{12}\b and \b\d{6}\b like the original Python re.findall calls.
 */
export async function extractDataset(sourcePdfFile, cancelToken, onPageProgress) {
  const arrayBuffer = await sourcePdfFile.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const dataset = [];
  const totalPages = pdf.numPages;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    cancelToken && cancelToken.throwIfCancelled();
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const txt = textContent.items.map((it) => it.str).join(" ");

    if (txt) {
      const u = txt.match(/\b\d{12}\b/g) || [];
      const p = txt.match(/\b\d{6}\b/g) || [];
      const n = Math.min(u.length, p.length);
      for (let i = 0; i < n; i++) dataset.push([u[i], p[i]]);
    }
    if (onPageProgress) onPageProgress(pageNum, totalPages);
    // Let the UI breathe between pages.
    if (pageNum % 4 === 0) await yieldToUI();
  }
  return dataset;
}

/**
 * Process everything end-to-end and return the final merged PDF.
 *
 * @param {Object} opts
 * @param {File|File[]} opts.sourcePdfFile   — single file OR array of source PDFs
 * @param {File[]}      [opts.sourcePdfFiles] — array of source PDFs (alternative key)
 * @param {File} opts.designPdfFile
 * @param {string} opts.server
 * @param {number} opts.totalCards
 * @param {number} opts.cols
 * @param {number} opts.rows
 * @param {CancelToken} [opts.cancelToken]
 * @param {(p: { phase: string, percent: number, current: number, total: number,
 *               workers?: number }) => void} [opts.onProgress]
 * @returns {Promise<{ pdfBytes: Uint8Array, filename: string, itemsCount: number }>}
 */
export async function processPdfs({
  sourcePdfFile,
  sourcePdfFiles,
  designPdfFile,
  server,
  totalCards,
  cols,
  rows,
  qrStyle,
  cancelToken = new CancelToken(),
  onProgress = () => {},
}) {
  // Normalise to an array (backward-compatible)
  const sourceFiles = sourcePdfFiles
    ? sourcePdfFiles
    : Array.isArray(sourcePdfFile)
    ? sourcePdfFile
    : [sourcePdfFile];

  if (!sourceFiles || sourceFiles.length === 0 || !sourceFiles[0]) throw new Error("PDF files missing!");
  if (!designPdfFile) throw new Error("PDF files missing!");
  if (!server) throw new Error("Server address is required");
  if (!totalCards || !cols || !rows) {
    throw new Error("Total cards / columns / rows are required");
  }

  // -------------------- PHASE 1: EXTRACT (from all source files) --------------------
  onProgress({ phase: PHASES.EXTRACTING, percent: 0, current: 0, total: 0 });
  const dataset = [];
  for (let fi = 0; fi < sourceFiles.length; fi++) {
    const partial = await extractDataset(sourceFiles[fi], cancelToken, (cur, total) => {
      // Spread progress across all files
      const fileOffset = fi / sourceFiles.length;
      const fileWeight = 1 / sourceFiles.length;
      onProgress({
        phase: PHASES.EXTRACTING,
        percent: Math.floor((fileOffset + (cur / total) * fileWeight) * 100),
        current: dataset.length + cur,
        total: 0,
      });
    });
    dataset.push(...partial);
  }
  cancelToken.throwIfCancelled();

  if (dataset.length === 0) {
    throw new Error("No (12-digit, 6-digit) pairs found in source PDF(s)");
  }
  const totalItems = dataset.length;

  // -------------------- PHASE 2: GENERATE QRs --------------------
  // Decide whether to use styled QR (with user customization) or the fast
  // default worker pool. Any customization or attached image/logo triggers
  // the styled renderer (slower but supports all visual options).
  const hasCustomStyle = !!(qrStyle && (
    (qrStyle.qr_fg_color && qrStyle.qr_fg_color !== "#000000") ||
    (qrStyle.qr_bg_color && qrStyle.qr_bg_color !== "#ffffff") ||
    (qrStyle.qr_dot_style && qrStyle.qr_dot_style !== "square") ||
    qrStyle.qr_eye_color ||
    qrStyle.qr_use_gradient ||
    qrStyle.qr_frame ||
    (qrStyle.qr_bg_shape && qrStyle.qr_bg_shape !== "none") ||
    qrStyle.qr_logo ||
    qrStyle.qr_fg_image
  ));

  let qrItems; // [{ idx, bytes, isJpeg }]

  if (hasCustomStyle) {
    onProgress({
      phase: PHASES.GENERATING_QR,
      percent: 0,
      current: 0,
      total: totalItems,
      workers: 1,
    });

    // Pre-load logo / fg image elements once (reuse for all QRs)
    const loadImg = (file) => new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { resolve(img); /* keep url alive until after loop */ };
      img.onerror = (e) => reject(e);
      img.src = url;
    });
    const logoImg = qrStyle.qr_logo ? await loadImg(qrStyle.qr_logo) : null;
    const fgImg = qrStyle.qr_fg_image ? await loadImg(qrStyle.qr_fg_image) : null;

    qrItems = [];
    for (let i = 0; i < dataset.length; i++) {
      cancelToken.throwIfCancelled();
      const [u, p] = dataset[i];
      const link = `http://${server}/login?username=${u}&password=${p}`;
      const { bytes, isJpeg } = await generateStyledQrPng(link, QR_PIXEL_SIZE, qrStyle, logoImg, fgImg);
      qrItems.push({ idx: i, bytes, isJpeg });
      onProgress({
        phase: PHASES.GENERATING_QR,
        percent: Math.floor(((i + 1) / totalItems) * 100),
        current: i + 1,
        total: totalItems,
        workers: 1,
      });
      // Yield every few items so UI stays responsive
      if (i % 4 === 3) await yieldToUI();
    }
  } else {
    const poolSize = recommendedPoolSize();
    const pool = new QrWorkerPool(poolSize);
    cancelToken.onCancel(() => pool.cancel());

    try {
      onProgress({
        phase: PHASES.GENERATING_QR,
        percent: 0,
        current: 0,
        total: totalItems,
        workers: poolSize,
      });

      let completed = 0;
      const tasks = dataset.map(([u, p], idx) => {
        const link = `http://${server}/login?username=${u}&password=${p}`;
        return pool.generate(link, QR_PIXEL_SIZE).then((bytes) => {
          completed += 1;
          onProgress({
            phase: PHASES.GENERATING_QR,
            percent: Math.floor((completed / totalItems) * 100),
            current: completed,
            total: totalItems,
            workers: poolSize,
          });
          return { idx, bytes, isJpeg: false };
        });
      });

      qrItems = await Promise.all(tasks);
      qrItems.sort((a, b) => a.idx - b.idx);
    } finally {
      pool.terminate();
    }
  }
  cancelToken.throwIfCancelled();

  // -------------------- PHASE 3: LAYOUT --------------------
  onProgress({
    phase: PHASES.LAYOUT,
    percent: 0,
    current: 0,
    total: totalItems,
  });

  const qrPdf = await PDFDocument.create();
  const w = A4_WIDTH;
  const h = A4_HEIGHT;
  const cw = w / cols;
  const ch = h / rows;
  const qrDim = Math.min(cw, ch); // QR fills the full card cell (100%)

  let laidOut = 0;
  for (let i = 0; i < totalItems; i += totalCards) {
    cancelToken.throwIfCancelled();
    const qrPage = qrPdf.addPage([w, h]);
    const batch = qrItems.slice(i, i + totalCards);

    for (let index = 0; index < batch.length; index++) {
      const item = batch[index];
      // pdf-lib copies the bytes into its own buffer, safe even after transfer.
      const pngImage = item.isJpeg
        ? await qrPdf.embedJpg(item.bytes)
        : await qrPdf.embedPng(item.bytes);

      // Mirror Python coordinates exactly - QR positioned at cell origin to fill entire card
      const colIdx = index % cols;
      const rowIdx = Math.floor(index / cols);
      const x = (cols - 1 - colIdx) * cw;
      const y = h - (rowIdx + 1) * ch;
      qrPage.drawImage(pngImage, { x, y, width: qrDim, height: qrDim });

      laidOut += 1;
    }
    onProgress({
      phase: PHASES.LAYOUT,
      percent: Math.floor((laidOut / totalItems) * 100),
      current: laidOut,
      total: totalItems,
    });
    // Yield once per page so the cancel button stays clickable.
    await yieldToUI();
  }
  cancelToken.throwIfCancelled();

  // -------------------- PHASE 4: MERGE --------------------
  onProgress({
    phase: PHASES.MERGING,
    percent: 0,
    current: 0,
    total: 0,
  });

  const designBytes = await designPdfFile.arrayBuffer();
  const designPdf = await PDFDocument.load(designBytes);
  const qrFinalBytes = await qrPdf.save();
  cancelToken.throwIfCancelled();

  const qrLoaded = await PDFDocument.load(qrFinalBytes);
  const outputPdf = await PDFDocument.create();
  const designPageCount = designPdf.getPageCount();
  const qrPageCount = qrLoaded.getPageCount();
  const totalMergeSteps = designPageCount;

  for (let i = 0; i < designPageCount; i++) {
    cancelToken.throwIfCancelled();
    const [copiedDesign] = await outputPdf.copyPages(designPdf, [i]);
    outputPdf.addPage(copiedDesign);
    if (i < qrPageCount) {
      const [copiedQr] = await outputPdf.copyPages(qrLoaded, [i]);
      outputPdf.addPage(copiedQr);
    }
    onProgress({
      phase: PHASES.MERGING,
      percent: Math.floor(((i + 1) / totalMergeSteps) * 100),
      current: i + 1,
      total: totalMergeSteps,
    });
    if (i % 2 === 0) await yieldToUI();
  }
  cancelToken.throwIfCancelled();

  // -------------------- PHASE 5: SAVE --------------------
  onProgress({ phase: PHASES.SAVING, percent: 0, current: 0, total: 0 });
  const pdfBytes = await outputPdf.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 50,
  });
  cancelToken.throwIfCancelled();

  const designName = designPdfFile.name.replace(/\.pdf$/i, "");
  const filename = `${designName} QR.pdf`;

  onProgress({
    phase: PHASES.DONE,
    percent: 100,
    current: totalItems,
    total: totalItems,
  });

  return { pdfBytes, filename, itemsCount: totalItems };
}

export function downloadBlob(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
