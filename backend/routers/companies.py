"""Corporate plans — companies, members, campaigns."""
from __future__ import annotations

import random
import string
from datetime import timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from deps import current_user, db, new_id, now_utc, today_iso
from routers.gamification import _compute_user_xp

router = APIRouter(tags=["companies"])


class CompanyIn(BaseModel):
    name: str
    industry: Optional[str] = None
    logo_base64: Optional[str] = None
    plan: Literal["free", "starter", "business", "enterprise"] = "free"


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    logo_base64: Optional[str] = None
    plan: Optional[Literal["free", "starter", "business", "enterprise"]] = None


class CampaignIn(BaseModel):
    title: str
    description: Optional[str] = None
    metric: Literal["water_ml", "steps", "sleep_hours", "weight_loss_kg",
                    "exercise_min", "meals_count"] = "water_ml"
    target_value: float
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class JoinIn(BaseModel):
    code: str


def _gen_company_code() -> str:
    return "V-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=5))


async def _get_membership(company_id: str, user_id: str) -> Optional[dict]:
    return await db.company_members.find_one(
        {"company_id": company_id, "user_id": user_id, "active": True}, {"_id": 0}
    )


async def _require_admin(company_id: str, user_id: str) -> dict:
    mem = await _get_membership(company_id, user_id)
    if not mem or mem.get("role") != "admin":
        raise HTTPException(403, "Apenas administradores podem executar esta ação")
    return mem


@router.post("/companies")
async def create_company(payload: CompanyIn, user: dict = Depends(current_user)):
    code = None
    for _ in range(5):
        c = _gen_company_code()
        if not await db.companies.find_one({"code": c}, {"_id": 1}):
            code = c
            break
    if not code:
        raise HTTPException(500, "Falha ao gerar código de convite")
    company = {
        "id": new_id("co"),
        "name": payload.name.strip(),
        "industry": payload.industry,
        "logo_base64": payload.logo_base64,
        "plan": payload.plan,
        "code": code,
        "owner_id": user["user_id"],
        "created_at": now_utc().isoformat(),
    }
    if not company["name"]:
        raise HTTPException(400, "Nome da empresa é obrigatório")
    await db.companies.insert_one(company)
    await db.company_members.insert_one({
        "id": new_id("mem"),
        "company_id": company["id"],
        "user_id": user["user_id"],
        "role": "admin",
        "joined_at": now_utc().isoformat(),
        "active": True,
    })
    return {k: v for k, v in company.items() if k != "_id"}


@router.get("/companies/mine")
async def list_my_companies(user: dict = Depends(current_user)):
    memberships = await db.company_members.find(
        {"user_id": user["user_id"], "active": True}, {"_id": 0}
    ).to_list(50)
    if not memberships:
        return {"items": []}
    company_ids = [m["company_id"] for m in memberships]
    companies = await db.companies.find({"id": {"$in": company_ids}}, {"_id": 0}).to_list(50)
    by_id = {c["id"]: c for c in companies}
    items = []
    for m in memberships:
        c = by_id.get(m["company_id"])
        if not c:
            continue
        n_members = await db.company_members.count_documents(
            {"company_id": c["id"], "active": True}
        )
        items.append({**c, "role": m.get("role"), "member_count": n_members})
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"items": items}


@router.post("/companies/join")
async def join_company(payload: JoinIn, user: dict = Depends(current_user)):
    code = payload.code.strip().upper()
    if not code:
        raise HTTPException(400, "Código inválido")
    company = await db.companies.find_one({"code": code}, {"_id": 0})
    if not company:
        raise HTTPException(404, "Empresa não encontrada com esse código")
    exists = await db.company_members.find_one(
        {"company_id": company["id"], "user_id": user["user_id"]}, {"_id": 0}
    )
    if exists:
        if exists.get("active"):
            raise HTTPException(400, "Você já é membro dessa empresa")
        await db.company_members.update_one(
            {"id": exists["id"]}, {"$set": {"active": True, "joined_at": now_utc().isoformat()}}
        )
    else:
        await db.company_members.insert_one({
            "id": new_id("mem"),
            "company_id": company["id"],
            "user_id": user["user_id"],
            "role": "member",
            "joined_at": now_utc().isoformat(),
            "active": True,
        })
    return {"ok": True, "company": company}


