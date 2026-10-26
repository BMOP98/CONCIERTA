"""CONCIERTA Auth: módulo separado sin cambiar las reglas originales."""

import logging
from app.db.database import SessionLocal
from app.models import AuditLog


def write_audit(
    action, status, user_id=None, resource=None, resource_id=None, details=None
):
    try:
        with SessionLocal() as session:
            session.add(
                AuditLog(
                    user_id=user_id,
                    action=action,
                    resource=resource,
                    resource_id=resource_id,
                    status=status,
                    details=details,
                )
            )
            session.commit()

    except Exception:
        import logging

        logging.getLogger("concierta.audit").exception(
            "No se pudo registrar la auditoría: %s", action
        )
