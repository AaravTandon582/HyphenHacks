import asyncio
from typing import List

class Orchestrator:
    def __init__(self):
        self.agents: List[BaseAgent] = []

    async def add_agent(self, agent: BaseAgent):
        self.agents.append(agent)

    async def run(self):
        await asyncio.gather(*(agent.run() for agent in self.agents))
