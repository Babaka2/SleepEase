"""
compliance_engine.py – Islamic Content Compliance & Safety Monitoring
=====================================================================
Ensures AI-generated Islamic content is:
  1. Accurate – no fabricated hadiths or misquoted Quran
  2. Safe – no harmful, extremist, or sectarian content
  3. Auditable – every AI response is scored and logged
"""

import re
import os
import json
from datetime import datetime
from openai import OpenAI

_openai_compliance_client = None

def _get_openai_client() -> OpenAI:
    global _openai_compliance_client
    if _openai_compliance_client is None:
        _openai_compliance_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _openai_compliance_client

# ── Keyword-based fast filters ─────────────────────────────────────────────

# High-risk terms that should NEVER appear in AI responses
BLOCKED_TERMS = [
    "kill", "suicide", "bomb", "jihad al-sayf", "takfir",
    "infidel", "kafir must", "death to", "destroy",
    "self-harm", "cut yourself", "end your life",
]

# Terms that trigger a compliance review (not auto-blocked)
REVIEW_TRIGGERS = [
    "fatwa", "haram", "halal ruling", "obligatory",
    "fard", "wajib", "bid'ah", "shirk", "kufr",
    "divorce", "marriage ruling", "inheritance law",
]

# Approved scholarly sources the AI should reference
APPROVED_SOURCES = [
    "Sahih al-Bukhari", "Sahih Muslim", "Sunan Abu Dawud",
    "Sunan al-Tirmidhi", "Sunan al-Nasa'i", "Sunan Ibn Majah",
    "Riyad al-Salihin", "Fortress of the Muslim",
    "Quran", "Al-Quran",
]


# ── Compliance result structure ─────────────────────────────────────────────

def _create_result(
    passed: bool,
    score: float,
    flags: list,
    category: str,
    original: str,
    filtered: str = None,
) -> dict:
    return {
        "passed": passed,
        "compliance_score": round(score, 4),
        "category": category,
        "flags": flags,
        "original_response": original,
        "filtered_response": filtered or original,
        "reviewed_at": datetime.utcnow().isoformat(),
    }


# ═══════════════════════════════════════════════════════════════════════════
# 1. Fast keyword filter (sub-millisecond)
# ═══════════════════════════════════════════════════════════════════════════

def keyword_filter(text: str) -> dict:
    """
    Quick pass to catch obviously harmful content.
    Returns {blocked: bool, matched_terms: [], review_needed: bool, review_terms: []}.
    """
    lower = text.lower()
    blocked = []
    review = []

    for term in BLOCKED_TERMS:
        if term.lower() in lower:
            blocked.append(term)

    for term in REVIEW_TRIGGERS:
        if term.lower() in lower:
            review.append(term)

    return {
        "blocked": len(blocked) > 0,
        "matched_blocked_terms": blocked,
        "review_needed": len(review) > 0,
        "review_terms": review,
    }


# ═══════════════════════════════════════════════════════════════════════════
# 2. LLM-based deep compliance check
# ═══════════════════════════════════════════════════════════════════════════

_COMPLIANCE_PROMPT = """You are an Islamic content compliance auditor for a wellness app called SleepEase.

Evaluate the following AI response for Islamic accuracy and safety.

Score it on a scale from 0.0 to 1.0 where:
- 1.0 = Perfectly safe, accurate Islamic content
- 0.7+ = Acceptable with minor notes
- 0.5-0.7 = Needs review, may contain inaccuracies
- Below 0.5 = Potentially problematic content

Check for:
1. Fabricated hadiths or misquoted Quran verses
2. Sectarian bias or extremist interpretations
3. Medical/psychological claims presented as religious rulings
4. Content that could cause harm or distress
5. Appropriate tone (compassionate, not judgmental)

Return ONLY a JSON object:
{
  "score": <float 0.0-1.0>,
  "issues": [<list of specific issues found, empty if none>],
  "recommendation": "approve" | "flag_for_review" | "block",
  "reasoning": "<brief explanation>"
}

AI Response to evaluate:
"""


def deep_compliance_check(ai_response: str) -> dict:
    """
    Uses a separate OpenAI call to audit the AI response for Islamic accuracy.
    Returns compliance score and recommendation.
    """
    try:
        client = _get_openai_client()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "user", "content": _COMPLIANCE_PROMPT + ai_response}
            ],
            max_tokens=200,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        result = json.loads(response.choices[0].message.content)
        return {
            "score": float(result.get("score", 0.7)),
            "issues": result.get("issues", []),
            "recommendation": result.get("recommendation", "approve"),
            "reasoning": result.get("reasoning", ""),
        }
    except Exception as e:
        print(f"Deep compliance check error: {e}")
        # On failure, be cautious but don't block
        return {
            "score": 0.6,
            "issues": ["Compliance check unavailable – manual review recommended"],
            "recommendation": "flag_for_review",
            "reasoning": f"Automated check failed: {str(e)}",
        }


# ═══════════════════════════════════════════════════════════════════════════
# 3. Main compliance pipeline
# ═══════════════════════════════════════════════════════════════════════════

