"""Billing / Premium subscriptions — Stripe checkout + webhook."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from deps import (
    STRIPE_API_KEY,
    _is_premium,
    current_user,
    db,
    new_id,
    now_utc,
)
from middleware.security import billing_rate_limit

router = APIRouter(tags=["billing"])
log = logging.getLogger("vitatracker.billing")


PLAN_CATALOG = {
    "monthly": {"amount": 19.90, "days": 30, "label": "Premium Mensal"},
    "annual": {"amount": 149.90, "days": 365, "label": "Premium Anual"},
}


class CheckoutIn(BaseModel):
    plan: Literal["monthly", "annual"]
    origin_url: Optional[str] = None


@router.post("/billing/checkout")
async def billing_checkout(payload: CheckoutIn, request: Request,
                           user: dict = Depends(current_user),
                           _rl: None = Depends(billing_rate_limit)):
    if not STRIPE_API_KEY:
        raise HTTPException(500, "Stripe não configurado")
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    except Exception as e:
        raise HTTPException(500, f"Biblioteca de pagamento indisponível: {e}")

    plan_info = PLAN_CATALOG[payload.plan]
    origin = (payload.origin_url or "").rstrip("/")
    if not origin:
        origin = str(request.base_url).rstrip("/")
    success_url = f"{origin}/billing-return?session_id={{CHECKOUT_SESSION_ID}}&status=success"
    cancel_url = f"{origin}/billing-return?status=cancel"

    checkout = StripeCheckout(
        api_key=STRIPE_API_KEY,
        webhook_url=f"{str(request.base_url).rstrip('/')}/api/webhook/stripe",
    )
    req = CheckoutSessionRequest(
        amount=plan_info["amount"],
        currency="brl",
        quantity=1,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user["user_id"],
            "plan": payload.plan,
            "days": str(plan_info["days"]),
            "email": user.get("email") or "",
        },
    )
    try:
        session = await checkout.create_checkout_session(req)
    except Exception as e:
        log.error("Stripe session error: %s", e)
        raise HTTPException(502, f"Falha ao criar sessão de pagamento: {e}")

    await db.payment_transactions.insert_one({
        "id": new_id("tx"),
        "user_id": user["user_id"],
        "session_id": session.session_id,
        "url": session.url,
        "amount": plan_info["amount"],
        "currency": "brl",
        "plan": payload.plan,
        "days": plan_info["days"],
        "status": "created",
        "payment_status": "unpaid",
        "created_at": now_utc().isoformat(),
        "metadata": req.metadata,
    })
    return {
        "session_id": session.session_id,
        "checkout_url": session.url,
        "plan": payload.plan,
        "amount": plan_info["amount"],
    }


async def _apply_paid_transaction(tx: dict) -> None:
    days = int(tx.get("days") or PLAN_CATALOG.get(tx.get("plan"), {}).get("days") or 30)
    user_id = tx["user_id"]
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "premium_expires_at": 1})
    now = now_utc()
    base = now
    if u and u.get("premium_expires_at"):
        try:
            cur = u["premium_expires_at"]
            cur_dt = datetime.fromisoformat(cur.replace("Z", "+00:00")) if isinstance(cur, str) else cur
            if cur_dt.tzinfo is None:
                cur_dt = cur_dt.replace(tzinfo=timezone.utc)
            if cur_dt > now:
                base = cur_dt
        except Exception:
            pass
    new_exp = base + timedelta(days=days)
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "subscription_tier": "premium",
            "premium_since": tx.get("paid_at") or now.isoformat(),
            "premium_expires_at": new_exp.isoformat(),
            "last_plan": tx.get("plan"),
        }},
    )


@router.get("/billing/status/{session_id}")
async def billing_status(session_id: str, user: dict = Depends(current_user)):
    if not STRIPE_API_KEY:
        raise HTTPException(500, "Stripe não configurado")
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx or tx["user_id"] != user["user_id"]:
        raise HTTPException(404, "Sessão não encontrada")

    if tx.get("status") == "paid":
        u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
        return {"status": "paid", "premium_expires_at": u.get("premium_expires_at") if u else None,
                "amount": tx["amount"], "plan": tx["plan"]}

    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
        checkout = StripeCheckout(api_key=STRIPE_API_KEY)
        st = await checkout.get_checkout_status(session_id)
    except Exception as e:
        raise HTTPException(502, f"Falha ao consultar pagamento: {e}")

    payment_status = st.payment_status
    session_status = st.status
    new_status = tx["status"]
    if payment_status == "paid" and session_status == "complete":
        new_status = "paid"
    elif session_status in ("expired",):
        new_status = "expired"

    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"status": new_status, "payment_status": payment_status,
                  "last_checked": now_utc().isoformat(),
                  "paid_at": now_utc().isoformat() if new_status == "paid" and tx["status"] != "paid" else tx.get("paid_at")}},
    )
    if new_status == "paid" and tx["status"] != "paid":
        tx_after = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        await _apply_paid_transaction(tx_after or tx)

    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {
        "status": new_status,
        "payment_status": payment_status,
        "session_status": session_status,
        "amount": tx["amount"],
        "plan": tx["plan"],
        "premium_expires_at": u.get("premium_expires_at") if u else None,
    }


@router.post("/webhook/stripe", include_in_schema=False)
async def stripe_webhook(request: Request):
    if not STRIPE_API_KEY:
        raise HTTPException(500, "Stripe não configurado")
    body = await request.body()
    sig = request.headers.get("stripe-signature")
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
        checkout = StripeCheckout(api_key=STRIPE_API_KEY)
        event = await checkout.handle_webhook(body, sig)
    except Exception as e:
        log.warning("Webhook parse error: %s", e)
        raise HTTPException(400, "Webhook inválido")

    await db.webhook_events.insert_one({
        "id": new_id("evt"),
        "event_id": event.event_id,
        "event_type": event.event_type,
        "session_id": event.session_id,
        "payment_status": event.payment_status,
        "metadata": event.metadata or {},
        "received_at": now_utc().isoformat(),
    })

    if event.payment_status == "paid" and event.session_id:
        tx = await db.payment_transactions.find_one({"session_id": event.session_id}, {"_id": 0})
        if tx and tx.get("status") != "paid":
            await db.payment_transactions.update_one(
                {"session_id": event.session_id},
                {"$set": {"status": "paid", "payment_status": "paid",
                          "paid_at": now_utc().isoformat()}},
            )
            tx_after = await db.payment_transactions.find_one({"session_id": event.session_id}, {"_id": 0})
            await _apply_paid_transaction(tx_after or tx)
    return {"ok": True}


@router.get("/billing/subscription")
async def my_subscription(user: dict = Depends(current_user)):
    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {}
    txs = await db.payment_transactions.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    return {
        "is_premium": _is_premium(u),
        "premium_expires_at": u.get("premium_expires_at"),
        "premium_since": u.get("premium_since"),
        "last_plan": u.get("last_plan"),
        "plans": PLAN_CATALOG,
        "transactions": txs,
    }


@router.get("/billing/plans")
async def billing_plans():
    return {"plans": [{"id": k, **v} for k, v in PLAN_CATALOG.items()]}
