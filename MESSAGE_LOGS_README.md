# Message Logs Feature

## Overview
The Message Logs feature provides a comprehensive view of all sent and received WhatsApp messages with advanced filtering, search, and export capabilities.

## Features

### 📊 Dashboard Statistics
- **Total Messages**: Count of all messages in the database
- **Sent Messages**: Messages sent by you (fromMe = true)
- **Received Messages**: Messages received by you (fromMe = false)
- **Group Messages**: Messages from group chats

### 🔍 Advanced Filtering
- **Direction Filter**: View sent or received messages
- **Type Filter**: Filter by message type (text, image, video, audio, document, location, contact, sticker)
- **Chat Type Filter**: Individual or group messages
- **Search**: Full-text search in message body
- **Date Range**: Filter messages by date range (from/to)
- **Sort Order**: Newest first or oldest first

### 📝 Message Details
Each message card displays:
- Direction badge (Sent/Received)
- Message type badge with icon
- Group message indicator
- Forwarded message indicator
- Timestamp
- From/To phone numbers
- Author (for group messages)
- Reply indicator (quoted messages)
- Starred indicator
- Message body/content
- Location data with map link
- Media metadata (file type, size)
- Unique message ID

### 📤 Export Functionality
- Export filtered messages to CSV format
- Includes: timestamp, direction, type, from, to, body, group status, author, forwarded status, starred status
- Limited to 10,000 messages per export

### 🔄 Real-time Updates
- Refresh button to reload messages and statistics
- Auto-pagination with page navigation
- 20 messages per page (configurable)

## API Endpoints

### 1. Get Message Logs
```
GET /api/messages/logs
```

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 20) - Messages per page
- `direction` (string) - Filter: 'sent' or 'received'
- `type` (string) - Message type: 'text', 'image', 'video', 'audio', 'document', 'location', 'vcard', 'sticker'
- `chatType` (string) - Chat type: 'individual' or 'group'
- `search` (string) - Search term for message body
- `dateFrom` (date) - Start date (YYYY-MM-DD)
- `dateTo` (date) - End date (YYYY-MM-DD)
- `sort` (string, default: 'desc') - Sort order: 'asc' or 'desc'

**Response:**
```json
{
  "success": true,
  "messages": [...],
  "total": 100,
  "page": 1,
  "totalPages": 5,
  "limit": 20
}
```

### 2. Get Message Statistics
```
GET /api/messages/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 1000,
    "sent": 600,
    "received": 400,
    "group": 250
  }
}
```

### 3. Export Messages to CSV
```
GET /api/messages/export
```

**Query Parameters:** Same as `/api/messages/logs`

**Response:** CSV file download

## Database Schema

The feature uses the existing `Messages` table with the following key fields:
- `id` - UUID primary key
- `messageId` - WhatsApp message ID
- `from` - Sender phone number
- `to` - Recipient phone number
- `body` - Message text content
- `type` - Message type (ENUM)
- `timestamp` - Message date/time
- `isGroupMsg` - Boolean for group messages
- `author` - Original author in group chats
- `quotedMsgId` - ID of quoted/replied message
- `mediaData` - JSON with media metadata
- `location` - JSON with location data
- `vCards` - JSON with contact card data
- `isForwarded` - Boolean for forwarded messages
- `forwardingScore` - Forwarding count
- `isStatus` - Boolean for status messages
- `isStarred` - Boolean for starred messages
- `fromMe` - Boolean indicating if message was sent by user

## Usage

### Access the Message Logs Page
1. Navigate to `http://localhost:3001/message-logs.html`
2. Or click "Message Logs" in the System & Tools section of the main dashboard

### Filter Messages
1. Select desired filters from the filter panel
2. Click "Apply Filters" button
3. Use "Reset Filters" to clear all filters

### Export Messages
1. Apply desired filters
2. Click "Export CSV" button
3. CSV file will be downloaded automatically

### Search Messages
1. Enter search term in the search box
2. Click "Apply Filters"
3. Search is case-insensitive and searches message body

### Navigate Pages
1. Use pagination controls at the bottom
2. Click page numbers or use previous/next arrows
3. Page loads automatically with smooth scroll to top

## Technical Details

### Frontend Technologies
- HTML5, CSS3, Bootstrap 5.3.2
- Font Awesome 6.5.0 icons
- Vanilla JavaScript (no framework dependencies)

### Backend Technologies
- Node.js with Express
- PostgreSQL database with Sequelize ORM
- whatsapp-web.js for WhatsApp integration

### Performance Optimizations
- Pagination for large datasets (20 messages per page)
- Database indexing on key fields (messageId, from, to, timestamp, isGroupMsg)
- Efficient SQL queries with proper WHERE clauses
- Export limited to 10,000 messages

### Security Features
- Input sanitization for search queries
- SQL injection protection via Sequelize parameterized queries
- XSS protection via HTML escaping
- Rate limiting on API endpoints
- CSRF protection

## Troubleshooting

### No Messages Displayed
- Check if WhatsApp client is connected and authenticated
- Verify database connection
- Check browser console for JavaScript errors
- Ensure messages exist in the database

### Export Not Working
- Check file download permissions in browser
- Verify server has write permissions
- Check for large dataset (>10k messages)

### Slow Loading
- Reduce page size (limit parameter)
- Use more specific filters to reduce dataset
- Check database performance and indexing
- Verify network connection

## Future Enhancements

Potential improvements:
- [ ] Advanced search with regex support
- [ ] Message threading view
- [ ] Bulk message operations
- [ ] Custom export formats (JSON, XML)
- [ ] Real-time message streaming
- [ ] Message analytics and insights
- [ ] Attachment preview and download
- [ ] Message templates from history
- [ ] Favorite/bookmark messages
- [ ] Message labels and tags

## Support

For issues or questions:
1. Check the main README.md
2. Review server logs for errors
3. Verify database connection
4. Check WhatsApp connection status
