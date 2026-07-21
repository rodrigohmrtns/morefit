"""AI Coach endpoints — chat, analyze, recipes, meal photo analyze, photo compare.

All endpoints require Premium.
"""
from __future__ import annotations

import logging
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from deps import (
    EMERGENT_LLM_KEY,
    MealAnalyzeIn,
    _extract_json,
    current_user,
    db,
    now_utc,
    require_premium,
    today_iso,
)

router = APIRouter(tags=["coach"])
log = logging.getLogger("vitatracker.coach")


# ============= Photo comparison =============
class PhotoCompareIn(BaseModel):
    photo_id_before: str
    photo_id_after: str


@router.post("/photos/compare")
async def compare_photos(payload: PhotoCompareIn, user: dict = Depends(require_premium)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY não configurada")
    before = await db.photos.find_one({"id": payload.photo_id_before, "user_id": user["user_id"]}, {"_id": 0})
    after = await db.photos.find_one({"id": payload.photo_id_after, "user_id": user["user_id"]}, {"_id": 0})
    if not before or not after:
        raise HTTPException(404, "Fotos não encontradas")
    try:
        from emergentintegrations.llm.chat import ImageContent, LlmChat, UserMessage
    except Exception as e:
        raise HTTPException(500, f"IA indisponível: {e}")

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"compare_{user['user_id']}_{uuid.uuid4().hex[:8]}",
        system_message=(
            "Você é uma analista de composição corporal. Compare as duas fotos (a primeira é 'antes' e "
            "a segunda é 'depois') e responda APENAS um JSON no formato: "
            '{"progress_score": 0-100, "changes": ["lista de mudanças observadas"], '
            '"encouragement": "texto motivacional curto em pt-BR", '
            '"summary": "resumo em uma frase em pt-BR"}. '
            "Nunca inclua texto fora do JSON. Seja gentil e realista."
        ),
    ).with_model("gemini", "gemini-2.5-flash")

    msg = UserMessage(
        text="Compare a foto ANTES (primeira) com a foto DEPOIS (segunda). Retorne apenas o JSON.",
        file_contents=[
            ImageContent(image_base64=before["image_base64"]),
            ImageContent(image_base64=after["image_base64"]),
        ],
    )
    try:
        resp = await chat.send_message(msg)
    except Exception as e:
        log.error("Gemini compare error: %s", e)
        raise HTTPException(502, f"Falha ao comparar: {e}")
    data = _extract_json(resp or "")
    if not data:
        raise HTTPException(422, "Não foi possível interpretar a análise")
    return {
        "analysis": data,
        "before": {"id": before["id"], "date": before["date"]},
        "after": {"id": after["id"], "date": after["date"]},
    }


# ============= Meal photo analyze =============
@router.post("/meals/analyze")
async def analyze_meal(payload: MealAnalyzeIn, user: dict = Depends(require_premium)):
    """Analyze meal photo with Gemini and return macros."""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY não configurada")
    try:
        from emergentintegrations.llm.chat import ImageContent, LlmChat, UserMessage
    except Exception as e:
        raise HTTPException(500, f"IA indisponível: {e}")

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"meal_{user['user_id']}_{uuid.uuid4().hex[:8]}",
        system_message=(
            "Você é uma nutricionista especialista. Analise fotos de refeição e retorne "
            "APENAS um JSON válido no formato: "
            '{"name":"nome curto do prato","portion":"porção estimada","calories":N,'
            '"protein_g":N,"carbs_g":N,"fat_g":N,"confidence":0-1,"tips":"dica curta em pt-BR"}. '
            "Nunca inclua texto fora do JSON."
        ),
    ).with_model("gemini", "gemini-2.5-flash")

    img = ImageContent(image_base64=payload.image_base64)
    msg = UserMessage(
        text="Analise a refeição na foto e retorne apenas o JSON solicitado.",
        file_contents=[img],
    )
    try:
        response = await chat.send_message(msg)
    except Exception as e:
        log.error("Gemini error: %s", e)
        raise HTTPException(502, f"Falha ao analisar imagem: {e}")

    data = _extract_json(response or "")
    if not data or "calories" not in data:
        raise HTTPException(422, "Não foi possível interpretar a refeição")
    return {"analysis": data}


