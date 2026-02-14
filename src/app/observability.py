from collections import defaultdict
from threading import Lock

from .schemas import MetricsOut


class InMemoryMetrics:
    def __init__(self) -> None:
        self._lock = Lock()
        self._requests_total = 0
        self._by_path: dict[str, int] = defaultdict(int)
        self._by_status: dict[str, int] = defaultdict(int)
        self._sum_ms_by_path: dict[str, float] = defaultdict(float)
        self._count_by_path: dict[str, int] = defaultdict(int)

    def observe(self, path: str, status_code: int, duration_ms: float) -> None:
        with self._lock:
            self._requests_total += 1
            self._by_path[path] += 1
            self._by_status[str(status_code)] += 1
            self._sum_ms_by_path[path] += duration_ms
            self._count_by_path[path] += 1

    def snapshot(self) -> MetricsOut:
        with self._lock:
            avg_ms_by_path = {
                p: round(self._sum_ms_by_path[p] / max(1, self._count_by_path[p]), 2)
                for p in self._count_by_path
            }
            return MetricsOut(
                requests_total=self._requests_total,
                by_path=dict(self._by_path),
                by_status=dict(self._by_status),
                avg_ms_by_path=avg_ms_by_path,
            )


metrics = InMemoryMetrics()
