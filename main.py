import nltk
nltk.download('punkt_tab')
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import db
from firebase_admin import auth, firestore

from datetime import datetime
# --- IMPORT AYHAM'S AI ENGINE (Added) ---
from ai_engine import get_mood_advice 

app = FastAPI()

# CORS for web + Capacitor mobile WebView origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://127.0.0.1",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "capacitor://localhost",
        "ionic://localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Data Models ---
class UserSchema(BaseModel):
    email: str
    password: str
    username: str
    mode: str = "General"

class LoginSchema(BaseModel):
    email: str
    password: str

class SleepSchema(BaseModel):
    user_id: str
    hours: float
    quality: int  # Scale 1-10
    mood: str     # "Happy", "Anxious", etc.
    date: str     # YYYY-MM-DD

class GratitudeSchema(BaseModel):
    user_id: str
    content: str
    date: str  # YYYY-MM-DD

# --- NEW: Chat Model (Added) ---
class ChatSchema(BaseModel):
    message: str
    mode: str = "general"

# --- Root Endpoint ---
@app.get("/")
def root():
    return {"message": "SleepEase Backend is Running"}

# --- Auth Endpoints ---
@app.post("/auth/register")
def register_user(user: UserSchema):
    try:
        user_record = auth.create_user(
            email=user.email,
            password=user.password,
            display_name=user.username
        )
        user_data = {
            "userID": user_record.uid,
            "email": user.email,
            "username": user.username,
            "mode": user.mode,
            "streak_count": 0,
            "last_sleep_date": None,
            "created_at": firestore.SERVER_TIMESTAMP
        }
        db.collection("users").document(user_record.uid).set(user_data)
        return {"status": "success", "uid": user_record.uid, "message": "User registered successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/auth/login")
def login_user(user: LoginSchema):
    try:
        user_record = auth.get_user_by_email(user.email)
        return {"status": "success", "uid": user_record.uid, "message": "Login successful"}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid Credentials")

# --- Sleep Endpoints (With Streaks & Mood) ---
@app.post("/sleep/add")
def add_sleep_entry(entry: SleepSchema):
    try:
        sleep_data = {
            "user_id": entry.user_id,
            "hours": entry.hours,
            "quality": entry.quality,
            "mood": entry.mood,   
            "date": entry.date,
            "created_at": firestore.SERVER_TIMESTAMP
        }
        db.collection("sleep_logs").add(sleep_data)
        
        # Streak Logic
        user_ref = db.collection("users").document(entry.user_id)
        user_doc = user_ref.get()
        if user_doc.exists:
            user_info = user_doc.to_dict()
            current_streak = user_info.get("streak_count", 0)
            last_date_str = user_info.get("last_sleep_date")
            
            entry_date = datetime.strptime(entry.date, "%Y-%m-%d").date()
            
            if last_date_str:
                last_date = datetime.strptime(last_date_str, "%Y-%m-%d").date()
                delta = (entry_date - last_date).days
                
                if delta == 1:
                    current_streak += 1
                elif delta > 1:
                    current_streak = 1
                
                if delta > 0: 
                     user_ref.update({"streak_count": current_streak, "last_sleep_date": entry.date})
            else:
                user_ref.update({"streak_count": 1, "last_sleep_date": entry.date})
        
        return {"status": "success", "message": "Sleep & Mood data saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/sleep/history")
def get_sleep_history(user_id: str):
    try:
        docs = db.collection("sleep_logs").where("user_id", "==", user_id).stream()
        history = []
        for doc in docs:
            data = doc.to_dict()
            if "created_at" in data: data["created_at"] = str(data["created_at"])
            history.append(data)
        return {"status": "success", "data": history}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- Gratitude Endpoints ---
@app.post("/gratitude/add")
def add_gratitude_entry(entry: GratitudeSchema):
    try:
        gratitude_data = {
            "user_id": entry.user_id,
            "content": entry.content,
            "date": entry.date,
            "created_at": firestore.SERVER_TIMESTAMP
        }
        db.collection("gratitude_logs").add(gratitude_data)
        return {"status": "success", "message": "Gratitude note saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/gratitude/list")
def get_gratitude_list(user_id: str):
    try:
        docs = db.collection("gratitude_logs").where("user_id", "==", user_id).stream()
        notes = []
        for doc in docs:
            data = doc.to_dict()
            if "created_at" in data: data["created_at"] = str(data["created_at"])
            notes.append(data)
        return {"status": "success", "data": notes}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- AI ENDPOINTS ---
def _chat_response(chat: ChatSchema):
    try:
        ai_response = get_mood_advice(chat.message, chat.mode)
        return {"status": "success", "reply": ai_response}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/ai/chat")
def legacy_chat_with_ai(chat: ChatSchema):
    return _chat_response(chat)


@app.post("/chat")
def chat_with_ai(chat: ChatSchema):
    return _chat_response(chat)

# --- Admin Export (For Salman/Analytics) ---
@app.get("/admin/export_data")
def export_data_for_analytics(admin_secret: str = Header(None)):
    try:
        if admin_secret != "SleepEase_Admin_2026":
            raise HTTPException(status_code=403, detail="Access Denied")

        users_ref = db.collection("users").stream()
        sleep_ref = db.collection("sleep_logs").stream()
        gratitude_ref = db.collection("gratitude_logs").stream()

        data = {
            "users": [],
            "sleep_logs": [],
            "gratitude_logs": []
        }

        for doc in users_ref:
            d = doc.to_dict()
            if "created_at" in d: d["created_at"] = str(d["created_at"])
            data["users"].append(d)

        for doc in sleep_ref:
            d = doc.to_dict()
            if "created_at" in d: d["created_at"] = str(d["created_at"])
            data["sleep_logs"].append(d)

        for doc in gratitude_ref:
            d = doc.to_dict()
            if "created_at" in d: d["created_at"] = str(d["created_at"])
            data["gratitude_logs"].append(d)
        
        return {"status": "success", "data": data}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))