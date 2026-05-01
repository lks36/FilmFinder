#!/bin/bash

echo "🚀 Démarrage de l'infrastructure Netplixe..."
echo "====================================================="

# --- 0. VÉRIFICATION DES PRÉREQUIS ---
echo "🔍 Vérification de l'environnement..."
for cmd in minikube docker kubectl; do
    if ! command -v $cmd &> /dev/null; then
        echo "❌ Erreur : La commande '$cmd' n'est pas installée."
        exit 1
    fi
done

# --- 1. DÉMARRAGE DU CLUSTER ---
echo "💻 Allumage du cluster Minikube..."
minikube start
minikube addons enable ingress

# --- 2. CONFIGURATION DU NOM DE DOMAINE ---
echo "⚙️ Configuration du nom de domaine netflix.local (mot de passe admin requis)..."
if [ "$(uname)" == "Darwin" ]; then
    sudo sed -i '' '/netflix.local/d' /etc/hosts
    echo "127.0.0.1 netflix.local" | sudo tee -a /etc/hosts > /dev/null
else
    sudo sed -i '/netflix.local/d' /etc/hosts
    echo "$(minikube ip) netflix.local" | sudo tee -a /etc/hosts > /dev/null
fi

# --- 3. CONSTRUCTION DES IMAGES ---
echo "📦 Construction des images Docker..."
eval $(minikube docker-env)
docker build -t netflix-backend:latest ./backend
docker build -t netflix-frontend:latest ./frontend

# --- 4. DÉPLOIEMENT KUBERNETES ---
echo "⚓ Déploiement de l'architecture..."
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/

# --- 5. FORCER LE REDÉMARRAGE des pods pour utiliser les nouvelles images ---
echo "🔄 Mise à jour des pods avec les nouvelles images..."
kubectl rollout restart deployment/backend  -n netflix-app
kubectl rollout restart deployment/frontend -n netflix-app

# --- 6. ATTENTE DU DÉMARRAGE ---
echo "⏳ Attente du démarrage des services principaux..."
kubectl rollout status deployment/mongo     -n netflix-app
kubectl rollout status deployment/backend   -n netflix-app
kubectl rollout status deployment/frontend  -n netflix-app

echo "⏳ Attente de Redis et Elasticsearch (optionnel, peut prendre 1-2 min)..."
kubectl rollout status deployment/redis         -n netflix-app --timeout=60s  || echo "⚠️  Redis pod pas encore prêt, l'app fonctionnera sans cache."
kubectl rollout status deployment/elasticsearch -n netflix-app --timeout=120s || echo "⚠️  Elasticsearch pas encore prêt, la recherche avancée utilisera MongoDB."

echo "====================================================="
echo "🎉 DÉPLOIEMENT TERMINÉ !"
echo "                                                     "
echo "⚠️  ATTENTION UTILISATEURS MAC :"
echo "⚠️  Vous devez taper en dessous : minikube tunnel"
echo "                                                     "
echo "👉 Ouvrez ensuite votre navigateur sur : http://netflix.local"
echo "====================================================="
