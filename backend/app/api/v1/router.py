from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin,
    ads,
    analytics,
    auth,
    bug_reports,
    business,
    events,
    friendships,
    messages,
    notifications,
    payments,
    photos_and_badges,
    reports,
    users,
    verification,
)

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(users.router, prefix="/users", tags=["users"])
router.include_router(friendships.router, tags=["friendships"])
router.include_router(events.router, prefix="/events", tags=["events"])
router.include_router(messages.router, tags=["messages"])
router.include_router(photos_and_badges.router, tags=["photos", "badges"])
router.include_router(notifications.router, tags=["notifications"])
router.include_router(admin.router, prefix="/admin", tags=["admin"])
router.include_router(verification.router, tags=["verification"])
router.include_router(reports.router, tags=["reports"])
router.include_router(payments.router, tags=["payments"])
router.include_router(ads.router, prefix="/ads", tags=["ads"])
router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
router.include_router(business.router, prefix="/business", tags=["business"])
router.include_router(bug_reports.router, tags=["bug-reports"])
