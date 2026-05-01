import pandas as pd
import math
from database import shows_collection

def import_csv(path: str = "data/tmdb_imdb.csv"):
    # 1. On vide la base de données actuelle
    shows_collection.drop()

    print("[Import] Lecture du fichier optimisé de 25k films...")
    df = pd.read_csv(path)
    records = df.to_dict(orient="records")

    for r in records:
        # Nettoyage des NaN
        for k, v in r.items():
            if isinstance(v, float) and math.isnan(v):
                r[k] = None
                
        # 3. Mapping vers notre format standard
        r["type"] = "Movie"
        r["description"] = r.get("overview")
        r["listed_in"] = r.get("genres")
        r["rating"] = r.get("vote_average")
        
        # Extraction de l'année
        date = str(r.get("release_date", ""))
        r["release_year"] = date[:4] if date and date != "None" else ""
        
        # Récupération de l'image TMDB
        poster = r.get("poster_path")
        if poster and str(poster).startswith("/"):
            r["poster_url"] = f"https://image.tmdb.org/t/p/w500{poster}"
        else:
            r["poster_url"] = None

    # 4. Insertion en base
    print("[Import] Injection dans MongoDB en cours...")
    shows_collection.insert_many(records)

    # 5. Index pour la recherche rapide + index unique pour éviter les doublons
    shows_collection.create_index("title")
    shows_collection.create_index("type")
    shows_collection.create_index("listed_in")
    shows_collection.create_index("rating")

    print(f"[Import] Succès ! {len(records)} films importés dans ta base MongoDB.")

if __name__ == "__main__":
    import_csv()
