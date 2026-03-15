import { WsOpCode, WS_HEARTBEAT_INTERVAL_MS, WS_HEARTBEAT_TIMEOUT_MS } from "@tulpo/shared";
import type { WsMessage } from "@tulpo/shared";
import type { TulpoWebSocket } from "./types";
import { validateSession } from "../lib/auth";
import { getDb } from "@tulpo/db";
import { signUrl } from "../lib/signed-url";

// Connection pool: userId -> Set of WebSocket connections
const connections = new Map<string, Set<TulpoWebSocket>>();

export function addConnection(userId: string, ws: TulpoWebSocket) {
  const isFirstConnection = !connections.has(userId) || connections.get(userId)!.size === 0;

  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add(ws);

  if (isFirstConnection) {
    const db = getDb();
    // Respect manually set status — only change from 'offline' to 'online'
    const current = db.query("SELECT status FROM users WHERE id = ?").get(userId) as any;
    const newStatus = current?.status === "dnd" || current?.status === "idle" ? current.status : "online";
    db.run("UPDATE users SET status = ? WHERE id = ?", [newStatus, userId]);
    broadcastPresence(userId, newStatus);
  }
}

export function removeConnection(userId: string, ws: TulpoWebSocket) {
  const userConns = connections.get(userId);
  if (userConns) {
    userConns.delete(ws);
    if (userConns.size === 0) {
      connections.delete(userId);
      getDb().run("UPDATE users SET status = 'offline' WHERE id = ?", [userId]);
      broadcastPresence(userId, "offline");
    }
  }
}

// Notify all friends about a user's presence change
export function broadcastPresence(userId: string, status: string) {
  const db = getDb();
  const friends = db
    .query(
      `SELECT CASE WHEN user_id = ? THEN friend_id ELSE user_id END as friend_id
       FROM friends WHERE (user_id = ? OR friend_id = ?) AND status = 'accepted'`
    )
    .all(userId, userId, userId) as any[];

  for (const f of friends) {
    sendToUser(f.friend_id, "PRESENCE_UPDATE", {
      user_id: userId,
      status,
    });
  }
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
    // If pre-authenticated via URL token, add to pool and send READY
    if (ws.data.userId && ws.data.token) {
      addConnection(ws.data.userId, ws);

      const user = validateSession(ws.data.token);
      if (user) {
        send(ws, {
          op: WsOpCode.DISPATCH,
          t: "READY",
          d: { user },
        });
      }
    }

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

        case WsOpCode.CLIENT_EVENT: {
          if (!ws.data.userId) break;
          const payload = data.d as any;
          const eventType = data.t;

          if (eventType === "TYPING_START" && payload?.channel_id) {
            const db = getDb();
            const participant = db
              .query("SELECT status FROM dm_participants WHERE dm_channel_id = ? AND user_id = ? AND status = 'active'")
              .get(payload.channel_id, ws.data.userId) as any;
            if (!participant) break;

            const user = db
              .query("SELECT username, avatar_url, avatar_type, avatar_color FROM users WHERE id = ?")
              .get(ws.data.userId) as any;

            const others = db
              .query("SELECT user_id FROM dm_participants WHERE dm_channel_id = ? AND user_id != ? AND status = 'active'")
              .all(payload.channel_id, ws.data.userId) as any[];

            for (const p of others) {
              sendToUser(p.user_id, "TYPING_START", {
                channel_id: payload.channel_id,
                user_id: ws.data.userId,
                username: user?.username,
                avatar_url: user?.avatar_url?.startsWith("/uploads/") ? signUrl(user.avatar_url) : user?.avatar_url,
                avatar_type: user?.avatar_type,
                avatar_color: user?.avatar_color,
              });
            }
          }
          break;
        }

        case WsOpCode.IDENTIFY: {
          const { token } = data.d as { token: string };
          const user = validateSession(token);

          if (!user) {
            ws.close(4001, "Invalid session");
            return;
          }

          if (ws.data.userId && ws.data.userId !== user.id) {
            removeConnection(ws.data.userId, ws);
          }

          ws.data.userId = user.id;
          ws.data.isAlive = true;

          const existing = connections.get(user.id);
          if (!existing || !existing.has(ws)) {
            addConnection(user.id, ws);
          }

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
