"""Zanszii — FastAPI backend for product, cart, order and delivery management."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import httpx
from datetime import datetime, timezone
from typing import Optional, List, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator

from auth_utils import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    set_auth_cookies,
    clear_auth_cookies,
    get_current_user,
    require_role,
)

from routes.reviews import build_reviews_router
from routes.notifications import build_notifications_router, create_notification
from routes.offers import build_offers_router, validate_and_calculate_offer

# ---------- Setup ----------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "zanszii")
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Zanszii API", version="1.0.0")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("zanszii")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:14]}"


def clean_doc(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return None
    doc = dict(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


PRIVATE_PRODUCT_FIELDS = {
    "wholesale_price",
    "packaging_cost",
    "delivery_cost",
    "other_cost",
    "total_cost",
    "profit",
    "profit_margin",
}


def public_product_doc(doc: Optional[dict]) -> Optional[dict]:
    item = clean_doc(doc)
    if not item:
        return None
    for field in PRIVATE_PRODUCT_FIELDS:
        item.pop(field, None)
    return item


def normalize_phone(value: Optional[str]) -> Optional[str]:
    if value is None or value == "":
        return None
    digits = "".join(ch for ch in str(value) if ch.isdigit())
    if len(digits) != 10:
        raise ValueError("Phone number must contain exactly 10 digits")
    return digits


# ---------- Models ----------
class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    name: str
    email: EmailStr
    role: Literal[
        "customer",
        "business_owner",
        "manager",
        "delivery_partner",
        "admin",
    ] = "customer"
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    active: bool = True
    created_at: Optional[str] = None


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    phone: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value):
        return normalize_phone(value)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionIn(BaseModel):
    session_id: str = Field(min_length=2)


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value):
        return normalize_phone(value)


class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: Optional[str] = Field(default=None, max_length=500)
    image_url: Optional[str] = None
    active: bool = True


class CategoryOrderItem(BaseModel):
    category_id: str
    display_order: int = Field(ge=0)


class CategoryReorderIn(BaseModel):
    items: List[CategoryOrderItem]


class VendorApplicationIn(BaseModel):
    business_name: str = Field(min_length=2, max_length=120)
    owner_name: str = Field(min_length=2, max_length=100)
    phone: str
    whatsapp: Optional[str] = None
    email: EmailStr
    business_type: str = Field(min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=2000)
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    address: str = Field(min_length=5, max_length=500)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    postal_code: str = Field(min_length=4, max_length=12)
    gst_number: Optional[str] = Field(default=None, max_length=30)
    business_license_url: Optional[str] = None
    pickup_address: Optional[str] = Field(default=None, max_length=500)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value):
        return normalize_phone(value)


class VendorApplicationReview(BaseModel):
    status: Literal[
        "pending",
        "changes_requested",
        "approved",
        "rejected",
    ]
    admin_note: Optional[str] = Field(default=None, max_length=1000)


class VendorStatusUpdate(BaseModel):
    status: Literal[
        "approved",
        "suspended",
        "deactivated",
    ]
    admin_note: Optional[str] = Field(default=None, max_length=1000)


class StoreIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    slug: str = Field(min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = Field(default=None, max_length=500)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    postal_code: Optional[str] = Field(default=None, max_length=12)
    active: bool = True
    featured: bool = False


class StoreUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    slug: Optional[str] = Field(default=None, min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = Field(default=None, max_length=500)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    postal_code: Optional[str] = Field(default=None, max_length=12)
    active: Optional[bool] = None
    featured: Optional[bool] = None


class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: Optional[str] = Field(default=None, max_length=3000)
    category_id: str
    store_id: Optional[str] = None
    price: float = Field(gt=0)
    stock: int = Field(default=0, ge=0)
    unit: str = Field(default="piece", min_length=1, max_length=30)
    image_url: Optional[str] = None
    images: List[str] = []
    active: bool = True
    featured: bool = False


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    description: Optional[str] = Field(default=None, max_length=3000)
    category_id: Optional[str] = None
    store_id: Optional[str] = None
    price: Optional[float] = Field(default=None, gt=0)
    stock: Optional[int] = Field(default=None, ge=0)
    unit: Optional[str] = Field(default=None, min_length=1, max_length=30)
    image_url: Optional[str] = None
    images: Optional[List[str]] = None
    active: Optional[bool] = None
    featured: Optional[bool] = None


class ProductCostUpdate(BaseModel):
    product_id: Optional[str] = None
    wholesale_price: float = Field(default=0, ge=0)
    packaging_cost: float = Field(default=0, ge=0)
    delivery_cost: float = Field(default=0, ge=0)
    other_cost: float = Field(default=0, ge=0)


class CartItemIn(BaseModel):
    product_id: str
    quantity: int = Field(ge=1, le=999)


class OrderCreate(BaseModel):
    delivery_address: str = Field(min_length=5, max_length=500)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    postal_code: str = Field(min_length=4, max_length=12)
    phone: str
    notes: Optional[str] = Field(default=None, max_length=1000)
    buy_now_item: Optional[CartItemIn] = None
    coupon_code: Optional[str] = Field(default=None, max_length=40)

class AddressIn(BaseModel):
    label: Literal["Home", "Office", "Other"] = "Home"
    full_name: str = Field(min_length=2, max_length=100)
    phone: str
    address: str = Field(min_length=5, max_length=500)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    postal_code: str = Field(min_length=4, max_length=12)
    landmark: Optional[str] = None
    is_default: bool = False

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value):
        return normalize_phone(value)


ORDER_STATUSES = [
    "placed",
    "confirmed",
    "processing",
    "out_for_delivery",
    "delivered",
    "cancelled",
]


class OrderStatusUpdate(BaseModel):
    status: Literal[
        "placed",
        "confirmed",
        "processing",
        "out_for_delivery",
        "delivered",
        "cancelled",
    ]
    note: Optional[str] = Field(default=None, max_length=500)


class AssignManagerIn(BaseModel):
    manager_id: Optional[str] = None


class ManagerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    phone: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value):
        return normalize_phone(value)


class DeliveryPartnerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    phone: str
    vehicle_type: Optional[str] = Field(default=None, max_length=50)
    vehicle_number: Optional[str] = Field(default=None, max_length=30)
    license_number: Optional[str] = Field(default=None, max_length=60)
    avatar_url: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value):
        return normalize_phone(value)


class DeliveryPartnerUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    phone: Optional[str] = None
    vehicle_type: Optional[str] = Field(default=None, max_length=50)
    vehicle_number: Optional[str] = Field(default=None, max_length=30)
    license_number: Optional[str] = Field(default=None, max_length=60)
    avatar_url: Optional[str] = None
    availability_status: Optional[Literal["available", "busy", "offline"]] = None
    active: Optional[bool] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value):
        return normalize_phone(value)


class AssignDeliveryPartnerIn(BaseModel):
    delivery_partner_id: Optional[str] = None


class DeliveryStatusUpdate(BaseModel):
    status: Literal[
        "assigned",
        "out_for_delivery",
        "delivered",
        "delivery_failed",
    ]
    note: Optional[str] = Field(default=None, max_length=500)


class UserStatusUpdate(BaseModel):
    active: bool


# ---------- Dependencies ----------
async def current_user(request: Request):
    return await get_current_user(request, db)


async def customer_user(user=Depends(current_user)):
    require_role(user, ["customer", "manager", "admin"])
    return user


async def manager_user(user=Depends(current_user)):
    require_role(user, ["manager", "admin"])
    return user


async def business_owner_user(user=Depends(current_user)):
    require_role(user, ["business_owner", "admin"])
    return user


async def delivery_partner_user(user=Depends(current_user)):
    require_role(user, ["delivery_partner", "admin"])
    return user


async def admin_user(user=Depends(current_user)):
    require_role(user, ["admin"])
    return user


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.categories.create_index("name", unique=True)
    await db.categories.create_index("display_order")
    await db.stores.create_index("store_id", unique=True)
    await db.stores.create_index("slug", unique=True)
    await db.stores.create_index([("active", 1), ("featured", 1)])
    await db.vendor_applications.create_index(
        "application_id",
        unique=True,
    )
    await db.vendor_applications.create_index(
        [("user_id", 1), ("status", 1)]
    )
    await db.vendor_applications.create_index(
        [("status", 1), ("created_at", -1)]
    )
    await db.products.create_index(
        [("name", "text"), ("description", "text")]
    )

    await db.orders.create_index("user_id")
    await db.orders.create_index("status")
    await db.orders.create_index("manager_id")
    await db.orders.create_index("delivery_partner_id")

    await db.users.create_index(
        [("role", 1), ("availability_status", 1)]
    )

    # Address Book indexes
    await db.addresses.create_index("user_id")
    await db.addresses.create_index("address_id", unique=True)

    # Product review indexes
    await db.reviews.create_index("review_id", unique=True)
    await db.reviews.create_index("product_id")
    await db.reviews.create_index(
        [("product_id", 1), ("user_id", 1)],
        unique=True,
    )

    # In-app notification indexes
    await db.notifications.create_index("notification_id", unique=True)
    await db.notifications.create_index(
        [("user_id", 1), ("created_at", -1)]
    )
    await db.notifications.create_index(
        [("user_id", 1), ("is_read", 1)]
    )

    # Offer and coupon indexes
    await db.offers.create_index("offer_id", unique=True)
    await db.offers.create_index("code", unique=True)
    await db.offers.create_index(
        [("active", 1), ("expires_at", 1)]
    )
    await db.offer_redemptions.create_index(
        [("offer_id", 1), ("user_id", 1)]
    )

    admin_email = (
        os.environ.get("ADMIN_EMAIL", "")
        .strip()
        .lower()
    )
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    admin_name = os.environ.get(
        "ADMIN_NAME",
        "ZANSZI Admin",
    )

    if (
        admin_email
        and admin_password
        and not await db.users.find_one(
            {"email": admin_email}
        )
    ):
        await db.users.insert_one(
            {
                "user_id": new_id("usr"),
                "name": admin_name,
                "email": admin_email,
                "password_hash": hash_password(
                    admin_password
                ),
                "role": "admin",
                "phone": None,
                "avatar_url": None,
                "address": None,
                "city": None,
                "state": None,
                "postal_code": None,
                "active": True,
                "created_at": now_iso(),
                "updated_at": now_iso(),
            }
        )

        logger.info(
            "Created initial ZANSZI admin: %s",
            admin_email,
        )

# ---------- Health ----------
@api.get("/")
async def api_root():
    return {"name": "Zanszii API", "status": "running"}


@api.get("/health")
async def health():
    await db.command("ping")
    return {"status": "ok", "database": "connected"}


# ---------- Auth ----------
def auth_response(user: dict, response: Response):
    access_token = create_access_token(user["user_id"], user["email"])
    refresh_token = create_refresh_token(user["user_id"])
    set_auth_cookies(response, access_token, refresh_token)
    return {
        "user": clean_doc(user),
        "access_token": access_token,
        "token_type": "bearer",
    }


@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = {
        "user_id": new_id("usr"),
        "name": payload.name.strip(),
        "email": email,
        "password_hash": hash_password(payload.password),
        "role": "customer",
        "phone": payload.phone,
        "avatar_url": None,
        "address": None,
        "city": None,
        "state": None,
        "postal_code": None,
        "active": True,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.users.insert_one(user)
    return auth_response(user, response)


@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    user = await db.users.find_one({"email": payload.email.lower().strip()})
    if not user or not user.get("password_hash") or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="This account is disabled")
    return auth_response(user, response)


@api.post("/auth/google-session")
async def google_session(payload: GoogleSessionIn, response: Response):
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http:
            result = await http.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": payload.session_id})
    except httpx.RequestError as exc:
        logger.exception("Google authentication request failed: %s", exc)
        raise HTTPException(status_code=502, detail="Google authentication service is unavailable")

    if result.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired Google session")

    try:
        google_data = result.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="Invalid authentication response")

    email = (google_data.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=401, detail="Google account email was not returned")

    user = await db.users.find_one({"email": email})
    if not user:
        user = {
            "user_id": new_id("usr"),
            "name": (google_data.get("name") or "Zanszii Customer").strip(),
            "email": email,
            "password_hash": None,
            "role": "customer",
            "phone": None,
            "avatar_url": google_data.get("picture"),
            "address": None,
            "city": None,
            "state": None,
            "postal_code": None,
            "active": True,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        await db.users.insert_one(user)
    elif not user.get("active", True):
        raise HTTPException(status_code=403, detail="This account is disabled")
    else:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {
                "name": google_data.get("name") or user.get("name"),
                "avatar_url": google_data.get("picture") or user.get("avatar_url"),
                "updated_at": now_iso(),
            }},
        )
        user = await db.users.find_one({"user_id": user["user_id"]})

    return auth_response(user, response)


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return clean_doc(user)


@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"message": "Logged out"}


@api.patch("/profile")
async def update_profile(payload: ProfileUpdate, user=Depends(current_user)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["updated_at"] = now_iso()
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    return clean_doc(await db.users.find_one({"user_id": user["user_id"]}))

# ---------- Address book ----------
@api.get("/addresses")
async def list_addresses(user=Depends(customer_user)):
    addresses = [
        clean_doc(address)
        async for address in db.addresses.find(
            {"user_id": user["user_id"]}
        ).sort([("is_default", -1), ("created_at", -1)])
    ]
    return addresses


@api.post("/addresses")
async def create_address(payload: AddressIn, user=Depends(customer_user)):
    address_count = await db.addresses.count_documents({
        "user_id": user["user_id"]
    })

    should_be_default = payload.is_default or address_count == 0

    if should_be_default:
        await db.addresses.update_many(
            {"user_id": user["user_id"]},
            {
                "$set": {
                    "is_default": False,
                    "updated_at": now_iso(),
                }
            },
        )

    address = {
        "address_id": new_id("adr"),
        "user_id": user["user_id"],
        **payload.model_dump(),
        "is_default": should_be_default,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    await db.addresses.insert_one(address)
    return clean_doc(address)


@api.patch("/addresses/{address_id}")
async def update_address(
    address_id: str,
    payload: AddressIn,
    user=Depends(customer_user),
):
    existing = await db.addresses.find_one({
        "address_id": address_id,
        "user_id": user["user_id"],
    })

    if not existing:
        raise HTTPException(
            status_code=404,
            detail="Address not found",
        )

    if payload.is_default:
        await db.addresses.update_many(
            {
                "user_id": user["user_id"],
                "address_id": {"$ne": address_id},
            },
            {
                "$set": {
                    "is_default": False,
                    "updated_at": now_iso(),
                }
            },
        )

    updates = payload.model_dump()
    updates["updated_at"] = now_iso()

    await db.addresses.update_one(
        {
            "address_id": address_id,
            "user_id": user["user_id"],
        },
        {"$set": updates},
    )

    return clean_doc(
        await db.addresses.find_one({
            "address_id": address_id,
            "user_id": user["user_id"],
        })
    )


@api.delete("/addresses/{address_id}")
async def delete_address(
    address_id: str,
    user=Depends(customer_user),
):
    existing = await db.addresses.find_one({
        "address_id": address_id,
        "user_id": user["user_id"],
    })

    if not existing:
        raise HTTPException(
            status_code=404,
            detail="Address not found",
        )

    await db.addresses.delete_one({
        "address_id": address_id,
        "user_id": user["user_id"],
    })

    if existing.get("is_default"):
        next_address = await db.addresses.find_one(
            {"user_id": user["user_id"]},
            sort=[("created_at", -1)],
        )

        if next_address:
            await db.addresses.update_one(
                {"address_id": next_address["address_id"]},
                {
                    "$set": {
                        "is_default": True,
                        "updated_at": now_iso(),
                    }
                },
            )

    return {"message": "Address deleted"}


@api.patch("/addresses/{address_id}/default")
async def set_default_address(
    address_id: str,
    user=Depends(customer_user),
):
    existing = await db.addresses.find_one({
        "address_id": address_id,
        "user_id": user["user_id"],
    })

    if not existing:
        raise HTTPException(
            status_code=404,
            detail="Address not found",
        )

    await db.addresses.update_many(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "is_default": False,
                "updated_at": now_iso(),
            }
        },
    )

    await db.addresses.update_one(
        {
            "address_id": address_id,
            "user_id": user["user_id"],
        },
        {
            "$set": {
                "is_default": True,
                "updated_at": now_iso(),
            }
        },
    )

    return clean_doc(
        await db.addresses.find_one({
            "address_id": address_id,
            "user_id": user["user_id"],
        })
    )
# ---------- Categories ----------
@api.get("/categories")
async def list_categories(include_inactive: bool = False, user=Depends(customer_user)):
    query = {} if include_inactive and user["role"] == "admin" else {"active": True}
    return [
        clean_doc(x)
        async for x in db.categories.find(query).sort(
            [("display_order", 1), ("name", 1)]
        )
    ]


@api.post("/categories")
async def create_category(payload: CategoryIn, user=Depends(admin_user)):
    if await db.categories.find_one({"name": {"$regex": f"^{payload.name.strip()}$", "$options": "i"}}):
        raise HTTPException(status_code=409, detail="Category already exists")
    last_category = await db.categories.find_one(
        {},
        sort=[("display_order", -1)],
    )
    next_order = int(last_category.get("display_order", -1) or -1) + 1 if last_category else 0

    category = {
        "category_id": new_id("cat"),
        **payload.model_dump(),
        "name": payload.name.strip(),
        "display_order": next_order,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.categories.insert_one(category)
    return clean_doc(category)


@api.patch("/categories/{category_id}")
async def update_category(category_id: str, payload: CategoryIn, user=Depends(admin_user)):
    existing = await db.categories.find_one({"category_id": category_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")
    updates = payload.model_dump()
    updates["updated_at"] = now_iso()
    await db.categories.update_one({"category_id": category_id}, {"$set": updates})
    return clean_doc(await db.categories.find_one({"category_id": category_id}))


@api.put("/categories/reorder")
async def reorder_categories(
    payload: CategoryReorderIn,
    user=Depends(admin_user),
):
    existing_ids = {
        item["category_id"]
        async for item in db.categories.find(
            {},
            {"_id": 0, "category_id": 1},
        )
    }

    payload_ids = [item.category_id for item in payload.items]

    if len(payload_ids) != len(set(payload_ids)):
        raise HTTPException(
            status_code=422,
            detail="Duplicate category IDs are not allowed",
        )

    invalid_ids = [
        category_id
        for category_id in payload_ids
        if category_id not in existing_ids
    ]

    if invalid_ids:
        raise HTTPException(
            status_code=400,
            detail="One or more categories are invalid",
        )

    for item in payload.items:
        await db.categories.update_one(
            {"category_id": item.category_id},
            {
                "$set": {
                    "display_order": item.display_order,
                    "updated_at": now_iso(),
                }
            },
        )

    return {
        "message": "Category order updated successfully",
        "categories": [
            clean_doc(category)
            async for category in db.categories.find({}).sort(
                [("display_order", 1), ("name", 1)]
            )
        ],
    }


@api.delete("/categories/{category_id}")
async def delete_category(category_id: str, user=Depends(admin_user)):
    if await db.products.count_documents({"category_id": category_id}) > 0:
        raise HTTPException(status_code=409, detail="Move or delete products in this category first")
    result = await db.categories.delete_one({"category_id": category_id})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}


# ---------- Vendor applications ----------
@api.get("/vendor-applications/me")
async def my_vendor_application(user=Depends(current_user)):
    application = await db.vendor_applications.find_one(
        {"user_id": user["user_id"]},
        sort=[("created_at", -1)],
    )
    return clean_doc(application)


@api.post("/vendor-applications")
async def create_vendor_application(
    payload: VendorApplicationIn,
    user=Depends(current_user),
):
    if user["role"] not in ["customer", "business_owner"]:
        raise HTTPException(
            status_code=403,
            detail="This account cannot submit a vendor application",
        )

    existing = await db.vendor_applications.find_one({
        "user_id": user["user_id"],
        "status": {
            "$in": [
                "pending",
                "changes_requested",
                "approved",
            ]
        },
    })

    if existing:
        raise HTTPException(
            status_code=409,
            detail="You already have an active vendor application",
        )

    application = {
        "application_id": new_id("vap"),
        "user_id": user["user_id"],
        "business_name": payload.business_name.strip(),
        "owner_name": payload.owner_name.strip(),
        "phone": payload.phone,
        "whatsapp": payload.whatsapp,
        "email": str(payload.email).lower().strip(),
        "business_type": payload.business_type.strip(),
        "description": payload.description,
        "logo_url": payload.logo_url,
        "banner_url": payload.banner_url,
        "address": payload.address.strip(),
        "city": payload.city.strip(),
        "state": payload.state.strip(),
        "postal_code": payload.postal_code.strip(),
        "gst_number": payload.gst_number,
        "business_license_url": payload.business_license_url,
        "pickup_address": payload.pickup_address,
        "status": "pending",
        "admin_note": None,
        "reviewed_by": None,
        "reviewed_at": None,
        "store_id": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    await db.vendor_applications.insert_one(application)
    return clean_doc(application)


@api.patch("/vendor-applications/{application_id}")
async def update_vendor_application(
    application_id: str,
    payload: VendorApplicationIn,
    user=Depends(current_user),
):
    application = await db.vendor_applications.find_one({
        "application_id": application_id,
        "user_id": user["user_id"],
    })

    if not application:
        raise HTTPException(
            status_code=404,
            detail="Vendor application not found",
        )

    if application.get("status") not in [
        "pending",
        "changes_requested",
    ]:
        raise HTTPException(
            status_code=409,
            detail="This application can no longer be edited",
        )

    updates = payload.model_dump()
    updates["business_name"] = payload.business_name.strip()
    updates["owner_name"] = payload.owner_name.strip()
    updates["email"] = str(payload.email).lower().strip()
    updates["business_type"] = payload.business_type.strip()
    updates["address"] = payload.address.strip()
    updates["city"] = payload.city.strip()
    updates["state"] = payload.state.strip()
    updates["postal_code"] = payload.postal_code.strip()
    updates["status"] = "pending"
    updates["admin_note"] = None
    updates["updated_at"] = now_iso()

    await db.vendor_applications.update_one(
        {"application_id": application_id},
        {"$set": updates},
    )

    return clean_doc(
        await db.vendor_applications.find_one({
            "application_id": application_id
        })
    )


@api.get("/admin/vendor-applications")
async def list_vendor_applications(
    status: Optional[str] = None,
    user=Depends(admin_user),
):
    query = {"status": status} if status else {}

    return [
        clean_doc(item)
        async for item in db.vendor_applications.find(query).sort(
            "created_at",
            -1,
        )
    ]


@api.get("/admin/vendor-applications/{application_id}")
async def get_vendor_application(
    application_id: str,
    user=Depends(admin_user),
):
    application = await db.vendor_applications.find_one({
        "application_id": application_id
    })

    if not application:
        raise HTTPException(
            status_code=404,
            detail="Vendor application not found",
        )

    result = clean_doc(application)
    result["account"] = clean_doc(
        await db.users.find_one({
            "user_id": application.get("user_id")
        })
    )
    return result


@api.patch("/admin/vendor-applications/{application_id}/review")
async def review_vendor_application(
    application_id: str,
    payload: VendorApplicationReview,
    user=Depends(admin_user),
):
    application = await db.vendor_applications.find_one({
        "application_id": application_id
    })

    if not application:
        raise HTTPException(
            status_code=404,
            detail="Vendor application not found",
        )

    if application.get("status") == "approved":
        raise HTTPException(
            status_code=409,
            detail="This application is already approved",
        )

    update = {
        "status": payload.status,
        "admin_note": payload.admin_note,
        "reviewed_by": user["user_id"],
        "reviewed_at": now_iso(),
        "updated_at": now_iso(),
    }

    if payload.status == "approved":
        store_slug_base = "".join(
            ch.lower() if ch.isalnum() else "-"
            for ch in application["business_name"]
        ).strip("-")
        store_slug = store_slug_base or new_id("store")

        suffix = 1
        candidate = store_slug
        while await db.stores.find_one({"slug": candidate}):
            suffix += 1
            candidate = f"{store_slug}-{suffix}"
        store_slug = candidate

        store = {
            "store_id": new_id("str"),
            "owner_user_id": application["user_id"],
            "application_id": application_id,
            "name": application["business_name"],
            "slug": store_slug,
            "description": application.get("description"),
            "logo_url": application.get("logo_url"),
            "banner_url": application.get("banner_url"),
            "phone": application.get("phone"),
            "whatsapp": application.get("whatsapp"),
            "email": application.get("email"),
            "address": application.get("address"),
            "city": application.get("city"),
            "state": application.get("state"),
            "postal_code": application.get("postal_code"),
            "business_type": application.get("business_type"),
            "gst_number": application.get("gst_number"),
            "pickup_address": application.get("pickup_address"),
            "vendor_status": "approved",
            "active": True,
            "featured": False,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }

        await db.stores.insert_one(store)

        await db.users.update_one(
            {"user_id": application["user_id"]},
            {
                "$set": {
                    "role": "business_owner",
                    "store_id": store["store_id"],
                    "updated_at": now_iso(),
                }
            },
        )

        update["store_id"] = store["store_id"]

    await db.vendor_applications.update_one(
        {"application_id": application_id},
        {"$set": update},
    )

    return clean_doc(
        await db.vendor_applications.find_one({
            "application_id": application_id
        })
    )


@api.get("/admin/vendors")
async def list_vendors(user=Depends(admin_user)):
    vendors = []

    async for store in db.stores.find({}).sort("created_at", -1):
        item = clean_doc(store)
        item["owner"] = clean_doc(
            await db.users.find_one({
                "user_id": store.get("owner_user_id")
            })
        )
        item["product_count"] = await db.products.count_documents({
            "store_id": store["store_id"]
        })
        vendors.append(item)

    return vendors


@api.patch("/admin/vendors/{store_id}/status")
async def update_vendor_status(
    store_id: str,
    payload: VendorStatusUpdate,
    user=Depends(admin_user),
):
    store = await db.stores.find_one({"store_id": store_id})

    if not store:
        raise HTTPException(
            status_code=404,
            detail="Vendor store not found",
        )

    active = payload.status == "approved"

    await db.stores.update_one(
        {"store_id": store_id},
        {
            "$set": {
                "vendor_status": payload.status,
                "active": active,
                "admin_note": payload.admin_note,
                "updated_at": now_iso(),
            }
        },
    )

    if store.get("owner_user_id"):
        await db.users.update_one(
            {"user_id": store["owner_user_id"]},
            {
                "$set": {
                    "active": payload.status != "deactivated",
                    "updated_at": now_iso(),
                }
            },
        )

    if not active:
        await db.products.update_many(
            {"store_id": store_id},
            {
                "$set": {
                    "active": False,
                    "updated_at": now_iso(),
                }
            },
        )

    return clean_doc(
        await db.stores.find_one({"store_id": store_id})
    )


# ---------- Stores ----------
@api.get("/stores")
async def list_stores(
    featured: Optional[bool] = None,
    include_inactive: bool = False,
    user=Depends(customer_user),
):
    query = {}

    if not (include_inactive and user["role"] == "admin"):
        query["active"] = True

    if featured is not None:
        query["featured"] = featured

    stores = []

    async for store in db.stores.find(query).sort(
        [("featured", -1), ("name", 1)]
    ):
        item = clean_doc(store)
        item["product_count"] = await db.products.count_documents({
            "store_id": store["store_id"],
            "active": True,
        })
        stores.append(item)

    return stores


@api.get("/stores/{store_id_or_slug}")
async def get_store(
    store_id_or_slug: str,
    user=Depends(customer_user),
):
    store = await db.stores.find_one({
        "$or": [
            {"store_id": store_id_or_slug},
            {"slug": store_id_or_slug},
        ]
    })

    if not store or (
        not store.get("active", True)
        and user["role"] != "admin"
    ):
        raise HTTPException(
            status_code=404,
            detail="Store not found",
        )

    item = clean_doc(store)

    product_query = {"store_id": store["store_id"]}
    if user["role"] != "admin":
        product_query["active"] = True

    products = []

    async for product in db.products.find(product_query).sort(
        "created_at",
        -1,
    ):
        product_item = (
            clean_doc(product)
            if user["role"] == "admin"
            else public_product_doc(product)
        )
        category = await db.categories.find_one({
            "category_id": product.get("category_id")
        })
        product_item["category"] = clean_doc(category)
        products.append(product_item)

    item["products"] = products
    item["product_count"] = len(products)

    return item


@api.post("/stores")
async def create_store(
    payload: StoreIn,
    user=Depends(admin_user),
):
    name = payload.name.strip()
    slug = payload.slug.strip().lower()

    duplicate = await db.stores.find_one({
        "$or": [
            {
                "name": {
                    "$regex": f"^{name}$",
                    "$options": "i",
                }
            },
            {"slug": slug},
        ]
    })

    if duplicate:
        raise HTTPException(
            status_code=409,
            detail="Store name or slug already exists",
        )

    store = {
        "store_id": new_id("str"),
        **payload.model_dump(),
        "name": name,
        "slug": slug,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    await db.stores.insert_one(store)
    return clean_doc(store)


@api.patch("/stores/{store_id}")
async def update_store(
    store_id: str,
    payload: StoreUpdate,
    user=Depends(admin_user),
):
    existing = await db.stores.find_one({"store_id": store_id})

    if not existing:
        raise HTTPException(
            status_code=404,
            detail="Store not found",
        )

    updates = {
        key: value
        for key, value in payload.model_dump().items()
        if value is not None
    }

    if "name" in updates:
        updates["name"] = updates["name"].strip()

    if "slug" in updates:
        updates["slug"] = updates["slug"].strip().lower()

    if "name" in updates or "slug" in updates:
        conflict_query = {
            "store_id": {"$ne": store_id},
            "$or": [],
        }

        if "name" in updates:
            conflict_query["$or"].append({
                "name": {
                    "$regex": f"^{updates['name']}$",
                    "$options": "i",
                }
            })

        if "slug" in updates:
            conflict_query["$or"].append({
                "slug": updates["slug"]
            })

        if conflict_query["$or"] and await db.stores.find_one(
            conflict_query
        ):
            raise HTTPException(
                status_code=409,
                detail="Store name or slug already exists",
            )

    updates["updated_at"] = now_iso()

    await db.stores.update_one(
        {"store_id": store_id},
        {"$set": updates},
    )

    return clean_doc(
        await db.stores.find_one({"store_id": store_id})
    )


@api.delete("/stores/{store_id}")
async def delete_store(
    store_id: str,
    user=Depends(admin_user),
):
    if await db.products.count_documents({
        "store_id": store_id
    }) > 0:
        raise HTTPException(
            status_code=409,
            detail="Move or delete this store's products first",
        )

    result = await db.stores.delete_one({
        "store_id": store_id
    })

    if not result.deleted_count:
        raise HTTPException(
            status_code=404,
            detail="Store not found",
        )

    return {"message": "Store deleted"}


# ---------- Products ----------
@api.get("/products")
async def list_products(
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    featured: Optional[bool] = None,
    include_inactive: bool = False,
    user=Depends(customer_user),
):
    query = {}
    if not (include_inactive and user["role"] == "admin"):
        query["active"] = True
    if category_id:
        query["category_id"] = category_id
    if featured is not None:
        query["featured"] = featured
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]

    products = []
    async for product in db.products.find(query).sort("created_at", -1):
        item = clean_doc(product) if user["role"] == "admin" else public_product_doc(product)
        category = await db.categories.find_one({"category_id": product.get("category_id")})
        store = None
        if product.get("store_id"):
            store = await db.stores.find_one({
                "store_id": product.get("store_id")
            })
        item["category"] = clean_doc(category)
        item["store"] = clean_doc(store)
        products.append(item)
    return products


@api.get("/products/{product_id}")
async def get_product(product_id: str, user=Depends(customer_user)):
    product = await db.products.find_one({"product_id": product_id})
    if not product or (not product.get("active", True) and user["role"] != "admin"):
        raise HTTPException(status_code=404, detail="Product not found")

    result = clean_doc(product) if user["role"] == "admin" else public_product_doc(product)
    result["category"] = clean_doc(
        await db.categories.find_one({"category_id": product.get("category_id")})
    )
    result["store"] = clean_doc(
        await db.stores.find_one({
            "store_id": product.get("store_id")
        })
        if product.get("store_id")
        else None
    )
    return result


@api.post("/products")
async def create_product(payload: ProductIn, user=Depends(admin_user)):
    if not await db.categories.find_one({"category_id": payload.category_id}):
        raise HTTPException(status_code=400, detail="Invalid category")
    if payload.store_id and not await db.stores.find_one({
        "store_id": payload.store_id,
        "active": True,
    }):
        raise HTTPException(status_code=400, detail="Invalid store")
    product = {
        "product_id": new_id("prd"),
        **payload.model_dump(),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.products.insert_one(product)
    return clean_doc(product)


@api.patch("/products/{product_id}")
async def update_product(product_id: str, payload: ProductUpdate, user=Depends(admin_user)):
    if not await db.products.find_one({"product_id": product_id}):
        raise HTTPException(status_code=404, detail="Product not found")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "category_id" in updates and not await db.categories.find_one({"category_id": updates["category_id"]}):
        raise HTTPException(status_code=400, detail="Invalid category")
    if "store_id" in updates and updates["store_id"] and not await db.stores.find_one({
        "store_id": updates["store_id"]
    }):
        raise HTTPException(status_code=400, detail="Invalid store")
    updates["updated_at"] = now_iso()
    await db.products.update_one({"product_id": product_id}, {"$set": updates})
    return clean_doc(await db.products.find_one({"product_id": product_id}))


@api.delete("/products/{product_id}")
async def delete_product(product_id: str, user=Depends(admin_user)):
    result = await db.products.delete_one({"product_id": product_id})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.carts.update_many({}, {"$pull": {"items": {"product_id": product_id}}})
    return {"message": "Product deleted"}



# ---------- Admin product costs ----------
@api.get("/admin/products")
async def admin_products(user=Depends(admin_user)):
    products = []
    async for product in db.products.find({}).sort("created_at", -1):
        item = clean_doc(product)
        category = await db.categories.find_one(
            {"category_id": product.get("category_id")}
        )
        item["category"] = clean_doc(category)
        item.setdefault("wholesale_price", 0.0)
        item.setdefault("packaging_cost", 0.0)
        item.setdefault("delivery_cost", 0.0)
        item.setdefault("other_cost", 0.0)
        products.append(item)
    return {"products": products}


@api.get("/admin/product-costs")
async def get_product_costs(user=Depends(admin_user)):
    costs = []
    projection = {
        "_id": 0,
        "product_id": 1,
        "wholesale_price": 1,
        "packaging_cost": 1,
        "delivery_cost": 1,
        "other_cost": 1,
        "updated_at": 1,
    }

    async for product in db.products.find({}, projection).sort("created_at", -1):
        costs.append({
            "product_id": product["product_id"],
            "wholesale_price": float(product.get("wholesale_price", 0) or 0),
            "packaging_cost": float(product.get("packaging_cost", 0) or 0),
            "delivery_cost": float(product.get("delivery_cost", 0) or 0),
            "other_cost": float(product.get("other_cost", 0) or 0),
            "updated_at": product.get("updated_at"),
        })

    return {"costs": costs}


@api.put("/admin/product-costs/{product_id}")
async def save_product_cost(
    product_id: str,
    payload: ProductCostUpdate,
    user=Depends(admin_user),
):
    product = await db.products.find_one({"product_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    cost_data = {
        "wholesale_price": round(float(payload.wholesale_price), 2),
        "packaging_cost": round(float(payload.packaging_cost), 2),
        "delivery_cost": round(float(payload.delivery_cost), 2),
        "other_cost": round(float(payload.other_cost), 2),
        "updated_at": now_iso(),
    }

    await db.products.update_one(
        {"product_id": product_id},
        {"$set": cost_data},
    )

    selling_price = float(product.get("price", 0) or 0)
    total_cost = round(
        cost_data["wholesale_price"]
        + cost_data["packaging_cost"]
        + cost_data["delivery_cost"]
        + cost_data["other_cost"],
        2,
    )
    profit = round(selling_price - total_cost, 2)
    profit_margin = round(
        (profit / selling_price) * 100 if selling_price > 0 else 0,
        2,
    )

    return {
        "message": "Product cost saved successfully",
        "product_id": product_id,
        "wholesale_price": cost_data["wholesale_price"],
        "packaging_cost": cost_data["packaging_cost"],
        "delivery_cost": cost_data["delivery_cost"],
        "other_cost": cost_data["other_cost"],
        "selling_price": selling_price,
        "total_cost": total_cost,
        "profit": profit,
        "profit_margin": profit_margin,
    }


@api.delete("/admin/product-costs/{product_id}")
async def delete_product_cost(product_id: str, user=Depends(admin_user)):
    product = await db.products.find_one({"product_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    await db.products.update_one(
        {"product_id": product_id},
        {
            "$unset": {
                "wholesale_price": "",
                "packaging_cost": "",
                "delivery_cost": "",
                "other_cost": "",
            },
            "$set": {"updated_at": now_iso()},
        },
    )

    return {
        "message": "Product cost details deleted successfully",
        "product_id": product_id,
    }


# ---------- Coupon profitability analytics ----------
@api.get("/admin/offers/analytics")
async def admin_offer_analytics(user=Depends(admin_user)):
    offers = [
        clean_doc(offer)
        async for offer in db.offers.find({}).sort("created_at", -1)
    ]

    coupon_rows = []
    order_rows = []
    product_aggregate = {}
    overall_customer_ids = set()

    summary = {
        "total_coupons": len(offers),
        "active_coupons": 0,
        "expired_coupons": 0,
        "orders": 0,
        "customers": 0,
        "gross_sales": 0.0,
        "discount_given": 0.0,
        "net_revenue": 0.0,
        "product_cost": 0.0,
        "net_profit": 0.0,
        "total_loss": 0.0,
        "loss_orders": 0,
        "profit_orders": 0,
    }

    now = datetime.now(timezone.utc)

    for offer in offers:
        if offer.get("active", True):
            expires_at = offer.get("expires_at")
            if expires_at:
                try:
                    expiry = datetime.fromisoformat(
                        str(expires_at).replace("Z", "+00:00")
                    )
                    if expiry < now:
                        summary["expired_coupons"] += 1
                    else:
                        summary["active_coupons"] += 1
                except ValueError:
                    summary["active_coupons"] += 1
            else:
                summary["active_coupons"] += 1

        offer_id = offer.get("offer_id")
        code = offer.get("code")

        orders = [
            clean_doc(order)
            async for order in db.orders.find({
                "$or": [
                    {"offer_id": offer_id},
                    {"coupon_code": code},
                ]
            }).sort("created_at", -1)
        ]

        coupon_customer_ids = set()
        coupon_gross = 0.0
        coupon_discount = 0.0
        coupon_net_revenue = 0.0
        coupon_cost = 0.0
        coupon_profit = 0.0
        coupon_loss = 0.0
        coupon_loss_orders = 0

        for order in orders:
            order_id = order.get("order_id")
            gross_sales = round(
                float(
                    order.get(
                        "subtotal",
                        sum(
                            float(item.get("line_total", 0) or 0)
                            for item in order.get("items", [])
                        ),
                    )
                    or 0
                ),
                2,
            )
            discount = round(
                float(order.get("discount", 0) or 0),
                2,
            )
            net_revenue = round(
                float(order.get("total", gross_sales - discount) or 0),
                2,
            )

            customer_key = (
                order.get("user_id")
                or order.get("customer_email")
                or order.get("customer_name")
            )
            if customer_key:
                coupon_customer_ids.add(customer_key)
                overall_customer_ids.add(customer_key)

            product_map = {}
            for item in order.get("items", []):
                product_map[item.get("product_id")] = (
                    await db.products.find_one({
                        "product_id": item.get("product_id")
                    })
                    or {}
                )

            enriched_items = order.get("items", [])
            needs_recalculation = any(
                "allocated_discount" not in item
                or "total_cost" not in item
                for item in enriched_items
            )

            if needs_recalculation:
                enriched_items = allocate_order_discount_and_costs(
                    enriched_items,
                    discount,
                    product_map,
                )

            order_cost = round(
                sum(
                    float(item.get("total_cost", 0) or 0)
                    for item in enriched_items
                ),
                2,
            )
            order_profit = round(net_revenue - order_cost, 2)
            order_loss = (
                round(abs(order_profit), 2)
                if order_profit < 0
                else 0.0
            )

            if order_loss > 0:
                coupon_loss_orders += 1

            coupon_gross += gross_sales
            coupon_discount += discount
            coupon_net_revenue += net_revenue
            coupon_cost += order_cost
            coupon_profit += order_profit
            coupon_loss += order_loss

            order_rows.append({
                "order_id": order_id,
                "order_number": order.get("order_number"),
                "created_at": order.get("created_at"),
                "customer_name": order.get("customer_name"),
                "customer_email": order.get("customer_email"),
                "coupon_code": code,
                "gross_sales": gross_sales,
                "discount_given": discount,
                "net_revenue": net_revenue,
                "product_cost": order_cost,
                "net_profit": order_profit,
                "loss": order_loss,
                "profit_margin": round(
                    (order_profit / net_revenue) * 100
                    if net_revenue > 0
                    else 0.0,
                    2,
                ),
                "items": enriched_items,
            })

            for item in enriched_items:
                product_id = item.get("product_id")
                key = (code, product_id)

                row = product_aggregate.setdefault(
                    key,
                    {
                        "coupon_code": code,
                        "offer_id": offer_id,
                        "product_id": product_id,
                        "product_name": item.get("name") or "Product",
                        "quantity_sold": 0,
                        "orders": set(),
                        "gross_sales": 0.0,
                        "discount_given": 0.0,
                        "net_revenue": 0.0,
                        "product_cost": 0.0,
                        "net_profit": 0.0,
                        "loss": 0.0,
                    },
                )

                row["quantity_sold"] += int(
                    item.get("quantity", 0) or 0
                )
                row["orders"].add(order_id)
                row["gross_sales"] += float(
                    item.get("gross_revenue", item.get("line_total", 0))
                    or 0
                )
                row["discount_given"] += float(
                    item.get("allocated_discount", 0) or 0
                )
                row["net_revenue"] += float(
                    item.get("net_revenue", 0) or 0
                )
                row["product_cost"] += float(
                    item.get("total_cost", 0) or 0
                )
                row["net_profit"] += float(
                    item.get("net_profit", 0) or 0
                )
                row["loss"] += float(
                    item.get("loss", 0) or 0
                )

        order_count = len(orders)
        average_order_value = (
            coupon_net_revenue / order_count
            if order_count
            else 0.0
        )
        profit_margin = (
            coupon_profit / coupon_net_revenue * 100
            if coupon_net_revenue > 0
            else 0.0
        )
        roi = (
            coupon_profit / coupon_discount
            if coupon_discount > 0
            else None
        )

        coupon_rows.append({
            "offer_id": offer_id,
            "code": code,
            "title": offer.get("title"),
            "offer_type": offer.get("offer_type"),
            "discount_value": offer.get("discount_value"),
            "active": offer.get("active", True),
            "featured": offer.get("featured", False),
            "starts_at": offer.get("starts_at"),
            "expires_at": offer.get("expires_at"),
            "orders": order_count,
            "customers": len(coupon_customer_ids),
            "gross_sales": round(coupon_gross, 2),
            "discount_given": round(coupon_discount, 2),
            "net_revenue": round(coupon_net_revenue, 2),
            "product_cost": round(coupon_cost, 2),
            "net_profit": round(coupon_profit, 2),
            "total_loss": round(coupon_loss, 2),
            "loss_orders": coupon_loss_orders,
            "profit_margin": round(profit_margin, 2),
            "average_order_value": round(
                average_order_value,
                2,
            ),
            "roi": round(roi, 2) if roi is not None else None,
            "loss_making": coupon_profit < 0,
        })

        summary["orders"] += order_count
        summary["gross_sales"] += coupon_gross
        summary["discount_given"] += coupon_discount
        summary["net_revenue"] += coupon_net_revenue
        summary["product_cost"] += coupon_cost
        summary["net_profit"] += coupon_profit
        summary["total_loss"] += coupon_loss
        summary["loss_orders"] += coupon_loss_orders
        summary["profit_orders"] += order_count - coupon_loss_orders

    product_rows = []
    for row in product_aggregate.values():
        orders_count = len(row.pop("orders"))
        row["orders"] = orders_count

        for field in (
            "gross_sales",
            "discount_given",
            "net_revenue",
            "product_cost",
            "net_profit",
            "loss",
        ):
            row[field] = round(row[field], 2)

        row["profit_margin"] = round(
            (
                row["net_profit"]
                / row["net_revenue"]
                * 100
            )
            if row["net_revenue"] > 0
            else 0.0,
            2,
        )
        row["loss_making"] = row["net_profit"] < 0
        product_rows.append(row)

    summary["customers"] = len(overall_customer_ids)

    for field in (
        "gross_sales",
        "discount_given",
        "net_revenue",
        "product_cost",
        "net_profit",
        "total_loss",
    ):
        summary[field] = round(summary[field], 2)

    summary["profit_margin"] = round(
        (
            summary["net_profit"]
            / summary["net_revenue"]
            * 100
        )
        if summary["net_revenue"] > 0
        else 0.0,
        2,
    )
    summary["roi"] = round(
        (
            summary["net_profit"]
            / summary["discount_given"]
        )
        if summary["discount_given"] > 0
        else 0.0,
        2,
    )

    best_coupon = max(
        coupon_rows,
        key=lambda item: item.get("net_profit", 0),
        default=None,
    )
    worst_coupon = min(
        coupon_rows,
        key=lambda item: item.get("net_profit", 0),
        default=None,
    )
    highest_discount_product = max(
        product_rows,
        key=lambda item: item.get("discount_given", 0),
        default=None,
    )
    highest_loss_product = max(
        product_rows,
        key=lambda item: item.get("loss", 0),
        default=None,
    )

    return {
        "summary": summary,
        "coupons": coupon_rows,
        "orders": order_rows,
        "products": sorted(
            product_rows,
            key=lambda item: item.get("discount_given", 0),
            reverse=True,
        ),
        "insights": {
            "best_coupon": best_coupon,
            "worst_coupon": worst_coupon,
            "highest_discount_product": highest_discount_product,
            "highest_loss_product": highest_loss_product,
            "overall_result": (
                "profitable"
                if summary["net_profit"] >= 0
                else "loss_making"
            ),
        },
        "formula_reference": {
            "gross_sales": "Order subtotal before coupon discount",
            "discount_given": "Gross sales minus net revenue",
            "net_revenue": "Amount paid by customer",
            "product_cost": (
                "Wholesale + packaging + delivery + other cost"
            ),
            "net_profit": "Net revenue minus product cost",
            "loss": (
                "Absolute value of net profit when net profit is below zero"
            ),
            "profit_margin": (
                "Net profit divided by net revenue multiplied by 100"
            ),
            "roi": "Net profit divided by coupon discount given",
        },
        "generated_at": now_iso(),
    }


# ---------- Cart ----------
async def build_cart(user_id: str):
    cart = await db.carts.find_one({"user_id": user_id}) or {"user_id": user_id, "items": []}
    items = []
    subtotal = 0.0
    for cart_item in cart.get("items", []):
        product = await db.products.find_one({"product_id": cart_item["product_id"], "active": True})
        if not product:
            continue
        quantity = min(cart_item["quantity"], product.get("stock", 0))
        line_total = round(float(product["price"]) * quantity, 2)
        subtotal += line_total
        items.append({
            "product_id": product["product_id"],
            "name": product["name"],
            "price": product["price"],
            "image_url": product.get("image_url"),
            "unit": product.get("unit"),
            "stock": product.get("stock", 0),
            "quantity": quantity,
            "line_total": line_total,
        })
    return {"items": items, "subtotal": round(subtotal, 2), "total_items": sum(i["quantity"] for i in items)}


@api.get("/cart")
async def get_cart(user=Depends(customer_user)):
    return await build_cart(user["user_id"])


@api.post("/cart/items")
async def add_cart_item(payload: CartItemIn, user=Depends(customer_user)):
    product = await db.products.find_one({"product_id": payload.product_id, "active": True})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if payload.quantity > product.get("stock", 0):
        raise HTTPException(status_code=400, detail="Requested quantity exceeds available stock")

    cart = await db.carts.find_one({"user_id": user["user_id"]})
    existing_qty = 0
    if cart:
        existing = next((x for x in cart.get("items", []) if x["product_id"] == payload.product_id), None)
        existing_qty = existing["quantity"] if existing else 0
    new_qty = existing_qty + payload.quantity
    if new_qty > product.get("stock", 0):
        raise HTTPException(status_code=400, detail="Cart quantity exceeds available stock")

    if existing_qty:
        await db.carts.update_one(
            {"user_id": user["user_id"], "items.product_id": payload.product_id},
            {"$set": {"items.$.quantity": new_qty, "updated_at": now_iso()}},
        )
    else:
        await db.carts.update_one(
            {"user_id": user["user_id"]},
            {"$setOnInsert": {"created_at": now_iso()}, "$set": {"updated_at": now_iso()}, "$push": {"items": payload.model_dump()}},
            upsert=True,
        )
    return await build_cart(user["user_id"])


@api.put("/cart/items/{product_id}")
async def update_cart_item(product_id: str, payload: CartItemIn, user=Depends(customer_user)):
    if payload.product_id != product_id:
        raise HTTPException(status_code=400, detail="Product ID mismatch")
    product = await db.products.find_one({"product_id": product_id, "active": True})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if payload.quantity > product.get("stock", 0):
        raise HTTPException(status_code=400, detail="Requested quantity exceeds available stock")
    result = await db.carts.update_one(
        {"user_id": user["user_id"], "items.product_id": product_id},
        {"$set": {"items.$.quantity": payload.quantity, "updated_at": now_iso()}},
    )
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Cart item not found")
    return await build_cart(user["user_id"])


@api.delete("/cart/items/{product_id}")
async def remove_cart_item(product_id: str, user=Depends(customer_user)):
    await db.carts.update_one({"user_id": user["user_id"]}, {"$pull": {"items": {"product_id": product_id}}, "$set": {"updated_at": now_iso()}})
    return await build_cart(user["user_id"])


@api.delete("/cart")
async def clear_cart(user=Depends(customer_user)):
    await db.carts.delete_one({"user_id": user["user_id"]})
    return {"message": "Cart cleared"}


async def notify_order_status(order: dict, status: str):
    status_messages = {
        "confirmed": (
            "Order confirmed",
            f"Your order {order.get('order_number')} has been confirmed.",
        ),
        "processing": (
            "Order is being prepared",
            f"Your order {order.get('order_number')} is now being processed.",
        ),
        "assigned": (
            "Delivery partner assigned",
            f"A delivery partner has been assigned to order {order.get('order_number')}.",
        ),
        "out_for_delivery": (
            "Order out for delivery",
            f"Your order {order.get('order_number')} is on the way.",
        ),
        "delivered": (
            "Order delivered",
            f"Your order {order.get('order_number')} has been delivered.",
        ),
        "cancelled": (
            "Order cancelled",
            f"Your order {order.get('order_number')} has been cancelled.",
        ),
        "delivery_failed": (
            "Delivery attempt unsuccessful",
            f"Delivery could not be completed for order {order.get('order_number')}.",
        ),
    }

    content = status_messages.get(status)
    if not content or not order.get("user_id"):
        return

    title, message = content

    await create_notification(
        db,
        notification_id=new_id("not"),
        user_id=order["user_id"],
        title=title,
        message=message,
        notification_type=f"order_{status}",
        link=f"/orders/{order['order_id']}",
        order_id=order["order_id"],
        created_at=now_iso(),
    )



def allocate_order_discount_and_costs(
    items: List[dict],
    total_discount: float,
    product_map: dict,
) -> List[dict]:
    """
    Allocate the order-level coupon discount proportionally across products,
    snapshot product costs, and calculate item-level profit/loss.
    """
    normalized_items = [dict(item) for item in items]
    gross_total = round(
        sum(float(item.get("line_total", 0) or 0) for item in normalized_items),
        2,
    )
    discount_total = round(max(float(total_discount or 0), 0), 2)

    allocated_so_far = 0.0

    for index, item in enumerate(normalized_items):
        line_total = round(float(item.get("line_total", 0) or 0), 2)
        quantity = int(item.get("quantity", 0) or 0)
        product = product_map.get(item.get("product_id"), {}) or {}

        if index == len(normalized_items) - 1:
            allocated_discount = round(
                discount_total - allocated_so_far,
                2,
            )
        elif gross_total > 0:
            allocated_discount = round(
                discount_total * (line_total / gross_total),
                2,
            )
            allocated_so_far += allocated_discount
        else:
            allocated_discount = 0.0

        allocated_discount = min(
            max(allocated_discount, 0.0),
            line_total,
        )

        unit_cost = round(
            sum(
                float(product.get(field, 0) or 0)
                for field in (
                    "wholesale_price",
                    "packaging_cost",
                    "delivery_cost",
                    "other_cost",
                )
            ),
            2,
        )
        total_cost = round(unit_cost * quantity, 2)
        net_revenue = round(line_total - allocated_discount, 2)
        net_profit = round(net_revenue - total_cost, 2)
        loss = round(abs(net_profit), 2) if net_profit < 0 else 0.0
        profit = round(net_profit, 2) if net_profit > 0 else 0.0
        profit_margin = round(
            (net_profit / net_revenue) * 100
            if net_revenue > 0
            else 0.0,
            2,
        )

        item.update({
            "gross_revenue": line_total,
            "allocated_discount": allocated_discount,
            "net_revenue": net_revenue,
            "unit_cost": unit_cost,
            "total_cost": total_cost,
            "net_profit": net_profit,
            "profit": profit,
            "loss": loss,
            "profit_margin": profit_margin,
            "cost_snapshot": {
                "wholesale_price": round(
                    float(product.get("wholesale_price", 0) or 0),
                    2,
                ),
                "packaging_cost": round(
                    float(product.get("packaging_cost", 0) or 0),
                    2,
                ),
                "delivery_cost": round(
                    float(product.get("delivery_cost", 0) or 0),
                    2,
                ),
                "other_cost": round(
                    float(product.get("other_cost", 0) or 0),
                    2,
                ),
            },
        })

    return normalized_items


# ---------- Orders ----------
@api.post("/orders")
async def create_order(payload: OrderCreate, user=Depends(customer_user)):
    is_buy_now = payload.buy_now_item is not None

    if is_buy_now:
        requested = payload.buy_now_item

        product = await db.products.find_one({
            "product_id": requested.product_id,
            "active": True,
        })
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        available_stock = int(product.get("stock", 0) or 0)
        if requested.quantity > available_stock:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {product['name']}",
            )

        price = float(product["price"])
        line_total = round(price * requested.quantity, 2)
        order_items = [{
            "product_id": product["product_id"],
            "name": product["name"],
            "price": price,
            "image_url": product.get("image_url"),
            "unit": product.get("unit"),
            "stock": available_stock,
            "quantity": requested.quantity,
            "line_total": line_total,
        }]
        order_subtotal = line_total
    else:
        cart = await build_cart(user["user_id"])
        if not cart["items"]:
            raise HTTPException(status_code=400, detail="Cart is empty")

        order_items = cart["items"]
        order_subtotal = cart["subtotal"]

    for item in order_items:
        product = await db.products.find_one({
            "product_id": item["product_id"],
            "active": True,
        })
        if not product or item["quantity"] > int(product.get("stock", 0) or 0):
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {item['name']}",
            )

    coupon_result = None
    delivery_charge = 0.0
    discount = 0.0
    order_total = float(order_subtotal)

    if payload.coupon_code:
        coupon_result = await validate_and_calculate_offer(
            db,
            code=payload.coupon_code,
            user_id=user["user_id"],
            subtotal=order_subtotal,
            delivery_charge=delivery_charge,
            items=order_items,
        )

        discount = float(coupon_result["discount"])
        delivery_charge = float(
            coupon_result["delivery_charge"]
        )
        order_total = float(coupon_result["total"])

    product_map = {}
    for item in order_items:
        product_map[item["product_id"]] = (
            await db.products.find_one({
                "product_id": item["product_id"]
            })
            or {}
        )

    order_items = allocate_order_discount_and_costs(
        order_items,
        discount,
        product_map,
    )

    order_product_cost = round(
        sum(
            float(item.get("total_cost", 0) or 0)
            for item in order_items
        ),
        2,
    )
    order_net_profit = round(
        float(order_total) - order_product_cost,
        2,
    )
    order_loss = (
        round(abs(order_net_profit), 2)
        if order_net_profit < 0
        else 0.0
    )
    order_profit_margin = round(
        (order_net_profit / float(order_total)) * 100
        if float(order_total) > 0
        else 0.0,
        2,
    )

    order_id = new_id("ord")
    order = {
        "order_id": order_id,
        "order_number": f"ZAN-{datetime.now().strftime('%Y%m%d')}-{order_id[-6:].upper()}",
        "user_id": user["user_id"],
        "customer_name": user["name"],
        "customer_email": user["email"],
        "items": order_items,
        "subtotal": order_subtotal,
        "discount": round(discount, 2),
        "delivery_charge": round(delivery_charge, 2),
        "total": round(order_total, 2),
        "coupon_code": (
            coupon_result["code"]
            if coupon_result
            else None
        ),
        "offer_id": (
            coupon_result["offer_id"]
            if coupon_result
            else None
        ),
        "savings": (
            coupon_result["savings"]
            if coupon_result
            else 0.0
        ),
        "product_cost": order_product_cost,
        "net_profit": order_net_profit,
        "loss": order_loss,
        "profit_margin": order_profit_margin,
        "payment_method": "cash_on_delivery",
        "payment_status": "pending",
        "delivery_address": payload.delivery_address,
        "city": payload.city,
        "state": payload.state,
        "postal_code": payload.postal_code,
        "phone": payload.phone,
        "notes": payload.notes,
        "status": "placed",
        "manager_id": None,
        "manager_name": None,
        "status_history": [{
            "status": "placed",
            "at": now_iso(),
            "by": user["user_id"],
            "note": "Order placed",
        }],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    await db.orders.insert_one(order)

    if coupon_result:
        await db.offers.update_one(
            {"offer_id": coupon_result["offer_id"]},
            {
                "$inc": {"usage_count": 1},
                "$set": {"updated_at": now_iso()},
            },
        )

        await db.offer_redemptions.insert_one(
            {
                "redemption_id": new_id("red"),
                "offer_id": coupon_result["offer_id"],
                "code": coupon_result["code"],
                "user_id": user["user_id"],
                "order_id": order_id,
                "discount": coupon_result["discount"],
                "savings": coupon_result["savings"],
                "created_at": now_iso(),
            }
        )

    await create_notification(
        db,
        notification_id=new_id("not"),
        user_id=user["user_id"],
        title="Order placed successfully",
        message=f"Your order {order['order_number']} has been placed.",
        notification_type="order_placed",
        link=f"/orders/{order_id}",
        order_id=order_id,
        created_at=now_iso(),
    )

    for item in order_items:
        await db.products.update_one(
            {"product_id": item["product_id"]},
            {
                "$inc": {"stock": -item["quantity"]},
                "$set": {"updated_at": now_iso()},
            },
        )

    if not is_buy_now:
        await db.carts.delete_one({"user_id": user["user_id"]})

    return clean_doc(order)


@api.get("/orders/my")
async def my_orders(user=Depends(customer_user)):
    return [clean_doc(x) async for x in db.orders.find({"user_id": user["user_id"]}).sort("created_at", -1)]


@api.get("/orders/{order_id}")
async def get_order(order_id: str, user=Depends(current_user)):
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if user["role"] == "customer" and order["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if user["role"] == "manager" and order.get("manager_id") not in (None, user["user_id"]):
        raise HTTPException(status_code=403, detail="Forbidden")
    return clean_doc(order)


@api.get("/admin/orders")
async def admin_orders(status: Optional[str] = None, user=Depends(admin_user)):
    query = {"status": status} if status else {}
    return [clean_doc(x) async for x in db.orders.find(query).sort("created_at", -1)]


@api.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, payload: OrderStatusUpdate, user=Depends(manager_user)):
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if user["role"] == "manager" and order.get("manager_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="This order is not assigned to you")
    if order["status"] in ["delivered", "cancelled"]:
        raise HTTPException(status_code=409, detail="Completed orders cannot be changed")

    update = {
        "status": payload.status,
        "updated_at": now_iso(),
    }
    if payload.status == "delivered":
        update["delivered_at"] = now_iso()
        update["payment_status"] = "paid"
    if payload.status == "cancelled":
        for item in order["items"]:
            await db.products.update_one({"product_id": item["product_id"]}, {"$inc": {"stock": item["quantity"]}})

    history = {"status": payload.status, "at": now_iso(), "by": user["user_id"], "note": payload.note}
    await db.orders.update_one({"order_id": order_id}, {"$set": update, "$push": {"status_history": history}})
    updated_order = await db.orders.find_one({"order_id": order_id})
    await notify_order_status(updated_order, payload.status)
    return clean_doc(updated_order)


@api.patch("/admin/orders/{order_id}/assign")
async def assign_manager(order_id: str, payload: AssignManagerIn, user=Depends(admin_user)):
    if not await db.orders.find_one({"order_id": order_id}):
        raise HTTPException(status_code=404, detail="Order not found")
    manager_name = None
    if payload.manager_id:
        manager = await db.users.find_one({"user_id": payload.manager_id, "role": "manager", "active": True})
        if not manager:
            raise HTTPException(status_code=400, detail="Invalid manager")
        manager_name = manager["name"]
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"manager_id": payload.manager_id, "manager_name": manager_name, "updated_at": now_iso()}},
    )
    return clean_doc(await db.orders.find_one({"order_id": order_id}))


# ---------- Manager ----------
@api.get("/manager/deliveries")
async def manager_deliveries(status: Optional[str] = None, user=Depends(manager_user)):
    query = {} if user["role"] == "admin" else {"manager_id": user["user_id"]}
    if status:
        query["status"] = status
    else:
        query["status"] = {"$in": ["confirmed", "processing", "out_for_delivery"]}
    return [clean_doc(x) async for x in db.orders.find(query).sort("created_at", 1)]


@api.get("/manager/reports")
async def manager_reports(user=Depends(manager_user)):
    query = {} if user["role"] == "admin" else {"manager_id": user["user_id"]}
    total = await db.orders.count_documents(query)
    delivered = await db.orders.count_documents({**query, "status": "delivered"})
    active = await db.orders.count_documents({**query, "status": {"$in": ["confirmed", "processing", "out_for_delivery"]}})
    pipeline = [{"$match": {**query, "status": "delivered"}}, {"$group": {"_id": None, "revenue": {"$sum": "$total"}}}]
    revenue_rows = await db.orders.aggregate(pipeline).to_list(1)
    return {"total_orders": total, "delivered_orders": delivered, "active_deliveries": active, "delivered_revenue": round(revenue_rows[0]["revenue"], 2) if revenue_rows else 0}


# ---------- Admin users ----------
@api.get("/admin/customers")
async def customers(user=Depends(admin_user)):
    return [clean_doc(x) async for x in db.users.find({"role": "customer"}).sort("created_at", -1)]


@api.get("/admin/managers")
async def managers(user=Depends(admin_user)):
    return [clean_doc(x) async for x in db.users.find({"role": "manager"}).sort("created_at", -1)]


@api.post("/admin/managers")
async def create_manager(payload: ManagerCreate, user=Depends(admin_user)):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    manager = {
        "user_id": new_id("usr"),
        "name": payload.name.strip(),
        "email": email,
        "password_hash": hash_password(payload.password),
        "role": "manager",
        "phone": payload.phone,
        "avatar_url": None,
        "address": None,
        "city": None,
        "state": None,
        "postal_code": None,
        "active": True,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.users.insert_one(manager)
    return clean_doc(manager)


@api.patch("/admin/users/{user_id}/status")
async def update_user_status(user_id: str, payload: UserStatusUpdate, user=Depends(admin_user)):
    target = await db.users.find_one({"user_id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target["role"] == "admin":
        raise HTTPException(status_code=400, detail="Admin status cannot be changed here")
    await db.users.update_one({"user_id": user_id}, {"$set": {"active": payload.active, "updated_at": now_iso()}})
    return clean_doc(await db.users.find_one({"user_id": user_id}))


# ---------- Delivery partners ----------
@api.get("/admin/delivery-partners")
async def list_delivery_partners(
    availability_status: Optional[str] = None,
    active: Optional[bool] = None,
    user=Depends(admin_user),
):
    query = {"role": "delivery_partner"}
    if availability_status:
        query["availability_status"] = availability_status
    if active is not None:
        query["active"] = active

    partners = []
    async for partner in db.users.find(query).sort("created_at", -1):
        item = clean_doc(partner)
        partner_id = partner["user_id"]
        item["assigned_orders"] = await db.orders.count_documents({
            "delivery_partner_id": partner_id,
            "status": {"$in": ["assigned", "out_for_delivery"]},
        })
        item["completed_deliveries"] = await db.orders.count_documents({
            "delivery_partner_id": partner_id,
            "status": "delivered",
        })
        item["failed_deliveries"] = await db.orders.count_documents({
            "delivery_partner_id": partner_id,
            "status": "delivery_failed",
        })
        partners.append(item)
    return {"delivery_partners": partners}


@api.post("/admin/delivery-partners")
async def create_delivery_partner(
    payload: DeliveryPartnerCreate,
    user=Depends(admin_user),
):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    partner = {
        "user_id": new_id("usr"),
        "name": payload.name.strip(),
        "email": email,
        "password_hash": hash_password(payload.password),
        "role": "delivery_partner",
        "phone": payload.phone,
        "avatar_url": payload.avatar_url,
        "vehicle_type": payload.vehicle_type,
        "vehicle_number": payload.vehicle_number,
        "license_number": payload.license_number,
        "availability_status": "available",
        "address": None,
        "city": None,
        "state": None,
        "postal_code": None,
        "active": True,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.users.insert_one(partner)
    return clean_doc(partner)


@api.get("/admin/delivery-partners/{partner_id}")
async def get_delivery_partner(partner_id: str, user=Depends(admin_user)):
    partner = await db.users.find_one({
        "user_id": partner_id,
        "role": "delivery_partner",
    })
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")

    result = clean_doc(partner)
    result["assigned_orders"] = await db.orders.count_documents({
        "delivery_partner_id": partner_id,
        "status": {"$in": ["assigned", "out_for_delivery"]},
    })
    result["completed_deliveries"] = await db.orders.count_documents({
        "delivery_partner_id": partner_id,
        "status": "delivered",
    })
    result["failed_deliveries"] = await db.orders.count_documents({
        "delivery_partner_id": partner_id,
        "status": "delivery_failed",
    })
    result["recent_orders"] = [
        clean_doc(order)
        async for order in db.orders.find({"delivery_partner_id": partner_id})
        .sort("created_at", -1)
        .limit(20)
    ]
    return result


@api.patch("/admin/delivery-partners/{partner_id}")
async def update_delivery_partner(
    partner_id: str,
    payload: DeliveryPartnerUpdate,
    user=Depends(admin_user),
):
    partner = await db.users.find_one({
        "user_id": partner_id,
        "role": "delivery_partner",
    })
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "name" in updates:
        updates["name"] = updates["name"].strip()
    updates["updated_at"] = now_iso()

    await db.users.update_one({"user_id": partner_id}, {"$set": updates})
    return clean_doc(await db.users.find_one({"user_id": partner_id}))


@api.delete("/admin/delivery-partners/{partner_id}")
async def delete_delivery_partner(partner_id: str, user=Depends(admin_user)):
    partner = await db.users.find_one({
        "user_id": partner_id,
        "role": "delivery_partner",
    })
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")

    active_orders = await db.orders.count_documents({
        "delivery_partner_id": partner_id,
        "status": {"$in": ["assigned", "out_for_delivery"]},
    })
    if active_orders:
        raise HTTPException(
            status_code=409,
            detail="Reassign this partner's active orders before deleting the account",
        )

    await db.users.delete_one({"user_id": partner_id})
    return {"message": "Delivery partner deleted"}


@api.patch("/admin/orders/{order_id}/assign-delivery-partner")
async def assign_delivery_partner(
    order_id: str,
    payload: AssignDeliveryPartnerIn,
    user=Depends(admin_user),
):
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("status") in ["delivered", "cancelled"]:
        raise HTTPException(status_code=409, detail="Completed or cancelled orders cannot be assigned")

    previous_partner_id = order.get("delivery_partner_id")
    partner_name = None
    partner_phone = None

    if payload.delivery_partner_id:
        partner = await db.users.find_one({
            "user_id": payload.delivery_partner_id,
            "role": "delivery_partner",
            "active": True,
        })
        if not partner:
            raise HTTPException(status_code=400, detail="Invalid or inactive delivery partner")
        if partner.get("availability_status") == "offline":
            raise HTTPException(status_code=409, detail="This delivery partner is currently offline")
        partner_name = partner["name"]
        partner_phone = partner.get("phone")

    update = {
        "delivery_partner_id": payload.delivery_partner_id,
        "delivery_partner_name": partner_name,
        "delivery_partner_phone": partner_phone,
        "updated_at": now_iso(),
    }

    if payload.delivery_partner_id:
        update["status"] = "assigned"
        update["assigned_at"] = now_iso()
        history = {
            "status": "assigned",
            "at": now_iso(),
            "by": user["user_id"],
            "note": f"Assigned to delivery partner {partner_name}",
        }
        await db.orders.update_one(
            {"order_id": order_id},
            {"$set": update, "$push": {"status_history": history}},
        )
        await db.users.update_one(
            {"user_id": payload.delivery_partner_id},
            {"$set": {"availability_status": "busy", "updated_at": now_iso()}},
        )
    else:
        update["status"] = "confirmed"
        update["assigned_at"] = None
        history = {
            "status": "confirmed",
            "at": now_iso(),
            "by": user["user_id"],
            "note": "Delivery partner unassigned",
        }
        await db.orders.update_one(
            {"order_id": order_id},
            {"$set": update, "$push": {"status_history": history}},
        )

    if previous_partner_id and previous_partner_id != payload.delivery_partner_id:
        remaining = await db.orders.count_documents({
            "delivery_partner_id": previous_partner_id,
            "status": {"$in": ["assigned", "out_for_delivery"]},
        })
        if remaining == 0:
            await db.users.update_one(
                {"user_id": previous_partner_id},
                {"$set": {"availability_status": "available", "updated_at": now_iso()}},
            )

    updated_order = await db.orders.find_one({"order_id": order_id})

    if payload.delivery_partner_id:
        await notify_order_status(updated_order, "assigned")

    return clean_doc(updated_order)


@api.get("/delivery-partner/deliveries")
async def delivery_partner_deliveries(
    status: Optional[str] = None,
    user=Depends(delivery_partner_user),
):
    query = {} if user["role"] == "admin" else {"delivery_partner_id": user["user_id"]}
    if status:
        query["status"] = status
    else:
        query["status"] = {"$in": ["assigned", "out_for_delivery", "delivery_failed"]}

    return [
        clean_doc(order)
        async for order in db.orders.find(query).sort("created_at", 1)
    ]


@api.get("/delivery-partner/reports")
async def delivery_partner_reports(user=Depends(delivery_partner_user)):
    query = {} if user["role"] == "admin" else {"delivery_partner_id": user["user_id"]}
    return {
        "assigned_orders": await db.orders.count_documents({
            **query,
            "status": {"$in": ["assigned", "out_for_delivery"]},
        }),
        "completed_deliveries": await db.orders.count_documents({**query, "status": "delivered"}),
        "failed_deliveries": await db.orders.count_documents({**query, "status": "delivery_failed"}),
        "total_orders": await db.orders.count_documents(query),
    }


@api.patch("/delivery-partner/orders/{order_id}/status")
async def update_delivery_status(
    order_id: str,
    payload: DeliveryStatusUpdate,
    user=Depends(delivery_partner_user),
):
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if user["role"] != "admin" and order.get("delivery_partner_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="This order is not assigned to you")

    if order.get("status") in ["delivered", "cancelled"]:
        raise HTTPException(status_code=409, detail="Completed or cancelled orders cannot be changed")

    allowed_transitions = {
        "assigned": {"out_for_delivery", "delivery_failed"},
        "out_for_delivery": {"delivered", "delivery_failed"},
        "delivery_failed": {"out_for_delivery"},
    }
    current_status = order.get("status")
    if payload.status != current_status and payload.status not in allowed_transitions.get(current_status, set()):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot change delivery status from {current_status} to {payload.status}",
        )

    update = {"status": payload.status, "updated_at": now_iso()}
    if payload.status == "out_for_delivery":
        update["out_for_delivery_at"] = now_iso()
    elif payload.status == "delivered":
        update["delivered_at"] = now_iso()
        update["payment_status"] = "paid"
    elif payload.status == "delivery_failed":
        update["delivery_failed_at"] = now_iso()

    history = {
        "status": payload.status,
        "at": now_iso(),
        "by": user["user_id"],
        "note": payload.note,
    }
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": update, "$push": {"status_history": history}},
    )

    partner_id = order.get("delivery_partner_id")
    if partner_id and payload.status in ["delivered", "delivery_failed"]:
        remaining = await db.orders.count_documents({
            "delivery_partner_id": partner_id,
            "status": {"$in": ["assigned", "out_for_delivery"]},
            "order_id": {"$ne": order_id},
        })
        if remaining == 0:
            await db.users.update_one(
                {"user_id": partner_id},
                {"$set": {"availability_status": "available", "updated_at": now_iso()}},
            )

    updated_order = await db.orders.find_one({"order_id": order_id})
    await notify_order_status(updated_order, payload.status)
    return clean_doc(updated_order)


# ---------- Dashboards and reports ----------
@api.get("/dashboard")
async def dashboard(user=Depends(current_user)):
    if user["role"] == "customer":
        query = {"user_id": user["user_id"]}
        return {
            "total_orders": await db.orders.count_documents(query),
            "active_orders": await db.orders.count_documents({**query, "status": {"$in": ["placed", "confirmed", "processing", "out_for_delivery"]}}),
            "delivered_orders": await db.orders.count_documents({**query, "status": "delivered"}),
            "cart": await build_cart(user["user_id"]),
            "featured_products": [clean_doc(x) async for x in db.products.find({"active": True, "featured": True}).limit(6)],
        }
    if user["role"] == "manager":
        return await manager_reports(user)
    if user["role"] == "delivery_partner":
        return await delivery_partner_reports(user)
    return await admin_reports(user)


@api.get("/admin/reports")
async def admin_reports(user=Depends(admin_user)):
    products = [clean_doc(x) async for x in db.products.find({})]
    categories = [clean_doc(x) async for x in db.categories.find({})]
    delivered_orders = [clean_doc(x) async for x in db.orders.find({"status": "delivered"}).sort("created_at", 1)]
    all_orders = [clean_doc(x) async for x in db.orders.find({}).sort("created_at", -1)]

    product_map = {x.get("product_id"): x for x in products}
    category_map = {x.get("category_id"): x for x in categories}
    product_sales, category_sales, daily_sales, monthly_sales, customer_sales = {}, {}, {}, {}, {}
    total_revenue = total_cost = 0.0
    total_units = 0

    for order in delivered_orders:
        order_total = float(order.get("total", 0) or 0)
        total_revenue += order_total
        raw_date = order.get("delivered_at") or order.get("created_at")
        day_key = month_key = ""
        if raw_date:
            try:
                dt = datetime.fromisoformat(str(raw_date).replace("Z", "+00:00"))
                day_key, month_key = dt.strftime("%Y-%m-%d"), dt.strftime("%Y-%m")
            except ValueError:
                pass
        if day_key:
            row = daily_sales.setdefault(day_key, {"date": day_key, "revenue": 0.0, "orders": 0})
            row["revenue"] += order_total; row["orders"] += 1
        if month_key:
            row = monthly_sales.setdefault(month_key, {"month": month_key, "revenue": 0.0, "orders": 0})
            row["revenue"] += order_total; row["orders"] += 1

        customer_id = order.get("user_id") or order.get("customer_email") or order.get("customer_name")
        if customer_id:
            row = customer_sales.setdefault(customer_id, {
                "customer_id": customer_id,
                "customer_name": order.get("customer_name") or "Customer",
                "customer_email": order.get("customer_email"),
                "orders": 0,
                "revenue": 0.0,
            })
            row["orders"] += 1; row["revenue"] += order_total

        for item in order.get("items", []):
            product_id = item.get("product_id")
            product = product_map.get(product_id, {})
            quantity = int(item.get("quantity", 0) or 0)
            selling_price = float(item.get("price", 0) or 0)
            revenue = float(item.get("line_total", selling_price * quantity) or 0)
            unit_cost = sum(float(product.get(k, 0) or 0) for k in ("wholesale_price", "packaging_cost", "delivery_cost", "other_cost"))
            cost = unit_cost * quantity
            profit = revenue - cost
            total_cost += cost; total_units += quantity
            category_id = product.get("category_id")
            category_name = category_map.get(category_id, {}).get("name") or "Uncategorized"

            row = product_sales.setdefault(product_id, {
                "product_id": product_id,
                "product_name": item.get("name") or product.get("name") or "Product",
                "category": category_name,
                "quantity_sold": 0,
                "revenue": 0.0,
                "cost": 0.0,
                "profit": 0.0,
                "unit_cost": round(unit_cost, 2),
                "selling_price": round(selling_price, 2),
                "orders": 0,
            })
            row["quantity_sold"] += quantity; row["revenue"] += revenue; row["cost"] += cost; row["profit"] += profit; row["orders"] += 1

            crow = category_sales.setdefault(category_name, {"category": category_name, "quantity_sold": 0, "revenue": 0.0, "cost": 0.0, "profit": 0.0})
            crow["quantity_sold"] += quantity; crow["revenue"] += revenue; crow["cost"] += cost; crow["profit"] += profit

    product_rows = []
    for row in product_sales.values():
        for key in ("revenue", "cost", "profit"): row[key] = round(row[key], 2)
        row["margin"] = round((row["profit"] / row["revenue"] * 100) if row["revenue"] else 0, 2)
        product_rows.append(row)

    category_rows = []
    for row in category_sales.values():
        for key in ("revenue", "cost", "profit"): row[key] = round(row[key], 2)
        row["margin"] = round((row["profit"] / row["revenue"] * 100) if row["revenue"] else 0, 2)
        category_rows.append(row)

    daily_rows = sorted(daily_sales.values(), key=lambda x: x["date"])[-30:]
    monthly_rows = sorted(monthly_sales.values(), key=lambda x: x["month"])[-12:]
    for row in daily_rows + monthly_rows: row["revenue"] = round(row["revenue"], 2)
    top_customers = sorted(customer_sales.values(), key=lambda x: x["revenue"], reverse=True)[:10]
    for row in top_customers: row["revenue"] = round(row["revenue"], 2)

    by_qty = sorted(product_rows, key=lambda x: x["quantity_sold"], reverse=True)
    by_revenue = sorted(product_rows, key=lambda x: x["revenue"], reverse=True)
    by_profit = sorted(product_rows, key=lambda x: x["profit"], reverse=True)
    by_margin = sorted([x for x in product_rows if x["revenue"] > 0], key=lambda x: x["margin"], reverse=True)
    gross_profit = round(total_revenue - total_cost, 2)

    return {
        "products": len(products),
        "categories": len(categories),
        "customers": await db.users.count_documents({"role": "customer"}),
        "managers": await db.users.count_documents({"role": "manager"}),
        "delivery_partners": await db.users.count_documents({"role": "delivery_partner"}),
        "orders": len(all_orders),
        "pending_orders": await db.orders.count_documents({"status": {"$in": ["placed", "confirmed", "processing", "assigned", "out_for_delivery"]}}),
        "delivered_orders": len(delivered_orders),
        "cancelled_orders": await db.orders.count_documents({"status": "cancelled"}),
        "revenue": round(total_revenue, 2),
        "total_cost": round(total_cost, 2),
        "gross_profit": gross_profit,
        "profit_margin": round((gross_profit / total_revenue * 100) if total_revenue else 0, 2),
        "average_order_value": round(total_revenue / len(delivered_orders), 2) if delivered_orders else 0,
        "total_units_sold": total_units,
        "recent_orders": all_orders[:10],
        "product_analysis": sorted(product_rows, key=lambda x: x["revenue"], reverse=True),
        "category_analysis": sorted(category_rows, key=lambda x: x["revenue"], reverse=True),
        "daily_sales": daily_rows,
        "monthly_sales": monthly_rows,
        "top_customers": top_customers,
        "best_selling_product": by_qty[0] if by_qty else None,
        "highest_revenue_product": by_revenue[0] if by_revenue else None,
        "most_profitable_product": by_profit[0] if by_profit else None,
        "highest_margin_product": by_margin[0] if by_margin else None,
        "lowest_selling_product": by_qty[-1] if by_qty else None,
        "generated_at": now_iso(),
    }

# ---------- App wiring ----------
api.include_router(build_reviews_router(db))
api.include_router(
    build_notifications_router(
        db,
        new_id,
        now_iso,
    )
)
api.include_router(
    build_offers_router(
        db,
        new_id,
        now_iso,
    )
)
app.include_router(api)

_raw_origins = os.environ.get("CORS_ORIGINS", "*").strip()
if not _raw_origins or _raw_origins == "*":
    allowed_origins = ["*"]
    allow_credentials = False
else:
    allowed_origins = [origin.strip().rstrip("/") for origin in _raw_origins.split(",") if origin.strip()]
    allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
    max_age=86400,
)
