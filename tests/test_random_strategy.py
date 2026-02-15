import random

from src.app.services.random_service import RandomService


def test_discover_strategy_for_high_imdb_threshold():
    strategy = RandomService._discover_strategy(8.5)
    assert strategy["sort_by"] == "vote_average.desc"
    assert strategy["probe_pages"] >= 12
    assert strategy["max_resolve_candidates"] >= 120
    assert strategy["shuffle_candidates"] is False


def test_discover_strategy_for_default_threshold():
    strategy = RandomService._discover_strategy(5.5)
    assert strategy["sort_by"] == "popularity.desc"
    assert strategy["vote_count_gte"] == 50
    assert strategy["shuffle_candidates"] is True


def test_build_page_plan_has_page_one_and_no_duplicates():
    random.seed(7)
    plan = RandomService._build_page_plan(total_pages=9, probe_pages=5)
    assert plan[0] == 1
    assert len(plan) == 5
    assert len(set(plan)) == len(plan)
    assert all(1 <= p <= 9 for p in plan)


def test_ru_attempt_budget_increases_for_higher_threshold():
    assert RandomService._ru_attempt_budget(6.0) < RandomService._ru_attempt_budget(7.5)
    assert RandomService._ru_attempt_budget(7.5) < RandomService._ru_attempt_budget(8.5)


def test_extract_poiskkino_total_prefers_explicit_total_fields():
    payload = {"totalDocs": 321, "docs": [{"id": 1}]}
    assert RandomService._extract_poiskkino_total(payload) == 321


def test_extract_poiskkino_total_falls_back_to_docs_length():
    payload = {"docs": [{"id": 1}, {"id": 2}, {"id": 3}]}
    assert RandomService._extract_poiskkino_total(payload) == 3


def test_safe_int_returns_none_for_invalid_values():
    assert RandomService._safe_int("abc") is None
    assert RandomService._safe_int(None) is None


def test_preview_sample_target_respects_total_results_for_small_sets():
    assert RandomService._preview_sample_target(8.5, 20) == 20
    assert RandomService._preview_sample_target(6.0, 5) == 5


def test_preview_probe_pages_stays_within_bounds():
    value = RandomService._preview_probe_pages(8.5, total_pages=4, sample_target=90)
    assert 1 <= value <= 4
