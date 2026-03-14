<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  import { friendsStore } from '$lib/stores/friends.svelte';
  import { wsClient } from '$lib/ws.svelte';
  import { api } from '$lib/api';

  let unsubs: (() => void)[] = [];
  let showUserMenu = $state(false);

  // View state: 'friends' or 'dm'
  type View = 'friends' | 'dm';
  let currentView = $state<View>('friends');

  // Friends tab state
  type FriendsTab = 'online' | 'all' | 'pending' | 'add';
  let activeTab = $state<FriendsTab>('online');

  // Add friend form
  let addUsername = $state('');
  let addNote = $state('');
  let addError = $state('');
  let addSuccess = $state('');
  let addLoading = $state(false);

  // DM sidebar search
  let dmSearch = $state('');

  // Track last DM activity per user ID for sorting
  let dmActivity = $state<Record<string, number>>({});

  // Unread message count per user ID
  let unreadCounts = $state<Record<string, number>>({});

  // DM chat state
  let activeDmChannelId = $state<string | null>(null);
  let activeDmUser = $state<any>(null);
  let messages = $state<any[]>([]);
  let messageInput = $state('');
  let messagesLoading = $state(false);
  let sendingMessage = $state(false);
  let rateLimitedUntil = $state(0);
  let rateLimitTimer: ReturnType<typeof setInterval> | null = null;
  let messagesContainer: HTMLDivElement | undefined = $state();

  // Context menu state
  let contextMenu = $state<{ x: number; y: number; type: 'friend' | 'group'; friend?: any; channelId?: string; channelName?: string; myStatus?: string } | null>(null);

  // Confirmation dialog
  let confirmDialog = $state<{ title: string; message: string; onConfirm: () => void; danger?: boolean } | null>(null);

  // New DM / Group popup
  let showNewDmPopup = $state(false);
  let selectedForGroup = $state<string[]>([]);
  let groupName = $state('');
  let groupDescription = $state('');
  let groupCreating = $state(false);

  // Group channels from backend
  let dmChannels = $state<any[]>([]);

  // Hidden friend IDs (hidden from sidebar)
  let hiddenUserIds = $state<Set<string>>(new Set());

  // Group settings panel
  let showGroupSettings = $state(false);
  let groupInfo = $state<any>(null);
  let editGroupName = $state('');
  let editGroupDesc = $state('');

  // Add members to group popup
  let showAddMembersPopup = $state(false);
  let addMembersSelected = $state<string[]>([]);

  // Delete group dialog
  let deleteGroupDialog = $state<{ channelId: string; channelName: string; myStatus: string; alsoLeave: boolean } | null>(null);

  let contextMenuRef: HTMLDivElement | undefined = $state();

  function handleContextMenu(e: MouseEvent, type: 'friend' | 'group', data: any) {
    e.preventDefault();
    e.stopPropagation();
    contextMenu = { x: e.clientX, y: e.clientY, type, ...data };
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function handleWindowClick(e: MouseEvent) {
    if (contextMenu && contextMenuRef && !contextMenuRef.contains(e.target as Node)) {
      closeContextMenu();
    }
  }

  async function hideDm(channelId: string) {
    await api.post(`/dms/${channelId}/hide`);
    dmChannels = dmChannels.filter(c => c.id !== channelId);
    closeContextMenu();
  }

  async function removeFriend(friendId: string) {
    const friend = friendsStore.friends.find(f => f.id === friendId);
    if (!friend) return;
    confirmDialog = {
      title: 'Remove Friend',
      message: `Are you sure you want to remove ${friend.user.display_name || friend.user.username} as a friend?`,
      danger: true,
      onConfirm: async () => {
        await friendsStore.removeFriend(friendId);
        confirmDialog = null;
        closeContextMenu();
        if (activeDmUser?.id === friend.user.id) goToFriends();
      }
    };
    closeContextMenu();
  }

  async function leaveGroup(channelId: string, channelName: string) {
    confirmDialog = {
      title: 'Leave Group',
      message: `Are you sure you want to leave "${channelName}"? You can still see the chat history.`,
      danger: true,
      onConfirm: async () => {
        await api.post(`/dms/${channelId}/leave`);
        const ch = dmChannels.find(c => c.id === channelId);
        if (ch) ch.my_status = 'left';
        dmChannels = [...dmChannels];
        confirmDialog = null;
        if (activeDmChannelId === channelId) goToFriends();
      }
    };
    closeContextMenu();
  }

  async function deleteChannel(channelId: string) {
    await api.delete(`/dms/${channelId}`);
    dmChannels = dmChannels.filter(c => c.id !== channelId);
    closeContextMenu();
    if (activeDmChannelId === channelId) goToFriends();
  }

  function toggleGroupMember(userId: string) {
    if (selectedForGroup.includes(userId)) {
      selectedForGroup = selectedForGroup.filter(id => id !== userId);
    } else {
      selectedForGroup = [...selectedForGroup, userId];
    }
  }

  async function createGroup() {
    if (!groupName.trim() || selectedForGroup.length < 1) return;
    groupCreating = true;
    try {
      const { channel_id } = await api.post<{ channel_id: string }>('/dms/group', {
        name: groupName.trim(),
        description: groupDescription.trim() || null,
        user_ids: selectedForGroup,
      });
      showNewDmPopup = false;
      groupName = '';
      groupDescription = '';
      selectedForGroup = [];
      await loadDmChannels();
      // Open the new group
      openGroupDm(channel_id);
    } catch (err: any) {
      console.error('Failed to create group:', err);
    } finally {
      groupCreating = false;
    }
  }

  async function startDmFromPopup(userId: string) {
    showNewDmPopup = false;
    const friend = friendsStore.friends.find(f => f.user.id === userId);
    if (friend) openDm(friend);
  }

  async function loadDmChannels() {
    try {
      dmChannels = await api.get<any[]>('/dms');
    } catch { /* ignore */ }
  }

  async function openGroupSettings() {
    if (!activeDmChannelId) return;
    try {
      groupInfo = await api.get<any>(`/dms/${activeDmChannelId}/info`);
      editGroupName = groupInfo.name || '';
      editGroupDesc = groupInfo.description || '';
      showGroupSettings = true;
    } catch (err: any) {
      console.error('Failed to load group info:', err);
    }
  }

  async function saveGroupSettings() {
    if (!activeDmChannelId) return;
    try {
      await api.patch(`/dms/${activeDmChannelId}`, {
        name: editGroupName,
        description: editGroupDesc,
      });
      // Update local
      const ch = dmChannels.find(c => c.id === activeDmChannelId);
      if (ch) {
        ch.name = editGroupName.trim();
        ch.description = editGroupDesc.trim();
        dmChannels = [...dmChannels];
      }
      if (activeDmUser?.is_group) {
        activeDmUser = { ...activeDmUser, username: editGroupName.trim(), display_name: editGroupName.trim() };
      }
      showGroupSettings = false;
    } catch (err: any) {
      console.error('Failed to save group settings:', err);
    }
  }

  async function kickMember(userId: string) {
    if (!activeDmChannelId) return;
    const member = groupInfo?.participants?.find((p: any) => p.id === userId);
    confirmDialog = {
      title: 'Remove Member',
      message: `Remove ${member?.display_name || member?.username || 'this user'} from the group?`,
      danger: true,
      onConfirm: async () => {
        await api.delete(`/dms/${activeDmChannelId}/members/${userId}`);
        groupInfo = { ...groupInfo, participants: groupInfo.participants.filter((p: any) => p.id !== userId) };
        confirmDialog = null;
      }
    };
  }

  async function addMembersToGroup() {
    if (!activeDmChannelId || addMembersSelected.length === 0) return;
    try {
      await api.post(`/dms/${activeDmChannelId}/members`, { user_ids: addMembersSelected });
      showAddMembersPopup = false;
      addMembersSelected = [];
      // Reload group info
      groupInfo = await api.get<any>(`/dms/${activeDmChannelId}/info`);
    } catch (err: any) {
      console.error('Failed to add members:', err);
    }
  }

  async function openGroupDm(channelId: string) {
    const ch = dmChannels.find(c => c.id === channelId);
    if (!ch) return;
    activeDmUser = { id: channelId, username: ch.name, display_name: ch.name, is_group: true, owner_id: ch.owner_id, status: 'online' };
    activeDmChannelId = channelId;
    currentView = 'dm';
    messagesLoading = true;
    showGroupSettings = false;
    // Clear unread for this channel
    const { [channelId]: _, ...rest } = unreadCounts;
    unreadCounts = rest;
    try {
      messages = await api.get<any[]>(`/dms/${channelId}/messages`);
      await scrollToBottom();
    } catch (err: any) {
      console.error('Failed to open group DM:', err);
    } finally {
      messagesLoading = false;
    }
  }

  onMount(() => {
    auth.init().then(() => {
      if (!auth.isAuthenticated) {
        goto('/auth/login');
        return;
      }

      wsClient.connect();
      friendsStore.loadAll();
      loadDmChannels();

      unsubs.push(wsClient.on('READY', () => {}));
      unsubs.push(wsClient.on('FRIEND_REQUEST', (data) => {
        friendsStore.handleFriendRequest(data);
      }));
      unsubs.push(wsClient.on('FRIEND_ACCEPTED', (data) => {
        friendsStore.handleFriendAccepted(data);
      }));
      unsubs.push(wsClient.on('FRIEND_REMOVED', (data) => {
        friendsStore.handleFriendRemoved(data);
      }));
      unsubs.push(wsClient.on('FRIEND_REQUEST_CANCELLED', (data) => {
        friendsStore.handleFriendRequestCancelled(data);
      }));
      unsubs.push(wsClient.on('GROUP_CREATED', (_data: any) => {
        loadDmChannels();
      }));
      unsubs.push(wsClient.on('GROUP_MEMBER_LEFT', (_data: any) => {
        loadDmChannels();
      }));
      unsubs.push(wsClient.on('GROUP_UPDATED', (_data: any) => {
        loadDmChannels();
      }));
      unsubs.push(wsClient.on('GROUP_KICKED', (data: any) => {
        loadDmChannels();
        if (activeDmChannelId === data.channel_id) goToFriends();
      }));
      unsubs.push(wsClient.on('DM_MESSAGE', (data: any) => {
        const authorId = data.message?.author_id;
        const channelId = data.channel_id;
        if (authorId) {
          dmActivity = { ...dmActivity, [authorId]: Date.now() };
        }
        if (channelId === activeDmChannelId) {
          messages = [...messages, data.message];
          scrollToBottom();
        } else {
          // Not in this chat — increment unread by channel_id (groups) or author_id (1:1)
          const key = channelId || authorId;
          if (key) {
            unreadCounts = { ...unreadCounts, [key]: (unreadCounts[key] ?? 0) + 1 };
          }
        }
      }));
    });
  });

  onDestroy(() => {
    unsubs.forEach(fn => fn());
    wsClient.disconnect();
  });

  function handleSignOut() {
    auth.logout();
    goto('/auth/login');
  }

  async function handleSendRequest() {
    if (!addUsername.trim()) return;
    addError = '';
    addSuccess = '';
    addLoading = true;
    try {
      const result = await friendsStore.sendRequest(addUsername.trim(), addNote.trim() || null);
      addSuccess = result.status === 'accepted'
        ? `You and ${addUsername} are now friends!`
        : `Friend request sent to ${addUsername}`;
      addUsername = '';
      addNote = '';
    } catch (err: any) {
      addError = err.message || 'Something went wrong';
    } finally {
      addLoading = false;
    }
  }

  async function openDm(friend: any) {
    activeDmUser = friend.user;
    currentView = 'dm';
    messagesLoading = true;
    // Clear unread and unhide for this user
    const { [friend.user.id]: _, ...rest } = unreadCounts;
    unreadCounts = rest;
    if (hiddenUserIds.has(friend.user.id)) {
      hiddenUserIds = new Set([...hiddenUserIds].filter(id => id !== friend.user.id));
    }

    try {
      const { channel_id } = await api.post<{ channel_id: string }>('/dms/open', { user_id: friend.user.id });
      activeDmChannelId = channel_id;
      messages = await api.get<any[]>(`/dms/${channel_id}/messages`);
      // Track activity from last message or now
      const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
      dmActivity = { ...dmActivity, [friend.user.id]: lastMsg ? new Date(lastMsg.created_at).getTime() : Date.now() };
      await scrollToBottom();
    } catch (err: any) {
      console.error('Failed to open DM:', err);
    } finally {
      messagesLoading = false;
    }
  }

  let rateLimitRemaining = $state(0);
  let isRateLimited = $derived(rateLimitRemaining > 0);

  async function sendMessage() {
    if (!messageInput.trim() || !activeDmChannelId || sendingMessage || isRateLimited) return;
    const content = messageInput.trim();
    messageInput = '';
    sendingMessage = true;

    try {
      const msg = await api.post<any>(`/dms/${activeDmChannelId}/messages`, { content });
      messages = [...messages, msg];
      if (activeDmUser) {
        dmActivity = { ...dmActivity, [activeDmUser.id]: Date.now() };
      }
      await scrollToBottom();
    } catch (err: any) {
      messageInput = content;
      if (err.status === 429 || err.message?.includes('Too many')) {
        const retryAfter = err.data?.retry_after ?? 5;
        rateLimitRemaining = retryAfter;
        if (rateLimitTimer) clearInterval(rateLimitTimer);
        rateLimitTimer = setInterval(() => {
          rateLimitRemaining--;
          if (rateLimitRemaining <= 0) {
            rateLimitRemaining = 0;
            if (rateLimitTimer) { clearInterval(rateLimitTimer); rateLimitTimer = null; }
          }
        }, 1000);
      }
      console.error('Failed to send:', err);
    } finally {
      sendingMessage = false;
    }
  }

  async function scrollToBottom() {
    await tick();
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  function goToFriends() {
    currentView = 'friends';
    activeDmChannelId = null;
    activeDmUser = null;
    messages = [];
  }

  // Derived
  let onlineFriends = $derived(
    friendsStore.friends.filter(f => f.user.status === 'online' || f.user.status === 'idle' || f.user.status === 'dnd')
  );
  let allFriends = $derived(friendsStore.friends);
  let sidebarFriends = $derived(
    friendsStore.friends
      .filter(f => {
        if (hiddenUserIds.has(f.user.id)) return false;
        if (!dmSearch.trim()) return true;
        const q = dmSearch.toLowerCase();
        return f.user.username.toLowerCase().includes(q) || (f.user.display_name?.toLowerCase().includes(q) ?? false);
      })
      .toSorted((a, b) => (dmActivity[b.user.id] ?? 0) - (dmActivity[a.user.id] ?? 0))
  );

  function renderContent(content: string): string {
    // Escape HTML first
    const escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Replace @username with styled span
    return escaped.replace(/@(\w+)/g, '<span class="text-accent bg-accent/10 rounded px-0.5">@$1</span>');
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="flex h-screen bg-bg-primary overflow-hidden">
  <!-- Server Sidebar -->
  <div class="w-[72px] flex-shrink-0 bg-bg-tertiary flex flex-col items-center py-3 gap-2">
    <button onclick={goToFriends} aria-label="Home" class="w-12 h-12 rounded-2xl bg-accent/15 hover:bg-accent/25 hover:rounded-xl transition-all duration-200 flex items-center justify-center">
      <svg class="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </button>
    <div class="w-8 h-px bg-border my-1"></div>
    <button aria-label="Create server" class="w-12 h-12 rounded-2xl bg-bg-secondary hover:bg-success/15 hover:rounded-xl transition-all duration-200 flex items-center justify-center group">
      <svg class="w-5 h-5 text-success/70 group-hover:text-success transition-colors duration-150" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
    </button>
    <button aria-label="Explore servers" class="w-12 h-12 rounded-2xl bg-bg-secondary hover:bg-accent/15 hover:rounded-xl transition-all duration-200 flex items-center justify-center group">
      <svg class="w-5 h-5 text-text-muted group-hover:text-accent transition-colors duration-150" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>
    </button>
  </div>

  <!-- Channel Sidebar -->
  <div class="hidden sm:flex w-60 flex-shrink-0 bg-bg-secondary flex-col border-r border-border">
    <div class="p-2 border-b border-border">
      <div class="relative">
        <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input type="text" bind:value={dmSearch} placeholder="Find a conversation" class="w-full bg-bg-primary text-text-primary text-xs rounded-md pl-8 pr-3 py-1.5 placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/50" />
      </div>
    </div>

    <div class="p-2">
      <button
        class="w-full flex items-center gap-3 px-3 py-2 rounded-md text-text-primary text-sm font-medium transition-colors duration-150 {currentView === 'friends' ? 'bg-bg-hover/50' : 'hover:bg-bg-hover/30'}"
        onclick={goToFriends}
      >
        <svg class="w-4 h-4 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        Friends
        {#if friendsStore.pendingCount > 0}
          <span class="ml-auto bg-danger text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{friendsStore.pendingCount}</span>
        {/if}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-2">
      <div class="flex items-center justify-between px-2 mb-2 mt-2">
        <h3 class="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em]">Direct Messages</h3>
        <button aria-label="New DM" onclick={() => { showNewDmPopup = true; }} class="text-text-muted hover:text-text-secondary transition-colors">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
      </div>

      <!-- Group DMs -->
      {#each dmChannels.filter(c => c.is_group && c.my_status !== 'hidden') as channel (channel.id)}
        <button
          class="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors duration-150 text-left group {activeDmChannelId === channel.id ? 'bg-bg-hover/70' : 'hover:bg-bg-hover/50'}"
          onclick={() => openGroupDm(channel.id)}
          oncontextmenu={(e) => handleContextMenu(e, 'group', { channelId: channel.id, channelName: channel.name, myStatus: channel.my_status })}
        >
          <div class="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-xs font-bold text-accent flex-shrink-0">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <span class="text-sm text-text-secondary group-hover:text-text-primary truncate flex-1">{channel.name}</span>
          {#if unreadCounts[channel.id]}
            <span class="bg-danger text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0">{unreadCounts[channel.id]}</span>
          {:else if channel.my_status === 'left'}
            <span class="text-[10px] text-text-muted flex-shrink-0">Left</span>
          {/if}
        </button>
      {/each}

      <!-- Friend DMs -->
      {#if sidebarFriends.length > 0}
        {#each sidebarFriends as friend (friend.id)}
          <button
            class="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors duration-150 text-left group {activeDmUser?.id === friend.user.id ? 'bg-bg-hover/70' : 'hover:bg-bg-hover/50'}"
            onclick={() => openDm(friend)}
            oncontextmenu={(e) => handleContextMenu(e, 'friend', { friend: friend })}
          >
            <div class="relative flex-shrink-0">
              <div class="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-xs font-bold text-accent">
                {friend.user.username.charAt(0).toUpperCase()}
              </div>
              <div
                class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg-secondary"
                class:bg-success={friend.user.status === 'online'}
                class:bg-warning={friend.user.status === 'idle'}
                class:bg-danger={friend.user.status === 'dnd'}
                class:bg-text-muted={friend.user.status === 'offline'}
              ></div>
            </div>
            <span class="text-sm text-text-secondary group-hover:text-text-primary truncate flex-1">{friend.user.display_name || friend.user.username}</span>
            {#if unreadCounts[friend.user.id]}
              <span class="bg-danger text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0">{unreadCounts[friend.user.id]}</span>
            {/if}
          </button>
        {/each}
      {:else if dmSearch.trim()}
        <p class="text-xs text-text-muted px-2">No results</p>
      {:else if friendsStore.friends.length === 0 && dmChannels.filter(c => c.is_group).length === 0}
        <p class="text-xs text-text-muted px-2">Add friends to start chatting</p>
      {/if}
    </div>

    <!-- User area -->
    <div class="h-[52px] flex items-center gap-2 px-2 bg-bg-primary/50 border-t border-border relative">
      <div class="relative">
        <div class="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-xs font-bold text-accent">{auth.user?.username?.charAt(0).toUpperCase() ?? '?'}</div>
        <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-bg-secondary" class:bg-success={wsClient.status === 'connected'} class:bg-warning={wsClient.status === 'connecting' || wsClient.status === 'reconnecting'} class:bg-danger={wsClient.status === 'disconnected'}></div>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-text-primary truncate">{auth.user?.username ?? ''}</p>
        <p class="text-[11px] text-text-muted truncate capitalize">{wsClient.status === 'connected' ? 'Online' : wsClient.status}</p>
      </div>
      <button aria-label="User settings" onclick={() => goto('/settings')} class="w-8 h-8 rounded-md flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-all duration-150">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
      </button>
    </div>
  </div>

  <!-- Main content area -->
  <div class="flex-1 flex flex-col min-w-0">
    {#if currentView === 'dm' && activeDmUser}
      <!-- DM Chat View -->
      <div class="h-12 flex-shrink-0 flex items-center px-4 border-b border-border gap-3">
        <div class="relative">
          {#if activeDmUser.is_group}
            <div class="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center">
              <svg class="w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </div>
          {:else}
            <div class="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center text-[10px] font-bold text-accent">{activeDmUser.username.charAt(0).toUpperCase()}</div>
            <div class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-bg-primary" class:bg-success={activeDmUser.status === 'online'} class:bg-text-muted={activeDmUser.status !== 'online'}></div>
          {/if}
        </div>
        <span class="text-[15px] font-semibold text-text-primary flex-1">{activeDmUser.display_name || activeDmUser.username}</span>
        {#if activeDmUser.is_group}
          <button onclick={openGroupSettings} class="w-8 h-8 rounded-md flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-all duration-150" aria-label="Group settings">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          </button>
        {/if}
      </div>

      <!-- Messages -->
      <div class="flex-1 overflow-y-auto px-4 py-4" bind:this={messagesContainer}>
        {#if messagesLoading}
          <div class="flex items-center justify-center h-full">
            <p class="text-text-muted text-sm">Loading messages...</p>
          </div>
        {:else if messages.length === 0}
          <div class="flex flex-col items-center justify-center h-full text-center">
            <div class="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <div class="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center text-lg font-bold text-accent">{activeDmUser.username.charAt(0).toUpperCase()}</div>
            </div>
            <h3 class="text-xl font-bold text-text-primary mb-1">{activeDmUser.display_name || activeDmUser.username}</h3>
            <p class="text-sm text-text-secondary">This is the beginning of your conversation.</p>
          </div>
        {:else}
          <div>
            {#each messages as msg, i (msg.id)}
              {@const prevMsg = i > 0 ? messages[i - 1] : null}
              {@const isSystem = msg.content?.startsWith('[system]') || msg.is_system}
              {@const sameAuthor = !isSystem && prevMsg?.author_id === msg.author_id && !prevMsg?.content?.startsWith('[system]')}
              {@const timeDiff = prevMsg ? new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() : Infinity}
              {@const grouped = sameAuthor && timeDiff < 300000}

              {#if isSystem}
                <div class="flex items-center gap-2 px-2 py-1 {i > 0 ? 'mt-2' : ''}">
                  <div class="flex-1 h-px bg-border"></div>
                  <span class="text-[12px] text-text-muted italic whitespace-nowrap">{msg.content.replace('[system] ', '')}</span>
                  <div class="flex-1 h-px bg-border"></div>
                </div>
              {:else if !grouped}
                <div class="flex items-start gap-4 px-2 py-0.5 hover:bg-bg-message-hover rounded-md transition-colors duration-100 {i > 0 ? 'mt-4' : ''}">
                  <div class="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center text-sm font-bold text-accent flex-shrink-0 mt-0.5">
                    {msg.author_username.charAt(0).toUpperCase()}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-baseline gap-2">
                      <span class="text-[15px] font-semibold text-text-primary">{msg.author_display_name || msg.author_username}</span>
                      <span class="text-[11px] text-text-muted">{formatTime(msg.created_at)}</span>
                    </div>
                    <p class="text-[15px] text-text-secondary leading-[1.375rem] break-words mt-0.5">{@html renderContent(msg.content)}</p>
                  </div>
                </div>
              {:else}
                <div class="flex items-start gap-4 px-2 py-0.5 hover:bg-bg-message-hover rounded-md transition-colors duration-100 group">
                  <div class="w-10 flex-shrink-0 flex items-center justify-center">
                    <span class="text-[10px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity select-none">{new Date(msg.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[15px] text-text-secondary leading-[1.375rem] break-words">{@html renderContent(msg.content)}</p>
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>

      <!-- Message input -->
      <div class="px-4 pb-4">
        {#if isRateLimited}
          <div class="text-center text-xs text-warning py-2">Slow down — you can send again in {rateLimitRemaining}s</div>
        {/if}
        <form onsubmit={(e) => { e.preventDefault(); sendMessage(); }} class="relative">
          <input
            type="text"
            bind:value={messageInput}
            disabled={isRateLimited}
            placeholder={isRateLimited ? 'Too fast...' : `Message @${activeDmUser.username}`}
            class="w-full bg-bg-tertiary text-text-primary rounded-lg px-4 py-2.5 text-sm border border-border focus:border-accent focus:outline-none placeholder:text-text-muted transition-colors disabled:opacity-50"
          />
        </form>
      </div>
    {:else}
      <!-- Friends View -->
      <div class="h-12 flex-shrink-0 flex items-center px-4 border-b border-border gap-4">
        <svg class="w-5 h-5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        <span class="text-[15px] font-semibold text-text-primary">Friends</span>
        <div class="w-px h-6 bg-border mx-1"></div>
        <button class="text-sm px-2 py-1 rounded-md transition-colors duration-150 {activeTab === 'online' ? 'text-text-primary bg-bg-hover' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/50'}" onclick={() => activeTab = 'online'}>Online</button>
        <button class="text-sm px-2 py-1 rounded-md transition-colors duration-150 {activeTab === 'all' ? 'text-text-primary bg-bg-hover' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/50'}" onclick={() => activeTab = 'all'}>All</button>
        <button class="text-sm px-2 py-1 rounded-md transition-colors duration-150 relative {activeTab === 'pending' ? 'text-text-primary bg-bg-hover' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/50'}" onclick={() => activeTab = 'pending'}>
          Pending
          {#if friendsStore.pendingCount > 0}
            <span class="absolute -top-1 -right-1 bg-danger text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">{friendsStore.pendingCount}</span>
          {/if}
        </button>
        <button class="text-sm px-3 py-1 rounded-md font-medium transition-colors duration-150 {activeTab === 'add' ? 'text-white bg-success' : 'text-success bg-transparent hover:bg-success/10'}" onclick={() => activeTab = 'add'}>Add Friend</button>
      </div>

      <div class="flex-1 overflow-y-auto">
        {#if activeTab === 'add'}
          <div class="p-6 border-b border-border">
            <h2 class="text-[15px] font-semibold text-text-primary mb-1">Add Friend</h2>
            <p class="text-sm text-text-secondary mb-4">You can add friends by their username.</p>
            <form onsubmit={(e) => { e.preventDefault(); handleSendRequest(); }} class="flex gap-2">
              <input type="text" bind:value={addUsername} placeholder="Enter a username" class="flex-1 bg-bg-tertiary text-text-primary rounded-lg px-4 py-2.5 text-sm border border-border focus:border-accent focus:outline-none placeholder:text-text-muted transition-colors" />
              <button type="submit" disabled={!addUsername.trim() || addLoading} class="bg-accent text-bg-primary font-semibold px-6 py-2.5 rounded-lg text-sm transition-all duration-150 hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed">{addLoading ? 'Sending...' : 'Send Request'}</button>
            </form>
            <div class="mt-3">
              <input type="text" bind:value={addNote} placeholder="Add a note (optional, max 200 chars)" maxlength="200" class="w-full bg-bg-tertiary text-text-primary rounded-lg px-4 py-2 text-sm border border-border focus:border-accent focus:outline-none placeholder:text-text-muted transition-colors" />
              {#if addNote.length > 0}<p class="text-[11px] text-text-muted mt-1 text-right">{addNote.length}/200</p>{/if}
            </div>
            {#if addError}<p class="text-sm text-danger mt-3">{addError}</p>{/if}
            {#if addSuccess}<p class="text-sm text-success mt-3">{addSuccess}</p>{/if}
          </div>
        {:else if activeTab === 'pending'}
          <div class="p-4">
            {#if friendsStore.incoming.length > 0}
              <h3 class="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em] px-2 mb-2">Incoming — {friendsStore.incoming.length}</h3>
              {#each friendsStore.incoming as request (request.id)}
                <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg-hover/50 group transition-colors duration-150">
                  <div class="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-xs font-bold text-accent flex-shrink-0">{request.from.username.charAt(0).toUpperCase()}</div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-text-primary">{request.from.display_name || request.from.username}</p>
                    <p class="text-[11px] text-text-muted">{request.from.username}{#if request.note}<span class="ml-1 text-text-secondary">— {request.note}</span>{/if}</p>
                  </div>
                  <div class="flex gap-1.5">
                    <button onclick={() => friendsStore.acceptRequest(request.id)} class="w-8 h-8 rounded-full bg-bg-tertiary hover:bg-success/15 flex items-center justify-center transition-colors duration-150 group/btn" aria-label="Accept">
                      <svg class="w-4 h-4 text-text-muted group-hover/btn:text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </button>
                    <button onclick={() => friendsStore.rejectRequest(request.id)} class="w-8 h-8 rounded-full bg-bg-tertiary hover:bg-danger/15 flex items-center justify-center transition-colors duration-150 group/btn" aria-label="Reject">
                      <svg class="w-4 h-4 text-text-muted group-hover/btn:text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                </div>
              {/each}
            {/if}
            {#if friendsStore.outgoing.length > 0}
              <h3 class="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em] px-2 mb-2 {friendsStore.incoming.length > 0 ? 'mt-6' : ''}">Outgoing — {friendsStore.outgoing.length}</h3>
              {#each friendsStore.outgoing as request (request.id)}
                <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg-hover/50 group transition-colors duration-150">
                  <div class="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-xs font-bold text-accent flex-shrink-0">{request.to.username.charAt(0).toUpperCase()}</div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-text-primary">{request.to.display_name || request.to.username}</p>
                    <p class="text-[11px] text-text-muted">{request.to.username}{#if request.note}<span class="ml-1 text-text-secondary">— {request.note}</span>{/if}</p>
                  </div>
                  <button onclick={() => friendsStore.cancelRequest(request.id)} class="w-8 h-8 rounded-full bg-bg-tertiary hover:bg-danger/15 flex items-center justify-center transition-colors duration-150 group/btn" aria-label="Cancel">
                    <svg class="w-4 h-4 text-text-muted group-hover/btn:text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              {/each}
            {/if}
            {#if friendsStore.incoming.length === 0 && friendsStore.outgoing.length === 0}
              <div class="flex flex-col items-center justify-center py-20 text-center"><p class="text-text-secondary text-sm">No pending friend requests.</p></div>
            {/if}
          </div>
        {:else if activeTab === 'online'}
          <div class="p-4">
            {#if onlineFriends.length > 0}
              <h3 class="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em] px-2 mb-2">Online — {onlineFriends.length}</h3>
              {#each onlineFriends as friend (friend.id)}
                <button onclick={() => openDm(friend)} class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg-hover/50 group transition-colors duration-150 text-left">
                  <div class="relative">
                    <div class="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-xs font-bold text-accent">{friend.user.username.charAt(0).toUpperCase()}</div>
                    <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-bg-primary bg-success"></div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-text-primary">{friend.user.display_name || friend.user.username}</p>
                    <p class="text-[11px] text-text-muted capitalize">{friend.user.status}</p>
                  </div>
                </button>
              {/each}
            {:else}
              <div class="flex flex-col items-center justify-center py-20 text-center"><p class="text-text-secondary text-sm">No friends online right now.</p></div>
            {/if}
          </div>
        {:else}
          <div class="p-4">
            {#if allFriends.length > 0}
              <h3 class="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em] px-2 mb-2">All Friends — {allFriends.length}</h3>
              {#each allFriends as friend (friend.id)}
                <button onclick={() => openDm(friend)} class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg-hover/50 group transition-colors duration-150 text-left">
                  <div class="relative">
                    <div class="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-xs font-bold text-accent">{friend.user.username.charAt(0).toUpperCase()}</div>
                    <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-bg-primary" class:bg-success={friend.user.status === 'online'} class:bg-warning={friend.user.status === 'idle'} class:bg-danger={friend.user.status === 'dnd'} class:bg-text-muted={friend.user.status === 'offline'}></div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-text-primary">{friend.user.display_name || friend.user.username}</p>
                    <p class="text-[11px] text-text-muted capitalize">{friend.user.status}</p>
                  </div>
                </button>
              {/each}
            {:else}
              <div class="flex flex-col items-center justify-center py-20 text-center">
                <div class="relative w-40 h-40 mx-auto mb-6">
                  <div class="absolute inset-0 rounded-full bg-accent/5"></div>
                  <div class="absolute inset-0 flex items-center justify-center">
                    <div class="w-16 h-16 rounded-2xl bg-accent/15 flex items-center justify-center">
                      <svg class="w-8 h-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    </div>
                  </div>
                </div>
                <p class="text-text-secondary text-sm mb-4">No friends added yet.</p>
                <button onclick={() => activeTab = 'add'} class="bg-accent text-bg-primary font-semibold py-2 px-5 rounded-lg text-sm transition-all duration-150 hover:bg-accent-hover">Add Friend</button>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<!-- Context Menu -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:window onclick={handleWindowClick} />
{#if contextMenu}
  <div
    bind:this={contextMenuRef}
    class="fixed bg-bg-secondary border border-border rounded-lg shadow-lg py-1.5 min-w-[180px] z-50"
    style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
  >
    {#if contextMenu.type === 'friend' && contextMenu.friend}
      {@const friendData = contextMenu.friend}
      <button
        class="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer"
        onmousedown={async () => {
          const uid = friendData.user.id;
          closeContextMenu();
          hiddenUserIds = new Set([...hiddenUserIds, uid]);
          if (activeDmUser?.id === uid) goToFriends();
          try {
            const channelRes = await api.post<{ channel_id: string }>('/dms/open', { user_id: uid });
            await api.post(`/dms/${channelRes.channel_id}/hide`);
          } catch { /* already hidden locally */ }
        }}
      >Hide from view</button>
      <div class="h-px bg-border mx-2 my-1"></div>
      <button
        class="w-full text-left px-3 py-1.5 text-sm text-danger hover:bg-danger/10 transition-colors cursor-pointer"
        onmousedown={() => {
          const fid = friendData.id;
          const fname = friendData.user.display_name || friendData.user.username;
          const fUserId = friendData.user.id;
          closeContextMenu();
          confirmDialog = {
            title: 'Remove Friend',
            message: `Are you sure you want to remove ${fname} as a friend?`,
            danger: true,
            onConfirm: async () => {
              await friendsStore.removeFriend(fid);
              confirmDialog = null;
              if (activeDmUser?.id === fUserId) goToFriends();
            }
          };
        }}
      >Remove Friend</button>
    {:else if contextMenu.type === 'group'}
      {@const chId = contextMenu.channelId}
      {@const chName = contextMenu.channelName}
      {@const chStatus = contextMenu.myStatus}
      {#if chStatus === 'active'}
        <button
          class="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer"
          onmousedown={() => {
            const id = chId;
            const name = chName;
            closeContextMenu();
            confirmDialog = {
              title: 'Leave Group',
              message: `Are you sure you want to leave "${name}"? You can still see the chat history.`,
              danger: true,
              onConfirm: async () => {
                await api.post(`/dms/${id}/leave`);
                const ch = dmChannels.find(c => c.id === id);
                if (ch) ch.my_status = 'left';
                dmChannels = [...dmChannels];
                confirmDialog = null;
                if (activeDmChannelId === id) goToFriends();
              }
            };
          }}
        >Leave Group</button>
      {/if}
      <button
        class="w-full text-left px-3 py-1.5 text-sm text-danger hover:bg-danger/10 transition-colors cursor-pointer"
        onmousedown={() => {
          const id = chId;
          const name = chName;
          const status = chStatus;
          closeContextMenu();
          deleteGroupDialog = { channelId: id!, channelName: name!, myStatus: status!, alsoLeave: false };
        }}
      >Delete</button>
    {/if}
  </div>
{/if}

<!-- Group Settings Panel -->
{#if showGroupSettings && groupInfo}
  <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fixed inset-0" onclick={() => showGroupSettings = false}></div>
    <div class="bg-bg-secondary border border-border rounded-xl p-6 max-w-md w-full mx-4 shadow-xl relative z-10 max-h-[80vh] overflow-y-auto">
      <h3 class="text-lg font-semibold text-text-primary mb-4">Group Settings</h3>

      <div class="space-y-3 mb-6">
        <div>
          <label class="text-xs text-text-muted uppercase tracking-wide mb-1 block">Name</label>
          <input type="text" bind:value={editGroupName} class="w-full bg-bg-tertiary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none placeholder:text-text-muted transition-colors" />
        </div>
        <div>
          <label class="text-xs text-text-muted uppercase tracking-wide mb-1 block">Description</label>
          <input type="text" bind:value={editGroupDesc} placeholder="No description" class="w-full bg-bg-tertiary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none placeholder:text-text-muted transition-colors" />
        </div>
        <button onclick={saveGroupSettings} class="bg-accent text-bg-primary font-medium px-4 py-2 rounded-lg text-sm hover:bg-accent-hover transition-colors cursor-pointer">Save Changes</button>
      </div>

      <div class="border-t border-border pt-4">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-semibold text-text-primary">Members ({groupInfo.participants?.filter((p: any) => p.member_status === 'active').length})</h4>
          <button onclick={() => { showAddMembersPopup = true; addMembersSelected = []; }} class="text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer">+ Add</button>
        </div>
        <div class="space-y-1">
          {#each groupInfo.participants?.filter((p: any) => p.member_status === 'active') as member (member.id)}
            <div class="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-bg-hover/50 transition-colors">
              <div class="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center text-xs font-bold text-accent flex-shrink-0">
                {member.username.charAt(0).toUpperCase()}
              </div>
              <span class="text-sm text-text-secondary flex-1">{member.display_name || member.username}</span>
              {#if member.id === groupInfo.owner_id}
                <span class="text-[10px] text-accent bg-accent/10 rounded px-1.5 py-0.5">Owner</span>
              {:else if auth.user?.id === groupInfo.owner_id}
                <button onclick={() => kickMember(member.id)} class="text-xs text-danger hover:text-danger/80 transition-colors cursor-pointer">Kick</button>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <div class="flex justify-end mt-4">
        <button onclick={() => showGroupSettings = false} class="px-4 py-2 text-sm rounded-lg bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors border border-border cursor-pointer">Close</button>
      </div>
    </div>
  </div>
{/if}

<!-- Add Members to Group -->
{#if showAddMembersPopup}
  <div class="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fixed inset-0" onclick={() => showAddMembersPopup = false}></div>
    <div class="bg-bg-secondary border border-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl relative z-10">
      <h3 class="text-lg font-semibold text-text-primary mb-3">Add Members</h3>
      <div class="max-h-48 overflow-y-auto space-y-1 mb-4">
        {#each friendsStore.friends.filter(f => !groupInfo?.participants?.some((p: any) => p.id === f.user.id && p.member_status === 'active')) as friend (friend.id)}
          <button
            class="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left cursor-pointer {addMembersSelected.includes(friend.user.id) ? 'bg-accent/10' : 'hover:bg-bg-hover/50'}"
            onclick={() => {
              if (addMembersSelected.includes(friend.user.id)) {
                addMembersSelected = addMembersSelected.filter(id => id !== friend.user.id);
              } else {
                addMembersSelected = [...addMembersSelected, friend.user.id];
              }
            }}
          >
            <div class="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center text-xs font-bold text-accent flex-shrink-0">
              {friend.user.username.charAt(0).toUpperCase()}
            </div>
            <span class="text-sm text-text-secondary flex-1">{friend.user.display_name || friend.user.username}</span>
            {#if addMembersSelected.includes(friend.user.id)}
              <div class="w-5 h-5 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                <svg class="w-3 h-3 text-bg-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
            {/if}
          </button>
        {/each}
      </div>
      <div class="flex justify-end gap-3">
        <button onclick={() => showAddMembersPopup = false} class="px-4 py-2 text-sm rounded-lg bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors border border-border cursor-pointer">Cancel</button>
        <button onclick={addMembersToGroup} class="px-4 py-2 text-sm rounded-lg font-medium bg-accent text-bg-primary hover:bg-accent-hover transition-colors cursor-pointer {addMembersSelected.length === 0 ? 'opacity-50' : ''}">Add ({addMembersSelected.length})</button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Group Dialog -->
{#if deleteGroupDialog}
  <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fixed inset-0" onclick={() => deleteGroupDialog = null}></div>
    <div class="bg-bg-secondary border border-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl relative z-10">
      <h3 class="text-lg font-semibold text-text-primary mb-2">Delete "{deleteGroupDialog.channelName}"</h3>
      <p class="text-sm text-text-secondary mb-4">This will remove the group from your Direct Messages.</p>

      {#if deleteGroupDialog.myStatus === 'active'}
        <label class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg-hover/50 cursor-pointer transition-colors mb-4">
          <input
            type="checkbox"
            checked={deleteGroupDialog.alsoLeave}
            onchange={() => { deleteGroupDialog = { ...deleteGroupDialog!, alsoLeave: !deleteGroupDialog!.alsoLeave }; }}
            class="w-4 h-4 rounded accent-danger"
          />
          <div>
            <span class="text-sm text-text-primary">Also leave the group</span>
            <p class="text-[11px] text-text-muted">You won't receive new messages anymore</p>
          </div>
        </label>
      {/if}

      <div class="flex justify-end gap-3">
        <button
          class="px-4 py-2 text-sm rounded-lg bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors border border-border cursor-pointer"
          onclick={() => deleteGroupDialog = null}
        >Cancel</button>
        <button
          class="px-4 py-2 text-sm rounded-lg font-medium bg-danger text-white hover:bg-danger/80 transition-colors cursor-pointer"
          onclick={async () => {
            const { channelId, alsoLeave } = deleteGroupDialog!;
            if (alsoLeave) {
              await api.post(`/dms/${channelId}/leave`);
              await api.delete(`/dms/${channelId}`);
              dmChannels = dmChannels.filter(c => c.id !== channelId);
            } else {
              await api.post(`/dms/${channelId}/hide`);
              const ch = dmChannels.find(c => c.id === channelId);
              if (ch) ch.my_status = 'hidden';
              dmChannels = [...dmChannels];
            }
            if (activeDmChannelId === channelId) goToFriends();
            deleteGroupDialog = null;
          }}
        >Delete</button>
      </div>
    </div>
  </div>
{/if}

<!-- Confirmation Dialog -->
{#if confirmDialog}
  <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fixed inset-0" onclick={() => confirmDialog = null}></div>
    <div class="bg-bg-secondary border border-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl relative z-10">
      <h3 class="text-lg font-semibold text-text-primary mb-2">{confirmDialog.title}</h3>
      <p class="text-sm text-text-secondary mb-6">{confirmDialog.message}</p>
      <div class="flex justify-end gap-3">
        <button
          class="px-4 py-2 text-sm rounded-lg bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors border border-border cursor-pointer"
          onclick={() => confirmDialog = null}
        >Cancel</button>
        <button
          class="px-4 py-2 text-sm rounded-lg font-medium transition-colors cursor-pointer {confirmDialog.danger ? 'bg-danger text-white hover:bg-danger/80' : 'bg-accent text-bg-primary hover:bg-accent-hover'}"
          onclick={() => confirmDialog?.onConfirm()}
        >Confirm</button>
      </div>
    </div>
  </div>
{/if}

<!-- New DM / Group Popup -->
{#if showNewDmPopup}
  <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fixed inset-0" onclick={() => { showNewDmPopup = false; selectedForGroup = []; groupName = ''; groupDescription = ''; }}></div>
    <div class="bg-bg-secondary border border-border rounded-xl p-6 max-w-md w-full mx-4 shadow-xl relative z-10">
      <h3 class="text-lg font-semibold text-text-primary mb-1">New Message</h3>
      <p class="text-sm text-text-secondary mb-4">Select a friend to DM or multiple to create a group.</p>

      {#if selectedForGroup.length > 1}
        <!-- Group creation fields -->
        <div class="mb-4 space-y-2">
          <input
            type="text"
            bind:value={groupName}
            placeholder="Group name"
            class="w-full bg-bg-tertiary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none placeholder:text-text-muted transition-colors"
          />
          <input
            type="text"
            bind:value={groupDescription}
            placeholder="Description (optional)"
            class="w-full bg-bg-tertiary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none placeholder:text-text-muted transition-colors"
          />
        </div>
      {/if}

      <!-- Hidden groups to restore -->
      {#if dmChannels.filter(c => c.is_group && c.my_status === 'hidden').length > 0}
        <div class="mb-4">
          <h4 class="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">Hidden Groups</h4>
          <div class="space-y-1">
            {#each dmChannels.filter(c => c.is_group && c.my_status === 'hidden') as group (group.id)}
              <button
                class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-hover/50 transition-colors text-left cursor-pointer"
                onclick={async () => {
                  // Unhide: set status back to active/left
                  const ch = dmChannels.find(c => c.id === group.id);
                  if (ch) {
                    try {
                      await api.post(`/dms/${group.id}/unhide`);
                    } catch { /* ignore */ }
                    ch.my_status = 'active';
                    dmChannels = [...dmChannels];
                  }
                  showNewDmPopup = false;
                  selectedForGroup = [];
                  openGroupDm(group.id);
                }}
              >
                <div class="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                  <svg class="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                </div>
                <span class="text-sm text-text-secondary flex-1">{group.name}</span>
                <span class="text-[10px] text-accent">Restore</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <div class="max-h-60 overflow-y-auto space-y-1 mb-4">
        {#each friendsStore.friends as friend (friend.id)}
          <button
            class="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left {selectedForGroup.includes(friend.user.id) ? 'bg-accent/10' : 'hover:bg-bg-hover/50'}"
            onclick={() => toggleGroupMember(friend.user.id)}
          >
            <div class="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-xs font-bold text-accent flex-shrink-0">
              {friend.user.username.charAt(0).toUpperCase()}
            </div>
            <span class="text-sm text-text-secondary flex-1">{friend.user.display_name || friend.user.username}</span>
            {#if selectedForGroup.includes(friend.user.id)}
              <div class="w-5 h-5 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                <svg class="w-3 h-3 text-bg-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
            {/if}
          </button>
        {/each}
        {#if friendsStore.friends.length === 0 && dmChannels.filter(c => c.is_group && c.my_status === 'hidden').length === 0}
          <p class="text-sm text-text-muted text-center py-4">No friends to message</p>
        {/if}
      </div>

      <div class="flex justify-end gap-3">
        <button
          class="px-4 py-2 text-sm rounded-lg bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors border border-border"
          onclick={() => { showNewDmPopup = false; selectedForGroup = []; groupName = ''; groupDescription = ''; }}
        >Cancel</button>
        {#if selectedForGroup.length === 1}
          <button
            class="px-4 py-2 text-sm rounded-lg font-medium bg-accent text-bg-primary hover:bg-accent-hover transition-colors cursor-pointer"
            onclick={() => startDmFromPopup(selectedForGroup[0])}
          >Open DM</button>
        {:else if selectedForGroup.length > 1}
          <button
            class="px-4 py-2 text-sm rounded-lg font-medium transition-colors cursor-pointer {!groupName.trim() || groupCreating ? 'bg-accent/50 text-bg-primary/50' : 'bg-accent text-bg-primary hover:bg-accent-hover'}"
            onclick={() => createGroup()}
          >{groupCreating ? 'Creating...' : 'Create Group'}</button>
        {/if}
      </div>
    </div>
  </div>
{/if}
