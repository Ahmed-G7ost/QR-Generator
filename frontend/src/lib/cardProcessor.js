/**
 * Client-side card PDF generator.
 *
 * Reproduces backend `generate_pdf` exactly:
 *   - A4 page, grid configurable (NxM)
 *   - Template image drawn per cell
 *   - Username / password / date / label drawn as VECTOR BOLD text
 *   - Optional QR code (PNG image, 1-bit)
 *
 * Output PDF is small (vector text, single embedded template), matches the
 * 90 KB reference for 1000 cards (no QR).
 */
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { generateStyledQrPng } from "../components/QrStyleCustomizer";

// A4 in PDF points
const A4_W = 595.2755905511812;
const A4_H = 841.8897637795276;

export const PHASES = {
  PREPARING: "preparing",
  RENDERING: "rendering",
  SAVING: "saving",
  DONE: "done",
};

const yieldToUI = () => new Promise((r) => setTimeout(r, 0));

function hexToRgb(hex) {
  const m = (hex || "#000000").replace("#", "");
  const v = m.length === 3
    ? m.split("").map((c) => c + c).join("")
    : m.padEnd(6, "0");
  const r = parseInt(v.substr(0, 2), 16) / 255;
  const g = parseInt(v.substr(2, 2), 16) / 255;
  const b = parseInt(v.substr(4, 2), 16) / 255;
  return rgb(r, g, b);
}

async function loadImageBytes(file) {
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

async function embedTemplate(pdfDoc, templateFile) {
  const bytes = await loadImageBytes(templateFile);
  const ext = templateFile.name.split(".").pop().toLowerCase();
  if (ext === "png") return pdfDoc.embedPng(bytes);
  return pdfDoc.embedJpg(bytes);
}

async function generateQrPng(text, config, logoImgEl, fgImgEl) {
  // Use styled QR if any customization is present
  const hasCustom = config && (
    config.qr_fg_color !== "#000000" || config.qr_bg_color !== "#ffffff" ||
    config.qr_dot_style !== "square" || config.qr_eye_color ||
    config.qr_use_gradient || config.qr_frame || config.qr_bg_shape !== "none" ||
    logoImgEl || fgImgEl
  );

  if (hasCustom) {
    // Returns { bytes, isJpeg: true }
    return generateStyledQrPng(text, 100, config || {}, logoImgEl, fgImgEl);
  }

  // Fallback: original tiny PNG for zero-customization (smallest file)
  // Using pure black (rgba(0,0,0,1)) for darker appearance
  const dataUrl = await QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 100,
    color: { dark: "rgba(0, 0, 0, 1)", light: "#ffffff" },
  });
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, isJpeg: false };
}

/**
 * Draw centered bold text at (cx, cy) in PDF coordinates.
 * pdf-lib draws text from the bottom-left baseline, so we offset to center.
 */
function drawCenteredText(page, text, font, fontSize, cx, cy, color) {
  const t = String(text ?? "");
  if (!t) return;
  const tw = font.widthOfTextAtSize(t, fontSize);
  // Approx visual height of the glyph
  const th = font.heightAtSize(fontSize, { descender: false });
  page.drawText(t, {
    x: cx - tw / 2,
    y: cy - th / 2,
    size: fontSize,
    font,
    color,
  });
}

/**
 * Convert percentage coordinates (origin top-left of card, like the preview)
 * into PDF coordinates (origin bottom-left of card).
 */
function pctToPdf(pctX, pctY, cardX, cardY, cardW, cardH) {
  const x = cardX + (pctX / 100) * cardW;
  const y = cardY + cardH - (pctY / 100) * cardH;
  return { x, y };
}

/**
 * Match the preview's font scaling: `Math.round(fontSize * (cardW / 300))`,
 * where `cardW` here is the CARD WIDTH IN PDF POINTS (not pixels). This keeps
 * the relative look between live preview and final PDF.
 */
function scaleFont(baseSize, cardW) {
  return Math.max(6, Math.round(baseSize * (cardW / 300)));
}

/**
 * Main generation routine.
 *
 * @param {Object} opts
 * @param {Object[]} opts.records           — [{ username, password }]
 * @param {File}     opts.templateFile      — JPG/PNG template image
 * @param {Object}   opts.config            — card config (grid, fonts, ...)
 * @param {File}     [opts.customFontFile]  — optional .ttf/.otf custom font
 * @param {(p)=>void} [opts.onProgress]
 * @returns {Promise<{ pdfBytes:Uint8Array, filename:string,
 *                     totalRecords:number, totalPages:number,
 *                     fileSizeKb:number }>}
 */
