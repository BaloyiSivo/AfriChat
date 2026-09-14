from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import get_connection
from app.routes.auth import get_current_user


router = APIRouter(
    prefix="/friends",
    tags=["Friends"],
)


class FriendRequestCreate(BaseModel):
    receiver_id: int


class FriendRequestAction(BaseModel):
    request_id: int


@router.post("/request")
def send_friend_request(
    request: FriendRequestCreate,
    current_user=Depends(get_current_user),
):
    sender_id = current_user["id"]
    receiver_id = request.receiver_id

    if sender_id == receiver_id:
        raise HTTPException(
            status_code=400,
            detail="You cannot send a friend request to yourself.",
        )

    connection = get_connection()

    try:
        receiver = connection.execute(
            """
            SELECT id, username
            FROM users
            WHERE id = ?
            """,
            (receiver_id,),
        ).fetchone()

        if not receiver:
            raise HTTPException(
                status_code=404,
                detail="User not found.",
            )

        existing = connection.execute(
            """
            SELECT id, status
            FROM friend_requests
            WHERE sender_id = ? AND receiver_id = ?
            """,
            (sender_id, receiver_id),
        ).fetchone()

        if existing:
            if existing["status"] == "pending":
                raise HTTPException(
                    status_code=409,
                    detail="Friend request already sent.",
                )

            if existing["status"] == "accepted":
                raise HTTPException(
                    status_code=409,
                    detail="You are already friends.",
                )

        reverse = connection.execute(
            """
            SELECT id, status
            FROM friend_requests
            WHERE sender_id = ? AND receiver_id = ?
            """,
            (receiver_id, sender_id),
        ).fetchone()

        if reverse and reverse["status"] == "pending":
            raise HTTPException(
                status_code=409,
                detail="This user has already sent you a friend request.",
            )

        connection.execute(
            """
            INSERT INTO friend_requests
                (sender_id, receiver_id, status)
            VALUES (?, ?, 'pending')
            """,
            (sender_id, receiver_id),
        )

        connection.commit()

        return {
            "message": "Friend request sent.",
            "receiver": {
                "id": receiver["id"],
                "username": receiver["username"],
            },
        }

    finally:
        connection.close()


@router.get("/requests")
def get_friend_requests(
    current_user=Depends(get_current_user),
):
    connection = get_connection()

    try:
        requests = connection.execute(
            """
            SELECT
                fr.id,
                fr.sender_id,
                u.username AS sender_username,
                fr.status,
                fr.created_at
            FROM friend_requests fr
            JOIN users u ON u.id = fr.sender_id
            WHERE fr.receiver_id = ?
              AND fr.status = 'pending'
            ORDER BY fr.created_at DESC
            """,
            (current_user["id"],),
        ).fetchall()

        return {
            "requests": [dict(request) for request in requests]
        }

    finally:
        connection.close()


@router.post("/accept")
def accept_friend_request(
    request: FriendRequestAction,
    current_user=Depends(get_current_user),
):
    connection = get_connection()

    try:
        friend_request = connection.execute(
            """
            SELECT id, sender_id, receiver_id, status
            FROM friend_requests
            WHERE id = ?
              AND receiver_id = ?
            """,
            (request.request_id, current_user["id"]),
        ).fetchone()

        if not friend_request:
            raise HTTPException(
                status_code=404,
                detail="Friend request not found.",
            )

        if friend_request["status"] != "pending":
            raise HTTPException(
                status_code=400,
                detail="Friend request is no longer pending.",
            )

        connection.execute(
            """
            UPDATE friend_requests
            SET status = 'accepted'
            WHERE id = ?
            """,
            (request.request_id,),
        )

        connection.commit()

        return {
            "message": "Friend request accepted.",
            "friend_id": friend_request["sender_id"],
        }

    finally:
        connection.close()


@router.post("/reject")
def reject_friend_request(
    request: FriendRequestAction,
    current_user=Depends(get_current_user),
):
    connection = get_connection()

    try:
        friend_request = connection.execute(
            """
            SELECT id
            FROM friend_requests
            WHERE id = ?
              AND receiver_id = ?
              AND status = 'pending'
            """,
            (request.request_id, current_user["id"]),
        ).fetchone()

        if not friend_request:
            raise HTTPException(
                status_code=404,
                detail="Friend request not found.",
            )

        connection.execute(
            """
            UPDATE friend_requests
            SET status = 'rejected'
            WHERE id = ?
            """,
            (request.request_id,),
        )

        connection.commit()

        return {
            "message": "Friend request rejected."
        }

    finally:
        connection.close()


@router.get("")
def get_friends(
    current_user=Depends(get_current_user),
):
    user_id = current_user["id"]

    connection = get_connection()

    try:
        friends = connection.execute(
            """
            SELECT
                u.id,
                u.username,
                u.email,
                u.created_at
            FROM users u
            JOIN friend_requests fr
                ON (
                    (fr.sender_id = ? AND fr.receiver_id = u.id)
                    OR
                    (fr.receiver_id = ? AND fr.sender_id = u.id)
                )
            WHERE fr.status = 'accepted'
            ORDER BY u.username
            """,
            (user_id, user_id),
        ).fetchall()

        return {
            "friends": [dict(friend) for friend in friends]
        }

    finally:
        connection.close()
