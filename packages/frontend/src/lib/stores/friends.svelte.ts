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

  async function loadFriends() {
    friends = await api.get<FriendWithUser[]>("/friends");
  }

  async function loadIncoming() {
    incoming = await api.get<IncomingFriendRequest[]>("/friends/incoming");
  }

  async function loadOutgoing() {
    outgoing = await api.get<OutgoingFriendRequest[]>("/friends/outgoing");
  }

  async function loadAll() {
    loading = true;
    try {
      await Promise.all([loadFriends(), loadIncoming(), loadOutgoing()]);
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

  return {
    get friends() { return friends; },
    get incoming() { return incoming; },
    get outgoing() { return outgoing; },
    get loading() { return loading; },
    get pendingCount() { return incoming.length; },
    loadAll,
    sendRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    removeFriend,
    handleFriendRequest,
    handleFriendAccepted,
    handleFriendRemoved,
    handleFriendRequestCancelled,
  };
}

export const friendsStore = createFriendsStore();
