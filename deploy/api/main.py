"""API Carnet Alimentaire — LXC unique
Sert la base de connaissances (interactions, PNNS), un endpoint santé
et un PROXY IA Mistral : la clé API reste côté serveur, les utilisateurs
n'ont rien à configurer.
RGPD : AUCUNE donnée de santé n'est stockée ici — l'API ne persiste rien,
ne loggue jamais le corps des requêtes, et transmet à Mistral uniquement
le temps de la requête d'analyse.
"""
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import json
import os
import urllib.request
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent

app = FastAPI(title="Carnet Alimentaire API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # usage perso via Tailscale ; restreindre au domaine en production
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions"
MISTRAL_MODELS = {"text": "mistral-small-latest", "vision": "pixtral-12b-latest"}

def mistral_key():
    key = os.environ.get("MISTRAL_API_KEY", "")
    if not key:
        raise HTTPException(status_code=503, detail="Proxy IA non configuré (MISTRAL_API_KEY absente)")
    return key

def load_knowledge():
    with open(APP_DIR / "connaissances.json", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/health")
def health():
    configured = bool(os.environ.get("MISTRAL_API_KEY", ""))
    return {"status": "ok", "app": "carnet-alimentaire", "version": "0.3.0", "ia_proxy": configured}

@app.get("/api/knowledge")
def knowledge():
    """Base de connaissances publique (interactions + PNNS). Aucune donnée perso."""
    return load_knowledge()

@app.post("/api/analyse")
async def analyse(request: Request):
    """Proxy vers Mistral AI.
    Reçoit {messages: [...], vision: bool} — jamais stocké, jamais loggué.
    Retourne la réponse Mistral telle quelle. En cas d'échec, le front
    retombe automatiquement sur l'analyse locale.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Corps JSON invalide")

    messages = body.get("messages")
    if not messages or not isinstance(messages, list):
        raise HTTPException(status_code=400, detail="Champ messages manquant")

    model = MISTRAL_MODELS["vision"] if body.get("vision") else MISTRAL_MODELS["text"]
    payload = json.dumps({
        "model": model,
        "messages": messages,
        "max_tokens": 400,
        "temperature": 0.3,
    }).encode("utf-8")

    req = urllib.request.Request(
        MISTRAL_API_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + mistral_key(),
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Mistral HTTP {e.code}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur proxy IA: {e}")

# Frontend PWA servi par Nginx ; fallback statique si accès direct :8000
app.mount("/", StaticFiles(directory=str(APP_DIR), html=True), name="static")
