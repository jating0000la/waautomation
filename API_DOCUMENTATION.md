# WhatsApp External API Documentation

## Overview

The WhatsApp External API allows third-party applications to interact with your WhatsApp system programmatically. This API provides endpoints for sending messages, media, files, locations, contacts, and managing groups.

## Base URL

```
http://localhost:3000/api/external
```

## Authentication

All API requests (except health checks) require authentication using API keys.

### API Key Format

API keys follow this format: `wa_[64-character-hex-string]`

Example: `wa_a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`

### Authentication Methods

Include your API key in one of the following ways:

#### Method 1: X-API-Key Header (Recommended)

```http
X-API-Key: wa_your_api_key_here
```

#### Method 2: Authorization Bearer Token

```http
Authorization: Bearer wa_your_api_key_here
```

### Example Request

```bash
curl -X POST http://localhost:3000/api/external/send-message \
  -H "X-API-Key: wa_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "1234567890",
    "message": "Hello from API!"
  }'
```

## Rate Limiting

- Default rate limit: **100 requests per minute** per API key
- Rate limits can be customized per API key
- When rate limit is exceeded, you'll receive a `429 Too Many Requests` response

## Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data here
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

## Phone Number Format

Phone numbers can be provided in two formats:

1. **With suffix**: `1234567890@c.us` (for individual chats)
2. **Without suffix**: `1234567890` (will be automatically formatted)

For groups, use the format: `groupid@g.us`

---

## API Endpoints

### 1. Health Check

Check if the API is operational.

**Endpoint:** `GET /api/external/health`

**Authentication:** Not required

**Response:**

```json
{
  "success": true,
  "status": "operational",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0"
}
```

---

### 2. Connection Status

Check WhatsApp connection status.

**Endpoint:** `GET /api/external/status`

**Authentication:** Optional

**Response:**

```json
{
  "success": true,
  "connected": true,
  "ready": true,
  "timestamp": "2024-01-01T12:00:00.000Z",
  "message": "WhatsApp is connected"
}
```

---

## Messaging Endpoints

### 3. Send Text Message

Send a text message to a contact or group.

**Endpoint:** `POST /api/external/send-message`

**Required Permission:** `sendMessage`

**Request Body:**

```json
{
  "to": "1234567890",
  "message": "Hello from the API!",
  "mentions": ["9876543210"] // Optional: array of numbers to mention
}
```

**Response:**

```json
{
  "success": true,
  "message": "Message sent successfully",
  "messageId": "true_1234567890@c.us_ABC123...",
  "to": "1234567890@c.us",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/external/send-message \
  -H "X-API-Key: wa_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "1234567890",
    "message": "Hello!"
  }'
```

---

### 4. Send Media/File

Send media files (images, videos, documents, audio).

**Endpoint:** `POST /api/external/send-media`

**Required Permission:** `sendMedia`

**Content-Type:** `multipart/form-data`

**Form Fields:**

- `to` (string, required): Recipient phone number
- `file` (file, required): Media file to send
- `caption` (string, optional): Caption for the media

**Response:**

```json
{
  "success": true,
  "message": "Media sent successfully",
  "messageId": "true_1234567890@c.us_DEF456...",
  "to": "1234567890@c.us",
  "filename": "image.jpg",
  "mimetype": "image/jpeg",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/external/send-media \
  -H "X-API-Key: wa_your_key" \
  -F "to=1234567890" \
  -F "file=@/path/to/image.jpg" \
  -F "caption=Check this out!"
```

---

### 5. Send File from URL

Send a file from a URL without uploading.

**Endpoint:** `POST /api/external/send-file-url`

**Required Permission:** `sendMedia`

**Request Body:**

```json
{
  "to": "1234567890",
  "url": "https://example.com/file.pdf",
  "caption": "Here's the document",
  "filename": "document.pdf" // Optional: custom filename
}
```

**Response:**

