# Oracle AI - Native iOS Build Guide

## Token-Based Automation

Set these environment variables to enable full automation:

```bash
# GitHub (auto-push)
export GITHUB_TOKEN=ghp_your_personal_access_token
export GITHUB_REPO=yourusername/oracle-ai

# Codemagic (auto-build)
export CM_API_TOKEN=your_codemagic_api_token
export CM_APP_ID=your_codemagic_app_id
```

Then run:
```bash
./scripts/release-prep.sh 1.0.0    # Sync + push to GitHub
./scripts/codemagic-trigger.sh     # Trigger iOS build
```

---

## One-Time Setup

### 1. GitHub Repository
- Create repo at github.com
- Generate Personal Access Token: Settings → Developer settings → Tokens
- Permissions: `repo` (full control)

### 2. Codemagic Account
- Sign up at codemagic.io with GitHub
- Add your repository
- Get API token: Settings → Integrations → Codemagic API
- Copy App ID from app settings

### 3. Apple Developer Account
In Codemagic, connect Apple Developer:
- Settings → Integrations → Apple Developer Portal
- Use App Store Connect API key:
  - appstoreconnect.apple.com → Users → Keys
  - Generate API Key, download .p8 file
  - Upload to Codemagic

---

## Manual Build (Mac Required)

```bash
npm install
npx cap sync ios
npx cap open ios
```

In Xcode:
- Select Apple Developer Team
- Choose target device
- Run (⌘R)

---

## Files Reference

| File | Purpose |
|------|---------|
| `codemagic.yaml` | Cloud build config |
| `capacitor.config.ts` | Capacitor settings |
| `ios/App/App.xcworkspace` | Xcode project |
| `scripts/release-prep.sh` | Sync + push |
| `scripts/codemagic-trigger.sh` | Trigger build |
| `deploy-ios.sh` | Full checklist |

---

## App Details

- **Bundle ID**: com.oracleai.app
- **Certificate**: ORACLEAI-2025-QIP-001
- **Platform**: iOS 14.0+
