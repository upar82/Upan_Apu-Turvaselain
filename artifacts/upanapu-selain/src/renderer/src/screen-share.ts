const RECONNECT_DELAY_MS = 5_000

export type ScreenShareStatus = 'idle' | 'connecting' | 'streaming' | 'error'

export interface ScreenShareOptions {
  pairCode: string
  apiBaseUrl: string
  onStatusChange: (status: ScreenShareStatus) => void
}

function toWsUrl(apiBaseUrl: string): string {
  const url = new URL(apiBaseUrl)
  if (url.protocol === 'https:') {
    return `wss://${url.host}${url.pathname.replace(/\/$/, '')}/ws`
  }
  if (url.protocol === 'http:') {
    const isLocal =
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]'
    if (!isLocal) {
      throw new Error(
        `Insecure WebSocket (ws://) is not permitted for non-local hosts. Use an https:// API URL instead.`
      )
    }
    return `ws://${url.host}${url.pathname.replace(/\/$/, '')}/ws`
  }
  throw new Error(`Unsupported API URL protocol: ${url.protocol}`)
}

export class ScreenShare {
  private ws: WebSocket | null = null
  private pc: RTCPeerConnection | null = null
  private stream: MediaStream | null = null
  private stopped = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  private readonly pairCode: string
  private readonly wsUrl: string
  private readonly onStatusChange: (status: ScreenShareStatus) => void

  constructor({ pairCode, apiBaseUrl, onStatusChange }: ScreenShareOptions) {
    this.pairCode = pairCode
    this.wsUrl = toWsUrl(apiBaseUrl)
    this.onStatusChange = onStatusChange
  }

  start(): void {
    this.stopped = false
    this.connect()
  }

  stop(): void {
    this.stopped = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.cleanupPeer()
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
    this.onStatusChange('idle')
  }

  private connect(): void {
    if (this.stopped) return
    this.onStatusChange('connecting')

    const ws = new WebSocket(this.wsUrl)
    this.ws = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', role: 'browser', pairCode: this.pairCode }))
    }

    ws.onmessage = (event: MessageEvent) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(event.data as string) as Record<string, unknown>
      } catch {
        return
      }
      void this.handleMessage(msg)
    }

    ws.onclose = () => {
      this.cleanupPeer()
      this.onStatusChange('idle')
      if (!this.stopped) {
        this.scheduleReconnect()
      }
    }

    ws.onerror = () => {
      this.onStatusChange('error')
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, RECONNECT_DELAY_MS)
  }

  private async handleMessage(msg: Record<string, unknown>): Promise<void> {
    switch (msg['type']) {
      case 'peer-joined':
        await this.startStreaming()
        break
      case 'answer':
        if (this.pc && msg['sdp']) {
          await this.pc.setRemoteDescription(new RTCSessionDescription(msg['sdp'] as RTCSessionDescriptionInit))
        }
        break
      case 'ice-candidate':
        if (this.pc && msg['candidate']) {
          await this.pc.addIceCandidate(new RTCIceCandidate(msg['candidate'] as RTCIceCandidateInit))
        }
        break
      case 'peer-left':
        this.cleanupPeer()
        this.onStatusChange('connecting')
        break
      default:
        break
    }
  }

  private async startStreaming(): Promise<void> {
    // Clean up any existing session before starting a new one (idempotent)
    this.cleanupPeer()

    try {
      const sourceId = await window.electronAPI.getScreenSourceId?.()
      if (!sourceId) {
        console.warn('[screenshare] No screen source available')
        return
      }

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          // Electron-specific legacy constraints for desktopCapturer
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            minWidth: 640,
            maxWidth: 1920,
            minHeight: 360,
            maxHeight: 1080,
          },
        } as MediaTrackConstraints,
      }

      this.stream = await navigator.mediaDevices.getUserMedia(constraints)

      const config: RTCConfiguration = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      }
      const pc = new RTCPeerConnection(config)
      this.pc = pc

      for (const track of this.stream.getTracks()) {
        pc.addTrack(track, this.stream)
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ice-candidate', candidate: event.candidate.toJSON() }))
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          this.cleanupPeer()
          this.onStatusChange('connecting')
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'offer', sdp: pc.localDescription }))
      }

      this.onStatusChange('streaming')
    } catch (err) {
      console.warn('[screenshare] Failed to start streaming:', err)
      this.cleanupPeer()
      this.onStatusChange('error')
    }
  }

  private cleanupPeer(): void {
    if (this.pc) {
      this.pc.onicecandidate = null
      this.pc.onconnectionstatechange = null
      this.pc.close()
      this.pc = null
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop())
      this.stream = null
    }
  }
}
