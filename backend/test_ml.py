import pandas as pd
from fastapi.testclient import TestClient
from app import app, _session
import io

client = TestClient(app)

def test_ml_endpoint():
    # Create dummy dataframe
    print("Creating dummy dataframe...")
    df = pd.DataFrame({
        "feature_1": [1.2, 3.4, 5.6, 7.8, 9.0] * 4,
        "feature_2": ["A", "B", "A", "B", "C"] * 4,
        "target": [0, 1, 0, 1, 0] * 4
    })
    
    # upload
    csv_bytes = df.to_csv(index=False).encode('utf-8')
    res = client.post("/upload", files={"file": ("dummy.csv", io.BytesIO(csv_bytes), "text/csv")})
    print("Upload status:", res.status_code)
    
    # test classification
    res = client.post("/ml/train", json={"target_column": "target"})
    print("ML Train status (Classification):", res.status_code)
    try:
        print("Response:", res.json())
    except:
        print("Response Text:", res.text)
        
    # test regression
    df = pd.DataFrame({
        "feature_1": [1.2, 3.4, 5.6, 7.8, 9.0] * 4,
        "feature_2": [2.3, 4.5, 6.7, 8.9, 1.0] * 4,
        "target": [10.5, 20.2, 30.1, 40.5, 50.9] * 4
    })
    csv_bytes_reg = df.to_csv(index=False).encode('utf-8')
    client.post("/upload", files={"file": ("dummy_reg.csv", io.BytesIO(csv_bytes_reg), "text/csv")})
    
    res = client.post("/ml/train", json={"target_column": "target"})
    print("\nML Train status (Regression):", res.status_code)
    try:
        print("Response:", res.json())
    except:
        print("Response Text:", res.text)

if __name__ == "__main__":
    test_ml_endpoint()
