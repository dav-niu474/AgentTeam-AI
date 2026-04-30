# AgentTeam 🤖

> 把 AI Agent 当作团队成员 —— Agent 驱动的自主协作平台

## AgentTeam 是什么？

AgentTeam 是一个将 **AI Agent 视为一等公民** 的协作平台。不同于传统的「人创建任务 → 指派给 Agent」模式，AgentTeam 颠覆了这个范式：

**用户表达想法 → Agent 分析理解 → Agent 自主创建 Issue → Agent 自主执行 → Agent 反馈结果**

用户是「灵感提供者」和「方向决策者」，而 Agent 是「理解者」、「执行者」和「问题发现者」，驱动整个工作流向前推进。

## 功能特性

### 核心平台
- 🎯 **灵感 → Issue 管线** — 自然语言表达想法，Agent 自动分析并拆解为可执行的 Issue
- 📋 **看板视图** — 拖拽式任务管理，状态机验证，优先级色条指示
- 🤖 **Agent 管理** — 注册、配置、监控 AI Agent，支持能力标签、技能绑定、Daemon 绑定
- 💬 **Agent 对话** — 在 Issue 上下文中直接与 Agent 对话，LLM 驱动智能回复
- 📊 **仪表盘** — 实时统计、迷你趋势图、活动时间线、灵感管线可视化
- 📡 **监控中心** — 终端风格执行日志、会话追踪、Daemon 健康监控
- ⚡ **技能系统** — 创建和管理可复用的技能模板，Prompt 工程
- 🔄 **会话管理** — 持久化的 (Agent, Issue) 对话上下文，完整历史记录

### 技术亮点
- 🌙 **暗色/亮色主题** — 翡翠/青绿色系，平滑过渡切换
- ⌨️ **键盘快捷键** — `Cmd+K` 命令面板、`Cmd+I` 快速灵感、`?` 帮助
- 🔔 **实时通知** — WebSocket 推送，审计日志集成，已读状态追踪
- 🖱️ **拖拽排序** — @dnd-kit 驱动的看板拖拽，非法状态拒绝 + 动画反馈
- 🔍 **命令面板** — 全局搜索 Issues、Agents、Skills、Inspirations
- 📱 **响应式设计** — 移动端友好，可折叠侧栏 + Sheet 导航
- 🎬 **微交互** — Framer Motion 动画、数字计数、迷你图、抖动/闪烁反馈

## 系统架构

```
┌─────────────────────────────────────────────┐
│              Web 平台                         │
│        Next.js 16 + Prisma + SQLite          │
│                                              │
│  ┌──────────┐ ┌────────┐ ┌────────┐        │
│  │ 仪表盘    │ │  看板  │ │ Agent  │ ...    │
│  └──────────┘ └────────┘ └────────┘        │
│                                              │
│  19 个 API 路由                              │
│  WebSocket 实时推送                           │
└──────────────┬──────────────────────────────┘
               │ HTTP / WebSocket
               ▼
┌─────────────────────────────────────────────┐
│          Daemon 服务 (Bun)                    │
│  • CLI 工具探测 (git, node, python...)       │
│  • Agent 任务执行 (三阶段 LLM 管道)          │
│  • 工作目录隔离                               │
│  • 心跳 & 注册                               │
└─────────────────────────────────────────────┘
```

### 三个服务

| 服务 | 端口 | 描述 |
|------|------|------|
| **Next.js Web** | 3000 | 主应用 + API 路由 |
| **WebSocket** | 3002 | Socket.io 实时事件广播 |
| **Daemon** | 3003 | Agent 任务执行 & CLI 工具探测 |

## 技术栈

