"""
ml_trainer.py — Simple ML Model training engine for AUTO LLM + EDA
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import LabelEncoder, OrdinalEncoder
from sklearn.metrics import accuracy_score, f1_score, mean_squared_error, r2_score
from utils import safe_json

def train_model(df: pd.DataFrame, target_column: str) -> dict:
    """
    Trains a Random Forest model on the given dataset to predict target_column.
    Automatically infers if the task is classification or regression.
    """
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in the dataset.")

    # Drop rows where target is missing
    df_clean = df.dropna(subset=[target_column]).copy()
    if len(df_clean) < 10:
        raise ValueError("Not enough data to train a model after dropping missing targets.")

    X = df_clean.drop(columns=[target_column])
    y = df_clean[target_column]

    # Determine task type
    is_classification = False
    if y.dtype == object or y.dtype.name == 'category' or y.dtype == bool:
        is_classification = True
    elif y.nunique() < 15: # Assuming few unique numeric values is classification
        is_classification = True

    task_type = "classification" if is_classification else "regression"

    # Encoding target if classification
    if is_classification:
        le = LabelEncoder()
        y = le.fit_transform(y)

    # Preprocess X (impute & encode)
    numeric_cols = X.select_dtypes(include=np.number).columns
    categorical_cols = X.select_dtypes(exclude=np.number).columns

    if len(numeric_cols) > 0:
        num_imputer = SimpleImputer(strategy="median")
        X.loc[:, numeric_cols] = num_imputer.fit_transform(X[numeric_cols])

    if len(categorical_cols) > 0:
        cat_imputer = SimpleImputer(strategy="most_frequent")
        X.loc[:, categorical_cols] = cat_imputer.fit_transform(X[categorical_cols])
        
        encoder = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
        X.loc[:, categorical_cols] = encoder.fit_transform(X[categorical_cols])

    # Ensure all column names are strings
    X.columns = [str(c) for c in X.columns]

    # Train-test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Train model
    if is_classification:
        model = RandomForestClassifier(n_estimators=100, random_state=42)
    else:
        model = RandomForestRegressor(n_estimators=100, random_state=42)

    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    # Evaluate
    metrics = {}
    if is_classification:
        metrics["accuracy"] = round(accuracy_score(y_test, y_pred), 4)
        if len(np.unique(y)) > 2:
            metrics["f1_score"] = round(f1_score(y_test, y_pred, average="weighted"), 4)
        else:
            metrics["f1_score"] = round(f1_score(y_test, y_pred, average="binary"), 4)
    else:
        metrics["rmse"] = round(float(np.sqrt(mean_squared_error(y_test, y_pred))), 4)
        metrics["r2_score"] = round(r2_score(y_test, y_pred), 4)

    # Feature Importances
    importances = model.feature_importances_
    feat_imp = pd.DataFrame({"feature": X.columns, "importance": importances})
    feat_imp = feat_imp.sort_values(by="importance", ascending=False).head(10)
    top_features = feat_imp.to_dict(orient="records")

    return safe_json({
        "target_column": target_column,
        "task_type": task_type,
        "metrics": metrics,
        "top_features": top_features,
        "dataset_size": len(df_clean)
    })
