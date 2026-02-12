from datetime import datetime, timedelta, timezone
import uuid
from app.models.schemas import Preferences, ConnectedCalendarProvider, Plan


def default_preferences() -> Preferences:
    now = datetime.now(timezone.utc)
    return Preferences(date_start=now, date_end=now + timedelta(days=90))


class InMemoryStore:
    def __init__(self):
        self.preferences_by_user: dict[str, Preferences] = {}
        self.providers_by_user: dict[str, list[ConnectedCalendarProvider]] = {}
        self.plans: dict[str, Plan] = {}
        self.plan_preferences: dict[str, Preferences] = {}
        self.audit: list[dict] = []

    def get_preferences(self, user_id: str) -> Preferences:
        if user_id not in self.preferences_by_user:
            self.preferences_by_user[user_id] = default_preferences()
        return self.preferences_by_user[user_id]

    def set_preferences(self, user_id: str, preferences: Preferences):
        self.preferences_by_user[user_id] = preferences

    def get_user_providers(self, user_id: str) -> list[ConnectedCalendarProvider]:
        return self.providers_by_user.get(user_id, [])

    def set_user_provider(self, user_id: str, provider: ConnectedCalendarProvider):
        current = [p for p in self.providers_by_user.get(user_id, []) if p.provider != provider.provider]
        self.providers_by_user[user_id] = current + [provider]

    def disconnect_user_provider(self, user_id: str, provider_name: str):
        self.providers_by_user[user_id] = [p for p in self.providers_by_user.get(user_id, []) if p.provider != provider_name]

    def create_plan(self, owner_user_id: str, name: str) -> Plan:
        plan_id = str(uuid.uuid4())
        plan = Plan(id=plan_id, name=name, owner_user_id=owner_user_id, participant_user_ids=[owner_user_id])
        self.plans[plan_id] = plan
        self.plan_preferences[plan_id] = default_preferences()
        return plan

    def join_plan(self, plan_id: str, user_id: str):
        plan = self.plans[plan_id]
        if user_id not in plan.participant_user_ids:
            plan.participant_user_ids.append(user_id)

    def get_plan(self, plan_id: str) -> Plan:
        return self.plans[plan_id]

    def log(self, event: str, payload: dict):
        self.audit.append({"event": event, "payload": payload, "ts": datetime.now(timezone.utc).isoformat()})


store = InMemoryStore()
