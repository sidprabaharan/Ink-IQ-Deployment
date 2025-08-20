import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Minimal telemetry helper: tries RPC `emit_event`, falls back to `telemetry_events` table
export async function track(event: string, props: Record<string, any> = {}) {
  try {
    // Prefer an RPC if present
    // @ts-ignore
    const { supabase } = await import('@/lib/supabase');
    const payload = { p_event: event, p_properties: props } as any;
    const rpc = await supabase.rpc('emit_event', payload);
    if (!rpc.error) return;
  } catch {}
  try {
    // @ts-ignore
    const { supabase } = await import('@/lib/supabase');
    await supabase.from('telemetry_events').insert({ event, properties: props, created_at: new Date().toISOString() });
  } catch {}
}