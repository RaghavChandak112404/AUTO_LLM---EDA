"""
app_gradio.py — Gradio interface for AUTO LLM + EDA
Run with: python app_gradio.py
"""
print("Starting Gradio App...")
import io
import base64
import gradio as gr
import pandas as pd

from utils import is_allowed_file, load_dataframe
from eda import full_eda_report, eda_text_snapshot, basic_summary, missing_value_analysis
from visualization import (
    correlation_heatmap,
    missing_value_chart,
    all_numeric_distributions,
    distribution_plots,
    categorical_bar,
)
from llm_helper import chat_with_eda, auto_insights

import plotly.io as pio
import json

# ── Global state ───────────────────────────────────────────────────────────
_state: dict = {"df": None, "snapshot": None, "history": []}


# ── Helpers ────────────────────────────────────────────────────────────────

def _base64_to_pil(b64_str: str):
    """Convert base64 PNG string → PIL Image for Gradio."""
    from PIL import Image
    img_bytes = base64.b64decode(b64_str)
    return Image.open(io.BytesIO(img_bytes))


def _plotly_json_to_fig(json_str: str):
    """Convert Plotly JSON string back to a Figure for Gradio."""
    return pio.from_json(json_str)


# ── Callbacks ──────────────────────────────────────────────────────────────

def upload_dataset(file):
    if file is None:
        return "⚠️ No file uploaded.", gr.update(choices=[]), gr.update(choices=[])

    filename = file.name
    with open(filename, "rb") as f:
        file_bytes = f.read()

    if not is_allowed_file(filename):
        return "❌ Unsupported file type. Use CSV, Excel, JSON, or Parquet.", gr.update(choices=[]), gr.update(choices=[])

    try:
        df = load_dataframe(file_bytes, filename)
    except ValueError as e:
        return f"❌ Error loading file: {e}", gr.update(choices=[]), gr.update(choices=[])

    _state["df"] = df
    _state["snapshot"] = eda_text_snapshot(df)
    _state["history"] = []

    summary = basic_summary(df)
    mv = missing_value_analysis(df)
    num_cols = [c for c, t in summary["column_types"].items() if t == "numeric"]
    cat_cols = [c for c, t in summary["column_types"].items() if t == "categorical"]

    info = (
        f"✅ **{filename}** loaded successfully!\n\n"
        f"- **Rows:** {summary['shape']['rows']:,}\n"
        f"- **Columns:** {summary['shape']['columns']}\n"
        f"- **Numeric columns:** {len(num_cols)}\n"
        f"- **Categorical columns:** {len(cat_cols)}\n"
        f"- **Overall completeness:** {mv['overall_completeness_pct']}%\n"
    )
    all_cols = df.columns.tolist()
    return info, gr.update(choices=num_cols, value=num_cols[0] if num_cols else None), gr.update(choices=all_cols, value=all_cols[0] if all_cols else None)


def get_correlation_chart():
    if _state["df"] is None:
        return None
    result = correlation_heatmap(_state["df"])
    if "error" in result:
        return None
    return _plotly_json_to_fig(result["data"])


def get_missing_chart():
    if _state["df"] is None:
        return None
    result = missing_value_chart(_state["df"])
    return _plotly_json_to_fig(result["data"])


def get_distributions_chart():
    if _state["df"] is None:
        return None
    result = all_numeric_distributions(_state["df"])
    if "error" in result:
        return None
    return _base64_to_pil(result["data"])


def get_column_distribution(column):
    if _state["df"] is None or not column:
        return None
    result = distribution_plots(_state["df"], column)
    if "error" in result:
        return None
    return _base64_to_pil(result["data"])


def get_categorical_chart(column):
    if _state["df"] is None or not column:
        return None
    result = categorical_bar(_state["df"], column)
    if "error" in result:
        return None
    return _plotly_json_to_fig(result["data"])


def get_auto_insights():
    if _state["df"] is None:
        return "⚠️ Please upload a dataset first."
    try:
        return auto_insights(_state["snapshot"])
    except Exception as e:
        return f"❌ LLM Error: {e}"


