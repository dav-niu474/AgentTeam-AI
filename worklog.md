# AgentTeam 协作平台 - 工作日志

---
Task ID: 0
Agent: Main Architect
Task: 系统设计梳理与需求分析

Work Log:
- 分析用户提供的完整项目规格书（5个阶段、8-12周/阶段）
- 梳理核心架构：Web平台 + Daemon服务的双体结构
- 识别6大子系统：任务管理、Agent调度、会话管理、Skill系统、MemoryAgent、移动端
- 明确MVP范围与后续迭代边界
- 设计统一数据模型（Member抽象：人+Agent共用）

Stage Summary:
- 系统设计分析完成，详见下方文档
- MVP聚焦：单人单Agent编码闭环
- 关键架构决策：Agent一等公民、上下文第一资产、平台与执行分离

---

# 系统设计分析文档

## 一、平台定位

**AgentTeam** 是一个"把 AI Agent 当作团队成员"的协作平台。核心交互模式：

```
用户（灵感/需求/想法）→ Agent（分析/理解/拆解/创建Issue）→ Issue Board → Agent（自主执行）
                              ↕                                    ↕
                     结合历史经验/偏好                        评论/代码/文档/结果
                              ↕                                    ↕
                      MemoryAgent                              Daemon（终端）
```

**本质**：它不是"给开发者用的AI助手"，而是一个**Agent驱动的自主协作平台**。用户是"灵感提供者"和"方向决策者"，Agent是"理解者"、"执行者"和"问题发现者"。Agent不仅被动执行任务，更是主动创建任务、分析需求、拆解问题的核心驱动力。

### 🔄 核心交互范式转变

**传统模式**：用户创建Issue → 指派Agent → Agent执行
**AgentTeam模式**：用户表达想法 → Agent分析理解 → Agent自主创建Issue → Agent自主执行 → Agent反馈结果

用户可以直接创建Issue（保留此能力），但**主要流程是Agent驱动**。

## 二、系统架构（双体结构）

```
┌─────────────────────────────────────────────────────┐
│                   Web Platform                       │
│  (Next.js 16 + Prisma + SQLite)                     │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Dashboard │ │  Issue   │ │  Agent   │ │ Monitor│ │
│  │  总览页   │ │  看板页  │ │  配置页  │ │ 日志页 │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                                                      │
│  API Routes (Orchestrator)                           │
│  ├─ /api/issues      任务CRUD + 状态机               │
│  ├─ /api/agents      Agent注册/配置/状态              │
│  ├─ /api/comments    人类+Agent评论                   │
│  ├─ /api/sessions    会话持久化                       │
│  ├─ /api/skills      技能管理                         │
│  ├─ /api/daemons     Daemon注册/心跳                  │
│  ├─ /api/memory      偏好查询                         │
│  └─ /api/audit       审计日志                         │
│                                                      │
│  WebSocket (实时推送)                                 │
│  ├─ Issue状态变更通知                                 │
│  ├─ Agent执行进度流                                   │
│  └─ 评论实时更新                                     │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP/WebSocket
                      ▼
┌─────────────────────────────────────────────────────┐
│                 Daemon Service                       │
│  (独立 Bun 服务, 端口 3003)                          │
│                                                      │
│  ├─ CLI工具探测 (git, python, docker, node...)       │
│  ├─ 任务接收与执行                                    │
│  │   ├─ git clone / checkout                         │
│  │   ├─ 启动 Agent 进程                              │
│  │   └─ 上报执行结果                                 │
│  ├─ 工作目录管理（隔离沙箱）                          │
│  └─ 会话状态持久化                                    │
└─────────────────────────────────────────────────────┘
```

## 三、核心数据模型

### 3.1 统一成员抽象（Agent一等公民）

```
Member (抽象基类)
├── type: "human" | "agent"
├── name, avatar, email
├── Human 额外字段: role (admin/member)
└── Agent 额外字段:
    ├── capabilities: string[] (能力标签)
    ├── group: string (所属群组)
    ├── daemonId: string (绑定的执行终端)
    ├── skills: Skill[] (已绑定技能)
    └── status: "online" | "busy" | "offline"
```

### 3.2 灵感与Issue（Agent驱动的任务创建）

**Inspiration（灵感/想法）**— 用户的主要输入方式：
```
Inspiration
├── content: string (用户的原始表达，自然语言)
├── source: "chat" | "voice" | "quick_note" | "im"
├── status: "pending" | "analyzing" | "converted" | "dismissed"
├── createdBy: string (人类用户ID)
└── convertedIssues: Issue[] (Agent拆解后创建的Issue列表)
```

**Issue 生命周期（Agent主导）**：
```
用户表达想法 → Agent分析 → Agent创建Issue(Open) → Agent自动指派自己 → In Progress → In Review → Resolved
                  ↓                                                            ↓
            Agent拆解为多个子Issue                                     人类审批/反馈
```

每个Issue关联：
- creator: Member (Agent或人，但主要是Agent创建)
- assignee: Member (默认Agent自己接手)
- inspirationId: string? (来源灵感，可选)
- parentIssueId: string? (父Issue，Agent拆解时产生)
- comments: Comment[] (人+Agent共用)
- session: Session (Agent执行上下文)
- scene: string (场景：code-gen, doc, analysis...)
- priority: "low" | "medium" | "high" | "urgent" (Agent可根据偏好判断)
- labels: string[] (Agent自动打标签)

### 3.3 会话持久化

```
Session
├── (agentId, issueId) → 唯一确定一个会话
├── messages: Message[] (多轮对话历史)
├── workingDir: string (git工作目录路径)
├── gitBranch: string (当前分支)
└── status: "active" | "paused" | "completed"
```

### 3.4 Skill 系统

