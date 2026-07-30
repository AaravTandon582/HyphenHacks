from typing import Dict, Any

class RulesEngine:
    def __init__(self, rules: List[Dict[str, Any]]):
        self.rules = rules

    async def apply_rules(self, payload: Dict[str, Any]):
        for rule in self.rules:
            if self._check_condition(rule['condition'], payload):
                await self._apply_action(rule['action'], payload)

    def _check_condition(self, condition: str, payload: Dict[str, Any]) -> bool:
        # Simplified condition checking
        return eval(condition, {'payload': payload})

    async def _apply_action(self, action: str, payload: Dict[str, Any]):
        if action == 'notify_student':
            logger.info(f"Notify student about {payload['name']}")
