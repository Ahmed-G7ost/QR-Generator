import QRCode from "qrcode";

export const DOT_STYLES = [
  { value: "square", labelAr: "مربع", labelEn: "Square" },
  { value: "rounded", labelAr: "مدور", labelEn: "Rounded" },
  { value: "dots", labelAr: "دوائر", labelEn: "Dots" },
  { value: "classy", labelAr: "أنيق", labelEn: "Classy" },
];

export const CORNER_STYLES = [
  { value: "square", labelAr: "مربع", labelEn: "Square" },
  { value: "rounded", labelAr: "مدور", labelEn: "Rounded" },
  { value: "extra-rounded", labelAr: "مدور أكثر", labelEn: "Extra Rounded" },
  { value: "dot", labelAr: "دائرة", labelEn: "Dot" },
];

export const DEFAULT_QR_STYLE = {
  dotColor: "#000000",
  backgroundColor: "#ffffff",
  backgroundImage: null,
  eyeOuterColor: "#000000",
  eyeInnerColor: "#000000",
  dotStyle: "square",
  cornerStyle: "square",
  logoImage: null,
  logoSizeRatio: 0.25,
  logoBorderRadius: 8,
  logoBackgroundColor: "#ffffff",
  errorCorrectionLevel: "H",
};

// ── Canvas helpers ──────────────────────────────────────────────────────────

