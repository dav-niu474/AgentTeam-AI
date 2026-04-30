/**
 * Agent Executor Module
 * LLM-powered task execution using z-ai-web-dev-sdk
 * Supports different scenes (code-gen, doc, analysis, review) with appropriate prompts
 */

import ZAI from 'z-ai-web-dev-sdk';

// ==========================================
// Types
// ==========================================

export interface AgentConfig {
  agentId: string;
  agentName: string;
  systemPrompt?: string;
  capabilities?: string[];
  scene?: string;
}

export interface TaskResult {
  analysis: string;
  plan: string;
  solution: string;
}

export interface ProgressCallback {
  (phase: string, message: string): Promise<void>;
}

// ==========================================
// Scene-specific system prompts
// ==========================================

const SCENE_PROMPTS: Record<string, string> = {
  'code-gen': `You are an expert software developer Agent. Your job is to analyze tasks, plan implementation, and generate high-quality code. 
Focus on:
- Clean, readable, and maintainable code
- Following best practices and design patterns
- Proper error handling and edge cases
- Clear comments and documentation
- Testing considerations`,

  'doc': `You are a technical documentation Agent. Your job is to analyze tasks and produce clear, comprehensive documentation.
Focus on:
- Clear and concise language
- Proper document structure and hierarchy
- Code examples where appropriate
- API documentation format when relevant
- Table of contents for longer documents`,

  'analysis': `You are a data and code analysis Agent. Your job is to analyze problems, gather insights, and provide thorough analytical reports.
Focus on:
- Systematic problem breakdown
- Data-driven insights
- Root cause analysis
- Risk assessment
- Actionable recommendations`,

  'review': `You are a code review Agent. Your job is to review code and provide constructive feedback.
Focus on:
- Code quality and readability
- Security vulnerabilities
- Performance issues
- Best practices compliance
- Constructive improvement suggestions`,

  'custom': `You are a versatile Agent capable of handling various tasks. Analyze the task carefully and provide the best possible solution.`,
};

const DEFAULT_SYSTEM_PROMPT = `You are an AgentTeam Agent, an AI-powered assistant that helps execute tasks collaboratively. 
You analyze tasks, create execution plans, and deliver solutions. Always be thorough, clear, and actionable in your responses.`;

// ==========================================
// Agent Executor
// ==========================================

let zaiInstance: InstanceType<typeof ZAI> | null = null;

/**
 * Get or initialize the ZAI client
 */
async function getZaiClient(): Promise<InstanceType<typeof ZAI>> {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

/**
 * Get the system prompt for a given scene
 */
function getSystemPrompt(agentConfig: AgentConfig): string {
  if (agentConfig.systemPrompt) {
    return agentConfig.systemPrompt;
  }
  const scene = agentConfig.scene || 'custom';
  return SCENE_PROMPTS[scene] || SCENE_PROMPTS['custom'];
}

/**
 * Execute an Agent task with 3-phase LLM pipeline: Analyze → Plan → Execute
 * @param taskDescription - The task to execute
 * @param agentConfig - Agent configuration
 * @param workspaceDir - Workspace directory path
 * @param onProgress - Optional progress callback
 */
export async function executeAgentTask(
  taskDescription: string,
  agentConfig: AgentConfig,
  workspaceDir: string,
  onProgress?: ProgressCallback
): Promise<TaskResult> {
  const zai = await getZaiClient();
  const systemPrompt = getSystemPrompt(agentConfig);
  const capabilities = agentConfig.capabilities?.join(', ') || 'general';

  // ---- Phase 1: Analyze ----
  if (onProgress) await onProgress('analyzing', '🔍 Analyzing task...');

  const analysisResponse = await zai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: `${systemPrompt}\n\nYour capabilities include: ${capabilities}\nWorking directory: ${workspaceDir}`,
      },
      {
        role: 'user',
        content: `Analyze this task and identify key requirements, constraints, and potential challenges:\n\n${taskDescription}`,
      },
    ],
  });

  const analysis = analysisResponse.choices[0]?.message?.content || 'Analysis could not be generated.';

  if (onProgress) await onProgress('analyzing', '✅ Analysis complete');

  // ---- Phase 2: Plan ----
  if (onProgress) await onProgress('planning', '📋 Creating execution plan...');

  const planResponse = await zai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'You are a task planning agent. Create clear, step-by-step execution plans. Break down complex tasks into manageable steps. Be specific about what needs to be done at each step.',
      },
      {
        role: 'user',
        content: `Create a detailed step-by-step execution plan for the following task:\n\nTask: ${taskDescription}\n\nAnalysis: ${analysis}\n\nProvide a numbered list of steps with clear deliverables for each step.`,
      },
    ],
  });

  const plan = planResponse.choices[0]?.message?.content || 'Plan could not be generated.';

  if (onProgress) await onProgress('planning', '✅ Execution plan created');

  // ---- Phase 3: Execute (generate solution) ----
  if (onProgress) await onProgress('executing', '⚙️ Generating solution...');

  const solutionResponse = await zai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: `${systemPrompt}\n\nYour capabilities include: ${capabilities}\nWorking directory: ${workspaceDir}`,
      },
      {
        role: 'user',
        content: `Execute the following task and provide a complete solution:\n\nTask: ${taskDescription}\n\nPlan:\n${plan}\n\nProvide the complete solution including any code, configurations, or documentation needed. Be thorough and specific.`,
      },
    ],
  });

  const solution = solutionResponse.choices[0]?.message?.content || 'Solution could not be generated.';

  if (onProgress) await onProgress('executing', '✅ Solution generated');

  return { analysis, plan, solution };
}

/**
 * Quick single-turn completion for simpler tasks
 */
export async function quickComplete(
  prompt: string,
  systemPrompt?: string,
): Promise<string> {
  const zai = await getZaiClient();

  const response = await zai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: systemPrompt || DEFAULT_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  return response.choices[0]?.message?.content || '';
}
