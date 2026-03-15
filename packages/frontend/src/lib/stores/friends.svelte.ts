import { api } from "$lib/api";
import type {
  FriendWithUser,
  IncomingFriendRequest,
  OutgoingFriendRequest,
} from "@tulpo/shared";

function createFriendsStore() {
  let friends = $state<FriendWithUser[]>([]);
  let incoming = $state<IncomingFriendRequest[]>([]);
  let outgoing = $state<OutgoingFriendRequest[]>([]);
  let loading = $state(false);
  let blockedIds = $state<Set<string>>(new Set());
  let mutedIds = $state<Set<string>>(new Set());

  async function loadFriends() {
    friends = await api.get<FriendWithUser[]>("/friends");
  }

  async function loadIncoming() {
    incoming = await api.get<IncomingFriendRequest[]>("/friends/incoming");
  }

  async function loadOutgoing() {
    outgoing = await api.get<OutgoingFriendRequest[]>("/friends/outgoing");
  }

  async function loadBlocked() {
    const rows = await api.get<any[]>("/friends/blocked");
    blockedIds = new Set(rows.map(r => r.user.id));
  }

  async function loadMuted() {
    const ids = await api.get<string[]>("/friends/muted");
    mutedIds = new Set(ids);
  }

  async function loadAll() {
    loading = true;
    try {
      await Promise.all([loadFriends(), loadIncoming(), loadOutgoing(), loadBlocked(), loadMuted()]);
    } finally {
      loading = false;
    }
  }

  async function sendRequest(username: string, note?: string | null) {
    const result = await api.post<{ id?: string; status: string }>(
      "/friends/request",
      { username, note }
    );
    // Refresh lists
    if (result.status === "accepted") {
      await loadFriends();
    }
    await Promise.all([loadIncoming(), loadOutgoing()]);
    return result;
  }

  async function acceptRequest(id: string) {
    await api.post(`/friends/${id}/accept`);
    await Promise.all([loadFriends(), loadIncoming()]);
  }

  async function rejectRequest(id: string) {
    await api.delete(`/friends/${id}`);
    await loadIncoming();
  }

  async function cancelRequest(id: string) {
    await api.delete(`/friends/${id}`);
    await loadOutgoing();
  }

  async function removeFriend(id: string) {
    await api.delete(`/friends/${id}`);
    await loadFriends();
  }

  async function blockUser(userId: string) {
    await api.post(`/friends/block/${userId}`);
    blockedIds = new Set([...blockedIds, userId]);
    friends = friends.filter(f => f.user.id !== userId);
  }

  async function unblockUser(userId: string) {
    await api.delete(`/friends/block/${userId}`);
    blockedIds = new Set([...blockedIds].filter(id => id !== userId));
  }

  async function muteUser(userId: string) {
    await api.post(`/friends/mute/${userId}`);
    mutedIds = new Set([...mutedIds, userId]);
  }

  async function unmuteUser(userId: string) {
    await api.delete(`/friends/mute/${userId}`);
    mutedIds = new Set([...mutedIds].filter(id => id !== userId));
  }

  function isBlocked(userId: string) {
    return blockedIds.has(userId);
  }

  function isMuted(userId: string) {
    return mutedIds.has(userId);
  }

  // Handle WS events
  function handleFriendRequest(data: any) {
    incoming = [data, ...incoming];
  }

  function handleFriendAccepted(data: any) {
    // Remove from outgoing, add to friends
    outgoing = outgoing.filter((r) => r.to.id !== data.user.id);
    incoming = incoming.filter((r) => r.from.id !== data.user.id);
    friends = [
      ...friends,
      { id: "", user: data.user, note: null, created_at: new Date().toISOString() },
    ];
  }

  function handleFriendRemoved(data: any) {
    friends = friends.filter((f) => f.user.id !== data.user_id);
  }

  function handleFriendRequestCancelled(data: any) {
    incoming = incoming.filter((r) => r.from.id !== data.user_id);
    outgoing = outgoing.filter((r) => r.to.id !== data.user_id);
  }

  function handlePresenceUpdate(data: { user_id: string; status: string }) {
    friends = friends.map((f) =>
      f.user.id === data.user_id
        ? { ...f, user: { ...f.user, status: data.status as any } }
        : f
    );
  }

  return {
    get friends() { return friends; },
    get incoming() { return incoming; },
    get outgoing() { return outgoing; },
    get loading() { return loading; },
    get pendingCount() { return incoming.length; },
    get blockedIds() { return blockedIds; },
    get mutedIds() { return mutedIds; },
    loadAll,
    sendRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    removeFriend,
    blockUser,
    unblockUser,
    muteUser,
    unmuteUser,
    isBlocked,
    isMuted,
    handleFriendRequest,
    handleFriendAccepted,
    handleFriendRemoved,
    handleFriendRequestCancelled,
    handlePresenceUpdate,
  };
}

export const friendsStore = createFriendsStore();
