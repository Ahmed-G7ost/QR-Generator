import { useState, useRef } from "react";
import { generateCardsPdf, downloadPdfBlob, PHASES } from "@/lib/cardProcessor";
import { trackEvent } from "@/lib/analytics";

export default function CardGeneratePhase({ t, lang, state, dispatch, onBack, onReset }) {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const pdfBytesRef = useRef(null);

  const handleGenerate = async () => {
    setGenerating(true); setProgress(0); setResult(null); setPhase("");
    dispatch({ type: "SET_ERROR", payload: null });
    pdfBytesRef.current = null;

    try {
      const { pdfBytes, filename, totalRecords, totalPages, fileSizeKb } =
        await generateCardsPdf({
          records: state.records,
          templateFile: state.templateFile,
          config: state.config,
          customFontFile: state.config.custom_font || null,
          onProgress: (p) => {
            setPhase(p.phase);
            setProgress(p.percent ?? 0);
          },
        });
      pdfBytesRef.current = { pdfBytes, filename };
      setResult({ total_records: totalRecords, total_pages: totalPages, file_size_kb: fileSizeKb });
      trackEvent("card_generate", { records: totalRecords, pages: totalPages });
      setProgress(100);
    } catch (err) {
      console.error(err);
      dispatch({ type: "SET_ERROR", payload: err.message || t.errorGeneric });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!pdfBytesRef.current) return;
    const { pdfBytes, filename } = pdfBytesRef.current;
    downloadPdfBlob(pdfBytes, filename);
  };

  const handlePreview = () => {
    if (!pdfBytesRef.current) return;
    const blob = new Blob([pdfBytesRef.current.pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const gridParts = state.config.grid.split("x");
  const cardsPerPage = parseInt(gridParts[0]) * parseInt(gridParts[1]);
  const estimatedPages = Math.ceil(state.recordsCount / cardsPerPage);

  const phaseLabel = {
    [PHASES.PREPARING]: t.generating,
    [PHASES.RENDERING]: t.generating,
    [PHASES.SAVING]: t.generating,
    [PHASES.DONE]: t.generationComplete,
  }[phase] || t.generating;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-center">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold block mb-2">{t.totalRecords}</span>
          <span className="text-3xl font-black font-mono bg-clip-text text-transparent bg-gradient-to-r from-violet-300 to-cyan-300">{state.recordsCount}</span>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-center">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold block mb-2">{t.gridUsed}</span>
          <span className="text-3xl font-black font-mono text-white">{state.config.grid.replace("x", " × ")}</span>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-center">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold block mb-2">{t.totalPages}</span>
          <span className="text-3xl font-black font-mono text-white">{result ? result.total_pages : estimatedPages}</span>
        </div>
        {result && result.file_size_kb && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-center">
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold block mb-2">{t.fileSize}</span>
            <span className="text-2xl font-black font-mono text-emerald-300">
              {result.file_size_kb > 1024
                ? `${(result.file_size_kb / 1024).toFixed(1)} MB`
                : `${result.file_size_kb} KB`}
            </span>
          </div>
        )}
      </div>

      {/* Progress */}
      {generating && (
        <div className="space-y-2" data-testid="card-generation-progress">
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-white/50 font-mono flex items-center gap-2">
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
              <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            {phaseLabel} {progress}%
          </p>
        </div>
      )}

      {/* Result */}
      {result && !generating && (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-5 flex items-center justify-between" data-testid="card-generation-result">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-bold text-emerald-300">{t.generationComplete}</span>
          </div>
          <span className="text-xs font-mono text-emerald-200/60">
            {result.total_records} cards / {result.total_pages} pages
          </span>
        </div>
      )}

      {/* Error */}
      {state.error && (
        <div className="rounded-lg bg-rose-500/15 border border-rose-400/30 px-4 py-3 text-rose-300 text-sm">{state.error}</div>
      )}

      {/* Buttons */}
      <div className="space-y-3">
        {!result ? (
          <button data-testid="card-generate-btn" onClick={handleGenerate} disabled={generating}
            className="group relative w-full h-14 rounded-2xl font-bold tracking-wide overflow-hidden transition-all disabled:opacity-60">
            <span className="absolute inset-0 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400" />
            <span className="absolute inset-0 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 opacity-0 group-hover:opacity-100 blur-xl transition-opacity" />
            <span className="relative flex items-center justify-center gap-3 text-white text-base">
              {generating ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                  <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-14 9V3z" fill="white" /></svg>
              )}
              {generating ? t.generating : t.generateBtn}
            </span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button data-testid="card-preview-btn" onClick={handlePreview}
              className="h-12 rounded-2xl bg-violet-400/15 border border-violet-400/40 text-violet-200 font-semibold flex items-center justify-center gap-2 hover:bg-violet-400/25 transition">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /></svg>
              {t.previewBtn}
            </button>
            <button data-testid="card-download-btn" onClick={handleDownload}
              className="h-12 rounded-2xl bg-emerald-400/15 border border-emerald-400/40 text-emerald-200 font-semibold flex items-center justify-center gap-2 hover:bg-emerald-400/25 transition">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {t.downloadBtn}
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-white/10">
        <button data-testid="card-back-to-configure-btn" onClick={onBack} disabled={generating}
          className="px-6 py-3 rounded-xl font-semibold text-white/70 border border-white/15 hover:bg-white/[0.04] transition-all disabled:opacity-50">
          ← {t.backBtn}
        </button>
        <button data-testid="card-reset-btn" onClick={onReset} disabled={generating}
          className="px-6 py-3 rounded-xl font-semibold text-rose-300/80 border border-rose-400/30 hover:bg-rose-500/10 transition-all disabled:opacity-50">
          {t.resetBtn}
        </button>
      </div>
    </div>
  );
}
