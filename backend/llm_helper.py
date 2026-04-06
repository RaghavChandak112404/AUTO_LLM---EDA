"""
llm_helper.py — LLM integration (Google Gemini) for AUTO LLM + EDA
"""

import os
import time
from dotenv import load_dotenv

from eda import eda_text_snapshot
from utils import truncate_text

_client = None

OLLAMA_MODEL = "llama3"
MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds (doubles each retry)
MIN_CALL_GAP = 2.5  # minimum seconds between Gemini API calls

# ── Rate Limiter ──────────────────────────────────────────────────────────────
import threading
_last_call_time = 0.0
_rate_lock = threading.Lock()

def _rate_limit():
    """Enforce a minimum gap between consecutive Gemini API calls."""
    global _last_call_time
    with _rate_lock:
        now = time.time()
        wait = MIN_CALL_GAP - (now - _last_call_time)
        if wait > 0:
            time.sleep(wait)
        _last_call_time = time.time()



def get_client():
    global _client
    if _client is None:
        try:
            from dotenv import load_dotenv
            from openai import OpenAI
            import os

            load_dotenv()
            global OLLAMA_MODEL
            OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")

            _client = OpenAI(
                base_url="http://localhost:11434/v1",
                api_key="ollama", # required but ignored
            )
        except Exception as e:
            print("❌ Ollama init error:", e)
            return None

    return _client

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


# ── Retry Helper ─────────────────────────────────────────────────────────────

