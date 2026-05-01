from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

# ─── MongoDB ────────────────────────────────────────────────
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB  = os.getenv("MONGODB_DB", "netflix")

client           = MongoClient(MONGODB_URI)
db               = client[MONGODB_DB]
shows_collection = db["shows"]

# ─── Redis (cache) ──────────────────────────────────────────
redis_client = None
try:
    import redis as redis_lib
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
    _r = redis_lib.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2)
    _r.ping()
    redis_client = _r
    print("[Redis] Connecté ✓")
except Exception as e:
    print(f"[Redis] Non disponible : {e}")

# ─── Elasticsearch ──────────────────────────────────────────
es_client = None
try:
    from elasticsearch import Elasticsearch
    ES_URL = os.getenv("ES_URL", "http://localhost:9200")
    _es = Elasticsearch(ES_URL, request_timeout=5)
    if _es.ping():
        es_client = _es
        print("[Elasticsearch] Connecté ✓")
    else:
        print("[Elasticsearch] Non disponible (ping failed).")
except Exception as e:
    print(f"[Elasticsearch] Non disponible : {e}")