```json
{
  "success": true,
  "message": "File sent successfully",
  "messageId": "true_1234567890@c.us_GHI789...",
  "to": "1234567890@c.us",
  "filename": "document.pdf",
  "mimetype": "application/pdf",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

### 6. Send Location

Send a location pin.

**Endpoint:** `POST /api/external/send-location`

**Required Permission:** `sendLocation`

**Request Body:**

```json
{
  "to": "1234567890",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "description": "New York City" // Optional
}
```

**Response:**

```json
{
  "success": true,
  "message": "Location sent successfully",
  "messageId": "true_1234567890@c.us_JKL012...",
  "to": "1234567890@c.us",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "description": "New York City"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

### 7. Send Contact

Send a contact as a vCard.

**Endpoint:** `POST /api/external/send-contact`

**Required Permission:** `sendContact`

**Request Body:**

```json
{
  "to": "1234567890",
  "contactId": "9876543210"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Contact sent successfully",
  "messageId": "true_1234567890@c.us_MNO345...",
  "to": "1234567890@c.us",
  "contactSent": "9876543210@c.us",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

### 8. Send Reaction

React to a message with an emoji.

**Endpoint:** `POST /api/external/send-reaction`

**Required Permission:** `sendReaction`

**Request Body:**

```json
{
  "messageId": "true_1234567890@c.us_ABC123...",
  "reaction": "👍"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Reaction sent successfully",
  "messageId": "true_1234567890@c.us_ABC123...",
  "reaction": "👍",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

## Group Management Endpoints

### 9. Create Group

Create a new WhatsApp group.

**Endpoint:** `POST /api/external/create-group`

**Required Permission:** `createGroup`

**Request Body:**

```json
{
  "name": "My New Group",
  "participants": ["1234567890", "9876543210"]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Group created successfully",
  "groupId": "123456789@g.us",
  "name": "My New Group",
  "participants": 2
}
```

---

### 10. Get All Groups

List all groups.

**Endpoint:** `GET /api/external/groups`

**Required Permission:** `manageGroups`

**Response:**

```json
{
  "success": true,
  "groups": [
    {
      "id": "123456789@g.us",
      "name": "Family Group",
      "participantCount": 5,
      "timestamp": 1234567890,
      "unreadCount": 0
    }
  ],
  "total": 1
}
```

---

### 11. Get Group Details

Get detailed information about a specific group.

**Endpoint:** `GET /api/external/groups/:groupId`

**Required Permission:** `manageGroups`

**Response:**

```json
{
  "success": true,
  "group": {
    "id": "123456789@g.us",
    "name": "Family Group",
    "description": "Our family chat",
    "owner": "1234567890@c.us",
    "createdAt": 1234567890,
    "participantCount": 5,
    "participants": [
      {
        "id": "1234567890@c.us",
        "number": "1234567890",
        "isAdmin": true,
        "isSuperAdmin": true
      }
    ]
  }
}
```

---

### 12. Add Participant to Group

Add a member to an existing group.

**Endpoint:** `POST /api/external/groups/:groupId/participants`

**Required Permission:** `manageGroups`

**Request Body:**

```json
{
  "participant": "1234567890"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Participant added successfully",
  "groupId": "123456789@g.us",
  "participantAdded": "1234567890@c.us"
}
```

---

### 13. Remove Participant from Group

Remove a member from a group.

**Endpoint:** `DELETE /api/external/groups/:groupId/participants/:participantId`

**Required Permission:** `manageGroups`

**Response:**

```json
{
  "success": true,
  "message": "Participant removed successfully",
  "groupId": "123456789@g.us",
  "participantRemoved": "1234567890@c.us"
}
```

---

## Contact & Chat Endpoints

### 14. Get All Contacts

Retrieve all contacts.

**Endpoint:** `GET /api/external/contacts`

**Required Permission:** `readMessages`

**Response:**

```json
{
  "success": true,
  "contacts": [
    {
      "id": "1234567890@c.us",
      "name": "John Doe",
      "number": "1234567890",
      "pushname": "John",
      "isMyContact": true
    }
  ],
  "total": 1
}
```

---

### 15. Get All Chats

Retrieve all chats.

**Endpoint:** `GET /api/external/chats`

**Required Permission:** `readMessages`

**Response:**

```json
{
  "success": true,
  "chats": [
    {
      "id": "1234567890@c.us",
      "name": "John Doe",
      "isGroup": false,
      "unreadCount": 2,
      "timestamp": 1234567890,
      "archived": false,
      "pinned": false
    }
  ],
  "total": 1
}
```

---

## Error Codes

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 400 | Bad Request | Missing or invalid parameters |
| 401 | Unauthorized | Invalid or missing API key |
| 403 | Forbidden | API key lacks required permission or IP not whitelisted |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error occurred |
| 503 | Service Unavailable | WhatsApp client not connected |

---

## Permissions

API keys can have the following permissions:

- `sendMessage`: Send text messages
- `sendMedia`: Send media files and documents
- `sendLocation`: Send location pins
- `sendContact`: Send contact vCards
- `sendReaction`: React to messages
- `createGroup`: Create new groups
- `manageGroups`: Manage groups (add/remove participants, get group info)
- `readMessages`: Read contacts and chats
- `webhook`: Receive webhook notifications

---

## Best Practices

1. **Store API keys securely**: Never commit API keys to version control
2. **Use HTTPS in production**: Always use HTTPS to encrypt API requests
3. **Handle rate limits**: Implement exponential backoff when rate limited
4. **Validate phone numbers**: Ensure phone numbers are in correct format
5. **Check connection status**: Verify WhatsApp is connected before sending messages
6. **Handle errors gracefully**: Implement proper error handling in your application
7. **Use webhooks**: Set up webhooks to receive incoming messages in real-time
8. **Monitor usage**: Keep track of API key usage and set appropriate rate limits

---

## Support

For support and questions, please refer to the main documentation or contact your system administrator.
