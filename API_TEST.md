# External API Test Script

This script tests the basic functionality of the External API.

## Prerequisites

1. WhatsApp must be connected (scan QR code if needed)
2. You need a valid API key
3. Node.js must be installed

## Quick Test

```bash
# 1. Set your API key
export API_KEY="wa_your_api_key_here"

# 2. Test health endpoint
curl -X GET http://localhost:3000/api/external/health

# 3. Test status endpoint
curl -X GET http://localhost:3000/api/external/status \
  -H "X-API-Key: $API_KEY"

# 4. Test sending a message (replace phone number)
curl -X POST http://localhost:3000/api/external/send-message \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "YOUR_PHONE_NUMBER",
    "message": "Test message from External API! 🚀"
  }'
```

## Expected Results

### Health Check
```json
{
  "success": true,
  "status": "operational",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0"
}
```

### Status Check
```json
{
  "success": true,
  "connected": true,
  "ready": true,
  "message": "WhatsApp is connected"
}
```

### Send Message
```json
{
  "success": true,
  "message": "Message sent successfully",
  "messageId": "true_1234567890@c.us_...",
  "to": "1234567890@c.us",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Troubleshooting

### Error: 401 Unauthorized
- Check that your API key is correct
- Verify the key is active in the dashboard

### Error: 503 Service Unavailable
- WhatsApp is not connected
- Go to http://localhost:3000/account.html and scan QR code

### Error: 429 Rate Limit Exceeded
- You've exceeded the rate limit
- Wait 60 seconds and try again
- Check your API key's rate limit in the dashboard

## Next Steps

1. Create your own API key at http://localhost:3000/api-keys.html
2. Try the Python or Node.js examples in the `examples/` directory
3. Read the full documentation in `API_DOCUMENTATION.md`
4. Set up webhooks for real-time notifications

## Full Test Suite

For a comprehensive test, use the example files:

**Python:**
```bash
cd examples
python python_example.py
```

**Node.js:**
```bash
cd examples
npm install axios form-data
node nodejs_example.js
```

**cURL:**
```bash
cd examples
bash curl_examples.sh
```
