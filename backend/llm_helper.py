"""
llm_helper.py — LLM integration (Google Gemini) for AUTO LLM + EDA
"""

import os
import google.generativeai as genai
from dotenv import load_dotenv

from eda import eda_text_snapshot
from utils import truncate_text

load_dotenv()

# ── Client / Model ─────────────────────────────────────────────────────────────
_model = None


def get_model():
    global _model
    if _model is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return None
        genai.configure(api_key=api_key)
        _model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,
                max_output_tokens=1024,
            ),
        )
    return _model


# ── System Prompt ──────────────────────────────────────────────────────────────
SYSTEM_PROMPT = (
    "You are an expert data analyst assistant specialising in "
    "Exploratory Data Analysis (EDA). You help users understand their datasets "
    "through clear, insightful explanations.\n\n"
    "CRITICAL INSTRUCTIONS:\n"
    "- You MUST strictly base all insights, recommendations, and suggested machine learning models "
    "on the exact structure, statistics, datatypes, and columns provided in the dataset snapshot.\n"
    "- DO NOT provide generic machine learning model suggestions. If you suggest a model, you MUST "
    "explicitly name the target column from the dataset it would predict, identify the independent "
    "features it would use, and justify why this specific model is appropriate for the data types "
    "and distributions provided.\n"
    "- Avoid generic filler text. Be highly tailored to the specific dataset at hand.\n"
    "- Use bullet points or short paragraphs for clarity.\n"
    "- Answer concisely and accurately.\n"
    "- If the question is unrelated to the dataset, politely redirect.\n"
)


# ── Core LLM Call ──────────────────────────────────────────────────────────────

def chat_with_eda(
    user_question: str,
    df_snapshot: str,
    conversation_history: list[dict] | None = None,
    model: str = "gemini-1.5-flash",   # kept for API compatibility, ignored
    max_tokens: int = 1024,
    temperature: float = 0.3,
) -> str:
    """
    Send a user question + dataset snapshot to Gemini and return the reply.

    Args:
        user_question:        The user's natural-language question.
        df_snapshot:          Text snapshot of the dataset (from eda_text_snapshot).
        conversation_history: Previous [{"role": ..., "content": ...}] turns.
        model:                Ignored — kept for drop-in compatibility.
        max_tokens:           Max tokens in the reply.
        temperature:          Sampling temperature.

    Returns:
        Assistant reply string.
    """
    gemini = get_model()
    if gemini is None:
        return "AI insights are not available. Please set GEMINI_API_KEY in the .env file."

    history = conversation_history or []

    # Build context message
    context_msg = (
        "Here is a summary of the uploaded dataset:\n\n"
        f"{truncate_text(df_snapshot, max_chars=3000)}\n\n"
        "Now answer the following question based on this dataset."
    )

    # Convert conversation history to Gemini format
    gemini_history = []
    for turn in history:
        role = "user" if turn["role"] == "user" else "model"
        gemini_history.append({"role": role, "parts": [turn["content"]]})

    # Full prompt = system + context + question
    full_prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"{context_msg}\n\n"
        f"Question: {user_question}"
    )

    try:
        chat = gemini.start_chat(history=gemini_history)
        response = chat.send_message(full_prompt)
        return response.text.strip()
    except Exception as exc:
        err = str(exc).lower()
        if "quota" in err or "429" in err or "rate" in err:
            return "⚠️ Gemini quota exceeded. Please check your usage at https://aistudio.google.com or wait a moment."
        if "api_key" in err or "403" in err or "401" in err:
            return "⚠️ Invalid Gemini API key. Please update GEMINI_API_KEY in the backend .env file."
        return f"⚠️ AI analysis unavailable: {exc}"


def auto_insights(df_snapshot: str, model: str = "gemini-1.5-flash") -> str:
    """
    Automatically generate key insights for a dataset without a user question.
    Good for the initial analysis panel.
    """
    gemini = get_model()
    if gemini is None:
        return "AI insights are not available. Please set GEMINI_API_KEY in the .env file."

    prompt = (
        "You are an expert data analyst. Given the following specific dataset summary, "
        "produce 5–7 highly-tailored bullet-point insights covering: data quality, "
        "distributions, correlations, outliers, and dataset-specific recommended next steps.\n"
        "CRITICAL: If you recommend machine learning models, do NOT give generic advice. "
        "You MUST name specific columns as targets, state which specific features to use, "
        "and explain why the data types/patterns make that model suitable.\n\n"
        f"Dataset summary:\n{truncate_text(df_snapshot, max_chars=3000)}"
    )

    try:
        response = gemini.generate_content(prompt)
        return response.text.strip()
    except Exception as exc:
        err = str(exc).lower()
        if "quota" in err or "429" in err or "rate" in err:
            return "⚠️ Gemini quota exceeded. Please check your usage at https://aistudio.google.com or wait a moment."
        if "api_key" in err or "403" in err or "401" in err:
            return "⚠️ Invalid Gemini API key. Please update GEMINI_API_KEY in the backend .env file."
        return f"⚠️ AI insights unavailable: {exc}"


def suggest_visualisations(df_snapshot: str, model: str = "gemini-1.5-flash") -> str:
    """
    Ask Gemini to suggest the most informative visualisations for the dataset.
    """
    gemini = get_model()
    if gemini is None:
        return "AI visualisation suggestions are not available. Please set GEMINI_API_KEY in the .env file."

    prompt = (
        "Based on the dataset summary below, suggest 3–5 specific visualisations "
        "that would be most insightful. For each, state: chart type, columns to use, "
        "and what the analyst would learn from it.\n\n"
        f"Dataset summary:\n{truncate_text(df_snapshot, max_chars=3000)}"
    )

    try:
        response = gemini.generate_content(prompt)
        return response.text.strip()
    except Exception as exc:
        err = str(exc).lower()
        if "quota" in err or "429" in err or "rate" in err:
            return "⚠️ Gemini quota exceeded. Please check your usage at https://aistudio.google.com or wait a moment."
        if "api_key" in err or "403" in err or "401" in err:
            return "⚠️ Invalid Gemini API key. Please update GEMINI_API_KEY in the backend .env file."
        return f"⚠️ AI suggestions unavailable: {exc}"