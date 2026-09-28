// KAN-5: templates offered when creating a project. Pure module — the client
// only ever sends a template key; the server resolves the columns from here
// (never from client-sent data). To add a template, add an entry to
// PROJECT_TEMPLATES.

export type ProjectTemplateColumn = { name: string; isClosing?: boolean };

export type ProjectTemplate = {
  key: string;
  label: string;
  description: string;
  columns: readonly ProjectTemplateColumn[];
};

export const PROJECT_TEMPLATES = [
  {
    key: "simple",
    label: "Simple",
    description: "To Do, In Progress and Done columns.",
    columns: [{ name: "To Do" }, { name: "In Progress" }, { name: "Done", isClosing: true }],
  },
  {
    key: "blank",
    label: "Blank",
    description: "Start with no columns and add your own.",
    columns: [],
  },
] as const satisfies readonly ProjectTemplate[];

export type ProjectTemplateKey = (typeof PROJECT_TEMPLATES)[number]["key"];

// Simple is friendlier for a first project: the board is usable right away.
export const DEFAULT_PROJECT_TEMPLATE_KEY: ProjectTemplateKey = "simple";

export function isProjectTemplateKey(value: unknown): value is ProjectTemplateKey {
  return typeof value === "string" && PROJECT_TEMPLATES.some((t) => t.key === value);
}

export function getProjectTemplate(key: ProjectTemplateKey): ProjectTemplate {
  const template = PROJECT_TEMPLATES.find((t) => t.key === key);
  if (!template) throw new Error(`Unknown project template: ${key}`);
  return template;
}
