import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  processPdfs,
  downloadBlob,
  PHASES,
  CancelToken,
  isCancelledError,
} from "@/lib/pdfProcessor";

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

/* ------------------------------- QR Generator ------------------------------ */
export default function QrGenerator({ t, lang }) {
  const [sourcePdfs, setSourcePdfs] = useState([]);
  const [designPdfs, setDesignPdfs] = useState([]);
  const [server, setServer] = useState("");
  const [totalCards, setTotalCards] = useState(8);
  const [cols, setCols] = useState(2);
  const [rows, setRows] = useState(4);
  const [status, setStatus] = useState({ phase: null, message: "", percent: 0, current: 0, total: 0, workers: 0 });
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const cancelTokenRef = useRef(null);

  // Append new source PDFs (don't replace)
  const addSourcePdfs = useCallback((newFiles) => {
    setSourcePdfs(prev => [...prev, ...newFiles]);
  }, []);

  const removeSourcePdf = useCallback((index) => {
    setSourcePdfs(prev => prev.filter((_, i) => i !== index));
  }, []);

  const resetAll = useCallback(() => {
    setSourcePdfs([]); setDesignPdfs([]); setServer(""); setTotalCards(8); setCols(2); setRows(4);
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
        cancelToken, onProgress: (p) => setStatus((s) => ({ ...s, ...p })),
      });
      setResult({ bytes: pdfBytes, filename, count: itemsCount });
      setStatus((s) => ({ ...s, phase: PHASES.DONE, percent: 100, current: itemsCount, total: itemsCount }));
    } catch (e) {
      if (isCancelledError(e)) { resetAll(); return; }
      console.error(e); setError(e.message || t.errorGeneric);
    } finally { setProcessing(false); cancelTokenRef.current = null; }
  }, [sourcePdfs, designPdfs, server, totalCards, cols, rows, t, resetAll]);

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
    </div>
  );
}