function drawRoundedRect(ctx, x, y, w, h, r) {
  r = Math.min(Math.abs(r), Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawDot(ctx, x, y, size, style) {
  const m = size * 0.1;
  const s = size - m * 2;
  const mx = x + m, my = y + m;
  ctx.beginPath();
  switch (style) {
    case "dots":
      ctx.arc(mx + s / 2, my + s / 2, s / 2, 0, Math.PI * 2);
      break;
    case "rounded":
      drawRoundedRect(ctx, mx, my, s, s, s * 0.25);
      break;
    case "classy":
      drawRoundedRect(ctx, mx, my, s, s, s * 0.4);
      break;
    default: // square
      ctx.rect(mx, my, s, s);
      break;
  }
  ctx.fill();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ── Finder pattern drawing ──────────────────────────────────────────────────

function drawFinder(ctx, px, py, cellSize, outerColor, innerColor, cornerStyle, clearColor) {
  const dim7 = cellSize * 7;
  const dim5 = cellSize * 5;
  const dim3 = cellSize * 3;

  if (cornerStyle === "rounded") {
    ctx.fillStyle = outerColor;
    drawRoundedRect(ctx, px, py, dim7, dim7, cellSize);
    ctx.fill();
    ctx.fillStyle = clearColor;
    drawRoundedRect(ctx, px + cellSize, py + cellSize, dim5, dim5, cellSize * 0.8);
    ctx.fill();
    ctx.fillStyle = innerColor;
    drawRoundedRect(ctx, px + cellSize * 2, py + cellSize * 2, dim3, dim3, cellSize * 0.5);
    ctx.fill();
  } else if (cornerStyle === "extra-rounded") {
    ctx.fillStyle = outerColor;
    drawRoundedRect(ctx, px, py, dim7, dim7, cellSize * 1.5);
    ctx.fill();
    ctx.fillStyle = clearColor;
    drawRoundedRect(ctx, px + cellSize, py + cellSize, dim5, dim5, cellSize * 1.2);
    ctx.fill();
    ctx.fillStyle = innerColor;
    ctx.beginPath();
    ctx.arc(px + dim7 / 2, py + dim7 / 2, dim3 / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (cornerStyle === "dot") {
    ctx.fillStyle = outerColor;
    ctx.beginPath();
    ctx.arc(px + dim7 / 2, py + dim7 / 2, dim7 / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = clearColor;
    ctx.beginPath();
    ctx.arc(px + dim7 / 2, py + dim7 / 2, dim5 / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = innerColor;
    ctx.beginPath();
    ctx.arc(px + dim7 / 2, py + dim7 / 2, dim3 / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // square
    ctx.fillStyle = outerColor;
    ctx.fillRect(px, py, dim7, dim7);
    ctx.fillStyle = clearColor;
    ctx.fillRect(px + cellSize, py + cellSize, dim5, dim5);
    ctx.fillStyle = innerColor;
    ctx.fillRect(px + cellSize * 2, py + cellSize * 2, dim3, dim3);
  }
}

// ── Main styled QR generator ────────────────────────────────────────────────

/**
 * Returns a data URL (PNG) for the styled QR code.
 * @param {string} text
 * @param {object} style
 * @param {number} size  pixel size of output canvas
 */
export async function generateStyledQR(text, style = {}, size = 300) {
  const s = { ...DEFAULT_QR_STYLE, ...style };

  // Generate QR matrix
  const qr = QRCode.create(text || "https://example.com", {
    errorCorrectionLevel: s.errorCorrectionLevel,
  });
  const modules = qr.modules;
  const N = modules.size;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const quietZoneCells = 2;
  const cellSize = size / (N + quietZoneCells * 2);
  const offset = quietZoneCells * cellSize;

  // ── Background ────────────────────────────────────────────────────────────
  if (s.backgroundImage) {
    try {
      const img = await loadImage(s.backgroundImage);
      ctx.drawImage(img, 0, 0, size, size);
    } catch {
      ctx.fillStyle = s.backgroundColor;
      ctx.fillRect(0, 0, size, size);
    }
  } else {
    ctx.fillStyle = s.backgroundColor;
    ctx.fillRect(0, 0, size, size);
  }

  // Cells that are part of the three finder patterns (incl. separator)
  const isFinderCell = (r, c) => {
    const tl = r <= 7 && c <= 7;
    const tr = r <= 7 && c >= N - 8;
    const bl = r >= N - 8 && c <= 7;
    return tl || tr || bl;
  };

  // ── Data dots ─────────────────────────────────────────────────────────────
  ctx.fillStyle = s.dotColor;
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      if (isFinderCell(row, col)) continue;
      if (modules.get(row, col)) {
        ctx.fillStyle = s.dotColor;
        drawDot(ctx, offset + col * cellSize, offset + row * cellSize, cellSize, s.dotStyle);
      }
    }
  }

  // ── Finder patterns ───────────────────────────────────────────────────────
  const outerColor = s.eyeOuterColor || s.dotColor;
  const innerColor = s.eyeInnerColor || s.dotColor;
  const clearColor = s.backgroundImage ? "rgba(0,0,0,0)" : s.backgroundColor;

  const finderOrigins = [
    { r: 0, c: 0 },
    { r: 0, c: N - 7 },
    { r: N - 7, c: 0 },
  ];
  finderOrigins.forEach(({ r, c }) => {
    drawFinder(
      ctx,
      offset + c * cellSize,
      offset + r * cellSize,
      cellSize,
      outerColor,
      innerColor,
      s.cornerStyle,
      clearColor
    );
  });

  // ── Logo ──────────────────────────────────────────────────────────────────
  if (s.logoImage) {
    const logoSize = size * Math.min(s.logoSizeRatio, 0.4);
    const lx = (size - logoSize) / 2;
    const ly = (size - logoSize) / 2;
    const pad = 5;
    const br = s.logoBorderRadius;

    // Background
    ctx.fillStyle = s.logoBackgroundColor;
    drawRoundedRect(ctx, lx - pad, ly - pad, logoSize + pad * 2, logoSize + pad * 2, br + pad / 2);
    ctx.fill();

    try {
      const img = await loadImage(s.logoImage);
      ctx.save();
      ctx.beginPath();
      drawRoundedRect(ctx, lx, ly, logoSize, logoSize, br);
      ctx.clip();
      ctx.drawImage(img, lx, ly, logoSize, logoSize);
      ctx.restore();
    } catch {
      // logo load failed – silent
    }
  }

  return canvas.toDataURL("image/png");
}

/**
 * Returns Uint8Array PNG bytes for use in pdf-lib.
 */
export async function generateStyledQRBytes(text, style = {}, size = 300) {
  const dataUrl = await generateStyledQR(text, style, size);
  const res = await fetch(dataUrl);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Simple (fast) data URL without custom style (fallback).
 */
export async function generateSimpleQRDataUrl(text, size = 300) {
  return QRCode.toDataURL(text || "https://example.com", {
    width: size,
    margin: 1,
    errorCorrectionLevel: "H",
  });
}
