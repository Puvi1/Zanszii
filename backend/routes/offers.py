from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from auth_utils import get_current_user, require_role


def clean_doc(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return None

    result = dict(doc)
    result.pop("_id", None)
    return result


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None

    try:
        parsed = datetime.fromisoformat(
            str(value).replace("Z", "+00:00")
        )
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="Invalid date format",
        )

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


class OfferCreate(BaseModel):
    code: str = Field(min_length=3, max_length=40)
    title: str = Field(min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)

    offer_type: Literal[
        "percentage",
        "flat",
        "free_delivery",
    ]

    discount_value: float = Field(default=0, ge=0)
    minimum_order_value: float = Field(default=0, ge=0)
    maximum_discount: Optional[float] = Field(default=None, ge=0)

    starts_at: Optional[str] = None
    expires_at: Optional[str] = None

    usage_limit: Optional[int] = Field(default=None, ge=1)
    per_user_limit: int = Field(default=1, ge=1, le=100)

    first_order_only: bool = False
    category_ids: List[str] = Field(default_factory=list)
    product_ids: List[str] = Field(default_factory=list)

    active: bool = True
    featured: bool = False

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value):
        return value.strip().upper()


class OfferUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=3, max_length=40)
    title: Optional[str] = Field(default=None, min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)

    offer_type: Optional[
        Literal["percentage", "flat", "free_delivery"]
    ] = None

    discount_value: Optional[float] = Field(default=None, ge=0)
    minimum_order_value: Optional[float] = Field(default=None, ge=0)
    maximum_discount: Optional[float] = Field(default=None, ge=0)

    starts_at: Optional[str] = None
    expires_at: Optional[str] = None

    usage_limit: Optional[int] = Field(default=None, ge=1)
    per_user_limit: Optional[int] = Field(default=None, ge=1, le=100)

    first_order_only: Optional[bool] = None
    category_ids: Optional[List[str]] = None
    product_ids: Optional[List[str]] = None

    active: Optional[bool] = None
    featured: Optional[bool] = None

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value):
        return value.strip().upper() if value else value


class OfferValidateIn(BaseModel):
    code: str = Field(min_length=3, max_length=40)
    subtotal: float = Field(ge=0)
    delivery_charge: float = Field(default=0, ge=0)
    items: List[dict] = Field(default_factory=list)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value):
        return value.strip().upper()


async def validate_and_calculate_offer(
    db,
    *,
    code: str,
    user_id: str,
    subtotal: float,
    delivery_charge: float = 0,
    items: Optional[List[dict]] = None,
) -> dict:
    normalized_code = code.strip().upper()

    offer = await db.offers.find_one(
        {
            "code": normalized_code,
            "active": True,
        }
    )

    if not offer:
        raise HTTPException(
            status_code=404,
            detail="Coupon code is invalid or inactive",
        )

    now = utc_now()
    starts_at = parse_datetime(offer.get("starts_at"))
    expires_at = parse_datetime(offer.get("expires_at"))

    if starts_at and now < starts_at:
        raise HTTPException(
            status_code=409,
            detail="This offer has not started yet",
        )

    if expires_at and now > expires_at:
        raise HTTPException(
            status_code=409,
            detail="This offer has expired",
        )

    usage_limit = offer.get("usage_limit")
    usage_count = int(offer.get("usage_count", 0) or 0)

    if usage_limit is not None and usage_count >= int(usage_limit):
        raise HTTPException(
            status_code=409,
            detail="This offer has reached its usage limit",
        )

    redemption_count = await db.offer_redemptions.count_documents(
        {
            "offer_id": offer["offer_id"],
            "user_id": user_id,
        }
    )

    if redemption_count >= int(offer.get("per_user_limit", 1) or 1):
        raise HTTPException(
            status_code=409,
            detail="You have already used this offer",
        )

    if offer.get("first_order_only"):
        existing_orders = await db.orders.count_documents(
            {"user_id": user_id}
        )

        if existing_orders > 0:
            raise HTTPException(
                status_code=409,
                detail="This offer is valid only on your first order",
            )

    minimum_order_value = float(
        offer.get("minimum_order_value", 0) or 0
    )

    if subtotal < minimum_order_value:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Minimum order value is ₹"
                f"{minimum_order_value:,.0f}"
            ),
        )

    applicable_subtotal = float(subtotal)
    items = items or []

    product_ids = set(offer.get("product_ids") or [])
    category_ids = set(offer.get("category_ids") or [])

    if product_ids or category_ids:
        applicable_subtotal = 0.0

        for item in items:
            product_id = item.get("product_id")
            product = await db.products.find_one(
                {"product_id": product_id}
            )

            if not product:
                continue

            product_matches = (
                not product_ids or product_id in product_ids
            )
            category_matches = (
                not category_ids
                or product.get("category_id") in category_ids
            )

            if product_matches and category_matches:
                applicable_subtotal += float(
                    item.get(
                        "line_total",
                        float(item.get("price", 0) or 0)
                        * int(item.get("quantity", 0) or 0),
                    )
                    or 0
                )

        if applicable_subtotal <= 0:
            raise HTTPException(
                status_code=409,
                detail="This offer does not apply to items in your order",
            )

    offer_type = offer["offer_type"]
    discount = 0.0
    free_delivery = False

    if offer_type == "percentage":
        discount = applicable_subtotal * (
            float(offer.get("discount_value", 0) or 0) / 100
        )

        maximum_discount = offer.get("maximum_discount")
        if maximum_discount is not None:
            discount = min(
                discount,
                float(maximum_discount),
            )

    elif offer_type == "flat":
        discount = min(
            float(offer.get("discount_value", 0) or 0),
            applicable_subtotal,
        )

    elif offer_type == "free_delivery":
        free_delivery = True

    discount = round(max(0.0, discount), 2)
    final_delivery_charge = (
        0.0 if free_delivery else float(delivery_charge)
    )
    total = round(
        max(
            0.0,
            float(subtotal)
            - discount
            + final_delivery_charge,
        ),
        2,
    )

    return {
        "offer_id": offer["offer_id"],
        "code": offer["code"],
        "title": offer.get("title"),
        "offer_type": offer_type,
        "discount": discount,
        "free_delivery": free_delivery,
        "delivery_charge": round(final_delivery_charge, 2),
        "subtotal": round(float(subtotal), 2),
        "total": total,
        "savings": round(
            discount
            + (
                float(delivery_charge)
                if free_delivery
                else 0
            ),
            2,
        ),
        "offer": clean_doc(offer),
    }


