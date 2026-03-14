import { WsOpCode, WS_HEARTBEAT_INTERVAL_MS } from "@tulpo/shared";
import type { WsMessage } from "@tulpo/shared";
import { auth } from "$lib/stores/auth.svelte";

type WsStatus = "connecting" | "connected" | "disconnected" | "reconnecting";
type EventHandler = (data: unknown) => void;

function createWsClient() {
  let status = $state<WsStatus>("disconnected");
  let ws: WebSocket | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  const maxReconnectDelay = 30_000;
  const listeners = new Map<string, Set<EventHandler>>();

  function send(msg: WsMessage) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function startHeartbeat(interval: number) {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      send({ op: WsOpCode.HEARTBEAT, d: null });
    }, interval);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function emit(event: string, data: unknown) {
    const handlers = listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }

  function connect() {
    if (!auth.token) return;
    if (ws?.readyState === WebSocket.OPEN) return;

    status = "connecting";

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    ws = new WebSocket(`${protocol}//${host}/ws?token=${auth.token}`);

    ws.onopen = () => {
      status = "connected";
      reconnectAttempts = 0;
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);

        switch (msg.op) {
          case WsOpCode.HELLO: {
            const { heartbeat_interval } = msg.d as {
              heartbeat_interval: number;
            };
            startHeartbeat(heartbeat_interval);
            break;
          }
          case WsOpCode.HEARTBEAT_ACK:
            // Server acknowledged our heartbeat
            break;
          case WsOpCode.DISPATCH:
            if (msg.t) {
              emit(msg.t, msg.d);
            }
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      stopHeartbeat();
      status = "disconnected";
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    if (!auth.token) return;

    const delay = Math.min(
      1000 * Math.pow(2, reconnectAttempts),
      maxReconnectDelay
    );
    reconnectAttempts++;
    status = "reconnecting";

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    stopHeartbeat();
    reconnectAttempts = 0;
    ws?.close();
    ws = null;
    status = "disconnected";
  }

  function on(event: string, handler: EventHandler) {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      listeners.get(event)?.delete(handler);
    };
  }

  function sendEvent(event: string, data: unknown) {
    send({ op: WsOpCode.CLIENT_EVENT, t: event, d: data });
  }

  return {
    get status() {
      return status;
    },
    connect,
    disconnect,
    on,
    send,
    sendEvent,
  };
}

export const wsClient = createWsClient();
