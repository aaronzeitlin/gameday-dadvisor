from datetime import datetime, timedelta, timezone
from typing import Generic, TypeVar

T = TypeVar("T")


class TTLCache(Generic[T]):
    def __init__(self, ttl_seconds: int):
        self.ttl_seconds = ttl_seconds
        self._store: dict[str, tuple[datetime, T]] = {}

    def get(self, key: str) -> T | None:
        value = self._store.get(key)
        if not value:
            return None
        expiry, payload = value
        if datetime.now(timezone.utc) > expiry:
            self._store.pop(key, None)
            return None
        return payload

    def set(self, key: str, payload: T):
        expiry = datetime.now(timezone.utc) + timedelta(seconds=self.ttl_seconds)
        self._store[key] = (expiry, payload)
