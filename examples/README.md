# WhatsApp API - Code Examples

This directory contains example code for integrating with the WhatsApp External API in various programming languages.

## Available Examples

- **Python** - `python_example.py`
- **Node.js** - `nodejs_example.js`
- **PHP** - `php_example.php`
- **cURL** - `curl_examples.sh`

## Quick Start

### 1. Get Your API Key

First, create an API key through the admin interface:

1. Navigate to API Key Management
2. Click "Create New Key"
3. Save the generated key securely (it won't be shown again!)

### 2. Choose Your Language

Select the example for your preferred programming language and follow the instructions.

### 3. Configure

Replace `YOUR_API_KEY_HERE` with your actual API key in the example code.

### 4. Run

Execute the example and start sending messages!

## Common Use Cases

### Send a Simple Text Message

```bash
curl -X POST http://localhost:3000/api/external/send-message \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to": "1234567890", "message": "Hello!"}'
```

### Send an Image

```bash
curl -X POST http://localhost:3000/api/external/send-media \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "to=1234567890" \
  -F "file=@image.jpg" \
  -F "caption=Check this out!"
```

### Create a Group

```bash
curl -X POST http://localhost:3000/api/external/create-group \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Group", "participants": ["1234567890", "9876543210"]}'
```

## Support

For detailed API documentation, see `API_DOCUMENTATION.md`.
