<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  import { friendsStore } from '$lib/stores/friends.svelte';
  import { wsClient } from '$lib/ws.svelte';

  let readyData = $state<any>(null);
  let unsubs: (() => void)[] = [];
  let showUserMenu = $state(false);

  // Friends UI state
  type FriendsTab = 'online' | 'all' | 'pending' | 'add';
  let activeTab = $state<FriendsTab>('online');

  // Add friend form
  let addUsername = $state('');
  let addNote = $state('');
  let addError = $state('');
  let addSuccess = $state('');
  let addLoading = $state(false);

  onMount(() => {
    auth.init().then(() => {
      if (!auth.isAuthenticated) {
        goto('/auth/login');
        return;
      }

      wsClient.connect();
      friendsStore.loadAll();

      unsubs.push(wsClient.on('READY', (data) => {
        readyData = data;
      }));
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
      const result = await friendsStore.sendRequest(
        addUsername.trim(),
        addNote.trim() || null
      );
      if (result.status === 'accepted') {
        addSuccess = `You and ${addUsername} are now friends!`;
      } else {
        addSuccess = `Friend request sent to ${addUsername}`;
      }
      addUsername = '';
      addNote = '';
    } catch (err: any) {
      addError = err.message || 'Something went wrong';
    } finally {
      addLoading = false;
    }
  }

  // Derived
  let onlineFriends = $derived(
    friendsStore.friends.filter(f => f.user.status === 'online' || f.user.status === 'idle' || f.user.status === 'dnd')
  );
  let allFriends = $derived(friendsStore.friends);
</script>

<div class="flex h-screen bg-bg-primary overflow-hidden">
  <!-- Server Sidebar -->
  <div class="w-[72px] flex-shrink-0 bg-bg-tertiary flex flex-col items-center py-3 gap-2">
    <!-- Home button -->
    <button aria-label="Home" class="w-12 h-12 rounded-2xl bg-accent/15 hover:bg-accent/25 hover:rounded-xl transition-all duration-200 flex items-center justify-center group">
      <svg class="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </button>

    <div class="w-8 h-px bg-border my-1"></div>

    <button aria-label="Create server" class="w-12 h-12 rounded-2xl bg-bg-secondary hover:bg-success/15 hover:rounded-xl transition-all duration-200 flex items-center justify-center group">
      <svg class="w-5 h-5 text-success/70 group-hover:text-success transition-colors duration-150" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>

    <button aria-label="Explore servers" class="w-12 h-12 rounded-2xl bg-bg-secondary hover:bg-accent/15 hover:rounded-xl transition-all duration-200 flex items-center justify-center group">
      <svg class="w-5 h-5 text-text-muted group-hover:text-accent transition-colors duration-150" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
      </svg>
    </button>
  </div>

  <!-- Channel Sidebar -->
  <div class="hidden sm:flex w-60 flex-shrink-0 bg-bg-secondary flex-col border-r border-border">
    <div class="h-12 flex items-center px-4 border-b border-border">
      <h2 class="text-[15px] font-semibold text-text-primary truncate">Direct Messages</h2>
    </div>

    <div class="p-2">
      <button
        class="w-full flex items-center gap-3 px-3 py-2 rounded-md bg-bg-hover/50 text-text-primary text-sm font-medium"
        onclick={() => activeTab = 'online'}
      >
        <svg class="w-4 h-4 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        Friends
        {#if friendsStore.pendingCount > 0}
          <span class="ml-auto bg-danger text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {friendsStore.pendingCount}
          </span>
        {/if}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-2">
      <div class="flex items-center justify-between px-2 mb-2 mt-4">
        <h3 class="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em]">Direct Messages</h3>
        <button aria-label="New DM" class="text-text-muted hover:text-text-secondary transition-colors">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>
      <p class="text-xs text-text-muted px-2">No conversations yet</p>
    </div>

    <!-- User area -->
    <div class="h-[52px] flex items-center gap-2 px-2 bg-bg-primary/50 border-t border-border relative">
      <div class="relative">
        <div class="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-xs font-bold text-accent">
          {auth.user?.username?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <div
          class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-bg-secondary"
          class:bg-success={wsClient.status === 'connected'}
          class:bg-warning={wsClient.status === 'connecting' || wsClient.status === 'reconnecting'}
          class:bg-danger={wsClient.status === 'disconnected'}
        ></div>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-text-primary truncate">{auth.user?.username ?? ''}</p>
        <p class="text-[11px] text-text-muted truncate capitalize">{wsClient.status === 'connected' ? 'Online' : wsClient.status}</p>
      </div>
      <button
        aria-label="User settings"
        onclick={() => goto('/settings')}
        class="w-8 h-8 rounded-md flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-all duration-150"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>

      {#if showUserMenu}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="absolute bottom-14 left-2 right-2 bg-bg-tertiary border border-border rounded-lg overflow-hidden z-50">
          <div class="p-3 border-b border-border">
            <p class="text-sm font-semibold text-text-primary">{auth.user?.username}</p>
            <p class="text-[11px] text-text-muted">@{auth.user?.username ?? ''}</p>
          </div>
          <button
            onclick={handleSignOut}
            class="w-full text-left px-3 py-2.5 text-sm text-danger hover:bg-danger/10 transition-colors duration-150"
          >
            Sign out
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Main content area -->
  <div class="flex-1 flex flex-col min-w-0">
    <!-- Top bar with tabs -->
    <div class="h-12 flex-shrink-0 flex items-center px-4 border-b border-border gap-4">
      <svg class="w-5 h-5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
      <span class="text-[15px] font-semibold text-text-primary">Friends</span>

      <div class="w-px h-6 bg-border mx-1"></div>

      <!-- Tabs -->
      <button
        class="text-sm px-2 py-1 rounded-md transition-colors duration-150 {activeTab === 'online' ? 'text-text-primary bg-bg-hover' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/50'}"
        onclick={() => activeTab = 'online'}
      >
        Online
      </button>
      <button
        class="text-sm px-2 py-1 rounded-md transition-colors duration-150 {activeTab === 'all' ? 'text-text-primary bg-bg-hover' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/50'}"
        onclick={() => activeTab = 'all'}
      >
        All
      </button>
      <button
        class="text-sm px-2 py-1 rounded-md transition-colors duration-150 relative {activeTab === 'pending' ? 'text-text-primary bg-bg-hover' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/50'}"
        onclick={() => activeTab = 'pending'}
      >
        Pending
        {#if friendsStore.pendingCount > 0}
          <span class="absolute -top-1 -right-1 bg-danger text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
            {friendsStore.pendingCount}
          </span>
        {/if}
      </button>

      <button
        class="text-sm px-3 py-1 rounded-md font-medium transition-colors duration-150 {activeTab === 'add' ? 'text-white bg-success' : 'text-success bg-transparent hover:bg-success/10'}"
        onclick={() => activeTab = 'add'}
      >
        Add Friend
      </button>
    </div>

    <!-- Content area -->
    <div class="flex-1 overflow-y-auto">
      {#if activeTab === 'add'}
        <!-- Add Friend -->
        <div class="p-6 border-b border-border">
          <h2 class="text-[15px] font-semibold text-text-primary mb-1">Add Friend</h2>
          <p class="text-sm text-text-secondary mb-4">You can add friends by their username.</p>

          <form onsubmit={(e) => { e.preventDefault(); handleSendRequest(); }} class="flex gap-2">
            <div class="flex-1">
              <input
                type="text"
                bind:value={addUsername}
                placeholder="Enter a username"
                class="w-full bg-bg-tertiary text-text-primary rounded-lg px-4 py-2.5 text-sm border border-border focus:border-accent focus:outline-none placeholder:text-text-muted transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={!addUsername.trim() || addLoading}
              class="bg-accent text-[#0c0d11] font-semibold px-6 py-2.5 rounded-lg text-sm transition-all duration-150 hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addLoading ? 'Sending...' : 'Send Request'}
            </button>
          </form>

          <!-- Optional note -->
          <div class="mt-3">
            <input
              type="text"
              bind:value={addNote}
              placeholder="Add a note (optional, max 200 chars)"
              maxlength="200"
              class="w-full bg-bg-tertiary text-text-primary rounded-lg px-4 py-2 text-sm border border-border focus:border-accent focus:outline-none placeholder:text-text-muted transition-colors"
            />
            {#if addNote.length > 0}
              <p class="text-[11px] text-text-muted mt-1 text-right">{addNote.length}/200</p>
            {/if}
          </div>

          {#if addError}
            <p class="text-sm text-danger mt-3">{addError}</p>
          {/if}
          {#if addSuccess}
            <p class="text-sm text-success mt-3">{addSuccess}</p>
          {/if}
        </div>
      {:else if activeTab === 'pending'}
        <!-- Pending Requests -->
        <div class="p-4">
          <!-- Incoming -->
          {#if friendsStore.incoming.length > 0}
            <h3 class="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em] px-2 mb-2">
              Incoming — {friendsStore.incoming.length}
            </h3>
            {#each friendsStore.incoming as request (request.id)}
              <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg-hover/50 group transition-colors duration-150">
                <div class="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-xs font-bold text-accent flex-shrink-0">
                  {request.from.username.charAt(0).toUpperCase()}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-text-primary">{request.from.display_name || request.from.username}</p>
                  <p class="text-[11px] text-text-muted">
                    {request.from.username}
                    {#if request.note}
                      <span class="ml-1 text-text-secondary">— {request.note}</span>
                    {/if}
                  </p>
                </div>
                <div class="flex gap-1.5">
                  <!-- Accept -->
                  <button
                    onclick={() => friendsStore.acceptRequest(request.id)}
                    class="w-8 h-8 rounded-full bg-bg-tertiary hover:bg-success/15 flex items-center justify-center transition-colors duration-150 group/btn"
                    aria-label="Accept"
                  >
                    <svg class="w-4 h-4 text-text-muted group-hover/btn:text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </button>
                  <!-- Reject -->
                  <button
                    onclick={() => friendsStore.rejectRequest(request.id)}
                    class="w-8 h-8 rounded-full bg-bg-tertiary hover:bg-danger/15 flex items-center justify-center transition-colors duration-150 group/btn"
                    aria-label="Reject"
                  >
                    <svg class="w-4 h-4 text-text-muted group-hover/btn:text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>
            {/each}
          {/if}

          <!-- Outgoing -->
          {#if friendsStore.outgoing.length > 0}
            <h3 class="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em] px-2 mb-2 {friendsStore.incoming.length > 0 ? 'mt-6' : ''}">
              Outgoing — {friendsStore.outgoing.length}
            </h3>
            {#each friendsStore.outgoing as request (request.id)}
              <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg-hover/50 group transition-colors duration-150">
                <div class="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-xs font-bold text-accent flex-shrink-0">
                  {request.to.username.charAt(0).toUpperCase()}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-text-primary">{request.to.display_name || request.to.username}</p>
                  <p class="text-[11px] text-text-muted">
                    {request.to.username}
                    {#if request.note}
                      <span class="ml-1 text-text-secondary">— {request.note}</span>
                    {/if}
                  </p>
                </div>
                <button
                  onclick={() => friendsStore.cancelRequest(request.id)}
                  class="w-8 h-8 rounded-full bg-bg-tertiary hover:bg-danger/15 flex items-center justify-center transition-colors duration-150 group/btn"
                  aria-label="Cancel"
                >
                  <svg class="w-4 h-4 text-text-muted group-hover/btn:text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            {/each}
          {/if}

          {#if friendsStore.incoming.length === 0 && friendsStore.outgoing.length === 0}
            <div class="flex flex-col items-center justify-center py-20 text-center">
              <p class="text-text-secondary text-sm">No pending friend requests.</p>
            </div>
          {/if}
        </div>
      {:else if activeTab === 'online'}
        <!-- Online Friends -->
        <div class="p-4">
          {#if onlineFriends.length > 0}
            <h3 class="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em] px-2 mb-2">
              Online — {onlineFriends.length}
            </h3>
            {#each onlineFriends as friend (friend.id)}
              <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg-hover/50 group transition-colors duration-150">
                <div class="relative">
                  <div class="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-xs font-bold text-accent">
                    {friend.user.username.charAt(0).toUpperCase()}
                  </div>
                  <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-bg-primary bg-success"></div>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-text-primary">{friend.user.display_name || friend.user.username}</p>
                  <p class="text-[11px] text-text-muted capitalize">{friend.user.status}</p>
                </div>
                <button
                  onclick={() => friendsStore.removeFriend(friend.id)}
                  class="w-8 h-8 rounded-full bg-bg-tertiary hover:bg-danger/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 group/btn"
                  aria-label="Remove friend"
                >
                  <svg class="w-4 h-4 text-text-muted group-hover/btn:text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7" r="4"></circle>
                    <line x1="18" y1="11" x2="23" y2="11"></line>
                  </svg>
                </button>
              </div>
            {/each}
          {:else}
            <div class="flex flex-col items-center justify-center py-20 text-center">
              <p class="text-text-secondary text-sm">No friends online right now.</p>
            </div>
          {/if}
        </div>
      {:else}
        <!-- All Friends -->
        <div class="p-4">
          {#if allFriends.length > 0}
            <h3 class="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em] px-2 mb-2">
              All Friends — {allFriends.length}
            </h3>
            {#each allFriends as friend (friend.id)}
              <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg-hover/50 group transition-colors duration-150">
                <div class="relative">
                  <div class="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-xs font-bold text-accent">
                    {friend.user.username.charAt(0).toUpperCase()}
                  </div>
                  <div
                    class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-bg-primary"
                    class:bg-success={friend.user.status === 'online'}
                    class:bg-warning={friend.user.status === 'idle'}
                    class:bg-danger={friend.user.status === 'dnd'}
                    class:bg-text-muted={friend.user.status === 'offline'}
                  ></div>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-text-primary">{friend.user.display_name || friend.user.username}</p>
                  <p class="text-[11px] text-text-muted capitalize">{friend.user.status}</p>
                </div>
                <button
                  onclick={() => friendsStore.removeFriend(friend.id)}
                  class="w-8 h-8 rounded-full bg-bg-tertiary hover:bg-danger/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 group/btn"
                  aria-label="Remove friend"
                >
                  <svg class="w-4 h-4 text-text-muted group-hover/btn:text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7" r="4"></circle>
                    <line x1="18" y1="11" x2="23" y2="11"></line>
                  </svg>
                </button>
              </div>
            {/each}
          {:else}
            <div class="flex flex-col items-center justify-center py-20 text-center">
              <div class="relative w-40 h-40 mx-auto mb-6">
                <div class="absolute inset-0 rounded-full bg-accent/5"></div>
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="w-16 h-16 rounded-2xl bg-accent/15 flex items-center justify-center">
                    <svg class="w-8 h-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                  </div>
                </div>
              </div>
              <p class="text-text-secondary text-sm mb-4">No friends added yet.</p>
              <button
                onclick={() => activeTab = 'add'}
                class="bg-accent text-[#0c0d11] font-semibold py-2 px-5 rounded-lg text-sm transition-all duration-150 hover:bg-accent-hover"
              >
                Add Friend
              </button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

{#if showUserMenu}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="fixed inset-0 z-40" onclick={() => showUserMenu = false}></div>
{/if}
