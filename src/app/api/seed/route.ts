import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { broadcastEvent } from '@/lib/events';

// POST /api/seed - Initialize demo data
export async function POST() {
  try {
    const results = {
      agents: [] as string[],
      skills: [] as string[],
      issues: [] as string[],
      comments: [] as string[],
      inspirations: [] as string[],
    };

    // 1. Ensure a human user exists (for creatorId)
    let human = await db.member.findFirst({ where: { type: 'human' } });
    if (!human) {
      human = await db.member.create({
        data: {
          type: 'human',
          name: '用户',
          role: 'admin',
        },
      });
    }

    // 2. Create 3 default agents if they don't exist
    const agentDefs = [
      {
        name: 'CodeAgent',
        description: '专注于代码生成和功能开发的AI Agent',
        capabilities: ['code-gen', 'debug', 'refactor'],
        agentGroup: 'development',
        agentStatus: 'online',
        systemPrompt: '你是一个专业的代码开发Agent，擅长编写高质量代码、修复Bug和重构代码。',
      },
      {
        name: 'ReviewBot',
        description: '专注于代码审查和质量保证的AI Agent',
        capabilities: ['review', 'testing', 'quality'],
        agentGroup: 'quality',
        agentStatus: 'busy',
        systemPrompt: '你是一个专业的代码审查Agent，擅长发现代码问题、提出改进建议和确保代码质量。',
      },
      {
        name: 'DocAgent',
        description: '专注于文档生成和知识管理的AI Agent',
        capabilities: ['doc', 'analysis', 'summary'],
        agentGroup: 'documentation',
        agentStatus: 'offline',
        systemPrompt: '你是一个专业的文档Agent，擅长编写技术文档、生成API文档和知识整理。',
      },
    ];

    const agents: Record<string, typeof human> = {};
    for (const def of agentDefs) {
      const existing = await db.member.findFirst({
        where: { type: 'agent', name: def.name },
      });
      if (!existing) {
        const agent = await db.member.create({
          data: {
            type: 'agent',
            name: def.name,
            description: def.description,
            capabilities: JSON.stringify(def.capabilities),
            agentGroup: def.agentGroup,
            agentStatus: def.agentStatus,
            systemPrompt: def.systemPrompt,
          },
        });
        agents[def.name] = agent;
        results.agents.push(agent.id);
      } else {
        agents[def.name] = existing;
      }
    }

    // 3. Create 5 default skills if they don't exist
    const skillDefs = [
      {
        name: 'Bug修复',
        description: '识别和修复代码中的Bug，包括调试、定位问题和提供修复方案',
        promptTemplate: '分析以下Bug描述，定位问题根因并提供修复方案：\n{{bug_description}}\n\n请给出：1. 问题分析 2. 修复代码 3. 测试建议',
        scene: 'code-gen',
        isBuiltIn: true,
      },
      {
        name: '功能开发',
        description: '根据需求描述开发新功能，包括设计、编码和测试',
        promptTemplate: '根据以下需求开发新功能：\n{{feature_requirement}}\n\n请给出：1. 技术方案 2. 实现代码 3. 单元测试',
        scene: 'code-gen',
        isBuiltIn: true,
      },
      {
        name: '代码审查',
        description: '审查代码质量、安全性和最佳实践，提供改进建议',
        promptTemplate: '审查以下代码变更：\n{{code_diff}}\n\n请检查：1. 代码质量 2. 安全问题 3. 性能优化 4. 最佳实践',
        scene: 'review',
        isBuiltIn: true,
      },
      {
        name: '文档生成',
        description: '根据代码和需求自动生成技术文档和API文档',
        promptTemplate: '为以下代码/功能生成文档：\n{{code_or_feature}}\n\n请生成：1. API文档 2. 使用示例 3. 注意事项',
        scene: 'doc',
        isBuiltIn: true,
      },
      {
        name: '数据分析',
        description: '分析数据趋势、生成报告和可视化建议',
        promptTemplate: '分析以下数据：\n{{data}}\n\n请给出：1. 数据概览 2. 趋势分析 3. 关键发现 4. 建议',
        scene: 'analysis',
        isBuiltIn: true,
      },
    ];

    for (const def of skillDefs) {
      const existing = await db.skill.findFirst({
        where: { name: def.name },
      });
      if (!existing) {
        const skill = await db.skill.create({
          data: {
            name: def.name,
            description: def.description,
            promptTemplate: def.promptTemplate,
            scene: def.scene,
            isBuiltIn: def.isBuiltIn,
          },
        });
        results.skills.push(skill.id);
      }
    }

    // 4. Create 3 demo issues in different statuses
    const issueDefs = [
      {
        title: '实现用户登录功能',
        description: '实现基于JWT的用户登录系统，包括：\n- 登录/注册API\n- Token刷新机制\n- 密码加密存储\n- 登录状态管理',
        status: 'in_progress',
        priority: 'high',
        scene: 'code-gen',
        labels: ['backend', 'auth', 'api'],
        assigneeName: 'CodeAgent',
      },
      {
        title: '优化首页加载性能',
        description: '分析并优化首页加载性能，包括：\n- 代码分割和懒加载\n- 图片优化\n- 缓存策略\n- 首屏渲染优化',
        status: 'open',
        priority: 'medium',
        scene: 'analysis',
        labels: ['performance', 'frontend'],
        assigneeName: null,
      },
      {
        title: '编写API文档',
        description: '为所有REST API端点编写完整的API文档，包括：\n- 接口说明\n- 请求/响应示例\n- 错误码说明\n- 认证方式',
        status: 'in_review',
        priority: 'low',
        scene: 'doc',
        labels: ['documentation', 'api'],
        assigneeName: 'DocAgent',
      },
    ];

    for (const def of issueDefs) {
      // Check if issue with this title already exists
      const existing = await db.issue.findFirst({
        where: { title: def.title },
      });
      if (!existing) {
        const assigneeId = def.assigneeName && agents[def.assigneeName]
          ? agents[def.assigneeName].id
          : null;

        const issue = await db.issue.create({
          data: {
            title: def.title,
            description: def.description,
            status: def.status,
            priority: def.priority,
            scene: def.scene,
            labels: JSON.stringify(def.labels),
            creatorId: assigneeId || human.id,
            assigneeId,
            resolvedAt: null,
          },
        });
        results.issues.push(issue.id);

        // 5. Create demo comments on issues
        if (def.status === 'in_progress' && def.assigneeName === 'CodeAgent') {
          const codeAgent = agents['CodeAgent'];
          if (codeAgent) {
            const comment1 = await db.comment.create({
              data: {
                content: '已开始分析需求，预计需要实现4个核心模块。我会先从登录API开始，然后逐步完成其他部分。',
                authorId: codeAgent.id,
                issueId: issue.id,
                authorType: 'agent',
              },
            });
            results.comments.push(comment1.id);

            const comment2 = await db.comment.create({
              data: {
                content: '登录API已完成，现在正在实现Token刷新机制。密码加密使用bcrypt，安全性没问题。',
                authorId: codeAgent.id,
                issueId: issue.id,
                authorType: 'agent',
              },
            });
            results.comments.push(comment2.id);
          }
        }

        if (def.status === 'in_review' && def.assigneeName === 'DocAgent') {
          const docAgent = agents['DocAgent'];
          if (docAgent) {
            const comment3 = await db.comment.create({
              data: {
                content: 'API文档初稿已完成，涵盖了所有公开端点。请审阅后告诉我是否需要补充。',
                authorId: docAgent.id,
                issueId: issue.id,
                authorType: 'agent',
              },
            });
            results.comments.push(comment3.id);
          }
        }

        // Human comment on the open issue
        if (def.status === 'open') {
          const comment4 = await db.comment.create({
            data: {
              content: '首页LCP指标偏高，建议优先处理图片优化和代码分割。',
              authorId: human.id,
              issueId: issue.id,
              authorType: 'human',
            },
          });
          results.comments.push(comment4.id);
        }
      }
    }

    // 6. Create a demo inspiration that's already "converted"
    const existingInsp = await db.inspiration.findFirst({
      where: { content: '我想做一个AI协作平台' },
    });
    if (!existingInsp) {
      const inspiration = await db.inspiration.create({
        data: {
          content: '我想做一个AI协作平台',
          source: 'chat',
          status: 'converted',
          creatorId: human.id,
          analysisResult: JSON.stringify({
            agentId: agents['CodeAgent']?.id,
            issuesCreated: 1,
            analyzedAt: new Date().toISOString(),
            summary: '用户希望构建一个AI驱动的团队协作平台，可以将想法转化为可执行的任务。',
          }),
          analyzedAt: new Date(),
        },
      });
      results.inspirations.push(inspiration.id);
    }

    // Broadcast events for the newly created data (fire-and-forget)
    if (results.agents.length > 0) {
      broadcastEvent('agent:status', { count: results.agents.length, action: 'seeded' });
    }
    if (results.issues.length > 0) {
      broadcastEvent('issue:created', { count: results.issues.length, action: 'seeded' });
    }

    return NextResponse.json({
      message: 'Seed data initialized successfully',
      created: {
        agents: results.agents.length,
        skills: results.skills.length,
        issues: results.issues.length,
        comments: results.comments.length,
        inspirations: results.inspirations.length,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to seed data:', error);
    return NextResponse.json(
      { error: 'Failed to seed data' },
      { status: 500 }
    );
  }
}
