import asyncio
from app.models.base import BaseAgent
from app.core.event_bus import EventBus
from app.agents.school_agent import SchoolAgent
from app.orchestrator.orchestrator import Orchestrator
from app.rules.engine import RulesEngine
from app.rules.rules import rules

async def main():
    event_bus = EventBus()
    orchestrator = Orchestrator()

    school_agent = SchoolAgent(event_bus)
    await orchestrator.add_agent(school_agent)

    rules_engine = RulesEngine(rules)
    await orchestrator.add_agent(rules_engine)

    await orchestrator.run()

if __name__ == '__main__':
    asyncio.run(main())
