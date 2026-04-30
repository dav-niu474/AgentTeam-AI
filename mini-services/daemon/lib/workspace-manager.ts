/**
 * Workspace Manager Module
 * Creates and manages isolated workspace directories for Agent task execution
 */

import { mkdir, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';

const WORKSPACE_BASE = '/tmp/agentteam-workspaces';

export interface WorkspaceInfo {
  dir: string;
  issueId: string;
  createdAt: Date;
  taskDescription?: string;
}

/**
 * Ensure the workspace base directory exists
 */
async function ensureBaseDir(): Promise<void> {
  try {
    await mkdir(WORKSPACE_BASE, { recursive: true });
  } catch {
    // Directory might already exist
  }
}

/**
 * Create a new isolated workspace for a task
 * @param issueId - The Issue ID this workspace is for
 * @param taskDescription - Optional task description to write in README
 * @returns Workspace info including the directory path
 */
export async function createWorkspace(
  issueId: string,
  taskDescription?: string
): Promise<WorkspaceInfo> {
  await ensureBaseDir();

  const timestamp = Date.now();
  const workspaceName = `${issueId}-${timestamp}`;
  const workspaceDir = join(WORKSPACE_BASE, workspaceName);

  // Create the workspace directory
  await mkdir(workspaceDir, { recursive: true });

  // Create a README with task context
  const readmeContent = [
    '# AgentTeam Workspace',
    '',
    `**Issue ID**: ${issueId}`,
    `**Created**: ${new Date().toISOString()}`,
    '',
    taskDescription ? `## Task Description\n\n${taskDescription}` : '',
    '',
    '---',
    '*This workspace is managed by AgentTeam Daemon*',
  ].filter(Boolean).join('\n');

  await writeFile(join(workspaceDir, 'README.md'), readmeContent, 'utf-8');

  return {
    dir: workspaceDir,
    issueId,
    createdAt: new Date(),
    taskDescription,
  };
}

/**
 * Check if a workspace directory exists
 */
export async function workspaceExists(workspaceDir: string): Promise<boolean> {
  try {
    const s = await stat(workspaceDir);
    return s.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Write a file to the workspace
 */
export async function writeWorkspaceFile(
  workspaceDir: string,
  filePath: string,
  content: string
): Promise<void> {
  const fullPath = join(workspaceDir, filePath);
  const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));

  // Ensure nested directories exist
  await mkdir(dir, { recursive: true });
  await writeFile(fullPath, content, 'utf-8');
}

/**
 * Read a file from the workspace
 */
export async function readWorkspaceFile(
  workspaceDir: string,
  filePath: string
): Promise<string | null> {
  try {
    return await readFile(join(workspaceDir, filePath), 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Clean up a workspace directory
 */
export async function cleanupWorkspace(workspaceDir: string): Promise<void> {
  try {
    await rm(workspaceDir, { recursive: true, force: true });
  } catch {
    // Best effort cleanup
  }
}

/**
 * List all workspaces
 */
export async function listWorkspaces(): Promise<string[]> {
  await ensureBaseDir();

  try {
    const dir = Bun.file(WORKSPACE_BASE);
    // Use a simple approach to list directories
    const proc = Bun.spawn(['ls', '-1', WORKSPACE_BASE], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;
    return stdout.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}
