import { useEffect, useRef } from "react";
import { useScreenShare } from "./hooks/useScreenShare";

interface ScreenViewProps {
  pairCode: string;
  onClose: () => void;
}

export function ScreenView({ pairCode, onClose }: ScreenViewProps) {
  const { stream, connected, error } = useScreenShare(pairCode, true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={{
      background: "rgba(0,0,0,0.85)",
      borderRadius: 16,
      overflow: "hidden",
      border: "1.5px solid rgba(255,255,255,0.12)",
    }}>
      {/* Toolbar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        background: "rgba(255,255,255,0.05)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>📺</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>
            Näyttökatselu
          </span>
          {connected && (
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(34,197,94,0.2)",
              border: "1px solid rgba(34,197,94,0.4)",
              borderRadius: 20,
              padding: "2px 8px",
              fontSize: 11,
              fontWeight: 700,
              color: "#4ade80",
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#4ade80",
                display: "inline-block",
                animation: "pulse-dot 2s ease-in-out infinite",
              }} />
              LIVE
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Lopeta katselu"
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8,
            color: "#FFFFFF",
            fontSize: 13,
            fontWeight: 600,
            padding: "6px 14px",
            cursor: "pointer",
          }}
        >
          Lopeta katselu
        </button>
      </div>

      {/* Video area */}
      <div style={{ position: "relative", background: "#000000", minHeight: 200 }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            display: stream ? "block" : "none",
            maxHeight: "60vh",
            objectFit: "contain",
            background: "#000000",
          }}
        />

        {/* Loading / waiting state */}
        {!stream && !error && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 24px",
            gap: 16,
            color: "rgba(255,255,255,0.6)",
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "3px solid rgba(255,255,255,0.15)",
              borderTopColor: "#0866FF",
              animation: "spin 1s linear infinite",
            }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#FFFFFF", marginBottom: 4 }}>
                Odotetaan yhteyden muodostumista…
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                Läheisesi selain vastaanottaa pyyntösi hetken kuluttua.
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 24px",
            gap: 12,
          }}>
            <span style={{ fontSize: 32 }}>⚠️</span>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#FF6B35", marginBottom: 6 }}>
                Yhteys katkesi
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", maxWidth: 300 }}>
                {error}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
