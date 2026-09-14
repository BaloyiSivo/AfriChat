from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import get_connection
from app.routes.auth import get_current_user


router = APIRouter(
    prefix="/conversations",
    tags=["Conversations"],
)


class CreateConversationRequest(BaseModel):
    friend_id: int


@router.post("")
def create_conversation(
    request: CreateConversationRequest,
    current_user=Depends(get_current_user),
):
    user_id = current_user["id"]
    friend_id = request.friend_id

    if user_id == friend_id:
        raise HTTPException(
            status_code=400,
            detail="You cannot start a conversation with yourself.",
        )

    connection = get_connection()

    try:
        friend = connection.execute(
            """
            SELECT id, username
            FROM users
            WHERE id = ?
            """,
            (friend_id,),
        ).fetchone()

        if not friend:
            raise HTTPException(
                status_code=404,
                detail="User not found.",
            )

        friendship = connection.execute(
            """
            SELECT id
            FROM friend_requests
            WHERE status = 'accepted'
              AND (
                    (sender_id = ? AND receiver_id = ?)
                    OR
                    (sender_id = ? AND receiver_id = ?)
              )
            """,
            (
                user_id,
                friend_id,
                friend_id,
                user_id,
            ),
        ).fetchone()

        if not friendship:
            raise HTTPException(
                status_code=403,
                detail="You can only chat with accepted friends.",
            )

        existing = connection.execute(
            """
            SELECT c.id
            FROM conversations c
            JOIN conversation_members cm1
                ON cm1.conversation_id = c.id
            JOIN conversation_members cm2
                ON cm2.conversation_id = c.id
            WHERE cm1.user_id = ?
              AND cm2.user_id = ?
              AND (
                    SELECT COUNT(*)
                    FROM conversation_members cm3
                    WHERE cm3.conversation_id = c.id
              ) = 2
            LIMIT 1
            """,
            (user_id, friend_id),
        ).fetchone()

        if existing:
            return {
                "message": "Conversation already exists.",
                "conversation_id": existing["id"],
                "friend": {
                    "id": friend["id"],
                    "username": friend["username"],
                },
            }

        cursor = connection.execute(
            """
            INSERT INTO conversations DEFAULT VALUES
            """
        )

        conversation_id = cursor.lastrowid

        connection.execute(
            """
            INSERT INTO conversation_members
                (conversation_id, user_id)
            VALUES (?, ?)
            """,
            (conversation_id, user_id),
        )

        connection.execute(
            """
            INSERT INTO conversation_members
                (conversation_id, user_id)
            VALUES (?, ?)
            """,
            (conversation_id, friend_id),
        )

        connection.commit()

        return {
            "message": "Conversation created successfully.",
            "conversation_id": conversation_id,
            "friend": {
                "id": friend["id"],
                "username": friend["username"],
            },
        }

    finally:
        connection.close()


@router.get("")
def get_conversations(
    current_user=Depends(get_current_user),
):
    user_id = current_user["id"]

    connection = get_connection()

    try:
        conversations = connection.execute(
            """
            SELECT
                c.id AS conversation_id,
                u.id AS friend_id,
                u.username AS friend_username
            FROM conversations c
            JOIN conversation_members mine
                ON mine.conversation_id = c.id
               AND mine.user_id = ?
            JOIN conversation_members other
                ON other.conversation_id = c.id
               AND other.user_id != ?
            JOIN users u
                ON u.id = other.user_id
            ORDER BY c.id DESC
            """,
            (user_id, user_id),
        ).fetchall()

        return {
            "conversations": [dict(conversation) for conversation in conversations]
        }

    finally:
        connection.close()
