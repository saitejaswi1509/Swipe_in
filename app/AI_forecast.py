import requests
import pandas as pd
import numpy as np
from datetime import timedelta
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dropout, Dense
from tensorflow.keras.models import save_model

# Step 1: Fetch data from /transactions/
res = requests.get("http://127.0.0.1:8081/transactions/")
data = res.json()

# Step 2: Prepare DataFrame
df = pd.DataFrame(data)
df["transaction_date"] = pd.to_datetime(df["transaction_date"])
df = df.groupby(df["transaction_date"].dt.date).agg({
    "Total_Amount": "sum",
    "transaction_id": "count"  # Or any unique field to count transactions
}).reset_index()
df.columns = ["date", "total_spent", "transaction_count"]

# Step 3: Normalize
scaler_spent = MinMaxScaler()
scaler_count = MinMaxScaler()
df["spent_scaled"] = scaler_spent.fit_transform(df[["total_spent"]])
df["count_scaled"] = scaler_count.fit_transform(df[["transaction_count"]])

# Step 4: Sequence creation
SEQ_LEN = 7
def create_seq(data):
    X, y = [], []
    for i in range(len(data) - SEQ_LEN):
        X.append(data[i:i+SEQ_LEN])
        y.append(data[i+SEQ_LEN])
    return np.array(X), np.array(y)

X_spent, y_spent = create_seq(df["spent_scaled"].values)
X_count, y_count = create_seq(df["count_scaled"].values)
X_spent = np.expand_dims(X_spent, axis=2)
X_count = np.expand_dims(X_count, axis=2)

# Step 5: Train/Test split (97/3)
split = int(len(X_spent) * 0.97)
X_spent_train, X_spent_test = X_spent[:split], X_spent[split:]
y_spent_train, y_spent_test = y_spent[:split], y_spent[split:]

# Step 6: LSTM Model
model_spent = Sequential([
    LSTM(64, activation='tanh', return_sequences=True, input_shape=(SEQ_LEN, 1)),
    Dropout(0.3),
    LSTM(32, activation='relu'),
    Dropout(0.2),
    Dense(1)
])
model_spent.compile(optimizer='adam', loss='mse')
model_spent.fit(X_spent_train, y_spent_train, epochs=30, batch_size=8, validation_data=(X_spent_test, y_spent_test))

# Step 7: Predict next 7 days
last_seq = df["spent_scaled"].values[-SEQ_LEN:]
predictions = []
current = last_seq.copy()
for _ in range(7):
    pred = model_spent.predict(np.expand_dims(current, axis=(0, 2)))[0][0]
    predictions.append(pred)
    current = np.append(current[1:], pred)

# Step 8: Convert to dollars
predicted_dollars = scaler_spent.inverse_transform(np.array(predictions).reshape(-1, 1)).flatten()

# Step 9: Save model (optional for API serving)
save_model(model_spent, "lstm_spent_model.h5")

# Step 10: Print forecast
last_date = pd.to_datetime(df["date"].max())
for i, val in enumerate(predicted_dollars, 1):
    print(f"{last_date + timedelta(days=i)}: Predicted Spend = ${val:.2f}")