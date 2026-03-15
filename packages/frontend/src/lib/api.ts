const BASE = "/api";

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 204) return undefined as T;

    const data = await res.json();

    if (!res.ok) {
      const err = new ApiError(res.status, data.error || "Unknown error");
      err.data = data;
      throw err;
    }

    return data as T;
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(path: string) {
    return this.request<T>(path, {
      method: "DELETE",
    });
  }

  async upload<T>(path: string, formData: FormData): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    // No Content-Type — browser sets multipart boundary automatically
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (res.status === 204) return undefined as T;
    const data = await res.json();
    if (!res.ok) {
      const err = new ApiError(res.status, data.error || "Unknown error");
      err.data = data;
      throw err;
    }
    return data as T;
  }
}

export class ApiError extends Error {
  public data: any = null;
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const api = new ApiClient();
