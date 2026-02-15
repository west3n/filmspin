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
