from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import sqlite3
import uuid
from app.models.schemas import Preferences, ConnectedCalendarProvider, Plan


def default_preferences() -> Preferences:
    now = datetime.now(timezone.utc)
    return Preferences(date_start=now, date_end=now + timedelta(days=90))


class SQLiteStore:
    def __init__(self, db_path: str | None = None):
        default_path = Path(__file__).resolve().parents[2] / "data" / "gameday.db"
        self.db_path = Path(db_path or os.getenv("STORE_DB_PATH", str(default_path)))
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS preferences (
                    user_id TEXT PRIMARY KEY,
                    preferences_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS providers (
                    user_id TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    provider_json TEXT NOT NULL,
                    PRIMARY KEY (user_id, provider)
                );

                CREATE TABLE IF NOT EXISTS plans (
                    plan_id TEXT PRIMARY KEY,
                    plan_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS plan_preferences (
                    plan_id TEXT PRIMARY KEY,
                    preferences_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS audit (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    ts TEXT NOT NULL
                );
                """
            )

    def get_preferences(self, user_id: str) -> Preferences:
        with self._connect() as conn:
            row = conn.execute("SELECT preferences_json FROM preferences WHERE user_id = ?", (user_id,)).fetchone()
            if row is None:
                pref = default_preferences()
                conn.execute(
                    "INSERT INTO preferences(user_id, preferences_json) VALUES (?, ?)",
                    (user_id, pref.model_dump_json()),
                )
                return pref
            return Preferences.model_validate_json(row["preferences_json"])

    def set_preferences(self, user_id: str, preferences: Preferences):
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO preferences(user_id, preferences_json)
                VALUES (?, ?)
                ON CONFLICT(user_id) DO UPDATE SET preferences_json = excluded.preferences_json
                """,
                (user_id, preferences.model_dump_json()),
            )

    def get_user_providers(self, user_id: str) -> list[ConnectedCalendarProvider]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT provider_json FROM providers WHERE user_id = ? ORDER BY provider",
                (user_id,),
            ).fetchall()
            return [ConnectedCalendarProvider.model_validate_json(r["provider_json"]) for r in rows]

    def set_user_provider(self, user_id: str, provider: ConnectedCalendarProvider):
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO providers(user_id, provider, provider_json)
                VALUES (?, ?, ?)
                ON CONFLICT(user_id, provider) DO UPDATE SET provider_json = excluded.provider_json
                """,
                (user_id, provider.provider, provider.model_dump_json()),
            )

    def disconnect_user_provider(self, user_id: str, provider_name: str):
        with self._connect() as conn:
            conn.execute("DELETE FROM providers WHERE user_id = ? AND provider = ?", (user_id, provider_name))

    def create_plan(self, owner_user_id: str, name: str) -> Plan:
        plan_id = str(uuid.uuid4())
        plan = Plan(id=plan_id, name=name, owner_user_id=owner_user_id, participant_user_ids=[owner_user_id])
        with self._connect() as conn:
            conn.execute("INSERT INTO plans(plan_id, plan_json) VALUES (?, ?)", (plan_id, plan.model_dump_json()))
            conn.execute(
                "INSERT INTO plan_preferences(plan_id, preferences_json) VALUES (?, ?)",
                (plan_id, default_preferences().model_dump_json()),
            )
        return plan

    def join_plan(self, plan_id: str, user_id: str):
        plan = self.get_plan(plan_id)
        if user_id not in plan.participant_user_ids:
            plan.participant_user_ids.append(user_id)
            with self._connect() as conn:
                conn.execute("UPDATE plans SET plan_json = ? WHERE plan_id = ?", (plan.model_dump_json(), plan_id))

    def plan_exists(self, plan_id: str) -> bool:
        with self._connect() as conn:
            row = conn.execute("SELECT 1 FROM plans WHERE plan_id = ?", (plan_id,)).fetchone()
            return row is not None

    def get_plan(self, plan_id: str) -> Plan:
        with self._connect() as conn:
            row = conn.execute("SELECT plan_json FROM plans WHERE plan_id = ?", (plan_id,)).fetchone()
            if row is None:
                raise KeyError(plan_id)
            return Plan.model_validate_json(row["plan_json"])


    def reset(self):
        with self._connect() as conn:
            conn.executescript(
                """
                DELETE FROM providers;
                DELETE FROM preferences;
                DELETE FROM plans;
                DELETE FROM plan_preferences;
                DELETE FROM audit;
                """
            )

    def log(self, event: str, payload: dict):
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO audit(event, payload_json, ts) VALUES (?, ?, ?)",
                (event, json.dumps(payload), datetime.now(timezone.utc).isoformat()),
            )


store = SQLiteStore()
