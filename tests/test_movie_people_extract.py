from src.app.services.movie_service import MovieResolverService


def test_extract_tmdb_people_from_credits():
    details = {
        "credits": {
            "crew": [
                {"job": "Director", "name": "Christopher Nolan"},
                {"job": "Co-Director", "name": "Jane Doe"},
                {"job": "Assistant Director", "name": "Skip Me"},
            ],
            "cast": [
                {"name": "Matthew McConaughey"},
                {"name": "Anne Hathaway"},
                {"name": "Jessica Chastain"},
                {"name": "Matthew McConaughey"},
            ],
        }
    }

    directors = MovieResolverService._extract_tmdb_directors(details)
    cast = MovieResolverService._extract_tmdb_cast(details)

    assert directors == ["Christopher Nolan", "Jane Doe"]
    assert cast == ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain"]


def test_extract_kp_people_by_profession():
    movie = {
        "persons": [
            {"name": "Дэвид Финчер", "profession": "режиссеры"},
            {"name": "Brad Pitt", "enProfession": "actor"},
            {"name": "Edward Norton", "enProfession": "actor"},
            {"name": "Ignore Me", "profession": "продюсеры"},
        ]
    }

    directors = MovieResolverService._extract_kp_people(movie, role="director")
    cast = MovieResolverService._extract_kp_people(movie, role="actor")

    assert directors == ["Дэвид Финчер"]
    assert cast == ["Brad Pitt", "Edward Norton"]