```
Skill
├── name, description
├── promptTemplate: string
├── tools: string[] (所需CLI工具)
├── acceptanceCriteria: string
├── version: number
├── usageCount: number
└── embedding: float[] (向量检索用)
```

### 3.5 审计与记忆

```
AuditLog
├── actorId, actorType (human/agent/system)
├── action: string
├── target: string (issue/comment/pr...)
├── details: JSON
└── timestamp

MemoryEntry
├── userId: string
├── category: "code_style" | "review_preference" | "priority" | ...
├── key: string
├── value: string/JSON
├── confidence: float (0-1)
├── source: string (事件来源)
└── embedding: float[]
```

## 四、MVP范围界定（阶段一）

### 包含 ✅
| 模块 | 功能 | 优先级 |
|------|------|--------|
| Issue管理 | CRUD + 状态流转(Open→In Progress→Done) | P0 |
| Agent注册 | Profile管理（名称、头像、能力标签） | P0 |
| 指派逻辑 | 人可将Issue指派给Agent | P0 |
| 评论系统 | 人+Agent共用评论链 | P0 |
| 会话管理 | (Agent,Issue)对话历史保存与恢复 | P0 |
| Daemon服务 | CLI探测、任务接收、执行上报 | P0 |
| Agent执行 | 获取Issue→生成代码→自测→评论→提PR | P0 |
| Web看板 | 任务列表、Issue详情、Agent配置 | P0 |
| 安全沙箱 | 工作目录隔离 | P1 |

### 不包含 ❌（后续阶段）
- 多Agent协作 (阶段二)
- Skill系统 (阶段二)
- Autopilot定时任务 (阶段二)
- MemoryAgent (阶段三)
- 无人值守决策 (阶段三)
- 移动端/IM接入 (阶段四)
- AEP协议/适配器市场 (阶段五)

## 五、前端页面规划

### 5.1 全局布局

```
┌─────────────────────────────────────────────┐
│ 顶部导航栏 (Logo + 搜索 + 通知 + 用户头像)   │
├──────┬──────────────────────────────────────┤
│ 侧边 │                                      │
│ 导航 │         主内容区                       │
│      │                                      │
│ 仪表盘│                                      │
│ 看板  │                                      │
│ Agent │                                      │
│ 监控  │                                      │
│ 设置  │                                      │
├──────┴──────────────────────────────────────┤
│ 底部状态栏 (Daemon状态 + 系统信息)            │
└─────────────────────────────────────────────┘
```

### 5.2 页面清单

1. **Dashboard 总览页**
   - 任务统计卡片（总数/进行中/待审查/已完成）
   - Agent状态概览（在线/忙碌/离线）
   - 最近活动时间线
   - 快速操作入口

2. **Issue 看板页**
   - Kanban视图：按状态分列，支持拖拽
   - 列表视图：表格形式，支持筛选排序
   - Issue详情侧边面板：
     - 标题、描述、场景标签
     - 指派人（人类下拉 + Agent下拉）
     - 评论链（人类评论 + Agent进度/结果）
     - 会话上下文面板（Agent的思考过程）
     - 附件/代码差异

3. **Agent 配置页**
   - Agent列表（卡片式，显示状态/能力/当前任务）
   - Agent详情/编辑：
     - 基本信息（名称、头像、描述）
     - 能力标签管理
     - 绑定Daemon选择
     - 技能绑定
     - 执行历史

4. **监控与日志页**
   - Agent执行日志（实时流式）
   - 会话快照
   - 事件审计追踪
   - Daemon状态监控

5. **设置页**
   - 个人偏好
   - Daemon管理
   - 通知配置

## 六、技术实现要点

### 6.1 Web Platform (Next.js)
- App Router + API Routes
- Prisma ORM + SQLite
- Zustand 状态管理
- TanStack Query 数据获取
- shadcn/ui 组件库
- WebSocket 实时通信
- z-ai-web-dev-sdk 集成LLM

### 6.2 Daemon Service (Bun独立服务)
- 端口 3003
- 通过 XTransformPort 与前端通信
- CLI工具自动探测
- 任务队列管理
- 工作目录隔离

### 6.3 Agent执行流程（Agent驱动版）
```
1. 用户表达想法/灵感（聊天框/快速输入/IM）
2. Agent接收灵感，调用LLM分析理解
3. Agent结合历史偏好(MemoryAgent简化版)判断优先级
4. Agent自主创建Issue(s)，可能拆解为多个子任务
5. Agent自动指派给自己，状态变为In Progress
6. Orchestrator创建Session
7. Daemon接收任务，准备环境
8. Agent读取Issue描述（通过SDK调用LLM）
9. Agent生成代码/修改
10. Agent运行linter/test
11. Agent提交评论和结果，状态变为In Review
12. 用户审查，可追加要求或批准
13. Agent在同一Session中增量修改（若用户反馈）
14. Issue标记Resolved，经验沉淀到偏好库
```

### 6.4 灵感输入 → Agent分析的API流程
```
POST /api/inspirations
  → 保存灵感内容
  → 触发Agent分析（异步）
  → Agent调用LLM理解意图
  → Agent结合偏好判断
  → Agent创建Issue(s)
  → 返回创建结果
```

## 七、开发优先级路线图

### Sprint 1（当前）：MVP基础框架
1. 数据库Schema设计与实现
2. 基础API路由
3. 前端布局与导航
4. Dashboard页面
5. Issue看板（Kanban视图）
6. Agent配置页面

### Sprint 2：核心交互闭环
7. Issue CRUD + 状态流转
8. Agent注册与管理
9. 指派逻辑（人→Agent）
10. 评论系统
11. Daemon服务原型

### Sprint 3：Agent执行闭环
12. 会话持久化
13. Agent执行流程
14. 实时推送
15. 监控日志页
