from datetime import datetime, timezone
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from auth_utils import get_current_user, require_role


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:14]}"


def clean_doc(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return None

    result = dict(doc)
    result.pop("_id", None)
    return result


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    title: Optional[str] = Field(default=None, max_length=120)
    review: str = Field(min_length=3, max_length=3000)
    images: List[str] = Field(default_factory=list)


class ReviewUpdate(BaseModel):
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    title: Optional[str] = Field(default=None, max_length=120)
    review: Optional[str] = Field(default=None, min_length=3, max_length=3000)
    images: Optional[List[str]] = None


def build_reviews_router(db):
    router = APIRouter(tags=["Product Reviews"])

    async def current_user(request: Request):
        return await get_current_user(request, db)

    async def customer_user(user=Depends(current_user)):
        require_role(user, ["customer", "manager", "admin"])
        return user

    @router.get("/products/{product_id}/reviews")
    async def list_product_reviews(
        product_id: str,
        user=Depends(customer_user),
    ):
        product = await db.products.find_one(
            {"product_id": product_id, "active": True}
        )

        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        reviews = [
            clean_doc(review)
            async for review in db.reviews.find(
                {"product_id": product_id, "active": True}
            ).sort("created_at", -1)
        ]

        total_reviews = len(reviews)
        average_rating = (
            round(
                sum(int(review.get("rating", 0)) for review in reviews)
                / total_reviews,
                1,
            )
            if total_reviews
            else 0
        )

        breakdown = {
            str(star): sum(
                1
                for review in reviews
                if int(review.get("rating", 0)) == star
            )
            for star in range(1, 6)
        }

        own_review = next(
            (
                review
                for review in reviews
                if review.get("user_id") == user["user_id"]
            ),
            None,
        )

        return {
            "reviews": reviews,
            "total_reviews": total_reviews,
            "average_rating": average_rating,
            "rating_breakdown": breakdown,
            "own_review": own_review,
        }

    return router
