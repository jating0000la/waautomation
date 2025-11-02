# WhatsApp External API Integration Guide

## 🚀 Quick Start

The WhatsApp External API allows third-party applications to interact with your WhatsApp system programmatically. This guide will help you get started in minutes.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Authentication](#authentication)
4. [API Endpoints](#api-endpoints)
5. [Code Examples](#code-examples)
6. [Webhooks](#webhooks)
7. [Best Practices](#best-practices)

---

## Overview

### Features

✅ **Send Messages** - Text, media, files, locations, contacts  
✅ **Group Management** - Create and manage WhatsApp groups  
✅ **Real-time Webhooks** - Receive incoming messages instantly  
✅ **Rate Limiting** - Customizable per API key  
✅ **IP Whitelisting** - Enhanced security  
✅ **Detailed Logging** - Track all API usage  

### Architecture

```
External App → API Key Auth → WhatsApp API → WhatsApp Web.js → WhatsApp
                                    ↓
                            Webhook Notifications
                                    ↓
                              External App
```

---

## Getting Started

### Step 1: Create an API Key

1. Navigate to the admin interface
2. Go to **API Key Management**
3. Click **"Create New API Key"**
4. Fill in the details:
   - **Name**: A friendly name (e.g., "Mobile App")
   - **Permissions**: Select what this key can do
   - **Rate Limit**: Requests per minute (default: 100)
   - **IP Whitelist**: Optional IP restrictions
5. **Save the key immediately** - it won't be shown again!

### Step 2: Test Your API Key

```bash
curl -X GET http://localhost:3000/api/external/status \
  -H "X-API-Key: your_api_key_here"
```

Expected response:
```json
{
  "success": true,
  "connected": true,
  "ready": true,
  "message": "WhatsApp is connected"
}
```

### Step 3: Send Your First Message

```bash
curl -X POST http://localhost:3000/api/external/send-message \
  -H "X-API-Key: your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "1234567890",
    "message": "Hello from the API! 🚀"
  }'
```

---

## Authentication

### API Key Format

API keys follow this pattern:
```
wa_[64-character-hexadecimal-string]
```

Example: `wa_a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`

### How to Authenticate

Include your API key in the request header:

**Method 1: X-API-Key Header (Recommended)**
```http
X-API-Key: wa_your_api_key_here
```

**Method 2: Authorization Bearer Token**
```http
Authorization: Bearer wa_your_api_key_here
```

### Permissions

Each API key has specific permissions:

| Permission | Description |
|------------|-------------|
| `sendMessage` | Send text messages |
| `sendMedia` | Send media files and documents |
| `sendLocation` | Send location pins |
| `sendContact` | Send contact vCards |
| `sendReaction` | React to messages |
| `createGroup` | Create new groups |
| `manageGroups` | Manage groups (add/remove participants) |
| `readMessages` | Read contacts and chats |
| `webhook` | Receive webhook notifications |

---

## API Endpoints

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/external/health` | GET | Health check (no auth required) |
| `/api/external/status` | GET | WhatsApp connection status |
| `/api/external/send-message` | POST | Send text message |
| `/api/external/send-media` | POST | Send media file |
| `/api/external/send-file-url` | POST | Send file from URL |
| `/api/external/send-location` | POST | Send location |
| `/api/external/send-contact` | POST | Send contact vCard |
| `/api/external/send-reaction` | POST | React to message |
| `/api/external/create-group` | POST | Create new group |
| `/api/external/groups` | GET | List all groups |
| `/api/external/groups/:id` | GET | Get group details |
| `/api/external/contacts` | GET | List all contacts |
| `/api/external/chats` | GET | List all chats |

For detailed endpoint documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

---

## Code Examples

### Python

```python
from whatsapp_client import WhatsAppClient

client = WhatsAppClient(
    base_url='http://localhost:3000',
    api_key='wa_your_key_here'
)

# Send a message
result = client.send_message(
    to='1234567890',
    message='Hello from Python! 🐍'
)
print(result)
```

See full example: [examples/python_example.py](./examples/python_example.py)

### Node.js

```javascript
const WhatsAppClient = require('./whatsapp_client');

const client = new WhatsAppClient(
    'http://localhost:3000',
    'wa_your_key_here'
);

// Send a message
const result = await client.sendMessage(
    '1234567890',
    'Hello from Node.js! 🚀'
);
console.log(result);
```

See full example: [examples/nodejs_example.js](./examples/nodejs_example.js)

### cURL

```bash
# Send text message
curl -X POST http://localhost:3000/api/external/send-message \
  -H "X-API-Key: wa_your_key" \
  -H "Content-Type: application/json" \
  -d '{"to": "1234567890", "message": "Hello!"}'
```

See full examples: [examples/curl_examples.sh](./examples/curl_examples.sh)

---

## Webhooks

### What are Webhooks?

Webhooks allow your application to receive real-time notifications when events occur (e.g., incoming messages).

### Setting Up Webhooks

1. **Create a webhook endpoint** in your application:
```javascript
// Example Express endpoint
app.post('/webhook/whatsapp', (req, res) => {
    const { event, data, timestamp } = req.body;
    
    if (event === 'message') {
        console.log('New message:', data);
        // Process the message
    }
    
    res.sendStatus(200);
});
```

2. **Register your webhook** with the API:
```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "X-API-Key: wa_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhook/whatsapp",
    "events": ["message", "message_ack", "message_reaction"],
    "secret": "your_webhook_secret"
  }'
```

### Webhook Security

Webhooks include an `X-Webhook-Signature` header for verification:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
    
    return signature === expectedSignature;
}
```

### Webhook Events

| Event | Description |
|-------|-------------|
| `message` | New message received |
| `message_ack` | Message acknowledgment (sent, delivered, read) |
| `message_reaction` | Reaction added to message |

### Webhook Payload Example

```json
{
  "event": "message",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "data": {
    "messageId": "true_1234567890@c.us_ABC123...",
    "from": "1234567890@c.us",
    "to": "me@c.us",
    "body": "Hello!",
    "type": "chat",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "isGroupMsg": false,
    "fromMe": false,
    "hasMedia": false
  }
}
```

---

## Best Practices

### Security

✅ **Never commit API keys** to version control  
✅ **Use environment variables** to store keys  
✅ **Rotate keys regularly** for enhanced security  
✅ **Use IP whitelisting** when possible  
✅ **Verify webhook signatures** to ensure authenticity  
✅ **Use HTTPS** in production environments  

### Rate Limiting

✅ **Respect rate limits** - default is 100 requests/minute  
✅ **Implement exponential backoff** when rate limited  
✅ **Cache responses** when appropriate  
✅ **Batch operations** when possible  

### Error Handling

✅ **Check connection status** before sending messages  
✅ **Implement retry logic** with exponential backoff  
✅ **Log all API errors** for debugging  
✅ **Handle 503 errors** (WhatsApp not connected)  
✅ **Validate phone numbers** before sending  

### Performance

✅ **Use webhooks** instead of polling for messages  
✅ **Send media by URL** instead of uploading when possible  
✅ **Implement request queuing** for high-volume scenarios  
✅ **Monitor API key usage** regularly  

---

## Error Handling

### Common Error Codes

| Code | Error | Solution |
|------|-------|----------|
| 400 | Bad Request | Check request parameters |
| 401 | Unauthorized | Verify API key is valid |
| 403 | Forbidden | Check API key permissions |
| 429 | Rate Limit | Wait and retry with backoff |
| 503 | Service Unavailable | WhatsApp not connected - scan QR |

### Example Error Response

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Rate limit of 100 requests per minute exceeded",
  "retryAfter": 60
}
```

---

## Testing

### Test Your Integration

1. **Unit Tests**: Test individual API calls
2. **Integration Tests**: Test complete workflows
3. **Load Tests**: Test under high volume
4. **Webhook Tests**: Verify webhook delivery

### Example Test

```javascript
const assert = require('assert');
const WhatsAppClient = require('./whatsapp_client');

describe('WhatsApp API', function() {
    const client = new WhatsAppClient(
        'http://localhost:3000',
        process.env.API_KEY
    );
    
    it('should check status', async function() {
        const status = await client.getStatus();
        assert.strictEqual(status.success, true);
    });
    
    it('should send message', async function() {
        const result = await client.sendMessage(
            process.env.TEST_NUMBER,
            'Test message'
        );
        assert.strictEqual(result.success, true);
    });
});
```

---

## Support & Resources

### Documentation

- **Full API Reference**: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- **Code Examples**: [examples/](./examples/)
- **Main README**: [README.md](./README.md)

### Getting Help

If you encounter issues:

1. Check the API documentation
2. Review the example code
3. Check server logs for errors
4. Verify WhatsApp connection status
5. Contact system administrator

---

## Changelog

### Version 1.0.0 (2024-01-01)

- ✅ Initial API release
- ✅ Message sending (text, media, location, contact)
- ✅ Group management
- ✅ Webhook support
- ✅ API key authentication
- ✅ Rate limiting
- ✅ IP whitelisting

---

## License

This API is part of the WhatsApp Automation System. Please refer to the main project license.

---

**Ready to integrate?** Start with the [Quick Start](#-quick-start) guide above! 🚀
