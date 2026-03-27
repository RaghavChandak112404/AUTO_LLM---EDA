"""
llm_helper.py — LLM integration (OpenAI GPT) for AUTO LLM + EDA
"""

import os
from openai import OpenAI
from dotenv import load_dotenv

from eda import eda_text_snapshot
from utils import truncate_text

load_dotenv()

# ── Client ─────────────────────────────────────────────────────────────────
_client: OpenAI | None = None


def get_client() -> OpenAI | None:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return None
        _client = OpenAI(api_key=api_key)
    return _client


# ── System Prompt ──────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are an expert data analyst assistant specialising in \
Exploratory Data Analysis (EDA). You help users understand their datasets \
through clear, insightful explanations.

When given a dataset snapshot and a user question:
- Answer concisely and accurately.
- Use bullet points or short paragraphs for clarity.
- Highlight key statistics, patterns, anomalies, or recommendations.
- If a chart or deeper analysis would help, suggest it.
- Avoid unnecessary jargon; keep explanations accessible.
- If the question is unrelated to the dataset, politely redirect.
"""


# ── Core LLM Call ──────────────────────────────────────────────────────────

def chat_with_eda(
    user_question: str,
    df_snapshot: str,
    conversation_history: list[dict] | None = None,
    model: str = "gpt-4o-mini",
    max_tokens: int = 1024,
    temperature: float = 0.3,
) -> str:
    """
    Send a user question + dataset snapshot to the LLM and return the reply.

    Args:
        user_question:        The user's natural-language question.
        df_snapshot:          Text snapshot of the dataset (from eda_text_snapshot).
        conversation_history: Previous [{"role": ..., "content": ...}] turns.
        model:                OpenAI model name.
        max_tokens:           Max tokens in the reply.
        temperature:          Sampling temperature (lower = more deterministic).

    Returns:
        Assistant reply string.
    """
    client = get_client()
    if client is None:
        return "AI insights are not available. Please set OPENAI_API_KEY in .env file."

    history = conversation_history or []

    # Build the context message injected before the user question
    context_msg = (
        "Here is a summary of the uploaded dataset:\n\n"
        f"{truncate_text(df_snapshot, max_chars=3000)}\n\n"
        "Now answer the following question based on this dataset."
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *history,
        {"role": "user", "content": f"{context_msg}\n\nQuestion: {user_question}"},
    ]

    response = client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    return response.choices[0].message.content.strip()


def auto_insights(df_snapshot: str, model: str = "gpt-4o-mini") -> str:
    """
    Automatically generate key insights for a dataset without a user question.
    Good for the initial analysis panel.
    """
    client = get_client()
    if client is None:
        return "AI insights are not available. Please set OPENAI_API_KEY in .env file."

    prompt = (
        "You are a data analyst. Given the following dataset summary, "
        "produce 5–7 bullet-point insights covering: data quality, "
        "distributions, correlations, outliers, and any recommended next steps.\n\n"
        f"Dataset summary:\n{truncate_text(df_snapshot, max_chars=3000)}"
    )

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are an expert data analyst."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=800,
        temperature=0.4,
    )
    return response.choices[0].message.content.strip()


def suggest_visualisations(df_snapshot: str, model: str = "gpt-4o-mini") -> str:
    """
    Ask the LLM to suggest the most informative visualisations for the dataset.
    """
    client = get_client()
    if client is None:
        return "AI visualisation suggestions are not available. Please set OPENAI_API_KEY in .env file."

    prompt = (
        "Based on the dataset summary below, suggest 3–5 specific visualisations "
        "that would be most insightful. For each, state: chart type, columns to use, "
        "and what the analyst would learn from it.\n\n"
        f"Dataset summary:\n{truncate_text(df_snapshot, max_chars=3000)}"
    )

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are an expert data visualisation consultant."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=600,
        temperature=0.4,
    )
    return response.choices[0].message.content.strip()