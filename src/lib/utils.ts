import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Asset URL helper: switch between Supabase signed URL and local public path
export async function getAssetUrl(path: string): Promise<string> {
  const mode = import.meta.env.VITE_ASSETS_MODE;
  if (mode === 'local') {
    // Serve from public/artwork/... when in local mode
    // If a full path like orgId/... is provided, keep it under /artwork/
    const clean = path.replace(/^\/+/, '');
    return `/artwork/${clean}`;
  }
  // Fallback: caller should handle signing with Supabase; return raw path
  return path;
}

// Minimal telemetry helper: tries RPC `emit_event`, falls back to `telemetry_events` table
export async function track(_event: string, _props: Record<string, any> = {}) {
  // Telemetry disabled in this environment to avoid noise and 400s
  return;
}