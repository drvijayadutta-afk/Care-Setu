# Care Setu 🏥

**Care Setu** is a WhatsApp-based patient care coordination platform that bridges patients and healthcare coordinators with real-time updates, appointment management, and intelligent patient monitoring.

## 🎯 Features

### For Patients (WhatsApp)
- 💬 Direct communication with care coordinators
- 📋 Daily health check-ins (symptom tracking)
- 📅 Appointment reminders and updates
- 📱 Accessible via familiar WhatsApp interface
- 🌍 Multi-language support

### For Coordinators (Web Dashboard)
- 📊 Unified patient management dashboard
- 💌 Send direct messages to patients via WhatsApp
- 📅 Create and manage appointments
- 📈 Real-time patient status monitoring
- 🔔 Instant notifications for patient updates
- 🟢 Live connection status indicators

## 🏗️ Architecture

### Tech Stack

**Backend:**
- Fastify (HTTP server)
- BullMQ (Job queue)
- Prisma (ORM)
- PostgreSQL (Database)
- Redis (Cache & messaging)
- WebSocket (Real-time updates)
- Aisensy (WhatsApp integration)
- Anthropic Claude & OpenAI (AI features)

**Frontend:**
- Next.js 16 (React framework)
- Tailwind CSS (Styling)
- Zustand (State management)
- React Icons (UI components)

**Infrastructure:**
- Supabase (PostgreSQL database)
- Upstash (Redis)
- Render (Backend hosting)
- Vercel (Frontend hosting)

## 📦 Project Structure

```
care-setu/
├── src/
│   ├── server.ts              # Entry point
│   ├── api/                   # REST API endpoints
│   ├── websocket/             # Real-time WebSocket
│   ├── integrations/          # External API clients
│   ├── jobs/                  # Background job workers
│   ├── modules/               # Feature modules
│   ├── db/                    # Database client
│   └── webhook/               # WhatsApp webhook handler
├── coordinator-app/           # Next.js frontend
│   ├── app/                   # Pages and layouts
│   ├── lib/                   # Utilities and hooks
│   └── public/                # Static assets
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
└── docs/
    ├── DEPLOYMENT.md          # Deployment guide
    └── API.md                 # API documentation
```

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install
cd coordinator-app && npm install && cd ..

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Start backend
npm run dev

# In another terminal, start frontend
cd coordinator-app && npm run dev
```

Access:
- Backend: http://localhost:3000
- Frontend: http://localhost:3001
- Dashboard: http://localhost:3001/dashboard

### Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step deployment instructions to Render and Vercel.

## 📱 API Endpoints

### Patients
- `GET /patients` - List all patients
- `GET /patients/:id` - Get patient details
- `GET /patients/:id/conversations` - Get chat history
- `GET /patients/:id/checkins` - Get health check-ins
- `GET /patients/:id/appointments` - Get appointments

### Coordinator Actions
- `POST /patients/:id/send-message` - Send message via WhatsApp
- `POST /patients/:id/appointments` - Create appointment
- `PATCH /appointments/:id` - Update appointment

### Real-Time
- `WebSocket /ws/:patientId` - Connect for live updates

## 🔐 Security

- ✅ CORS protection
- ✅ Environment variable isolation
- ✅ Database credentials encrypted
- ✅ Webhook verification for WhatsApp
- ✅ Input validation on all endpoints
- ✅ Rate limiting ready

## 📊 Database Schema

### Core Models
- **Patient** - Patient profiles and metadata
- **Appointment** - Medical appointments
- **Checkin** - Health check-in records
- **Conversation** - Message history
- **Doctor** - Doctor profiles
- **Medication** - Medication tracking

See `prisma/schema.prisma` for full schema.

## 🧪 Testing

```bash
# Backend health check
curl http://localhost:3000/health

# Get patients
curl http://localhost:3000/patients

# Test WebSocket
wscat -c ws://localhost:3000/ws/[patient-id]
```

## 📈 Scaling

### Horizontal Scaling
- Render auto-scales based on traffic
- Vercel handles frontend traffic automatically
- Redis handles distributed caching
- PostgreSQL connection pooling included

### Performance Optimization
- WebSocket for real-time (vs polling)
- Job queue for heavy operations
- Prisma for optimized database queries
- Next.js automatic code splitting

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check logs
tail -f /tmp/backend.log

# Verify database connection
echo $DATABASE_URL

# Run migrations
npx prisma migrate deploy
```

### WebSocket connection issues
- Verify `NEXT_PUBLIC_API_URL` in frontend `.env`
- Check CORS is enabled on backend
- Ensure WebSocket port is not blocked

## 📞 Support

For issues or questions:
1. Check [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment help
2. Review API endpoint logs for errors
3. Check browser console for frontend errors
4. Verify environment variables are set correctly

## 📄 License

Proprietary - Care Setu Platform

## 🤝 Contributing

This is a specialized healthcare platform. Contributions should follow:
- Maintain HIPAA compliance standards
- Add tests for new features
- Update documentation
- Follow existing code style

---

**Care Setu** - Connecting Patients with Care 💙
