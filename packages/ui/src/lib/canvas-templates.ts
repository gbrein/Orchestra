import type { Node, Edge } from '@xyflow/react'
import { createAgentNode, createSkillNode } from './canvas-utils'
import type { OrchestraEdgeData } from '@/components/canvas/edges/orchestra-edge'

// ─── Template types ────────────────────────────────────────────────────────────

export interface CanvasTemplate {
  id: string
  name: string
  description: string
  icon: string
  nodeCount: number
  load: () => { nodes: Node[]; edges: Edge[] }
}

// ─── Edge factory ──────────────────────────────────────────────────────────────

function createFlowEdge(sourceId: string, targetId: string): Edge {
  return {
    id: crypto.randomUUID(),
    source: sourceId,
    target: targetId,
    type: 'orchestra',
    data: { edgeType: 'flow' } satisfies OrchestraEdgeData,
  }
}

function createAssociationEdge(sourceId: string, targetId: string): Edge {
  return {
    id: crypto.randomUUID(),
    source: sourceId,
    target: targetId,
    type: 'orchestra',
    data: { edgeType: 'association' } satisfies OrchestraEdgeData,
  }
}

// ─── Template 1: Code Review Pipeline ─────────────────────────────────────────
// [Code Writer] →→ [Code Reviewer] →→ [Security Reviewer]

function loadCodeReviewPipeline(): { nodes: Node[]; edges: Edge[] } {
  const writer = createAgentNode(
    { x: 100, y: 200 },
    {
      name: 'Code Writer',
      description: 'Writes and iterates on code solutions',
      status: 'idle',
      model: 'sonnet',
      purpose: 'coding',
    },
  )

  const reviewer = createAgentNode(
    { x: 400, y: 200 },
    {
      name: 'Code Reviewer',
      description: 'Reviews code for quality and correctness',
      status: 'idle',
      model: 'opus',
      purpose: 'review',
    },
  )

  const securityReviewer = createAgentNode(
    { x: 700, y: 200 },
    {
      name: 'Security Reviewer',
      description: 'Audits code for vulnerabilities and security issues',
      status: 'idle',
      model: 'opus',
      purpose: 'review',
    },
  )

  return {
    nodes: [writer, reviewer, securityReviewer],
    edges: [
      createFlowEdge(writer.id, reviewer.id),
      createFlowEdge(reviewer.id, securityReviewer.id),
    ],
  }
}

// ─── Template 2: Content Writing Team ─────────────────────────────────────────
// [Researcher] →→ [Writer] →→ [Editor]

function loadContentWritingTeam(): { nodes: Node[]; edges: Edge[] } {
  const researcher = createAgentNode(
    { x: 100, y: 200 },
    {
      name: 'Researcher',
      description: 'Gathers and synthesises background information',
      status: 'idle',
      model: 'sonnet',
      purpose: 'research',
    },
  )

  const writer = createAgentNode(
    { x: 400, y: 200 },
    {
      name: 'Writer',
      description: 'Drafts compelling content from research',
      status: 'idle',
      model: 'sonnet',
      purpose: 'writing',
    },
  )

  const editor = createAgentNode(
    { x: 700, y: 200 },
    {
      name: 'Editor',
      description: 'Polishes and refines written content',
      status: 'idle',
      model: 'sonnet',
      purpose: 'review',
    },
  )

  return {
    nodes: [researcher, writer, editor],
    edges: [
      createFlowEdge(researcher.id, writer.id),
      createFlowEdge(writer.id, editor.id),
    ],
  }
}

// ─── Template 3: Research Assistant ───────────────────────────────────────────
// [Research Bot] + [Web Search skill] + [Data Analysis skill]