@router.get("/companies/{company_id}")
async def get_company(company_id: str, user: dict = Depends(current_user)):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(404, "Empresa não encontrada")
    mem = await _get_membership(company_id, user["user_id"])
    if not mem:
        raise HTTPException(403, "Você não é membro desta empresa")
    n_members = await db.company_members.count_documents(
        {"company_id": company_id, "active": True}
    )
    return {**company, "role": mem["role"], "member_count": n_members}


@router.patch("/companies/{company_id}")
async def update_company(company_id: str, payload: CompanyUpdate, user: dict = Depends(current_user)):
    await _require_admin(company_id, user["user_id"])
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Sem alterações")
    await db.companies.update_one({"id": company_id}, {"$set": updates})
    return {"ok": True}


@router.delete("/companies/{company_id}")
async def delete_company(company_id: str, user: dict = Depends(current_user)):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(404, "Empresa não encontrada")
    if company["owner_id"] != user["user_id"]:
        raise HTTPException(403, "Apenas o dono pode excluir a empresa")
    await db.companies.delete_one({"id": company_id})
    await db.company_members.delete_many({"company_id": company_id})
    await db.campaigns.delete_many({"company_id": company_id})
    return {"ok": True}


@router.post("/companies/{company_id}/leave")
async def leave_company(company_id: str, user: dict = Depends(current_user)):
    mem = await _get_membership(company_id, user["user_id"])
    if not mem:
        raise HTTPException(404, "Você não é membro")
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if company and company["owner_id"] == user["user_id"]:
        raise HTTPException(400, "O dono não pode sair. Exclua a empresa ou transfira a propriedade.")
    await db.company_members.update_one({"id": mem["id"]}, {"$set": {"active": False}})
    return {"ok": True}


