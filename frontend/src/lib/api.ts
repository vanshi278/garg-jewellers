// Thin fetch wrapper around the FastAPI backend.
// Works on the server (catalogue pages, for SEO) and the client (cart, auth).

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface ApiOptions extends RequestInit {
  token?: string | null;
  cartToken?: string | null;
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { token, cartToken, headers, ...rest } = opts;
  const h = new Headers(headers);
  // For FormData bodies, let the browser set the multipart Content-Type (with
  // boundary). Only default to JSON for other body types.
  const isFormData =
    typeof FormData !== "undefined" && rest.body instanceof FormData;
  if (!h.has("Content-Type") && rest.body && !isFormData) {
    h.set("Content-Type", "application/json");
  }
  if (token) h.set("Authorization", `Bearer ${token}`);
  if (cartToken) h.set("X-Cart-Token", cartToken);

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: h,
    // Catalogue reads are cacheable-ish; keep it simple and always fresh in dev.
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
