from datetime import timedelta
from app.models.schemas import Game, TicketSummary, Preferences, SearchResult
from app.providers.calendar import BusyInterval
import math

WEIGHTS = {
    "price_value": 0.35,
    "giveaway": 0.2,
    "day_time": 0.2,
    "travel": 0.15,
    "availability": 0.1,
}


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def is_available(game: Game, busy: list[BusyInterval], pref: Preferences) -> bool:
    start = game.start_time_utc - timedelta(minutes=pref.buffer_before_mins)
    end = game.end_time_utc + timedelta(minutes=pref.buffer_after_mins)
    for interval in busy:
        if start < interval.end and end > interval.start:
            return False
    return True


def score_game(game: Game, ticket: TicketSummary, pref: Preferences, distance_miles: float) -> SearchResult:
    reasons = []
    price_score = max(0.0, min(1.0, 1 - (ticket.estimated_total / max(pref.budget_total, 1))))
    if price_score > 0.6:
        reasons.append("Fits your budget comfortably")

    giveaway_score = 0.0
    if game.giveaway_text:
        if not pref.giveaway_keywords:
            giveaway_score = 0.7
        else:
            text = game.giveaway_text.lower()
            matches = [k for k in pref.giveaway_keywords if k.lower() in text]
            giveaway_score = min(1.0, len(matches) / max(len(pref.giveaway_keywords), 1))
            if matches:
                reasons.append(f"Matches giveaway keyword(s): {', '.join(matches)}")
    elif pref.giveaway_only:
        giveaway_score = -1

    dow_score = 1.0 if (not pref.dow_prefs or game.start_time_utc.weekday() in pref.dow_prefs) else 0.3
    tod = game.start_time_utc.hour
    tod_bucket = "morning" if tod < 12 else "afternoon" if tod < 17 else "evening"
    tod_score = 1.0 if (not pref.tod_prefs or tod_bucket in pref.tod_prefs) else 0.3
    day_time_score = (dow_score + tod_score) / 2

    travel_score = max(0.0, 1 - (distance_miles / max(pref.max_miles, 1)))
    if distance_miles <= pref.max_miles:
        reasons.append("Within travel distance preference")

    score = (
        WEIGHTS["price_value"] * price_score
        + WEIGHTS["giveaway"] * max(giveaway_score, 0)
        + WEIGHTS["day_time"] * day_time_score
        + WEIGHTS["travel"] * travel_score
        + WEIGHTS["availability"] * 1
    )

    return SearchResult(game=game, ticket_summary=ticket, score=round(score, 3), why_recommended=reasons)