# ============= Coach chat =============
class CoachMsgIn(BaseModel):
    message: str
    session_id: Optional[str] = None


async def _build_user_context(user: dict) -> str:
    """Build a compact context string for the coach LLM."""
    uid = user["user_id"]
    weights = await db.weights.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(7)
    meals = await db.meals.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(20)
    exercises = await db.exercises.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(10)
    sleeps = await db.sleeps.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(7)
    waters_today = await db.waters.find({"user_id": uid, "date": today_iso()}, {"_id": 0}).to_list(100)
    water_today_ml = sum(w.get("amount_ml", 0) for w in waters_today)

    lines: list[str] = []
    lines.append(f"Usuário: {user.get('name', 'Anônimo')} • objetivo: {user.get('goal', 'maintain')}")
    if user.get('height_cm'):
        lines.append(f"Altura: {user['height_cm']} cm")
    if user.get('goal_weight_kg'):
        lines.append(f"Peso meta: {user['goal_weight_kg']} kg")
    if weights:
        w0 = weights[0]
        lines.append(f"Peso atual: {w0.get('weight_kg')} kg em {w0.get('date')}")
        if len(weights) > 1:
            diff = round(weights[0].get('weight_kg', 0) - weights[-1].get('weight_kg', 0), 2)
            lines.append(f"Variação nos últimos {len(weights)} registros: {diff:+} kg")
    if sleeps:
        sh = [s.get('hours') for s in sleeps if s.get('hours')]
        if sh:
            lines.append(f"Sono médio (últimos {len(sh)}): {round(sum(sh)/len(sh), 1)}h")
    if exercises:
        mins = sum(e.get('duration_min', 0) for e in exercises)
        lines.append(f"Exercícios recentes: {len(exercises)} sessões, {mins} min totais")
    if meals:
        kcal = sum(m.get('calories', 0) for m in meals[:10])
        lines.append(f"Últimas 10 refeições somam {round(kcal)} kcal")
    lines.append(f"Meta calórica diária: {user.get('daily_calorie_goal', 2000)} kcal")
    lines.append(f"Água hoje: {water_today_ml} / {user.get('daily_water_ml_goal', 2000)} ml")
    return "\n".join(lines)


@router.post("/coach/chat")
async def coach_chat(payload: CoachMsgIn, user: dict = Depends(require_premium)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY não configurada")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:
        raise HTTPException(500, f"IA indisponível: {e}")

    session_id = payload.session_id or f"coach_{user['user_id']}_{uuid.uuid4().hex[:8]}"
    context = await _build_user_context(user)
    system = (
        "Você é o Coach Virtual do VitaTracker: nutricionista + personal trainer + psicólogo motivacional. "
        "Responda em português do Brasil, de forma acolhedora, prática e concisa (máximo 4-6 frases). "
        "Use os dados do usuário fornecidos abaixo para personalizar. Se detectar estagnação, oriente ajustes. "
        "Se for pergunta sobre suplementos/medicações, oriente consultar um profissional. "
        "Sempre termine com uma dica prática ou pergunta motivacional.\n\n"
        f"DADOS DO USUÁRIO:\n{context}"
    )
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system)\
        .with_model("gemini", "gemini-2.5-flash")
    await db.coach_messages.insert_one({
        "user_id": user["user_id"], "session_id": session_id, "role": "user",
        "content": payload.message, "created_at": now_utc().isoformat(),
    })
    try:
        reply = await chat.send_message(UserMessage(text=payload.message))
    except Exception as e:
        log.error("Coach chat error: %s", e)
        raise HTTPException(502, f"Falha na IA: {e}")
    reply_text = reply or ""
    await db.coach_messages.insert_one({
        "user_id": user["user_id"], "session_id": session_id, "role": "assistant",
        "content": reply_text, "created_at": now_utc().isoformat(),
    })
    return {"session_id": session_id, "reply": reply_text}


@router.get("/coach/messages")
async def coach_messages(user: dict = Depends(current_user), session_id: Optional[str] = None, limit: int = 100):
    q: dict = {"user_id": user["user_id"]}
    if session_id:
        q["session_id"] = session_id
    items = await db.coach_messages.find(q, {"_id": 0}).sort("created_at", 1).to_list(limit)
    return {"items": items}


