<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  import { wsClient } from '$lib/ws.svelte';

  let readyData = $state<any>(null);
  let unsub: (() => void) | undefined;
  let showUserMenu = $state(false);

  onMount(() => {
    auth.init().then(() => {
      if (!auth.isAuthenticated) {
        goto('/auth/login');
        return;
      }

      wsClient.connect();

      unsub = wsClient.on('READY', (data) => {
        readyData = data;
      });
    });
  });

  onDestroy(() => {
    unsub?.();
    wsClient.disconnect();
  });

  function handleSignOut() {
    auth.logout();
    goto('/auth/login');
  }
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

    <!-- Separator -->
    <div class="w-8 h-px bg-border my-1"></div>

    <!-- Add server button -->
    <button aria-label="Create server" class="w-12 h-12 rounded-2xl bg-bg-secondary hover:bg-success/15 hover:rounded-xl transition-all duration-200 flex items-center justify-center group">
      <svg class="w-5 h-5 text-success/70 group-hover:text-success transition-colors duration-150" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>

    <!-- Explore button -->
    <button aria-label="Explore servers" class="w-12 h-12 rounded-2xl bg-bg-secondary hover:bg-accent/15 hover:rounded-xl transition-all duration-200 flex items-center justify-center group">
      <svg class="w-5 h-5 text-text-muted group-hover:text-accent transition-colors duration-150" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
      </svg>
    </button>
  </div>

  <!-- Channel Sidebar -->
  <div class="hidden sm:flex w-60 flex-shrink-0 bg-bg-secondary flex-col border-r border-border">
    <!-- Server header -->
    <div class="h-12 flex items-center px-4 border-b border-border">
      <h2 class="text-[15px] font-semibold text-text-primary truncate">Direct Messages</h2>
    </div>

    <!-- Friends / DM actions -->
    <div class="p-2">
      <button class="w-full flex items-center gap-3 px-3 py-2 rounded-md bg-bg-hover/50 text-text-primary text-sm font-medium">
        <svg class="w-4 h-4 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        Friends
      </button>
    </div>

    <!-- DM list -->
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
      <!-- Online indicator dot -->
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
      <!-- Settings gear -->
      <button
        aria-label="User settings"
        onclick={() => showUserMenu = !showUserMenu}
        class="w-8 h-8 rounded-md flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-all duration-150"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>

      <!-- User menu popup -->
      {#if showUserMenu}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="absolute bottom-14 left-2 right-2 bg-bg-tertiary border border-border rounded-lg overflow-hidden z-50">
          <div class="p-3 border-b border-border">
            <p class="text-sm font-semibold text-text-primary">{auth.user?.username}</p>
            <p class="text-[11px] text-text-muted">{auth.user?.email ?? ''}</p>
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
    <!-- Top bar -->
    <div class="h-12 flex-shrink-0 flex items-center px-4 border-b border-border">
      <svg class="w-5 h-5 text-text-muted mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
      <span class="text-[15px] font-semibold text-text-primary">Friends</span>
    </div>

    <!-- Empty state -->
    <div class="flex-1 flex items-center justify-center">
      <div class="text-center px-6 max-w-lg">
        <!-- Colorful illustration -->
        <div class="relative w-48 h-48 mx-auto mb-8">
          <!-- Background circles with color -->
          <div class="absolute inset-0 rounded-full bg-accent/5"></div>
          <div class="absolute top-4 left-4 right-4 bottom-4 rounded-full bg-accent/8"></div>
          <!-- Center icon -->
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="w-20 h-20 rounded-2xl bg-accent/15 flex items-center justify-center">
              <svg class="w-10 h-10 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
          </div>
          <!-- Floating accent dots -->
          <div class="absolute top-2 right-8 w-3 h-3 rounded-full bg-accent/30"></div>
          <div class="absolute bottom-6 left-4 w-2 h-2 rounded-full bg-success/40"></div>
          <div class="absolute top-10 left-2 w-2.5 h-2.5 rounded-full bg-warning/30"></div>
        </div>

        <h1 class="text-[28px] font-extrabold tracking-[-0.5px] text-text-primary mb-3">No one's here yet</h1>
        <p class="text-[15px] text-text-secondary leading-relaxed mb-8">Create a server, invite your friends, and start hanging out.</p>

        <div class="flex gap-3 justify-center">
          <button class="bg-accent text-[#0c0d11] font-semibold py-2.5 px-6 rounded-[10px] text-sm transition-all duration-150 hover:-translate-y-px hover:bg-accent-hover active:translate-y-px">
            Create a Server
          </button>
          <button class="bg-bg-tertiary text-text-primary border border-border font-semibold py-2.5 px-6 rounded-[10px] text-sm transition-all duration-150 hover:-translate-y-px hover:bg-bg-hover hover:border-text-muted active:translate-y-px">
            Join a Server
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Click outside to close user menu -->
{#if showUserMenu}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="fixed inset-0 z-40" onclick={() => showUserMenu = false}></div>
{/if}
