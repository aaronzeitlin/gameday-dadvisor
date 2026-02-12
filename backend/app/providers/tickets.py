import json
from pathlib import Path
from datetime import datetime
import httpx
from app.models.schemas import Game, TicketSummary


class TicketProvider:
    async def list_games(self, team: str, date_start: datetime, date_end: datetime) -> list[Game]:
        raise NotImplementedError

    async def search_tickets(self, game_id: str, party_size: int, price_bounds: tuple[float, float]) -> TicketSummary | None:
        raise NotImplementedError


class MockProvider(TicketProvider):
    def __init__(self, fixture_path: str = "app/fixtures/games.json"):
        self._data = json.loads(Path(fixture_path).read_text())

    async def list_games(self, team: str, date_start: datetime, date_end: datetime) -> list[Game]:
        games = []
        for row in self._data["games"]:
            if row["team"].lower() == team.lower():
                g = Game(**row)
                if date_start <= g.start_time_utc <= date_end:
                    games.append(g)
        return games

    async def search_tickets(self, game_id: str, party_size: int, price_bounds: tuple[float, float]) -> TicketSummary | None:
        for row in self._data["tickets"]:
            if row["game_id"] == game_id:
                t = TicketSummary(**row)
                if price_bounds[0] <= t.median_price <= price_bounds[1]:
                    return t
        return None


class SeatGeekProvider(TicketProvider):
    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret

    async def list_games(self, team: str, date_start: datetime, date_end: datetime) -> list[Game]:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                "https://api.seatgeek.com/2/events",
                params={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "q": team,
                    "datetime_utc.gte": date_start.isoformat(),
                    "datetime_utc.lte": date_end.isoformat(),
                    "per_page": 20,
                },
            )
            resp.raise_for_status()
            payload = resp.json()
        games = []
        for e in payload.get("events", []):
            games.append(
                Game(
                    game_id=str(e["id"]),
                    league=(e.get("type") or "unknown").upper(),
                    team=team,
                    opponent=(e.get("short_title") or "").replace(team, "").strip(" -vs"),
                    start_time_utc=datetime.fromisoformat(e["datetime_utc"].replace("Z", "+00:00")),
                    end_time_utc=datetime.fromisoformat(e["datetime_utc"].replace("Z", "+00:00")),
                    venue=e.get("venue", {}).get("name", "Unknown Venue"),
                    venue_zip=e.get("venue", {}).get("postal_code", "00000"),
                    lat=e.get("venue", {}).get("location", {}).get("lat", 0.0),
                    lon=e.get("venue", {}).get("location", {}).get("lon", 0.0),
                    giveaway_text=None,
                    ticket_url=e.get("url"),
                )
            )
        return games

    async def search_tickets(self, game_id: str, party_size: int, price_bounds: tuple[float, float]) -> TicketSummary | None:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                f"https://api.seatgeek.com/2/events/{game_id}",
                params={"client_id": self.client_id, "client_secret": self.client_secret},
            )
            resp.raise_for_status()
            e = resp.json()
        stats = e.get("stats", {})
        median = float(stats.get("median_price") or stats.get("lowest_price") or 0)
        if median < price_bounds[0] or median > price_bounds[1]:
            return None
        min_p = float(stats.get("lowest_price") or median)
        return TicketSummary(
            game_id=game_id,
            min_price=min_p,
            median_price=median,
            availability_count=int(stats.get("listing_count") or 0),
            estimated_total=median * party_size * 1.25,
            best_value_score=max(0.0, 100 - median),
            deep_link=e.get("url") or "",
        )
