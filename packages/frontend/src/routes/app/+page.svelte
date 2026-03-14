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
  let messagesContainer: HTMLDivElement | undefined = $state();

  onMount(() => {
    auth.init().then(() => {
      if (!auth.isAuthenticated) {
        goto('/auth/login');
        return;
      }

      wsClient.connect();
      friendsStore.loadAll();

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
      unsubs.push(wsClient.on('DM_MESSAGE', (data: any) => {
        const authorId = data.message?.author_id;
        if (authorId) {
          dmActivity = { ...dmActivity, [authorId]: Date.now() };
        }
        if (data.channel_id === activeDmChannelId) {
          messages = [...messages, data.message];
          scrollToBottom();
        } else if (authorId) {
          // Not in this chat — increment unread
          unreadCounts = { ...unreadCounts, [authorId]: (unreadCounts[authorId] ?? 0) + 1 };
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
    // Clear unread for this user
    const { [friend.user.id]: _, ...rest } = unreadCounts;
    unreadCounts = rest;

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

  async function sendMessage() {
    if (!messageInput.trim() || !activeDmChannelId || sendingMessage) return;
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
        if (!dmSearch.trim()) return true;
        const q = dmSearch.toLowerCase();
        return f.user.username.toLowerCase().includes(q) || (f.user.display_name?.toLowerCase().includes(q) ?? false);
      })
      .toSorted((a, b) => (dmActivity[b.user.id] ?? 0) - (dmActivity[a.user.id] ?? 0))
  );

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
        <button aria-label="New DM" onclick={() => { currentView = 'friends'; activeTab = 'add'; }} class="text-text-muted hover:text-text-secondary transition-colors">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
      </div>

      {#if sidebarFriends.length > 0}
        {#each sidebarFriends as friend (friend.id)}
          <button
            class="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors duration-150 text-left group {activeDmUser?.id === friend.user.id ? 'bg-bg-hover/70' : 'hover:bg-bg-hover/50'}"
            onclick={() => openDm(friend)}
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
      {:else if friendsStore.friends.length === 0}
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
          <div class="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center text-[10px] font-bold text-accent">{activeDmUser.username.charAt(0).toUpperCase()}</div>
          <div class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-bg-primary" class:bg-success={activeDmUser.status === 'online'} class:bg-text-muted={activeDmUser.status !== 'online'}></div>
        </div>
        <span class="text-[15px] font-semibold text-text-primary">{activeDmUser.display_name || activeDmUser.username}</span>
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
              {@const sameAuthor = prevMsg?.author_id === msg.author_id}
              {@const timeDiff = prevMsg ? new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() : Infinity}
              {@const grouped = sameAuthor && timeDiff < 300000}

              {#if !grouped}
                <div class="flex items-start gap-4 px-2 py-0.5 hover:bg-bg-message-hover rounded-md transition-colors duration-100 {i > 0 ? 'mt-4' : ''}">
                  <div class="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center text-sm font-bold text-accent flex-shrink-0 mt-0.5">
                    {msg.author_username.charAt(0).toUpperCase()}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-baseline gap-2">
                      <span class="text-[15px] font-semibold text-text-primary">{msg.author_display_name || msg.author_username}</span>
                      <span class="text-[11px] text-text-muted">{formatTime(msg.created_at)}</span>
                    </div>
                    <p class="text-[15px] text-text-secondary leading-[1.375rem] break-words mt-0.5">{msg.content}</p>
                  </div>
                </div>
              {:else}
                <div class="flex items-start gap-4 px-2 py-0.5 hover:bg-bg-message-hover rounded-md transition-colors duration-100 group">
                  <div class="w-10 flex-shrink-0 flex items-center justify-center">
                    <span class="text-[10px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity select-none">{new Date(msg.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[15px] text-text-secondary leading-[1.375rem] break-words">{msg.content}</p>
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>

      <!-- Message input -->
      <div class="px-4 pb-4">
        <form onsubmit={(e) => { e.preventDefault(); sendMessage(); }} class="relative">
          <input
            type="text"
            bind:value={messageInput}
            placeholder="Message @{activeDmUser.username}"
            class="w-full bg-bg-tertiary text-text-primary rounded-lg px-4 py-2.5 text-sm border border-border focus:border-accent focus:outline-none placeholder:text-text-muted transition-colors"
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
