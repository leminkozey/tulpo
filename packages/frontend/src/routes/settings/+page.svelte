<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  import { settingsStore } from '$lib/stores/settings.svelte';

  let saving = $state(false);

  onMount(() => {
    auth.init().then(() => {
      if (!auth.isAuthenticated) {
        goto('/auth/login');
        return;
      }
      settingsStore.load();
    });
  });

  async function toggleNotes() {
    if (!settingsStore.settings) return;
    saving = true;
    try {
      await settingsStore.update({
        allow_friend_request_notes: !settingsStore.settings.allow_friend_request_notes,
      });
    } finally {
      saving = false;
    }
  }

  function handleSignOut() {
    auth.logout();
    goto('/auth/login');
  }
</script>

<div class="flex h-screen bg-bg-primary overflow-hidden">
  <!-- Settings sidebar -->
  <div class="w-56 flex-shrink-0 bg-bg-secondary border-r border-border flex flex-col">
    <div class="h-12 flex items-center px-4 border-b border-border">
      <h2 class="text-[15px] font-semibold text-text-primary">Settings</h2>
    </div>

    <nav class="flex-1 p-2 space-y-0.5">
      <p class="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em] px-3 py-2">User Settings</p>
      <button class="w-full text-left px-3 py-1.5 rounded-md text-sm text-text-primary bg-bg-hover/50 font-medium">
        Privacy
      </button>
    </nav>

    <div class="p-2 border-t border-border">
      <button
        onclick={handleSignOut}
        class="w-full text-left px-3 py-2 rounded-md text-sm text-danger hover:bg-danger/10 transition-colors duration-150"
      >
        Sign out
      </button>
    </div>
  </div>

  <!-- Settings content -->
  <div class="flex-1 flex flex-col min-w-0">
    <!-- Top bar -->
    <div class="h-12 flex-shrink-0 flex items-center justify-between px-6 border-b border-border">
      <h1 class="text-[15px] font-semibold text-text-primary">Privacy</h1>
      <button
        onclick={() => goto('/app')}
        class="w-8 h-8 rounded-full bg-bg-tertiary hover:bg-bg-hover flex items-center justify-center text-text-muted hover:text-text-primary transition-all duration-150"
        aria-label="Close settings"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
      <div class="max-w-2xl mx-auto p-6">
        <h2 class="text-lg font-bold text-text-primary mb-1">Friend Requests</h2>
        <p class="text-sm text-text-secondary mb-6">Control how others can interact with you.</p>

        {#if settingsStore.loading}
          <p class="text-sm text-text-muted">Loading...</p>
        {:else if settingsStore.settings}
          <!-- Allow notes toggle -->
          <div class="flex items-center justify-between bg-bg-secondary rounded-xl p-4 border border-border">
            <div>
              <p class="text-sm font-medium text-text-primary">Allow notes on friend requests</p>
              <p class="text-[13px] text-text-secondary mt-0.5">When disabled, others cannot attach a note when sending you a friend request.</p>
            </div>
            <button
              onclick={toggleNotes}
              disabled={saving}
              class="relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ml-4 {settingsStore.settings.allow_friend_request_notes ? 'bg-accent' : 'bg-bg-active'}"
              aria-label="Toggle allow notes"
            >
              <div
                class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 {settingsStore.settings.allow_friend_request_notes ? 'translate-x-[22px]' : 'translate-x-0.5'}"
              ></div>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
