import type { BlockResult } from "./messages.ts";

// Blocks one account through the endpoint the X website itself calls, with the
// user's own session. Must run inside an x.com page (content script): the cookies
// and the origin come from the page, nothing is stored by the extension.
//
// The bearer token below is the public one X ships in its web client for everyone.
const WEB_BEARER =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

function csrfToken(): string | undefined {
  return document.cookie.match(/(?:^|;\s*)ct0=([^;]+)/)?.[1];
}

export async function blockOnX(target: { handle: string; id?: string }): Promise<BlockResult> {
  const ct0 = csrfToken();
  if (!ct0) return { ok: false, kind: "notLoggedIn" };
  const body = new URLSearchParams(target.id ? { user_id: target.id } : { screen_name: target.handle });
  let res: Response;
  try {
    res = await fetch("https://x.com/i/api/1.1/blocks/create.json", {
      method: "POST",
      credentials: "include",
      headers: {
        authorization: `Bearer ${WEB_BEARER}`,
        "x-csrf-token": ct0,
        "x-twitter-auth-type": "OAuth2Session",
        "x-twitter-active-user": "yes",
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });
  } catch (err) {
    return { ok: false, kind: "error", error: `network: ${(err as Error).message}` };
  }
  if (res.status === 429) {
    const reset = Number(res.headers.get("x-rate-limit-reset") ?? 0) * 1000;
    return { ok: false, kind: "rateLimited", retryAt: reset || undefined };
  }
  if (res.status === 401 || res.status === 403) return { ok: false, kind: "notLoggedIn" };
  if (res.status === 404) return { ok: false, kind: "notFound" };
  if (!res.ok) return { ok: false, kind: "error", error: `HTTP ${res.status}` };
  const data = (await res.json().catch(() => ({}))) as { id_str?: string; screen_name?: string };
  return { ok: true, id: data.id_str ?? target.id, handle: (data.screen_name ?? target.handle).toLowerCase() };
}
