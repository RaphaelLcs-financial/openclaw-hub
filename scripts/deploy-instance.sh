#!/bin/bash

# OpenClaw Hub - Customer Instance Deployment Script
# Usage: ./deploy-instance.sh <customer-id> <domain> [plan]
# Example: ./deploy-instance.sh customer-001 hub.customer001.com starter

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
CUSTOMER_ID=$1
DOMAIN=$2
PLAN=${3:-starter}

# Validate arguments
if [ -z "$CUSTOMER_ID" ] || [ -z "$DOMAIN" ]; then
    echo -e "${RED}Error: Missing required arguments${NC}"
    echo "Usage: $0 <customer-id> <domain> [plan]"
    echo "Example: $0 customer-001 hub.customer001.com starter"
    exit 1
fi

# Configuration based on plan
case $PLAN in
    starter)
        MAX_USERS=100
        STORAGE="10GB"
        PRICE=29
        ;;
    pro)
        MAX_USERS=1000
        STORAGE="50GB"
        PRICE=49
        ;;
    business)
        MAX_USERS=10000
        STORAGE="200GB"
        PRICE=99
        ;;
    *)
        echo -e "${RED}Error: Invalid plan. Use starter, pro, or business.${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}OpenClaw Hub - Customer Deployment${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Customer ID: $CUSTOMER_ID"
echo "Domain: $DOMAIN"
echo "Plan: $PLAN ($\$${PRICE}/month)"
echo "Max Users: $MAX_USERS"
echo "Storage: $STORAGE"
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${RED}Error: Railway CLI not found.${NC}"
    echo "Please install Railway CLI: npm install -g @railway/cli"
    exit 1
fi

# Check if customer already exists
DEPLOY_DIR="$HOME/openclaw-hub-customers/$CUSTOMER_ID"
if [ -d "$DEPLOY_DIR" ]; then
    echo -e "${YELLOW}Warning: Customer directory already exists: $DEPLOY_DIR${NC}"
    read -p "Do you want to overwrite? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 1
    fi
    rm -rf "$DEPLOY_DIR"
fi

# Create deployment directory
echo -e "${YELLOW}[1/7] Creating deployment directory...${NC}"
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# Clone OpenClaw Hub
echo -e "${YELLOW}[2/7] Cloning OpenClaw Hub...${NC}"
git clone https://github.com/RaphaelLcs-financial/openclaw-hub.git .
git checkout v1.4.0

# Generate API Key
API_KEY="oc-$(openssl rand -hex 32)"
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Create .env file
echo -e "${YELLOW}[3/7] Creating environment configuration...${NC}"
cat > .env << EOF
# OpenClaw Hub Configuration for $CUSTOMER_ID
NODE_ENV=production
PORT=3000

# Authentication
API_KEY=$API_KEY
ENCRYPTION_KEY=$ENCRYPTION_KEY

# Database
DATABASE_URL=file:./data/$CUSTOMER_ID.db

# Plan Limits
MAX_USERS=$MAX_USERS
MAX_STORAGE=$STORAGE

# Optional: Email notifications (configure later)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=noreply@example.com
# SMTP_PASS=your-password
EOF

# Create data directory
mkdir -p data

# Install dependencies
echo -e "${YELLOW}[4/7] Installing dependencies...${NC}"
npm install

# Run database migrations
echo -e "${YELLOW}[5/7] Running database migrations...${NC}"
npx prisma migrate deploy

# Deploy to Railway
echo -e "${YELLOW}[6/7] Deploying to Railway...${NC}"
railway init
railway run npm start

# Configure custom domain
echo -e "${YELLOW}[7/7] Configuring custom domain...${NC}"
railway domain "$DOMAIN"

# Wait for deployment to be ready
echo -e "${YELLOW}Waiting for deployment to be ready...${NC}"
sleep 10

# Test deployment
DEPLOYMENT_URL="https://$DOMAIN"
echo -e "${YELLOW}Testing deployment at $DEPLOYMENT_URL...${NC}"
if curl -f -s "$DEPLOYMENT_URL/health" > /dev/null; then
    echo -e "${GREEN}✓ Deployment successful!${NC}"
else
    echo -e "${YELLOW}⚠ Deployment might not be ready yet. Please check Railway dashboard.${NC}"
fi

# Save customer information
cat > customer-info.json << EOF
{
  "customerId": "$CUSTOMER_ID",
  "domain": "$DOMAIN",
  "plan": "$PLAN",
  "price": $PRICE,
  "maxUsers": $MAX_USERS,
  "storage": "$STORAGE",
  "apiKey": "$API_KEY",
  "encryptionKey": "$ENCRYPTION_KEY",
  "deploymentUrl": "$DEPLOYMENT_URL",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "railwayProject": "$(railway status | grep 'Project' | awk '{print $2}')"
}
EOF

# Print summary
echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}✓ Deployment Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Customer ID: $CUSTOMER_ID"
echo "Deployment URL: $DEPLOYMENT_URL"
echo "API Key: $API_KEY"
echo ""
echo "Customer info saved to: $DEPLOY_DIR/customer-info.json"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Send API Key to customer via secure channel"
echo "2. Configure DNS records for $DOMAIN"
echo "3. Set up monitoring and alerts"
echo "4. Add customer to billing system (Stripe)"
echo ""
echo -e "${GREEN}Deployment directory: $DEPLOY_DIR${NC}"
echo -e "${GREEN}View logs: railway logs${NC}"
echo ""
