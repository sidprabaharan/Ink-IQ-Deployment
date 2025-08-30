export function getCanonicalOrderStatuses(orgSettings: any): string[] {
  try {
    const fromSettings = orgSettings?.orderStatuses as Array<{ name: string; active?: boolean }> | undefined;
    if (Array.isArray(fromSettings) && fromSettings.length) {
      return fromSettings
        .filter(s => s.active !== false)
        .map(s => s.name)
        .filter(Boolean);
    }
  } catch {}
  // Fallback to common statuses if none configured in org settings
  return [
    'New',
    'Processing',
    'Artwork Ready',
    'Production',
    'Shipping',
    'Completed',
    'Cancelled',
    'On Hold',
  ];
}


