<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  import { ApiError } from '$lib/api';

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let submitting = $state(false);
  let mounted = $state(false);

  $effect(() => {
    mounted = true;
  });

  function friendlyError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 401) return "Hmm, that doesn't match. Double-check your email and password.";
      if (err.status === 429) return "Whoa, slow down! Too many attempts. Try again in a minute.";
      if (err.status === 423) return "Account temporarily locked due to too many failed attempts. Take a breather and try again soon.";
      if (err.message?.includes('Validation')) return "Something looks off — make sure your email is valid and your password is filled in.";
    }
    if (err instanceof TypeError && err.message?.includes('fetch')) {
      return "Can't reach the server right now. Looks like Tulpo might be taking a nap — try again in a sec.";
    }
    return "Oops! Something unexpected happened. Not your fault — try again in a moment.";
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    submitting = true;

    try {
      await auth.login(email, password);
      goto('/app');
    } catch (err) {
      error = friendlyError(err);
    } finally {
      submitting = false;
    }
  }
</script>

<div
  class="flex min-h-screen bg-bg-primary transition-opacity duration-500"
  class:opacity-0={!mounted}
  class:opacity-100={mounted}
>
  <!-- Branding Panel -->
  <div class="hidden lg:flex lg:w-1/2 bg-bg-secondary relative overflow-hidden items-center justify-center">
    <!-- Decorative elements -->
    <div class="absolute inset-0 overflow-hidden">
      <!-- Geometric shapes -->
      <div class="absolute top-[15%] left-[10%] w-64 h-64 rounded-full border border-border/50 opacity-30"></div>
      <div class="absolute bottom-[20%] right-[15%] w-48 h-48 rounded-full border border-accent/10"></div>
      <div class="absolute top-[40%] right-[25%] w-32 h-32 rotate-45 border border-border/30 opacity-20"></div>
      <div class="absolute bottom-[35%] left-[20%] w-24 h-24 rotate-12 border border-accent/5 rounded-lg"></div>
      <!-- Subtle gradient mesh -->
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent/[0.03] blur-3xl"></div>
    </div>

    <!-- Branding content -->
    <div class="relative z-10 px-12 max-w-md">
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <svg class="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <h1 class="text-[32px] font-extrabold tracking-[-0.8px] text-text-primary">Tulpo</h1>
      </div>
      <p class="text-lg text-text-secondary leading-relaxed mb-4">Where your group actually hangs out. Voice, text, and everything in between.</p>
      <p class="text-sm text-text-muted">No tracking. No ads. Just your crew.</p>
    </div>
  </div>

  <!-- Form Panel -->
  <div class="flex flex-1 items-center justify-center p-6 sm:p-8">
    <div class="w-full max-w-sm">
      <!-- Mobile branding -->
      <div class="lg:hidden flex items-center gap-2.5 mb-10">
        <div class="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <svg class="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <span class="text-xl font-extrabold tracking-[-0.5px] text-text-primary">Tulpo</span>
      </div>

      <h2 class="text-2xl font-extrabold tracking-tight text-text-primary mb-2">Welcome back</h2>
      <p class="text-[15px] text-text-secondary mb-8">Sign in to your account</p>

      <form onsubmit={handleSubmit} class="flex flex-col gap-5">
        <div class="flex flex-col gap-1.5">
          <label for="email" class="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em]">Email</label>
          <input
            id="email"
            type="email"
            bind:value={email}
            required
            class="bg-bg-tertiary border border-border rounded-[10px] px-4 py-3.5 text-[15px] text-text-primary placeholder:text-text-muted outline-none transition-colors duration-150 focus:border-text-muted"
            placeholder="you@example.com"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="password" class="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em]">Password</label>
          <input
            id="password"
            type="password"
            bind:value={password}
            required
            class="bg-bg-tertiary border border-border rounded-[10px] px-4 py-3.5 text-[15px] text-text-primary placeholder:text-text-muted outline-none transition-colors duration-150 focus:border-text-muted"
            placeholder="••••••••"
          />
        </div>

        {#if error}
          <div class="flex items-start gap-2.5 bg-danger/8 border border-danger/20 rounded-lg px-3.5 py-2.5">
            <svg class="w-4 h-4 text-danger flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <p class="text-[13px] text-danger/90 leading-snug">{error}</p>
          </div>
        {/if}

        <button
          type="submit"
          disabled={submitting}
          class="mt-1 bg-accent text-bg-primary font-semibold py-2.5 px-5 rounded-[10px] text-sm transition-all duration-150 hover:-translate-y-px hover:bg-accent-hover active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p class="text-sm text-text-secondary mt-8 text-center">
        Don't have an account?
        <a href="/auth/register" class="text-accent hover:text-accent-hover transition-colors duration-150">Create one</a>
      </p>
    </div>
  </div>
</div>
