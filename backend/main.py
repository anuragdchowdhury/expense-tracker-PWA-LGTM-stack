from __future__ import annotations

import calendar
from contextlib import asynccontextmanager
from datetime import date as date_type, timedelta
import logging
import math
import os
from typing import Generator

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry import _logs, metrics, trace
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.instrumentation.sqlite3 import SQLite3Instrumentor
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from models import CATEGORIES, Budget, CategoryEnum, Expense, User, create_sqlite_engine, init_db


LOG_FORMAT = (
    "%(asctime)s %(levelname)s [%(name)s] "
    "trace_id=%(otelTraceID)s span_id=%(otelSpanID)s - %(message)s"
)


class TraceContextFilter(logging.Filter):
    """Guarantees trace_id and span_id attributes exist on every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "otelTraceID") or not hasattr(record, "otelSpanID"):
            span = trace.get_current_span()
            ctx = span.get_span_context() if span else None
            if ctx and ctx.is_valid:
                record.otelTraceID = format(ctx.trace_id, "032x")
                record.otelSpanID = format(ctx.span_id, "016x")
            else:
                record.otelTraceID = "0" * 32
                record.otelSpanID = "0" * 16
        return True


def setup_observability() -> tuple[TracerProvider | None, MeterProvider | None, LoggerProvider | None]:
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    formatter = logging.Formatter(LOG_FORMAT)
    trace_filter = TraceContextFilter()

    if not any(isinstance(h, logging.StreamHandler) for h in root_logger.handlers):
        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(formatter)
        stream_handler.addFilter(trace_filter)
        root_logger.addHandler(stream_handler)
    else:
        for existing in root_logger.handlers:
            existing.setFormatter(formatter)
            existing.addFilter(trace_filter)

    disabled = os.environ.get("OTEL_SDK_DISABLED", "").lower() in ("1", "true", "yes")
    disable_exporters = os.environ.get("OTEL_DISABLE_EXPORTERS", "").lower() in ("1", "true", "yes")
    if disabled:
        LoggingInstrumentor().instrument(set_logging_format=False)
        SQLite3Instrumentor().instrument()
        return None, None, None

    otlp_endpoint = os.environ.get(
        "OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4318"
    ).rstrip("/")
    service_name = os.environ.get("OTEL_SERVICE_NAME", "money-tracker-backend")

    resource = Resource.create(
        {
            "service.name": service_name,
            "service.version": "1.0.0",
            "service.namespace": "money-tracker",
        }
    )

    tracer_provider = TracerProvider(resource=resource)
    if not disable_exporters:
        tracer_provider.add_span_processor(
            BatchSpanProcessor(OTLPSpanExporter(endpoint=f"{otlp_endpoint}/v1/traces"))
        )
    trace.set_tracer_provider(tracer_provider)

    if disable_exporters:
        meter_provider = MeterProvider(resource=resource)
        metrics.set_meter_provider(meter_provider)
        logger_provider = LoggerProvider(resource=resource)
        _logs.set_logger_provider(logger_provider)
    else:
        metric_reader = PeriodicExportingMetricReader(
            OTLPMetricExporter(endpoint=f"{otlp_endpoint}/v1/metrics"),
            export_interval_millis=5000,
        )
        meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
        metrics.set_meter_provider(meter_provider)

        logger_provider = LoggerProvider(resource=resource)
        logger_provider.add_log_record_processor(
            BatchLogRecordProcessor(OTLPLogExporter(endpoint=f"{otlp_endpoint}/v1/logs"))
        )
        _logs.set_logger_provider(logger_provider)

        otel_log_handler = LoggingHandler(level=logging.INFO, logger_provider=logger_provider)
        otel_log_handler.setFormatter(formatter)
        otel_log_handler.addFilter(trace_filter)
        root_logger.addHandler(otel_log_handler)

    LoggingInstrumentor().instrument(set_logging_format=False)
    SQLite3Instrumentor().instrument()

    return tracer_provider, meter_provider, logger_provider


tracer_provider, meter_provider, logger_provider = setup_observability()
logger = logging.getLogger("money_tracker.api")

DEFAULT_CURRENCY = os.environ.get("CURRENCY", "INR").upper()

meter = metrics.get_meter("money_tracker.api")
expenses_created_counter = meter.create_counter(
    name="money_tracker_expenses_created",
    description="Total number of expenses created",
    unit="1",
)
expense_amount_histogram = meter.create_histogram(
    name="money_tracker_expense_amount",
    description="Distribution of recorded expense amounts",
    unit=DEFAULT_CURRENCY,
)
budget_updated_counter = meter.create_counter(
    name="money_tracker_budget_updated",
    description="Total number of monthly budget updates",
    unit="1",
)
dashboard_requests_counter = meter.create_counter(
    name="money_tracker_dashboard_requests",
    description="Total number of dashboard queries",
    unit="1",
)

DEFAULT_USERNAME = os.environ.get("DEFAULT_USERNAME", "local")
engine = create_sqlite_engine()
SessionLocal = init_db(engine, default_username=DEFAULT_USERNAME)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_default_user(db: Session) -> User:
    user = db.scalar(select(User).where(User.username == DEFAULT_USERNAME))
    if user is None:
        user = User(username=DEFAULT_USERNAME)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------
class ExpenseCreate(BaseModel):
    amount: float = Field(..., gt=0, le=100_000_000)
    category: CategoryEnum
    date: date_type
    description: str = Field(default="", max_length=255)
    client_id: str | None = Field(default=None, max_length=64)

    @field_validator("amount")
    @classmethod
    def round_amount(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("Amount must be a finite number.")
        rounded = round(v, 2)
        if rounded <= 0:
            raise ValueError("Amount must be greater than 0.")
        return rounded

    @field_validator("description")
    @classmethod
    def clean_description(cls, v: str) -> str:
        return v.strip()


class ExpenseOut(BaseModel):
    id: int
    amount: float
    category: str
    date: str
    description: str
    client_id: str | None = None


class BudgetUpsert(BaseModel):
    amount: float = Field(..., gt=0, le=100_000_000)
    month: int | None = Field(default=None, ge=1, le=12)
    year: int | None = Field(default=None, ge=2000, le=2100)

    @field_validator("amount")
    @classmethod
    def round_amount(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("Budget amount must be a finite number.")
        rounded = round(v, 2)
        if rounded <= 0:
            raise ValueError("Budget amount must be greater than 0.")
        return rounded


class BudgetOut(BaseModel):
    id: int
    month: int
    year: int
    amount: float


# ---------------------------------------------------------------------------
# FastAPI Lifespan & App
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("Money Tracker backend started (user=%s)", DEFAULT_USERNAME)
    yield
    logger.info("Money Tracker backend shutting down")
    if tracer_provider is not None:
        tracer_provider.shutdown()
    if meter_provider is not None:
        meter_provider.shutdown()
    if logger_provider is not None:
        logger_provider.shutdown()


app = FastAPI(
    title="Money Tracker PWA API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")


@app.get("/health", tags=["health"])
@api_router.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}


@api_router.get("/categories", tags=["metadata"])
def get_categories():
    return {"categories": list(CATEGORIES)}


@api_router.get("/dashboard", tags=["dashboard"])
def get_dashboard(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    today: date_type | None = Query(default=None),
    db: Session = Depends(get_db),
):
    ref_today = today or date_type.today()
    target_year = year or ref_today.year
    target_month = month or ref_today.month

    user = get_default_user(db)

    budget_row = db.scalar(
        select(Budget).where(
            Budget.user_id == user.id,
            Budget.month == target_month,
            Budget.year == target_year,
        )
    )
    budget_amount = round(budget_row.amount, 2) if budget_row else 0.0
    has_budget = budget_row is not None

    month_prefix = f"{target_year:04d}-{target_month:02d}-"
    month_expenses = list(
        db.scalars(
            select(Expense)
            .where(Expense.user_id == user.id, Expense.date.startswith(month_prefix))
            .order_by(Expense.date.desc(), Expense.id.desc())
        )
    )

    total_expenses = round(sum(exp.amount for exp in month_expenses), 2)
    remaining_budget = round(budget_amount - total_expenses, 2) if has_budget else None

    # Aggregate by category
    category_totals: dict[str, dict[str, float | int]] = {}
    for exp in month_expenses:
        bucket = category_totals.setdefault(exp.category, {"total": 0.0, "count": 0})
        bucket["total"] = round(float(bucket["total"]) + exp.amount, 2)
        bucket["count"] = int(bucket["count"]) + 1

    expenses_by_category = [
        {"category": cat, "total": data["total"], "count": data["count"]}
        for cat, data in sorted(
            category_totals.items(), key=lambda item: item[1]["total"], reverse=True
        )
    ]

    # Daily trend for the requested month
    days_in_month = calendar.monthrange(target_year, target_month)[1]
    daily_map: dict[str, float] = {}
    for exp in month_expenses:
        daily_map[exp.date] = round(daily_map.get(exp.date, 0.0) + exp.amount, 2)

    daily_trend = []
    running_total = 0.0
    for day_num in range(1, days_in_month + 1):
        d = date_type(target_year, target_month, day_num)
        iso = d.isoformat()
        day_total = round(daily_map.get(iso, 0.0), 2)
        running_total = round(running_total + day_total, 2)
        daily_trend.append(
            {
                "date": iso,
                "day": day_num,
                "label": f"{d.strftime('%b')} {d.day}",
                "total": day_total,
                "cumulative": running_total,
            }
        )

    # Weekly trend (Mon-Sun for current month, or last 7 days for non-current months)
    if target_year == ref_today.year and target_month == ref_today.month:
        week_start = ref_today - timedelta(days=ref_today.weekday())
        week_end = week_start + timedelta(days=6)
    else:
        week_end = date_type(target_year, target_month, days_in_month)
        week_start = week_end - timedelta(days=6)

    week_expenses = list(
        db.scalars(
            select(Expense).where(
                Expense.user_id == user.id,
                Expense.date >= week_start.isoformat(),
                Expense.date <= week_end.isoformat(),
            )
        )
    )
    weekly_map: dict[str, float] = {}
    for exp in week_expenses:
        weekly_map[exp.date] = round(weekly_map.get(exp.date, 0.0) + exp.amount, 2)

    weekly_trend = []
    for offset in range(7):
        d = week_start + timedelta(days=offset)
        iso = d.isoformat()
        weekly_trend.append(
            {
                "date": iso,
                "label": d.strftime("%a"),
                "full_label": f"{d.strftime('%b')} {d.day}",
                "total": round(weekly_map.get(iso, 0.0), 2),
            }
        )

    serialized_expenses = [
        {
            "id": exp.id,
            "amount": round(exp.amount, 2),
            "category": exp.category,
            "date": exp.date,
            "description": exp.description,
            "client_id": exp.client_id,
        }
        for exp in month_expenses
    ]

    dashboard_requests_counter.add(1)
    logger.info(
        "Dashboard fetched period=%04d-%02d budget=%.2f total_expenses=%.2f count=%d",
        target_year,
        target_month,
        budget_amount,
        total_expenses,
        len(month_expenses),
    )

    return {
        "month": target_month,
        "year": target_year,
        "currency": DEFAULT_CURRENCY,
        "has_budget": has_budget,
        "budget": budget_amount,
        "total_expenses": total_expenses,
        "remaining_budget": remaining_budget,
        "categories": list(CATEGORIES),
        "expenses_by_category": expenses_by_category,
        "daily_trend": daily_trend,
        "weekly_trend": weekly_trend,
        "expenses": serialized_expenses,
    }


@api_router.post("/expenses", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED, tags=["expenses"])
def create_expense(payload: ExpenseCreate, db: Session = Depends(get_db)):
    user = get_default_user(db)

    if payload.client_id:
        existing = db.scalar(
            select(Expense).where(
                Expense.user_id == user.id,
                Expense.client_id == payload.client_id,
            )
        )
        if existing is not None:
            logger.info(
                "Idempotent expense sync hit client_id=%s id=%d",
                payload.client_id,
                existing.id,
            )
            return ExpenseOut(
                id=existing.id,
                amount=round(existing.amount, 2),
                category=existing.category,
                date=existing.date,
                description=existing.description,
                client_id=existing.client_id,
            )

    expense = Expense(
        user_id=user.id,
        amount=payload.amount,
        category=payload.category.value,
        date=payload.date.isoformat(),
        description=payload.description,
        client_id=payload.client_id,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)

    expenses_created_counter.add(1, {"category": expense.category})
    expense_amount_histogram.record(expense.amount, {"category": expense.category})
    logger.info(
        "Expense created id=%d category=%s amount=%.2f date=%s",
        expense.id,
        expense.category,
        expense.amount,
        expense.date,
    )

    return ExpenseOut(
        id=expense.id,
        amount=round(expense.amount, 2),
        category=expense.category,
        date=expense.date,
        description=expense.description,
        client_id=expense.client_id,
    )


@api_router.delete("/expenses/{expense_id}", tags=["expenses"])
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    user = get_default_user(db)
    expense = db.scalar(
        select(Expense).where(Expense.id == expense_id, Expense.user_id == user.id)
    )
    if expense is None:
        logger.warning("Expense delete failed: not found id=%d", expense_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")

    category = expense.category
    amount = expense.amount
    db.delete(expense)
    db.commit()

    logger.info("Expense deleted id=%d category=%s amount=%.2f", expense_id, category, amount)
    return {"deleted": True, "id": expense_id}


@api_router.post("/budget", response_model=BudgetOut, tags=["budget"])
def upsert_budget(payload: BudgetUpsert, db: Session = Depends(get_db)):
    today = date_type.today()
    target_month = payload.month or today.month
    target_year = payload.year or today.year

    user = get_default_user(db)
    budget = db.scalar(
        select(Budget).where(
            Budget.user_id == user.id,
            Budget.month == target_month,
            Budget.year == target_year,
        )
    )

    if budget is None:
        budget = Budget(
            user_id=user.id,
            month=target_month,
            year=target_year,
            amount=payload.amount,
        )
        db.add(budget)
    else:
        budget.amount = payload.amount

    db.commit()
    db.refresh(budget)

    budget_updated_counter.add(1)
    logger.info(
        "Budget saved period=%04d-%02d amount=%.2f",
        budget.year,
        budget.month,
        budget.amount,
    )

    return BudgetOut(
        id=budget.id,
        month=budget.month,
        year=budget.year,
        amount=round(budget.amount, 2),
    )


app.include_router(api_router)
FastAPIInstrumentor.instrument_app(app, excluded_urls="health,/api/health")
