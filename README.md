# URL Shortener - Microservices Platform

A production-ready URL shortening service built with microservices architecture, demonstrating modern DevOps practices for CMPE 363.

## Architecture

```
                                    [Ingress - urlshortener.local]
                                              |
                    +------------+------------+------------+
                    |            |            |            |
              [Frontend]   [URL Service]  [User Service]  [Analytics]
                React       Python/FastAPI   Node.js       Node.js
                  |              |             |              |
                  |         [PostgreSQL]  [PostgreSQL]   [MongoDB]
                  |              |             |              |
                  +----------[Redis Cache]----+              |
                                                             |
                              [Prometheus] ---- [Grafana]    |
                                   |                         |
                                   +-----------+-------------+
```

## Quick Start

### Local Development (Docker Compose)
```bash
docker-compose up -d
# Access: http://localhost
```

### Kubernetes (Minikube)
```bash
# Start minikube and deploy
./k8s/scripts/deploy-minikube.sh

# Add hosts entry
echo "$(minikube ip) urlshortener.local" | sudo tee -a /etc/hosts

# Access: http://urlshortener.local
```

### Run Tests
```bash
./scripts/run-tests.sh all
```

## Services

| Service | Port | Tech Stack |
|---------|------|------------|
| URL Service | 8000 | Python, FastAPI, PostgreSQL |
| Analytics Service | 3001 | Node.js, Express, MongoDB |
| User Service | 3002 | Node.js, Express, PostgreSQL |
| Frontend | 80 | React, Vite, TailwindCSS |

## CI/CD Pipeline

Push to `master` triggers:
1. **CI** - Lint, test, build Docker images, push to ghcr.io
2. **CD** - Deploy to Kubernetes with automatic rollback on failure

## Monitoring

- **Prometheus**: Metrics collection (port 9090)
- **Grafana**: Dashboards (port 3000, admin/admin123)
