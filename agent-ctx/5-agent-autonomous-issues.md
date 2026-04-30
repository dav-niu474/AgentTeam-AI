# Task 5: Agent Autonomous Issue Creation

## Summary
Implemented the core paradigm feature: "Users provide inspiration, Agents autonomously analyze and create Issues". Enhanced inspiration analysis with agent-aware LLM prompts, created agent auto-assign and background scanner APIs, added Agent Activity Feed to Dashboard, and added Auto-pilot toggle to Agents view.

## Changes Made

### 1. Enhanced Inspiration Analysis API (`/src/app/api/inspirations/[id]/analyze/route.ts`)
- Complete rewrite with agent-aware LLM prompts
- Agent finds itself (prefers online > busy > offline)
- LLM prompt includes agent name, capabilities, and system prompt
- Returns structured JSON with analysis, issues, and suggestedAssignee
- Issues created with `creatorId = agentId` (Agent creates, not human)
- Assigns to self or suggested agent based on LLM recommendation
- Proper audit logging showing agent as creator

### 2. Agent Auto-Assign API (`/src/app/api/agents/auto-assign/route.ts`)
- POST /api/agents/auto-assign
- Scoring system: status (3/1/0) + workload (5-n) + capability match + autopilot bonus
- Returns recommended agent with score breakdown
- Optionally auto-assigns to an issue if issueId provided

### 3. Agent Background Scanner API (`/src/app/api/agents/scan/route.ts`)
- POST /api/agents/scan
- Gathers recent audit logs, pending inspirations, stale issues
- LLM analyzes and suggests proactive actions
- Creates issues autonomously with `creatorId = agentId`
- Duplicate detection (skips existing titles)
- Returns scan summary, created issues, recommendations

### 4. Prisma Schema Update
- Added `autopilot Boolean? @default(false)` to Member model
- Ran `bun run db:push` successfully

### 5. API & Hooks Layer Updates
- Added `AutoAssignResult` and `ScanResult` types to `/src/lib/api.ts`
- Added `agentsApi.autoAssign()` and `agentsApi.scan()` helper functions
- Added `useAutoAssign()` and `useAgentScan()` hooks to `/src/lib/hooks.ts`
- Added `autopilot` field to `CreateMemberData`, `UpdateMemberData`, and `Member` types
- Updated `/src/app/api/members/[id]/route.ts` PATCH to handle `autopilot` field

### 6. Dashboard View - Agent Activity Feed (`/src/components/views/dashboard-view.tsx`)
- Added "触发 Agent 扫描" button in Quick Actions (4-column grid)
- Added new "Agent 活动" card section with:
  - Scan result display (orange theme)
  - Agent-driven activity log filtered from audit logs
  - Radar icon header + "触发扫描" button
- Updated `handleAgentScan` to call `/api/agents/scan` endpoint
- Added `agent_proactive_create` and `agent_scan` action icons/colors
- Updated `formatActionLabel` with new action types

### 7. Agents View - Auto-pilot Toggle (`/src/components/views/agents-view.tsx`)
- Added Switch component import
- Added Zap icon import
- Added Auto-pilot toggle on each agent card (bottom row)
- Added Auto-pilot section in Agent Detail Sheet with:
  - Description text (changes based on state)
  - Direct toggle switch (no editing mode needed)
  - Also available in editing mode
- Added `handleToggleAutopilot` function
- Added `useUpdateMember` hook
- Orange color theme for autopilot indicators

## Key Paradigm Shift
- Issues are now primarily CREATED BY AGENTS, not by humans
- `creatorId` in issues = Agent's member ID → shows "Created by CodeAgent"
- Users provide inspiration → Agent analyzes → Agent creates Issues → Agent assigns itself
- Auto-pilot mode: Agents can automatically pick up new issues in their capability domain

## Files Modified
- `/prisma/schema.prisma` - Added autopilot field
- `/src/app/api/inspirations/[id]/analyze/route.ts` - Complete rewrite
- `/src/app/api/agents/auto-assign/route.ts` - New file
- `/src/app/api/agents/scan/route.ts` - New file
- `/src/app/api/members/[id]/route.ts` - Added autopilot to PATCH
- `/src/lib/api.ts` - Added types and API helpers
- `/src/lib/hooks.ts` - Added hooks
- `/src/components/views/dashboard-view.tsx` - Agent Activity Feed + scan button
- `/src/components/views/agents-view.tsx` - Auto-pilot toggle

## Lint Status
All modified files pass ESLint checks. Application compiles and runs successfully.
