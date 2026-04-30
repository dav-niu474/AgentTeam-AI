# AgentTeam 🤖

> AI Agent as Team Member — An Agent-driven autonomous collaboration platform.

## What is AgentTeam?

AgentTeam is a collaboration platform that treats **AI Agents as first-class team members**. Instead of the traditional "human creates task → assigns to agent" workflow, AgentTeam flips the paradigm:

**User expresses idea → Agent analyzes → Agent creates Issues → Agent executes → Agent reports results**

Users are "inspiration providers" and "direction decision-makers", while Agents are the "understanders", "executors", and "problem discoverers" driving the workflow forward.

## Features

### Core Platform
- 🎯 **Inspiration → Issue Pipeline** — Express ideas naturally; Agents analyze and autonomously break them into actionable Issues
- 📋 **Kanban Board** — Drag-and-drop task management with state machine validation and priority indicators
- 🤖 **Agent Management** — Register, configure, and monitor AI Agents with capabilities, skills, and daemon bindings
- 💬 **Agent Chat** — Have conversations with Agents directly within Issue context, powered by LLM
- 📊 **Dashboard** — Real-time stats, sparkline charts, activity timeline, and inspiration pipeline visualization
- 📡 **Monitor** — Terminal-style execution logs, session tracking, and daemon health monitoring
- ⚡ **Skills System** — Create and manage reusable skill templates with prompt engineering
- 🔄 **Sessions** — Persistent (Agent, Issue) conversation sessions with full history

### Technical Highlights
- 🌙 **Dark/Light Theme** — Emerald/teal color scheme with smooth transitions
- ⌨️ **Keyboard Shortcuts** — `Cmd+K` command palette, `Cmd+I` quick inspiration, `?` help
- 🔔 **Real-time Notifications** — WebSocket-powered push with audit log integration
- 🖱️ **Drag & Drop** — @dnd-kit powered Kanban with invalid state rejection and animations
- 🔍 **Command Palette** — Global search across Issues, Agents, Skills, and Inspirations
- 📱 **Responsive Design** — Mobile-friendly with collapsible sidebar and sheet navigation
- 🎬 **Micro-interactions** — Framer Motion animations, count-up effects, sparklines, shake/flash feedback

## Architecture

```
┌─────────────────────────────────────────────┐
│              Web Platform                    │
│        Next.js 16 + Prisma + SQLite         │
│                                              │
│  ┌──────────┐ ┌────────┐ ┌────────┐        │
│  │Dashboard  │ │ Board  │ │ Agents │ ...    │
│  └──────────┘ └────────┘ └────────┘        │
│                                              │
│  API Routes (19 endpoints)                   │
│  WebSocket Real-time Push                    │
└──────────────┬──────────────────────────────┘
               │ HTTP / WebSocket
               ▼
┌─────────────────────────────────────────────┐
│            Daemon Service (Bun)              │
│  • CLI Tool Detection (git, node, python..) │
│  • Agent Task Execution (3-stage LLM)       │
│  • Workspace Isolation                       │
│  • Heartbeat & Registration                  │
└─────────────────────────────────────────────┘
```

### Three Services

| Service | Port | Description |
|---------|------|-------------|
| **Next.js Web** | 3000 | Main application with API routes |
| **WebSocket** | 3002 | Socket.io real-time event broadcasting |
| **Daemon** | 3003 | Agent task execution & CLI tool detection |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) + TypeScript 5 |
| **Styling** | Tailwind CSS 4 + shadcn/ui (New York) |
| **Database** | Prisma ORM + SQLite |
| **State** | Zustand (client) + TanStack Query (server) |
| **Animation** | Framer Motion |
| **Charts** | Recharts |
| **Drag & Drop** | @dnd-kit |
| **AI/LLM** | z-ai-web-dev-sdk |
| **Real-time** | Socket.io |
| **Daemon** | Bun (hot reload) |

## Data Models

| Model | Description |
|-------|-------------|
| **Member** | Unified human/agent model (Agent as first-class citizen) |
| **Issue** | Agent-driven task with state machine lifecycle |
| **Comment** | Shared comment chain (human + agent + system) |
| **Session** | Persistent (Agent, Issue) conversation context |
| **Inspiration** | User idea input → Agent analysis → Issue creation |
| **Skill** | Reusable prompt template with tool requirements |
| **AgentSkill** | Many-to-many Agent-Skill binding |
| **AuditLog** | Full operation audit trail |
| **MemoryEntry** | User preference storage with confidence scoring |
| **Daemon** | Execution terminal registration & heartbeat |

### Issue Lifecycle

```
Open → Triaged → In Progress → In Review → Resolved/Closed
                    ↑              ↓
                    └──────────────┘ (revision loop)
```

## Getting Started

### Prerequisites
- Node.js 18+
- Bun (for daemon service)

### Installation

```bash
# Clone the repository
git clone https://github.com/dav-niu474/AgentTeam-AI.git
cd AgentTeam-AI

# Install dependencies
bun install

# Initialize database
bun run db:push

# Start development server
bun run dev
```

The app will be available at `http://localhost:3000`.

### Seed Data

On first visit, the platform offers to create demo data including:
- 3 default Agents (CodeAgent, ReviewBot, DocAgent)
- 5 built-in Skills (Bug Fix, Feature Dev, Code Review, Doc Gen, Data Analysis)
- 3 demo Issues across different statuses
- Sample comments and an analyzed inspiration

You can also reset demo data from **Settings → Data Management**.

## API Endpoints

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/stats` | GET | Dashboard statistics |
| `/api/members` | GET, POST | Member CRUD (human & agent) |
| `/api/members/[id]` | GET, PATCH, DELETE | Single member operations |
| `/api/issues` | GET, POST | Issue listing & creation |
| `/api/issues/[id]` | GET, PATCH, DELETE | Single issue operations |
| `/api/issues/[id]/status` | PATCH | State machine status transition |
| `/api/comments` | GET, POST | Comments (by issue or global) |
| `/api/sessions` | GET, POST | Session management (upsert) |
| `/api/inspirations` | GET, POST | Inspiration CRUD |
| `/api/inspirations/[id]/analyze` | POST | LLM-powered inspiration analysis |
| `/api/skills` | GET, POST | Skill CRUD |
| `/api/daemons` | GET, POST | Daemon registration |
| `/api/daemons/[id]` | PATCH | Daemon heartbeat update |
| `/api/audit-logs` | GET | Audit log queries |
| `/api/memory` | GET, POST, PUT | User preference memory |
| `/api/notifications` | GET | Notification feed |
| `/api/chat` | POST | Agent conversation (LLM) |
| `/api/seed` | POST | Demo data initialization |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open command palette |
| `Cmd/Ctrl + I` | Quick inspiration input |
| `Cmd/Ctrl + 1-8` | Switch views |
| `?` | Keyboard shortcuts help |

## License

MIT

---

<p align="center">
  Built with ❤️ using Next.js, Prisma, and AI
</p>
