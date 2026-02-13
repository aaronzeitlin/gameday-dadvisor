from fastapi import APIRouter, HTTPException, Header
from app.models.schemas import (
    SearchRequest,
    SearchResponse,
    ConnectedCalendarProvider,
    PlanCreateRequest,
    PlanResponse,
)
from app.services.store import store
from app.services.scoring import is_available, score_game, WEIGHTS
from app.providers.calendar import MockCalendarProvider
from app.providers.tickets import ESPNProvider, SeatGeekProvider
from app.core.config import settings
from app.services.security import TokenCipher
from app.services.cache import TTLCache
from app.services.rate_limit import rate_limiter

router = APIRouter()


games_cache = TTLCache(ttl_seconds=settings.games_cache_ttl_seconds)
tickets_cache = TTLCache(ttl_seconds=settings.tickets_cache_ttl_seconds)


def current_user_id(x_user_id: str | None) -> str:
    return x_user_id or "demo-user"


def get_ticket_provider():
    if settings.seargeek_client_id and settings.seargeek_client_secret:
        return SeatGeekProvider(settings.seargeek_client_id, settings.seargeek_client_secret)
    return ESPNProvider()


@router.post("/auth/{provider}/start")
async def auth_start(provider: str):
    if provider not in {"google", "microsoft"}:
        raise HTTPException(status_code=404, detail="unknown provider")
    return {"auth_url": f"/auth/{provider}/callback?code=mock-code"}


@router.post("/auth/{provider}/callback")
async def auth_callback(
    provider: str,
    account_email: str = "demo@example.com",
    x_user_id: str | None = Header(default=None),
):
    user_id = current_user_id(x_user_id)
    if not settings.fernet_key:
        raise HTTPException(status_code=500, detail="FERNET_KEY required")
    cipher = TokenCipher(settings.fernet_key)
    token = cipher.encrypt(f"{provider}-refresh-token")
    cp = ConnectedCalendarProvider(provider=provider, account_email=account_email, token_encrypted=token, scopes=["freebusy.read"])
    store.set_user_provider(user_id, cp)
    store.log("provider_connected", {"provider": provider, "email": account_email, "user_id": user_id})
    return {"status": "connected", "provider": provider, "user_id": user_id, "account_email": account_email}


@router.post("/disconnect/{provider}")
async def disconnect(provider: str, x_user_id: str | None = Header(default=None)):
    user_id = current_user_id(x_user_id)
    store.disconnect_user_provider(user_id, provider)
    store.log("provider_disconnected", {"provider": provider, "user_id": user_id})
    return {"status": "disconnected", "provider": provider}


@router.get("/me")
async def me(x_user_id: str | None = Header(default=None)):
    user_id = current_user_id(x_user_id)
    return {
        "user_id": user_id,
        "connected_accounts": [p.model_dump(exclude={"token_encrypted"}) for p in store.get_user_providers(user_id)],
    }


@router.get("/preferences")
async def get_preferences(x_user_id: str | None = Header(default=None)):
    user_id = current_user_id(x_user_id)
    return store.get_preferences(user_id)


@router.put("/preferences")
async def put_preferences(payload: SearchRequest, x_user_id: str | None = Header(default=None)):
    user_id = current_user_id(x_user_id)
    store.set_preferences(user_id, payload.preferences)
    return payload.preferences


@router.post("/plans", response_model=PlanResponse)
async def create_plan(payload: PlanCreateRequest, x_user_id: str | None = Header(default=None)):
    user_id = current_user_id(x_user_id)
    plan = store.create_plan(owner_user_id=user_id, name=payload.name)
    store.log("plan_created", {"plan_id": plan.id, "owner": user_id})
    return PlanResponse(
        plan=plan,
        participants=[{"user_id": user_id, "connected_accounts": len(store.get_user_providers(user_id))}],
        share_url=f"/plan?joinPlan={plan.id}",
    )


@router.post("/plans/{plan_id}/join", response_model=PlanResponse)
async def join_plan(plan_id: str, x_user_id: str | None = Header(default=None)):
    user_id = current_user_id(x_user_id)
    if plan_id not in store.plans:
        raise HTTPException(status_code=404, detail="plan not found")
    store.join_plan(plan_id, user_id)
    plan = store.get_plan(plan_id)
    store.log("plan_joined", {"plan_id": plan_id, "user_id": user_id})
    participants = [
        {"user_id": pid, "connected_accounts": len(store.get_user_providers(pid))}
        for pid in plan.participant_user_ids
    ]
    return PlanResponse(plan=plan, participants=participants, share_url=f"/plan?joinPlan={plan.id}")


