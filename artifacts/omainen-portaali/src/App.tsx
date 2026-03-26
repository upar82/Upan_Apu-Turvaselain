import { useState, useEffect, useRef } from "react";
import { ScreenView } from "./ScreenView";

interface DeviceSettings {
  homeUrl: string;
  tutorMode: boolean;
  blockPayments: boolean;
  fontSize: "normal" | "large" | "xlarge";
}

interface VisitEntry {
  url: string;
  title?: string | null;
  ts: string;
}

interface DeviceInfo {
  deviceId: string;
  settings: DeviceSettings;
  lastSeen: string;
  currentUrl: string | null;
  visitHistory: VisitEntry[];
}

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

function formatLastSeen(isoDate: string): string {
  const d = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Juuri nyt";
  if (diffMin < 60) return `${diffMin} min sitten`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} tuntia sitten`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} päivää sitten`;
}

function formatCode(raw: string): string {
  const c = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
  if (c.length <= 4) return c;
  if (c.length <= 8) return `${c.slice(0, 4)}-${c.slice(4)}`;
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`;
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 1 ? u.pathname.slice(0, 30) : "";
    return u.hostname + path + (u.pathname.length > 30 ? "…" : "");
  } catch {
    return url.slice(0, 50);
  }
}

export default function App() {
  const [view, setView] = useState<"connect" | "settings">("connect");
  const [rawCode, setRawCode] = useState("");
  const [displayCode, setDisplayCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [settings, setSettings] = useState<DeviceSettings>({
    homeUrl: "https://www.google.fi",
    tutorMode: true,
    blockPayments: false,
    fontSize: "large",
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [showScreenView, setShowScreenView] = useState(false);
  const [connectStep, setConnectStep] = useState<1 | 2>(1);
  const [otpValue, setOtpValue] = useState("");
  const [otpExpires, setOtpExpires] = useState<Date | null>(null);
  const [otpTimeLeft, setOtpTimeLeft] = useState(0);
  const [pairingRequesting, setPairingRequesting] = useState(false);
  const [pairingConfirming, setPairingConfirming] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const savedCode = sessionStorage.getItem("upanapu_code");
    if (savedCode) {
      setRawCode(savedCode);
      setDisplayCode(formatCode(savedCode));
      void loadDevice(savedCode);
    }
  }, []);

  // Auto-refresh activity data every 30s while in settings view
  useEffect(() => {
    if (view !== "settings") {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      return;
    }
    refreshTimerRef.current = setInterval(() => {
      const code = sessionStorage.getItem("upanapu_code") ?? "";
      if (code.length === 12) refreshActivity(code);
    }, 30_000);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [view]);

  // Countdown timer for OTP step
  useEffect(() => {
    if (!otpExpires) {
      if (otpTimerRef.current) clearInterval(otpTimerRef.current);
      return;
    }
    const update = () => {
      const secs = Math.max(0, Math.round((otpExpires.getTime() - Date.now()) / 1000));
      setOtpTimeLeft(secs);
    };
    update();
    otpTimerRef.current = setInterval(update, 1000);
    return () => {
      if (otpTimerRef.current) clearInterval(otpTimerRef.current);
    };
  }, [otpExpires]);

  async function refreshActivity(digits: string) {
    try {
      const res = await fetch(`${API_BASE}/devices/${digits}/settings`);
      if (!res.ok) return;
      const data = await res.json() as DeviceInfo;
      setDeviceInfo(data);
    } catch {
      // silent
    }
  }

  async function loadDevice(digits: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/devices/${digits}/settings`);
      if (res.status === 404) {
        setError("Laitetta ei löydy. Tarkista koodi.");
        return;
      }
      if (res.status === 410) {
        setError("Laitekoodi on vanhentunut (yli 30 päivää poissa). Luo uusi yhteys selaimesta.");
        return;
      }
      if (!res.ok) {
        setError("Yhteysvirhe. Yritä hetken kuluttua uudelleen.");
        return;
      }
      const data = await res.json() as DeviceInfo;
      setDeviceInfo(data);
      const remoteSettings = data.settings as Partial<DeviceSettings>;
      setSettings(prev => ({
        homeUrl: remoteSettings.homeUrl ?? prev.homeUrl,
        tutorMode: remoteSettings.tutorMode ?? prev.tutorMode,
        blockPayments: remoteSettings.blockPayments ?? prev.blockPayments,
        fontSize: remoteSettings.fontSize ?? prev.fontSize,
      }));
      sessionStorage.setItem("upanapu_code", digits);
      setView("settings");
      setConnectStep(1);
    } catch {
      setError("Verkkovirhe. Tarkista internet-yhteys.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestPairing() {
    const digits = rawCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$/.test(digits)) {
      setError("Syötä 12-merkkinen laitekoodi (muotoa XXXX-XXXX-XXXX).");
      return;
    }

    setPairingRequesting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/devices/${digits}/request-pairing`, { method: "POST" });
      if (res.status === 404) {
        setError("Laitetta ei löydy. Tarkista koodi.");
        return;
      }
      if (res.status === 410) {
        setError("Laitekoodi on vanhentunut (yli 30 päivää poissa). Luo uusi yhteys selaimesta.");
        return;
      }
      if (res.status === 429) {
        setError("Liian monta yhdistämispyyntöä. Odota hetki ja yritä uudelleen.");
        return;
      }
      if (!res.ok) {
        setError("Yhteysvirhe. Yritä hetken kuluttua uudelleen.");
        return;
      }
      const data = await res.json() as { requested: boolean; expiresIn: number };
      setOtpExpires(new Date(Date.now() + data.expiresIn * 1000));
      setOtpTimeLeft(data.expiresIn);
      setOtpValue("");
      setConnectStep(2);
      setError(null);
    } catch {
      setError("Verkkovirhe. Tarkista internet-yhteys.");
    } finally {
      setPairingRequesting(false);
    }
  }

  async function handleConfirmPairing() {
    const digits = rawCode;
    if (otpValue.length !== 4 || !/^\d{4}$/.test(otpValue)) {
      setError("Syötä 4-numeroinen vahvistuskoodi.");
      return;
    }

    setPairingConfirming(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/devices/${digits}/confirm-pairing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otpValue }),
      });
      const data = await res.json() as { confirmed?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Vahvistus epäonnistui. Tarkista koodi ja yritä uudelleen.");
        return;
      }
      await loadDevice(digits);
    } catch {
      setError("Verkkovirhe. Tarkista internet-yhteys.");
    } finally {
      setPairingConfirming(false);
    }
  }

  async function handleSave() {
    if (!deviceInfo) return;
    const digits = rawCode;

    setSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/devices/${digits}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });

      if (!res.ok) {
        setError("Tallentaminen epäonnistui. Yritä uudelleen.");
        return;
      }

      setSaveSuccess(true);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveSuccess(false), 4000);
    } catch {
      setError("Verkkovirhe tallennettaessa.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendMessage() {
    if (!messageText.trim() || messageSending) return;
    const digits = rawCode;

    setMessageSending(true);
    setMessageSent(false);

    try {
      const res = await fetch(`${API_BASE}/devices/${digits}/message`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText.trim() }),
      });

      if (!res.ok) {
        setError("Viestin lähettäminen epäonnistui.");
        return;
      }

      setMessageText("");
      setMessageSent(true);
      if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
      msgTimerRef.current = setTimeout(() => setMessageSent(false), 5000);
    } catch {
      setError("Verkkovirhe viestiä lähetettäessä.");
    } finally {
      setMessageSending(false);
    }
  }

  function handleDisconnect() {
    sessionStorage.removeItem("upanapu_code");
    setView("connect");
    setRawCode("");
    setDisplayCode("");
    setDeviceInfo(null);
    setError(null);
    setSaveSuccess(false);
    setMessageText("");
    setMessageSent(false);
    setShowScreenView(false);
    setConnectStep(1);
    setOtpValue("");
    setOtpExpires(null);
    setOtpTimeLeft(0);
    if (otpTimerRef.current) clearInterval(otpTimerRef.current);
  }

  function handleCodeInput(value: string) {
    const chars = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
    setRawCode(chars);
    setDisplayCode(formatCode(chars));
    setError(null);
  }

  const baseBg = "min-h-screen bg-gradient-to-br from-[#0f1e2b] via-[#1a2b38] to-[#0d1822] text-white";

  return (
    <div className={baseBg} style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-4xl mb-3" role="img" aria-label="Kilpi">🛡️</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#FFFFFF", marginBottom: 4 }}>
            Upan Apu — Omaisen Portaali
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
            Seuraa ja hallinnoi läheisesi turvaselainta etänä.
          </p>
        </div>

        {/* Connect view — 2-step */}
        {view === "connect" && (
          <div style={{
            background: "rgba(255,255,255,0.05)",
            border: "1.5px solid rgba(255,255,255,0.1)",
            borderRadius: 20,
            padding: "36px 32px",
          }}>
            {connectStep === 1 ? (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#FFFFFF" }}>
                  Yhdistä laitteeseen
                </h2>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 24, lineHeight: 1.6 }}>
                  Syötä läheisesi Upan Apu -selaimen laitekoodi. Läheisesi näytölle ilmestyy vahvistuskoodi, jonka hän kertoo sinulle.
                </p>

                <label
                  htmlFor="code-input"
                  style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", display: "block", marginBottom: 8 }}
                >
                  Laitekoodi
                </label>
                <input
                  id="code-input"
                  type="text"
                  placeholder="XXXX-XXXX-XXXX"
                  value={displayCode}
                  onChange={e => handleCodeInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleRequestPairing()}
                  autoComplete="off"
                  style={{
                    width: "100%",
                    padding: "16px 20px",
                    fontSize: 28,
                    fontWeight: 900,
                    letterSpacing: "0.12em",
                    fontFamily: "monospace",
                    background: "rgba(255,255,255,0.08)",
                    border: error ? "2px solid #FF6B35" : "2px solid rgba(255,255,255,0.15)",
                    borderRadius: 12,
                    color: "#FFFFFF",
                    textAlign: "center",
                    outline: "none",
                    marginBottom: 8,
                    boxSizing: "border-box",
                  }}
                />

                {error && (
                  <p style={{ fontSize: 14, color: "#FF6B35", marginBottom: 12 }} role="alert">
                    ⚠️ {error}
                  </p>
                )}

                <button
                  onClick={handleRequestPairing}
                  disabled={pairingRequesting || rawCode.length !== 12}
                  style={{
                    width: "100%",
                    padding: "16px",
                    marginTop: 8,
                    background: rawCode.length === 12 && !pairingRequesting ? "#0866FF" : "rgba(255,255,255,0.1)",
                    border: "none",
                    borderRadius: 12,
                    color: rawCode.length === 12 && !pairingRequesting ? "#FFFFFF" : "rgba(255,255,255,0.35)",
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: rawCode.length === 12 && !pairingRequesting ? "pointer" : "not-allowed",
                    transition: "background 0.2s",
                  }}
                >
                  {pairingRequesting ? "Lähetetään pyyntö…" : "Yhdistä laitteeseen →"}
                </button>
              </>
            ) : (
              <>
                {/* Step 2: OTP confirmation */}
                <div style={{
                  background: "rgba(34,197,94,0.12)",
                  border: "1.5px solid rgba(34,197,94,0.35)",
                  borderRadius: 12,
                  padding: "14px 18px",
                  marginBottom: 24,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}>
                  <span style={{ fontSize: 20 }}>✅</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#4ade80" }}>
                      Pyyntö lähetetty laitteelle!
                    </div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
                      Laite: <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#FFFFFF" }}>{formatCode(rawCode)}</span>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginBottom: 20, lineHeight: 1.65 }}>
                  Läheisesi näytölle on ilmestynyt 4-numeroinen koodi. Soita hänelle ja pyydä lukemaan se sinulle.
                </p>

                {/* Countdown */}
                <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                  {otpTimeLeft > 0 ? (
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                      ⏱ Koodi vanhenee {Math.floor(otpTimeLeft / 60)}:{(otpTimeLeft % 60).toString().padStart(2, "0")} kuluttua
                    </span>
                  ) : (
                    <>
                      <span style={{ fontSize: 13, color: "#FF6B35" }}>⏰ Koodi on vanhentunut.</span>
                      <button
                        onClick={handleRequestPairing}
                        disabled={pairingRequesting}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#0866FF",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                          padding: 0,
                          textDecoration: "underline",
                        }}
                      >
                        {pairingRequesting ? "Lähetetään…" : "Lähetä uudelleen"}
                      </button>
                    </>
                  )}
                </div>

                <label
                  htmlFor="otp-input"
                  style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", display: "block", marginBottom: 8 }}
                >
                  Vahvistuskoodi (4 numeroa)
                </label>
                <input
                  id="otp-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="0000"
                  value={otpValue}
                  onChange={e => {
                    setOtpValue(e.target.value.replace(/\D/g, "").slice(0, 4));
                    setError(null);
                  }}
                  onKeyDown={e => e.key === "Enter" && otpValue.length === 4 && otpTimeLeft > 0 && handleConfirmPairing()}
                  autoComplete="one-time-code"
                  maxLength={4}
                  style={{
                    width: "100%",
                    padding: "16px 20px",
                    fontSize: 36,
                    fontWeight: 900,
                    letterSpacing: "0.35em",
                    fontFamily: "monospace",
                    background: "rgba(255,255,255,0.08)",
                    border: error ? "2px solid #FF6B35" : "2px solid rgba(255,255,255,0.15)",
                    borderRadius: 12,
                    color: "#FFFFFF",
                    textAlign: "center",
                    outline: "none",
                    marginBottom: 8,
                    boxSizing: "border-box",
                  }}
                />

                {error && (
                  <p style={{ fontSize: 14, color: "#FF6B35", marginBottom: 12 }} role="alert">
                    ⚠️ {error}
                  </p>
                )}

                <button
                  onClick={handleConfirmPairing}
                  disabled={pairingConfirming || loading || otpValue.length !== 4 || otpTimeLeft === 0}
                  style={{
                    width: "100%",
                    padding: "16px",
                    marginTop: 8,
                    background: otpValue.length === 4 && otpTimeLeft > 0 && !pairingConfirming && !loading
                      ? "#0866FF" : "rgba(255,255,255,0.1)",
                    border: "none",
                    borderRadius: 12,
                    color: otpValue.length === 4 && otpTimeLeft > 0 && !pairingConfirming && !loading
                      ? "#FFFFFF" : "rgba(255,255,255,0.35)",
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: otpValue.length === 4 && otpTimeLeft > 0 && !pairingConfirming && !loading
                      ? "pointer" : "not-allowed",
                    transition: "background 0.2s",
                  }}
                >
                  {pairingConfirming || loading ? "Vahvistetaan…" : "✓ Vahvista yhteys"}
                </button>

                <button
                  onClick={() => { setConnectStep(1); setError(null); setOtpValue(""); }}
                  style={{
                    width: "100%",
                    padding: "12px",
                    marginTop: 10,
                    background: "none",
                    border: "none",
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  ← Takaisin
                </button>
              </>
            )}
          </div>
        )}

        {/* Settings view */}
        {view === "settings" && deviceInfo && (
          <div>
            {/* Device status card */}
            <div style={{
              background: "rgba(8,102,255,0.12)",
              border: "1.5px solid rgba(8,102,255,0.3)",
              borderRadius: 16,
              padding: "16px 20px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0866FF", marginBottom: 2 }}>
                  ✅ Yhdistetty
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                  Viimeksi aktiivinen: <strong style={{ color: "#FFFFFF" }}>{formatLastSeen(deviceInfo.lastSeen)}</strong>
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", marginTop: 2 }}>
                  Koodi: {formatCode(rawCode)}
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 8,
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 13,
                  padding: "8px 14px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Vaihda laitetta
              </button>
            </div>

            {/* Monitoring card */}
            <div style={{
              background: "rgba(255,215,0,0.06)",
              border: "1.5px solid rgba(255,215,0,0.2)",
              borderRadius: 16,
              padding: "20px 24px",
              marginBottom: 16,
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#FFD700", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                👁 Seuranta
              </h2>

              {/* Current URL */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Parhaillaan
                </div>
                {deviceInfo.currentUrl ? (
                  <div style={{
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 14,
                    color: "#FFFFFF",
                    fontFamily: "monospace",
                    wordBreak: "break-all",
                  }}>
                    {shortenUrl(deviceInfo.currentUrl)}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>
                    Ei sivua auki
                  </div>
                )}
              </div>

              {/* Visit history */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Viimeisimmät sivut
                </div>
                {deviceInfo.visitHistory && deviceInfo.visitHistory.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {deviceInfo.visitHistory.slice(0, 10).map((entry, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 10px",
                          background: "rgba(255,255,255,0.04)",
                          borderRadius: 6,
                        }}
                      >
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0, minWidth: 36 }}>
                          {formatLastSeen(entry.ts)}
                        </span>
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {entry.title ? entry.title : shortenUrl(entry.url)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>
                    Ei selaushistoriaa vielä
                  </div>
                )}
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 8, lineHeight: 1.5 }}>
                  Päivittyy automaattisesti 30 sekunnin välein
                </p>
              </div>
            </div>

            {/* Screen share card */}
            <div style={{
              background: "rgba(255,255,255,0.05)",
              border: "1.5px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              marginBottom: 16,
              overflow: "hidden",
            }}>
              {!showScreenView ? (
                <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                      <span>📺</span> Näyttökatselu
                    </div>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, margin: 0 }}>
                      Katso läheisesi ruutua reaaliajassa suorana videolähetyksenä.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowScreenView(true)}
                    style={{
                      flexShrink: 0,
                      padding: "10px 18px",
                      background: "#0866FF",
                      border: "none",
                      borderRadius: 10,
                      color: "#FFFFFF",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Katso näyttöä
                  </button>
                </div>
              ) : (
                <ScreenView
                  pairCode={rawCode}
                  onClose={() => setShowScreenView(false)}
                />
              )}
            </div>

            {/* Message card */}
            <div style={{
              background: "rgba(255,255,255,0.05)",
              border: "1.5px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              padding: "20px 24px",
              marginBottom: 16,
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                💬 Lähetä viesti
              </h2>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 14, lineHeight: 1.5 }}>
                Viesti ilmestyy läheisesi selaimeen tutor-kuplana seuraavan 30 sekunnin sisällä.
              </p>
              <textarea
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                placeholder="Kirjoita lyhyt viesti tai ohje…"
                maxLength={500}
                rows={3}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  fontSize: 14,
                  background: "rgba(255,255,255,0.08)",
                  border: "1.5px solid rgba(255,255,255,0.15)",
                  borderRadius: 10,
                  color: "#FFFFFF",
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
                  lineHeight: 1.5,
                  boxSizing: "border-box",
                  marginBottom: 8,
                }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                  {messageText.length}/500
                </span>
                <button
                  onClick={handleSendMessage}
                  disabled={messageSending || !messageText.trim()}
                  style={{
                    padding: "10px 20px",
                    background: messageText.trim() && !messageSending ? "#0866FF" : "rgba(255,255,255,0.1)",
                    border: "none",
                    borderRadius: 10,
                    color: messageText.trim() && !messageSending ? "#FFFFFF" : "rgba(255,255,255,0.35)",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: messageText.trim() && !messageSending ? "pointer" : "not-allowed",
                    transition: "background 0.15s",
                  }}
                >
                  {messageSending ? "Lähetetään…" : "📨 Lähetä viesti"}
                </button>
              </div>
              {messageSent && (
                <div style={{
                  marginTop: 10,
                  background: "rgba(34,197,94,0.15)",
                  border: "1.5px solid rgba(34,197,94,0.4)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "#4ade80",
                  fontWeight: 600,
                }} role="status">
                  ✅ Viesti lähetetty! Se ilmestyy selaimeen seuraavan 30 s kuluessa.
                </div>
              )}
            </div>

            {/* Settings card */}
            <div style={{
              background: "rgba(255,255,255,0.05)",
              border: "1.5px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              padding: "28px 28px",
              marginBottom: 16,
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#FFFFFF", marginBottom: 20 }}>
                Selaimen asetukset
              </h2>

              {/* homeUrl */}
              <div style={{ marginBottom: 20 }}>
                <label
                  htmlFor="homeUrl"
                  style={{ fontSize: 14, fontWeight: 600, color: "#FFFFFF", display: "block", marginBottom: 6 }}
                >
                  🏠 Kotisivu
                </label>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 8, lineHeight: 1.5 }}>
                  Sivu joka avautuu automaattisesti selaimessa.
                </p>
                <input
                  id="homeUrl"
                  type="url"
                  value={settings.homeUrl}
                  onChange={e => setSettings(s => ({ ...s, homeUrl: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    fontSize: 15,
                    background: "rgba(255,255,255,0.08)",
                    border: "1.5px solid rgba(255,255,255,0.15)",
                    borderRadius: 10,
                    color: "#FFFFFF",
                    outline: "none",
                    boxSizing: "border-box",
                    fontFamily: "monospace",
                  }}
                />
              </div>

              {/* tutorMode */}
              <div style={{
                marginBottom: 20,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#FFFFFF", marginBottom: 4 }}>
                    🎓 Opastusnäkymä
                  </div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, margin: 0 }}>
                    Näyttää selitykset jokaiselle painikkeelle sekä tutor-varoitukset.
                  </p>
                </div>
                <Toggle
                  checked={settings.tutorMode}
                  onChange={v => setSettings(s => ({ ...s, tutorMode: v }))}
                  label="Opastusnäkymä"
                />
              </div>

              {/* blockPayments */}
              <div style={{
                marginBottom: 20,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#FFFFFF", marginBottom: 4 }}>
                    🛡️ Estä verkko-ostokset
                  </div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, margin: 0 }}>
                    Näyttää varoituksen kun läheinen yrittää avata kauppa- tai maksusivuja.
                  </p>
                </div>
                <Toggle
                  checked={settings.blockPayments}
                  onChange={v => setSettings(s => ({ ...s, blockPayments: v }))}
                  label="Estä verkko-ostokset"
                />
              </div>

              {/* fontSize */}
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#FFFFFF", marginBottom: 6 }}>
                  🔠 Tekstin koko
                </div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 10, lineHeight: 1.5 }}>
                  Suurempi teksti helpottaa lukemista.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  {(["normal", "large", "xlarge"] as const).map(size => {
                    const labels = { normal: "Normaali", large: "Suuri", xlarge: "Erittäin suuri" };
                    const active = settings.fontSize === size;
                    return (
                      <button
                        key={size}
                        onClick={() => setSettings(s => ({ ...s, fontSize: size }))}
                        style={{
                          flex: 1,
                          padding: "10px 4px",
                          background: active ? "#0866FF" : "rgba(255,255,255,0.08)",
                          border: active ? "2px solid #0866FF" : "2px solid rgba(255,255,255,0.12)",
                          borderRadius: 10,
                          color: active ? "#FFFFFF" : "rgba(255,255,255,0.65)",
                          fontSize: 13,
                          fontWeight: active ? 700 : 500,
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        {labels[size]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {error && (
              <p style={{ fontSize: 14, color: "#FF6B35", marginBottom: 12 }} role="alert">
                ⚠️ {error}
              </p>
            )}

            {saveSuccess && (
              <div style={{
                background: "rgba(34,197,94,0.15)",
                border: "1.5px solid rgba(34,197,94,0.4)",
                borderRadius: 10,
                padding: "12px 16px",
                marginBottom: 12,
                fontSize: 14,
                color: "#4ade80",
                fontWeight: 600,
              }} role="status">
                ✅ Asetukset tallennettu! Selain päivittyy automaattisesti 30 sekunnin sisällä.
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: "100%",
                padding: "16px",
                background: saving ? "rgba(8,102,255,0.5)" : "#0866FF",
                border: "none",
                borderRadius: 12,
                color: "#FFFFFF",
                fontSize: 16,
                fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              {saving ? "Tallennetaan…" : "💾 Tallenna asetukset"}
            </button>

            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
              Muutokset siirtyvät läheisesi selaimeen automaattisesti.
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 40 }}>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>
            Upan Apu Turvaselain &mdash; upanapu.com
          </p>
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{
        width: 52,
        height: 28,
        borderRadius: 14,
        background: checked ? "#0866FF" : "rgba(255,255,255,0.15)",
        border: "none",
        cursor: "pointer",
        position: "relative",
        flexShrink: 0,
        transition: "background 0.2s",
      }}
    >
      <span style={{
        position: "absolute",
        top: 3,
        left: checked ? 27 : 3,
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: "#FFFFFF",
        transition: "left 0.2s",
        display: "block",
      }} />
    </button>
  );
}
