import { api } from "$lib/api";
import type { UserSettings } from "@tulpo/shared";

function createSettingsStore() {
  let settings = $state<UserSettings | null>(null);
  let loading = $state(false);

  async function load() {
    loading = true;
    try {
      settings = await api.get<UserSettings>("/settings");
    } finally {
      loading = false;
    }
  }

  async function update(updates: Partial<Pick<UserSettings, "allow_friend_request_notes">>) {
    settings = await api.patch<UserSettings>("/settings", updates);
  }

  return {
    get settings() { return settings; },
    get loading() { return loading; },
    load,
    update,
  };
}

export const settingsStore = createSettingsStore();
