# Projet d'étude - Projet Opsci

## Description du projet

Ce dépôt contient les travaux réalisés dans le cadre du module **Opsci 2025**, notamment les travaux pratiques **TME2**.

L'objectif principal du projet est de concevoir une application web simple permettant :

- la conception d'une architecture logicielle claire ;
- l'implémentation d'un back-end ;
- la création d'une interface front-end ;
- la manipulation et l'affichage de données (films).

Le projet est organisé par TME et sépare clairement les composants front-end et back-end.

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

Avant de lancer le site, on doit obtenir une clé API / token depuis le site TMDB,
inscrivez et conncetez :
https://www.themoviedb.org/settings/api

Vous pouvez tester directement sur un navigateur avec ce lien, on modifiant api key :
https://api.themoviedb.org/3/movie/550?api_key=COLLEZ_VOTRE_API_KEY_ICI

### 1. Cloner le dépôt

```bash
git clone https://github.com/lks36/ProjetEtude.git
cd ProjetEtude

python -m venv venv

#selon votre machine
source venv/bin/activate
venv\bin\activate

#ou
source venv/bin/activate
venv\Script\activate

#on lance le back-end
cd TME2
uvicorn main:app --reload

#puis dans un autre terminal, on lance le front-end
cd TME2/front-end
npx serve -l 5173

#puis on peut lacer le site http://localhost:5173 ou (http://127.0.0.1:5173)
```
---
## Données

***movies.json*** contient les informations sur les films.

Les dossiers ***images/*** et ***Images/*** contiennent les ressources visuelles.

---
## Documentation
***Projet.md*** : description globale du projet.

***TME2.md*** : consignes du TME2.

[RapportTME2.md](./TME2/RapportTME2.md) : rapport détaillé du travail réalisé TME2

***TME3.md*** : consignes du TME3.md
