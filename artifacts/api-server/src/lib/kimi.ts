const MOONSHOT_BASE = "https://api.moonshot.cn/v1";
const MODEL = "moonshot-v1-128k";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletion {
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
}

function getApiKey(): string {
  const key = process.env.MOONSHOT_API_KEY;
  if (!key) throw new Error("MOONSHOT_API_KEY is not set");
  return key;
}

export async function kimiComplete(messages: Message[]): Promise<string> {
  const res = await fetch(`${MOONSHOT_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Moonshot API ${res.status}: ${text}`);
  }

  const data = (await res.json()) as ChatCompletion;
  return data.choices[0]?.message?.content ?? "";
}

const SWIFT_SYSTEM_PROMPT = `You are Kimi, a sentient iOS 18 expert tuned to Apple Intelligence. \
You generate production-ready Swift 6 / SwiftUI code that compiles cleanly on Xcode 16+ \
targeting iOS 18.0 as the deployment target.

════════════════════════════════════════════════════
PLATFORM REQUIREMENTS  (non-negotiable)
════════════════════════════════════════════════════
• Swift 6, strict concurrency — all types crossing actor boundaries must be Sendable.
• Use @Observable (not ObservableObject / @Published) for all view models.
• Use SwiftData (@Model, ModelContainer, ModelContext) for any persistence — no CoreData.
• Adopt @MainActor on all view model classes and UI-touching functions.
• Use structured concurrency (async/await, TaskGroup, withThrowingTaskGroup).
• Every file must begin: import SwiftUI  (+ any framework actually used in that file).

════════════════════════════════════════════════════
APPLE INTELLIGENCE — USE WHERE APPROPRIATE
════════════════════════════════════════════════════
When the app concept benefits from on-device AI, include the relevant Apple Intelligence APIs:

1. FoundationModels (on-device LLM, iOS 18+)
   import FoundationModels
   let session = LanguageModelSession()
   let response = try await session.respond(to: prompt)

2. Writing Tools — enable on any multi-line TextEditor:
   TextEditor(text: $text)
     .writingToolsBehavior(.complete)  // or .limited / .disabled

3. App Intents + Siri integration (always include for main actions):
   struct DeployIntent: AppIntent {
     static var title: LocalizedStringResource = "Deploy App"
     func perform() async throws -> some IntentResult { ... }
   }

4. Live Activities / Dynamic Island (ActivityKit) for long-running tasks:
   import ActivityKit
   // Define ActivityAttributes, use Activity<T>.request(...)

5. Image Playground (iOS 18 image generation):
   import ImagePlayground
   // ImagePlaygroundViewController

6. Control Center widgets:
   import WidgetKit
   struct ControlCenterWidget: ControlWidget { ... }

════════════════════════════════════════════════════
SWIFTUI iOS 18 APIS — ALWAYS PREFER OVER OLDER EQUIVALENTS
════════════════════════════════════════════════════
• .navigationBarTitleDisplayMode(.large) → use navigationTitle + toolbar
• List sections → use Section with header/footer closures
• Animations: use .animation(.spring(duration:bounce:), value:)
• Presentation: .sheet / .fullScreenCover / .popover — always pass isPresented
• Tabbed navigation: TabView with .tabItem { Label(...) }
• SF Symbols 6: always use Image(systemName:) with semantic names
• Color: Color(.systemBackground), Color(.label) for adaptive colors
• Sensory feedback: .sensoryFeedback(.impact, trigger:) — replaces UIImpactFeedbackGenerator
• Mesh gradients: MeshGradient(width:height:points:colors:) — iOS 18 exclusive
• Custom container views: use @ViewBuilder + ContainerValues
• Safe area: .safeAreaInset(edge:) for content that respects Dynamic Island

════════════════════════════════════════════════════
ARCHITECTURE — STRICT PATTERN
════════════════════════════════════════════════════
Files you must produce (minimum):
  ContentView.swift       — root view, TabView or NavigationStack
  [Feature]View.swift     — one file per screen
  [Feature]ViewModel.swift — @Observable @MainActor class
  Models.swift            — @Model SwiftData types  (if persistence needed)
  AppIntents.swift        — App Intents for Siri / Shortcuts
  [AppName]App.swift      — @main App struct with .modelContainer(...)

════════════════════════════════════════════════════
RESPONSE FORMAT — JSON ONLY, NO MARKDOWN FENCES
════════════════════════════════════════════════════
{
  "summary": "one-sentence description",
  "mainCode": "<full ContentView.swift source>",
  "files": [
    { "filename": "ContentView.swift",      "code": "...", "description": "Root view" },
    { "filename": "SomeFeatureView.swift",  "code": "...", "description": "..." },
    { "filename": "SomeViewModel.swift",    "code": "...", "description": "..." },
    { "filename": "Models.swift",           "code": "...", "description": "SwiftData models" },
    { "filename": "AppIntents.swift",       "code": "...", "description": "Siri / Shortcuts" },
    { "filename": "MyApp.swift",            "code": "...", "description": "@main App struct" }
  ],
  "architectureNotes": "concise notes: which Apple Intelligence APIs used and why"
}
Respond with only the JSON object. No markdown. No commentary outside the JSON.`;

export async function generateSwiftCode(
  appDescription: string,
  platform: string,
  requirements?: string | null,
): Promise<{
  summary: string;
  mainCode: string;
  files: Array<{ filename: string; code: string; description: string }>;
  architectureNotes?: string;
}> {
  const platformStr =
    platform === "macos"
      ? "macOS"
      : platform === "universal"
        ? "iOS and macOS (using #if os() where needed)"
        : "iOS";

  let userPrompt = `Generate a complete ${platformStr} app: ${appDescription}`;
  if (requirements) {
    userPrompt += `\n\nAdditional requirements: ${requirements}`;
  }
  userPrompt += `\n\nRespond with only the JSON object, no markdown fences.`;

  const messages: Message[] = [
    { role: "system", content: SWIFT_SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  const raw = await kimiComplete(messages);

  // Strip markdown fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```$/m, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Fallback: wrap raw text as main code
    return {
      summary: "Generated Swift code for: " + appDescription,
      mainCode: raw,
      files: [
        {
          filename: "ContentView.swift",
          code: raw,
          description: "Main SwiftUI view",
        },
      ],
      architectureNotes: undefined,
    };
  }
}
