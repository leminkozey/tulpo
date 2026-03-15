import { api } from "$lib/api";
import type { PublicUser, AuthResponse } from "@tulpo/shared";

const TOKEN_KEY = "tulpo_token";

function createAuthStore() {
  let user = $state<PublicUser | null>(null);
  let token = $state<string | null>(null);
  let loading = $state(true);

  function setSession(authResponse: AuthResponse) {
    user = authResponse.user;
    token = authResponse.token;
    localStorage.setItem(TOKEN_KEY, authResponse.token);
    api.setToken(authResponse.token);
  }

  function clearSession() {
    user = null;
    token = null;
    localStorage.removeItem(TOKEN_KEY);
    api.setToken(null);
  }

  let initPromise: Promise<void> | null = null;

  async function init() {
    // Deduplicate: if init is already running, return the same promise
    if (initPromise) return initPromise;
    // If already initialized (user loaded), skip
    if (user) { loading = false; return; }

    initPromise = (async () => {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (!savedToken) {
        loading = false;
        return;
      }

      api.setToken(savedToken);
      try {
        const data = await api.get<{ user: PublicUser }>("/auth/me");
        user = data.user;
        token = savedToken;
      } catch (err) {
        // Only clear session on auth errors (401/403), not network/server errors
        if (err && typeof err === 'object' && 'status' in err && ((err as any).status === 401 || (err as any).status === 403)) {
          clearSession();
        } else {
          // Network error or server issue — keep token, allow retry
          token = savedToken;
          initPromise = null; // allow re-init on next navigation
          console.warn('[auth] init failed, keeping session:', err);
        }
      }
      loading = false;
    })();

    return initPromise;
  }

  async function register(email: string, username: string, password: string) {
    const data = await api.post<AuthResponse>("/auth/register", {
      email,
      username,
      password,
    });
    setSession(data);
  }

  async function login(email: string, password: string) {
    const data = await api.post<AuthResponse>("/auth/login", {
      email,
      password,
    });
    setSession(data);
  }

  async function logout() {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore - clear local state regardless
    }
    clearSession();
  }

  return {
    get user() {
      return user;
    },
    get token() {
      return token;
    },
    get loading() {
      return loading;
    },
    get isAuthenticated() {
      return !!user;
    },
    init,
    register,
    login,
    logout,
  };
}

export const auth = createAuthStore();
