from typing import Any

class Event:
    def __init__(self, event_type: str, payload: Any):
        self.event_type = event_type
        self.payload = payload
