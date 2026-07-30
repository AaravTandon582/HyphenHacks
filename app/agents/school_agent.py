import asyncio
from typing import List, Dict

from app.models.base import BaseAgent
from app.core.event_bus import EventBus
from app.core.logging import logger

class SchoolAgent(BaseAgent):
    def __init__(self, event_bus: EventBus):
        self.event_bus = event_bus

    async def run(self):
        while True:
            # Simulate some school-related tasks
            await asyncio.sleep(1)
            logger.info("School agent is running")
