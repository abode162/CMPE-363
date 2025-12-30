#!/bin/bash
# Deploy monitoring stack to Kubernetes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Deploying Monitoring Stack ==="

# Create monitoring namespace
echo "Creating monitoring namespace..."
kubectl apply -f "$SCRIPT_DIR/namespace.yaml"

# Deploy Prometheus
echo "Deploying Prometheus..."
kubectl apply -f "$SCRIPT_DIR/prometheus/rbac.yaml"
kubectl apply -f "$SCRIPT_DIR/prometheus/pvc.yaml"
kubectl apply -f "$SCRIPT_DIR/prometheus/configmap.yaml"
kubectl apply -f "$SCRIPT_DIR/prometheus/deployment.yaml"
kubectl apply -f "$SCRIPT_DIR/prometheus/service.yaml"

# Deploy Grafana
echo "Deploying Grafana..."
kubectl apply -f "$SCRIPT_DIR/grafana/pvc.yaml"
kubectl apply -f "$SCRIPT_DIR/grafana/configmap-datasources.yaml"
kubectl apply -f "$SCRIPT_DIR/grafana/configmap-dashboards.yaml"
kubectl apply -f "$SCRIPT_DIR/grafana/deployment.yaml"
kubectl apply -f "$SCRIPT_DIR/grafana/service.yaml"

# Deploy Ingress
echo "Deploying Ingress..."
kubectl apply -f "$SCRIPT_DIR/ingress.yaml"

# Wait for deployments
echo "Waiting for Prometheus to be ready..."
kubectl rollout status deployment/prometheus -n monitoring --timeout=120s

echo "Waiting for Grafana to be ready..."
kubectl rollout status deployment/grafana -n monitoring --timeout=120s

echo ""
echo "=== Monitoring Stack Deployed Successfully ==="
echo ""
echo "Access URLs (assuming urlshortener.local is configured):"
echo "  Grafana:    http://urlshortener.local/grafana"
echo "  Prometheus: http://urlshortener.local/prometheus"
echo ""
echo "Grafana Credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "To port-forward locally:"
echo "  kubectl port-forward svc/grafana 3000:3000 -n monitoring"
echo "  kubectl port-forward svc/prometheus 9090:9090 -n monitoring"
