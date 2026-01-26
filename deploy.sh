#!/bin/bash

# ============================================
# Democracy Litigation Plugin - Deployment Script
# ============================================
# Deploys the Democracy Litigation API to K3s cluster
# Usage: ./deploy.sh [--skip-build] [--skip-migration] [--tag TAG]
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVICE_NAME="democracy-litigation-api"
NAMESPACE="nexus"
REGISTRY="localhost:5000"
SERVER="157.173.102.118"
REPO_PATH="/opt/adverant-nexus-democracy-litigation"

# Parse arguments
SKIP_BUILD=false
SKIP_MIGRATION=false
CUSTOM_TAG=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --skip-migration)
      SKIP_MIGRATION=true
      shift
      ;;
    --tag)
      CUSTOM_TAG="$2"
      shift 2
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Generate tag
if [ -z "$CUSTOM_TAG" ]; then
  COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "local")
  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  TAG="${TIMESTAMP}-${COMMIT}"
else
  TAG="$CUSTOM_TAG"
fi

IMAGE="${REGISTRY}/${SERVICE_NAME}:${TAG}"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Democracy Litigation API Deployment${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "Service:   ${GREEN}${SERVICE_NAME}${NC}"
echo -e "Namespace: ${GREEN}${NAMESPACE}${NC}"
echo -e "Image:     ${GREEN}${IMAGE}${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# ============================================
# Step 1: Build Docker Image (if not skipped)
# ============================================

if [ "$SKIP_BUILD" = false ]; then
  echo -e "${YELLOW}[1/6] Building Docker image...${NC}"

  cd services/api

  # Clean previous build artifacts
  rm -rf dist

  # Build image
  docker build \
    --no-cache \
    --pull \
    --build-arg NODE_ENV=production \
    --build-arg BUILD_COMMIT="${COMMIT}" \
    -t "${SERVICE_NAME}:${TAG}" \
    -f Dockerfile .

  echo -e "${GREEN}✓ Docker image built successfully${NC}"

  cd ../..
else
  echo -e "${YELLOW}[1/6] Skipping Docker build${NC}"
fi

# ============================================
# Step 2: Push to Registry
# ============================================

echo -e "${YELLOW}[2/6] Pushing image to registry...${NC}"

docker tag "${SERVICE_NAME}:${TAG}" "${IMAGE}"
docker push "${IMAGE}"

echo -e "${GREEN}✓ Image pushed to ${IMAGE}${NC}"

# ============================================
# Step 3: Run Database Migration (if not skipped)
# ============================================

if [ "$SKIP_MIGRATION" = false ]; then
  echo -e "${YELLOW}[3/6] Running database migration...${NC}"

  # Check if migration file exists in Adverant-Nexus repo
  MIGRATION_FILE="../Adverant-Nexus/services/nexus-plugins/src/database/migrations/051_democracy_litigation_schema.sql"

  if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}✗ Migration file not found: ${MIGRATION_FILE}${NC}"
    exit 1
  fi

  # Run migration via psql
  echo "Running migration on database..."

  # Get database credentials from Kubernetes secret
  DB_PASSWORD=$(kubectl get secret nexus-postgres-secret -n nexus -o jsonpath='{.data.postgres-password}' | base64 --decode)
  DB_HOST="nexus-postgres.nexus.svc.cluster.local"
  DB_NAME="nexus_auth"
  DB_USER="nexus_user"

  # Run migration
  kubectl run -i --rm --restart=Never postgres-client --image=postgres:15-alpine --namespace=${NAMESPACE} -- \
    psql "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}" < "$MIGRATION_FILE"

  echo -e "${GREEN}✓ Database migration completed${NC}"
else
  echo -e "${YELLOW}[3/6] Skipping database migration${NC}"
fi

# ============================================
# Step 4: Create/Update Kubernetes Secrets
# ============================================

echo -e "${YELLOW}[4/6] Checking Kubernetes secrets...${NC}"

