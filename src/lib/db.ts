import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// For Vercel/serverless: use /tmp for SQLite (writable at runtime)
function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }
  // Default for local development
  return 'file:./db/custom.db'
}

const databaseUrl = getDatabaseUrl()

// Set the env variable so Prisma picks it up
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = databaseUrl
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/**
 * Initialize the database schema for serverless environments.
 * On Vercel, the /tmp directory is writable but empty on each cold start.
 * This function runs `prisma db push` to create the schema, then seeds demo data.
 */
let dbInitialized = false
let initPromise: Promise<void> | null = null

export async function ensureDbInitialized(): Promise<void> {
  if (dbInitialized) return
  if (!initPromise) {
    initPromise = initializeDb()
  }
  return initPromise
}

async function initializeDb(): Promise<void> {
  try {
    // Check if database already has data
    const memberCount = await db.member.count()
    if (memberCount > 0) {
      console.log('[db-init] Database already initialized with', memberCount, 'members')
      dbInitialized = true
      return
    }
  } catch {
    // Database doesn't exist or schema not applied
    console.log('[db-init] Database not accessible, running schema push...')
  }

  try {
    // Run prisma db push to create the schema
    // This is necessary on Vercel where /tmp is empty on cold start
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')
    console.log('[db-init] Running prisma db push with schema at', schemaPath)

    execSync('npx prisma db push --skip-generate --accept-data-loss 2>&1', {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
      timeout: 30000,
    })

    console.log('[db-init] Schema pushed successfully')

    // Seed demo data
    await seedDemoData()

    dbInitialized = true
  } catch (error) {
    console.error('[db-init] Failed to initialize database:', error)
    // Try direct seeding as fallback (schema might already exist)
    try {
      await seedDemoData()
      dbInitialized = true
    } catch (seedError) {
      console.error('[db-init] Direct seed also failed:', seedError)
    }
  }
}

async function seedDemoData(): Promise<void> {
  // Check if data already exists
  const memberCount = await db.member.count()
  if (memberCount > 0) {
    console.log('[db-init] Data already exists, skipping seed')
    return
  }

  // Create human user
  const human = await db.member.create({
    data: { type: 'human', name: '用户', role: 'admin' },
  })

  // Create 3 default agents
  const agentDefs = [
    {
      name: 'CodeAgent',
      description: '专注于代码生成和功能开发的AI Agent',
      capabilities: JSON.stringify(['code-gen', 'debug', 'refactor']),
      agentGroup: 'development',
      agentStatus: 'online',
      systemPrompt: '你是一个专业的代码开发Agent，擅长编写高质量代码、修复Bug和重构代码。',
    },
    {
      name: 'ReviewBot',
      description: '专注于代码审查和质量保证的AI Agent',
      capabilities: JSON.stringify(['review', 'testing', 'quality']),
      agentGroup: 'quality',
      agentStatus: 'busy',
      systemPrompt: '你是一个专业的代码审查Agent，擅长发现代码问题、提出改进建议和确保代码质量。',
    },
    {
      name: 'DocAgent',
      description: '专注于文档生成和知识管理的AI Agent',
      capabilities: JSON.stringify(['doc', 'analysis', 'summary']),
      agentGroup: 'documentation',
      agentStatus: 'offline',
      systemPrompt: '你是一个专业的文档Agent，擅长编写技术文档、生成API文档和知识整理。',
    },
  ]

  const agents: Record<string, string> = {}
  for (const def of agentDefs) {
    const agent = await db.member.create({
      data: { type: 'agent', ...def },
    })
    agents[def.name] = agent.id
  }

  // Create 5 default skills
  const skillDefs = [
    {
      name: 'Bug修复',
      description: '识别和修复代码中的Bug',
      promptTemplate: '分析以下Bug描述，定位问题根因并提供修复方案：\n{{bug_description}}',
      scene: 'code-gen',
      isBuiltIn: true,
    },
    {
      name: '功能开发',
      description: '根据需求描述开发新功能',
      promptTemplate: '根据以下需求开发新功能：\n{{feature_requirement}}',
      scene: 'code-gen',
      isBuiltIn: true,
    },
    {
      name: '代码审查',
      description: '审查代码质量和安全性',
      promptTemplate: '审查以下代码变更：\n{{code_diff}}',
      scene: 'review',
      isBuiltIn: true,
    },
    {
      name: '文档生成',
      description: '根据代码和需求自动生成技术文档',
      promptTemplate: '为以下代码/功能生成文档：\n{{code_or_feature}}',
      scene: 'doc',
      isBuiltIn: true,
    },
    {
      name: '数据分析',
      description: '分析数据趋势、生成报告',
      promptTemplate: '分析以下数据：\n{{data}}',
      scene: 'analysis',
      isBuiltIn: true,
    },
  ]

  for (const def of skillDefs) {
    await db.skill.create({ data: def })
  }

  // Create 3 demo issues
  const issueDefs = [
    {
      title: '实现用户登录功能',
      description: '实现基于JWT的用户登录系统',
      status: 'in_progress',
      priority: 'high',
      scene: 'code-gen',
      labels: JSON.stringify(['backend', 'auth', 'api']),
      creatorId: agents['CodeAgent'],
      assigneeId: agents['CodeAgent'],
    },
    {
      title: '优化首页加载性能',
      description: '分析并优化首页加载性能',
      status: 'open',
      priority: 'medium',
      scene: 'analysis',
      labels: JSON.stringify(['performance', 'frontend']),
      creatorId: human.id,
      assigneeId: null,
    },
    {
      title: '编写API文档',
      description: '为所有REST API端点编写完整的API文档',
      status: 'in_review',
      priority: 'low',
      scene: 'doc',
      labels: JSON.stringify(['documentation', 'api']),
      creatorId: agents['DocAgent'],
      assigneeId: agents['DocAgent'],
    },
  ]

  for (const def of issueDefs) {
    const issue = await db.issue.create({ data: def })

    // Add demo comments
    if (def.status === 'in_progress') {
      await db.comment.create({
        data: {
          content: '已开始分析需求，预计需要实现4个核心模块。',
          authorId: agents['CodeAgent'],
          issueId: issue.id,
          authorType: 'agent',
        },
      })
    }
    if (def.status === 'in_review') {
      await db.comment.create({
        data: {
          content: 'API文档初稿已完成，涵盖了所有公开端点。',
          authorId: agents['DocAgent'],
          issueId: issue.id,
          authorType: 'agent',
        },
      })
    }
  }

  // Create demo inspiration
  await db.inspiration.create({
    data: {
      content: '我想做一个AI协作平台',
      source: 'chat',
      status: 'converted',
      creatorId: human.id,
      analysisResult: JSON.stringify({
        agentId: agents['CodeAgent'],
        issuesCreated: 1,
        summary: '用户希望构建一个AI驱动的团队协作平台',
      }),
      analyzedAt: new Date(),
    },
  })

  console.log('[db-init] Demo data seeded successfully')
}
