# WhatsApp Web.js Bulk Messaging API

A comprehensive Node.js API system for WhatsApp automation with advanced bulk messaging capabilities, audience management, campaign scheduling, and compliance features.

## 🚀 Features

### Core WhatsApp API
- **Message Sending**: Text, media, files, locations, contacts, lists, products
- **Message Management**: Forward, react, read receipts, message history
- **Group Management**: Create groups, manage participants, group settings
- **Account Management**: Device info, profile management, logout/restart
- **Real-time Updates**: QR code generation, connection status, webhooks

### Advanced Bulk Messaging System
- **Template Management**: Rich text templates with variable substitution
- **Audience Management**: CSV import, contact segmentation, DND compliance
- **Campaign Composer**: Schedule campaigns, batch processing, throttling
- **Monitoring Dashboard**: Real-time campaign tracking, delivery reports
- **Compliance Center**: DND management, rate limiting, ban prevention
- **System Settings**: Configurable throttling, warm-up modes, global settings

## 📋 Requirements

- Node.js 16+ 
- PostgreSQL 12+
- Chrome/Chromium browser (for whatsapp-web.js)
- WhatsApp account

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd whatsapp-aug
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup PostgreSQL database**
   ```bash
   # Create database
   createdb whatsapp_bulk
   
   # Configure environment variables
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Initialize the database**
   ```bash
   node init-db.js
   ```

5. **Start the server**
   ```bash
   node index.js
   ```

6. **Access the web interface**
   - Open http://localhost:3001
   - Scan QR code with WhatsApp mobile app
   - Start using the API and bulk messaging features

## 🔧 Configuration

### Environment Variables (.env)
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_bulk
DB_USER=your_username
DB_PASS=your_password

# Server Configuration
PORT=3001

# WhatsApp Configuration
SESSION_NAME=whatsapp-session
```

### Database Models
The system automatically creates these tables:
- **Templates**: Message templates with variables
- **Audiences**: Contact lists and segments
- **Campaigns**: Bulk messaging campaigns
- **Sends**: Individual message tracking
- **DND**: Do-Not-Disturb contact registry
- **SystemSettings**: Global configuration
- **Messages**: Message history (from core API)
- **Contacts**: Contact information (from core API)

## 📊 API Endpoints

### Core WhatsApp API
```
POST /send-message          # Send text message
POST /send-media            # Send media files
POST /send-file-by-url      # Send file from URL
POST /send-location         # Send location
POST /send-contact          # Send contact card
POST /send-list            # Send interactive list
POST /send-product         # Send product message
POST /send-reaction        # React to message
POST /forward-messages     # Forward messages
POST /create-group         # Create WhatsApp group
GET /groups                # List groups
GET /account              # Account information
GET /qr                   # Get QR code
GET /status               # Connection status
POST /webhook             # Webhook endpoint
GET /database             # Database management
```

### Bulk Messaging API
```
# Templates
GET /api/bulk/templates           # List templates
POST /api/bulk/templates          # Create template
PUT /api/bulk/templates/:id       # Update template
DELETE /api/bulk/templates/:id    # Delete template

# Audiences
GET /api/bulk/audiences           # List audiences
POST /api/bulk/audiences          # Create audience
POST /api/bulk/audiences/import   # Import CSV contacts
PUT /api/bulk/audiences/:id       # Update audience
DELETE /api/bulk/audiences/:id    # Delete audience

# Campaigns
GET /api/bulk/campaigns           # List campaigns
POST /api/bulk/campaigns          # Create campaign
PUT /api/bulk/campaigns/:id       # Update campaign
POST /api/bulk/campaigns/:id/start # Start campaign
POST /api/bulk/campaigns/:id/stop  # Stop campaign
GET /api/bulk/campaigns/:id/stats  # Campaign statistics

# Monitoring
GET /api/bulk/sends               # Message delivery tracking
GET /api/bulk/dashboard/stats     # Dashboard statistics

# Settings & Compliance
GET /api/bulk/settings            # System settings
PUT /api/bulk/settings            # Update settings
GET /api/bulk/dnd                 # DND list
POST /api/bulk/dnd                # Add to DND
DELETE /api/bulk/dnd/:phone       # Remove from DND
```

## 🖥️ Web Interface

