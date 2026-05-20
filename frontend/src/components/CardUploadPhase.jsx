import { useRef, useState, useCallback } from "react";
import { parseDataFile, readTemplateImage } from "@/lib/dataParser";

function FileDropzone({ title, hint, formats, file, onDrop, testId, disabled, accent, acceptTypes }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  const handleFile = useCallback((f) => {
    if (!f || disabled) return;
    onDrop(f);
  }, [disabled, onDrop]);

  return (
    <div
      data-testid={testId}
      onDragOver={(e) => { if (!disabled) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { if (disabled) return; e.preventDefault(); setOver(false); handleFile(e.dataTransfer.files?.[0]); }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`group relative rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-all ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-white/[0.04] hover:border-white/20"
      } ${over ? "border-cyan-400/60 bg-cyan-400/5" : ""} ${file ? "border-emerald-400/30" : ""}`}
    >
      <div className="flex items-start gap-4">
        <div className={`h-12 w-12 shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br ${accent} shadow-lg shadow-black/40`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M14 2v6h6" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M12 12v6M9 15h6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-base">{title}</h3>
          <p className="text-sm text-white/50 mt-1">{hint}</p>
          {file ? (
            <div data-testid={`${testId}-selected`} className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-400/10 border border-emerald-400/30 px-3 py-2">
              <span className="text-emerald-300 text-sm font-medium truncate" title={file.name}>✓ {file.name}</span>
              <span className="text-emerald-200/60 text-xs ms-auto">{(file.size / 1024).toFixed(1)} KB</span>
            </div>
          ) : (
            <div className="mt-3 text-xs text-white/40">
              <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10">{formats}</span>
            </div>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept={acceptTypes} className="hidden" disabled={disabled}
        onChange={(e) => handleFile(e.target.files?.[0])} data-testid={`${testId}-input`} />
    </div>
  );
}

export default function CardUploadPhase({ t, lang, state, dispatch, onNext }) {
  const { records, dataFile, templateFile, templateDimensions, uploading } = state;

  const handleDataUpload = useCallback(async (file) => {
    dispatch({ type: "SET_DATA_FILE", payload: file });
    dispatch({ type: "SET_UPLOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });
    try {
      const parsed = await parseDataFile(file);
      if (!parsed || parsed.length === 0) {
        dispatch({ type: "SET_ERROR", payload: t.errorGeneric || "لم يتم العثور على بيانات في الملف." });
      } else {
        // Store full records in state (no backend session needed).
        dispatch({ type: "SET_SESSION", payload: "client-" + Date.now() });
        dispatch({ type: "SET_RECORDS_FULL", payload: { records: parsed, sample: parsed.slice(0, 5) } });
      }
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: err.message || t.errorGeneric });
    } finally {
      dispatch({ type: "SET_UPLOADING", payload: false });
    }
  }, [dispatch, t]);

  const handleTemplateUpload = useCallback(async (file) => {
    dispatch({ type: "SET_TEMPLATE_FILE", payload: file });
    dispatch({ type: "SET_UPLOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });
    try {
      const info = await readTemplateImage(file);
      dispatch({
        type: "SET_TEMPLATE_INFO",
        payload: { dimensions: { width: info.width, height: info.height }, url: info.url },
      });
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: err.message || t.errorGeneric });
    } finally {
      dispatch({ type: "SET_UPLOADING", payload: false });
    }
  }, [dispatch, t]);

  const canNext = records.length > 0 && templateFile && templateDimensions;
  const sampleRecords = records.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FileDropzone title={t.dataFileTitle} hint={t.dataFileHint} formats={t.supportedFormats}
          file={dataFile} onDrop={handleDataUpload} testId="card-data-dropzone" disabled={uploading}
          accent="from-violet-500 to-fuchsia-500"
          acceptTypes=".xlsx,.xls,.csv,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" />
        <FileDropzone title={t.templateTitle} hint={t.templateHint} formats={t.supportedImages}
          file={templateFile} onDrop={handleTemplateUpload} testId="card-template-dropzone" disabled={uploading || records.length === 0}
          accent="from-cyan-500 to-emerald-500"
          acceptTypes=".jpg,.jpeg,.png,image/jpeg,image/png" />
      </div>

      {/* Records Table */}
      {sampleRecords.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden" data-testid="card-records-preview">
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.2em] text-white/50 font-semibold">{t.sampleData}</span>
            <span className="px-3 py-1 rounded-full bg-gradient-to-r from-violet-500/80 to-cyan-400/80 text-white text-xs font-bold">
              {state.recordsCount} {t.recordsFound}
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-5 py-2 text-xs uppercase tracking-[0.15em] text-white/40 font-semibold text-start">#</th>
                <th className="px-5 py-2 text-xs uppercase tracking-[0.15em] text-white/40 font-semibold text-start">{t.username}</th>
                <th className="px-5 py-2 text-xs uppercase tracking-[0.15em] text-white/40 font-semibold text-start">{t.password}</th>
              </tr>
            </thead>
            <tbody>
              {sampleRecords.map((r, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="px-5 py-2 text-xs text-white/40 font-mono">{i + 1}</td>
                  <td className="px-5 py-2 text-sm text-white font-mono">{r.username}</td>
                  <td className="px-5 py-2 text-sm text-white font-mono">{r.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Template Preview */}
      {state.templateUrl && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4" data-testid="card-template-preview">
          <span className="text-xs uppercase tracking-[0.2em] text-white/50 font-semibold block mb-3">
            {t.templateTitle} — {templateDimensions?.width}×{templateDimensions?.height}px
          </span>
          <img src={state.templateUrl} alt="Template" className="max-h-48 rounded-lg border border-white/10" />
        </div>
      )}

      {/* Error display */}
      {state.error && (
        <div className="rounded-lg bg-rose-500/15 border border-rose-400/30 px-4 py-3 text-rose-300 text-sm">
          {state.error}
        </div>
      )}

      {/* Next button */}
      <div className="flex justify-end pt-4 border-t border-white/10">
        <button data-testid="card-next-to-configure-btn" disabled={!canNext} onClick={onNext}
          className="px-8 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-violet-500 to-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all">
          {t.nextBtn} →
        </button>
      </div>
    </div>
  );
}