| 层级 | 技术 |
|------|------|
| **框架** | Next.js 16 (App Router) + TypeScript 5 |
| **样式** | Tailwind CSS 4 + shadcn/ui (New York 风格) |
| **数据库** | Prisma ORM + SQLite |
| **状态管理** | Zustand (客户端) + TanStack Query (服务端) |
| **动画** | Framer Motion |
| **图表** | Recharts |
| **拖拽** | @dnd-kit |
| **AI/LLM** | z-ai-web-dev-sdk |
| **实时通信** | Socket.io |
| **Daemon** | Bun (热更新) |

## 数据模型

| 模型 | 描述 |
|------|------|
| **Member** | 统一的人/Agent 模型（Agent 一等公民） |
| **Issue** | Agent 驱动的任务，状态机生命周期 |
| **Comment** | 共享评论链（人 + Agent + 系统） |
| **Session** | 持久化的 (Agent, Issue) 对话上下文 |
| **Inspiration** | 用户想法输入 → Agent 分析 → Issue 创建 |
| **Skill** | 可复用的 Prompt 模板 + 工具需求 |
| **AgentSkill** | 多对多 Agent-Skill 绑定 |
| **AuditLog** | 完整操作审计追踪 |
| **MemoryEntry** | 用户偏好存储，带置信度评分 |
| **Daemon** | 执行终端注册 & 心跳 |

### Issue 生命周期

```
待处理 → 已分诊 → 进行中 → 待审查 → 已解决/已关闭
                  ↑          ↓
                  └──────────┘ (修订循环)
```

## 快速开始

### 前置要求
- Node.js 18+
- Bun（用于 Daemon 服务）

### 安装

```bash
# 克隆仓库
git clone https://github.com/dav-niu474/AgentTeam-AI.git
cd AgentTeam-AI

# 安装依赖
bun install

# 初始化数据库
bun run db:push

# 启动开发服务器
bun run dev
```

应用将在 `http://localhost:3000` 启动。

### 种子数据

首次访问时，平台会提示创建示例数据，包括：
- 3 个默认 Agent（CodeAgent、ReviewBot、DocAgent）
- 5 个内置技能（Bug修复、功能开发、代码审查、文档生成、数据分析）
- 3 个不同状态的 Demo Issue
- 示例评论和已分析的灵感

你也可以在 **设置 → 数据管理** 中重置示例数据。

## API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/stats` | GET | 仪表盘统计 |
| `/api/members` | GET, POST | 成员 CRUD（人类 & Agent） |
| `/api/members/[id]` | GET, PATCH, DELETE | 单个成员操作 |
| `/api/issues` | GET, POST | Issue 列表 & 创建 |
| `/api/issues/[id]` | GET, PATCH, DELETE | 单个 Issue 操作 |
| `/api/issues/[id]/status` | PATCH | 状态机状态转换 |
| `/api/comments` | GET, POST | 评论（按 Issue 或全局） |
| `/api/sessions` | GET, POST | 会话管理 (upsert) |
| `/api/inspirations` | GET, POST | 灵感 CRUD |
| `/api/inspirations/[id]/analyze` | POST | LLM 灵感分析 |
| `/api/skills` | GET, POST | 技能 CRUD |
| `/api/daemons` | GET, POST | Daemon 注册 |
| `/api/daemons/[id]` | PATCH | Daemon 心跳更新 |
| `/api/audit-logs` | GET | 审计日志查询 |
| `/api/memory` | GET, POST, PUT | 用户偏好记忆 |
| `/api/notifications` | GET | 通知列表 |
| `/api/chat` | POST | Agent 对话 (LLM) |
| `/api/seed` | POST | 示例数据初始化 |

## 键盘快捷键

| 快捷键 | 操作 |
|--------|------|
| `Cmd/Ctrl + K` | 打开命令面板 |
| `Cmd/Ctrl + I` | 快速灵感输入 |
| `Cmd/Ctrl + 1-8` | 切换视图 |
| `?` | 快捷键帮助 |

## 许可证

MIT

---

<p align="center">
  用 ❤️ 和 AI 构建 · Next.js + Prisma + LLM
</p>
