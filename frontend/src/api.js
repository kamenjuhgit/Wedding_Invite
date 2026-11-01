// Browser requests use the Vite proxy locally and an explicit HTTPS host when deployed.
export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export async function api(
  base,
  path,
  {
    method = "GET",
    body,
    token,
    raw = false,
    grant,
    credentials = "omit",
  } = {},
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      method,
      credentials,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(grant ? { "X-Edit-Grant": grant } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error = new Error(
        data.error ||
          "The invitation service is unavailable. Please try again shortly.",
      );
      error.status = response.status;
      error.fields = data.fields || {};
      error.duplicate = Boolean(data.duplicate);
      throw error;
    }
    return raw ? response.blob() : response.json();
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error(
        "The connection took too long. Please retry; your reply will not be duplicated.",
      );
    if (error instanceof TypeError)
      throw new Error(
        "We could not reach the invitation service. Check your connection and try again. Your reply has not been confirmed.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
