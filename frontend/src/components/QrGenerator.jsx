import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  processPdfs,
  downloadBlob,
  PHASES,
  CancelToken,
  isCancelledError,
} from "@/lib/pdfProcessor";
import QrStyleCustomizer, { drawStyledQr } from "@/components/QrStyleCustomizer";
import QRCode from "qrcode";

/* ----------------------------- File drop zone ----------------------------- */
const Dropzone = ({ title, hint, files, onFiles, onRemove, t, testId, accent, disabled, multiple = false }) => {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  const handle = (fileList) => {
    if (!fileList || fileList.length === 0 || disabled) return;
    const validFiles = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith(".pdf"));
    if (validFiles.length === 0) return;
    // Always append; parent decides accumulation vs replace
    onFiles(multiple ? validFiles : [validFiles[0]]);
  };

  const fileArr = files || [];

  return (
    <div
      data-testid={testId}
      onDragOver={(e) => { if (disabled) return; e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { if (disabled) return; e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }}
      onClick={(e) => {
        if (e.target.closest("[data-remove-btn]")) return;
        if (!disabled) inputRef.current?.click();
      }}
      className={`group relative rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-all ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-white/[0.04] hover:border-white/20"
      } ${over ? "border-cyan-400/60 bg-cyan-400/5" : ""}`}
    >
      <div className="flex items-start gap-4">
        <div className={`h-12 w-12 shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br ${accent} shadow-lg shadow-black/40`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M14 2v6h6" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M9 14h6M9 18h4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-white font-semibold text-base">{title}</h3>
            <span className="text-[10px] tracking-[0.2em] uppercase text-white/40">PDF{multiple ? " ×N" : ""}</span>
          </div>
          <p className="text-sm text-white/50 mt-1">{hint}</p>
          {fileArr.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              {fileArr.map((f, i) => (
                <div key={i} data-testid={`${testId}-selected-${i}`} className="flex items-center gap-2 rounded-lg bg-emerald-400/10 border border-emerald-400/30 px-3 py-2">
                  <span className="text-emerald-300 text-sm font-medium truncate" title={f.name}>
                    ✓ {f.name}
                  </span>
                  <span className="text-emerald-200/60 text-xs ms-2">{(f.size / 1024).toFixed(1)} KB</span>
                  {onRemove && (
                    <button
                      data-remove-btn="true"
                      data-testid={`${testId}-remove-${i}`}
                      onClick={(e) => { e.stopPropagation(); onRemove(i); }}
                      className="ms-auto flex-shrink-0 h-5 w-5 rounded-full bg-rose-400/20 border border-rose-400/40 text-rose-300 hover:bg-rose-400/40 transition flex items-center justify-center"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              {multiple && (
                <div className="mt-1 text-xs text-white/40 text-center">+ أضف ملفات إضافية</div>
              )}
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-3 text-xs text-white/40">
              <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10">{t.dropHere}</span>
              <span>{t.or}</span>
              <span className="text-white/70 underline underline-offset-4">{t.browse}</span>
            </div>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple={multiple} className="hidden" disabled={disabled}
        onChange={(e) => { handle(e.target.files); e.target.value = ""; }} data-testid={`${testId}-input`} />
    </div>
  );
};

/* ------------------------------- Number Input ------------------------------ */
const NumberField = ({ label, value, onChange, testId, min = 1, max = 999, disabled }) => (
  <div className="flex flex-col gap-2">
    <label className="text-[12px] uppercase tracking-[0.18em] text-white/50 font-medium">{label}</label>
    <input type="number" min={min} max={max} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} data-testid={testId}
      className="bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white text-lg font-mono tracking-wider focus:outline-none focus:border-cyan-400/50 focus:bg-white/[0.06] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    />
  </div>
);

/* ------------------------------ Phase Stepper ----------------------------- */
const PHASE_ORDER = [PHASES.EXTRACTING, PHASES.GENERATING_QR, PHASES.LAYOUT, PHASES.MERGING, PHASES.SAVING];

const phaseLabel = (t, phase) => {
  switch (phase) {
    case PHASES.EXTRACTING: return t.phaseExtracting;
    case PHASES.GENERATING_QR: return t.phaseGeneratingQr;
    case PHASES.LAYOUT: return t.phaseLayout;
    case PHASES.MERGING: return t.phaseMerging;
    case PHASES.SAVING: return t.phaseSaving;
    case PHASES.DONE: return t.phaseDone;
    default: return t.ready;
  }
};

const PhaseStepper = ({ t, currentPhase, completed }) => {
  const currentIdx = PHASE_ORDER.indexOf(currentPhase);
  return (
    <div className="grid grid-cols-5 gap-1.5" data-testid="qr-phase-stepper">
      {PHASE_ORDER.map((p, idx) => {
        const isDone = completed || idx < currentIdx;
        const isActive = !completed && idx === currentIdx;
        return (
          <div key={p} data-testid={`qr-phase-${p}`} data-state={isDone ? "done" : isActive ? "active" : "pending"} className="flex flex-col items-center gap-1.5">
            <div className={`h-1 w-full rounded-full transition-all ${isDone ? "bg-emerald-400/80" : isActive ? "bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 animate-pulse" : "bg-white/10"}`} />
            <span className={`text-[10px] text-center leading-tight ${isDone ? "text-emerald-300/80" : isActive ? "text-white" : "text-white/30"}`}>{phaseLabel(t, p)}</span>
          </div>
        );
      })}
    </div>
  );
};

/* --------------------------- QR Preview Modal ---------------------------- */
const QrPreviewModal = ({ open, onClose, designPdf, cols, rows, qrStyle, t, lang }) => {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);

  useEffect(() => {
    if (!open || !designPdf || !canvasRef.current) return;
    
    const drawPreview = async () => {
      setLoading(true);
      setPreviewReady(false);
      
      try {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        
        // A4 dimensions scaled down
        const scale = 0.5;
        const w = 595.28 * scale;
        const h = 841.89 * scale;
        canvas.width = w;
        canvas.height = h;
        
        // Clear canvas with dark background
        ctx.fillStyle = "#0d0d18";
        ctx.fillRect(0, 0, w, h);
        
        // Load design PDF first page as image
        const pdfData = await designPdf.arrayBuffer();
        const pdfjs = await import("pdfjs-dist/build/pdf");
        const pdf = await pdfjs.getDocument({ data: pdfData }).promise;
        const page = await pdf.getPage(1);
        
        // Render design PDF page
        const viewport = page.getViewport({ scale: scale });
        await page.render({
          canvasContext: ctx,
          viewport: viewport,
        }).promise;
        
        // Draw QR grid overlay
        const cw = w / cols;
        const ch = h / rows;
        const qrDim = Math.min(cw, ch);
        
        // Generate sample QR
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
        
        // Load logo and fg image if present
        let logoImg = null;
        let fgImg = null;
        
        if (qrStyle.qr_logo) {
          logoImg = await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = URL.createObjectURL(qrStyle.qr_logo);
          });
        }
        
        if (qrStyle.qr_fg_image) {
          fgImg = await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = URL.createObjectURL(qrStyle.qr_fg_image);
          });
        }
        
        // Draw sample QR codes in each grid cell
        const totalCards = Math.min(cols * rows, 8); // Show max 8 for preview
        for (let index = 0; index < totalCards; index++) {
          const colIdx = index % cols;
          const rowIdx = Math.floor(index / cols);
          const x = (cols - 1 - colIdx) * cw;
          const y = h - (rowIdx + 1) * ch;
          
          // Draw semi-transparent overlay to show QR position
          ctx.save();
          ctx.globalAlpha = 0.85;
          
          if (hasCustomStyle) {
            // Draw styled QR
            drawStyledQr(ctx, `SAMPLE-${index + 1}`, {
              width: qrDim,
              height: qrDim,
              x: x,
              y: y,
              fgColor: qrStyle.qr_fg_color || "#000000",
              bgColor: qrStyle.qr_bg_color || "#ffffff",
              dotStyle: qrStyle.qr_dot_style || "square",
              eyeColor: qrStyle.qr_eye_color || "",
              useGradient: qrStyle.qr_use_gradient || false,
              gradientColor1: qrStyle.qr_gradient_color1 || "#000000",
              gradientColor2: qrStyle.qr_gradient_color2 || "#0066ff",
              gradientType: qrStyle.qr_gradient_type || "linear",
              frame: qrStyle.qr_frame || false,
              frameColor: qrStyle.qr_frame_color || "#000000",
              frameWidth: (qrStyle.qr_frame_width || 2) * (qrDim / 200),
              bgShape: qrStyle.qr_bg_shape || "none",
              logoImg: logoImg,
              logoSize: qrStyle.qr_logo_size || 20,
              fgImage: fgImg,
            });
          } else {
            // Draw simple QR
            const qrDataUrl = await QRCode.toDataURL(`SAMPLE-${index + 1}`, {
              width: qrDim * 2,
              margin: 1,
              errorCorrectionLevel: "M",
            });
            const qrImg = await new Promise((resolve) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.src = qrDataUrl;
            });
            ctx.drawImage(qrImg, x, y, qrDim, qrDim);
          }
          
          ctx.restore();
        }
        
        setPreviewReady(true);
      } catch (err) {
        console.error("Preview error:", err);
      } finally {
        setLoading(false);
      }
    };
    
    drawPreview();
  }, [open, designPdf, cols, rows, qrStyle]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity"
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto bg-[#0d0d18] rounded-3xl border border-white/10 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
              </svg>
              {lang === "ar" ? "معاينة QR خلف البطاقة" : "QR Behind Card Preview"}
            </h3>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6 overflow-auto max-h-[calc(90vh-80px)]">
            {loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <svg className="animate-spin h-10 w-10 text-cyan-400" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                  <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <p className="text-white/60 text-sm">{lang === "ar" ? "جاري تحميل المعاينة..." : "Loading preview..."}</p>
              </div>
            )}
            
            {!loading && (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-auto rounded-lg"
                    style={{ imageRendering: "crisp-edges" }}
                  />
                </div>
                
                {previewReady && (
                  <div className="flex items-start gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-4">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" className="text-cyan-400" />
                      <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-cyan-400" />
                    </svg>
                    <div className="text-sm text-white/70 leading-relaxed">
                      {lang === "ar" ? (
                        <>
                          <strong className="text-cyan-300">ملاحظة:</strong> هذه معاينة للصفحة الأولى فقط. QR يملأ البطاقة بالكامل كما هو موضح. الملف النهائي سيحتوي على جميع البطاقات.
                        </>
                      ) : (
                        <>
                          <strong className="text-cyan-300">Note:</strong> This is a preview of the first page only. QR fills the entire card as shown. The final file will contain all cards.
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

/* ------------------------------- QR Generator ------------------------------ */
const DEFAULT_QR_STYLE = {
  qr_fg_color: "#000000",
  qr_bg_color: "#ffffff",
  qr_dot_style: "square",
  qr_eye_color: "",
  qr_use_gradient: false,
  qr_gradient_color1: "#000000",
  qr_gradient_color2: "#0066ff",
  qr_gradient_type: "linear",
  qr_frame: false,
  qr_frame_color: "#000000",
  qr_frame_width: 2,
  qr_bg_shape: "none",
  qr_logo: null,
  qr_logo_size: 20,
  qr_fg_image: null,
};

export default function QrGenerator({ t, lang }) {
  const [sourcePdfs, setSourcePdfs] = useState([]);
  const [designPdfs, setDesignPdfs] = useState([]);
  const [server, setServer] = useState("");
  const [totalCards, setTotalCards] = useState(8);
  const [cols, setCols] = useState(2);
  const [rows, setRows] = useState(4);
  const [qrStyle, setQrStyle] = useState({ ...DEFAULT_QR_STYLE });
  const [showQrStyle, setShowQrStyle] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [status, setStatus] = useState({ phase: null, message: "", percent: 0, current: 0, total: 0, workers: 0 });
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const cancelTokenRef = useRef(null);

  const updateQrStyle = useCallback((key, value) => {
    setQrStyle((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Append new source PDFs (don't replace)
  const addSourcePdfs = useCallback((newFiles) => {
    setSourcePdfs(prev => [...prev, ...newFiles]);
  }, []);

  const removeSourcePdf = useCallback((index) => {
    setSourcePdfs(prev => prev.filter((_, i) => i !== index));
  }, []);

  const resetAll = useCallback(() => {
    setSourcePdfs([]); setDesignPdfs([]); setServer(""); setTotalCards(8); setCols(2); setRows(4);
    setQrStyle({ ...DEFAULT_QR_STYLE });
    setStatus({ phase: null, message: "", percent: 0, current: 0, total: 0, workers: 0 });
    setProcessing(false); setResult(null); setError(""); setCancelled(false); cancelTokenRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    if (!processing || !cancelTokenRef.current) return;
    cancelTokenRef.current.cancel();
    setCancelled(true);
  }, [processing]);

  const handleStart = useCallback(async () => {
    setError(""); setResult(null); setCancelled(false);
    if (!sourcePdfs.length || !designPdfs.length || !server || !totalCards || !cols || !rows) { setError(t.errorMissing); return; }
    setProcessing(true);
    setStatus({ phase: PHASES.EXTRACTING, message: t.processing, percent: 0, current: 0, total: 0, workers: 0 });
    const cancelToken = new CancelToken();
    cancelTokenRef.current = cancelToken;
    try {
      const { pdfBytes, filename, itemsCount } = await processPdfs({
        sourcePdfFiles: sourcePdfs, designPdfFile: designPdfs[0], server: server.trim(),
        totalCards: parseInt(totalCards, 10), cols: parseInt(cols, 10), rows: parseInt(rows, 10),
        qrStyle,
        cancelToken, onProgress: (p) => setStatus((s) => ({ ...s, ...p })),
      });
      setResult({ bytes: pdfBytes, filename, count: itemsCount });
      setStatus((s) => ({ ...s, phase: PHASES.DONE, percent: 100, current: itemsCount, total: itemsCount }));
    } catch (e) {
      if (isCancelledError(e)) { resetAll(); return; }
      console.error(e); setError(e.message || t.errorGeneric);
    } finally { setProcessing(false); cancelTokenRef.current = null; }
  }, [sourcePdfs, designPdfs, server, totalCards, cols, rows, qrStyle, t, resetAll]);

  const handleDownload = () => { if (result) downloadBlob(result.bytes, result.filename); };
  const handlePreview = () => {
    if (!result) return;
    const blob = new Blob([result.bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const isDone = !!result;
  const currentPhaseLabel = status.phase ? phaseLabel(t, status.phase) : t.ready;
  const sourcePdf = sourcePdfs[0] || null;
  const designPdf = designPdfs[0] || null;

  return (
    <div className="space-y-8">
      {/* Feature row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { title: t.feature1Title, desc: t.feature1Desc, dot: "from-violet-400 to-fuchsia-400" },
          { title: t.feature2Title, desc: t.feature2Desc, dot: "from-cyan-400 to-emerald-400" },
          { title: t.feature3Title, desc: t.feature3Desc, dot: "from-fuchsia-400 to-amber-300" },
        ].map((f, i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 hover:bg-white/[0.04] transition">
            <div className={`h-1.5 w-12 rounded-full bg-gradient-to-r ${f.dot}`} />
            <h4 className="mt-4 font-semibold text-white">{f.title}</h4>
            <p className="mt-1 text-sm text-white/55 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Main work area */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Upload */}
        <div className="lg:col-span-3 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 sm:p-8 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <span className="h-6 w-1 rounded-full bg-gradient-to-b from-violet-400 to-cyan-400" />
                <h2 className="text-lg font-bold tracking-wide uppercase text-white/80">1 — PDF Files</h2>
              </div>
              {sourcePdf && designPdf && <span className="text-xs text-emerald-300/80">● Ready</span>}
            </div>
            <div className="space-y-4">
              <Dropzone title={t.stepData} hint={t.stepDataHint} files={sourcePdfs} onFiles={addSourcePdfs} onRemove={removeSourcePdf} t={t} testId="source-pdf-dropzone" accent="from-violet-500 to-fuchsia-500" disabled={processing} multiple={true} />
              <Dropzone title={t.stepDesign} hint={t.stepDesignHint} files={designPdfs} onFiles={setDesignPdfs} t={t} testId="design-pdf-dropzone" accent="from-cyan-500 to-emerald-500" disabled={processing} multiple={false} />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
            <h3 className="text-xs uppercase tracking-[0.25em] text-white/40 mb-4">{t.aboutTitle}</h3>
            <ol className="space-y-3">
              {[t.step1, t.step2, t.step3, t.step4, t.step5].map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.05] border border-white/10 text-[11px] font-bold text-white/70">{i + 1}</span>
                  <span className="text-sm text-white/65 leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Right: Settings + run */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.01] p-6 sm:p-8 sticky top-4">
            <div className="flex items-center gap-3 mb-5">
              <span className="h-6 w-1 rounded-full bg-gradient-to-b from-fuchsia-400 to-amber-300" />
              <h2 className="text-lg font-bold tracking-wide uppercase text-white/80">2 — {t.layoutTitle}</h2>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-[12px] uppercase tracking-[0.18em] text-white/50 font-medium">{t.serverLabel}</label>
                <input type="text" value={server} onChange={(e) => setServer(e.target.value)} placeholder={t.serverPlaceholder} data-testid="server-input" disabled={processing}
                  className="bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-cyan-400/50 focus:bg-white/[0.06] transition-all placeholder:text-white/30 disabled:opacity-50"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[12px] uppercase tracking-[0.18em] text-white/50 font-medium">{t.directLogin}</label>
                <div className="bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white/70 text-base min-h-[48px] flex items-center">
                  {t.directLogin}
                </div>
              </div>
              <NumberField label={t.totalCardsLabel} value={totalCards} onChange={setTotalCards} testId="total-cards-input" disabled={processing} />
              <div className="grid grid-cols-2 gap-3">
                <NumberField label={t.colsLabel} value={cols} onChange={setCols} testId="cols-input" disabled={processing} />
                <NumberField label={t.rowsLabel} value={rows} onChange={setRows} testId="rows-input" disabled={processing} />
              </div>

              {/* QR style customization toggle */}
              <button
                type="button"
                data-testid="qr-style-toggle"
                onClick={() => setShowQrStyle((v) => !v)}
                disabled={processing}
                className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] px-4 py-3 transition disabled:opacity-50"
              >
                <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/70 font-semibold">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 2v2M12 20v2M2 12h2M20 12h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  {t.qrStyle}
                </span>
                <span className={`text-white/50 transition-transform ${showQrStyle ? "rotate-180" : ""}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
              </button>
              {showQrStyle && (
                <div data-testid="qr-style-wrapper" className="min-w-0">
                  <QrStyleCustomizer config={qrStyle} updateConfig={updateQrStyle} t={t} compact={true} />
                </div>
              )}
            </div>

            <div className="mt-6"><PhaseStepper t={t} currentPhase={status.phase} completed={isDone} /></div>

            <div className="mt-5">
              <div className="flex items-center justify-between text-xs">
                <span data-testid="qr-status-label" className={`font-medium ${error ? "text-rose-300" : isDone ? "text-emerald-300" : "text-white/70"}`}>
                  {error || (isDone ? t.complete : processing ? currentPhaseLabel : t.ready)}
                </span>
                <span className="text-white/50 font-mono text-[11px]">
                  {status.total > 0 && <>{status.current} {t.of} {status.total}</>}
                  {status.phase === PHASES.GENERATING_QR && status.workers > 0 && (
                    <span className="ms-2 px-1.5 py-0.5 rounded bg-violet-400/15 border border-violet-400/30 text-violet-200">{status.workers} {t.workersLabel}</span>
                  )}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div data-testid="qr-progress-bar" className="h-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 transition-all" style={{ width: `${status.percent || 0}%` }} />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {/* Preview Button - Show before processing */}
              {!processing && designPdf && (
                <button
                  onClick={() => setShowPreview(true)}
                  data-testid="qr-preview-overlay-btn"
                  className="w-full h-12 rounded-2xl bg-cyan-400/15 border border-cyan-400/40 text-cyan-200 font-semibold flex items-center justify-center gap-2 hover:bg-cyan-400/25 transition"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  {lang === "ar" ? "معاينة QR خلف البطاقة" : "Preview QR Behind Card"}
                </button>
              )}
              
              {!processing ? (
                <button onClick={handleStart} data-testid="qr-start-btn" className="group relative w-full h-14 rounded-2xl font-bold tracking-wide overflow-hidden transition-all">
                  <span className="absolute inset-0 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400" />
                  <span className="absolute inset-0 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 opacity-0 group-hover:opacity-100 blur-xl transition-opacity" />
                  <span className="relative flex items-center justify-center gap-3 text-white text-base">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-14 9V3z" fill="white" /></svg>
                    {t.startBtn}
                  </span>
                </button>
              ) : (
                <button onClick={handleCancel} data-testid="qr-cancel-btn" disabled={cancelled}
                  className="group relative w-full h-14 rounded-2xl font-bold tracking-wide overflow-hidden transition-all disabled:opacity-60 disabled:cursor-not-allowed bg-rose-500/15 border border-rose-400/40 text-rose-200 hover:bg-rose-500/25">
                  <span className="relative flex items-center justify-center gap-3 text-base">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    {cancelled ? t.cancelled : `${t.processing} · ${t.cancelBtn}`}
                  </span>
                </button>
              )}
              {result && !processing && (
                <div className="space-y-3">
                  <button onClick={handlePreview} data-testid="qr-preview-btn" className="w-full h-12 rounded-2xl bg-violet-400/15 border border-violet-400/40 text-violet-200 font-semibold flex items-center justify-center gap-2 hover:bg-violet-400/25 transition">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /></svg>
                    {t.previewBtn}
                  </button>
                  <button onClick={handleDownload} data-testid="qr-download-btn" className="w-full h-12 rounded-2xl bg-emerald-400/15 border border-emerald-400/40 text-emerald-200 font-semibold flex items-center justify-center gap-2 hover:bg-emerald-400/25 transition">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {t.downloadBtn} · {result.count} {t.detected}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* QR Preview Modal */}
      <QrPreviewModal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        designPdf={designPdf}
        cols={parseInt(cols, 10)}
        rows={parseInt(rows, 10)}
        qrStyle={qrStyle}
        t={t}
        lang={lang}
      />
    </div>
  );
}