@router.post("/coach/analyze")
async def coach_analyze(user: dict = Depends(require_premium)):
    """Gera um relatório automático da evolução do usuário."""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY não configurada")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:
        raise HTTPException(500, f"IA indisponível: {e}")

    context = await _build_user_context(user)
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"analysis_{user['user_id']}_{uuid.uuid4().hex[:6]}",
        system_message=(
            "Você é um analista de saúde do VitaTracker. Com base nos dados do usuário, produza um relatório "
            "com JSON APENAS no formato: {\"summary\":\"resumo em 2 frases\","
            "\"strengths\":[\"até 3 pontos fortes\"],\"opportunities\":[\"até 3 oportunidades de melhoria\"],"
            "\"stagnation_alert\": true|false, \"next_actions\":[\"até 3 ações práticas curtas\"]}. "
            f"Nunca inclua texto fora do JSON.\n\nDADOS:\n{context}"
        ),
    ).with_model("gemini", "gemini-2.5-flash")
    try:
        resp = await chat.send_message(UserMessage(text="Analise minha evolução e retorne o JSON."))
    except Exception as e:
        raise HTTPException(502, f"Falha na análise: {e}")
    data = _extract_json(resp or "")
    if not data:
        raise HTTPException(422, "Não foi possível interpretar a análise")
    return {"analysis": data}


# ============= AI Recipes (item 13) =============
class RecipeIn(BaseModel):
    goal: Optional[Literal["lose", "maintain", "gain", "improve_health"]] = None
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"] = "lunch"
    dietary_restrictions: Optional[list[str]] = None
    max_calories: Optional[int] = None


@router.post("/coach/recipes")
async def coach_recipes(payload: RecipeIn, user: dict = Depends(require_premium)):
    """Generate 3 personalized recipes matching user's goal and macros."""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY não configurada")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:
        raise HTTPException(500, f"IA indisponível: {e}")

    goal = payload.goal or user.get("goal") or "improve_health"
    kcal_goal = user.get("daily_calorie_goal") or 2000
    restrictions = ", ".join(payload.dietary_restrictions or []) or "nenhuma"
    max_kcal = payload.max_calories or (kcal_goal // 3)

    meal_label = {"breakfast": "café da manhã", "lunch": "almoço", "dinner": "jantar", "snack": "lanche"}[payload.meal_type]

    system = (
        "Você é um nutricionista brasileiro. Gere 3 receitas para {meal} respeitando: objetivo={goal}, "
        "restrições=({rest}), max {max_kcal}kcal por porção. RETORNE APENAS JSON no formato: "
        "{{\"recipes\":[{{\"name\":\"string\",\"emoji\":\"🍽️\",\"time_min\":15,\"servings\":1,"
        "\"ingredients\":[\"item + quantidade\"],\"instructions\":[\"passo\"],"
        "\"macros\":{{\"calories\":300,\"protein_g\":20,\"carbs_g\":30,\"fat_g\":10}},"
        "\"tags\":[\"tag\"]}}]}}. Use ingredientes brasileiros. Nunca inclua texto fora do JSON."
    ).format(meal=meal_label, goal=goal, rest=restrictions, max_kcal=max_kcal)

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"recipes_{user['user_id']}_{uuid.uuid4().hex[:6]}",
        system_message=system,
    ).with_model("gemini", "gemini-2.5-flash")

    try:
        resp = await chat.send_message(UserMessage(
            text=f"Gere 3 receitas para {meal_label} adequadas ao meu objetivo."
        ))
    except Exception as e:
        raise HTTPException(502, f"Falha ao gerar receitas: {e}")

    data = _extract_json(resp or "")
    if not data or not data.get("recipes"):
        try:
            resp2 = await chat.send_message(UserMessage(
                text="Retorne APENAS um JSON válido conforme o schema, sem markdown, sem texto fora do JSON."
            ))
            data = _extract_json(resp2 or "")
        except Exception:
            data = None
        if not data or not data.get("recipes"):
            raise HTTPException(422, "Não foi possível gerar receitas")
    return data
