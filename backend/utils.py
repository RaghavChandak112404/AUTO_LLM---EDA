"""
utils.py — Shared utility helpers for AUTO LLM + EDA
"""

import io
import pandas as pd
import numpy as np
from pathlib import Path

# ── Allowed upload extensions ──────────────────────────────────────────────
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json", ".parquet"}


def is_allowed_file(filename: str) -> bool:
    """Return True if the file extension is supported."""
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


def load_dataframe(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """
    Load a DataFrame from raw bytes based on the file extension.

    Supports: CSV, Excel (.xlsx/.xls), JSON, Parquet.
    Raises ValueError for unsupported formats or parse errors.
    """
    ext = Path(filename).suffix.lower()
    buf = io.BytesIO(file_bytes)

    try:
        if ext == ".csv":
            # Try common separators
            for sep in [",", ";", "\t", "|"]:
                buf.seek(0)
                try:
                    df = pd.read_csv(buf, sep=sep, engine="python")
                    if df.shape[1] > 1:
                        return df
                except Exception:
                    continue
            buf.seek(0)
            return pd.read_csv(buf)  # fallback

        elif ext in {".xlsx", ".xls"}:
            return pd.read_excel(buf)

        elif ext == ".json":
            buf.seek(0)
            try:
                return pd.read_json(buf, orient="records")
            except Exception:
                buf.seek(0)
                return pd.read_json(buf)

        elif ext == ".parquet":
            return pd.read_parquet(buf)

        else:
            raise ValueError(f"Unsupported file format: {ext}")

    except Exception as exc:
        raise ValueError(f"Could not parse '{filename}': {exc}") from exc


def df_to_markdown(df: pd.DataFrame, max_rows: int = 5) -> str:
    """Return the first `max_rows` of a DataFrame as a Markdown table."""
    return df.head(max_rows).to_markdown(index=False)


def safe_json(obj):
    """
    Recursively convert numpy / pandas scalars to native Python types
    so the object is JSON-serialisable.
    """
    if isinstance(obj, dict):
        return {k: safe_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [safe_json(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return None if np.isnan(obj) else float(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, (np.ndarray,)):
        return safe_json(obj.tolist())
    if isinstance(obj, float) and np.isnan(obj):
        return None
    return obj


def summarise_dtypes(df: pd.DataFrame) -> dict:
    """
    Return a dict mapping column name → simplified type label.
    Labels: 'numeric', 'categorical', 'datetime', 'boolean', 'other'
    """
    mapping = {}
    for col in df.columns:
        dtype = df[col].dtype
        if pd.api.types.is_bool_dtype(dtype):
            mapping[col] = "boolean"
        elif pd.api.types.is_numeric_dtype(dtype):
            mapping[col] = "numeric"
        elif pd.api.types.is_datetime64_any_dtype(dtype):
            mapping[col] = "datetime"
        elif pd.api.types.is_categorical_dtype(dtype) or dtype == object:
            mapping[col] = "categorical"
        else:
            mapping[col] = "other"
    return mapping


def truncate_text(text: str, max_chars: int = 3000) -> str:
    """Truncate a string to `max_chars` with an ellipsis."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n… [truncated]"