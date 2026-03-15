import { getDb } from "@tulpo/db";
import { CALL_RING_TIMEOUT_MS, CALL_REJOIN_TIMEOUT_MS, CALL_MAX_PARTICIPANTS } from "@tulpo/shared";
import type { PublicUser } from "@tulpo/shared";
import { sendToUser } from "./handler";
import { signUserUrls } from "../lib/signed-url";

interface CallParticipant {
  userId: string;
  isMuted: boolean;
  isDeafened: boolean;
  joinedAt: number;
}

interface ActiveCall {
  id: string;
  dmChannelId: string;
  startedBy: string;
  status: "ringing" | "active";
  participants: Map<string, CallParticipant>;
  pendingRejoins: Map<string, ReturnType<typeof setTimeout>>;
  ringTimeout?: ReturnType<typeof setTimeout>;
}

// Active calls: callId -> ActiveCall
const activeCalls = new Map<string, ActiveCall>();
// Reverse lookup: dmChannelId -> callId
const channelToCall = new Map<string, string>();

function getPublicUser(userId: string): PublicUser | null {
  const db = getDb();
  const user = db.query(
    "SELECT id, username, display_name, avatar_url, avatar_type, avatar_color, status FROM users WHERE id = ?"
  ).get(userId) as PublicUser | null;
  if (user) return signUserUrls(user);
  return null;
}

function getCallParticipantList(call: ActiveCall) {
  const list: any[] = [];
  for (const [uid, p] of call.participants) {
    const user = getPublicUser(uid);
    if (user) {
      list.push({
        user_id: uid,
        user,
        is_muted: p.isMuted,
        is_deafened: p.isDeafened,
      });
    }
  }
  return list;
}

function endCall(callId: string, reason: string) {
  const call = activeCalls.get(callId);
  if (!call) return;

  if (call.ringTimeout) clearTimeout(call.ringTimeout);
  for (const timeout of call.pendingRejoins.values()) {
    clearTimeout(timeout);
  }

  // Notify all participants
  for (const uid of call.participants.keys()) {
    sendToUser(uid, "CALL_ENDED", { call_id: callId, channel_id: call.dmChannelId, reason });
  }
  // Also notify pending rejoin users
  for (const uid of call.pendingRejoins.keys()) {
    sendToUser(uid, "CALL_ENDED", { call_id: callId, channel_id: call.dmChannelId, reason });
  }

  activeCalls.delete(callId);
  channelToCall.delete(call.dmChannelId);
}

export function initiateCall(dmChannelId: string, userId: string): { error?: string; callId?: string } {
  // Check if there's already a call on this channel
  if (channelToCall.has(dmChannelId)) {
    return { error: "A call is already active on this channel" };
  }

  const db = getDb();

  // Verify user is a participant
  const participant = db.query(
    "SELECT user_id FROM dm_participants WHERE dm_channel_id = ? AND user_id = ? AND status = 'active'"
  ).get(dmChannelId, userId) as any;
  if (!participant) return { error: "Not a member of this channel" };

  // Get all other participants
  const others = db.query(
    "SELECT user_id FROM dm_participants WHERE dm_channel_id = ? AND user_id != ? AND status = 'active'"
  ).all(dmChannelId, userId) as any[];

  if (others.length === 0) return { error: "No one to call" };
  if (others.length + 1 > CALL_MAX_PARTICIPANTS) return { error: "Too many participants" };

  // Check blocks
  for (const other of others) {
    const blocked = db.query(
      "SELECT 1 FROM user_blocks WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)"
    ).get(userId, other.user_id, other.user_id, userId) as any;
    if (blocked) return { error: "Cannot call blocked users" };
  }

  // Create call
  const callResult = db.query(
    "INSERT INTO voice_calls (dm_channel_id, started_by) VALUES (?, ?) RETURNING id"
  ).get(dmChannelId, userId) as any;

  const callId = callResult.id;

  // Add caller as participant in DB
  db.run(
    "INSERT INTO voice_call_participants (call_id, user_id) VALUES (?, ?)",
    [callId, userId]
  );

  const call: ActiveCall = {
    id: callId,
    dmChannelId,
    startedBy: userId,
    status: "ringing",
    participants: new Map([[userId, { userId, isMuted: false, isDeafened: false, joinedAt: Date.now() }]]),
    pendingRejoins: new Map(),
  };

  // Ring timeout — auto-cancel after 30s
  call.ringTimeout = setTimeout(() => {
    if (call.status === "ringing") {
      endCall(callId, "ring_timeout");
    }
  }, CALL_RING_TIMEOUT_MS);

  activeCalls.set(callId, call);
  channelToCall.set(dmChannelId, callId);

  const callerUser = getPublicUser(userId);

  // Notify all targets
  for (const other of others) {
    // Check if target has caller muted — still ring but they can decline
    sendToUser(other.user_id, "CALL_RINGING", {
      call_id: callId,
      channel_id: dmChannelId,
      caller: callerUser,
      participants: getCallParticipantList(call),
    });
  }

  return { callId };
}

