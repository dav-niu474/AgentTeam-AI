# Task: bugfix+seed - Bug Fixes & Seed Data

## Summary
Fixed 3 known bugs and added seed data feature to AgentTeam collaboration platform.

## Bug Fixes
1. **broadcastEvent non-blocking**: Removed `await` from all 5 API routes calling `broadcastEvent()`, making them fire-and-forget. This prevents API responses from hanging when the WS service is down.
2. **React Query cache invalidation**: Added `refetchOnMount: 'always'` to `useStats`, `useMembers`, and `useIssues` queries in hooks.ts.
3. **Dashboard empty state**: Updated the "no agents" empty state to show a prominent CTA with "一键创建默认团队" button that calls POST /api/seed.

## Seed Data Feature
- Created `/api/seed` endpoint that creates demo data (3 agents, 5 skills, 3 issues, 4 comments, 1 inspiration)
- Created `use-seed-data.ts` hook for first-visit seeding prompt
- Added "重置示例数据" button in Settings view

## Files Modified
- `/src/lib/events.ts` - (unchanged, already has try/catch)
- `/src/lib/hooks.ts` - Added refetchOnMount to key queries
- `/src/app/api/members/route.ts` - Removed await from broadcastEvent
- `/src/app/api/issues/route.ts` - Removed await from broadcastEvent
- `/src/app/api/comments/route.ts` - Removed await from broadcastEvent
- `/src/app/api/issues/[id]/status/route.ts` - Removed await from broadcastEvent
- `/src/app/api/inspirations/[id]/analyze/route.ts` - Removed await from broadcastEvent
- `/src/components/views/dashboard-view.tsx` - Empty state CTA + PlusCircle import + useQueryClient
- `/src/components/views/settings-view.tsx` - Added data management card with reset button

## Files Created
- `/src/app/api/seed/route.ts` - Seed data endpoint
- `/src/lib/use-seed-data.ts` - Seed initialization hook

## Lint Status
All ESLint checks pass.
