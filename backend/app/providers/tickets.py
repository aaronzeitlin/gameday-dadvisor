import json
import re
from pathlib import Path
from datetime import datetime, timezone
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


class ESPNProvider(TicketProvider):
    LEAGUES = {
        "MLB": ("baseball", "mlb"),
        "NFL": ("football", "nfl"),
        "NBA": ("basketball", "nba"),
        "NHL": ("hockey", "nhl"),
    }

    TEAM_LEAGUE = {
        "Seattle Mariners": "MLB",
        "New York Yankees": "MLB",
        "Los Angeles Dodgers": "MLB",
        "Chicago Cubs": "MLB",
        "Houston Astros": "MLB",
        "Seattle Seahawks": "NFL",
        "San Francisco 49ers": "NFL",
        "Dallas Cowboys": "NFL",
        "Kansas City Chiefs": "NFL",
        "Philadelphia Eagles": "NFL",
        "Los Angeles Lakers": "NBA",
        "Boston Celtics": "NBA",
        "Golden State Warriors": "NBA",
        "Miami Heat": "NBA",
        "New York Knicks": "NBA",
        "Seattle Kraken": "NHL",
        "Vegas Golden Knights": "NHL",
        "New York Rangers": "NHL",
        "Colorado Avalanche": "NHL",
        "Toronto Maple Leafs": "NHL",
    }

    def __init__(self):
        self._ticket_cache: dict[str, TicketSummary] = {}

    @staticmethod
    def _ticket_from_summary(game_id: str, summary: str, link: str, party_size: int) -> TicketSummary | None:
        if not summary:
            return None
        match = re.search(r"\$([0-9]+(?:\.[0-9]{1,2})?)", summary)
        if not match:
            return None
        min_price = float(match.group(1))
        median = round(min_price * 1.35, 2)
        return TicketSummary(
            game_id=game_id,
            min_price=min_price,
            median_price=median,
            availability_count=1,
            estimated_total=median * party_size * 1.25,
            best_value_score=max(0.0, 100 - median),
            deep_link=link,
        )

    async def list_games(self, team: str, date_start: datetime, date_end: datetime) -> list[Game]:
        league = self.TEAM_LEAGUE.get(team)
        if not league:
            return []

        sport_slug, league_slug = self.LEAGUES[league]
        dates = f"{date_start.strftime('%Y%m%d')}-{date_end.strftime('%Y%m%d')}"
        url = f"https://site.api.espn.com/apis/site/v2/sports/{sport_slug}/{league_slug}/scoreboard"

        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get(url, params={"dates": dates, "limit": 1000})
                resp.raise_for_status()
                payload = resp.json()
        except Exception:
            return []

        games: list[Game] = []
        for event in payload.get("events", []):
            competitions = event.get("competitions") or []
            if not competitions:
                continue
            comp = competitions[0]
            competitors = comp.get("competitors") or []
            team_comp = None
            opp_comp = None
            for c in competitors:
                name = (c.get("team") or {}).get("displayName")
                if name == team:
                    team_comp = c
                else:
                    opp_comp = c
            if not team_comp or not opp_comp:
                continue

            start = datetime.fromisoformat(event["date"].replace("Z", "+00:00")).astimezone(timezone.utc)
            if not (date_start <= start <= date_end):
                continue

            venue = (comp.get("venue") or {}).get("fullName") or "Unknown Venue"
            address = (comp.get("venue") or {}).get("address") or {}
            lat = float(address.get("latitude") or 0.0)
            lon = float(address.get("longitude") or 0.0)
            game_id = f"espn-{event.get('id')}"

            tickets = comp.get("tickets") or []
            if tickets:
                ticket_summary = tickets[0].get("summary", "")
                ticket_link = tickets[0].get("links", [{}])[0].get("href", "")
                prebuilt = self._ticket_from_summary(game_id, ticket_summary, ticket_link, 2)
                if prebuilt:
                    self._ticket_cache[game_id] = prebuilt

            games.append(
                Game(
                    game_id=game_id,
                    league=league,
                    team=team,
                    opponent=(opp_comp.get("team") or {}).get("displayName") or "Unknown Opponent",
                    start_time_utc=start,
                    end_time_utc=start,
                    venue=venue,
                    venue_zip=str(address.get("zipCode") or "00000"),
                    lat=lat,
                    lon=lon,
                    giveaway_text=None,
                    ticket_url=(event.get("links") or [{}])[0].get("href"),
                )
            )
        return games

    async def search_tickets(self, game_id: str, party_size: int, price_bounds: tuple[float, float]) -> TicketSummary | None:
        ticket = self._ticket_cache.get(game_id)
        if not ticket:
            return None
        adjusted = ticket.model_copy(
            update={
                "estimated_total": ticket.median_price * party_size * 1.25,
            }
        )
        if price_bounds[0] <= adjusted.median_price <= price_bounds[1]:
            return adjusted
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
