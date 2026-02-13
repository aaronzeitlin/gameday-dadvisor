from app.services.store import SQLiteStore
from app.models.schemas import ConnectedCalendarProvider


def test_sqlite_store_persists_plans_and_providers(tmp_path):
    db = tmp_path / "store.db"

    first = SQLiteStore(str(db))
    plan = first.create_plan(owner_user_id="alex", name="BIL MVP")
    first.join_plan(plan.id, "brian")
    first.set_user_provider(
        "alex",
        ConnectedCalendarProvider(
            provider="google",
            account_email="alex@example.com",
            token_encrypted="token",
            scopes=["freebusy.read"],
        ),
    )

    second = SQLiteStore(str(db))
    loaded = second.get_plan(plan.id)

    assert loaded.participant_user_ids == ["alex", "brian"]
    assert len(second.get_user_providers("alex")) == 1
