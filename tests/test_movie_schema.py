from src.app.schemas import MovieCard


def test_movie_card_validation():
    card = MovieCard(
        title="Fight Club",
        year="1999",
        genres=["Drama"],
        countries=["USA"],
        directors=["David Fincher"],
        cast=["Brad Pitt", "Edward Norton"],
        tmdb_id=550,
    )
    dumped = card.model_dump()
    assert dumped["title"] == "Fight Club"
    assert dumped["tmdb_id"] == 550
    assert dumped["genres"] == ["Drama"]
    assert dumped["directors"] == ["David Fincher"]
    assert dumped["cast"] == ["Brad Pitt", "Edward Norton"]


def test_movie_card_people_defaults_to_empty_lists():
    dumped = MovieCard(title="Test").model_dump()
    assert dumped["directors"] == []
    assert dumped["cast"] == []