# Check if secret exists
if kubectl get secret democracy-litigation-secrets -n ${NAMESPACE} &> /dev/null; then
  echo -e "${GREEN}✓ Secret already exists${NC}"
else
  echo -e "${YELLOW}Creating secret from example...${NC}"
  echo -e "${RED}WARNING: Using example secret values. Update k8s/base/secret.yaml with real values!${NC}"

  # Create secret from example (user should replace with real values)
  kubectl create secret generic democracy-litigation-secrets \
    --from-literal=database-user=nexus_user \
    --from-literal=database-password=change_me_in_production \
    --from-literal=redis-password=change_me_in_production \
    --from-literal=graphrag-api-key=change_me_in_production \
    --from-literal=docai-api-key=change_me_in_production \
    --from-literal=jwt-secret=change_me_in_production \
    --namespace=${NAMESPACE}

  echo -e "${YELLOW}✓ Secret created (PLEASE UPDATE WITH REAL VALUES)${NC}"
fi

# ============================================
# Step 5: Apply Kubernetes Manifests
# ============================================

echo -e "${YELLOW}[5/6] Applying Kubernetes manifests...${NC}"

# Apply kustomization
kubectl apply -k k8s/base/

# Update deployment image
kubectl set image deployment/${SERVICE_NAME} api=${IMAGE} -n ${NAMESPACE}

echo -e "${GREEN}✓ Kubernetes manifests applied${NC}"

# ============================================
# Step 6: Wait for Rollout
# ============================================

echo -e "${YELLOW}[6/6] Waiting for rollout to complete...${NC}"

kubectl rollout status deployment/${SERVICE_NAME} -n ${NAMESPACE} --timeout=300s

echo -e "${GREEN}✓ Rollout completed successfully${NC}"

# ============================================
# Verify Deployment
# ============================================

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Deployment Verification${NC}"
echo -e "${BLUE}============================================${NC}"

# Get pod status
POD_NAME=$(kubectl get pods -n ${NAMESPACE} -l app=${SERVICE_NAME} -o jsonpath='{.items[0].metadata.name}')
POD_STATUS=$(kubectl get pods -n ${NAMESPACE} -l app=${SERVICE_NAME} -o jsonpath='{.items[0].status.phase}')
POD_READY=$(kubectl get pods -n ${NAMESPACE} -l app=${SERVICE_NAME} -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}')

echo -e "Pod:       ${GREEN}${POD_NAME}${NC}"
echo -e "Status:    ${GREEN}${POD_STATUS}${NC}"
echo -e "Ready:     ${GREEN}${POD_READY}${NC}"

# Get service endpoint
SERVICE_IP=$(kubectl get svc ${SERVICE_NAME} -n ${NAMESPACE} -o jsonpath='{.spec.clusterIP}')
SERVICE_PORT=$(kubectl get svc ${SERVICE_NAME} -n ${NAMESPACE} -o jsonpath='{.spec.ports[0].port}')

echo -e "Service:   ${GREEN}${SERVICE_IP}:${SERVICE_PORT}${NC}"

# Test health endpoint
echo ""
echo -e "${YELLOW}Testing health endpoint...${NC}"

kubectl exec -n ${NAMESPACE} ${POD_NAME} -- curl -s http://localhost:8080/health | jq . || true

# ============================================
# Summary
# ============================================

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}✓ DEPLOYMENT COMPLETE${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "Image:     ${IMAGE}"
echo -e "Pod:       ${POD_NAME}"
echo -e "Service:   http://${SERVICE_IP}:${SERVICE_PORT}"
echo ""
echo -e "Useful commands:"
echo -e "  ${BLUE}kubectl logs -f deployment/${SERVICE_NAME} -n ${NAMESPACE}${NC}  # View logs"
echo -e "  ${BLUE}kubectl get pods -n ${NAMESPACE} -l app=${SERVICE_NAME}${NC}     # Check pods"
echo -e "  ${BLUE}kubectl describe pod ${POD_NAME} -n ${NAMESPACE}${NC}            # Pod details"
echo -e "${BLUE}============================================${NC}"
