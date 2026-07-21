"""Food catalog + Meals (non-AI portions).

`/meals/analyze` (Gemini) lives in routers/coach.py.
"""
from __future__ import annotations

from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from deps import (
    MealIn,
    current_user,
    db,
    new_id,
    now_utc,
    today_iso,
)

router = APIRouter(tags=["food"])


_FOOD_DB: list[dict] = [
    {"id": "f_001", "name": "Arroz branco cozido", "unit": "100g", "calories": 130, "protein_g": 2.7, "carbs_g": 28, "fat_g": 0.3},
    {"id": "f_002", "name": "Feijão preto cozido", "unit": "100g", "calories": 132, "protein_g": 8.9, "carbs_g": 24, "fat_g": 0.5},
    {"id": "f_003", "name": "Peito de frango grelhado", "unit": "100g", "calories": 165, "protein_g": 31, "carbs_g": 0, "fat_g": 3.6},
    {"id": "f_004", "name": "Ovo cozido", "unit": "1 un (50g)", "calories": 77, "protein_g": 6.3, "carbs_g": 0.6, "fat_g": 5.3},
    {"id": "f_005", "name": "Pão francês", "unit": "1 un (50g)", "calories": 135, "protein_g": 4, "carbs_g": 27, "fat_g": 1.2},
    {"id": "f_006", "name": "Banana prata", "unit": "1 un (100g)", "calories": 89, "protein_g": 1.1, "carbs_g": 23, "fat_g": 0.3},
    {"id": "f_007", "name": "Maçã", "unit": "1 un (150g)", "calories": 78, "protein_g": 0.4, "carbs_g": 21, "fat_g": 0.3},
    {"id": "f_008", "name": "Leite integral", "unit": "200ml", "calories": 122, "protein_g": 6.4, "carbs_g": 9.6, "fat_g": 6.4},
    {"id": "f_009", "name": "Iogurte natural", "unit": "170g", "calories": 100, "protein_g": 10, "carbs_g": 12, "fat_g": 2.5},
    {"id": "f_010", "name": "Aveia em flocos", "unit": "30g", "calories": 117, "protein_g": 4.3, "carbs_g": 20, "fat_g": 2.1},
    {"id": "f_011", "name": "Batata doce cozida", "unit": "100g", "calories": 86, "protein_g": 1.6, "carbs_g": 20, "fat_g": 0.1},
    {"id": "f_012", "name": "Salada verde", "unit": "100g", "calories": 20, "protein_g": 1.5, "carbs_g": 3, "fat_g": 0.2},
    {"id": "f_013", "name": "Salmão grelhado", "unit": "100g", "calories": 208, "protein_g": 22, "carbs_g": 0, "fat_g": 13},
    {"id": "f_014", "name": "Café preto", "unit": "200ml", "calories": 2, "protein_g": 0.3, "carbs_g": 0, "fat_g": 0},
    {"id": "f_015", "name": "Whey Protein", "unit": "1 scoop (30g)", "calories": 120, "protein_g": 24, "carbs_g": 3, "fat_g": 1.5},
    {"id": "f_016", "name": "Abacate", "unit": "100g", "calories": 160, "protein_g": 2, "carbs_g": 9, "fat_g": 15},
    {"id": "f_017", "name": "Amêndoas", "unit": "30g", "calories": 174, "protein_g": 6.4, "carbs_g": 6, "fat_g": 15},
    {"id": "f_018", "name": "Pizza mussarela", "unit": "1 fatia (100g)", "calories": 266, "protein_g": 11, "carbs_g": 33, "fat_g": 10},
    {"id": "f_019", "name": "Coxinha de frango", "unit": "1 un (80g)", "calories": 265, "protein_g": 9, "carbs_g": 25, "fat_g": 15},
    {"id": "f_020", "name": "Açaí na tigela", "unit": "300g", "calories": 350, "protein_g": 4, "carbs_g": 55, "fat_g": 12},
]


@router.get("/foods/search")
async def food_search(q: str = "", limit: int = 20, user: dict = Depends(current_user)):
    ql = (q or "").strip().lower()
    if not ql:
        return {"items": _FOOD_DB[:limit]}
    matches = [f for f in _FOOD_DB if ql in f["name"].lower()]
    return {"items": matches[:limit]}


@router.get("/foods/barcode/{code}")
async def food_barcode(code: str, user: dict = Depends(current_user)):
    """Lookup food by barcode using OpenFoodFacts (public free API)."""
    async with httpx.AsyncClient(timeout=10) as http_client:
        try:
            r = await http_client.get(f"https://world.openfoodfacts.org/api/v2/product/{code}.json")
        except Exception as e:
            raise HTTPException(502, f"Falha na busca: {e}")
    if r.status_code != 200:
        raise HTTPException(404, "Produto não encontrado")
    data = r.json()
    if data.get("status") != 1 or not data.get("product"):
        raise HTTPException(404, "Produto não encontrado")
    p = data["product"]
    nutriments = p.get("nutriments", {}) or {}

    def n(key: str) -> float:
        try:
            return float(nutriments.get(key) or 0)
        except Exception:
            return 0.0

    name = p.get("product_name_pt") or p.get("product_name") or "Sem nome"
    brand = p.get("brands") or ""
    kcal = n("energy-kcal_100g") or (n("energy_100g") / 4.184)
    return {
        "id": f"barcode_{code}",
        "name": f"{name}{(' — ' + brand) if brand else ''}",
        "unit": "100g",
        "barcode": code,
        "calories": round(kcal),
        "protein_g": round(n("proteins_100g"), 1),
        "carbs_g": round(n("carbohydrates_100g"), 1),
        "fat_g": round(n("fat_100g"), 1),
        "image": p.get("image_small_url") or p.get("image_url"),
    }


class FoodFavIn(BaseModel):
    name: str
    unit: Optional[str] = None
    calories: float
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    source_id: Optional[str] = None


@router.post("/foods/favorites")
async def add_favorite(payload: FoodFavIn, user: dict = Depends(current_user)):
    entry = payload.dict()
    entry.update({
        "id": new_id("fav"), "user_id": user["user_id"],
        "created_at": now_utc().isoformat(),
    })
    await db.food_favorites.insert_one(entry)
    return {k: v for k, v in entry.items() if k != "_id"}


@router.get("/foods/favorites")
async def list_favorites(user: dict = Depends(current_user)):
    items = await db.food_favorites.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"items": items}


@router.delete("/foods/favorites/{fav_id}")
async def del_favorite(fav_id: str, user: dict = Depends(current_user)):
    await db.food_favorites.delete_one({"id": fav_id, "user_id": user["user_id"]})
    return {"ok": True}


# ============= Meals =============
@router.post("/meals")
async def add_meal(payload: MealIn, user: dict = Depends(current_user)):
    entry = payload.dict()
    entry.update({
        "id": new_id("meal"),
        "user_id": user["user_id"],
        "date": payload.date or today_iso(),
        "created_at": now_utc().isoformat(),
    })
    await db.meals.insert_one(entry)
    return {k: v for k, v in entry.items() if k != "_id"}


@router.get("/meals")
async def list_meals(user: dict = Depends(current_user), date: Optional[str] = None):
    q = {"user_id": user["user_id"]}
    if date:
        q["date"] = date
    items = await db.meals.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"items": items}


@router.delete("/meals/{meal_id}")
async def delete_meal(meal_id: str, user: dict = Depends(current_user)):
    await db.meals.delete_one({"id": meal_id, "user_id": user["user_id"]})
    return {"ok": True}