def build_offers_router(db, new_id, now_iso):
    router = APIRouter(tags=["Offers & Coupons"])

    async def current_user(request: Request):
        return await get_current_user(request, db)

    async def customer_user(user=Depends(current_user)):
        require_role(user, ["customer", "manager", "admin"])
        return user

    async def admin_user(user=Depends(current_user)):
        require_role(user, ["admin"])
        return user

    @router.get("/offers/available")
    async def available_offers(
        user=Depends(customer_user),
    ):
        now = utc_now()

        offers = []
        async for offer in db.offers.find(
            {"active": True}
        ).sort(
            [
                ("featured", -1),
                ("created_at", -1),
            ]
        ):
            starts_at = parse_datetime(offer.get("starts_at"))
            expires_at = parse_datetime(offer.get("expires_at"))

            if starts_at and now < starts_at:
                continue

            if expires_at and now > expires_at:
                continue

            usage_limit = offer.get("usage_limit")
            usage_count = int(
                offer.get("usage_count", 0) or 0
            )

            if (
                usage_limit is not None
                and usage_count >= int(usage_limit)
            ):
                continue

            user_usage = await db.offer_redemptions.count_documents(
                {
                    "offer_id": offer["offer_id"],
                    "user_id": user["user_id"],
                }
            )

            if user_usage >= int(
                offer.get("per_user_limit", 1) or 1
            ):
                continue

            offers.append(clean_doc(offer))

        return {"offers": offers}

    @router.post("/offers/validate")
    async def validate_offer(
        payload: OfferValidateIn,
        user=Depends(customer_user),
    ):
        return await validate_and_calculate_offer(
            db,
            code=payload.code,
            user_id=user["user_id"],
            subtotal=payload.subtotal,
            delivery_charge=payload.delivery_charge,
            items=payload.items,
        )

    @router.get("/admin/offers")
    async def admin_list_offers(
        user=Depends(admin_user),
    ):
        offers = [
            clean_doc(offer)
            async for offer in db.offers.find({}).sort(
                "created_at",
                -1,
            )
        ]

        return {"offers": offers}

    @router.post("/admin/offers")
    async def create_offer(
        payload: OfferCreate,
        user=Depends(admin_user),
    ):
        if await db.offers.find_one({"code": payload.code}):
            raise HTTPException(
                status_code=409,
                detail="An offer with this code already exists",
            )

        if (
            payload.offer_type == "percentage"
            and payload.discount_value > 100
        ):
            raise HTTPException(
                status_code=422,
                detail="Percentage discount cannot exceed 100",
            )

        if payload.starts_at:
            parse_datetime(payload.starts_at)

        if payload.expires_at:
            parse_datetime(payload.expires_at)

        offer = {
            "offer_id": new_id("off"),
            **payload.model_dump(),
            "usage_count": 0,
            "created_by": user["user_id"],
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }

        await db.offers.insert_one(offer)

        return clean_doc(offer)

    @router.patch("/admin/offers/{offer_id}")
    async def update_offer(
        offer_id: str,
        payload: OfferUpdate,
        user=Depends(admin_user),
    ):
        existing = await db.offers.find_one(
            {"offer_id": offer_id}
        )

        if not existing:
            raise HTTPException(
                status_code=404,
                detail="Offer not found",
            )

        updates = {
            key: value
            for key, value in payload.model_dump().items()
            if value is not None
        }

        if "code" in updates:
            duplicate = await db.offers.find_one(
                {
                    "code": updates["code"],
                    "offer_id": {"$ne": offer_id},
                }
            )

            if duplicate:
                raise HTTPException(
                    status_code=409,
                    detail="Another offer already uses this code",
                )

        if (
            updates.get("offer_type", existing.get("offer_type"))
            == "percentage"
            and float(
                updates.get(
                    "discount_value",
                    existing.get("discount_value", 0),
                )
                or 0
            )
            > 100
        ):
            raise HTTPException(
                status_code=422,
                detail="Percentage discount cannot exceed 100",
            )

        if "starts_at" in updates and updates["starts_at"]:
            parse_datetime(updates["starts_at"])

        if "expires_at" in updates and updates["expires_at"]:
            parse_datetime(updates["expires_at"])

        updates["updated_at"] = now_iso()

        await db.offers.update_one(
            {"offer_id": offer_id},
            {"$set": updates},
        )

        return clean_doc(
            await db.offers.find_one(
                {"offer_id": offer_id}
            )
        )

    @router.delete("/admin/offers/{offer_id}")
    async def delete_offer(
        offer_id: str,
        user=Depends(admin_user),
    ):
        result = await db.offers.delete_one(
            {"offer_id": offer_id}
        )

        if not result.deleted_count:
            raise HTTPException(
                status_code=404,
                detail="Offer not found",
            )

        return {"message": "Offer deleted successfully"}

    return router
