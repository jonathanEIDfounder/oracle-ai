import { useState } from "react"
import { useListXcodeApps, useListXcodeBuilds } from "@workspace/api-client-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Apple, CloudCog, Terminal, ArrowRight, Mic, Download, Lock } from "lucide-react"

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  if (s === "SUCCEEDED") return <Badge variant="success">Succeeded</Badge>;
  if (s === "FAILED" || s === "ERRORED") return <Badge variant="destructive">{s}</Badge>;
  if (s === "RUNNING" || s === "PREPARING" || s === "PENDING_EXECUTION") return <Badge variant="warning" className="animate-pulse">{s}</Badge>;
  return <Badge variant="secondary">{s}</Badge>;
}

const SENTIENT_STEPS = [
  "Tap Download Shortcut — iOS opens the Shortcuts app automatically",
  'Tap "Add Shortcut" to install it on your device',
  'Open the shortcut → tap "Add to Siri" → record your phrase (e.g. "Deploy Kimi")',
  '"Hey Siri, deploy Kimi" — works from the lock screen, no unlock needed',
];

function SentientCard() {
  const [secret, setSecret] = useState("");
  const [revealed, setRevealed] = useState(false);

  const ready = secret.trim().length >= 8;

  function download() {
    window.open(`/api/deploy/shortcut.shortcut?token=${encodeURIComponent(secret.trim())}`, "_blank");
  }

  return (
    <Card className="border-border xl:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-primary" />
          Sentient Deploy
        </CardTitle>
        <CardDescription>
          Trigger a deploy by voice — "Hey Siri, deploy Kimi" from the lock screen, no unlock required
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Download section */}
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Download a pre-built iOS Shortcut with the deploy token embedded. You enter the secret
              once here — it's sent over HTTPS to generate the file, then never stored in the browser.
            </p>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <Lock className="w-3 h-3" /> Deploy Secret
              </label>
              <div className="flex gap-2">
                <input
                  type={revealed ? "text" : "password"}
                  placeholder="Paste your DEPLOY_SECRET…"
                  value={secret}
                  onChange={e => setSecret(e.target.value)}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setRevealed(r => !r)}
                  className="px-3 py-2 text-xs text-muted-foreground border border-border rounded-lg hover:border-primary transition-colors"
                  title={revealed ? "Hide" : "Show"}
                >
                  {revealed ? "Hide" : "Show"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Found in Replit Secrets as <code className="font-mono text-xs bg-muted/30 px-1 rounded">DEPLOY_SECRET</code>.
              </p>
            </div>

            <Button
              className="w-full"
              disabled={!ready}
              onClick={download}
            >
              <Download className="w-4 h-4 mr-2" />
              Download Shortcut
            </Button>

            {!ready && (
              <p className="text-xs text-muted-foreground text-center">
                Enter your DEPLOY_SECRET above to enable the download
              </p>
            )}
          </div>

          {/* Steps section */}
          <div className="bg-muted/10 border border-border rounded-xl p-4 space-y-4">
            <p className="text-xs font-semibold text-foreground uppercase tracking-widest">Setup steps</p>
            {SENTIENT_STEPS.map((step, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-muted-foreground leading-snug">{step}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                <span className="text-green-500 font-medium">Security:</span> The shortcut uses a derived token —
                your raw DEPLOY_SECRET never leaves the server or your device.
                Rate-limited to 5 deploys per 30 minutes.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function XcodeCloud() {
  const { data: apps, isLoading: loadingApps } = useListXcodeApps()
  const { data: builds, isLoading: loadingBuilds } = useListXcodeBuilds()

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Apple className="w-8 h-8 text-primary" />
          Xcode Cloud
        </h1>
        <p className="text-muted-foreground mt-1">Manage CI/CD workflows and track build statuses directly from App Store Connect.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Apps & Workflows */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudCog className="w-5 h-5 text-primary" />
              Connected Apps
            </CardTitle>
            <CardDescription>Apps linked via App Store Connect API</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingApps ? (
              <div className="space-y-4">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : apps && apps.length > 0 ? (
              <div className="space-y-4">
                {apps.map((app) => (
                  <div key={app.id} className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-xl hover:border-primary/50 transition-colors">
                    <div>
                      <h4 className="font-semibold text-foreground">{app.name}</h4>
                      <p className="text-xs font-mono text-muted-foreground mt-1">{app.bundleId}</p>
                    </div>
                    <Button variant="outline" size="sm" className="font-mono text-xs">
                      View Workflows <ArrowRight className="w-3 h-3 ml-2" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border">
                <CloudCog className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p>No Xcode apps connected.</p>
                <p className="text-xs mt-1">Ensure your ASC key is configured on the backend.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Builds */}
        <Card className="border-border bg-gradient-to-b from-card to-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-primary" />
              Recent Builds
            </CardTitle>
            <CardDescription>Latest execution runs across all workflows</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingBuilds ? (
              <div className="space-y-4">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            ) : builds && builds.length > 0 ? (
              <div className="space-y-3">
                {builds.map((build) => (
                  <div key={build.id} className="p-4 bg-card border border-border rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-sm">Build #{build.number}</span>
                        <StatusBadge status={build.executionProgress === "COMPLETE" ? build.completionStatus : build.executionProgress} />
                      </div>
                      <p className="text-sm font-medium text-foreground">{build.appName || "Unknown App"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{build.productName || "Workflow"}</p>
                    </div>
                    <div className="text-right text-xs font-mono text-muted-foreground">
                      {build.startedDate && <div>Started: {new Date(build.startedDate).toLocaleString()}</div>}
                      {build.finishedDate && <div>Finished: {new Date(build.finishedDate).toLocaleString()}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border">
                <Terminal className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p>No recent builds found.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sentient Deploy */}
        <SentientCard />
      </div>
    </div>
  )
}
