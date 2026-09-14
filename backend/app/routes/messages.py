from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import get_connection
from app.routes.auth import get_current_user


router = APIRouter(
    prefix="/messages",
    tags=["Messages"],
)


class SendMessageRequest(BaseModel):
    conversation_id: int
    content: str


@router.post("/send")
def send_message(
    request: SendMessageRequest,
    current_user=Depends(get_current_user),
):
    content = request.content.strip()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty.",
        )

    if len(content) > 5000:
        raise HTTPException(
            status_code=400,
            detail="Message is too long.",
        )

    connection = get_connection()

    try:
        membership = connection.execute(
            """
            SELECT 1
            FROM conversation_members
            WHERE conversation_id = ?
              AND user_id = ?
            """,
            (
                request.conversation_id,
                current_user["id"],
            ),
        ).fetchone()

        if not membership:
            raise HTTPException(
                status_code=403,
                detail="You are not a member of this conversation.",
            )

        cursor = connection.execute(
            """
            INSERT INTO messages (
                conversation_id,
                sender_id,
                content
            )
            VALUES (?, ?, ?)
            """,
            (
                request.conversation_id,
                current_user["id"],
                content,
            ),
        )

        connection.commit()

        message_id = cursor.lastrowid

        message = connection.execute(
            """
            SELECT
                m.id,
                m.conversation_id,
                m.sender_id,
                u.username AS sender_username,
                m.content,
                m.created_at
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            WHERE m.id = ?
            """,
            (message_id,),
        ).fetchone()

        return {
            "message": dict(message)
        }

    finally:
        connection.close()


@router.get("/{conversation_id}")
def get_messages(
    conversation_id: int,
    current_user=Depends(get_current_user),
):
    connection = get_connection()

    try:
        membership = connection.execute(
            """
            SELECT 1
            FROM conversation_members
            WHERE conversation_id = ?
              AND user_id = ?
            """,
            (
                conversation_id,
                current_user["id"],
            ),
        ).fetchone()

        if not membership:
            raise HTTPException(
                status_code=403,
                detail="You are not a member of this conversation.",
            )

        messages = connection.execute(
            """
            SELECT
                m.id,
                m.conversation_id,
                m.sender_id,
                u.username AS sender_username,
                m.content,
                m.created_at
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            WHERE m.conversation_id = ?
            ORDER BY m.created_at ASC, m.id ASC
            """,
            (conversation_id,),
        ).fetchall()

        return {
            "conversation_id": conversation_id,
            "messages": [dict(message) for message in messages],
        }

    finally:
        connection.close()


@router.delete("/{message_id}")
def delete_message(
    message_id: int,
    current_user=Depends(get_current_user),
):
    connection = get_connection()

    try:
        message = connection.execute(
            """
            SELECT id, sender_id
            FROM messages
            WHERE id = ?
            """,
            (message_id,),
        ).fetchone()

        if not message:
            raise HTTPException(
                status_code=404,
                detail="Message not found.",
            )

        if message["sender_id"] != current_user["id"]:
            raise HTTPException(
                status_code=403,
                detail="You can only delete your own messages.",
            )

        connection.execute(
            """
            DELETE FROM messages
            WHERE id = ?
            """,
            (message_id,),
        )

        connection.commit()

        return {
            "message": "Message deleted successfully."
        }

    finally:
        connection.close()
