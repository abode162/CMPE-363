#!/bin/bash
set -e

echo "=== URL Shortener Kubernetes Cleanup ==="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
K8S_DIR="$PROJECT_ROOT/k8s"

echo -e "${YELLOW}This will delete all URL Shortener resources from Kubernetes${NC}"
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled"
    exit 0
fi

echo -e "${YELLOW}Deleting resources...${NC}"

# Delete in reverse order
echo "Deleting ingress..."
kubectl delete -f "$K8S_DIR/ingress/" --ignore-not-found=true

echo "Deleting application services..."
kubectl delete -f "$K8S_DIR/services/frontend/" --ignore-not-found=true
kubectl delete -f "$K8S_DIR/services/user-service/" --ignore-not-found=true
kubectl delete -f "$K8S_DIR/services/url-service/" --ignore-not-found=true
kubectl delete -f "$K8S_DIR/services/analytics-service/" --ignore-not-found=true

echo "Deleting databases..."
kubectl delete -f "$K8S_DIR/databases/redis/" --ignore-not-found=true
kubectl delete -f "$K8S_DIR/databases/mongodb/" --ignore-not-found=true
kubectl delete -f "$K8S_DIR/databases/postgres/" --ignore-not-found=true

echo "Deleting configmaps..."
kubectl delete -f "$K8S_DIR/configmaps/" --ignore-not-found=true

echo "Deleting secrets..."
kubectl delete -f "$K8S_DIR/secrets/" --ignore-not-found=true

echo "Deleting namespace..."
kubectl delete -f "$K8S_DIR/namespace.yaml" --ignore-not-found=true

echo ""
echo -e "${GREEN}=== Cleanup Complete ===${NC}"
echo ""
echo -e "${YELLOW}Note: PersistentVolumes may still exist. To delete them:${NC}"
echo "  kubectl delete pv --all"
echo ""
