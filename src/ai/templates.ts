/**
 * Prompt templating. Templates use {{variable}} placeholders and live in
 * configuration (ADR-006), not in code. Rendering is a pure string
 * substitution: a missing variable renders empty, which keeps a partially
 * populated context from injecting a literal "{{knowledge}}" into a prompt.
 */

export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => variables[key] ?? "");
}
