import asyncio
from types import SimpleNamespace

from app.routes.plants import search_plants


def test_search_returns_up_to_eight_candidates(monkeypatch):
    candidates = [
        {"id": i, "common_name": f"Plant {i}", "fiber_quantity": 1.0}
        for i in range(1, 12)
    ]

    monkeypatch.setattr("app.routes.plants._selectable_candidates", lambda *_args, **_kwargs: candidates)
    monkeypatch.setattr("app.routes.plants.get_supabase_client", lambda: object())

    response = asyncio.run(search_plants(SimpleNamespace(state=SimpleNamespace(user_id="user-1")), q=""))

    assert len(response["results"]) == 8
    assert all(item in candidates for item in response["results"])
