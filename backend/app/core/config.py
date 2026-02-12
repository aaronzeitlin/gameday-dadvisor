from pydantic import BaseModel
from dotenv import load_dotenv
import os

load_dotenv()


class Settings(BaseModel):
    app_name: str = "Gameday Dadvisor"
    fernet_key: str = os.getenv("FERNET_KEY", "")
    seargeek_client_id: str | None = os.getenv("SEATGEEK_CLIENT_ID")
    seargeek_client_secret: str | None = os.getenv("SEATGEEK_CLIENT_SECRET")
    cors_origins: str = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    search_rate_limit_per_minute: int = int(os.getenv("SEARCH_RATE_LIMIT_PER_MINUTE", "30"))
    games_cache_ttl_seconds: int = int(os.getenv("GAMES_CACHE_TTL_SECONDS", "900"))
    tickets_cache_ttl_seconds: int = int(os.getenv("TICKETS_CACHE_TTL_SECONDS", "900"))


settings = Settings()
