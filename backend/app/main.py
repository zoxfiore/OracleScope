from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.connections import router as connections_router
from app.api.overview import router as overview_router

app = FastAPI(
    title="OracleScope API",
    description="Oracle Database exploration and monitoring platform.",
    version="0.1.0",
)

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(connections_router)
app.include_router(overview_router)

@app.get("/")
def read_root():
    return {"message": "OracleScope API is running"}

