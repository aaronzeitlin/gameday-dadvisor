from dataclasses import dataclass
from datetime import datetime
import json
from pathlib import Path


@dataclass
class BusyInterval:
    start: datetime
    end: datetime


class CalendarProvider:
    provider_name: str

    async def get_freebusy(self, time_min: datetime, time_max: datetime, calendars: list[str]) -> list[BusyInterval]:
        raise NotImplementedError


class MockCalendarProvider(CalendarProvider):
    provider_name = "mock"

    def __init__(self, fixture_path: str = "app/fixtures/freebusy.json"):
        self.fixture_path = fixture_path
        self._data = json.loads(Path(fixture_path).read_text()) if Path(fixture_path).exists() else {"accounts": {}}

    async def get_freebusy(self, time_min: datetime, time_max: datetime, calendars: list[str]) -> list[BusyInterval]:
        intervals: list[BusyInterval] = []
        for account in calendars:
            for item in self._data.get("accounts", {}).get(account, []):
                start = datetime.fromisoformat(item["start"])
                end = datetime.fromisoformat(item["end"])
                if start < time_max and end > time_min:
                    intervals.append(BusyInterval(start=max(start, time_min), end=min(end, time_max)))
        return intervals
