# Auto DND - STOP Keyword Feature

## Overview
The system now automatically adds contacts to the DND (Do Not Disturb) list when they send "STOP" as a message.

## How It Works

### 1. **Automatic Detection**
- When any contact sends a message with the text "STOP" (case-insensitive)
- The system automatically checks if it's from an individual chat (not a group)
- Verifies the contact is not already in the DND list

### 2. **Automatic Processing**
- Adds the phone number to the DND database
- Source: `STOP_keyword`
- Reason: "User sent STOP keyword"
- Added By: "system"

### 3. **User Confirmation**
The system automatically sends a confirmation message:
```
✅ You have been unsubscribed from our messages. You will not receive any more messages from us. To re-subscribe, please contact us directly.
```

### 4. **Already Unsubscribed**
If the user is already in DND list:
```
You are already unsubscribed from our messages.
```

## Technical Details

### Message Conditions
- Message body must be exactly "STOP" (not case-sensitive)
- Must be from an individual chat (not group messages)
- Must not be from you (fromMe = false)
- Whitespace is trimmed automatically

### Database Entry
```javascript
{
  phone: "1234567890",
  reason: "User sent STOP keyword",
  source: "STOP_keyword",
  addedBy: "system",
  addedAt: "2025-11-02T..."
}
```

### DND Sources
- `STOP_keyword` - Automatically added when user sends STOP
- `manual` - Manually added via UI
- `admin` - Added by admin
- `auto` - Other automatic systems

## API Endpoint

### Get STOP Keyword Statistics
```
GET /api/dnd/stop-keyword-stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 150,
    "stopKeyword": 45,
    "manual": 80,
    "admin": 25
  },
  "recentStops": [
    {
      "phone": "1234567890",
      "reason": "User sent STOP keyword",
      "addedAt": "2025-11-02T10:30:00.000Z"
    }
  ]
}
```

## Compliance

This feature helps with:
- **GDPR Compliance** - Users can opt-out easily
- **CAN-SPAM Act** - Required unsubscribe mechanism
- **TCPA Compliance** - Honors opt-out requests
- **WhatsApp Business Policy** - Respects user preferences

## Integration with Bulk Messaging

### Automatic Filtering
When sending bulk messages, the system automatically:
1. Checks DND list before sending
2. Skips all numbers in DND (including STOP keyword entries)
3. Logs skipped contacts in campaign reports

### Campaign Safety
- All campaigns automatically filter DND contacts
- STOP keyword entries are treated with highest priority
- Cannot be overridden (except by removing from DND list)

## Monitoring

### Console Logs
```
✅ Added 1234567890 to DND list (STOP keyword received)
ℹ️ 1234567890 already in DND list
```

### View DND List
Navigate to: **Compliance Center** → **DND Management**
- View all DND entries
- Filter by source: "STOP_keyword"
- See when users opted out
- Export DND list

## User Re-subscription

To re-subscribe a user who sent STOP:
1. Go to Compliance Center
2. Find the user in DND list
3. Remove from DND list
4. User can now receive messages again

**Note:** Only remove users who have explicitly requested to be re-subscribed.

## Testing

To test the feature:
1. Use WhatsApp to send "STOP" to your bot number
2. Check console for confirmation log
3. View Compliance Center to see the entry
4. Try sending a bulk message - that number will be skipped

## Variations Accepted

The system accepts these variations (case-insensitive):
- STOP
- stop
- Stop
- StOp

All whitespace is trimmed, so " STOP " also works.

## Security

- Only processes individual chats (no group message opt-outs)
- Cannot opt-out other users
- System-generated entries cannot be easily deleted
- All actions are logged with timestamps

## Best Practices

1. **Always honor STOP requests** - Never remove someone who opted out
2. **Clear messaging** - Make sure your campaigns mention STOP option
3. **Regular monitoring** - Check DND stats regularly
4. **Compliance reporting** - Export DND list for compliance records
5. **User education** - Inform users about the STOP option

## Support Message Template

Include in your bulk messages:
```
Reply STOP to unsubscribe from future messages.
```

Or:
```
Text STOP to opt-out anytime.
```

## Troubleshooting

### User sent STOP but still receiving messages
- Check if number is in DND list
- Verify campaign is using latest compliance checks
- Check console logs for errors

### STOP not working in groups
- This is by design - STOP only works in individual chats
- Group admins should remove users who request opt-out

### Want to use different keyword
- Modify the code in `index.js`
- Search for `msg.body.trim().toUpperCase() === 'STOP'`
- Add additional keywords like 'UNSUBSCRIBE', 'REMOVE', etc.

Example:
```javascript
const stopKeywords = ['STOP', 'UNSUBSCRIBE', 'REMOVE', 'OPTOUT'];
if (stopKeywords.includes(msg.body.trim().toUpperCase())) {
  // Add to DND
}
```
