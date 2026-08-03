from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from auth_utils import get_current_user, require_role


def clean_doc(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return None

    result = dict(doc)
    result.pop("_id", None)
    return result


async def create_notification(
    db,
    *,
    notification_id: str,
    user_id: str,
    title: str,
    message: str,
    notification_type: str = "general",
    link: Optional[str] = None,
    order_id: Optional[str] = None,
    created_at: str,
) -> dict:
    notification = {
        "notification_id": notification_id,
        "user_id": user_id,
        "title": title.strip(),
        "message": message.strip(),
        "notification_type": notification_type,
        "link": link,
        "order_id": order_id,
        "is_read": False,
        "created_at": created_at,
        "read_at": None,
    }

    await db.notifications.insert_one(notification)
    return clean_doc(notification)


class AdminNotificationCreate(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    message: str = Field(min_length=2, max_length=1000)
    notification_type: str = Field(default="announcement", max_length=50)
    link: Optional[str] = Field(default=None, max_length=500)
    user_id: Optional[str] = None
    send_to_all_customers: bool = False


def build_notifications_router(db, new_id, now_iso):
    router = APIRouter(tags=["Notifications"])

    async def current_user(request: Request):
        return await get_current_user(request, db)

    async def customer_user(user=Depends(current_user)):
        require_role(user, ["customer", "manager", "delivery_partner", "admin"])
        return user

    async def admin_user(user=Depends(current_user)):
        require_role(user, ["admin"])
        return user

    @router.get("/notifications")
    async def list_notifications(
        unread_only: bool = False,
        limit: int = 50,
        user=Depends(customer_user),
    ):
        safe_limit = max(1, min(limit, 100))

        query = {"user_id": user["user_id"]}
        if unread_only:
            query["is_read"] = False

        notifications = [
            clean_doc(notification)
            async for notification in db.notifications.find(query)
            .sort("created_at", -1)
            .limit(safe_limit)
        ]

        unread_count = await db.notifications.count_documents(
            {
                "user_id": user["user_id"],
                "is_read": False,
            }
        )

        return {
            "notifications": notifications,
            "unread_count": unread_count,
        }

    @router.get("/notifications/unread-count")
    async def unread_notification_count(
        user=Depends(customer_user),
    ):
        unread_count = await db.notifications.count_documents(
            {
                "user_id": user["user_id"],
                "is_read": False,
            }
        )

        return {"unread_count": unread_count}

    @router.patch("/notifications/{notification_id}/read")
    async def mark_notification_read(
        notification_id: str,
        user=Depends(customer_user),
    ):
        notification = await db.notifications.find_one(
            {
                "notification_id": notification_id,
                "user_id": user["user_id"],
            }
        )

        if not notification:
            raise HTTPException(
                status_code=404,
                detail="Notification not found",
            )

        await db.notifications.update_one(
            {
                "notification_id": notification_id,
                "user_id": user["user_id"],
            },
            {
                "$set": {
                    "is_read": True,
                    "read_at": now_iso(),
                }
            },
        )

        return clean_doc(
            await db.notifications.find_one(
                {
                    "notification_id": notification_id,
                    "user_id": user["user_id"],
                }
            )
        )

    @router.patch("/notifications/read-all")
    async def mark_all_notifications_read(
        user=Depends(customer_user),
    ):
        await db.notifications.update_many(
            {
                "user_id": user["user_id"],
                "is_read": False,
            },
            {
                "$set": {
                    "is_read": True,
                    "read_at": now_iso(),
                }
            },
        )

        return {
            "message": "All notifications marked as read",
            "unread_count": 0,
        }

    @router.delete("/notifications/{notification_id}")
    async def delete_notification(
        notification_id: str,
        user=Depends(customer_user),
    ):
        result = await db.notifications.delete_one(
            {
                "notification_id": notification_id,
                "user_id": user["user_id"],
            }
        )

        if not result.deleted_count:
            raise HTTPException(
                status_code=404,
                detail="Notification not found",
            )

        return {"message": "Notification deleted"}

    @router.delete("/notifications")
    async def clear_notifications(
        user=Depends(customer_user),
    ):
        await db.notifications.delete_many(
            {"user_id": user["user_id"]}
        )

        return {"message": "Notifications cleared"}

    @router.post("/admin/notifications")
    async def admin_create_notification(
        payload: AdminNotificationCreate,
        user=Depends(admin_user),
    ):
        if payload.send_to_all_customers:
            customer_ids = [
                customer["user_id"]
                async for customer in db.users.find(
                    {
                        "role": "customer",
                        "active": True,
                    },
                    {"user_id": 1},
                )
            ]

            notifications = [
                {
                    "notification_id": new_id("not"),
                    "user_id": customer_id,
                    "title": payload.title.strip(),
                    "message": payload.message.strip(),
                    "notification_type": payload.notification_type,
                    "link": payload.link,
                    "order_id": None,
                    "is_read": False,
                    "created_at": now_iso(),
                    "read_at": None,
                }
                for customer_id in customer_ids
            ]

            if notifications:
                await db.notifications.insert_many(notifications)

            return {
                "message": "Notification sent to all active customers",
                "sent_count": len(notifications),
            }

        if not payload.user_id:
            raise HTTPException(
                status_code=422,
                detail="Select a customer or enable send_to_all_customers",
            )

        target_user = await db.users.find_one(
            {
                "user_id": payload.user_id,
                "active": True,
            }
        )

        if not target_user:
            raise HTTPException(
                status_code=404,
                detail="Target user not found",
            )

        notification = await create_notification(
            db,
            notification_id=new_id("not"),
            user_id=payload.user_id,
            title=payload.title,
            message=payload.message,
            notification_type=payload.notification_type,
            link=payload.link,
            created_at=now_iso(),
        )

        return {
            "message": "Notification sent successfully",
            "notification": notification,
        }

    return router
