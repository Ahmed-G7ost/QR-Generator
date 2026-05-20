import { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { DEFAULT_QR_STYLE } from "@/lib/qrStyler";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const QrStyleContext = createContext({
  qrStyle: DEFAULT_QR_STYLE,
  setQrStyle: () => {},
  saveQrStyle: async () => {},
  loading: false,
});

export function QrStyleProvider({ children }) {
  const [qrStyle, setQrStyle] = useState(DEFAULT_QR_STYLE);
  const [loading, setLoading] = useState(false);

  // Load from backend on mount
  useEffect(() => {
    axios
      .get(`${API}/qr-style`)
      .then((res) => setQrStyle({ ...DEFAULT_QR_STYLE, ...res.data }))
      .catch(() => {
        // Use local storage as fallback
        try {
          const stored = localStorage.getItem("qr_style_v1");
          if (stored) setQrStyle({ ...DEFAULT_QR_STYLE, ...JSON.parse(stored) });
        } catch {}
      });
  }, []);

  const saveQrStyle = useCallback(async (style) => {
    setLoading(true);
    try {
      await axios.put(`${API}/qr-style`, style);
      setQrStyle(style);
      localStorage.setItem("qr_style_v1", JSON.stringify(style));
      return true;
    } catch {
      // Fallback: save to localStorage only
      setQrStyle(style);
      localStorage.setItem("qr_style_v1", JSON.stringify(style));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <QrStyleContext.Provider value={{ qrStyle, setQrStyle, saveQrStyle, loading }}>
      {children}
    </QrStyleContext.Provider>
  );
}

export function useQrStyle() {
  return useContext(QrStyleContext);
}
