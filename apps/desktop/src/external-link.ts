/// <reference lib="dom" />

import { openUrl } from "@tauri-apps/plugin-opener";

export function openExternalHttpUrl(value: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return Promise.reject(new Error("Only valid HTTP(S) external links are allowed"));
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || /[\u0000-\u001f\u007f]/.test(value)) {
    return Promise.reject(new Error("Only valid HTTP(S) external links are allowed"));
  }

  return openUrl(url.href);
}
