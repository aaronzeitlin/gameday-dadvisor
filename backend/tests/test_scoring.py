from datetime import datetime, timezone
from app.models.schemas import Game, TicketSummary, Preferences
from app.services.scoring import score_game


def test_score_game_budget_reason():
    game = Game(game_id="1", league="MLB", team="Yankees", opponent="Red Sox", start_time_utc=datetime.now(timezone.utc), end_time_utc=datetime.now(timezone.utc), venue="x", venue_zip="1", lat=1, lon=1, giveaway_text="bobblehead")
    ticket = TicketSummary(game_id="1", min_price=30, median_price=50, availability_count=100, estimated_total=120, best_value_score=0.8, deep_link="x")
    pref = Preferences(date_start=datetime.now(timezone.utc), date_end=datetime.now(timezone.utc), budget_total=300)
    result = score_game(game, ticket, pref, 5)
    assert result.score > 0.5
    assert any("budget" in r.lower() for r in result.why_recommended)
