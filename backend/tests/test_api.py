import io
import logging
import os
import re
import tempfile
import unittest

os.environ["OTEL_DISABLE_EXPORTERS"] = "true"
_tmp_dir = tempfile.TemporaryDirectory()
os.environ["DB_PATH"] = os.path.join(_tmp_dir.name, "test.db")

from fastapi.testclient import TestClient  # noqa: E402
from opentelemetry.sdk.trace.export import SimpleSpanProcessor  # noqa: E402
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter  # noqa: E402

import main  # noqa: E402


class MoneyTrackerApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.span_exporter = InMemorySpanExporter()
        main.tracer_provider.add_span_processor(SimpleSpanProcessor(cls.span_exporter))
        cls.client = TestClient(main.app)

    def test_health_and_categories(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"status": "ok"})

        cats = self.client.get("/api/categories")
        self.assertEqual(cats.status_code, 200)
        self.assertEqual(
            cats.json()["categories"],
            ["Food", "Transport", "Utilities", "Entertainment", "Health", "Shopping", "Others"],
        )

    def test_budget_expenses_and_dashboard_aggregation(self):
        b_res = self.client.post(
            "/api/budget",
            json={"amount": 1200.0, "month": 11, "year": 2026},
        )
        self.assertEqual(b_res.status_code, 200)
        self.assertEqual(b_res.json()["amount"], 1200.0)

        b_res2 = self.client.post(
            "/api/budget",
            json={"amount": 1500.5, "month": 11, "year": 2026},
        )
        self.assertEqual(b_res2.status_code, 200)
        self.assertEqual(b_res2.json()["amount"], 1500.5)

        e1 = self.client.post(
            "/api/expenses",
            json={
                "amount": 25.50,
                "category": "Food",
                "date": "2026-11-09",
                "description": "Lunch",
                "client_id": "cid-1",
            },
        )
        self.assertEqual(e1.status_code, 201)
        e1_id = e1.json()["id"]

        e1_dup = self.client.post(
            "/api/expenses",
            json={
                "amount": 25.50,
                "category": "Food",
                "date": "2026-11-09",
                "description": "Lunch",
                "client_id": "cid-1",
            },
        )
        self.assertEqual(e1_dup.status_code, 201)
        self.assertEqual(e1_dup.json()["id"], e1_id)

        e2 = self.client.post(
            "/api/expenses",
            json={
                "amount": 40.00,
                "category": "Transport",
                "date": "2026-11-09",
                "description": "Metro pass",
            },
        )
        self.assertEqual(e2.status_code, 201)

        dash = self.client.get("/api/dashboard?year=2026&month=11&today=2026-11-09")
        self.assertEqual(dash.status_code, 200)
        payload = dash.json()

        self.assertEqual(payload["currency"], "INR")
        self.assertTrue(payload["has_budget"])
        self.assertEqual(payload["budget"], 1500.5)
        self.assertEqual(payload["total_expenses"], 65.5)
        self.assertEqual(payload["remaining_budget"], 1435.0)
        self.assertEqual(len(payload["expenses"]), 2)
        self.assertEqual(len(payload["daily_trend"]), 30)
        self.assertEqual(len(payload["weekly_trend"]), 7)

        categories_map = {c["category"]: c["total"] for c in payload["expenses_by_category"]}
        self.assertEqual(categories_map, {"Transport": 40.0, "Food": 25.5})

        day9 = next(d for d in payload["daily_trend"] if d["date"] == "2026-11-09")
        self.assertEqual(day9["total"], 65.5)

        week_day9 = next(w for w in payload["weekly_trend"] if w["date"] == "2026-11-09")
        self.assertEqual(week_day9["total"], 65.5)

        del_res = self.client.delete(f"/api/expenses/{e1_id}")
        self.assertEqual(del_res.status_code, 200)
        dash_after = self.client.get("/api/dashboard?year=2026&month=11&today=2026-11-09").json()
        self.assertEqual(dash_after["total_expenses"], 40.0)

    def test_validation_rejects_bad_inputs(self):
        bad_amount = self.client.post(
            "/api/expenses",
            json={"amount": -10, "category": "Food", "date": "2026-11-09"},
        )
        self.assertEqual(bad_amount.status_code, 422)

        bad_cat = self.client.post(
            "/api/expenses",
            json={"amount": 10, "category": "Crypto", "date": "2026-11-09"},
        )
        self.assertEqual(bad_cat.status_code, 422)

    def test_otel_fastapi_sqlite_spans_and_trace_id_in_logs(self):
        self.span_exporter.clear()
        log_stream = io.StringIO()
        handler = logging.StreamHandler(log_stream)
        handler.setFormatter(logging.Formatter(main.LOG_FORMAT))
        handler.addFilter(main.TraceContextFilter())
        main.logger.addHandler(handler)
        try:
            res = self.client.get("/api/dashboard?year=2026&month=11&today=2026-11-09")
            self.assertEqual(res.status_code, 200)
        finally:
            main.logger.removeHandler(handler)

        spans = self.span_exporter.get_finished_spans()
        span_names = [s.name for s in spans]
        self.assertTrue(any("GET /api/dashboard" in name for name in span_names), span_names)
        self.assertTrue(any(s.attributes.get("db.system") == "sqlite" for s in spans), span_names)

        log_output = log_stream.getvalue()
        match = re.search(r"trace_id=([0-9a-f]{32})", log_output)
        self.assertIsNotNone(match, log_output)
        self.assertNotEqual(match.group(1), "0" * 32)


if __name__ == "__main__":
    unittest.main()
