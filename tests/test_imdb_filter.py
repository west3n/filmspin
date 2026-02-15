from src.app.services.random_service import RandomService


def test_imdb_filter_accepts_higher_rating():
    assert RandomService._passes_imdb_filter(7.5, 7.0) is True


def test_imdb_filter_rejects_missing_rating_when_threshold_positive():
    assert RandomService._passes_imdb_filter(None, 6.0) is False


def test_imdb_filter_allows_any_when_threshold_zero():
    assert RandomService._passes_imdb_filter(None, 0.0) is True
