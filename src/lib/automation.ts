// Lightweight automation runner for status-change rules
// Rules live at orgs.settings.automations.statusChanges

export type AutomationAction = {
  type:
    | 'send_email'
    | 'apply_preset_tasks'
    | 'add_to_po'
    | 'outsource_garments'
    | 'send_to_schedule'
    | 'create_notification'
    | 'trigger_webhook'
    | 'request_artwork_approval'
    | 'request_payment'
    | 'notify_internal'
    | 'create_tasks';
  params?: Record<string, any>;
};

export interface StatusChangeRule {
  id: string;
  name: string;
  enabled: boolean;
  toStatus: string;
  actions: AutomationAction[];
}

export interface StatusChangeEvent {
  entityType: 'quote' | 'lead' | 'garment' | 'job' | string;
  entityId?: string;
  toStatus: string;
  fromStatus?: string;
  payload?: Record<string, any>;
}

export interface AutomationCallbacks {
  notify?: (title: string, description?: string) => void;
  // Gmail via OAuth + DB-backed templates
  sendEmail?: (options: { to?: string; template?: string; subject?: string; body?: string; variables?: Record<string, any> }) => Promise<void> | void;
  // Signed webhook with HMAC-SHA256
  triggerWebhook?: (url: string, payload: any, opts?: { secret?: string; headers?: Record<string, string> }) => Promise<void> | void;
  // Create task in Tasks table/context
  createTask?: (task: { title: string; dueAt?: string; assigneeId?: string; status?: 'open' | 'pending' | 'in-progress' | 'completed' }) => Promise<void> | void;
}

export function runStatusChangeAutomations(orgSettings: any, event: StatusChangeEvent, cb: AutomationCallbacks = {}) {
  const rules: StatusChangeRule[] = (orgSettings?.automations?.statusChanges || []) as any;
  try {
    console.groupCollapsed('[automation] status-change', {
      entityType: event?.entityType,
      toStatus: event?.toStatus,
      fromStatus: event?.fromStatus,
    });
    console.debug('[automation] event payload', event?.payload || {});
    console.debug('[automation] rules count', Array.isArray(rules) ? rules.length : 0);
  } catch {}

  if (!Array.isArray(rules) || rules.length === 0) {
    try { console.debug('[automation] no rules configured'); console.groupEnd?.(); } catch {}
    return;
  }

  const normalizedTarget = normalize(event.toStatus);
  const matching = rules.filter(r => r.enabled && normalize(r.toStatus) === normalizedTarget);
  try {
    console.debug('[automation] normalized target', normalizedTarget);
    console.debug('[automation] matching rules', matching.map(r => ({ id: r.id, name: r.name, toStatus: r.toStatus, actions: (r.actions||[]).length })));
  } catch {}

  if (matching.length === 0) {
    try { console.debug('[automation] no matching rules for status'); console.groupEnd?.(); } catch {}
    return;
  }

  for (const rule of matching) {
    try { console.groupCollapsed('[automation] rule', { id: rule.id, name: rule.name }); } catch {}
    for (const action of rule.actions || []) {
      // Respect per-action enable toggle from settings UI
      if ((action as any)?.enabled === false) {
        try { console.debug('[automation] skip disabled action', action.type); } catch {}
        continue;
      }
      try { console.debug('[automation] execute action', action.type, action.params || {}); } catch {}
      try {
        executeAction(action, event, cb, orgSettings);
      } catch (e) {
        try { console.warn('[automation] action threw', action.type, e); } catch {}
      }
    }
    try { console.groupEnd?.(); } catch {}
  }

  try { console.groupEnd?.(); } catch {}
}

function normalize(s: string) {
  return (s || '').toLowerCase().replace(/\s+/g, '_');
}

function executeAction(action: AutomationAction, event: StatusChangeEvent, cb: AutomationCallbacks, orgSettings: any) {
  const notify = (t: string, d?: string) => cb.notify?.(t, d);
  switch (action.type) {
    case 'send_email': {
      const { to, template, subject, body } = action.params || {};
      notify?.('Send Email', `To: ${to || 'customer'} • Template: ${template || 'default'}`);
      const variables = buildTemplateVariables(event, orgSettings);
      cb.sendEmail?.({ to, template, subject, body, variables });
      break;
    }
    case 'create_notification': {
      const { message } = action.params || {};
      notify?.('Notification', message || `Status changed to ${event.toStatus}`);
      break;
    }
    case 'trigger_webhook': {
      const { url, payload, secret } = action.params || {};
      notify?.('Trigger Webhook', url);
      if (url && cb.triggerWebhook) {
        const p = { ...(payload || {}), event };
        // Include HMAC secret from params or org settings
        const hmacSecret = String(secret || orgSettings?.automations?.webhookSecret || '') || undefined;
        cb.triggerWebhook(url, p, { secret: hmacSecret });
      }
      break;
    }
    case 'create_tasks': {
      const { title } = action.params || {};
      cb.createTask?.({ title: title || `Follow-up for ${event.entityType} ${event.entityId}`, status: 'open' });
      notify?.('Create Task', title || 'Follow-up');
      break;
    }
    case 'apply_preset_tasks':
    case 'add_to_po':
    case 'outsource_garments':
    case 'send_to_schedule':
    case 'request_artwork_approval':
    case 'request_payment':
    case 'notify_internal': {
      // Placeholder side-effects; surface as notifications for now
      notify?.(action.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), `For ${event.entityType} ${event.entityId || ''}`);
      break;
    }
    default: {
      notify?.('Unknown action', action.type);
    }
  }
}

function buildTemplateVariables(event: StatusChangeEvent, orgSettings: any): Record<string, any> {
  const company = {
    name: orgSettings?.company?.name || 'Your Company',
  };
  const quote = event.entityType === 'quote' ? {
    id: event.payload?.quote?.id,
    total: event.payload?.quote?.total,
    link: event.payload?.quote?.link,
  } : undefined;
  const customer = event.payload?.customer || undefined;
  return { company, quote, customer, event };
}



