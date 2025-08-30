// Email utilities: render templates with variables and send via Gmail (placeholder integration point)

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string; // can include handlebars-like tokens {{var}}
};

export function renderTemplate(template: EmailTemplate, variables: Record<string, any>): { subject: string; body: string } {
  const interpolate = (input: string) => input.replace(/{{\s*([\w\.]+)\s*}}/g, (_, path: string) => {
    const value = getByPath(variables, path.trim());
    return value == null ? '' : String(value);
  });
  return {
    subject: interpolate(template.subject),
    body: interpolate(template.body),
  };
}

export async function sendGmail(options: { to: string; subject: string; body: string }): Promise<void> {
  // Placeholder: actual Gmail send should use server-side token exchange and send via Edge Function or backend
  // Here, we only stub the API; caller should provide real implementation via callbacks if needed
  console.debug('[email] sendGmail stub', options);
}

function getByPath(obj: any, path: string): any {
  try {
    return path.split('.').reduce((acc: any, key: string) => (acc == null ? undefined : acc[key]), obj);
  } catch {
    return undefined;
  }
}