@router.get("/plans/{plan_id}", response_model=PlanResponse)
async def get_plan(plan_id: str):
    if plan_id not in store.plans:
        raise HTTPException(status_code=404, detail="plan not found")
    plan = store.get_plan(plan_id)
    participants = [
        {"user_id": pid, "connected_accounts": len(store.get_user_providers(pid))}
        for pid in plan.participant_user_ids
    ]
    return PlanResponse(plan=plan, participants=participants, share_url=f"/plan?joinPlan={plan.id}")


@router.get("/plans/{plan_id}/readiness")
async def plan_readiness(plan_id: str):
    if plan_id not in store.plans:
        raise HTTPException(status_code=404, detail="plan not found")
    plan = store.get_plan(plan_id)
    participants = []
    all_ready = True
    for pid in plan.participant_user_ids:
        connected = len(store.get_user_providers(pid))
        ready = connected > 0
        all_ready = all_ready and ready
        participants.append({"user_id": pid, "connected_accounts": connected, "ready": ready})
    return {"plan_id": plan_id, "all_ready": all_ready, "participants": participants}


@router.get("/ready")
async def ready():
    checks = {
        "fernet_key_configured": bool(settings.fernet_key),
        "ticket_provider": "seatgeek" if (settings.seargeek_client_id and settings.seargeek_client_secret) else "espn",
    }
    return {"ok": checks["fernet_key_configured"], "checks": checks}


@router.post("/search", response_model=SearchResponse)
async def search(payload: SearchRequest, x_user_id: str | None = Header(default=None)):
    pref = payload.preferences
    user_id = current_user_id(x_user_id)
    if not rate_limiter.hit(f"search:{user_id}", limit=settings.search_rate_limit_per_minute):
        raise HTTPException(status_code=429, detail="search rate limit exceeded")
    store.log("search_run", {"team": pref.team_text or pref.team_id, "plan_id": payload.plan_id, "user_id": user_id})

    participant_ids = ["demo-user"]
    if payload.plan_id:
        if payload.plan_id not in store.plans:
            raise HTTPException(status_code=404, detail="plan not found")
        participant_ids = store.get_plan(payload.plan_id).participant_user_ids

    calendar = MockCalendarProvider()
    busy_by_participant: dict[str, list] = {}
    for pid in participant_ids:
        accounts = [p.account_email for p in store.get_user_providers(pid)]
        if payload.plan_id and not accounts:
            raise HTTPException(status_code=400, detail=f"participant {pid} has no connected calendars")
        busy_by_participant[pid] = await calendar.get_freebusy(pref.date_start, pref.date_end, accounts or ["demo@example.com"])

    team = pref.team_text or pref.team_id or "Yankees"
    provider = get_ticket_provider()
    games_cache_key = f"games:{team}:{pref.date_start.isoformat()}:{pref.date_end.isoformat()}"
    games = games_cache.get(games_cache_key)
    if games is None:
        games = await provider.list_games(team, pref.date_start, pref.date_end)
        games_cache.set(games_cache_key, games)

    ranked = []
    for game in games:
        available_for_all = all(is_available(game, busy_by_participant[pid], pref) for pid in participant_ids)
        if not available_for_all:
            continue
        min_p = max(0, pref.budget_total * pref.price_tier * 0.25)
        max_p = pref.budget_total * (0.8 + pref.price_tier)
        ticket_cache_key = f"ticket:{game.game_id}:{pref.party_size}:{min_p:.2f}:{max_p:.2f}"
        ticket = tickets_cache.get(ticket_cache_key)
        if ticket is None:
            ticket = await provider.search_tickets(game.game_id, pref.party_size, (min_p, max_p))
            if ticket is not None:
                tickets_cache.set(ticket_cache_key, ticket)
        if not ticket:
            continue
        if ticket.estimated_total > pref.budget_total:
            continue
        distance = 10.0
        result = score_game(game, ticket, pref, distance)
        if pref.giveaway_only and not game.giveaway_text:
            continue
        if payload.plan_id:
            result.why_recommended.append(f"All {len(participant_ids)} participants are available")
        ranked.append(result)

    ranked.sort(key=lambda r: r.score, reverse=True)
    return SearchResponse(top_three=ranked[:3], ranked=ranked, scoring_weights=WEIGHTS)
