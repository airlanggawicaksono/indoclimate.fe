#!/bin/bash

# Test script for Wablas API
# This is temporary - you can delete it after testing

echo "=== Testing Wablas API ==="
echo ""

# Load credentials from .env.local
source .env.local

echo "API Key: ${WABLASS_API_KEY:0:20}... (truncated)"
echo "Secret: $WABLASS_WEBHOOK_SECRET"
echo ""

# Test phone number (replace with your test number)
TEST_PHONE="6287887617782"
TEST_MESSAGE="could you please give me the summary of cliimate change regulation in jakarta"

echo "Sending to: $TEST_PHONE"
echo "Message: $TEST_MESSAGE"
echo ""
echo "=== Sending request ==="

# Send message and show full response
curl -v -X POST "https://jogja.wablas.com/api/send-message" \
  -H "Content-Type: application/json" \
  -H "Authorization: ${WABLASS_API_KEY}.${WABLASS_WEBHOOK_SECRET}" \
  -d "{\"phone\":\"${TEST_PHONE}\",\"message\":\"${TEST_MESSAGE}\"}" \
  2>&1 | tee /tmp/wablas-test-response.txt

echo ""
echo "=== Full response saved to /tmp/wablas-test-response.txt ==="
