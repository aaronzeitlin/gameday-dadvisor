from datetime import datetime
from pydantic import BaseModel, Field
from typing import Literal


class ConnectedCalendarProvider(BaseModel):
    provider: Literal["google", "microsoft"]
    account_email: str
    token_encrypted: str
    scopes: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Preferences(BaseModel):
    team_id: str | None = None
    team_text: str | None = None
    date_start: datetime
    date_end: datetime
    party_size: int = 2
    budget_total: float = 250
    price_tier: float = 0.4
    giveaway_only: bool = False
    giveaway_keywords: list[str] = Field(default_factory=list)
    dow_prefs: list[int] = Field(default_factory=list)
    tod_prefs: list[str] = Field(default_factory=list)
    zip_code: str = "10001"
    max_miles: float = 50
    buffer_before_mins: int = 60
    buffer_after_mins: int = 90
    exclude_back_to_back_late_nights: bool = False


class Game(BaseModel):
    game_id: str
    league: str
    team: str
    opponent: str
    start_time_utc: datetime
    end_time_utc: datetime
    venue: str
    venue_zip: str
    lat: float
    lon: float
    giveaway_text: str | None = None
    ticket_url: str | None = None


class TicketSummary(BaseModel):
    game_id: str
    min_price: float
    median_price: float
    availability_count: int
    estimated_total: float
    best_value_score: float
    deep_link: str


class SearchRequest(BaseModel):
    preferences: Preferences
    plan_id: str | None = None


class SearchResult(BaseModel):
    game: Game
    ticket_summary: TicketSummary | None = None
    score: float
    why_recommended: list[str] = Field(default_factory=list)


class SearchResponse(BaseModel):
    top_three: list[SearchResult]
    ranked: list[SearchResult]
    scoring_weights: dict[str, float]


class PlanCreateRequest(BaseModel):
    name: str


class Plan(BaseModel):
    id: str
    name: str
    owner_user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    participant_user_ids: list[str] = Field(default_factory=list)


class PlanPreferences(BaseModel):
    plan_id: str
    preferences: Preferences


class PlanResponse(BaseModel):
    plan: Plan
    participants: list[dict]
    share_url: str
