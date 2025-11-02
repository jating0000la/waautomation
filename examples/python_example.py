"""
WhatsApp API Python Example
A simple client for interacting with the WhatsApp External API
"""

import requests
import json
from typing import Dict, Optional, List

class WhatsAppClient:
    """Python client for WhatsApp External API"""
    
    def __init__(self, base_url: str, api_key: str):
        """
        Initialize WhatsApp API client
        
        Args:
            base_url: Base URL of the API (e.g., 'http://localhost:3000')
            api_key: Your API key
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            'X-API-Key': api_key,
            'Content-Type': 'application/json'
        })
    
    def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict:
        """Make HTTP request to API"""
        url = f"{self.base_url}/api/external{endpoint}"
        
        try:
            response = self.session.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error: {e}")
            if hasattr(e.response, 'text'):
                print(f"Response: {e.response.text}")
            raise
    
    def get_status(self) -> Dict:
        """Check WhatsApp connection status"""
        return self._make_request('GET', '/status')
    
    def send_message(self, to: str, message: str, mentions: Optional[List[str]] = None) -> Dict:
        """
        Send text message
        
        Args:
            to: Recipient phone number
            message: Message text
            mentions: Optional list of phone numbers to mention
        """
        data = {
            'to': to,
            'message': message
        }
        if mentions:
            data['mentions'] = mentions
        
        return self._make_request('POST', '/send-message', json=data)
    
    def send_media(self, to: str, file_path: str, caption: Optional[str] = None) -> Dict:
        """
        Send media file
        
        Args:
            to: Recipient phone number
            file_path: Path to media file
            caption: Optional caption
        """
        # Remove Content-Type header for multipart
        headers = {'X-API-Key': self.api_key}
        
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {'to': to}
            if caption:
                data['caption'] = caption
            
            url = f"{self.base_url}/api/external/send-media"
            response = requests.post(url, headers=headers, files=files, data=data)
            response.raise_for_status()
            return response.json()
    
    def send_file_url(self, to: str, url: str, caption: Optional[str] = None, 
                      filename: Optional[str] = None) -> Dict:
        """
        Send file from URL
        
        Args:
            to: Recipient phone number
            url: File URL
            caption: Optional caption
            filename: Optional custom filename
        """
        data = {
            'to': to,
            'url': url
        }
        if caption:
            data['caption'] = caption
        if filename:
            data['filename'] = filename
        
        return self._make_request('POST', '/send-file-url', json=data)
    
    def send_location(self, to: str, latitude: float, longitude: float, 
                      description: Optional[str] = None) -> Dict:
        """
        Send location
        
        Args:
            to: Recipient phone number
            latitude: Location latitude
            longitude: Location longitude
            description: Optional description
        """
        data = {
            'to': to,
            'latitude': latitude,
            'longitude': longitude
        }
        if description:
            data['description'] = description
        
        return self._make_request('POST', '/send-location', json=data)
    
    def send_contact(self, to: str, contact_id: str) -> Dict:
        """
        Send contact vCard
        
        Args:
            to: Recipient phone number
            contact_id: Contact's phone number
        """
        data = {
            'to': to,
            'contactId': contact_id
        }
        return self._make_request('POST', '/send-contact', json=data)
    
    def send_reaction(self, message_id: str, reaction: str) -> Dict:
        """
        Send reaction to message
        
        Args:
            message_id: Message ID to react to
            reaction: Emoji reaction
        """
        data = {
            'messageId': message_id,
            'reaction': reaction
        }
        return self._make_request('POST', '/send-reaction', json=data)
    
    def create_group(self, name: str, participants: List[str]) -> Dict:
        """
        Create WhatsApp group
        
        Args:
            name: Group name
            participants: List of phone numbers
        """
        data = {
            'name': name,
            'participants': participants
        }
        return self._make_request('POST', '/create-group', json=data)
    
    def get_groups(self) -> Dict:
        """Get all groups"""
        return self._make_request('GET', '/groups')
    
    def get_group(self, group_id: str) -> Dict:
        """
        Get group details
        
        Args:
            group_id: Group ID
        """
        return self._make_request('GET', f'/groups/{group_id}')
    
    def add_participant(self, group_id: str, participant: str) -> Dict:
        """
        Add participant to group
        
        Args:
            group_id: Group ID
            participant: Phone number to add
        """
        data = {'participant': participant}
        return self._make_request('POST', f'/groups/{group_id}/participants', json=data)
    
    def remove_participant(self, group_id: str, participant_id: str) -> Dict:
        """
        Remove participant from group
        
        Args:
            group_id: Group ID
            participant_id: Participant ID to remove
        """
        return self._make_request('DELETE', f'/groups/{group_id}/participants/{participant_id}')
    
    def get_contacts(self) -> Dict:
        """Get all contacts"""
        return self._make_request('GET', '/contacts')
    
    def get_chats(self) -> Dict:
        """Get all chats"""
        return self._make_request('GET', '/chats')


# Example usage
if __name__ == '__main__':
    # Initialize client
    client = WhatsAppClient(
        base_url='http://localhost:3000',
        api_key='YOUR_API_KEY_HERE'
    )
    
    try:
        # Check status
        print("Checking WhatsApp status...")
        status = client.get_status()
        print(f"Status: {status}")
        
        if not status.get('connected'):
            print("⚠️ WhatsApp is not connected!")
            exit(1)
        
        # Send a text message
        print("\nSending text message...")
        result = client.send_message(
            to='1234567890',
            message='Hello from Python! 🐍'
        )
        print(f"Message sent: {result}")
        
        # Send a media file
        print("\nSending media file...")
        # result = client.send_media(
        #     to='1234567890',
        #     file_path='image.jpg',
        #     caption='Check this out!'
        # )
        # print(f"Media sent: {result}")
        
        # Send location
        print("\nSending location...")
        result = client.send_location(
            to='1234567890',
            latitude=40.7128,
            longitude=-74.0060,
            description='New York City'
        )
        print(f"Location sent: {result}")
        
        # Get all groups
        print("\nFetching groups...")
        groups = client.get_groups()
        print(f"Groups: {json.dumps(groups, indent=2)}")
        
        # Create a new group
        print("\nCreating group...")
        # result = client.create_group(
        #     name='Python Test Group',
        #     participants=['1234567890', '9876543210']
        # )
        # print(f"Group created: {result}")
        
        print("\n✅ All operations completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
