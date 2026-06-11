from crewai import Agent, Task, Crew, LLM
from crewai_tools import MCPServerAdapter

server_params = {
    "url": "http://127.0.0.1:8000/mcp",
    "transport": "streamable-http"
}

llm = LLM(
    model="ollama/llama3.2",
    base_url="http://localhost:11434",
)

with MCPServerAdapter(server_params) as mcp_tools:
    print("Available tools:", [tool.name for tool in mcp_tools])

    shopping_agent = Agent(
        role="Shopping Assistant",
        goal="Help users find the best product based on price, seller legitimacy, and reviews",
        backstory=(
            "You are an expert shopping assistant who carefully researches products, "
            "compares options, checks if sellers are trustworthy, and reads customer "
            "reviews before making a recommendation."
        ),
        tools=mcp_tools,
        llm=llm,
        verbose=True,
    )

    research_task = Task(
        description=(
            "A user is looking for: '{user_query}'. "
            "Search the catalog for matching products. "
            "If multiple results are found, compare them. "
            "For each candidate, check the seller's legitimacy and the product's reviews. "
            "Then recommend the best option, explaining your reasoning."
        ),
        expected_output=(
            "A clear recommendation naming one product, with justification covering "
            "price, seller trustworthiness, and review sentiment."
        ),
        agent=shopping_agent,
    )

    crew = Crew(
        agents=[shopping_agent],
        tasks=[research_task],
        verbose=True,
    )

    result = crew.kickoff(inputs={"user_query": "a good laptop"})
    print("\n=== FINAL RECOMMENDATION ===")
    print(result)