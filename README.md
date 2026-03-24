# Projet d'étude - Projet Opsci
# Le projet est entrain d'être mise à jour 

## Description du projet

Ce dépôt contient les travaux réalisés dans le cadre du module **Opsci 2025**.

L'objectif principal du projet est de concevoir une application web simple permettant :

- la conception d'une architecture logicielle claire ;
- l'implémentation d'un back-end ;
- la création d'une interface front-end ;
- la manipulation et l'affichage de données (films).

---
## Structure du Projet

```text
.
├── backend/            # Serveur Python (FastAPI)
│   ├── main.py         # Code du serveur et routes API
│   ├── .env            # Fichier de configuration (Clé API)
│   └── exports/        # Dossier de stockage des collectes JSON
└── frontend/           # Interface utilisateur (Web)
    ├── index.html      # Structure de la page
    ├── style.css       # Design et mise en page
    └── script.js       # Logique d'appel au backend et affichage
```

---

## Fonctionnalités

### Back-end

- Implémentation en Python
- Lecture et manipulation des données depuis un fichier JSON
- Gestion des ressources (films, images)

### Front-end

- Interface web simple en HTML / CSS / JavaScript
- Affichage dynamique d'un catalogue de films
- Organisation des ressources visuelles

---

## Installation et exécution

### Prérequis
#### TOKEN
Avant de lancer le site, on doit obtenir une clé API / token depuis le site TMDB,
inscrivez et conncetez :
https://www.themoviedb.org/settings/api

Vous pouvez tester directement sur un navigateur avec ce lien, on modifiant api key :
https://api.themoviedb.org/3/movie/550?api_key=COLLEZ_VOTRE_API_KEY_ICI

puis ajouter dans .env le token dans le dossier backend/ :
TMDB_TOKEN=votre_token_access_ici

### 1. Cloner le dépôt

```bash
git clone https://github.com/lks36/FilmFinder.git

cd Finder/backend
pip install fastapi uvicorn python-dotenv requests

uvicorn main:app --reload

# puis ouvrez simplement le fichier frontend/index.html dans votre navigateu

```
---
## Données

***movies.json*** contient les informations sur les films.

Les dossiers ***images/*** et ***Images/*** contiennent les ressources visuelles.

---
## Documentation
***Projet.md*** : description globale du projet.

[RapportTME2.md](./TME2/RapportTME2.md) : rapport détaillé du travail réalisé
