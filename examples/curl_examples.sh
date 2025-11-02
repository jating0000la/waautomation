#!/bin/bash

# WhatsApp API cURL Examples
# Replace YOUR_API_KEY with your actual API key

API_KEY="YOUR_API_KEY_HERE"
BASE_URL="http://localhost:3000/api/external"

echo "========================================="
echo "WhatsApp API - cURL Examples"
echo "========================================="

# 1. Check Status
echo -e "\n1. Checking WhatsApp Status..."
curl -X GET "$BASE_URL/status" \
  -H "X-API-Key: $API_KEY" \
  | json_pp

# 2. Send Text Message
echo -e "\n2. Sending Text Message..."
curl -X POST "$BASE_URL/send-message" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "1234567890",
    "message": "Hello from cURL! 📱"
  }' \
  | json_pp

# 3. Send Media File
echo -e "\n3. Sending Media File..."
# Uncomment and update the file path
# curl -X POST "$BASE_URL/send-media" \
#   -H "X-API-Key: $API_KEY" \
#   -F "to=1234567890" \
#   -F "file=@/path/to/image.jpg" \
#   -F "caption=Check this out!" \
#   | json_pp

# 4. Send File from URL
echo -e "\n4. Sending File from URL..."
curl -X POST "$BASE_URL/send-file-url" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "1234567890",
    "url": "https://example.com/document.pdf",
    "caption": "Here is the document"
  }' \
  | json_pp

# 5. Send Location
echo -e "\n5. Sending Location..."
curl -X POST "$BASE_URL/send-location" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "1234567890",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "description": "New York City"
  }' \
  | json_pp

# 6. Send Contact
echo -e "\n6. Sending Contact..."
curl -X POST "$BASE_URL/send-contact" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "1234567890",
    "contactId": "9876543210"
  }' \
  | json_pp

# 7. Send Reaction
echo -e "\n7. Sending Reaction..."
# Note: Replace MESSAGE_ID with actual message ID
# curl -X POST "$BASE_URL/send-reaction" \
#   -H "X-API-Key: $API_KEY" \
#   -H "Content-Type: application/json" \
#   -d '{
#     "messageId": "true_1234567890@c.us_ABC123...",
#     "reaction": "👍"
#   }' \
#   | json_pp

# 8. Create Group
echo -e "\n8. Creating Group..."
curl -X POST "$BASE_URL/create-group" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Group",
    "participants": ["1234567890", "9876543210"]
  }' \
  | json_pp

# 9. Get All Groups
echo -e "\n9. Getting All Groups..."
curl -X GET "$BASE_URL/groups" \
  -H "X-API-Key: $API_KEY" \
  | json_pp

# 10. Get Group Details
echo -e "\n10. Getting Group Details..."
# Note: Replace GROUP_ID with actual group ID
# curl -X GET "$BASE_URL/groups/123456789@g.us" \
#   -H "X-API-Key: $API_KEY" \
#   | json_pp

# 11. Add Participant to Group
echo -e "\n11. Adding Participant to Group..."
# Note: Replace GROUP_ID with actual group ID
# curl -X POST "$BASE_URL/groups/123456789@g.us/participants" \
#   -H "X-API-Key: $API_KEY" \
#   -H "Content-Type: application/json" \
#   -d '{
#     "participant": "1234567890"
#   }' \
#   | json_pp

# 12. Remove Participant from Group
echo -e "\n12. Removing Participant from Group..."
# Note: Replace GROUP_ID and PARTICIPANT_ID with actual values
# curl -X DELETE "$BASE_URL/groups/123456789@g.us/participants/1234567890@c.us" \
#   -H "X-API-Key: $API_KEY" \
#   | json_pp

# 13. Get All Contacts
echo -e "\n13. Getting All Contacts..."
curl -X GET "$BASE_URL/contacts" \
  -H "X-API-Key: $API_KEY" \
  | json_pp

# 14. Get All Chats
echo -e "\n14. Getting All Chats..."
curl -X GET "$BASE_URL/chats" \
  -H "X-API-Key: $API_KEY" \
  | json_pp

echo -e "\n========================================="
echo "Examples completed!"
echo "========================================="
