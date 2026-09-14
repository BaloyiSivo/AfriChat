from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import initialize_database
from app.routes.auth import router as auth_router
from app.routes.users import router as users_router
from app.routes.friends import router as friends_router
from app.routes.messages import router as messages_router
from app.routes.conversations import router as conversations_router


app = FastAPI(
    title="AfriChat API",
    description="Backend API for the AfriChat communication platform.",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


initialize_database()

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(friends_router)
app.include_router(messages_router)
app.include_router(conversations_router)


@app.get("/")
def root():
    return {
        "name": "AfriChat",
        "message": "AfriChat API is running",
        "version": "1.0.0",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }
