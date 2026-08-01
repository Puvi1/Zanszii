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
    role: Literal["customer", "manager", "delivery_partner", "admin"] = "customer"
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


class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: Optional[str] = Field(default=None, max_length=3000)
    category_id: str
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


async def delivery_partner_user(user=Depends(current_user)):
    require_role(user, ["delivery_partner", "admin"])
    return user


async def admin_user(user=Depends(current_user)):
    require_role(user, ["admin"])
    return user


# ---------- Startup ----------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.categories.create_index("name", unique=True)
    await db.products.create_index([("name", "text"), ("description", "text")])
    await db.orders.create_index("user_id")
    await db.orders.create_index("status")
    await db.orders.create_index("manager_id")
    await db.orders.create_index("delivery_partner_id")
    await db.users.create_index([("role", 1), ("availability_status", 1)])

    admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    admin_name = os.environ.get("ADMIN_NAME", "Zanszii Admin")
    if admin_email and admin_password and not await db.users.find_one({"email": admin_email}):
        await db.users.insert_one({
            "user_id": new_id("usr"),
            "name": admin_name,
            "email": admin_email,
            "password_hash": hash_password(admin_password),
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
        })
        logger.info("Created initial Zanszii admin: %s", admin_email)


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


# ---------- Categories ----------
@api.get("/categories")
async def list_categories(include_inactive: bool = False, user=Depends(customer_user)):
    query = {} if include_inactive and user["role"] == "admin" else {"active": True}
    return [clean_doc(x) async for x in db.categories.find(query).sort("name", 1)]


@api.post("/categories")
async def create_category(payload: CategoryIn, user=Depends(admin_user)):
    if await db.categories.find_one({"name": {"$regex": f"^{payload.name.strip()}$", "$options": "i"}}):
        raise HTTPException(status_code=409, detail="Category already exists")
    category = {
        "category_id": new_id("cat"),
        **payload.model_dump(),
        "name": payload.name.strip(),
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


@api.delete("/categories/{category_id}")
async def delete_category(category_id: str, user=Depends(admin_user)):
    if await db.products.count_documents({"category_id": category_id}) > 0:
        raise HTTPException(status_code=409, detail="Move or delete products in this category first")
    result = await db.categories.delete_one({"category_id": category_id})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}


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
        item["category"] = clean_doc(category)
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
    return result


@api.post("/products")
async def create_product(payload: ProductIn, user=Depends(admin_user)):
    if not await db.categories.find_one({"category_id": payload.category_id}):
        raise HTTPException(status_code=400, detail="Invalid category")
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

    order_id = new_id("ord")
    order = {
        "order_id": order_id,
        "order_number": f"ZAN-{datetime.now().strftime('%Y%m%d')}-{order_id[-6:].upper()}",
        "user_id": user["user_id"],
        "customer_name": user["name"],
        "customer_email": user["email"],
        "items": order_items,
        "subtotal": order_subtotal,
        "delivery_charge": 0.0,
        "total": order_subtotal,
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
    return clean_doc(await db.orders.find_one({"order_id": order_id}))


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

    return clean_doc(await db.orders.find_one({"order_id": order_id}))


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

    return clean_doc(await db.orders.find_one({"order_id": order_id}))


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
