"""
eda.py — Exploratory Data Analysis engine for AUTO LLM + EDA
"""

import pandas as pd
import numpy as np
from utils import safe_json, summarise_dtypes


# ── 1. Basic Summary ───────────────────────────────────────────────────────

def basic_summary(df: pd.DataFrame) -> dict:
    """
    Returns shape, dtypes, descriptive stats, and head/tail samples.
    """
    dtype_map = summarise_dtypes(df)
    numeric_cols = [c for c, t in dtype_map.items() if t == "numeric"]
    cat_cols = [c for c, t in dtype_map.items() if t == "categorical"]

    desc_numeric = (
        df[numeric_cols].describe().to_dict() if numeric_cols else {}
    )
    desc_cat = {}
    for col in cat_cols:
        vc = df[col].value_counts(dropna=False)
        desc_cat[col] = {
            "unique": int(df[col].nunique()),
            "top_values": safe_json(vc.head(5).to_dict()),
        }

    return safe_json({
        "shape": {"rows": df.shape[0], "columns": df.shape[1]},
        "column_types": dtype_map,
        "numeric_stats": desc_numeric,
        "categorical_stats": desc_cat,
        "sample_head": df.head(5).to_dict(orient="records"),
    })


# ── 2. Missing Value Analysis ──────────────────────────────────────────────

def missing_value_analysis(df: pd.DataFrame) -> dict:
    """
    Returns per-column missing counts/percentages and overall completeness.
    """
    total = len(df)
    missing = df.isnull().sum()
    pct = (missing / total * 100).round(2)

    per_col = {
        col: {"missing_count": int(missing[col]), "missing_pct": float(pct[col])}
        for col in df.columns
    }
    cols_with_missing = {k: v for k, v in per_col.items() if v["missing_count"] > 0}
    overall_completeness = round((1 - df.isnull().any(axis=1).mean()) * 100, 2)

    return safe_json({
        "total_rows": total,
        "overall_completeness_pct": overall_completeness,
        "columns_with_missing": cols_with_missing,
        "all_columns": per_col,
    })


# ── 3. Correlation Analysis ────────────────────────────────────────────────

def correlation_analysis(df: pd.DataFrame) -> dict:
    """
    Computes Pearson correlation matrix for numeric columns.
    Returns matrix, top positive/negative pairs.
    """
    numeric_df = df.select_dtypes(include="number")
    if numeric_df.shape[1] < 2:
        return {"error": "Need at least 2 numeric columns for correlation."}

    corr = numeric_df.corr()
    matrix = safe_json(corr.to_dict())

    # Extract top pairs (excluding diagonal)
    pairs = []
    cols = corr.columns.tolist()
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            pairs.append({
                "col_a": cols[i],
                "col_b": cols[j],
                "correlation": round(float(corr.iloc[i, j]), 4),
            })

    pairs_sorted = sorted(pairs, key=lambda x: abs(x["correlation"]), reverse=True)

    return safe_json({
        "correlation_matrix": matrix,
        "top_pairs": pairs_sorted[:10],
        "numeric_columns": cols,
    })


# ── 4. Distribution Analysis ───────────────────────────────────────────────

def distribution_analysis(df: pd.DataFrame) -> dict:
    """
    For numeric columns: skewness, kurtosis, outlier counts (IQR method).
    For categorical columns: value counts and entropy.
    """
    dtype_map = summarise_dtypes(df)
    numeric_cols = [c for c, t in dtype_map.items() if t == "numeric"]
    cat_cols = [c for c, t in dtype_map.items() if t == "categorical"]

    numeric_dist = {}
    for col in numeric_cols:
        series = df[col].dropna()
        q1, q3 = series.quantile(0.25), series.quantile(0.75)
        iqr = q3 - q1
        outliers = int(((series < q1 - 1.5 * iqr) | (series > q3 + 1.5 * iqr)).sum())
        numeric_dist[col] = {
            "mean": round(float(series.mean()), 4),
            "median": round(float(series.median()), 4),
            "std": round(float(series.std()), 4),
            "min": round(float(series.min()), 4),
            "max": round(float(series.max()), 4),
            "skewness": round(float(series.skew()), 4),
            "kurtosis": round(float(series.kurtosis()), 4),
            "outlier_count_iqr": outliers,
        }

    cat_dist = {}
    for col in cat_cols:
        vc = df[col].value_counts(normalize=True, dropna=False)
        # Shannon entropy
        probs = vc.values
        entropy = float(-np.sum(probs * np.log2(probs + 1e-9)))
        cat_dist[col] = {
            "unique_values": int(df[col].nunique()),
            "top_5": safe_json(df[col].value_counts(dropna=False).head(5).to_dict()),
            "entropy": round(entropy, 4),
        }

    return safe_json({
        "numeric_distributions": numeric_dist,
        "categorical_distributions": cat_dist,
    })


# ── 5. Full EDA Report ─────────────────────────────────────────────────────

def full_eda_report(df: pd.DataFrame) -> dict:
    """
    Aggregate all EDA results into a single dict for LLM consumption.
    """
    return {
        "summary": basic_summary(df),
        "missing_values": missing_value_analysis(df),
        "correlations": correlation_analysis(df),
        "distributions": distribution_analysis(df),
    }


# ── 6. Compact text snapshot (for LLM prompt context) ─────────────────────

def eda_text_snapshot(df: pd.DataFrame, max_chars: int = 4000) -> str:
    """
    Return a concise text description of the dataset suitable for injecting
    into an LLM prompt without blowing the context window.
    """
    report = full_eda_report(df)
    summary = report["summary"]
    mv = report["missing_values"]
    corr = report["correlations"]
    dist = report["distributions"]

    lines = [
        f"Dataset shape: {summary['shape']['rows']} rows × {summary['shape']['columns']} columns.",
        f"Overall completeness: {mv['overall_completeness_pct']}%.",
    ]

    # Column types
    type_counts: dict[str, int] = {}
    for t in summary["column_types"].values():
        type_counts[t] = type_counts.get(t, 0) + 1
    lines.append("Column types: " + ", ".join(f"{v} {k}" for k, v in type_counts.items()) + ".")

    # Missing
    if mv["columns_with_missing"]:
        top_missing = sorted(
            mv["columns_with_missing"].items(),
            key=lambda x: x[1]["missing_pct"],
            reverse=True,
        )[:5]
        lines.append(
            "Top missing columns: "
            + ", ".join(f"{c} ({v['missing_pct']}%)" for c, v in top_missing)
            + "."
        )

    # Correlations
    if "top_pairs" in corr and corr["top_pairs"]:
        top = corr["top_pairs"][0]
        lines.append(
            f"Highest correlation: {top['col_a']} ↔ {top['col_b']} = {top['correlation']}."
        )

    # Skewness / outliers
    skewed = [
        (col, v["skewness"], v["outlier_count_iqr"])
        for col, v in dist["numeric_distributions"].items()
        if abs(v["skewness"]) > 1
    ]
    if skewed:
        lines.append(
            "Highly skewed numeric columns: "
            + ", ".join(f"{c} (skew={s:.2f}, outliers={o})" for c, s, o in skewed[:5])
            + "."
        )

    snapshot = "\n".join(lines)
    if len(snapshot) > max_chars:
        snapshot = snapshot[:max_chars] + "\n… [truncated]"
    return snapshot