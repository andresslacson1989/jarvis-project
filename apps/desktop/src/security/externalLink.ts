import { openUrl } from "@tauri-apps/plugin-opener";

function isAllowedExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.length > 0 &&
      url.username.length === 0 &&
      url.password.length === 0
    );
  } catch {
    return false;
  }
}

/** Opens an ordinary web link in the OS default application, never in JARVIS WebView. */
export async function openExternalLink(value: string): Promise<void> {
  if (!isAllowedExternalUrl(value)) {
    throw new Error("external link must be an absolute HTTP(S) URL without credentials");
  }
  await openUrl(value);
}
