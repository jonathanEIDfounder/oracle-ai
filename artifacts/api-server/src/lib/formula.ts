/**
 * © 2026 Jonathan Sherman — S1AF · Sentient iOS One-Step App Framework
 * Sovereign ID: 1 · Global AI Systems Governor · OCSO-S1AF-GOV-1
 *
 * SENTIENT FORMULA BUILDER
 * Decomposes any app description into every required app, connector,
 * integration, Apple framework, and backend service — then assembles
 * a complete enriched generation manifest for Sentient to build with.
 *
 * Resolution pipeline:
 *   DESCRIBE → SCORE → RANK → GROUP → ENRICH PROMPT → MANIFEST
 */

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;


// ─── Catalog Types ────────────────────────────────────────────────────────────

export type FormulaCategory =
  | "framework"   // Apple platform frameworks (SwiftData, WidgetKit …)
  | "connector"   // Third-party SDK integrations (Stripe, Clerk …)
  | "service"     // Backend/cloud services (Postgres, Redis …)
  | "ai"          // AI / LLM providers (OpenAI, Kimi …)
  | "app";        // Companion apps or extensions (Watch app, widget …)

export interface CatalogItem {
  id: string;
  name: string;
  category: FormulaCategory;
  description: string;
  importStatement?: string;   // Swift import line
  packageUrl?: string;        // SPM or CocoaPods URL
  docs?: string;              // Documentation URL
  keywords: string[];         // Matched against description
  baseline?: boolean;         // Always included regardless of match
  iosOnly?: boolean;
  minIos?: string;
}

export interface FormulaItem extends CatalogItem {
  confidence: number;         // 0–1 match confidence
  reason: string;             // Why this was selected
}

export interface FormulaResult {
  frameworks: FormulaItem[];
  connectors: FormulaItem[];
  services:   FormulaItem[];
  ai:         FormulaItem[];
  apps:       FormulaItem[];
  complexity:      "simple" | "moderate" | "complex" | "enterprise";
  estimatedFiles:  number;
  estimatedLines:  number;
  enrichedPrompt:  string;
  manifest:        Record<string, unknown>;
}

// ─── Integration Catalog ──────────────────────────────────────────────────────

