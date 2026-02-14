from fastapi import HTTPException

from src.app import dependencies


def test_ru_guard_blocks_when_disabled(monkeypatch):
    monkeypatch.setattr(dependencies, "RU_ENABLED", False)
    try:
        dependencies.require_ru_enabled()
    except HTTPException as exc:
        assert exc.status_code == 404
    else:
        assert False, "Expected HTTPException for disabled RU mode"


def test_ru_guard_allows_when_enabled(monkeypatch):
    monkeypatch.setattr(dependencies, "RU_ENABLED", True)
    dependencies.require_ru_enabled()
