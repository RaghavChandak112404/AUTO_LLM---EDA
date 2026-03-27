"""
visualization.py — Chart generation for AUTO LLM + EDA
All chart functions return a dict with:
    { "type": "plotly" | "image", "data": <json-serialisable> | <base64 str> }
"""

import io
import base64
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")  # non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns
import plotly.express as px
import plotly.figure_factory as ff
import plotly.graph_objects as go
from plotly.utils import PlotlyJSONEncoder
import json

from utils import summarise_dtypes, safe_json


# ── Helpers ────────────────────────────────────────────────────────────────

def _fig_to_base64(fig) -> str:
    """Convert a Matplotlib figure to a base64-encoded PNG string."""
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", dpi=120)
    buf.seek(0)
    encoded = base64.b64encode(buf.read()).decode("utf-8")
    plt.close(fig)
    return encoded


def _plotly_to_json(fig) -> str:
    """Serialise a Plotly figure to a JSON string."""
    return json.dumps(fig, cls=PlotlyJSONEncoder)


# ── 1. Correlation Heatmap ─────────────────────────────────────────────────

def correlation_heatmap(df: pd.DataFrame) -> dict:
    """Interactive Plotly heatmap of the Pearson correlation matrix."""
    numeric_df = df.select_dtypes(include="number")
    if numeric_df.shape[1] < 2:
        return {"error": "Need ≥ 2 numeric columns for a heatmap."}

    corr = numeric_df.corr().round(2)
    fig = px.imshow(
        corr,
        text_auto=True,
        color_continuous_scale="RdBu_r",
        zmin=-1, zmax=1,
        title="Correlation Heatmap",
        aspect="auto",
    )
    fig.update_layout(margin=dict(l=40, r=40, t=60, b=40))
    return {"type": "plotly", "data": _plotly_to_json(fig)}


# ── 2. Distribution Plots ──────────────────────────────────────────────────

def distribution_plots(df: pd.DataFrame, column: str) -> dict:
    """
    Combined histogram + KDE + box plot for a single numeric column.
    Returns a base64 PNG (Matplotlib/Seaborn).
    """
    if column not in df.columns:
        return {"error": f"Column '{column}' not found."}

    series = df[column].dropna()

    fig, axes = plt.subplots(1, 2, figsize=(12, 4))
    fig.suptitle(f"Distribution: {column}", fontsize=14, fontweight="bold")

    # Histogram + KDE
    sns.histplot(series, kde=True, ax=axes[0], color="#4C72B0")
    axes[0].set_title("Histogram + KDE")
    axes[0].set_xlabel(column)

    # Box plot
    sns.boxplot(y=series, ax=axes[1], color="#55A868")
    axes[1].set_title("Box Plot")
    axes[1].set_ylabel(column)

    plt.tight_layout()
    return {"type": "image", "data": _fig_to_base64(fig)}


def all_numeric_distributions(df: pd.DataFrame, max_cols: int = 12) -> dict:
    """
    Grid of histograms for all numeric columns (up to `max_cols`).
    Returns base64 PNG.
    """
    num_df = df.select_dtypes(include="number")
    cols = num_df.columns.tolist()[:max_cols]
    if not cols:
        return {"error": "No numeric columns found."}

    n = len(cols)
    ncols = min(n, 3)
    nrows = (n + ncols - 1) // ncols

    fig, axes = plt.subplots(nrows, ncols, figsize=(5 * ncols, 4 * nrows))
    axes = np.array(axes).flatten() if n > 1 else [axes]

    for i, col in enumerate(cols):
        sns.histplot(num_df[col].dropna(), kde=True, ax=axes[i], color="#4C72B0")
        axes[i].set_title(col, fontsize=10)

    # Hide unused subplots
    for j in range(i + 1, len(axes)):
        axes[j].set_visible(False)

    plt.suptitle("Numeric Column Distributions", fontsize=14, fontweight="bold", y=1.02)
    plt.tight_layout()
    return {"type": "image", "data": _fig_to_base64(fig)}


# ── 3. Missing Value Bar Chart ─────────────────────────────────────────────

