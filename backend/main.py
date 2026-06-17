from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles  # <-- добавьте
import os
from backend.routers import vacancies, analytics, graph

app = FastAPI(title="IT Vacancy Analytics")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vacancies.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(graph.router, prefix="/api")

# ---- Добавьте этот блок ----
frontend_path = os.path.join(os.path.dirname(__file__), '..', 'frontend')
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
# ----------------------------

@app.get("/")
async def root():
    return {"message": "IT Vacancy Analytics API"}