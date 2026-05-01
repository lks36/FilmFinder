import math
import json
import re
import hashlib
from typing import List, Optional

from fastapi import FastAPI, Query, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import shows_collection, redis_client, es_client
from bson import ObjectId
from import_data import import_csv

app = FastAPI(
    title="Netflix Catalogue API",
    description="API REST pour le catalogue Netflix — Projet LU3IN403",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ES_INDEX = "shows"

# ─── Helpers cache Redis ────────────────────────────────────

def cache_get(key: str):
    if not redis_client:
        return None
    try:
        val = redis_client.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None


def cache_set(key: str, data, ttl: int = 300):
    if not redis_client:
        return
    try:
        redis_client.setex(key, ttl, json.dumps(data, default=str))
    except Exception:
        pass


def make_key(*args) -> str:
    raw = ":".join(str(a) for a in args)
    return "netplixe:" + hashlib.md5(raw.encode()).hexdigest()


# ─── Helper MongoDB ─────────────────────────────────────────

def clean_show(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


# ─── Elasticsearch helpers ──────────────────────────────────

def _es_ensure_index():
    if not es_client:
        return
    try:
        if not es_client.indices.exists(index=ES_INDEX):
            es_client.indices.create(
                index=ES_INDEX,
                mappings={
                    "properties": {
                        "mongo_id":    {"type": "keyword"},
                        "title":       {"type": "text", "analyzer": "standard"},
                        "description": {"type": "text", "analyzer": "standard"},
                        "listed_in":   {"type": "text",
                                        "fields": {"keyword": {"type": "keyword"}}},
                        "type":        {"type": "keyword"},
                        "release_year": {"type": "keyword"},
                        "rating":      {"type": "float"},
                        "country":     {"type": "keyword"},
                    }
                }
            )
            print(f"[ES] Index '{ES_INDEX}' créé.")
    except Exception as e:
        print(f"[ES] Erreur création index : {e}")


def _es_index_all():
    if not es_client:
        return
    try:
        count = es_client.count(index=ES_INDEX).get("count", 0)
        if count > 0:
            print(f"[ES] Index déjà rempli ({count} docs). Skip.")
            return

        from elasticsearch.helpers import bulk

        def _generate():
            for doc in shows_collection.find({}):
                mid = str(doc["_id"])
                yield {
                    "_index": ES_INDEX,
                    "_id":    mid,
                    "_source": {
                        "mongo_id":    mid,
                        "title":       doc.get("title") or "",
                        "description": doc.get("description") or doc.get("overview") or "",
                        "listed_in":   doc.get("listed_in") or "",
                        "type":        doc.get("type") or "Movie",
                        "release_year": doc.get("release_year") or "",
                        "rating":      float(doc.get("rating") or 0),
                        "country":     doc.get("country") or "",
                    }
                }

        success, errors = bulk(es_client, _generate(), raise_on_error=False, chunk_size=500)
        print(f"[ES] Indexation terminée : {success} docs, {len(errors)} erreurs.")
    except Exception as e:
        print(f"[ES] Erreur indexation : {e}")


# ─── Startup ────────────────────────────────────────────────

@app.on_event("startup")
def startup_event():
    if shows_collection.count_documents({}) == 0:
        print("[Startup] Base vide — import en cours...")
        try:
            import_csv()
            print("[Startup] Import réussi !")
        except Exception as e:
            print(f"[Startup] Erreur import : {e}")
    else:
        print("[Startup] Base déjà remplie. Prêt !")

    _es_ensure_index()
    _es_index_all()


# ─── Routes ─────────────────────────────────────────────────

@app.get("/hello")
def hello():
    return {"message": "Hello World"}


@app.get("/health")
def health():
    redis_ok = False
    es_ok    = False
    if redis_client:
        try:
            redis_ok = bool(redis_client.ping())
        except Exception:
            pass
    if es_client:
        try:
            es_ok = bool(es_client.ping())
        except Exception:
            pass
    return {
        "status": "ok",
        "total_shows": shows_collection.count_documents({}),
        "redis":         {"available": redis_ok},
        "elasticsearch": {"available": es_ok},
    }


# --- /shows (avec pagination + tri + filtre genre/type) -----

@app.get("/shows")
def get_shows(
    limit:   int           = Query(default=20, ge=1, le=200),
    skip:    int           = Query(default=0,  ge=0),
    page:    Optional[int] = Query(default=None, ge=1),
    type:    Optional[str] = Query(default=None),
    genre:   Optional[str] = Query(default=None),
    sort_by: Optional[str] = Query(default=None),
):
    """Catalogue paginé avec tri et filtres."""
    if page is not None:
        skip = (page - 1) * limit

    cache_key = make_key("shows", limit, skip, type, genre, sort_by)
    cached = cache_get(cache_key)
    if cached:
        cached["from_cache"] = True
        return cached

    query: dict = {}
    if type:
        query["type"] = type
    if genre:
        query["listed_in"] = {"$regex": re.escape(genre), "$options": "i"}

    sort = []
    if sort_by == "rating":
        sort = [("rating", -1)]
    elif sort_by == "release_year":
        sort = [("release_year", -1)]

    total  = shows_collection.count_documents(query)
    cursor = shows_collection.find(query)
    if sort:
        cursor = cursor.sort(sort)
    items = [clean_show(doc) for doc in cursor.skip(skip).limit(limit)]

    result = {
        "items":      items,
        "total":      total,
        "page":       (skip // limit) + 1 if limit else 1,
        "pages":      math.ceil(total / limit) if total > 0 else 0,
        "limit":      limit,
        "skip":       skip,
        "from_cache": False,
    }
    cache_set(cache_key, result)
    return result


# --- /shows/search (recherche simple MongoDB) ---------------

@app.get("/shows/search")
def search_shows(
    q:     str = Query(..., min_length=1),
    limit: int = Query(default=20, ge=1, le=100),
    skip:  int = Query(default=0,  ge=0),
):
    """Recherche par titre, description ou genre (insensible à la casse)."""
    cache_key = make_key("search", q, limit, skip)
    cached = cache_get(cache_key)
    if cached:
        cached["from_cache"] = True
        return cached

    regex = {"$regex": re.escape(q), "$options": "i"}
    query = {"$or": [{"title": regex}, {"description": regex}, {"listed_in": regex}]}

    total  = shows_collection.count_documents(query)
    cursor = shows_collection.find(query).sort("rating", -1).skip(skip).limit(limit)
    items  = [clean_show(doc) for doc in cursor]

    result = {
        "items":      items,
        "total":      total,
        "page":       (skip // limit) + 1 if limit else 1,
        "pages":      math.ceil(total / limit) if total > 0 else 0,
        "limit":      limit,
        "skip":       skip,
        "from_cache": False,
    }
    cache_set(cache_key, result)
    return result


# --- /shows/search/advanced (Elasticsearch + fallback Mongo)

@app.get("/shows/search/advanced")
def search_advanced(
    q:          Optional[str]   = Query(default=None),
    genre:      Optional[str]   = Query(default=None),
    min_year:   Optional[int]   = Query(default=None),
    max_year:   Optional[int]   = Query(default=None),
    min_rating: Optional[float] = Query(default=None),
    type:       Optional[str]   = Query(default=None),
    limit:      int             = Query(default=20, ge=1, le=100),
    skip:       int             = Query(default=0,  ge=0),
):
    """Recherche avancée via Elasticsearch (avec fallback MongoDB)."""
    if es_client:
        return _search_es(q, genre, min_year, max_year, min_rating, type, limit, skip)
    return _search_mongo_advanced(q, genre, min_year, max_year, min_rating, type, limit, skip)


def _search_es(q, genre, min_year, max_year, min_rating, type_, limit, skip):
    cache_key = make_key("adv_es", q, genre, min_year, max_year, min_rating, type_, limit, skip)
    cached = cache_get(cache_key)
    if cached:
        cached["from_cache"] = True
        return cached

    must    = []
    filters = []

    if q:
        must.append({
            "multi_match": {
                "query":     q,
                "fields":    ["title^3", "description", "listed_in^2"],
                "fuzziness": "AUTO",
                "type":      "best_fields",
            }
        })
    if genre:
        filters.append({"match": {"listed_in": genre}})
    if type_:
        filters.append({"term": {"type": type_}})
    if min_year or max_year:
        yr = {}
        if min_year:
            yr["gte"] = str(min_year)
        if max_year:
            yr["lte"] = str(max_year)
        filters.append({"range": {"release_year": yr}})
    if min_rating is not None:
        filters.append({"range": {"rating": {"gte": min_rating}}})

    es_query = {
        "bool": {
            "must":   must or [{"match_all": {}}],
            "filter": filters,
        }
    }

    try:
        resp  = es_client.search(index=ES_INDEX, query=es_query, from_=skip, size=limit)
        hits  = resp["hits"]["hits"]
        total = resp["hits"]["total"]["value"]

        mongo_ids = [hit["_id"] for hit in hits]
        docs_map  = {
            str(d["_id"]): d
            for d in shows_collection.find(
                {"_id": {"$in": [ObjectId(mid) for mid in mongo_ids]}}
            )
        }
        items = [clean_show(docs_map[mid]) for mid in mongo_ids if mid in docs_map]

        result = {
            "items":      items,
            "total":      total,
            "page":       (skip // limit) + 1 if limit else 1,
            "pages":      math.ceil(total / limit) if total > 0 else 0,
            "limit":      limit,
            "skip":       skip,
            "from_cache": False,
            "engine":     "elasticsearch",
        }
        cache_set(cache_key, result, ttl=120)
        return result

    except Exception as e:
        print(f"[ES] Erreur recherche : {e} — fallback MongoDB")
        return _search_mongo_advanced(q, genre, min_year, max_year, min_rating, type_, limit, skip)


def _search_mongo_advanced(q, genre, min_year, max_year, min_rating, type_, limit, skip):
    cache_key = make_key("adv_mongo", q, genre, min_year, max_year, min_rating, type_, limit, skip)
    cached = cache_get(cache_key)
    if cached:
        cached["from_cache"] = True
        return cached

    query: dict = {}
    if q:
        regex = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{"title": regex}, {"description": regex}]
    if genre:
        query["listed_in"] = {"$regex": re.escape(genre), "$options": "i"}
    if type_:
        query["type"] = type_

    yr_filter: dict = {}
    if min_year:
        yr_filter["$gte"] = str(min_year)
    if max_year:
        yr_filter["$lte"] = str(max_year)
    if yr_filter:
        query["release_year"] = yr_filter

    if min_rating is not None:
        query["rating"] = {"$gte": min_rating}

    total  = shows_collection.count_documents(query)
    cursor = shows_collection.find(query).sort("rating", -1).skip(skip).limit(limit)
    items  = [clean_show(doc) for doc in cursor]

    result = {
        "items":      items,
        "total":      total,
        "page":       (skip // limit) + 1 if limit else 1,
        "pages":      math.ceil(total / limit) if total > 0 else 0,
        "limit":      limit,
        "skip":       skip,
        "from_cache": False,
        "engine":     "mongodb",
    }
    cache_set(cache_key, result, ttl=120)
    return result


# --- /shows/favorites (POST avec liste d'IDs) ---------------

class FavoritesRequest(BaseModel):
    ids: List[str]


@app.post("/shows/favorites")
def get_favorites(body: FavoritesRequest):
    """Retourne les shows correspondant à une liste d'IDs (favoris stockés côté client)."""
    valid_ids = [ObjectId(id_) for id_ in body.ids if ObjectId.is_valid(id_)]
    if not valid_ids:
        return []
    docs = shows_collection.find({"_id": {"$in": valid_ids}})
    return [clean_show(doc) for doc in docs]


# --- /shows/stats -------------------------------------------

@app.get("/shows/stats")
def get_stats():
    """Statistiques sur le catalogue."""
    cache_key = make_key("stats")
    cached = cache_get(cache_key)
    if cached:
        return cached

    total    = shows_collection.count_documents({})
    movies   = shows_collection.count_documents({"type": "Movie"})
    tv_shows = shows_collection.count_documents({"type": "TV Show"})

    top_countries = list(shows_collection.aggregate([
        {"$match":  {"country": {"$ne": None}}},
        {"$group":  {"_id": "$country", "count": {"$sum": 1}}},
        {"$sort":   {"count": -1}},
        {"$limit":  5},
    ]))

    result = {
        "total":         total,
        "movies":        movies,
        "tv_shows":      tv_shows,
        "top_countries": [{"country": r["_id"], "count": r["count"]} for r in top_countries],
    }
    cache_set(cache_key, result, ttl=3600)
    return result


# --- /shows/{id} --------------------------------------------

@app.get("/shows/{show_id}")
def get_show(show_id: str):
    """Retourne un show par son ID MongoDB."""
    cache_key = make_key("show", show_id)
    cached = cache_get(cache_key)
    if cached:
        cached["from_cache"] = True
        return cached

    try:
        doc = shows_collection.find_one({"_id": ObjectId(show_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="ID invalide")
    if not doc:
        raise HTTPException(status_code=404, detail="Show introuvable")

    show = clean_show(doc)
    cache_set(cache_key, show, ttl=3600)
    return show


# --- /shows/{id}/similar (recommandations par genres) -------

@app.get("/shows/{show_id}/similar")
def get_similar(
    show_id: str,
    limit:   int = Query(default=8, ge=1, le=20),
):
    """Recommande des films similaires en se basant sur les genres partagés."""
    cache_key = make_key("similar", show_id, limit)
    cached = cache_get(cache_key)
    if cached:
        return {"items": cached, "from_cache": True}

    try:
        doc = shows_collection.find_one({"_id": ObjectId(show_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="ID invalide")
    if not doc:
        raise HTTPException(status_code=404, detail="Show introuvable")

    genres = [g.strip() for g in (doc.get("listed_in") or "").split(",") if g.strip()]
    if not genres:
        return {"items": [], "from_cache": False}

    genre_regex = "|".join(re.escape(g) for g in genres[:3])
    # Le dataset a ~4x doublons, donc on fetch 50x plus pour obtenir `limit` films uniques
    fetch_limit = min(limit * 50, 500)
    cursor = shows_collection.find({
        "_id":       {"$ne": ObjectId(show_id)},
        "listed_in": {"$regex": genre_regex, "$options": "i"},
        "rating":    {"$ne": None, "$gte": 6.0},
    }).sort("rating", -1).limit(fetch_limit)

    # Déduplication Python par titre+année avant de retourner
    seen:  set   = set()
    items: list  = []
    for d in cursor:
        key = (str(d.get("title", "")) + str(d.get("release_year", ""))).lower().strip()
        if key and key not in seen:
            seen.add(key)
            items.append(clean_show(d))
            if len(items) >= limit:
                break

    cache_set(cache_key, items, ttl=600)
    return {"items": items, "from_cache": False}
