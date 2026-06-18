from typing import Any

from models import OperationEvent


def serialize_event(event: OperationEvent) -> dict[str, Any]:
    return {
        "id": event.id,
        "action_type": event.action_type,
        "level": event.level,
        "status": event.status,
        "message": event.message,
        "payload": event.payload,
        "processed_rows": event.processed_rows,
        "total_rows": event.total_rows,
        "created_at": event.created_at.isoformat(),
    }