const CATALOG: CatalogItem[] = [
  // ── Apple Frameworks ──────────────────────────────────────────────────────
  {
    id: "swiftdata",
    name: "SwiftData",
    category: "framework",
    description: "On-device persistence using Swift macros — replaces CoreData.",
    importStatement: "import SwiftData",
    docs: "https://developer.apple.com/documentation/swiftdata",
    keywords: ["data", "persist", "store", "database", "save", "record", "history", "list", "cache", "offline", "local"],
    baseline: true,
  },
  {
    id: "appintents",
    name: "AppIntents + Siri",
    category: "framework",
    description: "Expose app actions to Siri, Shortcuts, and Spotlight.",
    importStatement: "import AppIntents",
    docs: "https://developer.apple.com/documentation/appintents",
    keywords: ["siri", "shortcut", "intent", "voice", "spotlight", "automation"],
    baseline: true,
  },
  {
    id: "widgetkit",
    name: "WidgetKit",
    category: "framework",
    description: "Home screen, Lock Screen, and StandBy widgets.",
    importStatement: "import WidgetKit",
    docs: "https://developer.apple.com/documentation/widgetkit",
    keywords: ["widget", "home screen", "lock screen", "glanceable", "standby", "complication"],
  },
  {
    id: "activitykit",
    name: "ActivityKit + Dynamic Island",
    category: "framework",
    description: "Real-time Live Activities on Lock Screen and Dynamic Island.",
    importStatement: "import ActivityKit",
    docs: "https://developer.apple.com/documentation/activitykit",
    keywords: ["live activity", "dynamic island", "real-time update", "live", "sport", "delivery", "tracking", "countdown", "progress"],
  },
  {
    id: "mapkit",
    name: "MapKit",
    category: "framework",
    description: "Native Apple Maps with routing, annotations, and SwiftUI integration.",
    importStatement: "import MapKit",
    docs: "https://developer.apple.com/documentation/mapkit",
    keywords: ["map", "location", "navigation", "directions", "route", "coordinate", "gps", "places", "address", "nearby", "geofence"],
  },
  {
    id: "corelocation",
    name: "CoreLocation",
    category: "framework",
    description: "GPS, geofencing, and significant location change events.",
    importStatement: "import CoreLocation",
    docs: "https://developer.apple.com/documentation/corelocation",
    keywords: ["location", "gps", "coordinate", "geofence", "region", "position", "latitude", "longitude", "tracking"],
  },
  {
    id: "healthkit",
    name: "HealthKit",
    category: "framework",
    description: "Read and write health and fitness data from Health app.",
    importStatement: "import HealthKit",
    docs: "https://developer.apple.com/documentation/healthkit",
    keywords: ["health", "workout", "fitness", "heart rate", "steps", "calories", "sleep", "exercise", "medical", "body mass", "blood pressure"],
  },
  {
    id: "arkit",
    name: "ARKit + RealityKit",
    category: "framework",
    description: "Augmented reality, spatial computing, and 3D scene rendering.",
    importStatement: "import RealityKit",
    docs: "https://developer.apple.com/documentation/realitykit",
    keywords: ["ar", "augmented reality", "3d", "spatial", "reality", "overlay", "object detection", "plane detection", "anchor"],
  },
  {
    id: "coreml",
    name: "Core ML + CreateML",
    category: "framework",
    description: "On-device machine learning inference and model training.",
    importStatement: "import CoreML",
    docs: "https://developer.apple.com/documentation/coreml",
    keywords: ["machine learning", "ml", "model", "classify", "predict", "detect", "inference", "neural", "vision", "nlp", "object detection"],
  },
  {
    id: "foundationmodels",
    name: "FoundationModels",
    category: "framework",
    description: "On-device Apple Intelligence LLM (iOS 26+ / Xcode 26+).",
    importStatement: "import FoundationModels",
    docs: "https://developer.apple.com/documentation/foundationmodels",
    keywords: ["ai", "on-device ai", "apple intelligence", "language model", "llm", "local ai", "intelligent", "smart", "generate text"],
    minIos: "26.0",
  },
  {
    id: "storekit",
    name: "StoreKit 2",
    category: "framework",
    description: "In-app purchases, subscriptions, and App Store receipts.",
    importStatement: "import StoreKit",
    docs: "https://developer.apple.com/documentation/storekit",
    keywords: ["purchase", "buy", "in-app purchase", "iap", "subscription", "premium", "unlock", "monetize", "upgrade", "paywall"],
  },
  {
    id: "cloudkit",
    name: "CloudKit",
    category: "framework",
    description: "iCloud sync, shared databases, and push subscriptions.",
    importStatement: "import CloudKit",
    docs: "https://developer.apple.com/documentation/cloudkit",
    keywords: ["icloud", "sync", "cloud sync", "share", "collaboration", "backup", "cross-device"],
  },
  {
    id: "usernotifications",
    name: "UserNotifications + APNs",
    category: "framework",
    description: "Local and push notifications, including rich media and actions.",
    importStatement: "import UserNotifications",
    docs: "https://developer.apple.com/documentation/usernotifications",
    keywords: ["notification", "push", "alert", "remind", "badge", "apns", "local notification"],
  },
  {
    id: "avfoundation",
    name: "AVFoundation",
    category: "framework",
    description: "Audio/video capture, playback, processing, and streaming.",
    importStatement: "import AVFoundation",
    docs: "https://developer.apple.com/documentation/avfoundation",
    keywords: ["video", "audio", "camera", "record", "play", "stream", "media", "music", "sound", "microphone", "speaker"],
  },
  {
    id: "photosui",
    name: "PhotosUI",
    category: "framework",
    description: "Photo picker, PHPicker, and access to the photo library.",
    importStatement: "import PhotosUI",
    docs: "https://developer.apple.com/documentation/photosuit",
    keywords: ["photo", "image", "gallery", "camera roll", "picture", "album", "photo library"],
  },
  {
    id: "corebluetooth",
    name: "CoreBluetooth",
    category: "framework",
    description: "BLE peripheral and central manager — IoT and accessories.",
    importStatement: "import CoreBluetooth",
    docs: "https://developer.apple.com/documentation/corebluetooth",
    keywords: ["bluetooth", "ble", "sensor", "peripheral", "device", "wireless", "iot", "accessory", "smart home"],
  },
  {
    id: "corenfc",
    name: "CoreNFC",
    category: "framework",
    description: "Read NFC tags (ISO 7816, NDEF, MiFare) — no background scan.",
    importStatement: "import CoreNFC",
    docs: "https://developer.apple.com/documentation/corenfc",
    keywords: ["nfc", "tag", "scan", "contactless", "tap to pay", "rfid"],
  },
  {
    id: "watchconnectivity",
    name: "WatchConnectivity",
    category: "framework",
    description: "Bidirectional communication between iPhone and Apple Watch.",
    importStatement: "import WatchConnectivity",
    docs: "https://developer.apple.com/documentation/watchconnectivity",
    keywords: ["watch", "apple watch", "watchos", "wearable", "companion"],
  },
  {
    id: "imageplayground",
    name: "ImagePlayground",
    category: "framework",
    description: "Apple Intelligence on-device image generation (iOS 18+).",
    importStatement: "import ImagePlayground",
    docs: "https://developer.apple.com/documentation/imageplayground",
    keywords: ["image generation", "generate image", "ai image", "create image", "apple intelligence"],
  },
  {
    id: "passkit",
    name: "PassKit + Apple Wallet",
    category: "framework",
    description: "Add passes, boarding passes, loyalty cards to Apple Wallet.",
    importStatement: "import PassKit",
    docs: "https://developer.apple.com/documentation/passkit",
    keywords: ["wallet", "pass", "boarding pass", "loyalty", "ticket", "coupon", "apple pay"],
  },
  {
    id: "callkit",
    name: "CallKit",
    category: "framework",
    description: "VoIP calls integrated with native Phone UI.",
    importStatement: "import CallKit",
    docs: "https://developer.apple.com/documentation/callkit",
    keywords: ["call", "voip", "phone call", "video call", "dialer", "ringtone"],
  },
  {
    id: "gamekit",
    name: "GameKit + Game Center",
    category: "framework",
    description: "Leaderboards, achievements, matchmaking, and multiplayer.",
    importStatement: "import GameKit",
    docs: "https://developer.apple.com/documentation/gamekit",
    keywords: ["game", "leaderboard", "achievement", "multiplayer", "score", "ranking", "game center"],
  },
  {
    id: "speechrecognition",
    name: "Speech Framework",
    category: "framework",
    description: "On-device and server-side speech-to-text transcription.",
    importStatement: "import Speech",
    docs: "https://developer.apple.com/documentation/speech",
    keywords: ["speech", "voice input", "transcribe", "speech to text", "dictation", "voice recognition"],
  },

  // ── Third-party Connectors ────────────────────────────────────────────────
  {
    id: "stripe",
    name: "Stripe iOS SDK",
    category: "connector",
    description: "Card payments, Apple Pay, SEPA, and Stripe Checkout.",
    packageUrl: "https://github.com/stripe/stripe-ios",
    docs: "https://stripe.com/docs/mobile/ios",
    keywords: ["stripe", "payment", "checkout", "credit card", "debit card", "apple pay", "pay", "billing", "charge"],
  },
  {
    id: "revenuecat",
    name: "RevenueCat",
    category: "connector",
    description: "Subscription management, paywalls, and cross-platform IAP.",
    packageUrl: "https://github.com/RevenueCat/purchases-ios",
    docs: "https://www.revenuecat.com/docs/sdk-guides/ios-installation",
    keywords: ["subscription", "revenuecat", "paywall", "in-app purchase", "iap", "recurring", "trial"],
  },
  {
    id: "clerk",
    name: "Clerk Auth",
    category: "connector",
    description: "Drop-in authentication: email, OAuth, passkeys, MFA.",
    docs: "https://clerk.com/docs",
    keywords: ["auth", "login", "signup", "authentication", "oauth", "users", "account", "sign in", "register", "password", "passkey", "mfa"],
  },
  {
    id: "firebase",
    name: "Firebase",
    category: "connector",
    description: "Auth, Firestore, Realtime Database, Storage, Analytics, Crashlytics.",
    packageUrl: "https://github.com/firebase/firebase-ios-sdk",
    docs: "https://firebase.google.com/docs/ios/setup",
    keywords: ["firebase", "firestore", "realtime database", "cloud messaging", "analytics", "crashlytics", "remote config"],
  },
  {
    id: "supabase",
    name: "Supabase",
    category: "connector",
    description: "Open-source Firebase alternative: Postgres, Auth, Storage, Realtime.",
    packageUrl: "https://github.com/supabase/supabase-swift",
    docs: "https://supabase.com/docs/reference/swift",
    keywords: ["supabase", "postgres", "realtime", "row level security", "rls"],
  },
  {
    id: "sentry",
    name: "Sentry",
    category: "connector",
    description: "Error tracking, performance monitoring, and session replay.",
    packageUrl: "https://github.com/getsentry/sentry-cocoa",
    docs: "https://docs.sentry.io/platforms/apple/",
    keywords: ["error", "crash", "monitoring", "performance", "sentry", "logging", "debug"],
  },
  {
    id: "onesignal",
    name: "OneSignal",
    category: "connector",
    description: "Managed push notification delivery and targeting.",
    packageUrl: "https://github.com/OneSignal/OneSignal-iOS-SDK",
    docs: "https://documentation.onesignal.com/docs/ios-sdk-setup",
    keywords: ["push notification", "onesignal", "push", "notify", "remind", "engagement"],
  },
  {
    id: "mixpanel",
    name: "Mixpanel",
    category: "connector",
    description: "Event-based product analytics and user tracking.",
    packageUrl: "https://github.com/mixpanel/mixpanel-swift",
    docs: "https://developer.mixpanel.com/docs/swift",
    keywords: ["analytics", "mixpanel", "events", "funnel", "retention", "product analytics", "tracking"],
  },
  {
    id: "amplitude",
    name: "Amplitude",
    category: "connector",
    description: "Product analytics — events, cohorts, A/B testing.",
    packageUrl: "https://github.com/amplitude/Amplitude-Swift",
    docs: "https://www.docs.developers.amplitude.com/data/sdks/ios-swift/",
    keywords: ["amplitude", "analytics", "a/b test", "cohort", "experiment"],
  },
  {
    id: "branch",
    name: "Branch",
    category: "connector",
    description: "Deep linking, deferred deep linking, and attribution.",
    packageUrl: "https://github.com/BranchMetrics/ios-branch-deep-linking-attribution",
    docs: "https://help.branch.io/developers-hub/docs/ios-basic-integration",
    keywords: ["deep link", "attribution", "referral", "invite", "share link", "branch"],
  },
  {
    id: "twilio",
    name: "Twilio",
    category: "connector",
    description: "SMS, WhatsApp, voice calls, and Verify (OTP) via API.",
    docs: "https://www.twilio.com/docs",
    keywords: ["sms", "text message", "twilio", "otp", "verify", "whatsapp", "voice call", "phone"],
  },
  {
    id: "mapbox",
    name: "Mapbox",
    category: "connector",
    description: "Custom map styles, turn-by-turn routing, and search.",
    packageUrl: "https://github.com/mapbox/mapbox-maps-ios",
    docs: "https://docs.mapbox.com/ios/maps/guides/",
    keywords: ["mapbox", "custom map", "routing", "geocoding", "isochrone"],
  },

  // ── Backend Services ──────────────────────────────────────────────────────
  {
    id: "postgres",
    name: "PostgreSQL (Neon)",
    category: "service",
    description: "Serverless Postgres — used by the S1AF API server.",
    docs: "https://neon.tech/docs/introduction",
    keywords: ["database", "postgres", "sql", "relational", "query", "table", "schema"],
  },
  {
    id: "redis",
    name: "Redis (Upstash)",
    category: "service",
    description: "Serverless Redis for caching, rate limiting, and queues.",
    docs: "https://upstash.com/docs/redis/overall/getstarted",
    keywords: ["cache", "redis", "rate limit", "queue", "session", "pub/sub", "real-time"],
  },
  {
    id: "r2",
    name: "Cloudflare R2 / S3",
    category: "service",
    description: "Object storage for images, videos, and generated files.",
    docs: "https://developers.cloudflare.com/r2/",
    keywords: ["file", "upload", "storage", "image upload", "video upload", "cdn", "asset", "attachment", "bucket"],
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    category: "service",
    description: "Transactional email delivery and templates.",
    docs: "https://docs.sendgrid.com",
    keywords: ["email", "sendgrid", "transactional email", "newsletter", "welcome email", "receipt"],
  },
  {
    id: "websocket",
    name: "WebSocket / Realtime",
    category: "service",
    description: "Bidirectional real-time messaging — chat, live data, multiplayer.",
    docs: "https://developer.apple.com/documentation/foundation/urlsessionwebsockettask",
    keywords: ["real-time", "live", "chat", "message", "websocket", "streaming", "multiplayer", "collaborative", "feed"],
  },

  // ── AI / LLM Services ─────────────────────────────────────────────────────
  {
    id: "openai",
    name: "OpenAI (GPT-4o)",
    category: "ai",
    description: "Text, vision, function calling, and embeddings via OpenAI API.",
    docs: "https://platform.openai.com/docs",
    keywords: ["openai", "gpt", "chatgpt", "ai", "language model", "llm", "chat", "vision", "embeddings", "completion"],
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    category: "ai",
    description: "Claude 4 — reasoning, code generation, and long-context tasks.",
    docs: "https://docs.anthropic.com",
    keywords: ["anthropic", "claude", "ai", "reasoning", "code generation", "analysis"],
  },
  {
    id: "kimi",
    name: "Kimi (Moonshot AI)",
    category: "ai",
    description: "Long-context AI used by S1AF for Swift code generation.",
    docs: "https://platform.moonshot.ai/docs",
    keywords: ["kimi", "moonshot", "code generation", "swift", "s1af"],
  },
  {
    id: "whisper",
    name: "Whisper (OpenAI)",
    category: "ai",
    description: "Server-side speech-to-text transcription.",
    docs: "https://platform.openai.com/docs/guides/speech-to-text",
    keywords: ["whisper", "transcription", "speech to text", "voice", "meeting notes", "podcast", "subtitle"],
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    category: "ai",
    description: "Realistic text-to-speech and voice cloning.",
    docs: "https://elevenlabs.io/docs",
    keywords: ["text to speech", "tts", "voice synthesis", "voice clone", "narration", "elevenlabs", "read aloud"],
  },
  {
    id: "replicate",
    name: "Replicate",
    category: "ai",
    description: "Stable Diffusion, video generation, and open-source ML models.",
    docs: "https://replicate.com/docs",
    keywords: ["image generation", "stable diffusion", "sdxl", "video generation", "text to image", "replicate"],
  },

  // ── Companion Apps ────────────────────────────────────────────────────────
  {
    id: "watchapp",
    name: "watchOS Companion App",
    category: "app",
    description: "WatchKit + SwiftUI watchOS target paired with the iPhone app.",
    keywords: ["apple watch", "watch app", "watchos", "wearable", "wrist", "complication"],
  },
  {
    id: "macapp",
    name: "Mac Catalyst / macOS App",
    category: "app",
    description: "Run iOS app natively on macOS via Catalyst or a dedicated SwiftUI target.",
    keywords: ["mac", "macos", "desktop", "catalyst", "universal"],
  },
  {
    id: "todayextension",
    name: "Share Extension",
    category: "app",
    description: "Share content from other apps directly into this app.",
    keywords: ["share", "share extension", "share sheet", "import from"],
  },
  {
    id: "actionextension",
    name: "Action Extension",
    category: "app",
    description: "Process and transform content from other apps.",
    keywords: ["action extension", "process", "transform", "edit content"],
  },
];

