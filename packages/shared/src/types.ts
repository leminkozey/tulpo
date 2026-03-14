// ===== User =====
export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: "online" | "offline" | "idle" | "dnd";
  created_at: string;
  updated_at: string;
}

export type PublicUser = Pick<
  User,
  "id" | "username" | "display_name" | "avatar_url" | "status"
>;

// ===== Auth =====
export interface AuthResponse {
  user: PublicUser;
  token: string;
}

// ===== Server =====
export interface Server {
  id: string;
  name: string;
  icon_url: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

// ===== Channel =====
export type ChannelType = "text" | "voice";

export interface Channel {
  id: string;
  server_id: string;
  category_id: string | null;
  name: string;
  topic: string | null;
  type: ChannelType;
  position: number;
  created_at: string;
  updated_at: string;
}

// ===== Category =====
export interface Category {
  id: string;
  server_id: string;
  name: string;
  position: number;
  created_at: string;
}

// ===== Message =====
export interface Message {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  edited_at: string | null;
  created_at: string;
}

// ===== Member =====
export interface Member {
  id: string;
  user_id: string;
  server_id: string;
  nickname: string | null;
  joined_at: string;
}

// ===== WebSocket =====
export enum WsOpCode {
  HELLO = 0,
  HEARTBEAT = 1,
  HEARTBEAT_ACK = 2,
  IDENTIFY = 3,
  DISPATCH = 10,
}

export interface WsMessage {
  op: WsOpCode;
  d: unknown;
  t?: string;
}

export interface WsHello {
  heartbeat_interval: number;
}

export interface WsIdentify {
  token: string;
}
