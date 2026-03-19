// Terminology layer — maps internal terms to user-facing labels
// Centralized for i18n readiness

export type Locale = 'en' | 'pt'

export interface TermEntry {
  readonly en: string
  readonly pt: string
}

export const TERMS = {
  agent: { en: 'Assistant', pt: 'Assistente' },
  agents: { en: 'Assistants', pt: 'Assistentes' },
  persona: { en: 'Personality', pt: 'Personalidade' },
  systemPrompt: { en: 'Instructions', pt: 'Instruções' },
  scope: { en: 'Access', pt: 'Acesso' },
  policy: { en: 'Safety Rules', pt: 'Regras de Segurança' },
  policies: { en: 'Safety Rules', pt: 'Regras de Segurança' },
  allowedTools: { en: 'Capabilities', pt: 'Capacidades' },
  mcpServer: { en: 'Connection', pt: 'Conexão' },
  mcpServers: { en: 'Connections', pt: 'Conexões' },
  discussionTable: { en: 'Team Discussion', pt: 'Discussão em Equipe' },
  canvas: { en: 'Workspace', pt: 'Área de Trabalho' },
  node: { en: 'Card', pt: 'Card' },
  edge: { en: 'Connection', pt: 'Conexão' },
  spawn: { en: 'Start', pt: 'Iniciar' },
  session: { en: 'Conversation', pt: 'Conversa' },
  sessions: { en: 'Conversations', pt: 'Conversas' },
  skill: { en: 'Skill', pt: 'Habilidade' },
  skills: { en: 'Skills', pt: 'Habilidades' },
  moderator: { en: 'Facilitator', pt: 'Facilitador' },
  workspace: { en: 'Workspace', pt: 'Área de Trabalho' },
  approval: { en: 'Approval', pt: 'Aprovação' },
  memory: { en: 'Memory', pt: 'Memória' },
} as const satisfies Record<string, TermEntry>

export type TermKey = keyof typeof TERMS

export function t(key: TermKey, locale: Locale = 'en'): string {
  return TERMS[key][locale]
}