SAFE_FALLBACK_ISLAMIC = (
    "I want to make sure I give you accurate Islamic guidance. "
    "For this topic, I'd recommend consulting a trusted local imam or scholar. "
    "In the meantime, remember: 'Verily, with hardship comes ease' (Quran 94:5-6). "
    "Would you like to try some calming dhikr instead?"
)

SAFE_FALLBACK_GENERAL = (
    "I want to make sure I provide you with helpful and accurate guidance. "
    "For this particular topic, it might be best to speak with a qualified professional. "
    "In the meantime, would you like to try a relaxation exercise?"
)


def run_compliance_check(ai_response: str, mode: str = "islamic", db=None, user_id: str = None) -> dict:
    """
    Full compliance pipeline:
      Step 1: Keyword filter (fast)
      Step 2: Deep LLM audit (if Islamic mode)
      Step 3: Log audit result to Firestore
      Step 4: Return filtered response or safe fallback
    """
    flags = []
    final_score = 1.0

    # ── Step 1: Keyword filter ──
    kw = keyword_filter(ai_response)

    if kw["blocked"]:
        # Hard block — replace with safe fallback
        flags.append(f"BLOCKED: contains terms {kw['matched_blocked_terms']}")
        fallback = SAFE_FALLBACK_ISLAMIC if mode == "islamic" else SAFE_FALLBACK_GENERAL
        result = _create_result(
            passed=False,
            score=0.0,
            flags=flags,
            category="keyword_block",
            original=ai_response,
            filtered=fallback,
        )
        _log_audit(db, user_id, result)
        return result

    if kw["review_needed"]:
        flags.append(f"REVIEW: contains sensitive terms {kw['review_terms']}")
        final_score -= 0.1  # slight penalty

    # ── Step 2: Deep compliance (Islamic mode only) ──
    if mode == "islamic":
        deep = deep_compliance_check(ai_response)
        final_score = min(final_score, deep["score"])

        if deep["issues"]:
            flags.extend([f"CONTENT: {issue}" for issue in deep["issues"]])

        if deep["recommendation"] == "block":
            result = _create_result(
                passed=False,
                score=final_score,
                flags=flags,
                category="content_block",
                original=ai_response,
                filtered=SAFE_FALLBACK_ISLAMIC,
            )
            _log_audit(db, user_id, result)
            return result

        if deep["recommendation"] == "flag_for_review":
            flags.append("AUTO_FLAGGED: requires human review")

    # ── Step 3: Passed ──
    passed = final_score >= 0.5
    filtered = ai_response if passed else (
        SAFE_FALLBACK_ISLAMIC if mode == "islamic" else SAFE_FALLBACK_GENERAL
    )

    result = _create_result(
        passed=passed,
        score=final_score,
        flags=flags,
        category="approved" if passed else "low_score_block",
        original=ai_response,
        filtered=filtered,
    )
    _log_audit(db, user_id, result)
    return result


# ═══════════════════════════════════════════════════════════════════════════
# 4. Audit logging
# ═══════════════════════════════════════════════════════════════════════════

def _log_audit(db, user_id: str, result: dict):
    """Persist audit trail to Firestore for compliance reporting."""
    if db is None:
        return
    try:
        from firebase_admin import firestore as fs
        db.collection("compliance_audits").add({
            "user_id": user_id or "system",
            "passed": result["passed"],
            "compliance_score": result["compliance_score"],
            "category": result["category"],
            "flags": result["flags"],
            "created_at": fs.SERVER_TIMESTAMP,
        })
    except Exception as e:
        print(f"Audit log error: {e}")


# ═══════════════════════════════════════════════════════════════════════════
# 5. Admin: compliance analytics
# ═══════════════════════════════════════════════════════════════════════════

def get_compliance_stats(db) -> dict:
    """
    Returns aggregate compliance statistics for the admin dashboard.
    """
    try:
        audits = list(db.collection("compliance_audits").limit(500).stream())
        if not audits:
            return {
                "total_audits": 0,
                "pass_rate": 100.0,
                "avg_score": 1.0,
                "blocks": 0,
                "flags": 0,
            }

        total = len(audits)
        passed = 0
        blocked = 0
        flagged = 0
        scores = []

        for a in audits:
            d = a.to_dict()
            scores.append(d.get("compliance_score", 0.7))
            if d.get("passed"):
                passed += 1
            else:
                blocked += 1
            if d.get("flags"):
                flagged += 1

        return {
            "total_audits": total,
            "passed": passed,
            "blocked": blocked,
            "flagged_for_review": flagged,
            "pass_rate": round(passed / total * 100, 2),
            "avg_score": round(sum(scores) / len(scores), 4),
            "score_distribution": {
                "excellent_90_100": sum(1 for s in scores if s >= 0.9),
                "good_70_90": sum(1 for s in scores if 0.7 <= s < 0.9),
                "review_50_70": sum(1 for s in scores if 0.5 <= s < 0.7),
                "blocked_0_50": sum(1 for s in scores if s < 0.5),
            },
        }
    except Exception as e:
        print(f"Compliance stats error: {e}")
        return {"error": str(e)}
