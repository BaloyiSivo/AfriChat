
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr

from app.database import get_connection


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

password_hasher = PasswordHasher()
security = HTTPBearer()

JWT_SECRET = "change-this-secret-before-production"
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60 * 24 * 7


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


def create_access_token(user_id: int):
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token.",
        )

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token.",
        )

    connection = get_connection()

    try:
        user = connection.execute(
            """
            SELECT id, username, email, created_at
            FROM users
            WHERE id = ?
            """,
            (int(user_id),),
        ).fetchone()

        if not user:
            raise HTTPException(
                status_code=401,
                detail="User no longer exists.",
            )

        return dict(user)

    finally:
        connection.close()


@router.post("/register")
def register(request: RegisterRequest):
    username = request.username.strip()
    email = request.email.strip().lower()

    if len(username) < 3:
        raise HTTPException(
            status_code=400,
            detail="Username must be at least 3 characters long.",
        )

    if len(username) > 30:
        raise HTTPException(
            status_code=400,
            detail="Username must not exceed 30 characters.",
        )

    if len(request.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long.",
        )

    password_hash = password_hasher.hash(request.password)

    connection = get_connection()

    try:
        existing_user = connection.execute(
            """
            SELECT id
            FROM users
            WHERE username = ? OR email = ?
            """,
            (username, email),
        ).fetchone()

        if existing_user:
            raise HTTPException(
                status_code=409,
                detail="Username or email is already registered.",
            )

        cursor = connection.execute(
            """
            INSERT INTO users (username, email, password_hash)
            VALUES (?, ?, ?)
            """,
            (username, email, password_hash),
        )

        connection.commit()

        user_id = cursor.lastrowid
        token = create_access_token(user_id)

        return {
            "message": "Account created successfully.",
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "username": username,
                "email": email,
            },
        }

    finally:
        connection.close()


@router.post("/login")
def login(request: LoginRequest):
    email = request.email.strip().lower()

    connection = get_connection()

    try:
        user = connection.execute(
            """
            SELECT id, username, email, password_hash
            FROM users
            WHERE email = ?
            """,
            (email,),
        ).fetchone()

        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password.",
            )

        try:
            password_hasher.verify(
                user["password_hash"],
                request.password,
            )
        except VerifyMismatchError:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password.",
            )

        token = create_access_token(user["id"])

        return {
            "message": "Login successful.",
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
            },
        }

    finally:
        connection.close()


@router.get("/me")
def get_me(current_user=Depends(get_current_user)):
    return {
        "user": current_user
    }
