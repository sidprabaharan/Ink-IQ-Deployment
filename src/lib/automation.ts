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
  sendEmail?: (options: { to?: string; template?: string; subject?: string; body?: string }) => Promise<void> | void;
  triggerWebhook?: (url: string, payload: any) => Promise<void> | void;
  createTask?: (task: { title: string; dueAt?: string; assigneeId?: string }) => Promise<void> | void;
}

export function runStatusChangeAutomations(orgSettings: any, event: StatusChangeEvent, cb: AutomationCallbacks = {}) {
  const rules: StatusChangeRule[] = (orgSettings?.automations?.statusChanges || []) as any;
  if (!Array.isArray(rules) || rules.length === 0) return;

  const matching = rules.filter(r => r.enabled && normalize(r.toStatus) === normalize(event.toStatus));
  if (matching.length === 0) return;

  for (const rule of matching) {
    for (const action of rule.actions || []) {
      executeAction(action, event, cb);
    }
  }
}

function normalize(s: string) {
  return (s || '').toLowerCase().replace(/\s+/g, '_');
}

function executeAction(action: AutomationAction, event: StatusChangeEvent, cb: AutomationCallbacks) {
  const notify = (t: string, d?: string) => cb.notify?.(t, d);
  switch (action.type) {
    case 'send_email': {
      const { to, template, subject, body } = action.params || {};
      notify?.('Send Email', `To: ${to || 'customer'} • Template: ${template || 'default'}`);
      cb.sendEmail?.({ to, template, subject, body });
      break;
    }
    case 'create_notification': {
      const { message } = action.params || {};
      notify?.('Notification', message || `Status changed to ${event.toStatus}`);
      break;
    }
    case 'trigger_webhook': {
      const { url, payload } = action.params || {};
      notify?.('Trigger Webhook', url);
      if (url && cb.triggerWebhook) {
        cb.triggerWebhook(url, { ...(payload || {}), event });
      }
      break;
    }
    case 'create_tasks': {
      const { title } = action.params || {};
      cb.createTask?.({ title: title || `Follow-up for ${event.entityType} ${event.entityId}` });
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



