from typing import Optional, Union

from pydantic import BaseModel, Field


class ApiError(BaseModel):
    error: str


GenreId = Union[int, str]


class GenreItem(BaseModel):
    id: GenreId
    name: str


class PublicConfigOut(BaseModel):
    ru_enabled: bool


class MetricsOut(BaseModel):
    requests_total: int
    by_path: dict[str, int] = Field(default_factory=dict)
    by_status: dict[str, int] = Field(default_factory=dict)
    avg_ms_by_path: dict[str, float] = Field(default_factory=dict)


class FiltersPreviewOut(BaseModel):
    estimated_total: Optional[int] = None
    low_results: bool = False
    unavailable: bool = False


class MovieCard(BaseModel):
    title: str = ""
    year: Optional[Union[int, str]] = None
    runtime_minutes: Optional[int] = None
    overview: str = ""
    genres: list[str] = Field(default_factory=list)
    countries: list[str] = Field(default_factory=list)
    directors: list[str] = Field(default_factory=list)
    cast: list[str] = Field(default_factory=list)
    recommendation_reason: Optional[str] = None
    watch_providers: list[str] = Field(default_factory=list)
    watch_url: Optional[str] = None
    poster: Optional[str] = None
    backdrop: Optional[str] = None
    tmdb_id: Optional[int] = None
    tmdb_vote: Optional[float] = None
    imdb_id: Optional[str] = None
    imdb_url: Optional[str] = None
    imdb_rating: Optional[float] = None
    imdb_votes: Optional[int] = None
    kp_id: Optional[int] = None
    kp_rating: Optional[float] = None
    kp_votes: Optional[int] = None
    kp_url: Optional[str] = None
    tmdb_url: Optional[str] = None
