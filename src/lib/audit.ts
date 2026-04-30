import { db } from '@/lib/db';

interface CreateAuditLogParams {
  actorId: string;
  actorType: 'human' | 'agent' | 'system';
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
}

export async function createAuditLog({
  actorId,
  actorType,
  action,
  targetType,
  targetId,
  details,
}: CreateAuditLogParams) {
  try {
    return await db.auditLog.create({
      data: {
        actorId,
        actorType,
        action,
        targetType,
        targetId,
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break the main flow
    return null;
  }
}
