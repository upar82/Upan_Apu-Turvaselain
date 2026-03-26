import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { logger } from "./logger";

type Role = "browser" | "portal";

interface Peer {
  ws: WebSocket;
  role: Role;
}

interface Room {
  browser?: Peer;
  portal?: Peer;
}

const VALID_PAIR_CODE = /^[A-Z2-9]{12}$/;

const rooms = new Map<string, Room>();

function getOrCreateRoom(pairCode: string): Room {
  let room = rooms.get(pairCode);
  if (!room) {
    room = {};
    rooms.set(pairCode, room);
  }
  return room;
}

function removeRoom(pairCode: string): void {
  const room = rooms.get(pairCode);
  if (room && !room.browser && !room.portal) {
    rooms.delete(pairCode);
  }
}

function send(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function getPeer(room: Room, role: Role): Peer | undefined {
  return role === "browser" ? room.browser : room.portal;
}

function getOtherPeer(room: Room, role: Role): Peer | undefined {
  return role === "browser" ? room.portal : room.browser;
}

function setPeer(room: Room, role: Role, peer: Peer | undefined): void {
  if (role === "browser") {
    room.browser = peer;
  } else {
    room.portal = peer;
  }
}

export function attachSignalingServer(httpServer: Server): void {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    let joinedRoom: string | null = null;
    let joinedRole: Role | null = null;

    ws.on("message", (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      if (msg["type"] === "join") {
        const pairCode = typeof msg["pairCode"] === "string" ? msg["pairCode"] : null;
        const role = msg["role"] === "browser" || msg["role"] === "portal" ? msg["role"] : null;

        if (!pairCode || !VALID_PAIR_CODE.test(pairCode) || !role) {
          send(ws, { type: "error", message: "Invalid join parameters" });
          return;
        }

        if (joinedRoom) {
          send(ws, { type: "error", message: "Already joined" });
          return;
        }

        const room = getOrCreateRoom(pairCode);

        if (getPeer(room, role)) {
          send(ws, { type: "error", message: "Role already taken in this room" });
          return;
        }

        const peer: Peer = { ws, role };
        setPeer(room, role, peer);
        joinedRoom = pairCode;
        joinedRole = role;

        send(ws, { type: "joined" });
        logger.info({ pairCode, role }, "Peer joined signaling room");

        const other = getOtherPeer(room, role);
        if (other) {
          send(ws, { type: "peer-joined" });
          send(other.ws, { type: "peer-joined" });
        }
        return;
      }

      if (!joinedRoom || !joinedRole) {
        send(ws, { type: "error", message: "Must join a room first" });
        return;
      }

      const room = rooms.get(joinedRoom);
      if (!room) return;

      const other = getOtherPeer(room, joinedRole);
      if (!other) return;

      if (
        msg["type"] === "offer" ||
        msg["type"] === "answer" ||
        msg["type"] === "ice-candidate"
      ) {
        send(other.ws, msg);
      }
    });

    ws.on("close", () => {
      if (!joinedRoom || !joinedRole) return;

      const room = rooms.get(joinedRoom);
      if (!room) return;

      setPeer(room, joinedRole, undefined);
      logger.info({ pairCode: joinedRoom, role: joinedRole }, "Peer left signaling room");

      const other = getOtherPeer(room, joinedRole);
      if (other) {
        send(other.ws, { type: "peer-left" });
      }

      removeRoom(joinedRoom);
    });

    ws.on("error", (err) => {
      logger.warn({ err }, "WebSocket error");
    });
  });

  logger.info("WebSocket signaling server attached at /ws");
}