export async function generateCardsPdf({
  records,
  templateFile,
  config,
  customFontFile = null,
  onProgress = () => {},
}) {
  if (!records || records.length === 0) {
    throw new Error("لا توجد سجلات لتوليدها.");
  }
  if (!templateFile) throw new Error("لم يتم اختيار صورة قالب.");

  onProgress({ phase: PHASES.PREPARING, percent: 0 });

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Always embed BOLD fonts so output text is bold (per user requirement).
  let regularFont;
  let boldFont;
  if (customFontFile) {
    const buf = await customFontFile.arrayBuffer();
    const embedded = await pdfDoc.embedFont(new Uint8Array(buf), { subset: true });
    regularFont = embedded;
    boldFont = embedded; // custom font assumed to be the desired weight
  } else {
    // Use Helvetica-Bold for everything → matches the backend "bold=True" default.
    boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    regularFont = boldFont; // dates were technically regular, but the user
                            // explicitly asked for BOLD output → make all bold.
  }

  const templateImage = await embedTemplate(pdfDoc, templateFile);

  const grid = config.grid || "4x8";
  const [colsStr, rowsStr] = grid.split("x");
  const cols = parseInt(colsStr, 10);
  const rows = parseInt(rowsStr, 10);
  const cardsPerPage = cols * rows;

  // Per-cell geometry on A4 with the same 2% inner margin used by the backend.
  const cellW = A4_W / cols;
  const cellH = A4_H / rows;
  const margin = Math.min(cellW, cellH) * 0.02;
  const cardW = cellW - margin * 2;
  const cardH = cellH - margin * 2;

  // Preserve template aspect ratio inside the card (like preserveAspectRatio).
  const tplRatio = templateImage.width / templateImage.height;
  const cellRatio = cardW / cardH;
  let drawW;
  let drawH;
  if (tplRatio > cellRatio) {
    drawW = cardW;
    drawH = cardW / tplRatio;
  } else {
    drawH = cardH;
    drawW = cardH * tplRatio;
  }

  const totalRecords = records.length;
  const totalPages = Math.ceil(totalRecords / cardsPerPage);

  onProgress({
    phase: PHASES.RENDERING,
    percent: 0,
    current: 0,
    total: totalRecords,
  });

  // Pre-build QR cache by content key + load logo & fg image for styled QR.
  let logoImgEl = null;
  let fgImgEl = null;
  if (config.show_qr && config.qr_logo) {
    try {
      const logoUrl = URL.createObjectURL(config.qr_logo);
      logoImgEl = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = logoUrl;
      });
      URL.revokeObjectURL(logoUrl);
    } catch { /* logo load failed, proceed without */ }
  }
  if (config.show_qr && config.qr_fg_image) {
    try {
      const fgUrl = URL.createObjectURL(config.qr_fg_image);
      fgImgEl = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = fgUrl;
      });
      URL.revokeObjectURL(fgUrl);
    } catch { /* fg image load failed, proceed without */ }
  }

  const qrCache = new Map();
  async function getQrImage(key) {
    if (qrCache.has(key)) return qrCache.get(key);
    const { bytes, isJpeg } = await generateQrPng(key, config, logoImgEl, fgImgEl);
    const img = isJpeg ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);
    qrCache.set(key, img);
    return img;
  }

  let cardCounter = 0;
  for (let p = 0; p < totalPages; p++) {
    const page = pdfDoc.addPage([A4_W, A4_H]);
    const start = p * cardsPerPage;
    const end = Math.min(start + cardsPerPage, totalRecords);

    for (let i = start; i < end; i++) {
      const idx = i - start;
      const col = idx % cols;
      const row = Math.floor(idx / cols);

      // Bottom-left corner of the card area in PDF coords.
      const cellX = col * cellW + margin;
      const cellYBottom = A4_H - (row + 1) * cellH + margin;

      // Center the (possibly letter-boxed) template inside the card area.
      const dx = cellX + (cardW - drawW) / 2;
      const dy = cellYBottom + (cardH - drawH) / 2;
      page.drawImage(templateImage, { x: dx, y: dy, width: drawW, height: drawH });

      const record = records[i] || { username: "", password: "" };

      // === Text rendering (all BOLD) ============================================
      // Username
      {
        const fSize = scaleFont(config.username_font_size || 14, drawW);
        const { x, y } = pctToPdf(
          config.username_x ?? 50, config.username_y ?? 40,
          dx, dy, drawW, drawH,
        );
        drawCenteredText(page, record.username, boldFont, fSize, x, y, hexToRgb(config.username_color));
      }
      // Password
      {
        const fSize = scaleFont(config.password_font_size || 12, drawW);
        const { x, y } = pctToPdf(
          config.password_x ?? 50, config.password_y ?? 60,
          dx, dy, drawW, drawH,
        );
        drawCenteredText(page, record.password, boldFont, fSize, x, y, hexToRgb(config.password_color));
      }
      // Date (+ optional counter)
      if (config.show_date && config.date_text) {
        const fSize = scaleFont(config.date_font_size || 10, drawW);
        const { x, y } = pctToPdf(
          config.date_x ?? 50, config.date_y ?? 85,
          dx, dy, drawW, drawH,
        );
        let dateText = config.date_text;
        if (config.show_counter) dateText = `${dateText}/${cardCounter + 1}`;
        drawCenteredText(page, dateText, boldFont, fSize, x, y, hexToRgb(config.date_color));
      }
      // Label
      if (config.label_text) {
        const fSize = scaleFont(config.label_font_size || 12, drawW);
        const { x, y } = pctToPdf(
          config.label_x ?? 50, config.label_y ?? 10,
          dx, dy, drawW, drawH,
        );
        drawCenteredText(page, config.label_text, boldFont, fSize, x, y, hexToRgb(config.label_color));
      }

      // === QR Code ==============================================================
      if (config.show_qr) {
        const qrType = config.qr_content || "username";
        const server = (config.server_address || "").trim();
        let qrData = "";
        if (qrType === "link" && server) {
          qrData = `http://${server}/login?username=${record.username}&password=${record.password}`;
        } else if (qrType === "password") {
          qrData = String(record.password || "");
        } else if (qrType === "both") {
          qrData = `${record.username || ""}:${record.password || ""}`;
        } else {
          qrData = String(record.username || "");
        }
        if (qrData) {
          const qrImg = await getQrImage(qrData);
          const qrSizePct = Number(config.qr_size || 25);
          
          // Improved QR sizing: use smaller dimension and ensure it fits properly
          // within the card boundaries without overflow or excessive margins
          const maxQrDim = Math.min(drawW, drawH) * 0.95; // 95% of smaller dimension
          let qrDim = Math.min(drawW, drawH) * qrSizePct / 100;
          
          // Ensure QR doesn't exceed card boundaries
          qrDim = Math.min(qrDim, maxQrDim);
          
          // Calculate center position with proper bounds checking
          const { x: qrCx, y: qrCy } = pctToPdf(
            config.qr_x ?? 50, config.qr_y ?? 75,
            dx, dy, drawW, drawH,
          );
          
          // Ensure QR stays within card boundaries
          const halfQr = qrDim / 2;
          const finalX = Math.max(dx, Math.min(qrCx - halfQr, dx + drawW - qrDim));
          const finalY = Math.max(dy, Math.min(qrCy - halfQr, dy + drawH - qrDim));
          
          page.drawImage(qrImg, {
            x: finalX,
            y: finalY,
            width: qrDim,
            height: qrDim,
          });
        }
      }

      cardCounter += 1;
    }

    onProgress({
      phase: PHASES.RENDERING,
      percent: Math.floor(((p + 1) / totalPages) * 100),
      current: end,
      total: totalRecords,
    });

    if (p % 2 === 0) await yieldToUI();
  }

  onProgress({ phase: PHASES.SAVING, percent: 95 });
  const pdfBytes = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 50,
  });
  onProgress({ phase: PHASES.DONE, percent: 100 });

  return {
    pdfBytes,
    filename: `cards_${Date.now()}.pdf`,
    totalRecords,
    totalPages,
    fileSizeKb: Math.round(pdfBytes.byteLength / 1024 * 10) / 10,
  };
}

export function downloadPdfBlob(pdfBytes, filename) {
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return url;
}

export function previewPdfBlob(pdfBytes) {
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