def chat(user_message, history):
    if _state["df"] is None:
        return history + [{"role": "assistant", "content": "⚠️ Please upload a dataset first."}]
    if not user_message.strip():
        return history

    try:
        reply = chat_with_eda(
            user_question=user_message,
            df_snapshot=_state["snapshot"],
            conversation_history=_state["history"],
        )
    except Exception as e:
        reply = f"❌ LLM Error: {e}"

    _state["history"].append({"role": "user", "content": user_message})
    _state["history"].append({"role": "assistant", "content": reply})
    _state["history"] = _state["history"][-20:]

    new_history = history + [
        {"role": "user", "content": user_message},
        {"role": "assistant", "content": reply},
    ]
    return new_history


def clear_chat():
    _state["history"] = []
    return []


# ── UI Layout ──────────────────────────────────────────────────────────────

with gr.Blocks(title="AUTO LLM + EDA", theme=gr.themes.Soft()) as demo:
    gr.Markdown("""
    # 🔍 AUTO LLM + EDA Assistant
    **Upload a dataset and explore it with AI-powered Exploratory Data Analysis.**
    """)

    # ── Upload Tab ───────────────────────────────────────────────────────
    with gr.Tab("📂 Upload & Summary"):
        with gr.Row():
            file_input = gr.File(label="Upload Dataset (CSV, Excel, JSON, Parquet)")
            upload_btn = gr.Button("Analyse", variant="primary")

        upload_status = gr.Markdown()
        num_col_dropdown = gr.Dropdown(label="Numeric column (for distribution)", choices=[])
        cat_col_dropdown = gr.Dropdown(label="Any column (for categorical chart)", choices=[])

        upload_btn.click(
            fn=upload_dataset,
            inputs=[file_input],
            outputs=[upload_status, num_col_dropdown, cat_col_dropdown],
        )

    # ── Charts Tab ───────────────────────────────────────────────────────
    with gr.Tab("📊 Charts"):
        with gr.Row():
            gr.Button("Correlation Heatmap").click(get_correlation_chart, outputs=gr.Plot())
            gr.Button("Missing Values").click(get_missing_chart, outputs=gr.Plot())

        corr_plot = gr.Plot(label="Correlation Heatmap")
        missing_plot = gr.Plot(label="Missing Values")

        with gr.Row():
            dist_btn = gr.Button("All Distributions")
            col_dist_btn = gr.Button("Column Distribution")

        dist_img = gr.Image(label="Distributions")
        col_dist_img = gr.Image(label="Column Distribution")
        cat_plot = gr.Plot(label="Categorical Distribution")

        dist_btn.click(get_distributions_chart, outputs=dist_img)
        col_dist_btn.click(get_column_distribution, inputs=num_col_dropdown, outputs=col_dist_img)
        cat_col_dropdown.change(get_categorical_chart, inputs=cat_col_dropdown, outputs=cat_plot)

    # ── Insights Tab ─────────────────────────────────────────────────────
    with gr.Tab("💡 Auto Insights"):
        insights_btn = gr.Button("Generate AI Insights", variant="primary")
        insights_output = gr.Markdown()
        insights_btn.click(get_auto_insights, outputs=insights_output)

    # ── Chat Tab ─────────────────────────────────────────────────────────
    with gr.Tab("💬 Chat with Data"):
        chatbot = gr.Chatbot(type="messages", height=450)
        with gr.Row():
            chat_input = gr.Textbox(
                placeholder="Ask anything about your dataset…",
                show_label=False,
                scale=8,
            )
            send_btn = gr.Button("Send", variant="primary", scale=1)
            clear_btn = gr.Button("Clear", scale=1)

        send_btn.click(chat, inputs=[chat_input, chatbot], outputs=chatbot)
        chat_input.submit(chat, inputs=[chat_input, chatbot], outputs=chatbot)
        clear_btn.click(clear_chat, outputs=chatbot)

print("Launching UI...")
if __name__ == "__main__":
    demo.launch(server_port=7860, share=True)