def missing_value_chart(df: pd.DataFrame) -> dict:
    """Plotly bar chart of missing value percentages per column."""
    missing_pct = (df.isnull().mean() * 100).round(2).sort_values(ascending=False)
    missing_pct = missing_pct[missing_pct > 0]

    if missing_pct.empty:
        return {"type": "plotly", "data": _plotly_to_json(
            go.Figure().add_annotation(
                text="No missing values found! 🎉",
                xref="paper", yref="paper",
                x=0.5, y=0.5, showarrow=False, font=dict(size=18),
            )
        )}

    fig = px.bar(
        x=missing_pct.index,
        y=missing_pct.values,
        labels={"x": "Column", "y": "Missing (%)"},
        title="Missing Values per Column (%)",
        color=missing_pct.values,
        color_continuous_scale="OrRd",
    )
    fig.update_layout(coloraxis_showscale=False, margin=dict(l=40, r=40, t=60, b=80))
    return {"type": "plotly", "data": _plotly_to_json(fig)}


# ── 4. Categorical Value Counts ────────────────────────────────────────────

def categorical_bar(df: pd.DataFrame, column: str, top_n: int = 15) -> dict:
    """Plotly bar chart for a categorical column's value counts."""
    if column not in df.columns:
        return {"error": f"Column '{column}' not found."}

    vc = df[column].value_counts(dropna=False).head(top_n)
    fig = px.bar(
        x=vc.index.astype(str),
        y=vc.values,
        labels={"x": column, "y": "Count"},
        title=f"Value Counts: {column} (top {top_n})",
        color=vc.values,
        color_continuous_scale="Blues",
    )
    fig.update_layout(coloraxis_showscale=False, margin=dict(l=40, r=40, t=60, b=80))
    return {"type": "plotly", "data": _plotly_to_json(fig)}


# ── 5. Scatter Plot ────────────────────────────────────────────────────────

def scatter_plot(df: pd.DataFrame, x_col: str, y_col: str, color_col: str = None) -> dict:
    """Interactive Plotly scatter plot between two numeric columns."""
    for col in [x_col, y_col]:
        if col not in df.columns:
            return {"error": f"Column '{col}' not found."}

    kwargs = dict(x=x_col, y=y_col, title=f"{x_col} vs {y_col}", opacity=0.7)
    if color_col and color_col in df.columns:
        kwargs["color"] = color_col

    fig = px.scatter(df, **kwargs, trendline="ols")
    fig.update_layout(margin=dict(l=40, r=40, t=60, b=40))
    return {"type": "plotly", "data": _plotly_to_json(fig)}


# ── 6. Pair Plot (static) ──────────────────────────────────────────────────

def pair_plot(df: pd.DataFrame, max_cols: int = 5) -> dict:
    """
    Seaborn pair plot for numeric columns (static PNG, max 5 cols for readability).
    """
    num_df = df.select_dtypes(include="number").iloc[:, :max_cols]
    if num_df.shape[1] < 2:
        return {"error": "Need ≥ 2 numeric columns for a pair plot."}

    fig = sns.pairplot(num_df, diag_kind="kde", plot_kws={"alpha": 0.5})
    fig.fig.suptitle("Pair Plot", y=1.02, fontsize=14, fontweight="bold")
    return {"type": "image", "data": _fig_to_base64(fig.fig)}


# ── 7. Box Plots Grid ─────────────────────────────────────────────────────

def box_plots_grid(df: pd.DataFrame, max_cols: int = 12) -> dict:
    """Grid of Plotly box plots for all numeric columns."""
    num_df = df.select_dtypes(include="number")
    cols = num_df.columns.tolist()[:max_cols]
    if not cols:
        return {"error": "No numeric columns found."}

    fig = go.Figure()
    for col in cols:
        fig.add_trace(go.Box(y=df[col].dropna(), name=col, boxpoints="outliers"))

    fig.update_layout(
        title="Box Plots – Numeric Columns",
        showlegend=False,
        margin=dict(l=40, r=40, t=60, b=80),
    )
    return {"type": "plotly", "data": _plotly_to_json(fig)}


# ── 8. Chart Router ───────────────────────────────────────────────────────

CHART_REGISTRY = {
    "correlation_heatmap": correlation_heatmap,
    "missing_value_chart": missing_value_chart,
    "all_distributions": all_numeric_distributions,
    "box_plots": box_plots_grid,
}


def get_chart(chart_name: str, df: pd.DataFrame, **kwargs) -> dict:
    """
    Dispatch a chart by name. Passes any extra kwargs to the chart function.
    """
    if chart_name not in CHART_REGISTRY:
        return {"error": f"Unknown chart: '{chart_name}'. Available: {list(CHART_REGISTRY)}"}
    return CHART_REGISTRY[chart_name](df, **kwargs)