// ─── Formula Engine ───────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter(Boolean);
}

function scoreItem(item: CatalogItem, text: string, tokens: string[]): number {
  let score = 0;
  for (const kw of item.keywords) {
    if (text.includes(kw)) {
      // Exact phrase match — high weight
      score += kw.split(" ").length > 1 ? 2.0 : 1.0;
    } else {
      // Partial token match — low weight
      const kwTokens = kw.split(/\W+/);
      const overlap = kwTokens.filter(k => tokens.includes(k)).length;
      score += (overlap / kwTokens.length) * 0.4;
    }
  }
  return Math.min(score / Math.max(item.keywords.length * 0.3, 1), 1);
}

function computeComplexity(
  items: FormulaItem[],
): "simple" | "moderate" | "complex" | "enterprise" {
  const total = items.length;
  if (total <= 4)  return "simple";
  if (total <= 9)  return "moderate";
  if (total <= 16) return "complex";
  return "enterprise";
}

function estimateFiles(items: FormulaItem[]): number {
  const base = 8; // S1AF minimum
  return base + items.reduce((acc, i) => {
    if (i.category === "framework") return acc + 1;
    if (i.category === "connector") return acc + 2;
    if (i.category === "app")       return acc + 4;
    return acc + 1;
  }, 0);
}

