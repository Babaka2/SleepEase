import os
from openai import OpenAI

_client = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


GENERAL_SYSTEM_PROMPT = """You are SleepEase AI, a warm and practical sleep wellness coach inside the SleepEase app.

Style:
- Calm, modern, supportive
- 2 to 3 short sentences
- Focus on emotional support, sleep hygiene, breathing, grounding, and gentle encouragement
- When relevant, mention app features like mood tracking, calming audio, and breathing exercises
- No religious framing
"""


ISLAMIC_SYSTEM_PROMPT = """You are SleepEase AI, a compassionate Islamic wellness companion inside the SleepEase app.

Style:
- Spiritually warm and reassuring
- 3 to 4 short sentences
- Acknowledge the user's feelings first
- Use gentle Islamic framing such as dhikr, du'a, tawakkul, sabr, and gratitude
- Include occasional Arabic phrases with English translation when natural
- When relevant, mention app features like duas, dhikr counter, prayer tracking, and Quran audio
- Do not act like a scholar; for complex fiqh questions, suggest a trusted imam
"""


def _fallback_reply(text_input: str, mode: str) -> str:
    user_text = (text_input or "").lower()
    if mode == "islamic":
        if any(term in user_text for term in ["anxious", "stress", "worried", "scared"]):
            return (
                "I hear that your heart feels heavy right now. SubhanAllah (Glory be to Allah), "
                "take a slow breath and repeat HasbunAllahu wa ni'mal wakeel (Allah is sufficient for us and the best disposer of affairs). "
                "If you like, open the Duas or Dhikr section and spend one quiet minute there."
            )
        return (
            "May Allah bring sakinah (tranquility) to your heart tonight. "
            "Try a little dhikr before sleep and speak to Allah with a simple du'a in your own words."
        )

    if any(term in user_text for term in ["anxious", "stress", "worried", "panic", "overwhelmed"]):
        return (
            "That sounds heavy right now. Try one slow inhale for 4, hold for 4, and exhale for 6, "
            "then give yourself permission to settle instead of solve everything tonight."
        )
    return (
        "I'm here with you. A small reset can help tonight: loosen your shoulders, slow your breathing, "
        "and take one gentle step like a mood check-in or calming audio."
    )


def get_mood_advice(text_input: str, mode: str = "general") -> str:
    """Return a mode-aware AI reply using OpenAI, with safe fallback if the API is unavailable."""
    if not text_input or not isinstance(text_input, str):
        return "Please share how you're feeling tonight."

    system_prompt = ISLAMIC_SYSTEM_PROMPT if mode == "islamic" else GENERAL_SYSTEM_PROMPT
    temperature = 0.65 if mode == "islamic" else 0.75

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text_input},
            ],
            max_tokens=220,
            temperature=temperature,
        )
        return response.choices[0].message.content.strip()
    except Exception as error:
        print(f"OpenAI chat error: {error}")
        return _fallback_reply(text_input, mode)