export function acceptCall(callId: string, userId: string): { error?: string } {
  const call = activeCalls.get(callId);
  if (!call) return { error: "Call not found" };

  const db = getDb();

  // Verify user is a participant of the channel
  const participant = db.query(
    "SELECT user_id FROM dm_participants WHERE dm_channel_id = ? AND user_id = ? AND status = 'active'"
  ).get(call.dmChannelId, userId) as any;
  if (!participant) return { error: "Not a member of this channel" };

  // Stop ring timeout
  if (call.ringTimeout) {
    clearTimeout(call.ringTimeout);
    call.ringTimeout = undefined;
  }

  call.status = "active";
  call.participants.set(userId, { userId, isMuted: false, isDeafened: false, joinedAt: Date.now() });

  // Update DB
  db.run("UPDATE voice_calls SET status = 'active' WHERE id = ?", [callId]);
  db.run(
    "INSERT OR REPLACE INTO voice_call_participants (call_id, user_id) VALUES (?, ?)",
    [callId, userId]
  );

  const participants = getCallParticipantList(call);

  // Notify all participants (including the one who just joined)
  for (const uid of call.participants.keys()) {
    sendToUser(uid, "CALL_STARTED", {
      call_id: callId,
      channel_id: call.dmChannelId,
      participants,
    });
  }

  return {};
}

export function declineCall(callId: string, userId: string): { error?: string } {
  const call = activeCalls.get(callId);
  if (!call) return { error: "Call not found" };

  // For 1:1 DM: declining ends the call
  // For group: just don't ring this person anymore
  const db = getDb();
  const channelParticipants = db.query(
    "SELECT user_id FROM dm_participants WHERE dm_channel_id = ? AND status = 'active'"
  ).all(call.dmChannelId) as any[];

  if (channelParticipants.length <= 2) {
    // 1:1 — end call
    endCall(callId, "declined");
  } else {
    // Group — just notify caller
    sendToUser(call.startedBy, "CALL_DECLINED", { call_id: callId, user_id: userId });
  }

  return {};
}

export function leaveCall(callId: string, userId: string): { error?: string } {
  const call = activeCalls.get(callId);
  if (!call) return { error: "Call not found" };
  if (!call.participants.has(userId)) return { error: "Not in this call" };

  call.participants.delete(userId);

  // Update DB
  const db = getDb();
  db.run(
    "UPDATE voice_call_participants SET left_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE call_id = ? AND user_id = ?",
    [callId, userId]
  );

  if (call.participants.size === 0) {
    // No one left — start 3 min rejoin timer, then end
    call.pendingRejoins.set(userId, setTimeout(() => {
      call.pendingRejoins.delete(userId);
      if (call.participants.size === 0 && call.pendingRejoins.size === 0) {
        endCall(callId, "empty");
      }
    }, CALL_REJOIN_TIMEOUT_MS));

    // Notify the leaving user
    sendToUser(userId, "CALL_USER_LEFT", {
      call_id: callId,
      user_id: userId,
      can_rejoin: true,
      timeout_seconds: CALL_REJOIN_TIMEOUT_MS / 1000,
    });
  } else {
    // Others still in call — set rejoin timer for this user
    call.pendingRejoins.set(userId, setTimeout(() => {
      call.pendingRejoins.delete(userId);
      sendToUser(userId, "CALL_ENDED", { call_id: callId, channel_id: call.dmChannelId, reason: "rejoin_expired" });
    }, CALL_REJOIN_TIMEOUT_MS));

    // Notify remaining participants
    for (const uid of call.participants.keys()) {
      sendToUser(uid, "CALL_USER_LEFT", {
        call_id: callId,
        user_id: userId,
        can_rejoin: true,
        timeout_seconds: CALL_REJOIN_TIMEOUT_MS / 1000,
      });
    }

    // Notify leaving user
    sendToUser(userId, "CALL_USER_LEFT", {
      call_id: callId,
      user_id: userId,
      can_rejoin: true,
      timeout_seconds: CALL_REJOIN_TIMEOUT_MS / 1000,
    });
  }

  return {};
}

