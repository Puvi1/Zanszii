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
    role: Literal["customer", "manager", "admin"] = "customer"
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
        item = clean_doc(product)
        category = await db.categories.find_one({"category_id": product.get("category_id")})
        item["category"] = clean_doc(category)
        products.append(item)
    return products


@api.get("/products/{product_id}")
async def get_product(product_id: str, user=Depends(customer_user)):
    product = await db.products.find_one({"product_id": product_id})
    if not product or (not product.get("active", True) and user["role"] != "admin"):
        raise HTTPException(status_code=404, detail="Product not found")
    result = clean_doc(product)
    result["category"] = clean_doc(await db.categories.find_one({"category_id": product.get("category_id")}))
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
    cart = await build_cart(user["user_id"])
    if not cart["items"]:
        raise HTTPException(status_code=400, detail="Cart is empty")

    for item in cart["items"]:
        product = await db.products.find_one({"product_id": item["product_id"], "active": True})
        if not product or item["quantity"] > product.get("stock", 0):
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {item['name']}")

    order_id = new_id("ord")
    order = {
        "order_id": order_id,
        "order_number": f"ZAN-{datetime.now().strftime('%Y%m%d')}-{order_id[-6:].upper()}",
        "user_id": user["user_id"],
        "customer_name": user["name"],
        "customer_email": user["email"],
        "items": cart["items"],
        "subtotal": cart["subtotal"],
        "delivery_charge": 0.0,
        "total": cart["subtotal"],
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
        "status_history": [{"status": "placed", "at": now_iso(), "by": user["user_id"], "note": "Order placed"}],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    await db.orders.insert_one(order)
    for item in cart["items"]:
        await db.products.update_one({"product_id": item["product_id"]}, {"$inc": {"stock": -item["quantity"]}, "$set": {"updated_at": now_iso()}})
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
    return await admin_reports(user)


@api.get("/admin/reports")
async def admin_reports(user=Depends(admin_user)):
    counts = {
        "products": await db.products.count_documents({}),
        "categories": await db.categories.count_documents({}),
        "customers": await db.users.count_documents({"role": "customer"}),
        "managers": await db.users.count_documents({"role": "manager"}),
        "orders": await db.orders.count_documents({}),
        "pending_orders": await db.orders.count_documents({"status": {"$in": ["placed", "confirmed", "processing", "out_for_delivery"]}}),
        "delivered_orders": await db.orders.count_documents({"status": "delivered"}),
    }
    revenue_rows = await db.orders.aggregate([
        {"$match": {"status": "delivered"}},
        {"$group": {"_id": None, "revenue": {"$sum": "$total"}}},
    ]).to_list(1)
    counts["revenue"] = round(revenue_rows[0]["revenue"], 2) if revenue_rows else 0
    counts["recent_orders"] = [clean_doc(x) async for x in db.orders.find({}).sort("created_at", -1).limit(10)]
    return counts


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
