#!/bin/bash

# Care Setu - Render Deployment Script
# Run this on your machine: bash deploy-render.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Care Setu - Render Backend Deployment${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo ""

# Token (you can also export RENDER_API_TOKEN before running)
RENDER_API_TOKEN="${RENDER_API_TOKEN:-rnd_sKq9K60dSXuq38d9gzac028Yr05m}"

# Collect environment variables
echo -e "${YELLOW}Enter your deployment credentials:${NC}"
echo ""

read -p "1. Redis URL (from Upstash): " REDIS_URL
read -p "2. WhatsApp Phone Number ID: " WHATSAPP_PHONE_NUMBER_ID
read -p "3. WhatsApp Access Token: " WHATSAPP_ACCESS_TOKEN
read -p "4. WhatsApp Verify Token (make up any string): " WHATSAPP_VERIFY_TOKEN
read -p "5. WhatsApp API Version (default v21.0): " WHATSAPP_API_VERSION
WHATSAPP_API_VERSION=${WHATSAPP_API_VERSION:-v21.0}
read -p "6. Anthropic API Key: " ANTHROPIC_API_KEY
read -p "7. OpenAI API Key: " OPENAI_API_KEY
read -p "8. Coordinator WhatsApp Number (e.g., 91XXXXXXXXXX): " COORDINATOR_WHATSAPP_NUMBER

echo ""
echo -e "${GREEN}✓ Credentials collected${NC}"
echo ""

# Get your Render account ID (requires being logged in)
echo -e "${YELLOW}Fetching your Render account info...${NC}"
ACCOUNT_RESPONSE=$(curl -s -X GET https://api.render.com/v1/owners \
  -H "Authorization: Bearer $RENDER_API_TOKEN")

OWNER_ID=$(echo "$ACCOUNT_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$OWNER_ID" ]; then
  echo -e "${RED}✗ Failed to fetch account info${NC}"
  echo "Response: $ACCOUNT_RESPONSE"
  echo ""
  echo -e "${YELLOW}Make sure:${NC}"
  echo "  1. Your token is valid"
  echo "  2. You have internet connection"
  echo "  3. Run: RENDER_API_TOKEN=your_token bash deploy-render.sh"
  exit 1
fi

echo -e "${GREEN}✓ Found your Render account (ID: $OWNER_ID)${NC}"
echo ""

# Create the service
echo -e "${YELLOW}Creating backend service on Render...${NC}"

SERVICE_PAYLOAD=$(cat <<PAYLOAD
{
  "type": "web_service",
  "name": "care-setu-backend",
  "ownerId": "$OWNER_ID",
  "repo": "https://github.com/drvijayadutta-afk/Care-Setu",
  "branch": "main",
  "buildCommand": "npm install && npm run build && npx prisma migrate deploy",
  "startCommand": "npm start",
  "envVars": [
    {"key": "NODE_ENV", "value": "production"},
    {"key": "PORT", "value": "3000"},
    {"key": "REDIS_URL", "value": "$REDIS_URL"},
    {"key": "WHATSAPP_PHONE_NUMBER_ID", "value": "$WHATSAPP_PHONE_NUMBER_ID"},
    {"key": "WHATSAPP_ACCESS_TOKEN", "value": "$WHATSAPP_ACCESS_TOKEN"},
    {"key": "WHATSAPP_VERIFY_TOKEN", "value": "$WHATSAPP_VERIFY_TOKEN"},
    {"key": "WHATSAPP_API_VERSION", "value": "$WHATSAPP_API_VERSION"},
    {"key": "ANTHROPIC_API_KEY", "value": "$ANTHROPIC_API_KEY"},
    {"key": "OPENAI_API_KEY", "value": "$OPENAI_API_KEY"},
    {"key": "COORDINATOR_WHATSAPP_NUMBER", "value": "$COORDINATOR_WHATSAPP_NUMBER"}
  ]
}
PAYLOAD
)

SERVICE_RESPONSE=$(curl -s -X POST https://api.render.com/v1/services \
  -H "Authorization: Bearer $RENDER_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$SERVICE_PAYLOAD")

SERVICE_ID=$(echo "$SERVICE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$SERVICE_ID" ]; then
  echo -e "${RED}✗ Failed to create service${NC}"
  echo "Response: $SERVICE_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ Service created (ID: $SERVICE_ID)${NC}"
echo ""

# Wait a moment for service to be ready
echo -e "${YELLOW}Waiting for service to be ready...${NC}"
sleep 3

# Trigger deployment
echo -e "${YELLOW}Triggering deployment...${NC}"

DEPLOY_RESPONSE=$(curl -s -X POST https://api.render.com/v1/services/$SERVICE_ID/deploys \
  -H "Authorization: Bearer $RENDER_API_TOKEN" \
  -H "Content-Type: application/json")

echo -e "${GREEN}✓ Deployment triggered${NC}"
echo ""

# Get service details for URL
SERVICE_DETAILS=$(curl -s -X GET https://api.render.com/v1/services/$SERVICE_ID \
  -H "Authorization: Bearer $RENDER_API_TOKEN")

SERVICE_URL=$(echo "$SERVICE_DETAILS" | grep -o '"serviceUrl":"[^"]*"' | cut -d'"' -f4)

echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Deployment Started!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo ""
echo "Service ID: $SERVICE_ID"
if [ -n "$SERVICE_URL" ]; then
  echo "Service URL: $SERVICE_URL"
fi
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "1. Watch the deployment:"
echo "   → Go to render.com/dashboard"
echo "   → Find 'care-setu-backend' service"
echo "   → Watch Logs tab (takes 2-3 minutes)"
echo ""
echo "2. Once deployed, note the public URL (e.g., https://...onrender.com)"
echo ""
echo "3. Connect frontend to backend:"
echo "   → Go to vercel.com/dashboard → care-setu"
echo "   → Settings → Environment Variables"
echo "   → Add: NEXT_PUBLIC_API_URL = https://care-setu-backend.onrender.com"
echo "   → Save → Redeploy"
echo ""
echo "4. Configure WhatsApp webhook:"
echo "   → Meta Business Manager → Your WhatsApp App"
echo "   → Webhook URL: https://care-setu-backend.onrender.com/webhook/whatsapp"
echo "   → Verify Token: $WHATSAPP_VERIFY_TOKEN"
echo "   → Subscribe to: messages, message_status"
echo ""
echo -e "${GREEN}Done! Your backend is deploying.${NC}"
echo ""
