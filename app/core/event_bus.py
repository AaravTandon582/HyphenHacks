import asyncio
from collections import defaultdict
from typing import Dict, List, Callable

class EventBus:
    def __init__(self):
        self.listeners: Dict[str, List[Callable]] = defaultdict(list)

    async def publish(self, event_type: str, payload: Any):
        for listener in self.listeners.get(event_type, []):
            await listener(payload)

    def subscribe(self, event_type: str, listener: Callable):
        self.listeners[event_type].append(listener)
