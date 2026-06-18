from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from db.database import Base, engine

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Nest_Fast_Analyzer",
    description="API to import/export xlsb docs",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Endpoints
@app.get('/')
def root():
    return {"message": "Analyzer backend"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
