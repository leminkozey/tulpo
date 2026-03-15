// ===== User =====
export type AvatarType = "color" | "image" | "gif";

export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_type: AvatarType;
  avatar_color: string | null;
  bio: string;
  pronouns: string;
  banner_url: string | null;
  status: "online" | "offline" | "idle" | "dnd";
  created_at: string;
  updated_at: string;
}

export type PublicUser = Pick<
  User,
  "id" | "username" | "display_name" | "avatar_url" | "avatar_type" | "avatar_color" | "status"
>;

export interface UserLink {
  id: string;
  label: string;
  url: string;
  position: number;
}

export interface UserProfile extends PublicUser {
  bio: string;
  pronouns: string;
  banner_url: string | null;
  links: UserLink[];
  created_at: string;
}

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
  CLIENT_EVENT = 4,
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

// ===== Friends =====
export type FriendRequestStatus = "pending" | "accepted" | "blocked";

export interface FriendRequest {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendRequestStatus;
  note: string | null;
  created_at: string;
}

export interface FriendWithUser {
  id: string;
  user: PublicUser;
  note: string | null;
  created_at: string;
}

export interface IncomingFriendRequest {
  id: string;
  from: PublicUser;
  note: string | null;
  created_at: string;
}

export interface OutgoingFriendRequest {
  id: string;
  to: PublicUser;
  note: string | null;
  created_at: string;
}

// ===== User Settings =====
export interface UserSettings {
  user_id: string;
  allow_friend_request_notes: boolean;
}

// ===== Attachments =====
export interface DmAttachment {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  url: string;
}

// ===== Voice Calls =====
export interface VoiceCallParticipant {
  user_id: string;
  user: PublicUser;
  is_muted: boolean;
  is_deafened: boolean;
}

export interface VoiceCall {
  id: string;
  dm_channel_id: string;
  status: "ringing" | "active" | "ended";
  started_by: string;
  participants: VoiceCallParticipant[];
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}
