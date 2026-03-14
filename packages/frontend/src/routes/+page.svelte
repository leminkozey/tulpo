<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';

  onMount(async () => {
    await auth.init();
    if (auth.isAuthenticated) {
      goto('/app');
    } else {
      goto('/auth/login');
    }
  });
</script>

<div class="flex items-center justify-center h-screen bg-bg-primary">
  <div class="flex items-center gap-3 animate-pulse">
    <div class="w-10 h-10 rounded-xl bg-bg-secondary flex items-center justify-center">
      <svg class="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </div>
    <span class="text-xl font-extrabold tracking-[-0.5px] text-text-primary">Tulpo</span>
  </div>
</div>
