<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  import { settingsStore } from '$lib/stores/settings.svelte';
  import { api } from '$lib/api';
  import type { UserProfile, UserLink } from '@tulpo/shared';

  let activeTab = $state<'profile' | 'privacy'>('profile');
  let saving = $state(false);

  // Profile state
  let profileLoading = $state(true);
  let profileData = $state<UserProfile | null>(null);
  let displayName = $state('');
  let bio = $state('');
  let pronouns = $state('');
  let avatarColor = $state('#14b8a6');
  let links = $state<{ label: string; url: string }[]>([]);
  let avatarPreview = $state<string | null>(null);
  let bannerPreview = $state<string | null>(null);
  let uploadingAvatar = $state(false);
  let uploadingBanner = $state(false);
  let profileSaving = $state(false);
  let profileMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
  let showColorPicker = $state(false);

  // Image crop modal
  let cropModal = $state<{
    type: 'avatar' | 'banner';
    imageSrc: string;
    file: File;
  } | null>(null);
  let cropZoom = $state(1);
  let cropOffset = $state({ x: 0, y: 0 });
  let cropDragging = $state(false);
  let cropDragStart = $state({ x: 0, y: 0 });
  let cropImageNatural = $state({ w: 0, h: 0 });
  let cropContainerEl = $state<HTMLDivElement | null>(null);
  let cropUploading = $state(false);

  // External link warning
  let externalLinkWarning = $state<{ url: string; label: string } | null>(null);

  // Avatar color presets
  const colorPresets = [
    '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
    '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444',
    '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
    '#10b981',
  ];

  onMount(() => {
    auth.init().then(() => {
      if (!auth.isAuthenticated) {
        goto('/auth/login');
        return;
      }
      settingsStore.load();
      loadProfile();
    });
  });

  async function loadProfile() {
    profileLoading = true;
    try {
      profileData = await api.get<UserProfile>('/profile');
      displayName = profileData.display_name || '';
      bio = profileData.bio || '';
      pronouns = profileData.pronouns || '';
      avatarColor = profileData.avatar_color || '#14b8a6';
      links = (profileData.links || []).map(l => ({ label: l.label, url: l.url }));
      avatarPreview = profileData.avatar_url || null;
      bannerPreview = profileData.banner_url || null;
    } finally {
      profileLoading = false;
    }
  }

  async function saveProfile() {
    profileSaving = true;
    profileMessage = null;
    try {
      profileData = await api.patch<UserProfile>('/profile', {
        display_name: displayName || null,
        bio,
        pronouns,
        avatar_color: avatarColor,
        links: links.filter(l => l.url.trim()),
      });
      avatarPreview = profileData.avatar_url || null;
      bannerPreview = profileData.banner_url || null;
      profileMessage = { type: 'success', text: 'Profile saved!' };
      setTimeout(() => profileMessage = null, 3000);
    } catch (err: any) {
      profileMessage = { type: 'error', text: err.message || 'Failed to save profile' };
    } finally {
      profileSaving = false;
    }
  }

  async function uploadDirectly(file: File, type: 'avatar' | 'banner') {
    const formData = new FormData();
    formData.append('file', file);
    try {
      if (type === 'avatar') {
        uploadingAvatar = true;
        const res = await api.upload<{ avatar_url: string; avatar_type: string }>('/profile/avatar', formData);
        avatarPreview = res.avatar_url;
        if (profileData) {
          profileData = { ...profileData, avatar_url: res.avatar_url, avatar_type: res.avatar_type as any };
        }
        profileMessage = { type: 'success', text: 'Avatar updated!' };
      } else {
        uploadingBanner = true;
        const res = await api.upload<{ banner_url: string }>('/profile/banner', formData);
        bannerPreview = res.banner_url;
        if (profileData) {
          profileData = { ...profileData, banner_url: res.banner_url };
        }
        profileMessage = { type: 'success', text: 'Banner updated!' };
      }
      setTimeout(() => profileMessage = null, 3000);
    } catch (err: any) {
      profileMessage = { type: 'error', text: err.message || 'Failed to upload' };
    } finally {
      uploadingAvatar = false;
      uploadingBanner = false;
    }
  }

  function openCropModal(e: Event, type: 'avatar' | 'banner') {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    const reader = new FileReader();
    reader.onload = () => {
      cropZoom = 1;
      cropOffset = { x: 0, y: 0 };
      cropImageNatural = { w: 0, h: 0 };
      cropModal = { type, imageSrc: reader.result as string, file };
    };
    reader.readAsDataURL(file);
  }

  function onCropImageLoad(e: Event) {
    const img = e.target as HTMLImageElement;
    cropImageNatural = { w: img.naturalWidth, h: img.naturalHeight };
  }

  function onCropPointerDown(e: PointerEvent) {
    cropDragging = true;
    cropDragStart = { x: e.clientX - cropOffset.x, y: e.clientY - cropOffset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onCropPointerMove(e: PointerEvent) {
    if (!cropDragging) return;
    cropOffset = {
      x: e.clientX - cropDragStart.x,
      y: e.clientY - cropDragStart.y,
    };
  }

  function onCropPointerUp() {
    cropDragging = false;
  }

  function onCropWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    cropZoom = Math.max(1, Math.min(5, cropZoom + delta));
  }

  async function applyCrop() {
    if (!cropModal || !cropContainerEl) return;
    cropUploading = true;

    try {
      const isAvatar = cropModal.type === 'avatar';
      const outputW = isAvatar ? 512 : 960;
      const outputH = isAvatar ? 512 : 320;

      const containerRect = cropContainerEl.getBoundingClientRect();
      const viewportW = containerRect.width;
      const viewportH = containerRect.height;

      // The image is rendered to fill the container with object-fit logic + zoom + offset
      const imgAspect = cropImageNatural.w / cropImageNatural.h;
      const containerAspect = viewportW / viewportH;
      let renderedW: number, renderedH: number;
      if (imgAspect > containerAspect) {
        renderedH = viewportH;
        renderedW = viewportH * imgAspect;
      } else {
        renderedW = viewportW;
        renderedH = viewportW / imgAspect;
      }
      renderedW *= cropZoom;
      renderedH *= cropZoom;

      // Image top-left in container coords
      const imgLeft = (viewportW - renderedW) / 2 + cropOffset.x;
      const imgTop = (viewportH - renderedH) / 2 + cropOffset.y;

      // The crop area (visible area) maps to the center of the container
      // For avatar: circle inscribed in container, for banner: full container
      const cropAreaLeft = isAvatar ? (viewportW - Math.min(viewportW, viewportH)) / 2 : 0;
      const cropAreaTop = isAvatar ? (viewportH - Math.min(viewportW, viewportH)) / 2 : 0;
      const cropAreaW = isAvatar ? Math.min(viewportW, viewportH) : viewportW;
      const cropAreaH = isAvatar ? Math.min(viewportW, viewportH) : viewportH;

      // Map crop area back to image natural pixels
      const scaleX = cropImageNatural.w / renderedW;
      const scaleY = cropImageNatural.h / renderedH;

      const sx = Math.max(0, Math.round((cropAreaLeft - imgLeft) * scaleX));
      const sy = Math.max(0, Math.round((cropAreaTop - imgTop) * scaleY));
      const sw = Math.min(Math.round(cropAreaW * scaleX), cropImageNatural.w - sx);
      const sh = Math.min(Math.round(cropAreaH * scaleY), cropImageNatural.h - sy);

      const formData = new FormData();
      const isGif = cropModal.file.type === 'image/gif';

      if (isGif) {
        // GIFs: send original file + crop params, let backend handle with sharp
        formData.append('file', cropModal.file);
        formData.append('crop', JSON.stringify({ x: sx, y: sy, w: sw, h: sh }));
      } else {
        // Static images: crop on canvas
        const canvas = document.createElement('canvas');
        canvas.width = outputW;
        canvas.height = outputH;
        const ctx = canvas.getContext('2d')!;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = cropModal!.imageSrc;
        });

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outputW, outputH);

        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => {
            if (b && b.type === 'image/webp') {
              resolve(b);
            } else {
              canvas.toBlob((pb) => resolve(pb!), 'image/png');
            }
          }, 'image/webp', 0.9);
        });

        const ext = blob.type === 'image/webp' ? 'webp' : 'png';
        formData.append('file', new File([blob], `cropped.${ext}`, { type: blob.type }));
      }

      if (isAvatar) {
        const res = await api.upload<{ avatar_url: string; avatar_type: string }>('/profile/avatar', formData);
        avatarPreview = res.avatar_url;
        if (profileData) {
          profileData = { ...profileData, avatar_url: res.avatar_url, avatar_type: res.avatar_type as any };
        }
        profileMessage = { type: 'success', text: 'Avatar updated!' };
      } else {
        const res = await api.upload<{ banner_url: string }>('/profile/banner', formData);
        bannerPreview = res.banner_url;
        if (profileData) {
          profileData = { ...profileData, banner_url: res.banner_url };
        }
        profileMessage = { type: 'success', text: 'Banner updated!' };
      }
      setTimeout(() => profileMessage = null, 3000);
      cropModal = null;
    } catch (err: any) {
      profileMessage = { type: 'error', text: err.message || 'Failed to upload' };
    } finally {
      cropUploading = false;
    }
  }

  async function removeAvatar() {
    uploadingAvatar = true;
    try {
      await api.delete('/profile/avatar');
      avatarPreview = null;
      if (profileData) {
        profileData = { ...profileData, avatar_url: null, avatar_type: 'color' };
      }
    } finally {
      uploadingAvatar = false;
    }
  }

  async function removeBanner() {
    uploadingBanner = true;
    try {
      await api.delete('/profile/banner');
      bannerPreview = null;
      if (profileData) {
        profileData = { ...profileData, banner_url: null };
      }
    } finally {
      uploadingBanner = false;
    }
  }

  function addLink() {
    if (links.length >= 5) return;
    links = [...links, { label: '', url: '' }];
  }

  function removeLink(index: number) {
    links = links.filter((_, i) => i !== index);
  }

  function openExternalLink(url: string, label: string) {
    externalLinkWarning = { url, label };
  }

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

  // Derived preview data
  let previewProfile = $derived({
    username: auth.user?.username || 'username',
    display_name: displayName || null,
    avatar_url: avatarPreview,
    avatar_type: profileData?.avatar_type || 'color',
    avatar_color: avatarColor,
    bio,
    pronouns,
    banner_url: bannerPreview,
    links: links.filter(l => l.url.trim()),
    status: auth.user?.status || 'online',
    created_at: profileData?.created_at || new Date().toISOString(),
  });
