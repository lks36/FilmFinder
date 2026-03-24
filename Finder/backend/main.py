from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import requests
import json # On ajoute cet import en haut du fichier
from datetime import datetime
from pathlib import Path

# Charger la clé API depuis le fichier .env
load_dotenv()
# Récupérer la clé API TMDB depuis les variables d'environnement
TMDB_TOKEN = os.getenv("TMDB_TOKEN")
# URL de base pour les requêtes à l'API TMDB
TMDB_BASE_URL = "https://api.themoviedb.org/3"
# On définit le chemin vers le dossier exports
EXPORT_DIR = Path(__file__).parent / "exports"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Autorise tout le monde (pour le TME)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/export")
def export_movies(page: int = 1):
    """
    Cette route récupère les films et les enregistre dans un fichier JSON.
    """
    all_movies = []
    # Préparer les en-têtes d'authentification pour l'API TMDB
    headers = {"Authorization": f"Bearer {TMDB_TOKEN}", "accept": "application/json"}
    
    # Appel à l'API réelle TMDB
    for page_num in range(1, page + 1): # Boucle de 1 à nb_pages
        url = f"{TMDB_BASE_URL}/movie/popular?language=fr-FR&page={page_num}"
        response = requests.get(url, headers=headers)
        
        # Si la requête est réussie, on ajoute les films de cette page à notre liste
        if response.status_code == 200:
            page_data = response.json().get("results", [])
            # On ajoute les films de cette page à notre grande liste
            all_movies.extend(page_data) 
        else:
            break # On s'arrête s'il y a une erreur (ex: 429 Too Many Requests)

    # prépare un nom de fichier unique avec la date et l'heure
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"movies_export_{timestamp}.json"
    file_path = EXPORT_DIR / filename

    #écrit les données dans le fichier sur le disque dur
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(all_movies, f, ensure_ascii=False, indent=4)

    return {"status": "Succès", "file_created": filename, "path": str(file_path)}

@app.get("/movies")
def get_movies(limit: int = 20):
    """
    Route qui récupère les films populaires sur TMDB 
    et les renvoie dans un format propre.
    """
    url = f"{TMDB_BASE_URL}/movie/popular?language=fr-FR&page=1"
    headers = {
        "Authorization": f"Bearer {TMDB_TOKEN}",
        "accept": "application/json"
    }

    # Appel à l'API réelle TMDB
    response = requests.get(url, headers=headers)
    
    # Gestion des erreurs : si TMDB ne répond pas correctement, on renvoie une erreur au front-end
    if response.status_code != 200:
        return {"error": "Erreur TMDB", "status": response.status_code}

    data = response.json()
    results = data.get("results", [])

    # Normalisation : on transforme les données complexes de TMDB
    # en un format simple pour notre front-end
    movies = []
    for m in results[:limit]:
        movies.append({
            "title": m.get("title"),
            "description": m.get("overview"),
            "image_url": f"https://image.tmdb.org/t/p/w500{m.get('poster_path')}",
            "year": (m.get("release_date") or "")[:4]
        })

    return movies