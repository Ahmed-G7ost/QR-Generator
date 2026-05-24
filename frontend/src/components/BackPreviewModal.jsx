jsx
import { useState, useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

export default function BackPreviewModal({ frontUrl, backUrl, onClose, t }) {
  const [mode, setMode] = useState("overlay"); // "front" | "back" | "overlay"
  const [opacity, setOpacity] = useState(50);
  const [loading, setLoading] = useState(true);
  const canvasFrontRef = useRef(null);
  const canvasBackRef = useRef(null);

  useEffect(() => {
    if (!frontUrl || !backUrl) return;
    
    const loadPdfToCanvas = async (url, canvas) => {
      try {
        const pdf = await pdfjsLib.getDocument(url).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        
        const context = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;
      } catch (error) {
        console.error("Error loading PDF:", error);
      }
    };

    const loadBoth = async () => {
      setLoading(true);
      await Promise.all([
        loadPdfToCanvas(frontUrl, canvasFrontRef.current),
        loadPdfToCanvas(backUrl, canvasBackRef.current),
      ]);
      setLoading(false);
    };

    loadBoth();
  }, [frontUrl, backUrl]);

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      if (frontUrl) URL.revokeObjectURL(frontUrl);
      if (backUrl) URL.revokeObjectURL(backUrl);
    };
  }, [frontUrl, backUrl]);

  // Close on ESC
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-[#0d0d18] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">{t.backPreviewTitle}</h2>
            <p className="text-sm text-white/50 mt-1">{t.backPreviewDesc}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/70 hover:text-white transition"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Controls */}
        <div className="px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Mode buttons */}
            <div className="flex gap-2" data-testid="preview-mode-controls">
              <button
                onClick={() => setMode("front")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  mode === "front"
                    ? "bg-violet-400/20 text-violet-300 border border-violet-400/40"
                    : "bg-white/[0.04] text-white/60 border border-white/10 hover:bg-white/[0.08]"
                }`}
                data-testid="mode-front"
              >
                {t.frontSide}
              </button>
              <button
                onClick={() => setMode("back")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  mode === "back"
                    ? "bg-cyan-400/20 text-cyan-300 border border-cyan-400/40"
                    : "bg-white/[0.04] text-white/60 border border-white/10 hover:bg-white/[0.08]"
                }`}
                data-testid="mode-back"
              >
                {t.backSide}
              </button>
              <button
                onClick={() => setMode("overlay")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  mode === "overlay"
                    ? "bg-emerald-400/20 text-emerald-300 border border-emerald-400/40"
                    : "bg-white/[0.04] text-white/60 border border-white/10 hover:bg-white/[0.08]"
                }`}
                data-testid="mode-overlay"
              >
                {t.overlayMode}
              </button>
            </div>

            {/* Opacity slider (only in overlay mode) */}
            {mode === "overlay" && (
              <div className="flex items-center gap-3 flex-1">
                <span className="text-xs text-white/50 whitespace-nowrap">{t.transparency}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                  data-testid="opacity-slider"
                />
                <span className="text-xs font-mono text-white/60 w-8">{opacity}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Canvas container */}
        <div className="flex-1 overflow-auto p-6 bg-[#06060c]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <svg className="animate-spin h-8 w-8 text-violet-400" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                  <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span className="text-sm text-white/50">{t.loading || "Loading..."}</span>
              </div>
            </div>
          ) : (
            <div className="relative inline-block max-w-full" style={{ direction: "ltr" }}>
              {/* Front canvas */}
              <canvas
                ref={canvasFrontRef}
                className="block max-w-full h-auto border border-white/10 rounded-lg"
                style={{
                  display: mode === "back" ? "none" : "block",
                  opacity: mode === "overlay" ? 1 : 1,
                }}
              />
              {/* Back canvas (overlay on top if overlay mode) */}
              <canvas
                ref={canvasBackRef}
                className="block max-w-full h-auto border border-white/10 rounded-lg"
                style={{
                  display: mode === "front" ? "none" : "block",
                  position: mode === "overlay" ? "absolute" : "static",
                  top: mode === "overlay" ? 0 : "auto",
                  left: mode === "overlay" ? 0 : "auto",
                  opacity: mode === "overlay" ? opacity / 100 : 1,
                  pointerEvents: mode === "overlay" ? "none" : "auto",
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>{t.backPreviewHint}</span>
            <span className="font-mono">ESC {t.toClose || "to close"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}