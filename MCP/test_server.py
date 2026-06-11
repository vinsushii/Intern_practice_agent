from fastmcp import FastMCP
mcp = FastMCP("Test")

@mcp.tool()
def ping() -> str:
    """Ping test"""
    return "pong"

if __name__ == "__main__":
    mcp.run()