</script>

<div class="flex h-screen bg-bg-primary overflow-hidden">
  <!-- Settings sidebar -->
  <div class="w-56 flex-shrink-0 bg-bg-secondary border-r border-border flex flex-col">
    <div class="h-12 flex items-center px-4 border-b border-border">
      <h2 class="text-[15px] font-semibold text-text-primary">Settings</h2>
    </div>

    <nav class="flex-1 p-2 space-y-0.5">
      <p class="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em] px-3 py-2">User Settings</p>
      <button
        class="w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors duration-150 {activeTab === 'profile' ? 'text-text-primary bg-bg-hover/50 font-medium' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/30'}"
        onclick={() => activeTab = 'profile'}
      >
        Profile
      </button>
      <button
        class="w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors duration-150 {activeTab === 'privacy' ? 'text-text-primary bg-bg-hover/50 font-medium' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/30'}"
        onclick={() => activeTab = 'privacy'}
      >
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
      <h1 class="text-[15px] font-semibold text-text-primary">{activeTab === 'profile' ? 'Profile' : 'Privacy'}</h1>
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
      {#if activeTab === 'profile'}
        <div class="max-w-[900px] mx-auto py-8 px-6">
          {#if profileLoading}
            <p class="text-sm text-text-muted text-center py-12">Loading...</p>
          {:else}
            <!-- Toast message -->
            {#if profileMessage}
              <div class="mb-5 px-4 py-2.5 rounded-lg text-sm {profileMessage.type === 'success' ? 'bg-success/10 text-success border border-success/20' : 'bg-danger/10 text-danger border border-danger/20'}">
                {profileMessage.text}
              </div>
            {/if}

            <div class="flex gap-8 items-start">
              <!-- LEFT COLUMN: Edit Form -->
              <div class="flex-1 min-w-0 space-y-6">

                <!-- Section: Banner -->
                <section>
                  <h3 class="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-3">Banner</h3>
                  <div class="h-[120px] rounded-xl overflow-hidden relative group border border-border">
                    {#if bannerPreview}
                      <img src={bannerPreview} alt="Banner" class="w-full h-full object-cover" />
                    {:else}
                      <div class="w-full h-full bg-gradient-to-br from-bg-tertiary to-bg-hover"></div>
                    {/if}
                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center gap-2">
                      <label class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer px-3 py-1.5 bg-bg-secondary/90 backdrop-blur-sm rounded-lg text-[12px] text-text-primary hover:bg-bg-hover border border-border">
                        {bannerPreview ? 'Change' : 'Upload'}
                        <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="hidden" onchange={(e: Event) => openCropModal(e, 'banner')} disabled={uploadingBanner} />
                      </label>
                      {#if bannerPreview}
                        <button
                          class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 px-3 py-1.5 bg-danger/90 backdrop-blur-sm rounded-lg text-[12px] text-white hover:bg-danger"
                          onclick={removeBanner}
                          disabled={uploadingBanner}
                        >Remove</button>
                      {/if}
                    </div>
                    {#if uploadingBanner}
                      <div class="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div class="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      </div>
                    {/if}
                  </div>
                </section>

                <!-- Section: Avatar -->
                <section>
                  <h3 class="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-3">Avatar</h3>
                  <div class="flex items-center gap-4">
                    <!-- Avatar preview -->
                    <div class="relative group flex-shrink-0">
                      {#if profileData?.avatar_type !== 'color' && avatarPreview}
                        <img src={avatarPreview} alt="Avatar" class="w-[72px] h-[72px] rounded-full object-cover" />
                      {:else}
                        <div class="w-[72px] h-[72px] rounded-full flex items-center justify-center text-xl font-bold text-white" style="background-color: {avatarColor}">
                          {(displayName || auth.user?.username || '?').charAt(0).toUpperCase()}
                        </div>
                      {/if}
                      <label class="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/50 transition-colors duration-200 flex items-center justify-center cursor-pointer">
                        <svg class="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                        <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="hidden" onchange={(e: Event) => openCropModal(e, 'avatar')} disabled={uploadingAvatar} />
                      </label>
                      {#if uploadingAvatar}
                        <div class="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                          <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        </div>
                      {/if}
                    </div>
                    <!-- Avatar actions -->
                    <div class="flex flex-col gap-2">
                      <div class="flex items-center gap-1.5">
                        <label class="cursor-pointer px-3 py-1.5 text-[12px] text-text-primary bg-accent hover:bg-accent-hover rounded-md transition-colors font-medium">
                          Upload Image
                          <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="hidden" onchange={(e: Event) => openCropModal(e, 'avatar')} disabled={uploadingAvatar} />
                        </label>
                        {#if profileData?.avatar_type !== 'color'}
                          <button
                            class="px-3 py-1.5 text-[12px] text-text-muted hover:text-text-primary bg-bg-tertiary hover:bg-bg-hover rounded-md border border-border transition-colors cursor-pointer"
                            onclick={removeAvatar}
                            disabled={uploadingAvatar}
                          >Remove</button>
                        {/if}
                      </div>
                      <button
                        class="flex items-center gap-1.5 px-3 py-1.5 text-[12px] transition-colors rounded-md border cursor-pointer w-fit {showColorPicker ? 'text-accent bg-accent/10 border-accent/30' : 'text-text-muted hover:text-text-primary bg-bg-tertiary hover:bg-bg-hover border-border'}"
                        onclick={() => showColorPicker = !showColorPicker}
                      >
                        <span class="w-3 h-3 rounded-full inline-block" style="background-color: {avatarColor}"></span>
                        Avatar Color
                        <svg class="w-3 h-3 transition-transform duration-200 {showColorPicker ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </button>
                    </div>
                  </div>
                  <!-- Collapsible color picker -->
                  {#if showColorPicker}
                    <div class="mt-3 p-3 bg-bg-secondary rounded-lg border border-border">
                      <div class="flex flex-wrap gap-2">
                        {#each colorPresets as color}
                          <button
                            class="w-7 h-7 rounded-full border-2 transition-all duration-150 cursor-pointer {avatarColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-110'}"
                            style="background-color: {color}"
                            onclick={() => avatarColor = color}
                          ></button>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </section>

                <!-- Section: Display Name -->
                <section>
                  <h3 class="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2">Display Name</h3>
                  <input
                    type="text"
                    bind:value={displayName}
                    placeholder={auth.user?.username || 'Display name'}
                    maxlength={50}
                    class="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/40 focus:border-accent/50 focus:outline-none transition-colors"
                  />
                </section>

                <!-- Section: Pronouns -->
                <section>
                  <h3 class="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2">Pronouns</h3>
                  <input
                    type="text"
                    bind:value={pronouns}
                    placeholder="e.g. he/him, she/her, they/them"
                    maxlength={40}
                    class="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-secondary placeholder:text-text-muted/40 focus:border-accent/50 focus:outline-none transition-colors"
                  />
                </section>

                <!-- Section: About Me -->
                <section>
                  <div class="flex items-center justify-between mb-2">
                    <h3 class="text-[11px] font-semibold text-text-muted uppercase tracking-widest">About Me</h3>
                    <span class="text-[11px] text-text-muted">{bio.length}/300</span>
                  </div>
                  <textarea
                    bind:value={bio}
                    placeholder="Tell others about yourself..."
                    maxlength={300}
                    rows={4}
                    class="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-[13px] text-text-secondary leading-relaxed placeholder:text-text-muted/40 focus:border-accent/50 focus:outline-none transition-colors resize-none"
                  ></textarea>
                </section>

                <!-- Section: Links -->
                <section>
                  <div class="flex items-center justify-between mb-2">
                    <h3 class="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Links</h3>
                    {#if links.length < 5}
                      <button
                        class="text-[12px] text-accent hover:text-accent-hover transition-colors cursor-pointer"
                        onclick={addLink}
                      >+ Add Link</button>
                    {/if}
                  </div>
                  {#if links.length === 0}
                    <p class="text-[13px] text-text-muted/60">No links added yet.</p>
                  {:else}
                    <div class="space-y-2">
                      {#each links as link, i}
                        <div class="flex gap-2 items-center bg-bg-secondary border border-border rounded-lg px-3 py-2">
                          <svg class="w-3.5 h-3.5 text-accent flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                          <input
                            type="text"
                            bind:value={link.label}
                            placeholder="Label"
                            maxlength={50}
                            class="w-24 flex-shrink-0 bg-transparent text-[13px] text-text-primary placeholder:text-text-muted/30 focus:outline-none"
                          />
                          <div class="w-px h-4 bg-border flex-shrink-0"></div>
                          <input
                            type="url"
                            bind:value={link.url}
                            placeholder="https://..."
                            maxlength={500}
                            class="flex-1 min-w-0 bg-transparent text-[13px] text-text-muted placeholder:text-text-muted/20 focus:outline-none"
                          />
                          <button
                            class="w-6 h-6 flex-shrink-0 flex items-center justify-center text-text-muted/40 hover:text-danger transition-colors cursor-pointer"
                            onclick={() => removeLink(i)}
                            aria-label="Remove link"
                          >
                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </button>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </section>

                <!-- Save bar -->
                <div class="flex items-center justify-between pt-2">
                  <p class="text-[11px] text-text-muted">Changes are not saved until you click Save.</p>
                  <div class="flex items-center gap-2">
                    <button
                      class="px-5 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
                      onclick={saveProfile}
                      disabled={profileSaving}
                    >
                      {profileSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>

              <!-- RIGHT COLUMN: Live Preview Card -->
              <div class="w-[300px] flex-shrink-0 sticky top-8">
                <h3 class="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-3">Preview</h3>
                <div class="bg-bg-secondary rounded-xl overflow-hidden border border-border">
                  <!-- Preview Banner -->
                  <div class="h-[90px] relative">
                    {#if previewProfile.banner_url}
                      <img src={previewProfile.banner_url} alt="Banner" class="w-full h-full object-cover" />
                    {:else}
                      <div class="w-full h-full bg-gradient-to-br from-bg-tertiary to-bg-hover"></div>
                    {/if}
                  </div>
                  <!-- Preview Avatar -->
                  <div class="relative px-4">
                    <div class="absolute -top-8">
                      {#if previewProfile.avatar_type !== 'color' && previewProfile.avatar_url}
                        <img src={previewProfile.avatar_url} alt="Avatar" class="w-[64px] h-[64px] rounded-full object-cover border-4 border-bg-secondary" />
                      {:else}
                        <div class="w-[64px] h-[64px] rounded-full flex items-center justify-center text-xl font-bold text-white border-4 border-bg-secondary" style="background-color: {previewProfile.avatar_color || '#14b8a6'}">
                          {(previewProfile.display_name || previewProfile.username).charAt(0).toUpperCase()}
                        </div>
                      {/if}
                      <div class="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-[3px] border-bg-secondary {previewProfile.status === 'online' ? 'bg-success' : previewProfile.status === 'idle' ? 'bg-warning' : previewProfile.status === 'dnd' ? 'bg-danger' : 'bg-text-muted'}"></div>
                    </div>
                  </div>
                  <!-- Preview Info -->
                  <div class="pt-10 px-4 pb-4">
                    <h4 class="text-[15px] font-bold text-text-primary leading-tight">{previewProfile.display_name || previewProfile.username}</h4>
                    <p class="text-[13px] text-text-secondary">{previewProfile.username}{#if previewProfile.pronouns}<span class="text-text-muted"> &middot; {previewProfile.pronouns}</span>{/if}</p>

                    {#if previewProfile.bio}
                      <div class="mt-3 pt-3 border-t border-border">
                        <p class="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">About Me</p>
                        <p class="text-[12px] text-text-secondary leading-relaxed whitespace-pre-wrap break-words">{previewProfile.bio}</p>
                      </div>
                    {/if}

                    {#if previewProfile.links.length > 0}
                      <div class="mt-3 pt-3 border-t border-border">
                        <p class="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">Links</p>
                        <div class="space-y-1">
                          {#each previewProfile.links as link}
                            <button
                              class="flex items-center gap-1.5 text-[12px] text-accent hover:text-accent-hover transition-colors group w-full text-left"
                              onclick={() => openExternalLink(link.url, link.label)}
                            >
                              <svg class="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                              <span class="truncate group-hover:underline">{link.label || link.url}</span>
                            </button>
                          {/each}
                        </div>
                      </div>
                    {/if}

                    <div class="mt-3 pt-3 border-t border-border">
                      <p class="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Member Since</p>
                      <p class="text-[12px] text-text-secondary">{new Date(previewProfile.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>

      {:else if activeTab === 'privacy'}
        <div class="max-w-2xl mx-auto p-6">
          <h2 class="text-lg font-bold text-text-primary mb-1">Friend Requests</h2>
          <p class="text-sm text-text-secondary mb-6">Control how others can interact with you.</p>

          {#if settingsStore.loading}
            <p class="text-sm text-text-muted">Loading...</p>
          {:else if settingsStore.settings}
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
      {/if}
    </div>
  </div>
</div>

<!-- Image Crop Modal -->
{#if cropModal}
  <div class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
    <div class="bg-bg-secondary border border-border rounded-xl shadow-2xl w-[520px] max-w-[95vw] flex flex-col" onclick={(e) => e.stopPropagation()}>
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <h3 class="text-[15px] font-semibold text-text-primary">
          {cropModal.type === 'avatar' ? 'Edit Avatar' : 'Edit Banner'}
        </h3>
        <button
          class="w-7 h-7 rounded-full bg-bg-tertiary hover:bg-bg-hover flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
          onclick={() => cropModal = null}
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <!-- Crop area -->
      <div class="relative mx-5 mt-4 overflow-hidden rounded-lg bg-black/90 select-none {cropModal.type === 'avatar' ? 'aspect-square max-h-[420px]' : ''}"
        style="{cropModal.type === 'banner' ? 'height: 200px' : ''}"
        bind:this={cropContainerEl}
        onpointerdown={onCropPointerDown}
        onpointermove={onCropPointerMove}
        onpointerup={onCropPointerUp}
        onpointercancel={onCropPointerUp}
        onwheel={onCropWheel}
        role="application"
        aria-label="Drag to reposition, scroll to zoom"
      >
        <!-- Image -->
        <img
          src={cropModal.imageSrc}
          alt="Crop preview"
          class="absolute pointer-events-none"
          style="
            left: 50%; top: 50%;
            transform: translate(calc(-50% + {cropOffset.x}px), calc(-50% + {cropOffset.y}px)) scale({cropZoom});
            min-width: 100%; min-height: 100%;
            object-fit: contain;
            max-width: none; max-height: none;
            width: auto; height: 100%;
          "
          onload={onCropImageLoad}
          draggable="false"
        />

        <!-- Overlay mask -->
        {#if cropModal.type === 'avatar'}
          <!-- Circle mask: 4 semi-transparent rects around a centered circle -->
          <div class="absolute inset-0 pointer-events-none overflow-hidden">
            <div class="absolute inset-0" style="
              background: radial-gradient(circle closest-side at center, transparent 99%, rgba(0,0,0,0.6) 100%);
            "></div>
          </div>
          <!-- Circle border -->
          <div class="absolute pointer-events-none border-2 border-white/40 rounded-full"
            style="
              width: 85%; height: 85%;
              left: 50%; top: 50%;
              transform: translate(-50%, -50%);
            "
          ></div>
        {:else}
          <!-- Banner: subtle border around the whole area -->
          <div class="absolute inset-0 pointer-events-none border-2 border-white/20 rounded-lg"></div>
        {/if}

        <!-- Drag hint -->
        <div class="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-md text-[11px] text-white/70 pointer-events-none">
          Drag to reposition &middot; Scroll to zoom
        </div>
      </div>

      <!-- Zoom slider -->
      <div class="flex items-center gap-3 px-5 mt-3">
        <svg class="w-4 h-4 text-text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        <input
          type="range"
          min="1"
          max="5"
          step="0.01"
          bind:value={cropZoom}
          class="flex-1 h-1.5 bg-bg-tertiary rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md"
        />
        <svg class="w-4 h-4 text-text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line><line x1="11" y1="8" x2="11" y2="14"></line></svg>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-2 px-5 py-4">
        <button
          class="px-4 py-2 bg-bg-tertiary hover:bg-bg-hover text-text-primary rounded-lg text-sm border border-border transition-colors cursor-pointer"
          onclick={() => cropModal = null}
        >Cancel</button>
        <button
          class="px-5 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
          onclick={applyCrop}
          disabled={cropUploading}
        >
          {cropUploading ? 'Uploading...' : 'Apply'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- External Link Warning -->
{#if externalLinkWarning}
  <div class="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center" onclick={() => externalLinkWarning = null}>
    <div class="bg-bg-secondary border border-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onclick={(e) => e.stopPropagation()}>
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </div>
        <div>
          <h3 class="text-[15px] font-semibold text-text-primary">Leaving Tulpo</h3>
          <p class="text-[13px] text-text-secondary mt-0.5">You're about to visit an external website.</p>
        </div>
      </div>

      <div class="bg-bg-primary rounded-lg border border-border px-3 py-2 mb-4">
        <p class="text-[12px] text-text-muted mb-0.5">Destination</p>
        <p class="text-[13px] text-text-secondary break-all">{externalLinkWarning.url}</p>
      </div>

      <p class="text-[12px] text-text-muted mb-4">Make sure you trust this link. Tulpo is not responsible for external content.</p>

      <div class="flex gap-2 justify-end">
        <button
          class="px-4 py-2 bg-bg-tertiary hover:bg-bg-hover text-text-primary rounded-lg text-sm transition-colors"
          onclick={() => externalLinkWarning = null}
        >Cancel</button>
        <button
          class="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
          onclick={() => { window.open(externalLinkWarning!.url, '_blank', 'noopener,noreferrer'); externalLinkWarning = null; }}
        >Open Link</button>
      </div>
    </div>
  </div>
{/if}
