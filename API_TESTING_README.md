# 🧪 API Testing Console

## Overview

The API Testing Console is an interactive web-based tool that allows you to test all WhatsApp External API endpoints directly from your browser. No coding required!

## Access

Navigate to: **http://localhost:3000/api-testing.html**

Or from the main dashboard:
- Click "API Testing Console" in the Settings & Tools section

## Features

### 🔑 Secure API Key Storage
- Enter your API key once
- Stored securely in browser's local storage
- Never sent to external servers
- Easy clear/reset functionality

### 📡 11 Interactive Endpoint Tests

#### 1. **Status Check** (GET)
- Test WhatsApp connection
- No authentication required
- Returns connection status

#### 2. **Send Message** (POST)
- Send text messages
- Fields: To (phone), Message
- Permission: `sendMessage`

#### 3. **Send Media** (POST)
- Send images, videos, documents
- Fields: To, Media URL, Caption
- Permission: `sendMedia`

#### 4. **Send Location** (POST)
- Share GPS coordinates
- Fields: To, Latitude, Longitude, Description
- Permission: `sendLocation`

#### 5. **Send Contact** (POST)
- Share contact cards
- Fields: To, First Name, Last Name, Phone Number
- Permission: `sendContact`

#### 6. **Send Reaction** (POST)
- React to messages with emojis
- Fields: Message ID, Emoji
- Permission: `sendReaction`

#### 7. **Get Chats** (GET)
- Retrieve all chats
- Permission: `readMessages`

#### 8. **Get Contacts** (GET)
- Retrieve all contacts
- Permission: `readMessages`

#### 9. **Get Groups** (GET)
- Retrieve all groups
- Permission: `readMessages`

#### 10. **Create Group** (POST)
- Create new WhatsApp groups
- Fields: Group Name, Participants (comma-separated)
- Permission: `createGroup`

#### 11. **Webhook Configuration**
- Information about webhook setup
- Permission: `webhook`

### ✨ Interactive Features

#### Real-time Response Display
- Color-coded responses (green for success, red for errors)
- HTTP status codes shown
- Formatted JSON output
- Scrollable response viewer

#### Copy to Clipboard
- One-click copy of full responses
- Perfect for debugging and documentation

#### Visual Feedback
- Method badges (GET, POST, PUT, DELETE)
- Permission indicators
- Loading states
- Success/error indicators

## How to Use

### Step 1: Get Your API Key
1. Go to **API Key Management** page
2. Create a new API key or use existing one
3. Copy your API key (format: `wa_xxxxx...`)

### Step 2: Enter API Key
1. Open **API Testing Console**
2. Paste your API key in the input field at the top
3. Click **"Save Key"**
4. See the green checkmark confirmation

### Step 3: Test Endpoints
1. Scroll to the endpoint you want to test
2. Fill in the required fields
3. Click the test button
4. View the response below the form

### Step 4: Analyze Results
- **Success** (green): API call worked correctly
- **Error** (red): Something went wrong, check error message
- Copy response for further analysis if needed

## Example: Testing Send Message

1. **Enter API Key** at the top
2. **Scroll to "Send Message"** card
3. **Fill in fields:**
   - To: `919876543210` (your WhatsApp number with country code)
   - Message: `Hello from API Testing Console!`
4. **Click "Send Message"**
5. **Check response:**
   ```json
   {
     "success": true,
     "message": "Message sent successfully",
     "messageId": "true_919876543210@c.us_3EB0..."
   }
   ```

## Phone Number Format

Always use the international format without + or spaces:
- ✅ Correct: `919876543210` (India)
- ✅ Correct: `14155551234` (USA)
- ❌ Wrong: `+91 98765 43210`
- ❌ Wrong: `9876543210` (missing country code)

## Common Issues

### "Please enter and save your API key first!"
- **Solution**: Enter your API key at the top and click "Save Key"

### "Permission denied"
- **Solution**: Your API key doesn't have the required permission
- Go to API Key Management → Edit key → Enable needed permission