@router.get("/companies/{company_id}/members")
async def list_members(company_id: str, user: dict = Depends(current_user)):
    await _require_admin(company_id, user["user_id"])
    memberships = await db.company_members.find(
        {"company_id": company_id, "active": True}, {"_id": 0}
    ).to_list(500)
    user_ids = [m["user_id"] for m in memberships]
    users = await db.users.find(
        {"user_id": {"$in": user_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "photo_base64": 1},
    ).to_list(500)
    by_id = {u["user_id"]: u for u in users}
    items = []
    for m in memberships:
        u = by_id.get(m["user_id"], {})
        items.append({
            "membership_id": m["id"], "user_id": m["user_id"],
            "name": u.get("name") or "Anônimo", "email": u.get("email"),
            "avatar": u.get("photo_base64"),
            "role": m.get("role"), "joined_at": m.get("joined_at"),
        })
    return {"items": items}


@router.delete("/companies/{company_id}/members/{member_user_id}")
async def remove_member(company_id: str, member_user_id: str, user: dict = Depends(current_user)):
    await _require_admin(company_id, user["user_id"])
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if company and company["owner_id"] == member_user_id:
        raise HTTPException(400, "Não é possível remover o dono da empresa")
    await db.company_members.update_one(
        {"company_id": company_id, "user_id": member_user_id},
        {"$set": {"active": False}},
    )
    return {"ok": True}


@router.get("/companies/{company_id}/dashboard")
async def company_dashboard(company_id: str, user: dict = Depends(current_user)):
    await _require_admin(company_id, user["user_id"])
    memberships = await db.company_members.find(
        {"company_id": company_id, "active": True}, {"_id": 0, "user_id": 1}
    ).to_list(500)
    uids = [m["user_id"] for m in memberships]
    if not uids:
        return {"member_count": 0, "active_today": 0, "totals": {}, "avg": {}}
    today = today_iso()
    active_today = 0
    for uid in uids:
        has_log = await db.weights.find_one({"user_id": uid, "date": today}, {"_id": 1}) \
            or await db.meals.find_one({"user_id": uid, "date": today}, {"_id": 1}) \
            or await db.exercises.find_one({"user_id": uid, "date": today}, {"_id": 1}) \
            or await db.waters.find_one({"user_id": uid, "date": today}, {"_id": 1})
        if has_log:
            active_today += 1

    async def sum_col(col: str, field: str, days: int = 7) -> float:
        cutoff = (now_utc().date() - timedelta(days=days)).isoformat()
        pipeline = [
            {"$match": {"user_id": {"$in": uids}, "date": {"$gte": cutoff}}},
            {"$group": {"_id": None, "s": {"$sum": f"${field}"}}},
        ]
        r = await db[col].aggregate(pipeline).to_list(1)
        return float(r[0]["s"]) if r else 0.0

    total_water_ml = await sum_col("waters", "amount_ml", days=7)
    total_steps = await sum_col("steps", "steps", days=7)
    total_exercise_min = await sum_col("exercises", "duration_min", days=7)
    total_meals = await db.meals.count_documents(
        {"user_id": {"$in": uids}, "date": {"$gte": (now_utc().date() - timedelta(days=7)).isoformat()}}
    )
    sleep_docs = await db.sleeps.find(
        {"user_id": {"$in": uids}, "date": {"$gte": (now_utc().date() - timedelta(days=7)).isoformat()}},
        {"_id": 0, "hours": 1},
    ).to_list(2000)
    avg_sleep = round(sum(s.get("hours", 0) for s in sleep_docs) / len(sleep_docs), 1) if sleep_docs else 0

    return {
        "member_count": len(uids),
        "active_today": active_today,
        "engagement_pct": round((active_today / len(uids)) * 100, 1) if uids else 0,
        "period_days": 7,
        "totals": {
            "water_ml": int(total_water_ml),
            "steps": int(total_steps),
            "exercise_min": int(total_exercise_min),
            "meals": total_meals,
        },
        "averages": {
            "water_ml_per_user": int(total_water_ml / len(uids)),
            "steps_per_user": int(total_steps / len(uids)),
            "exercise_min_per_user": int(total_exercise_min / len(uids)),
            "sleep_hours": avg_sleep,
        },
    }


@router.get("/companies/{company_id}/leaderboard")
async def company_leaderboard(company_id: str, user: dict = Depends(current_user)):
    mem = await _get_membership(company_id, user["user_id"])
    if not mem:
        raise HTTPException(403, "Você não é membro desta empresa")
    memberships = await db.company_members.find(
        {"company_id": company_id, "active": True}, {"_id": 0, "user_id": 1}
    ).to_list(500)
    uids = [m["user_id"] for m in memberships]
    users = await db.users.find(
        {"user_id": {"$in": uids}},
        {"_id": 0, "user_id": 1, "name": 1, "photo_base64": 1},
    ).to_list(500)
    by_id = {u["user_id"]: u for u in users}
    entries = []
    for uid in uids:
        xp, level, streak = await _compute_user_xp(uid)
        u = by_id.get(uid, {})
        entries.append({
            "user_id": uid, "name": u.get("name") or "Anônimo",
            "avatar": u.get("photo_base64"),
            "xp": xp, "level": level, "streak": streak,
            "is_me": uid == user["user_id"],
        })
    entries.sort(key=lambda e: (-e["xp"], -e["streak"]))
    for i, e in enumerate(entries):
        e["rank"] = i + 1
    my_rank = next((e["rank"] for e in entries if e["is_me"]), None)
    return {"items": entries, "my_rank": my_rank, "total": len(entries)}


# ---------- Campaigns ----------
@router.post("/companies/{company_id}/campaigns")
async def create_campaign(company_id: str, payload: CampaignIn, user: dict = Depends(current_user)):
    await _require_admin(company_id, user["user_id"])
    if payload.target_value <= 0:
        raise HTTPException(400, "Meta inválida")
    camp = {
        "id": new_id("cmp"),
        "company_id": company_id,
        "title": payload.title.strip(),
        "description": payload.description,
        "metric": payload.metric,
        "target_value": payload.target_value,
        "start_date": payload.start_date or today_iso(),
        "end_date": payload.end_date or (now_utc().date() + timedelta(days=30)).isoformat(),
        "created_by": user["user_id"],
        "created_at": now_utc().isoformat(),
    }
    if not camp["title"]:
        raise HTTPException(400, "Título obrigatório")
    await db.campaigns.insert_one(camp)
    return {k: v for k, v in camp.items() if k != "_id"}


@router.get("/companies/{company_id}/campaigns")
async def list_campaigns(company_id: str, user: dict = Depends(current_user)):
    mem = await _get_membership(company_id, user["user_id"])
    if not mem:
        raise HTTPException(403, "Você não é membro")
    items = await db.campaigns.find(
        {"company_id": company_id}, {"_id": 0}
    ).sort("start_date", -1).to_list(50)
    for c in items:
        c["participant_count"] = await db.campaign_participations.count_documents(
            {"campaign_id": c["id"]}
        )
        my = await db.campaign_participations.find_one(
            {"campaign_id": c["id"], "user_id": user["user_id"]}, {"_id": 0}
        )
        c["joined"] = bool(my)
    return {"items": items}


async def _compute_campaign_progress(campaign: dict, uid: str) -> float:
    metric = campaign["metric"]
    start = campaign["start_date"]
    end = campaign["end_date"]
    q = {"user_id": uid, "date": {"$gte": start, "$lte": end}}
    if metric == "water_ml":
        docs = await db.waters.find(q, {"_id": 0, "amount_ml": 1}).to_list(5000)
        return sum(d.get("amount_ml", 0) for d in docs)
    if metric == "steps":
        docs = await db.steps.find(q, {"_id": 0, "steps": 1}).to_list(5000)
        return sum(d.get("steps", 0) for d in docs)
    if metric == "sleep_hours":
        docs = await db.sleeps.find(q, {"_id": 0, "hours": 1}).to_list(5000)
        return round(sum(d.get("hours", 0) for d in docs), 1)
    if metric == "exercise_min":
        docs = await db.exercises.find(q, {"_id": 0, "duration_min": 1}).to_list(5000)
        return sum(d.get("duration_min", 0) for d in docs)
    if metric == "meals_count":
        return await db.meals.count_documents(q)
    if metric == "weight_loss_kg":
        weights = await db.weights.find(q, {"_id": 0, "weight_kg": 1, "date": 1}).sort("date", 1).to_list(1000)
        if len(weights) < 2:
            return 0.0
        return round(weights[0]["weight_kg"] - weights[-1]["weight_kg"], 1)
    return 0.0


@router.post("/campaigns/{campaign_id}/join")
async def join_campaign(campaign_id: str, user: dict = Depends(current_user)):
    camp = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not camp:
        raise HTTPException(404, "Campanha não encontrada")
    mem = await _get_membership(camp["company_id"], user["user_id"])
    if not mem:
        raise HTTPException(403, "Você não é membro desta empresa")
    try:
        await db.campaign_participations.insert_one({
            "id": new_id("cp"),
            "campaign_id": campaign_id,
            "company_id": camp["company_id"],
            "user_id": user["user_id"],
            "joined_at": now_utc().isoformat(),
        })
    except Exception:
        pass
    return {"ok": True}


@router.post("/campaigns/{campaign_id}/leave")
async def leave_campaign(campaign_id: str, user: dict = Depends(current_user)):
    await db.campaign_participations.delete_one(
        {"campaign_id": campaign_id, "user_id": user["user_id"]}
    )
    return {"ok": True}


@router.get("/campaigns/{campaign_id}")
async def campaign_detail(campaign_id: str, user: dict = Depends(current_user)):
    camp = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not camp:
        raise HTTPException(404, "Campanha não encontrada")
    mem = await _get_membership(camp["company_id"], user["user_id"])
    if not mem:
        raise HTTPException(403, "Sem acesso")
    my_progress = await _compute_campaign_progress(camp, user["user_id"])
    my_participation = await db.campaign_participations.find_one(
        {"campaign_id": campaign_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    return {
        **camp,
        "joined": bool(my_participation),
        "my_progress": my_progress,
        "progress_pct": min(100.0, round((my_progress / camp["target_value"]) * 100, 1)) if camp["target_value"] else 0,
    }


@router.get("/campaigns/{campaign_id}/ranking")
async def campaign_ranking(campaign_id: str, user: dict = Depends(current_user)):
    camp = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not camp:
        raise HTTPException(404, "Campanha não encontrada")
    mem = await _get_membership(camp["company_id"], user["user_id"])
    if not mem:
        raise HTTPException(403, "Sem acesso")
    participations = await db.campaign_participations.find(
        {"campaign_id": campaign_id}, {"_id": 0, "user_id": 1}
    ).to_list(500)
    uids = [p["user_id"] for p in participations]
    users = await db.users.find(
        {"user_id": {"$in": uids}},
        {"_id": 0, "user_id": 1, "name": 1, "photo_base64": 1},
    ).to_list(500)
    by_id = {u["user_id"]: u for u in users}
    entries = []
    for uid in uids:
        p = await _compute_campaign_progress(camp, uid)
        u = by_id.get(uid, {})
        entries.append({
            "user_id": uid, "name": u.get("name") or "Anônimo",
            "avatar": u.get("photo_base64"),
            "progress": p,
            "progress_pct": min(100.0, round((p / camp["target_value"]) * 100, 1)) if camp["target_value"] else 0,
            "is_me": uid == user["user_id"],
        })
    entries.sort(key=lambda e: -e["progress"])
    for i, e in enumerate(entries):
        e["rank"] = i + 1
    my_rank = next((e["rank"] for e in entries if e["is_me"]), None)
    return {"items": entries, "my_rank": my_rank, "target": camp["target_value"], "metric": camp["metric"]}


@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, user: dict = Depends(current_user)):
    camp = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not camp:
        raise HTTPException(404, "Campanha não encontrada")
    await _require_admin(camp["company_id"], user["user_id"])
    await db.campaigns.delete_one({"id": campaign_id})
    await db.campaign_participations.delete_many({"campaign_id": campaign_id})
    return {"ok": True}


@router.get("/companies/{company_id}/report/pdf")
async def company_report_pdf(company_id: str, user: dict = Depends(current_user)):
    await _require_admin(company_id, user["user_id"])
    from fpdf import FPDF

    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(404, "Empresa não encontrada")

    memberships = await db.company_members.find(
        {"company_id": company_id, "active": True}, {"_id": 0, "user_id": 1}
    ).to_list(500)
    uids = [m["user_id"] for m in memberships]
    campaigns = await db.campaigns.find({"company_id": company_id}, {"_id": 0}).to_list(50)

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(38, 48, 26)
    pdf.cell(0, 10, f"MoreFit Corporate - {company['name']}", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 6, f"Setor: {company.get('industry') or '-'}  |  Plano: {company['plan'].capitalize()}", ln=True)
    pdf.cell(0, 6, f"Gerado em: {now_utc().strftime('%d/%m/%Y')}", ln=True)
    pdf.ln(6)

    pdf.set_fill_color(14, 16, 15)
    pdf.set_text_color(198, 241, 75)
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 12, f"  Funcionarios: {len(uids)}  |  Campanhas: {len(campaigns)}", ln=True, fill=True)
    pdf.ln(6)

    if uids:
        cutoff = (now_utc().date() - timedelta(days=7)).isoformat()

        async def _sum(col: str, field: str) -> int:
            r = await db[col].aggregate([
                {"$match": {"user_id": {"$in": uids}, "date": {"$gte": cutoff}}},
                {"$group": {"_id": None, "s": {"$sum": f"${field}"}}},
            ]).to_list(1)
            return int(r[0]["s"]) if r else 0

        w = await _sum("waters", "amount_ml")
        st = await _sum("steps", "steps")
        ex = await _sum("exercises", "duration_min")

        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(38, 48, 26)
        pdf.cell(0, 8, "Ultimos 7 dias (agregado, anonimo)", ln=True)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(0, 6, f"  Agua total: {w} ml  ({int(w/max(1,len(uids)))} ml/usuario)", ln=True)
        pdf.cell(0, 6, f"  Passos totais: {st}  ({int(st/max(1,len(uids)))} /usuario)", ln=True)
        pdf.cell(0, 6, f"  Exercicio total: {ex} min  ({int(ex/max(1,len(uids)))} min/usuario)", ln=True)
        pdf.ln(4)

    if campaigns:
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(38, 48, 26)
        pdf.cell(0, 8, "Campanhas ativas", ln=True)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(30, 30, 30)
        for c in campaigns[:15]:
            n_part = await db.campaign_participations.count_documents({"campaign_id": c["id"]})
            pdf.cell(0, 6, f"  - {c['title']} ({c['metric']} >= {c['target_value']}) - {n_part} participantes", ln=True)

    pdf_bytes = bytes(pdf.output())
    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="morefit-corporate-{company["name"].replace(" ", "_")}.pdf"'},
    )
