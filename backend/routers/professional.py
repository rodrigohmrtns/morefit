"""Professional sharing — links, HTML reports and PDF exports.

The public HTML report is served under /api/reports/public/{token} (mounted
via routers/professional). The legacy /report/{token} path (no /api prefix)
is kept in server.py directly since it lives outside the api router.
"""
from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel

from deps import (
    current_user,
    db,
    new_id,
    now_utc,
    require_premium,
)

router = APIRouter(tags=["professional"])


class ShareIn(BaseModel):
    professional_type: Literal["nutritionist", "personal", "doctor"]
    professional_name: Optional[str] = None
    professional_email: Optional[str] = None


@router.post("/professionals/share")
async def create_share(payload: ShareIn, user: dict = Depends(require_premium)):
    token = uuid.uuid4().hex[:20]
    entry = {
        "id": new_id("share"),
        "token": token,
        "user_id": user["user_id"],
        "professional_type": payload.professional_type,
        "professional_name": payload.professional_name,
        "professional_email": payload.professional_email,
        "created_at": now_utc().isoformat(),
        "expires_at": (now_utc() + timedelta(days=30)).isoformat(),
    }
    await db.shares.insert_one(entry)
    return {**{k: v for k, v in entry.items() if k != "_id"}, "share_url": f"/api/reports/public/{token}"}


@router.get("/professionals/shares")
async def list_shares(user: dict = Depends(current_user)):
    items = await db.shares.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"items": items}


@router.delete("/professionals/shares/{share_id}")
async def revoke_share(share_id: str, user: dict = Depends(current_user)):
    await db.shares.delete_one({"id": share_id, "user_id": user["user_id"]})
    return {"ok": True}


async def _build_report_data(uid: str) -> dict:
    user = await db.users.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})
    if not user:
        return {}
    weights = await db.weights.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(30)
    meals = await db.meals.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(50)
    exercises = await db.exercises.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(30)
    sleeps = await db.sleeps.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(14)
    return {"user": user, "weights": weights, "meals": meals, "exercises": exercises, "sleeps": sleeps}


async def build_public_report_html(token: str) -> HTMLResponse:
    """Shared implementation for legacy and current public-report routes."""
    share = await db.shares.find_one({"token": token}, {"_id": 0})
    if not share:
        return HTMLResponse("<h1>Relatório não encontrado</h1>", status_code=404)
    data = await _build_report_data(share["user_id"])
    if not data:
        return HTMLResponse("<h1>Sem dados</h1>", status_code=404)
    u = data["user"]
    latest_w = data["weights"][0]["weight_kg"] if data["weights"] else "—"
    height = u.get("height_cm") or 0
    bmi = round(data["weights"][0]["weight_kg"] / ((height / 100) ** 2), 1) if data["weights"] and height else "—"
    ptype = share.get("professional_type") or "doctor"
    show_weights = True
    show_meals = ptype in ("nutritionist", "doctor")
    show_exercises = ptype in ("personal", "doctor")
    show_sleep = ptype == "doctor"
    ptype_label = {"nutritionist": "Nutricionista", "personal": "Personal Trainer", "doctor": "Médico"}.get(ptype, ptype)

    def rows(items: list, tds: list[str]) -> str:
        out = []
        for it in items:
            cells = "".join(f"<td>{it.get(k, '') if it.get(k) is not None else ''}</td>" for k in tds)
            out.append(f"<tr>{cells}</tr>")
        return "\n".join(out)

    section_weights = f"""
  <h2>Evolução do peso (últimos 30 registros)</h2>
  <table><thead><tr><th>Data</th><th>Peso (kg)</th><th>Cintura</th><th>Quadril</th><th>Gordura %</th></tr></thead>
    <tbody>{rows(data['weights'], ['date','weight_kg','waist_cm','hip_cm','body_fat_pct'])}</tbody></table>""" if show_weights else ""
    section_meals = f"""
  <h2>Refeições recentes</h2>
  <table><thead><tr><th>Data</th><th>Refeição</th><th>Nome</th><th>Kcal</th><th>P</th><th>C</th><th>G</th></tr></thead>
    <tbody>{rows(data['meals'][:20], ['date','meal_type','name','calories','protein_g','carbs_g','fat_g'])}</tbody></table>""" if show_meals else ""
    section_exercises = f"""
  <h2>Exercícios</h2>
  <table><thead><tr><th>Data</th><th>Nome</th><th>Categoria</th><th>Min</th><th>Kcal</th></tr></thead>
    <tbody>{rows(data['exercises'][:20], ['date','name','category','duration_min','calories_burned'])}</tbody></table>""" if show_exercises else ""
    section_sleep = f"""
  <h2>Sono</h2>
  <table><thead><tr><th>Data</th><th>Horas</th><th>Qualidade</th></tr></thead>
    <tbody>{rows(data['sleeps'], ['date','hours','quality'])}</tbody></table>""" if show_sleep else ""

    html = f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Relatório VitaTracker — {u.get('name', 'Usuário')}</title>
