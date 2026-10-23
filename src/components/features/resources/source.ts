/** Where a shared link points, from its hostname. Pure; used for the badge on each resource. */
export type ResourceSource = "Google Drive" | "OneDrive" | "Canvas" | "GitHub" | "Web";

export function detectSource(url: string | null): ResourceSource | null {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  const is = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (is("drive.google.com") || is("docs.google.com")) return "Google Drive";
  if (is("onedrive.live.com") || is("1drv.ms") || host.endsWith(".sharepoint.com")) return "OneDrive";
  if (is("instructure.com") || (host.startsWith("canvas.") && host.endsWith(".edu"))) return "Canvas";
  if (is("github.com")) return "GitHub";
  return "Web";
}

export function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
