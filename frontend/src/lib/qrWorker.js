/* eslint-disable no-restricted-globals */
/**
 * Web Worker — generates a QR PNG (as Uint8Array) for a given text/URL.
 *
 * Strategy: we can't use `QRCode.toDataURL()` here because the qrcode browser
 * build needs a real DOM <canvas>, which doesn't exist in a Worker context.
 * Instead we call `QRCode.create()` to get the raw bit matrix and then render
 * it to an OffscreenCanvas — which is fully supported in modern workers.
 *
 * Bundled by Webpack 5 via `new Worker(new URL('./qrWorker.js', import.meta.url), { type: 'module' })`.
 */
import QRCode from "qrcode";

async function renderQrPng(text, width) {
  // 1) Compute QR matrix on the worker thread.
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const modules = qr.modules;
  const size = modules.size; // number of QR cells per row
  const margin = 1; // quiet-zone in cells (same as toDataURL default)
  const total = size + margin * 2;

  // 2) Pick a pixel-perfect canvas size: floor(width/total)*total avoids
  //    sub-pixel blurring when scaled up by the PDF renderer.
  const cellPx = Math.max(1, Math.floor(width / total));
  const finalPx = cellPx * total;

  const canvas = new OffscreenCanvas(finalPx, finalPx);
  const ctx = canvas.getContext("2d");
  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, finalPx, finalPx);
  // Pure black (غامق) for QR modules - with full opacity
  ctx.fillStyle = "rgba(0, 0, 0, 1)";
  ctx.globalAlpha = 1.0; // ensure full opacity for darker appearance
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules.get(r, c)) {
        ctx.fillRect((c + margin) * cellPx, (r + margin) * cellPx, cellPx, cellPx);
      }
    }
  }

  const blob = await canvas.convertToBlob({ type: "image/png" });
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

self.onmessage = async (e) => {
  const { id, text, width } = e.data || {};
  try {
    const bytes = await renderQrPng(text, width || 256);
    self.postMessage({ id, bytes }, [bytes.buffer]);
  } catch (err) {
    self.postMessage({ id, error: (err && err.message) || String(err) });
  }
};