function estimateLines(items: FormulaItem[]): number {
  const base = 400;
  return base + items.reduce((acc, i) => {
    if (i.category === "framework") return acc + 80;
    if (i.category === "connector") return acc + 150;
    if (i.category === "ai")        return acc + 120;
    if (i.category === "app")       return acc + 300;
    return acc + 60;
  }, 0);
}

function buildEnrichedPrompt(
  description: string,
  platform: string,
  items: FormulaItem[],
): string {
  const byCategory = {
    frameworks: items.filter(i => i.category === "framework"),
    connectors: items.filter(i => i.category === "connector"),
    services:   items.filter(i => i.category === "service"),
    ai:         items.filter(i => i.category === "ai"),
    apps:       items.filter(i => i.category === "app"),
  };

  const fmtList = (arr: FormulaItem[]) =>
    arr.map(i => `  - ${i.name}: ${i.description}`).join("\n");

  const imports = items
    .filter(i => i.importStatement)
    .map(i => i.importStatement!)
    .join("\n");

  return `Generate a complete ${platform} S1AF app for: ${description}

━━ SENTIENT FORMULA BUILDER MANIFEST ━━
The following integrations were automatically resolved for this app.
You MUST include all of them — they are required by the feature set.

APPLE FRAMEWORKS (${byCategory.frameworks.length}):
${fmtList(byCategory.frameworks) || "  (none beyond baseline)"}

THIRD-PARTY CONNECTORS (${byCategory.connectors.length}):
${fmtList(byCategory.connectors) || "  (none)"}

BACKEND SERVICES (${byCategory.services.length}):
${fmtList(byCategory.services) || "  (none)"}

AI / LLM SERVICES (${byCategory.ai.length}):
${fmtList(byCategory.ai) || "  (none)"}

COMPANION APPS / EXTENSIONS (${byCategory.apps.length}):
${fmtList(byCategory.apps) || "  (none)"}

REQUIRED SWIFT IMPORTS:
${imports || "(standard SwiftUI + SwiftData)"}

COMPLEXITY: ${computeComplexity(items).toUpperCase()}
ESTIMATED OUTPUT: ~${estimateFiles(items)} files · ~${estimateLines(items)} lines

━━ GENERATION RULES ━━
• Implement every framework listed — no stubs, no TODOs
• Each connector must be initialized in [AppName]App.swift
• DeviceGuard.swift must be present (iPhone XR lock)
• All user-facing strings in Localizable.xcstrings
• Include AppIntents for every major action
• Full SwiftData models for all persistent entities

Respond with only the JSON object, no markdown fences.`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function resolveFormula(
  appDescription: string,
  platform: string = "iOS",
): FormulaResult {
  const text   = appDescription.toLowerCase();
  const tokens = tokenize(text);

  // Score every catalog item
  const scored = CATALOG.map(item => {
    const confidence = item.baseline ? 1 : scoreItem(item, text, tokens);
    const reason = item.baseline
      ? "Always included in every S1AF project"
      : `Matched ${item.keywords.filter(k => text.includes(k)).join(", ")}`;
    return { ...item, confidence, reason } as FormulaItem;
  });

  // Keep baseline items and items with meaningful confidence
  const selected = scored
    .filter(i => i.baseline || i.confidence >= 0.25)
    .sort((a, b) => b.confidence - a.confidence);

  // Group by category
  const group = (cat: FormulaCategory) =>
    selected.filter(i => i.category === cat);

  const frameworks = group("framework");
  const connectors = group("connector");
  const services   = group("service");
  const ai         = group("ai");
  const apps       = group("app");
  const all        = [...frameworks, ...connectors, ...services, ...ai, ...apps];

  return {
    frameworks,
    connectors,
    services,
    ai,
    apps,
    complexity:      computeComplexity(all),
    estimatedFiles:  estimateFiles(all),
    estimatedLines:  estimateLines(all),
    enrichedPrompt:  buildEnrichedPrompt(appDescription, platform, all),
    manifest: {
      appDescription,
      platform,
      resolvedAt: new Date().toISOString(),
      totalIntegrations: all.length,
      items: all.map(i => ({
        id: i.id, name: i.name, category: i.category,
        confidence: i.confidence, reason: i.reason,
      })),
    },
  };
}
