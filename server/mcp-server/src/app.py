"""Shared FastMCP instance.

Held in its own module so that every importer (the server entrypoint and the
tool modules alike) resolves the *same* object. Importing it from
``server.py`` directly causes a double-import when the server is started via
``python -m src.server``: the running module is ``__main__``, tool modules'
``from ..server import mcp`` would import ``src.server`` a second time, and
tools would register on an instance that is never served (empty tool list).
"""

from fastmcp import FastMCP

mcp = FastMCP(
    name="secure-bridge",
    instructions=(
        "Secure Bridge MCP server. Tools enforce the project outbound "
        "allowlist; non-allowlisted hosts are rejected."
    ),
    mask_error_details=True,
)
