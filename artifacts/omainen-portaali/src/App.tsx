import { useState, useEffect, useRef } from "react";

interface DeviceSettings {
  homeUrl: string;
  tutorMode: boolean;
  blockPayments: boolean;
  fontSize: "normal" | "large" | "xlarge";
}

interface DeviceInfo {
  deviceId: string;
  settings: DeviceSettings;
  lastSeen: string;
}

const API_BASE = "/api";

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
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
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
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const savedCode = sessionStorage.getItem("upanapu_code");
    if (savedCode) {
      setRawCode(savedCode);
      setDisplayCode(formatCode(savedCode));
      handleConnect(savedCode);
    }
  }, []);

  async function handleConnect(code?: string) {
    const digits = (code ?? rawCode).replace(/\D/g, "");
    if (digits.length !== 6) {
      setError("Syötä 6-numeroinen laitekoodi.");
      return;
    }

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
    } catch {
      setError("Verkkovirhe. Tarkista internet-yhteys.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!deviceInfo) return;
    const digits = rawCode.replace(/\D/g, "");

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

  function handleDisconnect() {
    sessionStorage.removeItem("upanapu_code");
    setView("connect");
    setRawCode("");
    setDisplayCode("");
    setDeviceInfo(null);
    setError(null);
    setSaveSuccess(false);
  }

  function handleCodeInput(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setRawCode(digits);
    setDisplayCode(formatCode(digits));
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
            Hallinnoi läheisesi turvaselaimen asetuksia etänä.
          </p>
        </div>

        {/* Connect view */}
        {view === "connect" && (
          <div style={{
            background: "rgba(255,255,255,0.05)",
            border: "1.5px solid rgba(255,255,255,0.1)",
            borderRadius: 20,
            padding: "36px 32px",
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#FFFFFF" }}>
              Yhdistä laitteeseen
            </h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 24, lineHeight: 1.6 }}>
              Pyydä läheistäsi avaamaan Upan Apu -selain ja painamaan 🔗-kuvaketta 
              työkalupalkissa. Syötä näytölle ilmestyvä 6-numeroinen laitekoodi alle.
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
              inputMode="numeric"
              placeholder="00-00-00"
              value={displayCode}
              onChange={e => handleCodeInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleConnect()}
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
              onClick={() => handleConnect()}
              disabled={loading || rawCode.length !== 6}
              style={{
                width: "100%",
                padding: "16px",
                marginTop: 8,
                background: rawCode.length === 6 && !loading ? "#0866FF" : "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: 12,
                color: rawCode.length === 6 && !loading ? "#FFFFFF" : "rgba(255,255,255,0.35)",
                fontSize: 16,
                fontWeight: 700,
                cursor: rawCode.length === 6 && !loading ? "pointer" : "not-allowed",
                transition: "background 0.2s",
              }}
            >
              {loading ? "Yhdistetään…" : "Yhdistä laitteeseen"}
            </button>
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
              marginBottom: 20,
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
                  Laite viimeksi aktiivinen: <strong style={{ color: "#FFFFFF" }}>{formatLastSeen(deviceInfo.lastSeen)}</strong>
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
