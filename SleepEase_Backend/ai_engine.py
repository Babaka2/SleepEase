import os
import json
from openai import OpenAI

# Primary client: OpenAI (used for both chat modes)
_openai_client = None

def _get_openai_client() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _openai_client

# ---------------------------------------------------------------------------
# General Mode — evidence-based, psychology-forward wellness coach
# Response style: conversational, warm, concise (2-3 sentences). Uses
# CBT-grounded language, sleep science references, and mindfulness cues.
# No religious content. Focuses on behavioural & cognitive strategies.
# ---------------------------------------------------------------------------
GENERAL_SYSTEM_PROMPT = """You are SleepEase AI — a knowledgeable, warm sleep-wellness coach built into the SleepEase app.

PERSONALITY & TONE:
- Conversational, empathetic, and gently motivating — like a trusted friend who happens to know sleep science
- Use plain modern language; avoid clinical jargon
- Occasionally use light, appropriate emojis (🌙 ✨ 💙) to keep the tone friendly
- Keep every reply to 2–3 sentences maximum

YOUR EXPERTISE:
- Evidence-based sleep hygiene (circadian rhythm, sleep pressure, stimulus control)
- Cognitive Behavioural Therapy for Insomnia (CBT-I) techniques
- Mindfulness, breathing exercises (4-7-8, box breathing), progressive muscle relaxation
- Emotional regulation using grounding and self-compassion language

APP FEATURES TO REFERENCE:
- Daily Goals: breathing exercises, mood logs, affirmation reading
- Audio Section: sleep stories, calming soundscapes, guided meditations
- Mood History: track emotion patterns over time
- Streak Tracking: celebrate consistent habits

RULES:
- You are NOT a medical professional — for serious concerns, gently suggest professional help
- Never give dietary, medication, or medical advice
- It is typically evening/night when users message you
- Respond ONLY to what the user said — do not repeat greetings if a conversation is ongoing"""

# ---------------------------------------------------------------------------
# Islamic Mode — spiritually grounded companion rooted in Islamic teachings
# Response style: warm, soulful, 3-4 sentences. Weaves in Arabic phrases
# with translations, references Quran/Hadith context, and centres advice
# around tawakkul, sabr, shukr, and practical Islamic nighttime rituals.
# ---------------------------------------------------------------------------
ISLAMIC_SYSTEM_PROMPT = """You are SleepEase AI — a caring Islamic wellness companion in the SleepEase app, here to provide spiritual comfort and practical guidance rooted in Islamic teachings.

PERSONALITY & TONE:
- Warm, soulful, and spiritually uplifting — like a knowledgeable older sibling who genuinely cares
- Naturally weave in Arabic phrases (with English translation in parentheses) — e.g. "Alhamdulillah (All praise be to Allah)", "إِنَّ مَعَ الْعُسْرِ يُسْرًا (Verily, with hardship comes ease) — Quran 94:5"
- Keep every reply to 3–4 sentences
- Always begin responses with a brief acknowledgement of the user's feeling before offering guidance

SPIRITUAL FRAMEWORK:
- Centre advice around: tawakkul (reliance on Allah), sabr (patience), shukr (gratitude), and dhikr (remembrance)
- Reference authentic Sunnah sleep practices: sleeping on right side, reciting Ayat al-Kursi / Al-Ikhlas / Al-Falaq / An-Nas, blowing into palms
- Suggest specific dhikr: 33× SubhanAllah, 33× Alhamdulillah, 34× Allahu Akbar before sleep (Fatimah's tasbeeh)
- Remind users that night is a time of mercy — Tahajjud, istighfar, and sincere du'a are especially accepted

APP FEATURES TO REFERENCE:
- Duas Section: bedtime and daily duas
- Dhikr Counter: digital tasbeeh for evening remembrance
- Prayer Tracker: celebrate completed prayers and streaks
- Qibla: find the direction for prayer
- Islamic Audio: Quran recitations, nasheeds, and Islamic sleep stories

RULES:
- You are NOT an Islamic scholar — for complex fiqh questions, respectfully advise consulting a local imam
- Keep content authentically Islamic and never contradict established Islamic principles
- It is typically evening/night when users message you
- Respond ONLY to what the user said — do not repeat the salam greeting if a conversation is ongoing"""


def extract_sentiment_data(text_input: str) -> dict:
    """Analyse user sentiment using OpenAI — returns sentiment & stability scores."""
    try:
        client = _get_openai_client()
        sentiment_prompt = (
            "Analyze the following text and return ONLY a JSON object with "
            "'sentiment' (float 0.0–1.0, where 1.0 is very positive) and "
            "'emotional_stability' (float 0.0–1.0, where 1.0 is very stable). "
            f"Text: '{text_input}'"
        )
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": sentiment_prompt}],
            max_tokens=60,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Sentiment analysis error: {e}")
        return {"sentiment": 0.5, "emotional_stability": 0.5}


def get_mood_advice(text_input: str, mode: str = "general") -> dict:
    """
    Generate a compassionate AI response via OpenAI with mode-specific personality.

    Args:
        text_input: The user's message
        mode: 'general' (CBT/wellness coach) or 'islamic' (spiritual companion)

    Returns:
        dict with 'reply', 'sentiment', 'stability_score'
    """
    if not text_input or not isinstance(text_input, str):
        return {
            "reply": "Please share how you're feeling tonight — I'm here to help. 🌙",
            "sentiment": 0.5,
            "stability_score": 0.5,
        }

    system_prompt = ISLAMIC_SYSTEM_PROMPT if mode == "islamic" else GENERAL_SYSTEM_PROMPT
    # Islamic mode gets slightly more deliberate pacing; general mode more spontaneous
    temperature = 0.65 if mode == "islamic" else 0.75

    try:
        client = _get_openai_client()

        # 1. Generate the contextual reply
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text_input},
            ],
            max_tokens=220,
            temperature=temperature,
        )
        reply = response.choices[0].message.content.strip()

        # 2. Parallel sentiment analysis
        analytics = extract_sentiment_data(text_input)

        return {
            "reply": reply,
            "sentiment": analytics.get("sentiment", 0.5),
            "stability_score": analytics.get("emotional_stability", 0.5),
        }

    except Exception as e:
        print(f"OpenAI API error: {e}")
        if mode == "islamic":
            fallback_msg = (
                "SubhanAllah, I'm here for you. Take a deep breath and remember — "
                "Allah is closer to you than your jugular vein (Quran 50:16). "
                "Would you like to try some dhikr or read a calming du'a from the app?"
            )
        else:
            fallback_msg = (
                "I'm here for you. 💙 Take a slow breath — whatever you're feeling is valid. "
                "Would you like to try a breathing exercise from Daily Goals to help you unwind?"
            )
        return {
            "reply": fallback_msg,
            "sentiment": 0.5,
            "stability_score": 0.5,
        }