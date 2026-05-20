from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ── QR Style model ──────────────────────────────────────────────────────────

class QrStyle(BaseModel):
    dotColor: str = "#000000"
    backgroundColor: str = "#ffffff"
    backgroundImage: Optional[str] = None   # base64 data URL
    eyeOuterColor: str = "#000000"
    eyeInnerColor: str = "#000000"
    dotStyle: str = "square"                # square | rounded | dots | classy
    cornerStyle: str = "square"             # square | rounded | extra-rounded | dot
    logoImage: Optional[str] = None         # base64 data URL
    logoSizeRatio: float = 0.25
    logoBorderRadius: int = 8
    logoBackgroundColor: str = "#ffffff"
    errorCorrectionLevel: str = "H"
    updatedAt: Optional[str] = None


STYLE_DOC_ID = "global_qr_style"


@api_router.get("/qr-style", response_model=QrStyle)
async def get_qr_style():
    doc = await db.qr_styles.find_one({"_id": STYLE_DOC_ID}, {"_id": 0})
    if not doc:
        return QrStyle()
    return QrStyle(**doc)


@api_router.put("/qr-style", response_model=QrStyle)
async def save_qr_style(style: QrStyle):
    style.updatedAt = datetime.now(timezone.utc).isoformat()
    data = style.model_dump()
    await db.qr_styles.replace_one(
        {"_id": STYLE_DOC_ID},
        {"_id": STYLE_DOC_ID, **data},
        upsert=True,
    )
    return style


# ── Health ───────────────────────────────────────────────────────────────────

@api_router.get("/")
async def root():
    return {"message": "QR Generator API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
