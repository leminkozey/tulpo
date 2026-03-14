import type { ServerWebSocket } from "bun";

export interface WsData {
  userId: string | null;
  token: string | null;
  isAlive: boolean;
}

export type TulpoWebSocket = ServerWebSocket<WsData>;
