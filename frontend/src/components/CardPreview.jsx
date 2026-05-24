import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { drawStyledQr } from "./QrStyleCustomizer";

// Elements that can be dragged
const ELEMENTS = [
  { key: "username", labelKey: "usernameSettings" },
  { key: "password", labelKey: "passwordSettings" },
  { key: "date", labelKey: "dateSettings", condition: (c) => c.show_date && c.date_text },
  { key: "label", labelKey: "labelSettings", condition: (c) => !!c.label_text },
  { key: "qr", labelKey: "qrCode", condition: (c) => c.show_qr },
];

export default function CardPreview({ templateUrl, sampleRecord, config, onPositionChange, t }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [hovered, setHovered] = useState(null);
  const logoImgRef = useRef(null);
  const fgImgRef = useRef(null);

  // Load logo image for preview
  useEffect(() => {
    if (!config.qr_logo) { logoImgRef.current = null; return; }
    const url = URL.createObjectURL(config.qr_logo);
    const img = new window.Image();
    img.onload = () => { logoImgRef.current = img; };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [config.qr_logo]);

  // Load fg texture image for preview
  useEffect(() => {
    if (!config.qr_fg_image) { fgImgRef.current = null; return; }
    const url = URL.createObjectURL(config.qr_fg_image);
    const img = new window.Image();
    img.onload = () => { fgImgRef.current = img; };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [config.qr_fg_image]);

  const c = useMemo(() => ({
    username_font_size: config.username_font_size, password_font_size: config.password_font_size,
    date_font_size: config.date_font_size, label_font_size: config.label_font_size,
    username_x: config.username_x, username_y: config.username_y,
    password_x: config.password_x, password_y: config.password_y,
    date_x: config.date_x, date_y: config.date_y,
    label_x: config.label_x, label_y: config.label_y,
    show_date: config.show_date, date_text: config.date_text,
    label_text: config.label_text, show_counter: config.show_counter,
    username_color: config.username_color || "#000000",
    password_color: config.password_color || "#000000",
    date_color: config.date_color || "#000000",
    label_color: config.label_color || "#000000",
    show_qr: config.show_qr, qr_x: config.qr_x, qr_y: config.qr_y, qr_size: config.qr_size,
    // QR style
    qr_fg_color: config.qr_fg_color || "#000000",
    qr_bg_color: config.qr_bg_color || "#ffffff",
    qr_dot_style: config.qr_dot_style || "square",
    qr_eye_color: config.qr_eye_color || "",
    qr_use_gradient: config.qr_use_gradient || false,
    qr_gradient_color1: config.qr_gradient_color1 || "#000000",
    qr_gradient_color2: config.qr_gradient_color2 || "#0066ff",
    qr_gradient_type: config.qr_gradient_type || "linear",
    qr_frame: config.qr_frame || false,
    qr_frame_color: config.qr_frame_color || "#000000",
    qr_frame_width: config.qr_frame_width || 2,
    qr_bg_shape: config.qr_bg_shape || "none",
    qr_logo_size: config.qr_logo_size || 20,
  }), [config]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete) return;
    const ctx = canvas.getContext("2d");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    const w = canvas.width, h = canvas.height;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Helper to draw element with optional highlight
    const drawEl = (key, text, x, y, fontSize, color, bold = true) => {
      const sz = Math.max(8, Math.round(fontSize * (w / 300)));
      ctx.font = `${bold ? "bold " : ""}${sz}px "IBM Plex Sans", sans-serif`;
      ctx.fillStyle = color;
      const px = (x / 100) * w, py = (y / 100) * h;
      ctx.fillText(text, px, py);

      // Highlight if hovered or dragging
      if (hovered === key || dragging === key) {
        const metrics = ctx.measureText(text);
        const tw = metrics.width + 8;
        const th = sz + 6;
        ctx.strokeStyle = dragging === key ? "#22d3ee" : "rgba(34,211,238,0.5)";
        ctx.lineWidth = 2;
        ctx.setLineDash(dragging === key ? [] : [4, 3]);
        ctx.strokeRect(px - tw / 2, py - th / 2, tw, th);
        ctx.setLineDash([]);
      }
    };

    // Username
    drawEl("username", sampleRecord?.username || "123456789012", c.username_x, c.username_y, c.username_font_size, c.username_color);

    // Password
    drawEl("password", sampleRecord?.password || "123456", c.password_x, c.password_y, c.password_font_size, c.password_color);

    // Date
    if (c.show_date && c.date_text) {
      const dateDisplay = c.show_counter ? `${c.date_text}/1` : c.date_text;
      drawEl("date", dateDisplay, c.date_x, c.date_y, c.date_font_size, c.date_color, false);
    }

    // Label
    if (c.label_text) {
      drawEl("label", c.label_text, c.label_x, c.label_y, c.label_font_size, c.label_color);
    }

    // QR — use styled drawing
    if (c.show_qr) {
      const qrDim = Math.round(Math.min(w, h) * c.qr_size / 100);
      const qrCx = (c.qr_x / 100) * w, qrCy = (c.qr_y / 100) * h;
      const qx = qrCx - qrDim / 2, qy = qrCy - qrDim / 2;

      drawStyledQr(ctx, sampleRecord?.username || "SAMPLE123", {
        width: qrDim, height: qrDim, x: qx, y: qy,
        fgColor: c.qr_fg_color, bgColor: c.qr_bg_color,
        dotStyle: c.qr_dot_style, eyeColor: c.qr_eye_color,
        useGradient: c.qr_use_gradient,
        gradientColor1: c.qr_gradient_color1, gradientColor2: c.qr_gradient_color2,
        gradientType: c.qr_gradient_type,
        frame: c.qr_frame, frameColor: c.qr_frame_color, frameWidth: c.qr_frame_width,
        bgShape: c.qr_bg_shape,
        logoImg: logoImgRef.current, logoSize: c.qr_logo_size,
        fgImage: fgImgRef.current,
      });

      // Border highlight if hovered/dragging
      if (hovered === "qr" || dragging === "qr") {
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 2;
        ctx.strokeRect(qx, qy, qrDim, qrDim);
      }
    }
  }, [c, sampleRecord, hovered, dragging]);

  useEffect(() => {
    if (!templateUrl) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { imgRef.current = img; draw(); };
    img.src = templateUrl;
  }, [templateUrl, draw]);

  useEffect(() => { draw(); }, [draw]);

  // Find nearest element to a point
  const findElement = useCallback((px, py) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const w = canvas.width, h = canvas.height;

    const elements = [];
    elements.push({ key: "username", x: c.username_x, y: c.username_y });
    elements.push({ key: "password", x: c.password_x, y: c.password_y });
    if (c.show_date && c.date_text) elements.push({ key: "date", x: c.date_x, y: c.date_y });
    if (c.label_text) elements.push({ key: "label", x: c.label_x, y: c.label_y });
    if (c.show_qr) elements.push({ key: "qr", x: c.qr_x, y: c.qr_y });

    let closest = null, minDist = 40; // threshold in % units
    for (const el of elements) {
      const dx = px - el.x;
      const dy = py - el.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) { minDist = dist; closest = el.key; }
    }
    return closest;
  }, [c]);

  const getCanvasPercent = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.round(Math.max(0, Math.min(100, x))), y: Math.round(Math.max(0, Math.min(100, y))) };
  }, []);

  const handleMouseDown = useCallback((e) => {
    const pos = getCanvasPercent(e);
    if (!pos) return;
    const el = findElement(pos.x, pos.y);
    if (el) { setDragging(el); e.preventDefault(); }
  }, [findElement, getCanvasPercent]);

  const handleMouseMove = useCallback((e) => {
    const pos = getCanvasPercent(e);
    if (!pos) return;
    if (dragging && onPositionChange) {
      onPositionChange(`${dragging}_x`, pos.x);
      onPositionChange(`${dragging}_y`, pos.y);
    } else {
      const el = findElement(pos.x, pos.y);
      setHovered(el);
    }
  }, [dragging, findElement, getCanvasPercent, onPositionChange]);

  const handleMouseUp = useCallback(() => {
    if (dragging) setDragging(null);
  }, [dragging]);

  if (!templateUrl) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3" data-testid="card-live-preview"
      style={{
        backgroundImage: "linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.03) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.03) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.03) 75%)",
        backgroundSize: "16px 16px", backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
      }}>
      <canvas ref={canvasRef}
        className={`w-full h-auto rounded-lg border border-white/10 ${dragging ? "cursor-grabbing" : "cursor-crosshair"}`}
        data-testid="card-preview-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <p className="text-[10px] text-white/30 mt-2 text-center">
        {t?.dragHint || "Click & drag elements to reposition"}
      </p>
    </div>
  );
}

