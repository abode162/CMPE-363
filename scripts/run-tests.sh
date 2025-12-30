#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' 

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to run URL service tests
run_url_service_tests() {
    log_info "Running URL Service tests (pytest)..."
    cd "$PROJECT_ROOT/services/url-service"

    # Set test environment variables
    export TEST_DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5433/urlshortener_test"
    export TEST_REDIS_URL="redis://localhost:6380/1"

    # Check if pytest is available
    if ! command -v pytest &> /dev/null; then
        log_warning "pytest not found, trying with python -m pytest"
        python -m pytest tests/ -v --cov=app --cov-report=html --cov-report=term-missing
    else
        pytest tests/ -v --cov=app --cov-report=html --cov-report=term-missing
    fi

    log_success "URL Service tests completed"
}

# Function to run Analytics service tests
run_analytics_service_tests() {
    log_info "Running Analytics Service tests (Jest)..."
    cd "$PROJECT_ROOT/services/analytics-service"

    # Set test environment variables
    export TEST_MONGO_URI="mongodb://localhost:27018/analytics_test"
    export NODE_ENV="test"

    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        pnpm install
    fi

    pnpm test

    log_success "Analytics Service tests completed"
}

# Function to run User service tests
run_user_service_tests() {
    log_info "Running User Service tests (Jest)..."
    cd "$PROJECT_ROOT/services/user-service"

    # Set test environment variables
    export DB_HOST="localhost"
    export DB_PORT="5433"
    export DB_NAME="urlshortener_test"
    export DB_USER="postgres"
    export DB_PASSWORD="postgres"
    export NODE_ENV="test"
    export JWT_SECRET="test-jwt-secret"

    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        pnpm install
    fi

    # Run with --runInBand to avoid PostgreSQL race conditions
    npx jest --coverage --runInBand

    log_success "User Service tests completed"
}

# Function to run load tests
run_load_tests() {
    log_info "Running load tests (k6)..."

    # Check if k6 is installed
    if ! command -v k6 &> /dev/null; then
        log_error "k6 is not installed. Please install it first:"
        echo "  brew install k6  # macOS"
        echo "  sudo apt install k6  # Ubuntu/Debian"
        echo "  choco install k6  # Windows"
        exit 1
    fi

    cd "$PROJECT_ROOT/tests/load"

    # Run smoke tests for each service
    log_info "Running URL Service smoke test..."
    k6 run --env STAGE=smoke url-service.js

    log_info "Running Analytics Service smoke test..."
    k6 run --env STAGE=smoke analytics-service.js

    log_info "Running User Service smoke test..."
    k6 run --env STAGE=smoke user-service.js

    log_success "Load tests completed"
}

# Function to run full system test
run_full_system_test() {
    log_info "Running full system load test (k6)..."

    if ! command -v k6 &> /dev/null; then
        log_error "k6 is not installed"
        exit 1
    fi

    cd "$PROJECT_ROOT/tests/load"
    k6 run --env STAGE=smoke full-system.js

    log_success "Full system test completed"
}

# Function to start test infrastructure (databases only)
start_test_infra() {
    log_info "Starting test infrastructure..."
    cd "$PROJECT_ROOT"
    docker-compose -f docker-compose.test.yml up -d

    log_info "Waiting for services to be healthy..."
    sleep 10

    log_success "Test infrastructure started"
}

# Function to start full services with exposed ports (for load testing)
start_services_infra() {
    log_info "Starting full services infrastructure with exposed ports..."
    cd "$PROJECT_ROOT"
    docker-compose -f docker-compose.yml -f docker-compose.ci.yml up -d

    log_info "Waiting for services to be healthy..."
    sleep 15

    log_success "Services infrastructure started (ports 8000, 3001, 3002 exposed)"
}

# Function to stop test infrastructure
stop_test_infra() {
    log_info "Stopping test infrastructure..."
    cd "$PROJECT_ROOT"
    docker-compose -f docker-compose.test.yml down -v

    log_success "Test infrastructure stopped"
}

# Function to stop full services infrastructure
stop_services_infra() {
    log_info "Stopping services infrastructure..."
    cd "$PROJECT_ROOT"
    docker-compose -f docker-compose.yml -f docker-compose.ci.yml down -v

    log_success "Services infrastructure stopped"
}

# Main script
case "${1:-all}" in
    unit)
        log_info "Running unit tests only..."
        run_url_service_tests
        run_analytics_service_tests
        run_user_service_tests
        ;;
    integration)
        log_info "Running integration tests..."
        start_test_infra
        run_url_service_tests
        run_analytics_service_tests
        run_user_service_tests
        stop_test_infra
        ;;
    load)
        log_info "Running load tests..."
        run_load_tests
        ;;
    full-system)
        log_info "Running full system test..."
        run_full_system_test
        ;;
    infra-up)
        start_test_infra
        ;;
    infra-down)
        stop_test_infra
        ;;
    services-up)
        start_services_infra
        ;;
    services-down)
        stop_services_infra
        ;;
    all)
        log_info "Running all tests..."
        echo ""
        echo "=========================================="
        echo "  Phase 1: Unit Tests"
        echo "=========================================="
        run_url_service_tests
        run_analytics_service_tests
        run_user_service_tests

        echo ""
        echo "=========================================="
        echo "  Phase 2: Load Tests (Smoke)"
        echo "=========================================="
        if command -v k6 &> /dev/null; then
            run_load_tests
        else
            log_warning "Skipping load tests - k6 not installed"
        fi

        echo ""
        log_success "All tests completed!"
        ;;
    *)
        echo "Usage: $0 [unit|integration|load|full-system|infra-up|infra-down|services-up|services-down|all]"
        echo ""
        echo "Commands:"
        echo "  unit         - Run unit tests for all services"
        echo "  integration  - Run integration tests with Docker infrastructure"
        echo "  load         - Run k6 load tests (smoke stage)"
        echo "  full-system  - Run full system load test"
        echo "  infra-up     - Start test databases (Docker)"
        echo "  infra-down   - Stop test databases"
        echo "  services-up  - Start full services with exposed ports (for load testing)"
        echo "  services-down- Stop full services"
        echo "  all          - Run unit tests and load tests"
        exit 1
        ;;
esac
