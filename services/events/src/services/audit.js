import { AuditLog } from '../models/index.js';

async function writeAudit({
    action,
    userId,
    resource = 'EVENT',
    resourceId = null,
    status = 'SUCCESS',
    details = null
}) {
    try {
        await AuditLog.create({
            action,
            userId,
            resource,
            resourceId,
            status,
            details
        });
    } catch (error) {
        console.error(
            'No se pudo registrar auditoría:',
            action,
            error
        );
    }
}

export { writeAudit };
