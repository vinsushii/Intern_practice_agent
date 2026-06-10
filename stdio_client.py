# Dummy client file that can connect to the initial mcp server
from crewai import Agent, Task, Crew
from crewai_tools import MCPServerAdapter
from mcp import StdioServerParameters

import os 
import warmings
from pydantic import PydanticDeprecatedSince20

warnings.filterwarnings("ignore", category= PydanticDeprecatedSince20)

# Create a StdioServerParameters objeect
server_params=StdioServerParameters(
  command = "Python3",
  args= ["MCP_Server_Template.py"],
  env= {"UV_PYTHON", "3.12", **os.environ},
)

with MCPServerAdapter(server_params) as tools:
  agent = Agent(
    role=,
    goal=,
    backstory=,
    tools=, 
    verbose = True,
  )

task = Task(
  description= "",
  expected_outpit="".
  verbose=agennt,
)

crew=Crew(
  agents = [agent],
  tasks = [task],
  verbose = True,
)

result= crew.kickoff((inputs={"problems": 
print(result)
