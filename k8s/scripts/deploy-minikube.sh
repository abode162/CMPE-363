#!/bin/bash
set -e

echo "=== URL Shortener Kubernetes Deployment (Minikube) ==="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
K8S_DIR="$PROJECT_ROOT/k8s"

echo -e "${YELLOW}Project root: $PROJECT_ROOT${NC}"

# Check if minikube is installed
if ! command -v minikube &> /dev/null; then
    echo -e "${RED}Error: minikube is not installed${NC}"
    echo "Please install minikube: https://minikube.sigs.k8s.io/docs/start/"
    exit 1
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    echo "Please install kubectl: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi

# Check minikube status, start if not running
echo -e "${YELLOW}Checking minikube status...${NC}"
if ! minikube status &> /dev/null; then
    echo -e "${YELLOW}Starting minikube...${NC}"
    minikube start --cpus=4 --memory=8192 --driver=docker
fi

# Enable required addons
echo -e "${YELLOW}Enabling minikube addons...${NC}"
minikube addons enable ingress
minikube addons enable metrics-server

# Point docker to minikube's docker daemon
echo -e "${YELLOW}Configuring Docker to use minikube's daemon...${NC}"
eval $(minikube docker-env)

# Build Docker images locally
echo -e "${YELLOW}Building Docker images...${NC}"
echo "Building url-service..."
docker build -t url-service:latest "$PROJECT_ROOT/services/url-service"

echo "Building analytics-service..."
docker build -t analytics-service:latest "$PROJECT_ROOT/services/analytics-service"

echo "Building user-service..."
docker build -t user-service:latest "$PROJECT_ROOT/services/user-service"

echo "Building frontend..."
docker build -t frontend:latest "$PROJECT_ROOT/frontend"

echo -e "${GREEN}Docker images built successfully${NC}"

# Apply Kubernetes manifests in order
echo -e "${YELLOW}Applying Kubernetes manifests...${NC}"

# 1. Namespace
echo "Creating namespace..."
kubectl apply -f "$K8S_DIR/namespace.yaml"

# 2. Secrets
echo "Creating secrets..."
kubectl apply -f "$K8S_DIR/secrets/"

# 3. ConfigMaps
echo "Creating configmaps..."
kubectl apply -f "$K8S_DIR/configmaps/"

# 4. Database PVCs
echo "Creating persistent volume claims..."
kubectl apply -f "$K8S_DIR/databases/postgres/pvc.yaml"
kubectl apply -f "$K8S_DIR/databases/mongodb/pvc.yaml"
kubectl apply -f "$K8S_DIR/databases/redis/pvc.yaml"

# 5. Database deployments and services
echo "Deploying databases..."
kubectl apply -f "$K8S_DIR/databases/postgres/"
kubectl apply -f "$K8S_DIR/databases/mongodb/"
kubectl apply -f "$K8S_DIR/databases/redis/"

# Wait for databases to be ready
echo -e "${YELLOW}Waiting for databases to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=postgres -n urlshortener --timeout=120s
kubectl wait --for=condition=ready pod -l app=mongodb -n urlshortener --timeout=120s
kubectl wait --for=condition=ready pod -l app=redis -n urlshortener --timeout=120s
echo -e "${GREEN}Databases are ready${NC}"

# 6. Application services
echo "Deploying application services..."
kubectl apply -f "$K8S_DIR/services/analytics-service/"
kubectl apply -f "$K8S_DIR/services/url-service/"
kubectl apply -f "$K8S_DIR/services/user-service/"
kubectl apply -f "$K8S_DIR/services/frontend/"

# Wait for application pods
echo -e "${YELLOW}Waiting for application pods to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=analytics-service -n urlshortener --timeout=120s
kubectl wait --for=condition=ready pod -l app=url-service -n urlshortener --timeout=120s
kubectl wait --for=condition=ready pod -l app=user-service -n urlshortener --timeout=120s
kubectl wait --for=condition=ready pod -l app=frontend -n urlshortener --timeout=120s
echo -e "${GREEN}Application pods are ready${NC}"

# 7. Ingress
echo "Creating ingress..."
kubectl apply -f "$K8S_DIR/ingress/"

# Get minikube IP
MINIKUBE_IP=$(minikube ip)

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo -e "${YELLOW}Add the following line to /etc/hosts:${NC}"
echo "$MINIKUBE_IP urlshortener.local"
echo ""
echo -e "${YELLOW}Access the application at:${NC}"
echo "http://urlshortener.local"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  kubectl get pods -n urlshortener           # List all pods"
echo "  kubectl get services -n urlshortener       # List all services"
echo "  kubectl logs -f <pod-name> -n urlshortener # View pod logs"
echo "  minikube dashboard                         # Open Kubernetes dashboard"
echo ""
