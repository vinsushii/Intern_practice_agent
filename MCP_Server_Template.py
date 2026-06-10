# template for specifically for searching
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp import types
import httpx
import os

BRAVE_API_KEY = os.getenv("BRAVE_API_KEY")  # or SerpAPI, Tavily, etc.

server = Server("web-search")

@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [

        types.Tool(
            name="search_web",
            description="Search the web for a query and return a list of results with titles, URLs, and snippets.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query"
                    },
                    "num_results": {
                        "type": "integer",
                        "description": "Number of results to return (default 5)",
                        "default": 5
                    }
                },
                "required": ["query"]
            }
        ),

        types.Tool(
            name="fetch_page",
            description="Fetch and extract the text content of a webpage by URL.",
            inputSchema={
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The full URL of the page to fetch"
                    }
                },
                "required": ["url"]
            }
        ),

        types.Tool(
            name="search_and_fetch",
            description="Search the web and automatically fetch the top result's content. Use when you need the full content, not just snippets.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query"
                    }
                },
                "required": ["query"]
            }
        ),

    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:

    if name == "search_web":
        query = arguments["query"]
        num_results = arguments.get("num_results", 5)

        async with httpx.AsyncClient() as http:
            resp = await http.get(
                "https://api.search.brave.com/res/v1/web/search",
                headers={"Accept": "application/json", "X-Subscription-Token": BRAVE_API_KEY},
                params={"q": query, "count": num_results}
            )
        data = resp.json()
        results = data.get("web", {}).get("results", [])

        lines = [f"Search results for: {query}\n"]
        for i, r in enumerate(results, 1):
            lines.append(f"{i}. {r['title']}")
            lines.append(f"   URL: {r['url']}")
            lines.append(f"   {r.get('description', 'No snippet available')}\n")

        return [types.TextContent(type="text", text="\n".join(lines))]


    elif name == "fetch_page":
        url = arguments["url"]

        async with httpx.AsyncClient(follow_redirects=True, timeout=10) as http:
            resp = await http.get(url, headers={"User-Agent": "Mozilla/5.0"})

        # strip HTML tags simply
        import re
        text = re.sub(r"<[^>]+>", " ", resp.text)
        text = re.sub(r"\s+", " ", text).strip()
        text = text[:5000]  # cap to avoid huge context

        return [types.TextContent(type="text", text=f"Content from {url}:\n\n{text}")]


    elif name == "search_and_fetch":
        query = arguments["query"]

        # step 1 — search
        async with httpx.AsyncClient() as http:
            resp = await http.get(
                "https://api.search.brave.com/res/v1/web/search",
                headers={"Accept": "application/json", "X-Subscription-Token": BRAVE_API_KEY},
                params={"q": query, "count": 1}
            )
        results = resp.json().get("web", {}).get("results", [])
        if not results:
            return [types.TextContent(type="text", text="No results found.")]

        top_url = results[0]["url"]

        # step 2 — fetch
        async with httpx.AsyncClient(follow_redirects=True, timeout=10) as http:
            page = await http.get(top_url, headers={"User-Agent": "Mozilla/5.0"})

        import re
        text = re.sub(r"<[^>]+>", " ", page.text)
        text = re.sub(r"\s+", " ", text).strip()[:5000]

        return [types.TextContent(type="text", text=f"Top result for '{query}':\nURL: {top_url}\n\n{text}")]

    return [types.TextContent(type="text", text=f"Unknown tool: {name}")]


async def main():
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
