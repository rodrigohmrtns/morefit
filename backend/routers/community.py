"""Community feed — posts, likes, comments."""
from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from deps import current_user, db, new_id, now_utc

router = APIRouter(tags=["community"])


class PostIn(BaseModel):
    text: str
    kind: Optional[Literal["update", "recipe", "workout", "photo"]] = "update"
    image_base64: Optional[str] = None


class CommentIn(BaseModel):
    text: str


@router.post("/community/posts")
async def create_post(payload: PostIn, user: dict = Depends(current_user)):
    post = {
        "id": new_id("post"),
        "user_id": user["user_id"],
        "author_name": user.get("name") or "Anônimo",
        "author_avatar": user.get("photo_base64"),
        "text": payload.text.strip(),
        "kind": payload.kind or "update",
        "image_base64": payload.image_base64,
        "likes": [],
        "comments_count": 0,
        "created_at": now_utc().isoformat(),
    }
    if not post["text"] and not post["image_base64"]:
        raise HTTPException(400, "Post vazio")
    await db.posts.insert_one(post)
    return {k: v for k, v in post.items() if k != "_id"}


@router.get("/community/posts")
async def list_posts(kind: Optional[str] = None, limit: int = 30):
    q: dict = {}
    if kind and kind != "all":
        q["kind"] = kind
    items = await db.posts.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"items": items}


@router.post("/community/posts/{post_id}/like")
async def toggle_like(post_id: str, user: dict = Depends(current_user)):
    p = await db.posts.find_one({"id": post_id}, {"_id": 0, "likes": 1})
    if not p:
        raise HTTPException(404, "Post não encontrado")
    likes = p.get("likes") or []
    uid = user["user_id"]
    if uid in likes:
        await db.posts.update_one({"id": post_id}, {"$pull": {"likes": uid}})
        return {"liked": False, "count": len(likes) - 1}
    await db.posts.update_one({"id": post_id}, {"$addToSet": {"likes": uid}})
    return {"liked": True, "count": len(likes) + 1}


@router.post("/community/posts/{post_id}/comments")
async def add_comment(post_id: str, payload: CommentIn, user: dict = Depends(current_user)):
    txt = payload.text.strip()
    if not txt:
        raise HTTPException(400, "Comentário vazio")
    c = {
        "id": new_id("cmt"),
        "post_id": post_id,
        "user_id": user["user_id"],
        "author_name": user.get("name") or "Anônimo",
        "text": txt,
        "created_at": now_utc().isoformat(),
    }
    await db.comments.insert_one(c)
    await db.posts.update_one({"id": post_id}, {"$inc": {"comments_count": 1}})
    return {k: v for k, v in c.items() if k != "_id"}


@router.get("/community/posts/{post_id}/comments")
async def list_comments(post_id: str):
    items = await db.comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return {"items": items}


@router.delete("/community/posts/{post_id}")
async def delete_post(post_id: str, user: dict = Depends(current_user)):
    await db.posts.delete_one({"id": post_id, "user_id": user["user_id"]})
    await db.comments.delete_many({"post_id": post_id})
    return {"ok": True}
