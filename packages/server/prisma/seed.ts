import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const WORKSPACE_ID = "a0000000-0000-0000-0000-000000000001";
const CANVAS_LAYOUT_ID = "b0000000-0000-0000-0000-000000000001";

const AGENT_IDS = {
  codeReviewer: "c0000000-0000-0000-0000-000000000001",
  contentWriter: "c0000000-0000-0000-0000-000000000002",
  researchAssistant: "c0000000-0000-0000-0000-000000000003",
} as const;

const POLICY_ID = "d0000000-0000-0000-0000-000000000001";

const SKILL_IDS = {
  codeReview: "e0000000-0000-0000-0000-000000000001",
  writingAssistant: "e0000000-0000-0000-0000-000000000002",
  dataAnalysis: "e0000000-0000-0000-0000-000000000003",
} as const;

async function main(): Promise<void> {
  console.log("Seeding database...");

  // 1. Default Workspace with canvas layout
  const workspace = await prisma.workspace.upsert({
    where: { id: WORKSPACE_ID },
    update: { name: "My Workspace" },
    create: {
      id: WORKSPACE_ID,
      name: "My Workspace",
      canvasLayouts: {
        create: {
          id: CANVAS_LAYOUT_ID,
          name: "default",
          nodes: [],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      },
    },
  });
  console.log(`  Workspace: ${workspace.name}`);

  // Ensure canvas layout exists (for re-runs where workspace already existed)
  await prisma.canvasLayout.upsert({
    where: { id: CANVAS_LAYOUT_ID },
    update: {},
    create: {
      id: CANVAS_LAYOUT_ID,
      name: "default",
      workspaceId: WORKSPACE_ID,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  });

  // 2. Sample Agents
  const agents = [
    {
      id: AGENT_IDS.codeReviewer,
      name: "Code Reviewer",
      persona: "Reviews code for quality, bugs, and best practices.",
      purpose: "review",
      model: "opus",
      scope: [],
      allowedTools: ["Read", "Grep", "Glob"],
    },
    {
      id: AGENT_IDS.contentWriter,
      name: "Content Writer",
      persona: "Writes blog posts, emails, and documentation.",
      purpose: "writing",
      model: "sonnet",
      scope: [],
      allowedTools: ["Read", "Write", "Edit"],
    },
    {
      id: AGENT_IDS.researchAssistant,
      name: "Research Assistant",
      persona: "Researches topics, summarizes findings.",
      purpose: "research",
      model: "sonnet",
      scope: [],
      allowedTools: ["Read", "WebSearch", "WebFetch"],
    },
  ] as const;

  for (const agent of agents) {
    const result = await prisma.agent.upsert({
      where: { id: agent.id },
      update: {
        name: agent.name,
        persona: agent.persona,
        purpose: agent.purpose,
        model: agent.model,
        scope: [...agent.scope],
        allowedTools: [...agent.allowedTools],
      },
      create: {
        id: agent.id,
        name: agent.name,
        persona: agent.persona,
        purpose: agent.purpose,
        model: agent.model,
        scope: [...agent.scope],
        allowedTools: [...agent.allowedTools],
      },
    });
    console.log(`  Agent: ${result.name}`);
  }

  // 3. Global Policy
  const policy = await prisma.policy.upsert({
    where: { id: POLICY_ID },
    update: {
      name: "Default Safety Rules",
      level: "global",
      rules: {
        blockedCommands: ["rm -rf /", "DROP TABLE", "FORMAT"],
        requireApproval: ["rm", "git push", "npm publish", "docker rm"],
        maxTimeout: 300,
        maxBudgetUsd: 1.0,
        permissionMode: "default",
      },
    },
    create: {
      id: POLICY_ID,
      name: "Default Safety Rules",
      level: "global",
      rules: {
        blockedCommands: ["rm -rf /", "DROP TABLE", "FORMAT"],
        requireApproval: ["rm", "git push", "npm publish", "docker rm"],
        maxTimeout: 300,
        maxBudgetUsd: 1.0,
        permissionMode: "default",
      },
    },
  });
  console.log(`  Policy: ${policy.name}`);

  // 4. Sample Skills
  const skills = [
    {
      id: SKILL_IDS.codeReview,
      name: "Code Review",
      category: "Development",
      description: "Reviews code quality, finds bugs, suggests improvements",
      source: "marketplace" as const,
      path: "~/.orchestra/skills/code-review",
    },
    {
      id: SKILL_IDS.writingAssistant,
      name: "Writing Assistant",
      category: "Writing",
      description: "Helps write clear, engaging content",
      source: "marketplace" as const,
      path: "~/.orchestra/skills/writing-assistant",
    },
    {
      id: SKILL_IDS.dataAnalysis,
      name: "Data Analysis",
      category: "Analysis",
      description: "Analyzes data, creates visualizations",
      source: "marketplace" as const,
      path: "~/.orchestra/skills/data-analysis",
    },
  ] as const;

  for (const skill of skills) {
    const result = await prisma.skill.upsert({
      where: { id: skill.id },
      update: {
        name: skill.name,
        category: skill.category,
        description: skill.description,
        source: skill.source,
        path: skill.path,
      },
      create: {
        id: skill.id,
        name: skill.name,
        category: skill.category,
        description: skill.description,
        source: skill.source,
        path: skill.path,
      },
    });
    console.log(`  Skill: ${result.name}`);
  }

  console.log("Seeding complete.");
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