function loadResearchAssistant(): { nodes: Node[]; edges: Edge[] } {
  const bot = createAgentNode(
    { x: 350, y: 200 },
    {
      name: 'Research Bot',
      description: 'Conducts in-depth research across multiple sources',
      status: 'idle',
      model: 'sonnet',
      purpose: 'research',
    },
  )

  const webSearch = createSkillNode(
    { x: 100, y: 350 },
    {
      name: 'Web Search',
      icon: 'search',
      category: 'information',
    },
  )

  const dataAnalysis = createSkillNode(
    { x: 600, y: 350 },
    {
      name: 'Data Analysis',
      icon: 'bar-chart',
      category: 'analysis',
    },
  )

  return {
    nodes: [bot, webSearch, dataAnalysis],
    edges: [
      createAssociationEdge(webSearch.id, bot.id),
      createAssociationEdge(dataAnalysis.id, bot.id),
    ],
  }
}

// ─── Template 4: Brainstorm Team ──────────────────────────────────────────────
//         [Creative] ←→ [Analyst]
//              ↑              ↑
//              └─ [Moderator] ┘
//         [Devil's Advocate] also connected

function loadBrainstormTeam(): { nodes: Node[]; edges: Edge[] } {
  // Diamond layout: Moderator at bottom-centre, others spread above
  const creative = createAgentNode(
    { x: 100, y: 100 },
    {
      name: 'Creative',
      description: 'Generates imaginative, out-of-the-box ideas',
      status: 'idle',
      model: 'sonnet',
      purpose: 'creative',
    },
  )

  const analyst = createAgentNode(
    { x: 500, y: 100 },
    {
      name: 'Analyst',
      description: 'Evaluates ideas with data-driven reasoning',
      status: 'idle',
      model: 'opus',
      purpose: 'analysis',
    },
  )

  const devilsAdvocate = createAgentNode(
    { x: 300, y: 50 },
    {
      name: "Devil's Advocate",
      description: 'Challenges assumptions and stress-tests ideas',
      status: 'idle',
      model: 'sonnet',
      purpose: 'analysis',
    },
  )

  const moderator = createAgentNode(
    { x: 300, y: 300 },
    {
      name: 'Moderator',
      description: 'Facilitates discussion and synthesises outcomes',
      status: 'idle',
      model: 'sonnet',
      purpose: 'general',
    },
  )

  return {
    nodes: [creative, analyst, devilsAdvocate, moderator],
    edges: [
      // Creative ↔ Analyst
      createFlowEdge(creative.id, analyst.id),
      createFlowEdge(analyst.id, creative.id),
      // Devil's Advocate ↔ Creative
      createFlowEdge(devilsAdvocate.id, creative.id),
      // Devil's Advocate ↔ Analyst
      createFlowEdge(devilsAdvocate.id, analyst.id),
      // Moderator ↔ Creative and Analyst
      createFlowEdge(moderator.id, creative.id),
      createFlowEdge(moderator.id, analyst.id),
    ],
  }
}

// ─── Exported template registry ───────────────────────────────────────────────

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: 'code-review',
    name: 'Code Review Pipeline',
    description: 'A three-stage pipeline with a writer, reviewer, and security auditor.',
    icon: 'GitPullRequest',
    nodeCount: 3,
    load: loadCodeReviewPipeline,
  },
  {
    id: 'content-writing',
    name: 'Content Writing Team',
    description: 'Researcher feeds a writer who hands off to an editor for polishing.',
    icon: 'FileText',
    nodeCount: 3,
    load: loadContentWritingTeam,
  },
  {
    id: 'research-assistant',
    name: 'Research Assistant',
    description: 'Solo research bot equipped with web search and data analysis skills.',
    icon: 'Search',
    nodeCount: 3,
    load: loadResearchAssistant,
  },
  {
    id: 'brainstorm-team',
    name: 'Brainstorm Team',
    description: 'Creative, Analyst, and Devil\'s Advocate guided by a Moderator.',
    icon: 'Lightbulb',
    nodeCount: 4,
    load: loadBrainstormTeam,
  },
]
