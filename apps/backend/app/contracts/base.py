"""Base model for all Cogniva data contracts.

Contract conventions (Architecture Document §6):
- Field names use camelCase on the JSON wire.
- Timestamps use ISO-8601 (UTC).
- Fields marked with `?` in the document are optional.

Internally we use snake_case in Python and alias to camelCase for JSON
(de)serialization, so the wire contract matches the document exactly while
the Python code stays idiomatic.
"""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base: serialize to camelCase, accept both camelCase and snake_case."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        use_enum_values=True,
        # Validate on assignment so a session status mutated by the state
        # machine is stored as its string value (e.g. "TEACHING") rather than
        # an enum object — keeping serialization consistent across REST and WS.
        validate_assignment=True,
    )


def utc_now_iso() -> str:
    """Current time as an ISO-8601 UTC string (time contract, §6)."""
    return datetime.now(timezone.utc).isoformat()