def _call_with_retry(fn, *args, **kwargs):
    """
    Call an Ollama API function. Retries if connection fails.
    """
    delay = RETRY_DELAY
    for attempt in range(MAX_RETRIES):
        try:
            return fn(*args, **kwargs)
        except Exception as exc:
            err = str(exc).lower()
            is_retryable = "connection" in err or "503" in err or "timeout" in err
            if is_retryable and attempt < MAX_RETRIES - 1:
                print(f"⚠️ Ollama connection issue. Retrying in {delay}s... (attempt {attempt + 1}/{MAX_RETRIES})")
                time.sleep(delay)
                delay *= 2  # exponential backoff
            else:
                raise  # re-raise on last attempt or other errors


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
    client = get_client()
    if client is None:
        return "AI insights are not available. Please ensure Ollama is running and OLLAMA_MODEL is set."

    history = conversation_history or []

    # Build context message
    context_msg = (
        "Here is a summary of the uploaded dataset:\n\n"
        f"{truncate_text(df_snapshot, max_chars=3000)}\n\n"
        "Now answer the following question based on this dataset."
    )

    # Convert conversation history to OpenAI format
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": context_msg}
    ]

    for turn in history:
        role = "user" if turn["role"] == "user" else "assistant"
        messages.append({"role": role, "content": turn["content"]})
        
    messages.append({"role": "user", "content": user_question})

    try:
        response = _call_with_retry(
            client.chat.completions.create,
            model=OLLAMA_MODEL,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        return response.choices[0].message.content.strip()
    except Exception as exc:
        err = str(exc).lower()
        if "connection" in err:
            return "⚠️ Cannot connect to Ollama. Is it running on http://localhost:11434?"
        return f"⚠️ AI analysis unavailable: {exc}"


def auto_insights(df_snapshot: str, model: str = "gemini-1.5-flash") -> str:
    """
    Automatically generate key insights for a dataset without a user question.
    Good for the initial analysis panel.
    """
    client = get_client()
    if client is None:
        return "AI insights are not available. Please ensure Ollama is running and OLLAMA_MODEL is set."

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
        response = _call_with_retry(
            client.chat.completions.create,
            model=OLLAMA_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )
        return response.choices[0].message.content.strip()
    except Exception as exc:
        err = str(exc).lower()
        if "connection" in err:
            return "⚠️ Cannot connect to Ollama. Is it running on http://localhost:11434?"
        return f"⚠️ AI insights unavailable: {exc}"


def suggest_visualisations(df_snapshot: str, model: str = "gemini-1.5-flash") -> str:
    """
    Ask Gemini to suggest the most informative visualisations for the dataset.
    """
    client = get_client()
    if client is None:
        return "AI visualisation suggestions are not available. Please ensure Ollama is running and OLLAMA_MODEL is set."

    prompt = (
        "Based on the dataset summary below, suggest 3–5 specific visualisations "
        "that would be most insightful. For each, state: chart type, columns to use, "
        "and what the analyst would learn from it.\n\n"
        f"Dataset summary:\n{truncate_text(df_snapshot, max_chars=3000)}"
    )

    try:
        response = _call_with_retry(
            client.chat.completions.create,
            model=OLLAMA_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )
        return response.choices[0].message.content.strip()
    except Exception as exc:
        err = str(exc).lower()
        if "connection" in err:
            return "⚠️ Cannot connect to Ollama. Is it running on http://localhost:11434?"
        return f"⚠️ AI suggestions unavailable: {exc}"


def ml_recommendations(df_snapshot: str) -> dict:
    """
    Generate dataset-specific ML model recommendations and preprocessing steps.
    Returns a dict with 'models' and 'preprocessing' keys, each containing
    tailored markdown text derived from the actual dataset structure.
    """
    client = get_client()
    if client is None:
        return {
            "models": "AI recommendations are not available. Please ensure Ollama is running and OLLAMA_MODEL is set.",
            "preprocessing": "AI recommendations are not available. Please ensure Ollama is running and OLLAMA_MODEL is set.",
        }

    models_prompt = (
        "You are an expert data scientist. Based ONLY on the exact dataset summary below, "
        "recommend the most suitable ML models to apply. You MUST:\n"
        "- Name 2-4 specific models appropriate for this exact dataset.\n"
        "- For each model, explicitly state: which column(s) to use as the target, "
        "which columns to use as features, and WHY this model fits the data types and distributions shown.\n"
        "- Do NOT give generic advice. Be specific to these exact column names and statistics.\n"
        "- Use markdown bullet points.\n\n"
        f"Dataset summary:\n{truncate_text(df_snapshot, max_chars=3000)}"
    )

    preprocessing_prompt = (
        "You are an expert data scientist. Based ONLY on the exact dataset summary below, "
        "provide specific preprocessing steps needed BEFORE training an ML model on this data. You MUST:\n"
        "- Reference specific column names from this dataset when suggesting steps.\n"
        "- Address missing value handling for the columns that actually have missing values.\n"
        "- Suggest encoding strategies for the actual categorical columns present.\n"
        "- Mention scaling needs based on the numeric column ranges/distributions shown.\n"
        "- Mention outlier handling for columns that are flagged as skewed or have outliers.\n"
        "- Do NOT give generic advice. Be specific to this exact dataset.\n"
        "- Use markdown bullet points.\n\n"
        f"Dataset summary:\n{truncate_text(df_snapshot, max_chars=3000)}"
    )

    def _call(prompt: str, fallback: str) -> str:
        try:
            response = _call_with_retry(
                client.chat.completions.create,
                model=OLLAMA_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
            return response.choices[0].message.content.strip()
        except Exception as exc:
            err = str(exc).lower()
            if "connection" in err:
                return "⚠️ Cannot connect to Ollama. Is it running on http://localhost:11434?"
            return f"⚠️ {fallback}: {exc}"

    return {
        "models": _call(models_prompt, "ML model recommendations unavailable"),
        "preprocessing": _call(preprocessing_prompt, "Preprocessing recommendations unavailable"),
    }


def generate_code_snippet(df_snapshot: str) -> str:
    """
    Ask Gemini to generate a ready-to-use Python EDA + ML code snippet
    tailored specifically to this dataset's columns and structure.
    """
    client = get_client()
    if client is None:
        return "AI code generation is not available. Please ensure Ollama is running and OLLAMA_MODEL is set."

    prompt = (
        "You are an expert Python data scientist. Based ONLY on the dataset summary below, "
        "write a complete, ready-to-run Python code snippet that:\n"
        "1. Loads the CSV file with pandas.\n"
        "2. Performs basic EDA (shape, dtypes, describe, missing values) using the ACTUAL column names.\n"
        "3. Applies appropriate preprocessing steps specific to this dataset's columns "
        "(handle the actual missing columns, encode the actual categorical columns, scale numerics if needed).\n"
        "4. Trains the most appropriate ML model for this dataset on a sensible target column, "
        "using the actual column names as features.\n"
        "5. Evaluates and prints the model's performance.\n\n"
        "CRITICAL RULES:\n"
        "- Use ONLY the actual column names found in the dataset summary below.\n"
        "- Choose the target column intelligently based on the dataset context.\n"
        "- Add brief inline comments explaining each step.\n"
        "- Output ONLY the Python code block, no prose around it.\n\n"
        f"Dataset summary:\n{truncate_text(df_snapshot, max_chars=3000)}"
    )

    try:
        response = _call_with_retry(
            client.chat.completions.create,
            model=OLLAMA_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )
        text = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            lines = text.split("\n")
            # Remove first and last fence lines
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        return text
    except Exception as exc:
        err = str(exc).lower()
        if "connection" in err:
            return "# ⚠️ Cannot connect to Ollama. Is it running on http://localhost:11434?"
        return f"# ⚠️ Code generation unavailable: {exc}"