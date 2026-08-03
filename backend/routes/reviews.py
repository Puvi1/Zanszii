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

    async def review_owner_or_admin(
        review_id: str,
        user: dict,
    ) -> dict:
        review = await db.reviews.find_one({"review_id": review_id})

        if not review:
            raise HTTPException(
                status_code=404,
                detail="Review not found",
            )

        if (
            user.get("role") != "admin"
            and review.get("user_id") != user.get("user_id")
        ):
            raise HTTPException(
                status_code=403,
                detail="You can only manage your own review",
            )

        return review

    async def verify_purchase(
        product_id: str,
        user_id: str,
    ) -> bool:
        order = await db.orders.find_one(
            {
                "user_id": user_id,
                "status": "delivered",
                "items": {
                    "$elemMatch": {
                        "product_id": product_id,
                    }
                },
            }
        )
        return order is not None

    async def build_review_summary(
        product_id: str,
        user_id: Optional[str] = None,
    ) -> dict:
        reviews = [
            clean_doc(review)
            async for review in db.reviews.find(
                {
                    "product_id": product_id,
                    "active": True,
                }
            ).sort("created_at", -1)
        ]

        total_reviews = len(reviews)

        average_rating = (
            round(
                sum(
                    int(review.get("rating", 0))
                    for review in reviews
                )
                / total_reviews,
                1,
            )
            if total_reviews
            else 0
        )

        rating_breakdown = {
            str(star): sum(
                1
                for review in reviews
                if int(review.get("rating", 0)) == star
            )
            for star in range(1, 6)
        }

        own_review = None
        if user_id:
            own_review = next(
                (
                    review
                    for review in reviews
                    if review.get("user_id") == user_id
                ),
                None,
            )

        return {
            "reviews": reviews,
            "total_reviews": total_reviews,
            "average_rating": average_rating,
            "rating_breakdown": rating_breakdown,
            "own_review": own_review,
        }

    @router.get("/products/{product_id}/reviews")
    async def list_product_reviews(
        product_id: str,
        user=Depends(customer_user),
    ):
        product = await db.products.find_one(
            {
                "product_id": product_id,
                "active": True,
            }
        )

        if not product:
            raise HTTPException(
                status_code=404,
                detail="Product not found",
            )

        return await build_review_summary(
            product_id,
            user.get("user_id"),
        )

    @router.post("/products/{product_id}/reviews")
    async def create_product_review(
        product_id: str,
        payload: ReviewCreate,
        user=Depends(customer_user),
    ):
        product = await db.products.find_one(
            {
                "product_id": product_id,
                "active": True,
            }
        )

        if not product:
            raise HTTPException(
                status_code=404,
                detail="Product not found",
            )

        existing = await db.reviews.find_one(
            {
                "product_id": product_id,
                "user_id": user["user_id"],
            }
        )

        if existing:
            raise HTTPException(
                status_code=409,
                detail="You have already reviewed this product",
            )

        verified_purchase = await verify_purchase(
            product_id,
            user["user_id"],
        )

        if not verified_purchase and user.get("role") == "customer":
            raise HTTPException(
                status_code=403,
                detail="Only customers with a delivered order can review this product",
            )

        title = (
            payload.title.strip()
            if payload.title
            else None
        )

        review_text = payload.review.strip()

        if len(review_text) < 3:
            raise HTTPException(
                status_code=422,
                detail="Review must contain at least 3 characters",
            )

        review = {
            "review_id": new_id("rev"),
            "product_id": product_id,
            "user_id": user["user_id"],
            "customer_name": user.get("name") or "Customer",
            "customer_avatar": user.get("avatar_url"),
            "rating": int(payload.rating),
            "title": title,
            "review": review_text,
            "images": payload.images,
            "verified_purchase": verified_purchase,
            "helpful_count": 0,
            "helpful_user_ids": [],
            "active": True,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }

        await db.reviews.insert_one(review)

        return {
            "message": "Review submitted successfully",
            "review": clean_doc(review),
            "summary": await build_review_summary(
                product_id,
                user["user_id"],
            ),
        }

    @router.patch("/reviews/{review_id}")
    async def update_review(
        review_id: str,
        payload: ReviewUpdate,
        user=Depends(customer_user),
    ):
        existing = await review_owner_or_admin(
            review_id,
            user,
        )

        updates = {
            key: value
            for key, value in payload.model_dump().items()
            if value is not None
        }

        if not updates:
            raise HTTPException(
                status_code=400,
                detail="No review changes were provided",
            )

        if "title" in updates:
            updates["title"] = (
                updates["title"].strip()
                if updates["title"]
                else None
            )

        if "review" in updates:
            updates["review"] = updates["review"].strip()

            if len(updates["review"]) < 3:
                raise HTTPException(
                    status_code=422,
                    detail="Review must contain at least 3 characters",
                )

        updates["updated_at"] = now_iso()

        await db.reviews.update_one(
            {"review_id": review_id},
            {"$set": updates},
        )

        updated_review = await db.reviews.find_one(
            {"review_id": review_id}
        )

        return {
            "message": "Review updated successfully",
            "review": clean_doc(updated_review),
            "summary": await build_review_summary(
                existing["product_id"],
                user["user_id"],
            ),
        }

    @router.delete("/reviews/{review_id}")
    async def delete_review(
        review_id: str,
        user=Depends(customer_user),
    ):
        existing = await review_owner_or_admin(
            review_id,
            user,
        )

        await db.reviews.delete_one(
            {"review_id": review_id}
        )

        return {
            "message": "Review deleted successfully",
            "summary": await build_review_summary(
                existing["product_id"],
                user["user_id"],
            ),
        }

    @router.post("/reviews/{review_id}/helpful")
    async def toggle_review_helpful(
        review_id: str,
        user=Depends(customer_user),
    ):
        review = await db.reviews.find_one(
            {
                "review_id": review_id,
                "active": True,
            }
        )

        if not review:
            raise HTTPException(
                status_code=404,
                detail="Review not found",
            )

        user_id = user["user_id"]
        helpful_user_ids = list(
            review.get("helpful_user_ids", [])
        )

        if user_id in helpful_user_ids:
            helpful_user_ids.remove(user_id)
            marked_helpful = False
        else:
            helpful_user_ids.append(user_id)
            marked_helpful = True

        helpful_count = len(helpful_user_ids)

        await db.reviews.update_one(
            {"review_id": review_id},
            {
                "$set": {
                    "helpful_user_ids": helpful_user_ids,
                    "helpful_count": helpful_count,
                    "updated_at": now_iso(),
                }
            },
        )

        updated_review = await db.reviews.find_one(
            {"review_id": review_id}
        )

        return {
            "message": (
                "Marked as helpful"
                if marked_helpful
                else "Helpful vote removed"
            ),
            "marked_helpful": marked_helpful,
            "review": clean_doc(updated_review),
        }

    return router
