"""API Carnet Alimentaire — LXC unique
Sert la base de connaissances (interactions, PNNS) et un endpoint santé.
RGPD : AUCUNE donnée de santé n'est stockée ici — l'API ne persiste rien.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import json
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent

app = FastAPI(title="Carnet Alimentaire API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # usage perso via Tailscale ; restreindre au domaine en production
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

def load_knowledge():
    with open(APP_DIR / "connaissances.json", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/health")
def health():
    return {"status": "ok", "app": "carnet-alimentaire", "version": "0.2.0"}

@app.get("/api/knowledge")
def knowledge():
    """Base de connaissances publique (interactions + PNNS). Aucune donnée perso."""
    return load_knowledge()

# Frontend PWA servi par Nginx ; fallback statique si accès direct :8000
app.mount("/", StaticFiles(directory=str(APP_DIR), html=True), name="static")
