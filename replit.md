# Oracle AI - Quantum Intelligence Platform

## Overview
Oracle AI is a multi-provider artificial intelligence platform that orchestrates multiple leading AI providers into a unified interface. Built with a futuristic quantum-themed UI, it supports real-time streaming chat, multi-AI analysis, and comprehensive admin controls.

## Current State
- **Status**: Running and operational
- **Server**: Express.js on port 5000
- **Database**: PostgreSQL with Drizzle ORM
- **Frontend**: Progressive Web App (PWA) with canvas-style 3D effects

## AI Providers Integrated
- **Claude (Anthropic)**: claude-sonnet-4-5, claude-haiku-4-5, claude-opus-4-5
- **Gemini (Google)**: gemini-2.5-flash, gemini-2.5-pro, gemini-3-pro-preview
- **Mistral AI**: Via OpenRouter
- **Llama (Meta)**: llama-3.3-70b-instruct, llama-3.1-405b-instruct
- **Qwen**: qwen-2.5-72b-instruct
- **DeepSeek**: deepseek-chat

All AI integrations use Replit AI Integrations - no API keys required (charges billed to Replit credits).

## Project Architecture

```
/
├── server/
│   ├── index.ts          # Express server with all API routes
│   ├── db.ts             # Database connection
│   ├── storage.ts        # Data access layer
│   └── ai-orchestrator.ts # Multi-AI provider orchestration
├── shared/
│   └── schema.ts         # Drizzle database schema
├── public/
│   ├── index.html        # PWA frontend
│   ├── icons/            # App icons
│   └── manifest.json     # PWA manifest
├── ios/                  # Capacitor iOS project
├── codemagic.yaml        # Cloud iOS build configuration
├── capacitor.config.ts   # Capacitor configuration
├── drizzle.config.ts     # Database configuration
└── package.json
```

## Database Schema
- **users**: User accounts with admin permissions
- **conversations**: Chat sessions with AI provider selection
- **messages**: Chat messages with model/provider tracking
- **securityLogs**: Admin security audit trail
- **aiConfigs**: AI provider configurations

## Key Features
1. **Multi-AI Chat**: Switch between AI providers in real-time
2. **Oracle Analysis**: Query multiple AIs simultaneously
3. **Security Console**: Admin security logging and monitoring
4. **User Management**: Admin controls for user permissions
5. **PWA Support**: Installable on iOS/Android devices

## API Endpoints
- `GET /api/health` - Health check
- `GET /api/providers` - List available AI providers
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/conversations` - List conversations
- `POST /api/conversations` - Create conversation
- `POST /api/conversations/:id/messages` - Send message (SSE streaming)
- `POST /api/oracle/analyze` - Multi-AI analysis
- `GET /api/admin/users` - List users (admin)
- `GET /api/admin/security-logs` - View security logs (admin)

## Running the Application
```bash
npm run dev        # Start development server
npm run db:push    # Push schema to database
```

## Native iOS App (Capacitor)

The web app is wrapped as a native iOS app using Capacitor.

### Build Commands
```bash
./build-ios.sh     # Prepare project for cloud build
npx cap sync ios   # Sync web assets to iOS
```

### Cloud Build via Codemagic (Recommended)
1. Push repository to GitHub
2. Go to https://codemagic.io
3. Sign in with GitHub → Add repository
4. Connect Apple Developer account (Settings → Integrations)
5. Click "Start new build"

Codemagic handles:
- Building on real Mac hardware
- Code signing with Apple credentials
- TestFlight upload for iPhone XR testing

### Requirements
- Apple Developer Account ($99/year)
- App ID: `com.oracleai.app`
- Target: iPhone XR (iOS 14.0+)

### Configuration Files
- `codemagic.yaml` - Codemagic CI/CD workflow
- `.github/workflows/ios-build.yml` - GitHub Actions workflow
- `capacitor.config.ts` - Capacitor settings

## Recent Changes
- Multi-AI platform with Claude, Gemini, and OpenRouter integrations
- Admin permissions and security console
- Quantum-themed PWA frontend
- Capacitor iOS project for native builds
- GitHub Actions iOS build workflow for automated TestFlight deployment
- Generated 3D tessellated glass app icon
- One-time access key system for owner-only authentication
- Auto-verification with environment-stored access key

## Access Control
- **Owner Email**: Configured via OWNER_EMAIL environment variable
- **Access Key**: One-time use, hashed in database, auto-verified on startup
- **Endpoints**:
  - `POST /api/access/generate` - Generate new key (owner only)
  - `POST /api/access/validate` - Validate key manually
  - `GET /api/access/auto-verify` - Auto-verify with configured key
  - `GET /api/access/check` - Check verification status
  - `GET /api/access/status` - View all keys
