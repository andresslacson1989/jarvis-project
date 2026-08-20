/// <reference lib="dom" />

import { openUrl } from "@tauri-apps/plugin-opener";

const EXTERNAL_HTTP_URL = /^https?:\/\//i;

export function openExternalHttpUrl(value: string): Promise<void> {
  if (!EXTERNAL_HTTP_URL.test(value)) {
    return Promise.reject(new Error("Only HTTP(S) external links are allowed"));
  }

  return openUrl(value);
}
