export const ALLOWED_FIELDS = ['pr.title', 'pr.author', 'pr.url', 'repository.fullName'] as const;
export type TemplateFields = Record<typeof ALLOWED_FIELDS[number], string>;
const placeholder = /\{\{([\s\S]*?)\}\}/g;

export function validateTemplate(template: string): void {
  if (!template.trim() || template.length > 10_000) throw new Error('Comment must be between 1 and 10000 characters');
  const remaining = template.replace(placeholder, (_match, field: string) => {
    if (!(ALLOWED_FIELDS as readonly string[]).includes(field.trim())) throw new Error('Unsupported comment field');
    return '';
  });
  if (remaining.includes('{{') || remaining.includes('}}')) throw new Error('Malformed comment placeholder');
}
export function renderTemplate(template: string, fields: TemplateFields): string {
  validateTemplate(template);
  const comment = template.replace(placeholder, (_match, field: string) => fields[field.trim() as keyof TemplateFields]);
  if (comment.length > 65_000) throw new Error('Rendered comment is too long');
  return comment;
}
