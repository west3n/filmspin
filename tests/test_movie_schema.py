from src.app.schemas import MovieCard


def test_movie_card_validation():
    card = MovieCard(
        title="Fight Club",
        year="1999",
        genres=["Drama"],
        countries=["USA"],
        tmdb_id=550,
    )
    dumped = card.model_dump()
    assert dumped["title"] == "Fight Club"
    assert dumped["tmdb_id"] == 550
    assert dumped["genres"] == ["Drama"]