<style>
:root {{ color-scheme: light; }}
body {{ font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#0F1110; background:#F5F6F4; margin:0; padding:24px; }}
.wrap {{ max-width: 780px; margin: 0 auto; background:#fff; border-radius:16px; padding:32px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }}
h1 {{ margin:0 0 4px 0; font-size:26px; letter-spacing:-0.5px; }}
.sub {{ color:#83877F; font-size:13px; margin-bottom:24px; }}
.hero {{ background:#0E100F; color:#F5F6F4; border-radius:16px; padding:20px; margin-bottom:24px; display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }}
.hero div span {{ display:block; font-size:12px; opacity:.7; }}
.hero div strong {{ display:block; font-size:22px; font-weight:700; color:#C6F14B; margin-top:2px; }}
h2 {{ margin: 24px 0 12px; font-size:16px; color:#26301A; }}
table {{ width:100%; border-collapse:collapse; font-size:13px; }}
th, td {{ text-align:left; padding:8px 10px; border-bottom:1px solid #EDEFEB; }}
th {{ font-weight:600; color:#83877F; text-transform:uppercase; letter-spacing:.5px; font-size:11px; }}
.badge {{ display:inline-block; padding:4px 10px; border-radius:99px; background:#C6F14B; color:#26301A; font-weight:700; font-size:11px; margin-left:8px; }}
.foot {{ margin-top:24px; padding-top:16px; border-top:1px solid #EDEFEB; color:#83877F; font-size:12px; }}
@media print {{ body {{ background:#fff; padding:0; }} .wrap {{ box-shadow:none; }} }}
</style></head><body>
<div class="wrap">
  <h1>Relatório de Saúde <span class="badge">{ptype_label}</span></h1>
  <div class="sub">Paciente: <strong>{u.get('name','')}</strong> • {u.get('email','')} • Gerado em {now_utc().strftime('%d/%m/%Y')}</div>
  <div class="hero">
    <div><span>Peso atual</span><strong>{latest_w} kg</strong></div>
    <div><span>IMC</span><strong>{bmi}</strong></div>
    <div><span>Altura</span><strong>{u.get('height_cm','—')} cm</strong></div>
    <div><span>Objetivo</span><strong style="font-size:14px;">{u.get('goal','—')}</strong></div>
  </div>
  {section_weights}
  {section_meals}
  {section_exercises}
  {section_sleep}
  <div class="foot">Relatório gerado por VitaTracker — Este documento contém dados sensíveis. Compartilhamento válido por 30 dias.</div>
</div></body></html>"""
    return HTMLResponse(html)


@router.get("/reports/public/{token}", include_in_schema=False)
async def public_report(token: str):
    return await build_public_report_html(token)


@router.get("/report/pdf")
async def report_pdf(user: dict = Depends(require_premium), type: Optional[str] = "all"):
    """PDF summary. `type`: all | nutritionist | personal | doctor."""
    from fpdf import FPDF

    data = await _build_report_data(user["user_id"])
    if not data:
        raise HTTPException(404, "Sem dados")
    u = data["user"]
    latest_w = data["weights"][0]["weight_kg"] if data["weights"] else None
    height = u.get("height_cm") or 0
    bmi = round(latest_w / ((height / 100) ** 2), 1) if latest_w and height else None

    ptype = (type or "all").lower()
    if ptype not in ("all", "nutritionist", "personal", "doctor"):
        ptype = "all"
    show_weights = True
    show_meals = ptype in ("all", "nutritionist", "doctor")
    show_exercises = ptype in ("all", "personal", "doctor")
    show_sleep = ptype in ("all", "doctor")
    ptype_label = {"all": "Completo", "nutritionist": "Nutricionista",
                   "personal": "Personal Trainer", "doctor": "Medico"}[ptype]

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(38, 48, 26)
    pdf.cell(0, 10, f"VitaTracker - Relatorio ({ptype_label})", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 6, f"Paciente: {u.get('name','')} - {u.get('email','')}", ln=True)
    pdf.cell(0, 6, f"Gerado em: {now_utc().strftime('%d/%m/%Y')}", ln=True)
    pdf.ln(6)

    pdf.set_fill_color(14, 16, 15)
    pdf.set_text_color(198, 241, 75)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 12, f"  Peso: {latest_w or '-'} kg  |  IMC: {bmi or '-'}  |  Altura: {u.get('height_cm','-')} cm  |  Objetivo: {u.get('goal','-')}",
             ln=True, fill=True)
    pdf.ln(6)

    def section(title: str, rows: list[list[str]], headers: list[str], widths: list[int]):
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(38, 48, 26)
        pdf.cell(0, 8, title, ln=True)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(120, 120, 120)
        for h, w in zip(headers, widths):
            pdf.cell(w, 6, h, border="B")
        pdf.ln(6)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(30, 30, 30)
        for r in rows:
            for cell, w in zip(r, widths):
                pdf.cell(w, 5, str(cell)[:22], border=0)
            pdf.ln(5)
        pdf.ln(4)

    if show_weights:
        section("Evolucao do peso",
                [[w.get("date", ""), w.get("weight_kg", ""), w.get("body_fat_pct") or "-"] for w in data["weights"][:15]],
                ["Data", "Peso (kg)", "Gordura %"], [40, 40, 40])
    if show_meals:
        section("Refeicoes recentes",
                [[m.get("date", ""), m.get("name", ""), m.get("calories", "")] for m in data["meals"][:15]],
                ["Data", "Refeicao", "Kcal"], [30, 90, 30])
    if show_exercises:
        section("Exercicios",
                [[e.get("date", ""), e.get("name", ""), e.get("duration_min", ""), e.get("calories_burned", "")]
                 for e in data["exercises"][:15]],
                ["Data", "Exercicio", "Min", "Kcal"], [30, 70, 25, 30])
    if show_sleep:
        section("Sono",
                [[s.get("date", ""), s.get("hours", ""), s.get("quality", "")] for s in data["sleeps"][:10]],
                ["Data", "Horas", "Qualidade"], [40, 30, 40])

    pdf_bytes = bytes(pdf.output())
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="vitatracker-{ptype}-{u.get("name","user").replace(" ", "_")}.pdf"'},
    )
