from fastapi import APIRouter, Depends, HTTPException

from app.database import get_connection
from app.routes.auth import get_current_user


router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


@router.get("/search")
def search_users(
    username: str,
    current_user=Depends(get_current_user),
):
    username = username.strip()

    if len(username) < 1:
        raise HTTPException(
            status_code=400,
            detail="Please enter a username to search.",
        )

    connection = get_connection()

    try:
        users = connection.execute(
            """
            SELECT id, username, email, created_at
            FROM users
            WHERE username LIKE ?
            AND id != ?
            ORDER BY username
            LIMIT 20
            """,
            (f"%{username}%", current_user["id"]),
        ).fetchall()

        return {
            "users": [dict(user) for user in users]
        }

    finally:
        connection.close()