### "Rate limit exceeded"
- **Solution**: You've exceeded the requests per minute limit
- Wait a moment before trying again
- Or increase rate limit in API key settings

### "Failed to send message: Chat not found"
- **Solution**: The phone number doesn't exist or hasn't chatted with you
- Verify the number format (country code + number)
- Make sure the contact exists in WhatsApp

### "WhatsApp not connected"
- **Solution**: Scan QR code on Account page first
- Wait for "WhatsApp is ready!" message

## Permissions Guide

Each endpoint requires specific permissions in your API key:

| Permission | Endpoints |
|------------|-----------|
| None | Status check |
| `sendMessage` | Send text messages |
| `sendMedia` | Send media files |
| `sendLocation` | Send locations |
| `sendContact` | Send contacts |
| `sendReaction` | Send reactions |
| `readMessages` | Get chats, contacts, groups |
| `createGroup` | Create groups |
| `manageGroups` | Add/remove participants, update settings |
| `webhook` | Webhook configuration |

## Security Notes

### Local Storage
- API keys are stored in browser's localStorage
- Only accessible from the same domain
- Cleared when you click "Clear" button
- Not sent to any external servers

### API Key Protection
- Never share your API key publicly
- Regenerate key if compromised
- Use IP whitelisting for production
- Set appropriate expiration dates

### Testing in Production
- Test with small batches first
- Use test phone numbers if possible
- Monitor rate limits
- Check API key permissions

## Advanced Usage

### Testing Custom Workflows

1. **Test Message + Media Combo:**
   - Send message first
   - Then send media with caption
   - Verify both arrive correctly

2. **Group Management:**
   - Create test group
   - Note the group ID from response
   - Use group ID for management operations

3. **Webhook Testing:**
   - Configure webhook URL in API key
   - Send test message
   - Verify webhook receives event

### Automation Scripts

Use the console to:
- Validate API endpoints before coding
- Debug authentication issues
- Test permission configurations
- Prototype new features
- Generate sample responses for documentation

## Browser Compatibility

Tested and working on:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Edge 90+
- ✅ Safari 14+
- ✅ Opera 76+

## Tips & Best Practices

### 1. Save Successful Requests
Copy successful responses to document working configurations

### 2. Test Incrementally
Start with status check, then simple endpoints, then complex ones

### 3. Use Real Numbers
Test with actual WhatsApp numbers you can verify

### 4. Monitor Console
Open browser DevTools (F12) to see network requests and detailed errors

### 5. Check Permissions
If you get "Permission denied", update your API key permissions first

### 6. Refresh for Updates
If you regenerate your API key, update it in the testing console

## Related Documentation

- **API_DOCUMENTATION.md** - Complete API reference
- **QUICK_START.md** - Getting started with the API
- **API_TEST_RESULTS.md** - Example test results
- **EXTERNAL_API_README.md** - API architecture
- **examples/** - Code samples in various languages

## Troubleshooting

### Response Not Showing
- Check if API key is saved (look for green checkmark)
- Open browser console (F12) for JavaScript errors
- Refresh the page and try again

### Styling Issues
- Clear browser cache
- Check if `assets/styles/app.css` is loading
- Try a different browser

### Network Errors
- Verify server is running on port 3000
- Check if WhatsApp is connected
- Ensure database is configured

## Support

If you encounter issues:
1. Check the error message in the response
2. Review permission requirements
3. Verify phone number format
4. Check server logs for details
5. Review API documentation

## Future Enhancements

Planned features:
- [ ] Save favorite test configurations
- [ ] Batch testing multiple endpoints
- [ ] Export test results as JSON/CSV
- [ ] Request history log
- [ ] Response time metrics
- [ ] Dark mode toggle
- [ ] Custom endpoint testing
- [ ] WebSocket testing for webhooks

---

**Happy Testing! 🚀**

For more information, visit the [API Keys Management](http://localhost:3000/api-keys.html) page or check the [full documentation](./API_DOCUMENTATION.md).
