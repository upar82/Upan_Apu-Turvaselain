import { useEffect, useRef, useState } from "react";

function buildWsUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (apiUrl) {
    return apiUrl
      .replace(/^https:\/\//, "wss://")
      .replace(/^http:\/\//, "ws://")
      .replace(/\/$/, "") + "/ws";
  }
  return "ws://localhost:8080/ws";
}

const WS_URL = buildWsUrl();

export interface ScreenShareState {
  stream: MediaStream | null;
  connected: boolean;
  error: string | null;
}

export function useScreenShare(
  pairCode: string | null,
  enabled: boolean,
): ScreenShareState {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intentionalRef = useRef(false);

  useEffect(() => {
    if (!enabled || !pairCode) return;

    intentionalRef.current = false;
    setError(null);
    setConnected(false);
    setStream(null);

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", role: "portal", pairCode }));
    };

    ws.onmessage = (event: MessageEvent) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data as string) as Record<string, unknown>;
      } catch {
        return;
      }
      void handleMessage(msg, ws);
    };

    ws.onclose = () => {
      if (!intentionalRef.current) {
        setError("Signalointiyhteys katkesi.");
        setConnected(false);
        setStream(null);
      }
      cleanupPeer();
    };

    ws.onerror = () => {
      setError("Signalointipalvelimeen yhdistäminen epäonnistui.");
    };

    return () => {
      intentionalRef.current = true;
      ws.onclose = null;
      ws.close();
      wsRef.current = null;
      cleanupPeer();
      setStream(null);
      setConnected(false);
      setError(null);
    };
  }, [enabled, pairCode]);

  async function handleMessage(
    msg: Record<string, unknown>,
    ws: WebSocket,
  ): Promise<void> {
    if (msg["type"] === "offer") {
      cleanupPeer();

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      pc.ontrack = (e: RTCTrackEvent) => {
        const s = e.streams[0] ?? null;
        streamRef.current = s;
        setStream(s);
        setConnected(true);
        setError(null);
      };

      pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
        if (e.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({ type: "ice-candidate", candidate: e.candidate.toJSON() }),
          );
        }
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed"
        ) {
          setError("WebRTC-yhteys katkesi.");
          setConnected(false);
          setStream(null);
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };

      await pc.setRemoteDescription(
        new RTCSessionDescription(msg["sdp"] as RTCSessionDescriptionInit),
      );
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "answer", sdp: pc.localDescription }));
      }
    } else if (msg["type"] === "ice-candidate" && msg["candidate"]) {
      if (pcRef.current) {
        await pcRef.current.addIceCandidate(
          new RTCIceCandidate(msg["candidate"] as RTCIceCandidateInit),
        );
      }
    } else if (msg["type"] === "peer-left") {
      setError("Yhteys läheisesi selaimeen katkesi.");
      setConnected(false);
      setStream(null);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      cleanupPeer();
    }
  }

  function cleanupPeer(): void {
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  return { stream, connected, error };
}
