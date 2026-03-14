import { WsOpCode, WS_HEARTBEAT_INTERVAL_MS, WS_HEARTBEAT_TIMEOUT_MS } from "@tulpo/shared";
import type { WsMessage } from "@tulpo/shared";
import type { TulpoWebSocket } from "./types";
import { validateSession } from "../lib/auth";

// Connection pool: userId -> Set of WebSocket connections
const connections = new Map<string, Set<TulpoWebSocket>>();

export function addConnection(userId: string, ws: TulpoWebSocket) {
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add(ws);
}

export function removeConnection(userId: string, ws: TulpoWebSocket) {
  const userConns = connections.get(userId);
  if (userConns) {
    userConns.delete(ws);
    if (userConns.size === 0) {
      connections.delete(userId);
    }
  }
}

export function getOnlineUserIds(): string[] {
  return Array.from(connections.keys());
}

function send(ws: TulpoWebSocket, message: WsMessage) {
  ws.send(JSON.stringify(message));
}

export function sendToUser(userId: string, event: string, data: unknown) {
  const userConns = connections.get(userId);
  if (!userConns) return;
  const message: WsMessage = { op: WsOpCode.DISPATCH, t: event, d: data };
  for (const ws of userConns) {
    send(ws, message);
  }
}

export const wsHandler = {
  open(ws: TulpoWebSocket) {
    // Send HELLO with heartbeat interval
    send(ws, {
      op: WsOpCode.HELLO,
      d: { heartbeat_interval: WS_HEARTBEAT_INTERVAL_MS },
    });
  },

  message(ws: TulpoWebSocket, message: string | Buffer) {
    try {
      const data: WsMessage = JSON.parse(
        typeof message === "string" ? message : message.toString()
      );

      switch (data.op) {
        case WsOpCode.HEARTBEAT:
          ws.data.isAlive = true;
          send(ws, { op: WsOpCode.HEARTBEAT_ACK, d: null });
          break;

        case WsOpCode.IDENTIFY: {
          const { token } = data.d as { token: string };
          const user = validateSession(token);

          if (!user) {
            ws.close(4001, "Invalid session");
            return;
          }

          ws.data.userId = user.id;
          ws.data.isAlive = true;
          addConnection(user.id, ws);

          // Send READY event
          send(ws, {
            op: WsOpCode.DISPATCH,
            t: "READY",
            d: { user },
          });
          break;
        }
      }
    } catch {
      // Ignore malformed messages
    }
  },

  close(ws: TulpoWebSocket) {
    if (ws.data.userId) {
      removeConnection(ws.data.userId, ws);
    }
  },
};

// Heartbeat checker - runs periodically
export function startHeartbeatChecker() {
  setInterval(() => {
    for (const [userId, sockets] of connections) {
      for (const ws of sockets) {
        if (!ws.data.isAlive) {
          ws.close(4002, "Heartbeat timeout");
          removeConnection(userId, ws);
          continue;
        }
        ws.data.isAlive = false;
      }
    }
  }, WS_HEARTBEAT_TIMEOUT_MS);
}
