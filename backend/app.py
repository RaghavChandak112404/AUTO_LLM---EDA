"""
app.py — FastAPI backend for AUTO LLM + EDA
Run with: uvicorn app:app --reload --port 8000
"""

import io
import json
from typing import Annotated

import pandas as pd
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from utils import is_allowed_file, load_dataframe, safe_json
from eda import full_eda_report, eda_text_snapshot
from visualization import (
    correlation_heatmap,
    missing_value_chart,
    all_numeric_distributions,
    distribution_plots,
    categorical_bar,
    scatter_plot,
    box_plots_grid,
)
from llm_helper import chat_with_eda, auto_insights, suggest_visualisations
from ml_trainer import train_model

# ── App setup ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="AUTO LLM + EDA API",
    description="Automated Exploratory Data Analysis powered by LLM",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory session store (replace with Redis/DB for multi-user) ─────────
_session: dict = {
    "df": None,
    "filename": None,
    "snapshot": None,
    "history": [],       # conversation history for the LLM
}


# ── Request / Response models ──────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str
    reset_history: bool = False


class ChartRequest(BaseModel):
    chart_type: str          # e.g. "correlation_heatmap"
    column: str | None = None
    x_col: str | None = None
    y_col: str | None = None
    color_col: str | None = None

class MLTrainRequest(BaseModel):
    target_column: str


# ── Helpers ────────────────────────────────────────────────────────────────

def _require_df() -> pd.DataFrame:
    if _session["df"] is None:
        raise HTTPException(status_code=400, detail="No dataset uploaded yet.")
    return _session["df"]


# ── Routes ─────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "message": "AUTO LLM + EDA API is running."}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}


# ── Upload ─────────────────────────────────────────────────────────────────

@app.post("/upload", tags=["Dataset"])
async def upload_file(file: UploadFile = File(...)):
    """Upload a CSV / Excel / JSON / Parquet file and run initial EDA."""
    if not is_allowed_file(file.filename):
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type. Allowed: csv, xlsx, xls, json, parquet",
        )

    file_bytes = await file.read()
    try:
        df = load_dataframe(file_bytes, file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Store in session
    _session["df"] = df
    _session["filename"] = file.filename
    _session["snapshot"] = eda_text_snapshot(df)
    _session["history"] = []

    report = full_eda_report(df)
    return JSONResponse(content={
        "filename": file.filename,
        "shape": {"rows": df.shape[0], "columns": df.shape[1]},
        "columns": df.columns.tolist(),
        "eda_report": report,
    })


# ── EDA endpoints ──────────────────────────────────────────────────────────

@app.get("/eda/summary", tags=["EDA"])
def get_summary():
    df = _require_df()
    return JSONResponse(content=safe_json(full_eda_report(df)))


@app.get("/eda/columns", tags=["EDA"])
def get_columns():
    df = _require_df()
    return {"columns": df.columns.tolist(), "dtypes": df.dtypes.astype(str).to_dict()}


# ── Visualisation endpoints ────────────────────────────────────────────────

@app.get("/chart/correlation", tags=["Charts"])
def chart_correlation():
    df = _require_df()
    return JSONResponse(content=correlation_heatmap(df))


@app.get("/chart/missing", tags=["Charts"])
def chart_missing():
    df = _require_df()
    return JSONResponse(content=missing_value_chart(df))


@app.get("/chart/distributions", tags=["Charts"])
def chart_all_distributions():
    df = _require_df()
    return JSONResponse(content=all_numeric_distributions(df))


@app.get("/chart/distribution/{column}", tags=["Charts"])
def chart_column_distribution(column: str):
    df = _require_df()
    return JSONResponse(content=distribution_plots(df, column))


@app.get("/chart/categorical/{column}", tags=["Charts"])
def chart_categorical(column: str, top_n: int = 15):
    df = _require_df()
    return JSONResponse(content=categorical_bar(df, column, top_n=top_n))


@app.get("/chart/scatter", tags=["Charts"])
def chart_scatter(x_col: str, y_col: str, color_col: str | None = None):
    df = _require_df()
    return JSONResponse(content=scatter_plot(df, x_col, y_col, color_col))


@app.get("/chart/boxplots", tags=["Charts"])
def chart_boxplots():
    df = _require_df()
    return JSONResponse(content=box_plots_grid(df))


# ── ML endpoints ─────────────────────────────────────────────────────────

@app.post("/ml/train", tags=["ML"])
def ml_train(req: MLTrainRequest):
    """Train a simple ML model (Random Forest) on the uploaded dataset."""
    df = _require_df()
    try:
        results = train_model(df, req.target_column)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Model training error: {exc}")
    
    return JSONResponse(content=results)


# ── LLM endpoints ─────────────────────────────────────────────────────────

@app.post("/llm/chat", tags=["LLM"])
def llm_chat(req: ChatRequest):
    """Ask a natural-language question about the uploaded dataset."""
    df = _require_df()

    if req.reset_history:
        _session["history"] = []

    snapshot = _session.get("snapshot") or eda_text_snapshot(df)

    reply = chat_with_eda(
        user_question=req.question,
        df_snapshot=snapshot,
        conversation_history=_session["history"],
    )

    # Update conversation history
    _session["history"].append({"role": "user", "content": req.question})
    _session["history"].append({"role": "assistant", "content": reply})

    # Keep history bounded (last 20 turns = 10 exchanges)
    _session["history"] = _session["history"][-20:]

    return {"reply": reply}


@app.get("/llm/insights", tags=["LLM"])
def llm_auto_insights():
    """Generate automatic insights for the uploaded dataset."""
    df = _require_df()
    snapshot = _session.get("snapshot") or eda_text_snapshot(df)
    insights = auto_insights(snapshot)
    return {"insights": insights}


@app.get("/llm/suggest-charts", tags=["LLM"])
def llm_suggest_charts():
    """Ask the LLM to recommend the best visualisations for the dataset."""
    df = _require_df()
    snapshot = _session.get("snapshot") or eda_text_snapshot(df)
    suggestions = suggest_visualisations(snapshot)
    return {"suggestions": suggestions}


# ── Session management ─────────────────────────────────────────────────────

@app.delete("/session", tags=["Session"])
def clear_session():
    """Clear the current dataset and conversation history."""
    _session["df"] = None
    _session["filename"] = None
    _session["snapshot"] = None
    _session["history"] = []
    return {"message": "Session cleared."}


# ── Run directly ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)