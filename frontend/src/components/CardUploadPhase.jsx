import { useRef, useState, useCallback, useEffect } from "react";
import { parseDataFiles, readTemplateImage } from "@/lib/dataParser";

function FileDropzone({ title, hint, formats, files, onDrop, onRemove, testId, disabled, accent, acceptTypes, multiple }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  const handleFiles = useCallback((fileList) => {
    if (!fileList || fileList.length === 0 || disabled) return;
    const arr = Array.from(fileList);
    onDrop(multiple ? arr : [arr[0]]);
  }, [disabled, onDrop, multiple]);

  const fileArr = files || [];

  return (
    <div
      data-testid={testId}
      onDragOver={(e) => { if (!disabled) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { if (disabled) return; e.preventDefault(); setOver(false); handleFiles(e.dataTransfer.files); }}
      onClick={(e) => {
        // Don't open file picker if clicking a remove button
        if (e.target.closest("[data-remove-btn]")) return;
        if (!disabled) inputRef.current?.click();
      }}
      className={`group relative rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-all ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-white/[0.04] hover:border-white/20"
      } ${over ? "border-cyan-400/60 bg-cyan-400/5" : ""} ${fileArr.length > 0 ? "border-emerald-400/30" : ""}`}
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
          {fileArr.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              {fileArr.map((f, i) => (
                <div key={i} data-testid={`${testId}-selected-${i}`} className="flex items-center gap-2 rounded-lg bg-emerald-400/10 border border-emerald-400/30 px-3 py-2">
                  <span className="text-emerald-300 text-sm font-medium truncate" title={f.name}>✓ {f.name}</span>
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
            <div className="mt-3 text-xs text-white/40">
              <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10">{formats}</span>
            </div>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept={acceptTypes} multiple={!!multiple} className="hidden" disabled={disabled}
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} data-testid={`${testId}-input`} />
    </div>
  );
}

export default function CardUploadPhase({ t, lang, state, dispatch, onNext }) {
  const { records, templateFile, templateDimensions, uploading } = state;
  const [dataFiles, setDataFiles] = useState([]);

  // Re-process all files whenever the list changes
  useEffect(() => {
    if (dataFiles.length === 0) {
      dispatch({ type: "SET_RECORDS_FULL", payload: { records: [] } });
      dispatch({ type: "SET_DATA_FILE", payload: null });
      return;
    }
    let cancelled = false;
    const run = async () => {
      dispatch({ type: "SET_DATA_FILE", payload: dataFiles[0] });
      dispatch({ type: "SET_UPLOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });
      try {
        const parsed = await parseDataFiles(dataFiles);
        if (cancelled) return;
        if (!parsed || parsed.length === 0) {
          dispatch({ type: "SET_ERROR", payload: t.errorGeneric || "لم يتم العثور على بيانات في الملفات." });
        } else {
          dispatch({ type: "SET_SESSION", payload: "client-" + Date.now() });
          dispatch({ type: "SET_RECORDS_FULL", payload: { records: parsed } });
        }
      } catch (err) {
        if (!cancelled) dispatch({ type: "SET_ERROR", payload: err.message || t.errorGeneric });
      } finally {
        if (!cancelled) dispatch({ type: "SET_UPLOADING", payload: false });
      }
    };
    run();
    return () => { cancelled = true; };
  }, [dataFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  // Append new files to existing list
  const handleDataUpload = useCallback((newFiles) => {
    if (!newFiles || newFiles.length === 0) return;
    setDataFiles(prev => [...prev, ...newFiles]);
  }, []);

  // Remove a single file from the list
  const removeDataFile = useCallback((index) => {
    setDataFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

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
          files={dataFiles} onDrop={handleDataUpload} onRemove={removeDataFile}
          testId="card-data-dropzone" disabled={uploading}
          accent="from-violet-500 to-fuchsia-500" multiple={true}
          acceptTypes=".xlsx,.xls,.csv,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" />
        <FileDropzone title={t.templateTitle} hint={t.templateHint} formats={t.supportedImages}
          files={templateFile ? [templateFile] : []} onDrop={(arr) => handleTemplateUpload(arr[0])}
          testId="card-template-dropzone" disabled={uploading || records.length === 0}
          accent="from-cyan-500 to-emerald-500" multiple={false}
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
