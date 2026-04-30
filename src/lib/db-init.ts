import { db } from '@/lib/db'

/**
 * Initialize the database for serverless environments (Vercel).
 * On Vercel, the /tmp directory is writable, so we create the SQLite
 * database there. This function ensures the schema exists and seeds
 * demo data on first access.
 */
let initPromise: Promise<void> | null = null

export async function ensureDbReady(): Promise<void> {
  if (!initPromise) {
    initPromise = initializeDb()
  }
  return initPromise
}

async function initializeDb(): Promise<void> {
  try {
    // Check if database already has data
    const memberCount = await db.member.count()

    if (memberCount === 0) {
      console.log('[db-init] Empty database detected, seeding demo data...')
      // Trigger seed endpoint internally
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      try {
        await fetch(`${baseUrl}/api/seed`, { method: 'POST' })
        console.log('[db-init] Demo data seeded successfully')
      } catch (seedError) {
        console.error('[db-init] Failed to seed data:', seedError)
        // Try direct seeding as fallback
        await directSeed()
      }
    } else {
      console.log('[db-init] Database already initialized with', memberCount, 'members')
    }
  } catch (error) {
    console.error('[db-init] Database initialization error:', error)
    // Try direct seeding as fallback
    await directSeed()
  }
}

async function directSeed(): Promise<void> {
  try {
    // Ensure human user exists
    let human = await db.member.findFirst({ where: { type: 'human' } })
    if (!human) {
      human = await db.member.create({
        data: { type: 'human', name: '用户', role: 'admin' },
      })
    }

    // Ensure default agents exist
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

    for (const def of agentDefs) {
      const existing = await db.member.findFirst({ where: { type: 'agent', name: def.name } })
      if (!existing) {
        await db.member.create({ data: { type: 'agent', ...def } })
      }
    }

    console.log('[db-init] Direct seed completed')
  } catch (error) {
    console.error('[db-init] Direct seed failed:', error)
  }
}
