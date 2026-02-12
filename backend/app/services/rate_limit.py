from datetime import datetime, timedelta, timezone


class InMemoryRateLimiter:
    def __init__(self):
        self._windows: dict[str, tuple[datetime, int]] = {}

    def hit(self, key: str, limit: int, window_seconds: int = 60) -> bool:
        now = datetime.now(timezone.utc)
        start, count = self._windows.get(key, (now, 0))
        if now - start > timedelta(seconds=window_seconds):
            self._windows[key] = (now, 1)
            return True
        if count >= limit:
            return False
        self._windows[key] = (start, count + 1)
        return True


rate_limiter = InMemoryRateLimiter()