export function rejoinCall(callId: string, userId: string): { error?: string } {
  const call = activeCalls.get(callId);
  if (!call) return { error: "Call not found or ended" };

  // Clear rejoin timer
  const timer = call.pendingRejoins.get(userId);
  if (timer) {
    clearTimeout(timer);
    call.pendingRejoins.delete(userId);
  }

  call.participants.set(userId, { userId, isMuted: false, isDeafened: false, joinedAt: Date.now() });

  // Update DB
  const db = getDb();
  db.run(
    "INSERT OR REPLACE INTO voice_call_participants (call_id, user_id, left_at) VALUES (?, ?, NULL)",
    [callId, userId]
  );

  const user = getPublicUser(userId);
  const participants = getCallParticipantList(call);

  // Notify all participants
  for (const uid of call.participants.keys()) {
    sendToUser(uid, "CALL_USER_JOINED", {
      call_id: callId,
      user: user,
      participants,
    });
  }

  return {};
}

export function toggleMute(callId: string, userId: string): { error?: string; isMuted?: boolean } {
  const call = activeCalls.get(callId);
  if (!call) return { error: "Call not found" };
  const p = call.participants.get(userId);
  if (!p) return { error: "Not in this call" };

  p.isMuted = !p.isMuted;

  for (const uid of call.participants.keys()) {
    sendToUser(uid, "CALL_MUTE_UPDATE", {
      call_id: callId,
      user_id: userId,
      is_muted: p.isMuted,
      is_deafened: p.isDeafened,
    });
  }

  return { isMuted: p.isMuted };
}

export function toggleDeafen(callId: string, userId: string): { error?: string; isDeafened?: boolean } {
  const call = activeCalls.get(callId);
  if (!call) return { error: "Call not found" };
  const p = call.participants.get(userId);
  if (!p) return { error: "Not in this call" };

  p.isDeafened = !p.isDeafened;
  // Deafen also mutes
  if (p.isDeafened) p.isMuted = true;

  for (const uid of call.participants.keys()) {
    sendToUser(uid, "CALL_MUTE_UPDATE", {
      call_id: callId,
      user_id: userId,
      is_muted: p.isMuted,
      is_deafened: p.isDeafened,
    });
  }

  return { isDeafened: p.isDeafened };
}

export function getCallForChannel(dmChannelId: string): ActiveCall | null {
  const callId = channelToCall.get(dmChannelId);
  if (!callId) return null;
  return activeCalls.get(callId) || null;
}

export function getCallById(callId: string): ActiveCall | null {
  return activeCalls.get(callId) || null;
}

// Clean up when user disconnects from WS
export function handleUserDisconnect(userId: string) {
  for (const [callId, call] of activeCalls) {
    if (call.participants.has(userId)) {
      leaveCall(callId, userId);
    }
  }
}

// Get ICE server configuration
export function getIceServers() {
  const stun = process.env.TULPO_STUN_SERVERS || "stun:stun.l.google.com:19302";
  const servers: any[] = stun.split(",").map(s => ({ urls: s.trim() }));

  const turn = process.env.TULPO_TURN_SERVERS;
  if (turn) {
    // Format: turn:host:port?user=xxx&pass=yyy
    servers.push({ urls: turn });
  }

  return servers;
}
