/**
 * CLI Tool Detection Module
 * Detects available CLI tools on the system and caches results
 */

export interface DetectedTool {
  name: string;
  available: boolean;
  version?: string;
  error?: string;
}

const TOOLS_TO_DETECT = [
  { name: 'git', command: 'git --version', versionRegex: /git version (\d+\.\d+\.\d+)/ },
  { name: 'node', command: 'node --version', versionRegex: /v(\d+\.\d+\.\d+)/ },
  { name: 'npm', command: 'npm --version', versionRegex: /(\d+\.\d+\.\d+)/ },
  { name: 'python', command: 'python3 --version', versionRegex: /Python (\d+\.\d+\.\d+)/ },
  { name: 'pip', command: 'pip3 --version', versionRegex: /pip (\d+\.\d+\.\d+)/ },
  { name: 'docker', command: 'docker --version', versionRegex: /Docker version (\d+\.\d+\.\d+)/ },
  { name: 'bun', command: 'bun --version', versionRegex: /(\d+\.\d+\.\d+)/ },
];

// Cache for detected tools
let cachedTools: DetectedTool[] | null = null;

/**
 * Execute a shell command and return its output
 */
async function execCommand(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const proc = Bun.spawn(command.split(' '), {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
  } catch {
    return { stdout: '', stderr: 'Command not found', exitCode: 1 };
  }
}

/**
 * Detect a single CLI tool
 */
async function detectSingleTool(toolDef: (typeof TOOLS_TO_DETECT)[number]): Promise<DetectedTool> {
  const result = await execCommand(toolDef.command);

  if (result.exitCode !== 0) {
    return {
      name: toolDef.name,
      available: false,
      error: result.stderr || 'Command failed',
    };
  }

  const match = result.stdout.match(toolDef.versionRegex);
  return {
    name: toolDef.name,
    available: true,
    version: match ? match[1] : undefined,
  };
}

/**
 * Detect all available CLI tools
 * @param forceRefresh - Force re-detection even if cached results exist
 */
export async function detectTools(forceRefresh = false): Promise<DetectedTool[]> {
  if (cachedTools && !forceRefresh) {
    return cachedTools;
  }

  const detectionPromises = TOOLS_TO_DETECT.map(detectSingleTool);
  cachedTools = await Promise.all(detectionPromises);

  return cachedTools;
}

/**
 * Get list of available tool names only
 */
export async function getAvailableToolNames(forceRefresh = false): Promise<string[]> {
  const tools = await detectTools(forceRefresh);
  return tools.filter(t => t.available).map(t => t.name);
}

/**
 * Check if a specific tool is available
 */
export async function isToolAvailable(toolName: string): Promise<boolean> {
  const tools = await detectTools();
  const tool = tools.find(t => t.name === toolName);
  return tool?.available ?? false;
}
