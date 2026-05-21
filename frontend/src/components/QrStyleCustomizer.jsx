import { useRef, useEffect, useCallback, useState } from "react";
import QRCode from "qrcode";

function ToggleBtn({ checked, onChange, testId }) {
  return (
    <button data-testid={testId} onClick={() => onChange(!checked)}
      className={`w-10 h-5 rounded-full transition-all relative ${checked ? "bg-cyan-400" : "bg-white/20"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-5" : "left-0.5"}`} />
    </button>
  );
}

function MiniColor({ value, onChange, testId }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={value || "#000000"} onChange={(e) => onChange(e.target.value)}
        data-testid={testId} className="h-6 w-6 border border-white/20 rounded cursor-pointer bg-transparent p-0" />
      <span className="font-mono text-[10px] text-white/40">{value || "auto"}</span>
    </div>
  );
}

function MiniSlider({ label, value, onChange, min, max, testId }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-white/50 w-16 text-end shrink-0">{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))}
        data-testid={testId} className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer" />
      <span className="text-xs font-mono text-white/60 w-8">{value}</span>
    </div>
  );
}

/**
 * Draws a styled QR code on a canvas with all customization options.
 */
export function drawStyledQr(ctx, qrData, opts) {
  const {
    width, height, x = 0, y = 0,
    fgColor = "#000000", bgColor = "#ffffff",
    dotStyle = "square", eyeColor = "",
    useGradient = false, gradientColor1 = "#000000", gradientColor2 = "#0066ff", gradientType = "linear",
    frame = false, frameColor = "#000000", frameWidth = 2,
    bgShape = "none",
    logoImg = null, logoSize = 20,
    fgImage = null,
  } = opts;

  const hasLogo = !!logoImg;
  const safeLogoSize = hasLogo ? Math.min(logoSize, 25) : 0;

  const qr = QRCode.create(qrData || "SAMPLE", { errorCorrectionLevel: hasLogo ? "H" : "M" });
  const modules = qr.modules;
  const size = modules.size;
  const margin = 1;
  const total = size + margin * 2;
  const cellW = width / total;
  const cellH = height / total;

  // Finder pattern positions
  const finderPositions = [
    { r: 0, c: 0 },
    { r: 0, c: size - 7 },
    { r: size - 7, c: 0 },
  ];

  const isFinderCell = (row, col) => {
    for (const fp of finderPositions) {
      if (row >= fp.r && row < fp.r + 7 && col >= fp.c && col < fp.c + 7) return true;
    }
    return false;
  };

  // =========== Background shape + clip ===========
  ctx.save();
  if (bgShape === "circle") {
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height / 2, width / 2, 0, Math.PI * 2);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.clip();
  } else if (bgShape === "rounded") {
    const r = width * 0.08;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, r);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.clip();
  } else {
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, width, height);
  }

  // =========== fgImage mode: image background + white mask on empty cells ===========
  if (fgImage) {
    // 1. Draw the image stretched to fill the QR area
    ctx.drawImage(fgImage, x, y, width, height);

    // 2. Paint bgColor over every cell that is NOT a module (erase non-QR areas)
    ctx.fillStyle = bgColor;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!modules.get(r, c)) {
          const cx = x + (c + margin) * cellW;
          const cy = y + (r + margin) * cellH;
          ctx.fillRect(cx, cy, cellW, cellH);
        }
      }
    }
    // 3. Paint bgColor over the quiet-zone margins
    ctx.fillStyle = bgColor;
    // Top margin
    ctx.fillRect(x, y, width, margin * cellH);
    // Bottom margin
    ctx.fillRect(x, y + height - margin * cellH, width, margin * cellH);
    // Left margin
    ctx.fillRect(x, y, margin * cellW, height);
    // Right margin
    ctx.fillRect(x + width - margin * cellW, y, margin * cellW, height);

    // 4. Re-draw finder patterns clearly on top (critical for readability)
    for (const fp of finderPositions) {
      const fx = x + (fp.c + margin) * cellW;
      const fy = y + (fp.r + margin) * cellH;
      const fw = cellW * 7;
      const fh = cellH * 7;

      // Clear finder area first, then redraw with image-sampled color
      // Sample dominant color from the image at the finder position
      const tmpC2 = document.createElement("canvas");
      tmpC2.width = 1; tmpC2.height = 1;
      const tmpCtx2 = tmpC2.getContext("2d");
      const srcX = (fp.c + margin) / total;
      const srcY = (fp.r + margin) / total;
      tmpCtx2.drawImage(fgImage, srcX * fgImage.naturalWidth, srcY * fgImage.naturalHeight, fgImage.naturalWidth * 7 / total, fgImage.naturalHeight * 7 / total, 0, 0, 1, 1);
      const pixel = tmpCtx2.getImageData(0, 0, 1, 1).data;
      const sampledColor = `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;

      const finderColor = eyeColor || sampledColor;

      if (dotStyle === "dots") {
        ctx.fillStyle = finderColor;
        ctx.beginPath(); ctx.arc(fx + fw / 2, fy + fh / 2, fw / 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = bgColor;
        ctx.beginPath(); ctx.arc(fx + fw / 2, fy + fh / 2, fw / 2 - cellW, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = finderColor;
        ctx.beginPath(); ctx.arc(fx + fw / 2, fy + fh / 2, cellW * 1.5, 0, Math.PI * 2); ctx.fill();
      } else if (dotStyle === "rounded") {
        const rr = cellW * 0.8;
        ctx.fillStyle = finderColor;
        ctx.beginPath(); ctx.roundRect(fx, fy, fw, fh, rr); ctx.fill();
        ctx.fillStyle = bgColor;
        ctx.beginPath(); ctx.roundRect(fx + cellW, fy + cellH, fw - cellW * 2, fh - cellH * 2, rr * 0.6); ctx.fill();
        ctx.fillStyle = finderColor;
        ctx.beginPath(); ctx.roundRect(fx + cellW * 2, fy + cellH * 2, fw - cellW * 4, fh - cellH * 4, rr * 0.4); ctx.fill();
      } else {
        ctx.fillStyle = finderColor;
        ctx.fillRect(fx, fy, fw, fh);
        ctx.fillStyle = bgColor;
        ctx.fillRect(fx + cellW, fy + cellH, fw - cellW * 2, fh - cellH * 2);
        ctx.fillStyle = finderColor;
        ctx.fillRect(fx + cellW * 2, fy + cellH * 2, fw - cellW * 4, fh - cellH * 4);
      }
    }

    // 5. Apply per-cell solid sampled color for every data module — including
    //    "square" style. This is critical for readability: sampling the image
    //    once per cell keeps the QR pattern crisp instead of bleeding fine
    //    image detail across multiple modules (which made the QR shape
    //    unreadable and chaotic).
    {
      // Downsample the image to one pixel per QR cell in a single pass.
      const sampleCanvas = document.createElement("canvas");
      sampleCanvas.width = total;
      sampleCanvas.height = total;
      const sampleCtx = sampleCanvas.getContext("2d");
      sampleCtx.imageSmoothingEnabled = true;
      sampleCtx.drawImage(fgImage, 0, 0, total, total);
      const sampled = sampleCtx.getImageData(0, 0, total, total).data;

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (!modules.get(r, c)) continue;
          if (isFinderCell(r, c)) continue;
          const cx = x + (c + margin) * cellW;
          const cy = y + (r + margin) * cellH;
          // Clear the cell back to bg first (erase the underlying full image)
          ctx.fillStyle = bgColor;
          ctx.fillRect(cx, cy, cellW, cellH);

          const sIdx = ((r + margin) * total + (c + margin)) * 4;
          ctx.fillStyle = `rgb(${sampled[sIdx]},${sampled[sIdx + 1]},${sampled[sIdx + 2]})`;

          if (dotStyle === "dots") {
            ctx.beginPath();
            ctx.arc(cx + cellW / 2, cy + cellH / 2, cellW * 0.46, 0, Math.PI * 2);
            ctx.fill();
          } else if (dotStyle === "rounded") {
            const rr = cellW * 0.35;
            ctx.beginPath();
            ctx.roundRect(cx + cellW * 0.05, cy + cellH * 0.05, cellW * 0.9, cellH * 0.9, rr);
            ctx.fill();
          } else {
            // square — fill the full cell so the QR pattern is crisp & scannable
            ctx.fillRect(cx, cy, cellW, cellH);
          }
        }
      }
    }

  } else {
    // =========== Normal mode (solid / gradient) ===========
    let fillStyle;
    if (useGradient) {
      if (gradientType === "radial") {
        fillStyle = ctx.createRadialGradient(x + width / 2, y + height / 2, 0, x + width / 2, y + height / 2, width / 2);
      } else {
        fillStyle = ctx.createLinearGradient(x, y, x + width, y + height);
      }
      fillStyle.addColorStop(0, gradientColor1);
      fillStyle.addColorStop(1, gradientColor2);
    } else {
      fillStyle = fgColor;
    }

    const realEyeColor = eyeColor || (useGradient ? gradientColor1 : fgColor);

    // Draw finder patterns
    for (const fp of finderPositions) {
      const fx = x + (fp.c + margin) * cellW;
      const fy = y + (fp.r + margin) * cellH;
      const fw = cellW * 7;
      const fh = cellH * 7;

      ctx.fillStyle = realEyeColor;
      if (dotStyle === "dots") {
        ctx.beginPath(); ctx.arc(fx + fw / 2, fy + fh / 2, fw / 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = bgColor;
        ctx.beginPath(); ctx.arc(fx + fw / 2, fy + fh / 2, fw / 2 - cellW, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = realEyeColor;
        ctx.beginPath(); ctx.arc(fx + fw / 2, fy + fh / 2, cellW * 1.5, 0, Math.PI * 2); ctx.fill();
      } else if (dotStyle === "rounded") {
        const rr = cellW * 0.8;
        ctx.beginPath(); ctx.roundRect(fx, fy, fw, fh, rr); ctx.fill();
        ctx.fillStyle = bgColor;
        ctx.beginPath(); ctx.roundRect(fx + cellW, fy + cellH, fw - cellW * 2, fh - cellH * 2, rr * 0.6); ctx.fill();
        ctx.fillStyle = realEyeColor;
        ctx.beginPath(); ctx.roundRect(fx + cellW * 2, fy + cellH * 2, fw - cellW * 4, fh - cellH * 4, rr * 0.4); ctx.fill();
      } else {
        ctx.fillRect(fx, fy, fw, fh);
        ctx.fillStyle = bgColor;
        ctx.fillRect(fx + cellW, fy + cellH, fw - cellW * 2, fh - cellH * 2);
        ctx.fillStyle = realEyeColor;
        ctx.fillRect(fx + cellW * 2, fy + cellH * 2, fw - cellW * 4, fh - cellH * 4);
      }
    }

    // Draw data modules
    ctx.fillStyle = fillStyle;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!modules.get(r, c)) continue;
        if (isFinderCell(r, c)) continue;
        const cx = x + (c + margin) * cellW;
        const cy = y + (r + margin) * cellH;
        if (dotStyle === "dots") {
          ctx.beginPath();
          ctx.arc(cx + cellW / 2, cy + cellH / 2, cellW * 0.42, 0, Math.PI * 2);
          ctx.fill();
        } else if (dotStyle === "rounded") {
          const rr = cellW * 0.35;
          ctx.beginPath();
          ctx.roundRect(cx + cellW * 0.05, cy + cellH * 0.05, cellW * 0.9, cellH * 0.9, rr);
          ctx.fill();
        } else {
          ctx.fillRect(cx, cy, cellW, cellH);
        }
      }
    }
  }

  // Frame
  if (frame) {
    ctx.strokeStyle = frameColor;
    ctx.lineWidth = frameWidth;
    if (bgShape === "circle") {
      ctx.beginPath();
      ctx.arc(x + width / 2, y + height / 2, width / 2 - frameWidth / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else if (bgShape === "rounded") {
      ctx.beginPath();
      ctx.roundRect(x + frameWidth / 2, y + frameWidth / 2, width - frameWidth, height - frameWidth, width * 0.08);
      ctx.stroke();
    } else {
      ctx.strokeRect(x + frameWidth / 2, y + frameWidth / 2, width - frameWidth, height - frameWidth);
    }
  }

  // Logo overlay — clear a generous area + draw logo
  if (hasLogo) {
    const logoDim = width * (safeLogoSize / 100);
    const lx = x + (width - logoDim) / 2;
    const ly = y + (height - logoDim) / 2;
    // Generous padding (20% of logo) to clear enough QR modules
    const pad = logoDim * 0.2;
    ctx.fillStyle = bgColor;
    if (dotStyle === "dots") {
      ctx.beginPath();
      ctx.arc(lx + logoDim / 2, ly + logoDim / 2, logoDim / 2 + pad, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const rr = pad * 0.6;
      ctx.beginPath();
      ctx.roundRect(lx - pad, ly - pad, logoDim + pad * 2, logoDim + pad * 2, rr);
      ctx.fill();
    }
    ctx.drawImage(logoImg, lx, ly, logoDim, logoDim);
  }

  ctx.restore();
}

/**
 * Generates a QR image (Uint8Array) with custom styles. Used by cardProcessor.
 * Returns { bytes, isJpeg } — JPEG for styled QR (small), PNG for simple.
 */
export async function generateStyledQrPng(text, width, qrConfig, logoImgElement, fgImgElement) {
  // Use 128px for PDF — QR is perfectly readable at this size
  const renderSize = 128;
  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(renderSize, renderSize)
    : document.createElement("canvas");
  if (canvas.width !== undefined) { canvas.width = renderSize; canvas.height = renderSize; }
  const ctx = canvas.getContext("2d");

  drawStyledQr(ctx, text, {
    width: renderSize, height: renderSize, x: 0, y: 0,
    fgColor: qrConfig.qr_fg_color || "#000000",
    bgColor: qrConfig.qr_bg_color || "#ffffff",
    dotStyle: qrConfig.qr_dot_style || "square",
    eyeColor: qrConfig.qr_eye_color || "",
    useGradient: qrConfig.qr_use_gradient || false,
    gradientColor1: qrConfig.qr_gradient_color1 || "#000000",
    gradientColor2: qrConfig.qr_gradient_color2 || "#0066ff",
    gradientType: qrConfig.qr_gradient_type || "linear",
    frame: qrConfig.qr_frame || false,
    frameColor: qrConfig.qr_frame_color || "#000000",
    frameWidth: (qrConfig.qr_frame_width || 2) * (renderSize / 200),
    bgShape: qrConfig.qr_bg_shape || "none",
    logoImg: logoImgElement || null,
    logoSize: qrConfig.qr_logo_size || 20,
    fgImage: fgImgElement || null,
  });

  // Use JPEG with compression for much smaller PDF output
  let blob;
  if (canvas.convertToBlob) {
    blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.7 });
  } else {
    blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.7));
  }
  const buffer = await blob.arrayBuffer();
  return { bytes: new Uint8Array(buffer), isJpeg: true };
}

/* ======================== QR STYLE CUSTOMIZER COMPONENT ======================== */
export default function QrStyleCustomizer({ config, updateConfig, t, compact = false }) {
  const canvasRef = useRef(null);
  const logoImgRef = useRef(null);
  const logoInputRef = useRef(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(null);
  const fgImgRef = useRef(null);
  const fgImgInputRef = useRef(null);
  const [fgImgPreviewUrl, setFgImgPreviewUrl] = useState(null);

  // Load logo image element when file changes
  useEffect(() => {
    if (!config.qr_logo) {
      logoImgRef.current = null;
      setLogoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(config.qr_logo);
    setLogoPreviewUrl(url);
    const img = new Image();
    img.onload = () => { logoImgRef.current = img; };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [config.qr_logo]);

  // Load fg texture image element when file changes
  useEffect(() => {
    if (!config.qr_fg_image) {
      fgImgRef.current = null;
      setFgImgPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(config.qr_fg_image);
    setFgImgPreviewUrl(url);
    const img = new Image();
    img.onload = () => { fgImgRef.current = img; };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [config.qr_fg_image]);

  // Draw QR preview
  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dim = 280;
    canvas.width = dim;
    canvas.height = dim;

    ctx.clearRect(0, 0, dim, dim);

    // Checkerboard bg for transparency
    const checkSize = 8;
    for (let ry = 0; ry < dim; ry += checkSize) {
      for (let rx = 0; rx < dim; rx += checkSize) {
        ctx.fillStyle = ((rx / checkSize + ry / checkSize) % 2 === 0) ? "#1a1a2e" : "#16162a";
        ctx.fillRect(rx, ry, checkSize, checkSize);
      }
    }

    const pad = 20;
    drawStyledQr(ctx, "https://example.com/sample", {
      width: dim - pad * 2, height: dim - pad * 2, x: pad, y: pad,
      fgColor: config.qr_fg_color || "#000000",
      bgColor: config.qr_bg_color || "#ffffff",
      dotStyle: config.qr_dot_style || "square",
      eyeColor: config.qr_eye_color || "",
      useGradient: config.qr_use_gradient || false,
      gradientColor1: config.qr_gradient_color1 || "#000000",
      gradientColor2: config.qr_gradient_color2 || "#0066ff",
      gradientType: config.qr_gradient_type || "linear",
      frame: config.qr_frame || false,
      frameColor: config.qr_frame_color || "#000000",
      frameWidth: config.qr_frame_width || 2,
      bgShape: config.qr_bg_shape || "none",
      logoImg: logoImgRef.current,
      logoSize: config.qr_logo_size || 20,
      fgImage: fgImgRef.current,
    });
  }, [config]);

  useEffect(() => {
    const timer = setTimeout(drawPreview, 50);
    return () => clearTimeout(timer);
  }, [drawPreview, logoPreviewUrl, fgImgPreviewUrl]);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    updateConfig("qr_logo", file);
    e.target.value = "";
  };

  const removeLogo = () => {
    updateConfig("qr_logo", null);
    logoImgRef.current = null;
    setLogoPreviewUrl(null);
  };

  const handleFgImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    updateConfig("qr_fg_image", file);
    e.target.value = "";
  };

  const removeFgImage = () => {
    updateConfig("qr_fg_image", null);
    fgImgRef.current = null;
    setFgImgPreviewUrl(null);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4" data-testid="qr-style-section">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.2em] text-white/60 font-bold flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {t.qrStyle}
        </span>
      </div>

      <div className={`grid gap-4 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
        {/* Left: Controls */}
        <div className="space-y-3">
          {/* Colors */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/50 font-semibold">{t.qrFgColor}</span>
              <MiniColor value={config.qr_fg_color} onChange={(v) => updateConfig("qr_fg_color", v)} testId="qr-fg-color" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/50 font-semibold">{t.qrBgColor}</span>
              <MiniColor value={config.qr_bg_color} onChange={(v) => updateConfig("qr_bg_color", v)} testId="qr-bg-color" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/50 font-semibold">{t.qrEyeColor}</span>
              <div className="flex items-center gap-2">
                <MiniColor value={config.qr_eye_color || config.qr_fg_color} onChange={(v) => updateConfig("qr_eye_color", v)} testId="qr-eye-color" />
                {config.qr_eye_color && (
                  <button onClick={() => updateConfig("qr_eye_color", "")} className="text-[9px] text-white/30 hover:text-white/60" data-testid="qr-eye-color-reset">reset</button>
                )}
              </div>
            </div>
          </div>

          {/* Dot Style */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
            <span className="text-[11px] text-white/50 font-semibold block mb-2">{t.qrDotStyle}</span>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { value: "square", label: t.qrDotSquare },
                { value: "dots", label: t.qrDotDots },
                { value: "rounded", label: t.qrDotRounded },
              ].map((opt) => (
                <button key={opt.value} data-testid={`qr-dot-${opt.value}`}
                  onClick={() => updateConfig("qr_dot_style", opt.value)}
                  className={`rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition-all ${
                    config.qr_dot_style === opt.value
                      ? "border-cyan-400/60 bg-cyan-400/10 text-white"
                      : "border-white/10 text-white/50 hover:border-white/20"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Gradient */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/50 font-semibold">{t.qrGradient}</span>
              <ToggleBtn checked={config.qr_use_gradient} onChange={(v) => { updateConfig("qr_use_gradient", v); if (v) updateConfig("qr_fg_image", null); }} testId="qr-gradient-toggle" />
            </div>
            {config.qr_use_gradient && !config.qr_fg_image && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40">{t.qrGradientColor1}</span>
                  <MiniColor value={config.qr_gradient_color1} onChange={(v) => updateConfig("qr_gradient_color1", v)} testId="qr-grad-c1" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40">{t.qrGradientColor2}</span>
                  <MiniColor value={config.qr_gradient_color2} onChange={(v) => updateConfig("qr_gradient_color2", v)} testId="qr-grad-c2" />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {["linear", "radial"].map((gt) => (
                    <button key={gt} data-testid={`qr-grad-${gt}`}
                      onClick={() => updateConfig("qr_gradient_type", gt)}
                      className={`rounded-lg border px-2 py-1 text-[10px] font-semibold transition-all ${
                        config.qr_gradient_type === gt
                          ? "border-cyan-400/60 bg-cyan-400/10 text-white"
                          : "border-white/10 text-white/50 hover:border-white/20"}`}>
                      {gt === "linear" ? t.qrGradientLinear : t.qrGradientRadial}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Texture / Background Image Fill */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/50 font-semibold">{t.qrFgImage}</span>
              {config.qr_fg_image ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-emerald-300 truncate max-w-[80px]">{config.qr_fg_image.name}</span>
                  <button onClick={removeFgImage} data-testid="qr-fgimg-remove"
                    className="text-[9px] text-rose-300 hover:text-rose-200 font-semibold">{t.qrRemoveLogo}</button>
                </div>
              ) : (
                <button onClick={() => fgImgInputRef.current?.click()} data-testid="qr-fgimg-upload-btn"
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold">{t.qrFgImageUpload}</button>
              )}
            </div>
            <p className="text-[9px] text-white/30">{t.qrFgImageHint}</p>
            {fgImgPreviewUrl && (
              <img src={fgImgPreviewUrl} alt="" className="h-10 w-full object-cover rounded-md border border-white/10" />
            )}
            <input ref={fgImgInputRef} type="file" accept="image/*" className="hidden"
              data-testid="qr-fgimg-input" onChange={handleFgImageUpload} />
          </div>

          {/* BG Shape */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
            <span className="text-[11px] text-white/50 font-semibold block mb-2">{t.qrBgShape}</span>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { value: "none", label: t.qrBgNone },
                { value: "rounded", label: t.qrBgRounded },
                { value: "circle", label: t.qrBgCircle },
              ].map((opt) => (
                <button key={opt.value} data-testid={`qr-bg-${opt.value}`}
                  onClick={() => updateConfig("qr_bg_shape", opt.value)}
                  className={`rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition-all ${
                    config.qr_bg_shape === opt.value
                      ? "border-cyan-400/60 bg-cyan-400/10 text-white"
                      : "border-white/10 text-white/50 hover:border-white/20"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Frame */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/50 font-semibold">{t.qrFrame}</span>
              <ToggleBtn checked={config.qr_frame} onChange={(v) => updateConfig("qr_frame", v)} testId="qr-frame-toggle" />
            </div>
            {config.qr_frame && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40">{t.qrFrameColor}</span>
                  <MiniColor value={config.qr_frame_color} onChange={(v) => updateConfig("qr_frame_color", v)} testId="qr-frame-color" />
                </div>
                <MiniSlider label={t.qrFrameWidth} value={config.qr_frame_width} onChange={(v) => updateConfig("qr_frame_width", v)} min={1} max={8} testId="qr-frame-width" />
              </div>
            )}
          </div>

          {/* Logo */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/50 font-semibold">{t.qrLogo}</span>
              {config.qr_logo ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-emerald-300 truncate max-w-[80px]">{config.qr_logo.name}</span>
                  <button onClick={removeLogo} data-testid="qr-logo-remove"
                    className="text-[9px] text-rose-300 hover:text-rose-200 font-semibold">{t.qrRemoveLogo}</button>
                </div>
              ) : (
                <button onClick={() => logoInputRef.current?.click()} data-testid="qr-logo-upload-btn"
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold">{t.qrLogoUpload}</button>
              )}
            </div>
            {config.qr_logo && (
              <MiniSlider label={t.qrLogoSize} value={config.qr_logo_size} onChange={(v) => updateConfig("qr_logo_size", v)} min={5} max={25} testId="qr-logo-size" />
            )}
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
              data-testid="qr-logo-input" onChange={handleLogoUpload} />
          </div>
        </div>

        {/* Right: Live QR Preview */}
        <div className="flex flex-col items-center gap-2 min-w-0">
          <span className="text-[11px] text-white/40 font-semibold">{t.qrStylePreview}</span>
          <div className="rounded-xl border border-white/10 bg-[#0d0d18] p-2 w-full max-w-[280px]" data-testid="qr-style-preview-wrapper">
            <canvas ref={canvasRef} width={280} height={280}
              className="rounded-lg block w-full h-auto"
              style={{ aspectRatio: "1 / 1" }}
              data-testid="qr-style-preview-canvas" />
          </div>
          {logoPreviewUrl && (
            <div className="flex items-center gap-2 mt-1">
              <img src={logoPreviewUrl} alt="logo" className="h-6 w-6 rounded object-cover border border-white/10" />
              <span className="text-[10px] text-white/30">{t.qrLogo}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
