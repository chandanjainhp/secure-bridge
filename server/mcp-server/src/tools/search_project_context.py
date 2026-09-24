"""search_project_context tool — call back into the existing Express API.

This intentionally does NOT open a second MongoDB connection. The Express
backend is the single source of truth for project data; calling its REST API
keeps authorization, validation, and caching in one place.

The Express endpoint shape is a [VERIFY] item. The implementation below
assumes a reasonable convention (``/api/v1/projects/:id/context?q=...``) and
is isolated behind :func:`search_project_context` so it can be re-pointed once
the real route is confirmed.
User scoping: the Express backend signs the chatting user's id with the
shared ``MCP_SERVICE_TOKEN`` (``__user_id`` + ``__user_sig`` arguments) when
the LLM invokes this tool. Express verifies the HMAC-SHA256 signature and
scopes the query to that exact user — the tool itself holds no credentials.
"""

from __future__ import annotations

import logging
from typing import Annotated
from urllib.parse import quote

import httpx
from fastmcp.exceptions import ToolError

from .. import config
from ..allowlist import get_allowlist
from ..app import mcp

log = logging.getLogger("mcp.tools.search_project_context")


async def search_project_context(
    project_id: Annotated[str, "The project identifier (path segment)."],
    query: Annotated[str, "Natural-language query to match against project context."],
    __user_id: Annotated[str | None, "Internal: signed user identity, injected by the backend."] = None,
    __user_sig: Annotated[str | None, "Internal: HMAC-SHA256 of __user_id with MCP_SERVICE_TOKEN."] = None,
) -> list[str]:
    """Return relevant conversation history / project settings from the backend.

    Calls the Express API (single source of truth) rather than querying
    MongoDB directly. The Express host must be on ``OUTBOUND_ALLOWLIST``.
    """
    if not isinstance(project_id, str) or not project_id.strip():
        raise ToolError("project_id must be a non-empty string.")
    if not isinstance(query, str) or not query.strip():
        raise ToolError("query must be a non-empty string.")
    if "/" in project_id or ".." in project_id:
        raise ToolError("project_id contains invalid characters.")

    settings = config.get_settings()
    allowlist = get_allowlist()

    # Build the callback URL against the Express base URL, then enforce the
    # allowlist on its host (the Express host must be allowlisted explicitly).
    express_host = httpx.URL(settings.express_api_base_url).host
    allowlist.assert_host_allowed(express_host, tool="search_project_context")

    url = (
        f"{settings.express_api_base_url}/api/v1/projects/"
        f"{quote(project_id, safe='')}/context"
    )
    params = {"q": query}
    headers = {}
    if __user_id and __user_sig:
        headers["X-Service-User"] = __user_id
        headers["X-Service-Signature"] = __user_sig

    try:
        async with httpx.AsyncClient(
            timeout=settings.outbound_timeout_seconds,
            follow_redirects=False,
        ) as client:
            response = await client.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
    except ToolError:
        raise
    except httpx.HTTPStatusError as exc:
        raise ToolError(
            f"Express API returned HTTP {exc.response.status_code}."
        ) from exc
    except httpx.RequestError as exc:
        raise ToolError(f"Network error contacting Express API: {type(exc).__name__}.") from exc
    except ValueError as exc:
        raise ToolError("Express API returned non-JSON content.") from exc
    except Exception as exc:
        log.warning("search_project_context unexpected error: %s", type(exc).__name__)
        raise ToolError("An unexpected error occurred while querying project context.") from exc

    # The Express ApiResponse envelope is { success, statusCode, message, data };
    # unwrap `data` and normalize into a list[str] regardless of exact shape.
    if isinstance(data, dict) and isinstance(data.get("data"), dict):
        data = data["data"]
    if isinstance(data, list):
        return [str(item) for item in data]
    if isinstance(data, dict):
        # Common shapes: {"results": [...]} or {"context": [...]}
        for key in ("results", "context", "items", "messages"):
            if isinstance(data.get(key), list):
                return [str(item) for item in data[key]]
        return [str(data)]
    return [str(data)]


# Register as an MCP tool.
search_project_context_tool = mcp.tool(
    name="search_project_context",
    description=(
        "Search a project's conversation history / settings via the Express "
        "API (single source of truth). The Express host must be allowlisted."
    ),
)(search_project_context)
