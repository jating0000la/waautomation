# 🚀 External API - Quick Start Guide

Get your external application integrated with the WhatsApp system in 5 minutes!

---

## Step 1: Start the Server (if not running)

```bash
npm start
```

Server should be running on: `http://localhost:3000`

---

## Step 2: Connect WhatsApp

1. Open: `http://localhost:3000/account.html`
2. Scan the QR code with WhatsApp on your phone
3. Wait for "✅ Client is ready and authenticated!" message

---

## Step 3: Create an API Key

### Option A: Using Web Interface (Recommended)

1. Open: `http://localhost:3000/api-keys.html`
2. Click **"Create New API Key"**
3. Fill in:
   - Name: `My Test App`
   - Permissions: Keep defaults (all checked)
   - Rate Limit: `100`
4. Click **"Create API Key"**
5. **COPY AND SAVE THE KEY** - you won't see it again!

### Option B: Using Command Line

```bash
# This requires admin authentication to be set up
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Test App",
    "description": "Testing the API",
    "rateLimit": 100
  }'
```

---

## Step 4: Test Your API Key

```bash
# Replace YOUR_API_KEY with the key you just created
export API_KEY="wa_your_actual_key_here"

# Test 1: Check health
curl http://localhost:3000/api/external/health

# Test 2: Check WhatsApp status
curl http://localhost:3000/api/external/status \
  -H "X-API-Key: $API_KEY"

# Expected: {"success":true,"connected":true,"ready":true}
```

---

## Step 5: Send Your First Message

```bash
# Replace with your actual phone number (without +)
export PHONE="1234567890"

curl -X POST http://localhost:3000/api/external/send-message \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"to\": \"$PHONE\",
    \"message\": \"🎉 Hello from the WhatsApp API! This is my first message.\"
  }"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "messageId": "true_1234567890@c.us_...",
  "to": "1234567890@c.us",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

## Step 6: Try More Features

### Send an Image

```bash
# Send image from URL
curl -X POST http://localhost:3000/api/external/send-file-url \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"to\": \"$PHONE\",
    \"url\": \"https://via.placeholder.com/500\",
    \"caption\": \"Here's an image! 📸\"
  }"
```

### Send a Location

```bash
# Send location (New York City coordinates)
curl -X POST http://localhost:3000/api/external/send-location \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"to\": \"$PHONE\",
    \"latitude\": 40.7128,
    \"longitude\": -74.0060,
    \"description\": \"New York City 🗽\"
  }"
```

### Create a Group

```bash
# Create a WhatsApp group with participants
curl -X POST http://localhost:3000/api/external/create-group \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test Group",
    "participants": ["1234567890", "9876543210"]
  }'
```

### List All Groups

```bash
curl -X GET http://localhost:3000/api/external/groups \
  -H "X-API-Key: $API_KEY"
```

---

## Step 7: Integrate with Your Code

### Python

```python
import requests

API_KEY = "wa_your_key_here"
BASE_URL = "http://localhost:3000/api/external"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# Send a message
response = requests.post(
    f"{BASE_URL}/send-message",
    headers=headers,
    json={
        "to": "1234567890",
        "message": "Hello from Python! 🐍"
    }
)

print(response.json())
```

### Node.js

```javascript
const axios = require('axios');

const API_KEY = 'wa_your_key_here';
const BASE_URL = 'http://localhost:3000/api/external';

async function sendMessage() {
    const response = await axios.post(
        `${BASE_URL}/send-message`,
        {
            to: '1234567890',
            message: 'Hello from Node.js! 🚀'
        },
        {
            headers: {
                'X-API-Key': API_KEY,
                'Content-Type': 'application/json'
            }
        }
    );
    
    console.log(response.data);
}

sendMessage();
```

### PHP

```php
<?php
$apiKey = 'wa_your_key_here';
$baseUrl = 'http://localhost:3000/api/external';

$data = [
    'to' => '1234567890',
    'message' => 'Hello from PHP! 🐘'
];

$ch = curl_init("$baseUrl/send-message");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'X-API-Key: ' . $apiKey,
    'Content-Type: application/json'
]);

$response = curl_exec($ch);
curl_close($ch);

print_r(json_decode($response, true));
?>
```

---

## Common Use Cases

### 1. Customer Notifications

```bash
# Order confirmation
curl -X POST http://localhost:3000/api/external/send-message \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "customer_phone",
    "message": "✅ Your order #12345 has been confirmed!\n\nTracking: ABC123\nEstimated delivery: 2-3 days"
  }'
```

### 2. Appointment Reminders

```bash
# Appointment reminder
curl -X POST http://localhost:3000/api/external/send-message \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "patient_phone",
    "message": "📅 Reminder: You have an appointment tomorrow at 10:00 AM with Dr. Smith.\n\nPlease arrive 10 minutes early."
  }'
```

### 3. Marketing Campaigns

```bash
# Promotional message with image
curl -X POST http://localhost:3000/api/external/send-file-url \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "customer_phone",
    "url": "https://example.com/promo-image.jpg",
    "caption": "🎉 Special Offer! Get 50% off this weekend only! Use code: WEEKEND50"
  }'
```

---

## Troubleshooting

### Problem: 401 Unauthorized

**Solution:**
- Check that your API key is correct
- Verify it's active at http://localhost:3000/api-keys.html
- Make sure you're using the `X-API-Key` header

### Problem: 503 Service Unavailable

**Solution:**
- WhatsApp is not connected
- Go to http://localhost:3000/account.html
- Scan the QR code with WhatsApp

### Problem: 400 Bad Request

**Solution:**
- Check your request parameters
- Ensure phone numbers are in correct format
- Verify JSON syntax is correct

### Problem: 429 Rate Limit Exceeded

**Solution:**
- Wait 60 seconds before retrying
- Implement exponential backoff in your code
- Consider increasing rate limit in API key settings

---

## What's Next?

### 📖 Learn More
- **Full API Documentation**: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- **Integration Guide**: [EXTERNAL_API_README.md](./EXTERNAL_API_README.md)
- **Complete Summary**: [EXTERNAL_API_SUMMARY.md](./EXTERNAL_API_SUMMARY.md)

### 💻 Try Examples
- **Python Client**: [examples/python_example.py](./examples/python_example.py)
- **Node.js Client**: [examples/nodejs_example.js](./examples/nodejs_example.js)
- **cURL Examples**: [examples/curl_examples.sh](./examples/curl_examples.sh)

### 🔔 Set Up Webhooks
Learn how to receive real-time notifications when messages arrive:
- Read the Webhooks section in [EXTERNAL_API_README.md](./EXTERNAL_API_README.md#webhooks)

### 📊 Monitor Usage
- Visit http://localhost:3000/api-keys.html
- Check usage statistics
- Manage your API keys

---

## Need Help?

1. **Check the Documentation** - Most questions are answered in the docs
2. **Review Examples** - See how others use the API
3. **Test Connectivity** - Use the health and status endpoints
4. **Check Logs** - Look at server console for errors
5. **Contact Support** - Reach out to your system administrator

---

## Success Checklist

- ✅ Server is running
- ✅ WhatsApp is connected
- ✅ API key created and saved
- ✅ Test message sent successfully
- ✅ Integration code working

**Congratulations! 🎉 You're now ready to integrate WhatsApp into your applications!**

---

*For detailed documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)*