### Core Features
- **Dashboard**: http://localhost:3001 - Main navigation
- **Bulk Dashboard**: Real-time campaign overview and statistics
- **Template Builder**: Visual template creation with variable support
- **Audience Manager**: Contact import, segmentation, and management
- **Campaign Composer**: Create and schedule bulk messaging campaigns
- **Campaign Monitor**: Track delivery, opens, and campaign performance
- **System Settings**: Configure throttling, warm-up, and global settings
- **Compliance Center**: Manage DND lists and compliance rules

### Individual API Testers
- Send Message, Media, Location, Contact forms
- Group management interface
- Database management tools
- Webhook configuration
- Account and device management

## 📈 Usage Examples

### 1. Create a Template
```bash
curl -X POST http://localhost:3001/api/bulk/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome Message",
    "content": "Hello {{name}}, welcome to our service!",
    "variables": ["name"]
  }'
```

### 2. Import Audience from CSV
```bash
curl -X POST http://localhost:3001/api/bulk/audiences/import \
  -F "file=@contacts.csv" \
  -F "name=New Customers"
```

### 3. Create and Start Campaign
```bash
# Create campaign
curl -X POST http://localhost:3001/api/bulk/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome Campaign",
    "templateId": 1,
    "audienceId": 1,
    "scheduledFor": "2024-01-20T10:00:00Z"
  }'

# Start campaign
curl -X POST http://localhost:3001/api/bulk/campaigns/1/start
```

## 🛡️ Compliance & Safety

### Rate Limiting
- Configurable message throttling (default: 10 messages/minute)
- Warm-up mode for new accounts
- Automatic pause on high failure rates
- WhatsApp ban prevention mechanisms

### DND Management
- Automatic DND compliance checking
- Import/export DND lists
- Opt-out link generation
- GDPR compliance features

### Monitoring
- Real-time delivery tracking
- Failed message logging
- Campaign performance analytics
- System health monitoring

## 🔒 Security

- Input validation and sanitization
- SQL injection prevention (Sequelize ORM)
- File upload restrictions
- Rate limiting on API endpoints
- Session management for WhatsApp connection

## 🚨 Troubleshooting

### Common Issues

1. **WhatsApp disconnection**
   - Check QR code expiry
   - Verify internet connection
   - Restart the service: GET /restart

2. **Database connection errors**
   - Verify PostgreSQL is running
   - Check database credentials in .env
   - Ensure database exists

3. **Message sending failures**
   - Verify phone number format (+1234567890)
   - Check WhatsApp Web connection status
   - Review throttling settings

4. **Template creation issues**
   - Verify template syntax
   - Check variable definitions
   - Ensure unique template names

### Debug Mode
Set `NODE_ENV=development` for detailed logging.

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review API endpoint documentation
3. Check browser console for frontend issues
4. Verify database connectivity and table creation

## 🔄 Version History

- **v2.0.0**: Added comprehensive bulk messaging system
- **v1.5.0**: Database integration and message history
- **v1.0.0**: Core WhatsApp API functionality

---

## 📁 Project Structure

```
whatsapp-aug/
├── index.js                 # Main server file
├── init-db.js              # Database initialization
├── package.json             # Dependencies
├── .env.example            # Environment template
├── README.md               # This file
├── uploads/                # File upload directory
├── bulk/                   # Bulk messaging system
│   ├── models/            # Database models
│   ├── services/          # Business logic
│   └── routes/            # API routes
└── public/                # Web interface
    ├── index.html         # Main navigation
    ├── bulk-dashboard.html # Bulk messaging dashboard
    ├── template-builder.html
    ├── audience-manager.html
    ├── campaign-composer.html
    ├── bulk-monitor.html
    ├── bulk-settings.html
    ├── compliance-center.html
    └── [other interface files]
```

## 🎯 Next Steps

### Completed ✅
- [x] Core WhatsApp API functionality
- [x] PostgreSQL database integration
- [x] Complete bulk messaging backend system
- [x] All frontend interfaces
- [x] Database initialization script
- [x] Comprehensive documentation

### To Do 📋
- [ ] Create VS Code task for easy project startup
- [ ] Add email notification integration
- [ ] Implement message analytics dashboard
- [ ] Add A/B testing for campaigns
- [ ] Create mobile-responsive design
- [ ] Add user authentication system

### Getting Help 🤝
- Review the troubleshooting section for common issues
- Check the API documentation for endpoint details
- Verify database setup and table creation
- Test individual components using the web interface

---

**Happy Messaging! 🚀**
#   w a a u t o m a t i o n  
 