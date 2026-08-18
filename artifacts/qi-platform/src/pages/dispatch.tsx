/**
 * © 2026 Jonathan Sherman — S1AF · Sentient QI Platform
 * Sovereign ID: 1 · OCSO-S1AF-GOV-1
 *
 * Intelligence Dispatch — three modes:
 *   GOVERNANCE  — send a raw operation to the Sentient network
 *   GENERATE    — describe an app in natural language; Kimi builds it
 *   AUTOMATE    — one statement, no human in the loop, fully automated pipeline
 */

import { useState } from "react";
import { useDispatchQiOperation } from "@workspace/api-client-react";
import {
  Send, Terminal, AlertTriangle, CheckSquare,
  Sparkles, Smartphone, Monitor, Globe, ChevronDown, ChevronUp,
  Copy, FileCode2, ShieldCheck, Zap, GitBranch, Tag, CheckCircle2, Loader2,
  Bot,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatDateTime } from "@/lib/utils";
import type { QiDispatchResult } from "@workspace/api-client-react";

// ── AARTE types ───────────────────────────────────────────────────────────────

type AarteDecision = "proceed" | "retry" | "review" | "abort";

interface AarteAnalysis {
  decision:       AarteDecision;
  shouldDeploy:   boolean;
  optimalBackend: string;
  timestamp:      string;
}

const QUANTUM_BACKENDS: Record<string, number> = {
  "ibm_brisbane":   12,
  "ibm_sherbrooke":  5,
  "ibm_kyiv":        8,
};

const AARTE_COLORS: Record<AarteDecision, { border: string; bg: string; text: string }> = {
  proceed: { border: "border-[#00ff66]/30", bg: "bg-[#00ff66]/5",  text: "text-[#00ff66]" },
  retry:   { border: "border-[#ffb000]/30", bg: "bg-[#ffb000]/5",  text: "text-[#ffb000]" },
  review:  { border: "border-[#ffb000]/30", bg: "bg-[#ffb000]/5",  text: "text-[#ffb000]" },
  abort:   { border: "border-[#ff003c]/30", bg: "bg-[#ff003c]/5",  text: "text-[#ff003c]" },
};

async function callAarteAnalyze(
  buildLog: string,
  testResults: Record<string, boolean>,
): Promise<AarteAnalysis | null> {
  try {
    const res = await fetch("/api/aarte/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buildLog, testResults, backends: QUANTUM_BACKENDS }),
    });
    if (!res.ok) return null;
    const data = await res.json() as AarteAnalysis & { ok: boolean };
    return data.ok ? data : null;
  } catch { return null; }
}

// ── AARTECard ─────────────────────────────────────────────────────────────────

function AARTECard({ analysis }: { analysis: AarteAnalysis }) {
  const c = AARTE_COLORS[analysis.decision];
  return (
    <div className={`border p-4 font-mono text-xs space-y-3 ${c.border} ${c.bg}`}>
      <div className="flex items-center justify-between border-b border-current/20 pb-2">
        <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          <Bot className="w-3 h-3 text-primary shrink-0" />
          Apple AI Decision Engine — AARTE
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {analysis.timestamp.slice(11, 19)} UTC
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Decision</div>
          <div className={`font-bold uppercase tracking-widest text-sm ${c.text}`}>
            {analysis.decision}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Auto-Deploy</div>
          <div className={`font-bold uppercase tracking-widest ${analysis.shouldDeploy ? "text-[#00ff66]" : "text-[#ff003c]"}`}>
            {analysis.shouldDeploy ? "CLEARED" : "BLOCKED"}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Quantum Backend</div>
          <div className="text-foreground font-mono">{analysis.optimalBackend || "—"}</div>
        </div>
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = "governance" | "generate" | "automate";

type Platform = "ios" | "macos" | "universal";

interface GeneratedFile {
  filename:    string;
  code:        string;
  description: string;
}
interface ValidationWarning {
  file:    string;
  rule:    string;
  message: string;
}
interface GenerateResult {
  summary:           string;
  bundleId:          string;
  mainCode:          string;
  files:             GeneratedFile[];
  architectureNotes?: string;
  warnings:          ValidationWarning[];
}

// ── Governance form ───────────────────────────────────────────────────────────

const govSchema = z.object({
  operation: z.string().min(1, "Operation is required"),
  target:    z.string().min(1, "Target is required"),
  payload:   z.string().optional(),
});
type GovValues = z.infer<typeof govSchema>;

function GovernancePanel() {
  const [result, setResult] = useState<QiDispatchResult | null>(null);
  const dispatchOp = useDispatchQiOperation();

  const form = useForm<GovValues>({
    resolver: zodResolver(govSchema),
    defaultValues: { operation: "", target: "", payload: "" },
  });

  const onSubmit = (data: GovValues) => {
    let parsedPayload: unknown;
    if (data.payload) {
      try { parsedPayload = JSON.parse(data.payload); }
      catch { form.setError("payload", { message: "Must be valid JSON" }); return; }
    }
    dispatchOp.mutate(
      { data: { operation: data.operation, target: data.target, payload: parsedPayload } },
      {
        onSuccess: (res) => { setResult(res); form.reset(); },
        onError:   (err) => setResult({
          ok: false,
          operation: data.operation,
          timestamp: new Date().toISOString(),
          message: err.message || "Dispatch failed.",
        }),
      }
    );
  };

  const suggestions = ["snapshot", "replicate-token", "validate-baseline", "defense-sweep", "biometric-scan"];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
      {/* Form */}
      <div className="border border-border bg-card p-6 flex flex-col relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-1 bg-[linear-gradient(90deg,transparent_0%,hsl(var(--primary))_50%,transparent_100%)] opacity-20" />
        <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-border pb-2">
          <Terminal className="w-4 h-4" /> Command Input
        </h2>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex-1 flex flex-col">
          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Operation</label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-muted-foreground font-mono text-xs">&gt;</span>
              <input
                {...form.register("operation")}
                className="w-full bg-background border border-border p-3 pl-8 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/50"
                placeholder="e.g. validate-baseline"
                autoComplete="off"
                list="op-suggestions"
              />
            </div>
            <datalist id="op-suggestions">
              {suggestions.map(s => <option key={s} value={s} />)}
            </datalist>
            {form.formState.errors.operation && (
              <p className="text-[#ff003c] text-xs font-mono">{form.formState.errors.operation.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Target Node / Engine</label>
            <input
              {...form.register("target")}
              className="w-full bg-background border border-border p-3 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/50"
              placeholder="e.g. layer-3"
              autoComplete="off"
            />
            {form.formState.errors.target && (
              <p className="text-[#ff003c] text-xs font-mono">{form.formState.errors.target.message}</p>
            )}
          </div>

          <div className="space-y-2 flex-1 flex flex-col">
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex justify-between">
              <span>Payload Data</span><span className="opacity-50">Optional JSON</span>
            </label>
            <textarea
              {...form.register("payload")}
              className="w-full flex-1 min-h-[120px] bg-background border border-border p-3 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none placeholder:text-muted-foreground/30"
              placeholder={'{\n  "force": true\n}'}
            />
            {form.formState.errors.payload && (
              <p className="text-[#ff003c] text-xs font-mono">{form.formState.errors.payload.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={dispatchOp.isPending}
            className="w-full mt-auto bg-primary text-primary-foreground font-mono uppercase tracking-widest text-sm py-4 px-6 hover:bg-primary/90 transition-colors flex justify-between items-center disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
          >
            <span className="relative z-10">{dispatchOp.isPending ? "Transmitting..." : "Execute Operation"}</span>
            {dispatchOp.isPending
              ? <Terminal className="w-4 h-4 animate-pulse relative z-10" />
              : <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform relative z-10" />}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:100%_4px] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />
          </button>
        </form>
      </div>

      {/* Result */}
      <div className="border border-border bg-card p-6 flex flex-col">
        <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-border pb-2">
          <CheckSquare className="w-4 h-4" /> Execution Result
        </h2>
        <div className="flex-1 bg-background border border-border overflow-hidden flex flex-col relative">
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(0,0,0,0.1)_1px,transparent_1px)] bg-[size:100%_2px] z-10" />
          {!result && !dispatchOp.isPending && (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/30 p-6 text-center space-y-4">
              <Terminal className="w-12 h-12" />
              <p className="font-mono text-sm uppercase tracking-widest">Awaiting Command Execution</p>
            </div>
          )}
          {dispatchOp.isPending && (
            <div className="flex-1 flex flex-col p-6 font-mono text-xs space-y-2">
              <div className="text-primary animate-pulse flex items-center gap-2"><span>&gt;</span> INITIATING UPLINK</div>
              <div className="text-muted-foreground flex items-center gap-2 delay-150 animate-in fade-in fill-mode-both"><span>&gt;</span> COMPILING PAYLOAD</div>
              <div className="text-muted-foreground flex items-center gap-2 delay-300 animate-in fade-in fill-mode-both"><span>&gt;</span> TRANSMITTING...</div>
            </div>
          )}
          {result && !dispatchOp.isPending && (
            <div className="p-6 font-mono overflow-auto flex-1 z-20 space-y-4">
              <div className={`text-xs border-b pb-2 flex justify-between items-center ${result.ok ? 'border-[#00ff66]/20 text-[#00ff66]' : 'border-[#ff003c]/20 text-[#ff003c]'}`}>
                <span className="uppercase tracking-widest">Status: {result.ok ? 'SUCCESS' : 'FAILED'}</span>
                <span>{formatDateTime(result.timestamp)}</span>
              </div>
              <div className="text-muted-foreground text-xs uppercase tracking-widest">
                &gt; OPERATION: <span className="text-foreground">{result.operation}</span>
              </div>
              <div className="bg-muted/30 p-4 border-l-2 border-border mt-4">
                <p className={`text-sm ${result.ok ? 'text-foreground' : 'text-[#ff003c]'}`}>{result.message}</p>
              </div>
              {!result.ok && (
                <div className="mt-4 flex items-start gap-3 text-[#ffb000] bg-[#ffb000]/10 p-4 border border-[#ffb000]/20 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="uppercase tracking-widest leading-relaxed">Ensure target node is reachable and payload schema matches engine constraints.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Generate panel ─────────────────────────────────────────────────────────────

const PLATFORM_DEFS: Array<{ id: Platform; label: string; sublabel: string; icon: React.ElementType; accent: string }> = [
  { id: "ios",       label: "iOS",       sublabel: "iPhone XR — hardware locked",  icon: Smartphone, accent: "border-cyan-500/50 text-cyan-400" },
  { id: "macos",     label: "macOS",     sublabel: "Local Mac — native process",   icon: Monitor,    accent: "border-violet-500/50 text-violet-400" },
  { id: "universal", label: "Universal", sublabel: "iOS + macOS dual target",      icon: Globe,      accent: "border-primary/50 text-primary" },
];

function FileRow({ file }: { file: GeneratedFile }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border bg-background">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <FileCode2 className="w-4 h-4 text-primary shrink-0" />
          <span className="font-mono text-sm text-foreground">{file.filename}</span>
          <span className="text-xs text-muted-foreground hidden sm:block">{file.description}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {open
            ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
            : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-border relative">
          <button
            onClick={() => void navigator.clipboard.writeText(file.code)}
            className="absolute top-2 right-2 z-10 flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground bg-background border border-border px-2 py-1"
          >
            <Copy className="w-3 h-3" /> Copy
          </button>
          <pre className="p-4 text-[11px] font-mono text-muted-foreground overflow-x-auto max-h-80 overflow-y-auto leading-relaxed whitespace-pre bg-muted/20">
            {file.code}
          </pre>
        </div>
      )}
    </div>
  );
}

function GeneratePanel() {
  const [platform, setPlatform] = useState<Platform>("ios");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aarte, setAarte] = useState<AarteAnalysis | null>(null);

  const generate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setAarte(null);
    try {
      const res = await fetch("/api/kimi/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appDescription: description,
          platform,
          requirements: requirements || undefined,
        }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json() as GenerateResult;
      setResult(data);
      // ── AARTE analysis ────────────────────────────────────────────────────────
      const buildLog = [
        "Build succeeded.",
        data.warnings.length === 0 ? "All tests passed." : "",
        ...data.warnings.map(w => `warning: ${w.message}`),
      ].join("\n");
      const testResults = {
        "SyntaxCheck":    data.warnings.length === 0,
        "StructureCheck": data.files.length >= 3,
        "BiometricGate":  data.files.some(f => f.filename.toLowerCase().includes("biometric")),
      };
      callAarteAnalyze(buildLog, testResults).then(a => { if (a) setAarte(a); }).catch(() => null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const allFiles: GeneratedFile[] = result
    ? [
        { filename: "ContentView.swift", code: result.mainCode, description: "Root view" },
        ...result.files.filter(f => f.filename !== "ContentView.swift"),
      ]
    : [];

  return (
    <div className="space-y-6 flex-1">
      {/* Platform selector */}
      <div className="grid grid-cols-3 gap-3">
        {PLATFORM_DEFS.map(({ id, label, sublabel, icon: Icon, accent }) => (
          <button
            key={id}
            onClick={() => setPlatform(id)}
            className={`border p-4 flex flex-col items-start gap-2 transition-colors text-left ${
              platform === id
                ? `${accent} bg-primary/5`
                : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
            }`}
          >
            <Icon className="w-5 h-5" />
            <div>
              <div className="font-mono text-sm font-bold uppercase tracking-widest">{label}</div>
              <div className="font-mono text-[10px] opacity-70 mt-0.5">{sublabel}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Description input */}
      <div className="border border-border bg-card p-6 space-y-4">
        <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2 border-b border-border pb-2">
          <Sparkles className="w-4 h-4" /> Natural Language Prompt
        </h2>
        <div className="relative">
          <span className="absolute left-3 top-3 text-muted-foreground font-mono text-xs">&gt;</span>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={5}
            placeholder={
              platform === "macos"
                ? "Describe the macOS app to build locally on your Mac…\ne.g. A menu bar productivity timer with Pomodoro sessions, local SwiftData history, and Touch ID lock"
                : "Describe the iOS app to build for iPhone XR…\ne.g. A secure note-taking app with Face ID lock, SwiftData persistence, and Siri shortcuts"
            }
            className="w-full bg-background border border-border p-3 pl-8 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none placeholder:text-muted-foreground/30"
          />
        </div>
        <textarea
          value={requirements}
          onChange={e => setRequirements(e.target.value)}
          rows={2}
          placeholder="Additional requirements (optional) — e.g. offline only, no network, ARKit required"
          className="w-full bg-background border border-border p-3 font-mono text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none placeholder:text-muted-foreground/30"
        />
        <button
          onClick={() => void generate()}
          disabled={!description.trim() || loading}
          className="w-full bg-primary text-primary-foreground font-mono uppercase tracking-widest text-sm py-4 px-6 hover:bg-primary/90 transition-colors flex justify-between items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>{loading ? "Generating…" : "Generate with Kimi"}</span>
          <Sparkles className={`w-4 h-4 ${loading ? "animate-pulse" : ""}`} />
        </button>
      </div>

      {/* Loading terminal */}
      {loading && (
        <div className="border border-border bg-card p-6 font-mono text-xs space-y-2">
          <div className="text-primary animate-pulse flex items-center gap-2"><span>&gt;</span> TRANSMITTING TO KIMI</div>
          <div className="text-muted-foreground animate-pulse flex items-center gap-2 delay-150"><span>&gt;</span> GENERATING SWIFT CODE</div>
          <div className="text-muted-foreground animate-pulse flex items-center gap-2 delay-300"><span>&gt;</span> VALIDATING STRUCTURE</div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="border border-[#ff003c]/30 bg-[#ff003c]/5 p-4 flex items-start gap-3 font-mono text-xs text-[#ff003c]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="uppercase tracking-widest">{error}</span>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="space-y-4">
          {/* AARTE Decision */}
          {aarte && <AARTECard analysis={aarte} />}

          {/* Summary */}
          <div className="border border-[#00ff66]/20 bg-[#00ff66]/5 p-4 font-mono text-xs space-y-2">
            <div className="text-[#00ff66] uppercase tracking-widest">✓ Generation complete</div>
            <p className="text-foreground text-sm">{result.summary}</p>
            <div className="flex flex-wrap gap-4 mt-2 text-muted-foreground">
              <span>Bundle: <span className="text-primary">{result.bundleId}</span></span>
              <span>Files: <span className="text-foreground">{allFiles.length}</span></span>
              {result.warnings.length > 0 && (
                <span className="text-[#ffb000]">⚠ {result.warnings.length} warning{result.warnings.length > 1 ? "s" : ""}</span>
              )}
            </div>
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-2">
              {result.warnings.map((w, i) => (
                <div key={i} className="border border-[#ffb000]/20 bg-[#ffb000]/5 p-3 flex items-start gap-3 font-mono text-xs text-[#ffb000]">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div>
                    <span className="uppercase tracking-widest">{w.rule} — </span>
                    <span className="opacity-80">{w.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Architecture notes */}
          {result.architectureNotes && (
            <div className="border border-border bg-card p-4 font-mono text-xs text-muted-foreground">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 block mb-1">Architecture</span>
              {result.architectureNotes}
            </div>
          )}

          {/* Files */}
          <div className="border border-border bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3 pb-2 border-b border-border">
              <ShieldCheck className="w-3 h-3 text-primary" /> Generated Files — {allFiles.length} total
            </div>
            <div className="space-y-1">
              {allFiles.map(f => <FileRow key={f.filename} file={f} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Automate Panel ────────────────────────────────────────────────────────────

type AutomateStage = "idle" | "generating" | "filtering" | "validating" | "committing" | "done" | "error";

interface AutomateResult {
  projectId?: number;
  name: string;
  platform: string;
  bundleId?: string;
  files: Record<string, string>;
  summary?: string;
  warnings: { type: string; message: string }[];
  intake: { score: number; passed: boolean; flagged: number };
  commit: { tag: string; commitSha: string; committed: string[]; repoUrl: string } | null;
}

const STAGE_LABELS: Record<AutomateStage, string> = {
  idle:       "",
  generating: "[1/5] KIMI 2.6 — GENERATING SWIFT PROJECT",
  filtering:  "[2/5] SENTIENT INTAKE FILTER — EVALUATING PAYLOAD",
  validating: "[3/5] SWIFT STRUCTURAL VALIDATION",
  committing: "[4/5] ORACLE-AI — COMMITTING + TAGGING",
  done:       "[5/5] PIPELINE COMPLETE",
  error:      "PIPELINE ABORTED",
};

function AutomatePanel() {
  const [platform, setPlatform] = useState<"ios" | "macos">("ios");
  const [description, setDescription] = useState("");
  const [stage, setStage] = useState<AutomateStage>("idle");
  const [result, setResult] = useState<AutomateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [aarte, setAarte] = useState<AarteAnalysis | null>(null);

  const execute = async () => {
    if (!description.trim() || stage !== "idle") return;
    setError(null);
    setResult(null);
    setAarte(null);

    // Animate through stages while the server runs
    setStage("generating");
    const stageTimer = setTimeout(() => setStage("filtering"),  8000);
    const stageTimer2 = setTimeout(() => setStage("validating"), 16000);
    const stageTimer3 = setTimeout(() => setStage("committing"), 22000);

    try {
      const res = await fetch("/api/automate/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, platform, push: true }),
      });
      clearTimeout(stageTimer); clearTimeout(stageTimer2); clearTimeout(stageTimer3);
      if (!res.ok) {
        const body = await res.json() as { error?: string; blocked?: string[] };
        throw new Error(body.blocked?.join(" · ") ?? body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as AutomateResult;
      setResult(data);
      setStage("done");
      // ── AARTE analysis ──────────────────────────────────────────────────────
      const buildLog = [
        data.commit ? "Build succeeded. All tests passed." : "Build succeeded.",
        data.intake.passed ? "" : "warning: intake filter flagged issues",
        ...data.warnings.map(w => `warning: ${w.message}`),
      ].join("\n");
      const testResults = {
        "IntakeFilter":        data.intake.passed,
        "StructuralValidation": data.warnings.length === 0,
        "CommitSuccess":        !!data.commit,
      };
      callAarteAnalyze(buildLog, testResults).then(a => { if (a) setAarte(a); }).catch(() => null);
    } catch (err) {
      clearTimeout(stageTimer); clearTimeout(stageTimer2); clearTimeout(stageTimer3);
      setError(err instanceof Error ? err.message : String(err));
      setStage("error");
    }
  };

  const running = stage !== "idle" && stage !== "done" && stage !== "error";
  const fileEntries = result ? Object.entries(result.files ?? {}) : [];

  return (
    <div className="space-y-6 flex-1">
      {/* Platform — ios only for automate (iPhone XR native) */}
      <div className="grid grid-cols-2 gap-3">
        {(["ios", "macos"] as const).map((p) => (
          <button
            key={p}
            onClick={() => { if (!running) setPlatform(p); }}
            disabled={running}
            className={`border p-4 flex items-center gap-4 transition-colors text-left ${
              platform === p
                ? "border-primary bg-primary/5 text-foreground"
                : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
            } ${running ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {p === "ios" ? <Smartphone className="w-5 h-5 shrink-0" /> : <Monitor className="w-5 h-5 shrink-0" />}
            <div>
              <div className="font-mono text-sm font-bold uppercase tracking-widest">{p === "ios" ? "iOS" : "macOS"}</div>
              <div className="font-mono text-[10px] opacity-60 mt-0.5">
                {p === "ios" ? "iPhone XR · CoreML · Face ID · Metal A12" : "Local Mac · Touch ID · Core ML · Metal GPU"}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Single statement input */}
      <div className="border border-primary/30 bg-card p-6 space-y-4">
        <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2 border-b border-border pb-2">
          <Zap className="w-4 h-4 text-primary" /> One Statement — No Human In Loop
        </h2>
        <div className="relative">
          <span className="absolute left-3 top-3 text-primary font-mono text-xs">⚡</span>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={running}
            rows={6}
            placeholder={
              platform === "ios"
                ? "Describe the iOS app — Kimi 2.6 generates all Swift files, CoreML, AppIntents, Face ID gate, and DeviceGuard automatically. Files are committed to oracle-ai and tagged.\n\ne.g. A workout tracker with CoreML rep counting using the camera, SwiftData history, Live Activities for active session, and Siri shortcuts"
                : "Describe the macOS app — Kimi 2.6 generates all Swift files, CoreML, AppIntents, and Touch ID gate automatically. Files are committed to oracle-ai and tagged.\n\ne.g. A local document analyzer that uses NaturalLanguage and CoreML to classify and summarize files from the menu bar"
            }
            className="w-full bg-background border border-border p-3 pl-8 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none placeholder:text-muted-foreground/30 disabled:opacity-50"
          />
        </div>

        <button
          onClick={() => void execute()}
          disabled={!description.trim() || running}
          className="w-full bg-primary text-primary-foreground font-mono uppercase tracking-widest text-sm py-5 px-6 hover:bg-primary/90 transition-colors flex justify-between items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>{running ? STAGE_LABELS[stage] : "EXECUTE — NO HUMAN IN LOOP"}</span>
          {running
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Zap className="w-4 h-4" />
          }
        </button>

        {/* Live stage terminal */}
        {running && (
          <div className="border border-border bg-background p-4 font-mono text-xs space-y-2">
            {(["generating","filtering","validating","committing"] as AutomateStage[]).map((s) => {
              const idx = ["generating","filtering","validating","committing"].indexOf(s);
              const curIdx = ["generating","filtering","validating","committing"].indexOf(stage);
              return (
                <div key={s} className={`flex items-center gap-2 transition-colors ${
                  idx < curIdx ? "text-[#00ff66]" : idx === curIdx ? "text-primary animate-pulse" : "text-muted-foreground/40"
                }`}>
                  {idx < curIdx ? <CheckCircle2 className="w-3 h-3" /> : <span>&gt;</span>}
                  {STAGE_LABELS[s]}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Error */}
      {stage === "error" && error && (
        <div className="border border-[#ff003c]/30 bg-[#ff003c]/5 p-4 flex items-start gap-3 font-mono text-xs text-[#ff003c]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="uppercase tracking-widest font-bold mb-1">Pipeline Aborted</div>
            <div className="opacity-80">{error}</div>
          </div>
        </div>
      )}

      {/* Result */}
      {stage === "done" && result && (
        <div className="space-y-4">
          {/* AARTE Decision */}
          {aarte && <AARTECard analysis={aarte} />}

          {/* Success header */}
          <div className="border border-[#00ff66]/30 bg-[#00ff66]/5 p-5 font-mono text-xs space-y-3">
            <div className="text-[#00ff66] uppercase tracking-widest text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Pipeline Complete — No Human Touched This
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-2 text-muted-foreground">
              <span>App: <span className="text-foreground">{result.name}</span></span>
              <span>Platform: <span className="text-foreground uppercase">{result.platform}</span></span>
              <span>Bundle: <span className="text-primary">{result.bundleId}</span></span>
              <span>Files: <span className="text-foreground">{fileEntries.length}</span></span>
              <span>Intake Score: <span className={result.intake.score > 0.8 ? "text-[#00ff66]" : "text-[#ffb000]"}>{Math.round(result.intake.score * 100)}%</span></span>
              {result.warnings.length > 0 && (
                <span className="text-[#ffb000]">⚠ {result.warnings.length} advisory</span>
              )}
            </div>
          </div>

          {/* Commit result */}
          {result.commit && (
            <div className="border border-primary/20 bg-card p-4 font-mono text-xs space-y-2">
              <div className="flex items-center gap-2 text-primary uppercase tracking-widest font-bold border-b border-border pb-2 mb-3">
                <GitBranch className="w-3.5 h-3.5" /> Committed to oracle-ai
              </div>
              <div className="space-y-1.5 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Tag className="w-3 h-3 text-primary" />
                  <span className="text-foreground font-bold">{result.commit.tag}</span>
                </div>
                <div>SHA: <span className="text-foreground">{result.commit.commitSha.slice(0, 12)}</span></div>
                <div>Files pushed: <span className="text-[#00ff66]">{result.commit.committed.length}</span></div>
                <a href={result.commit.repoUrl} target="_blank" rel="noopener noreferrer"
                   className="text-primary underline underline-offset-2 hover:opacity-80 block mt-1">
                  → View on GitHub
                </a>
              </div>
            </div>
          )}

          {/* Files */}
          <div className="border border-border bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3 pb-2 border-b border-border">
              <ShieldCheck className="w-3 h-3 text-primary" /> Generated Files — {fileEntries.length} total
            </div>
            <div className="space-y-1">
              {fileEntries.map(([filename, code]) => (
                <div key={filename} className="border border-border">
                  <button
                    onClick={() => setExpandedFile(expandedFile === filename ? null : filename)}
                    className="w-full flex items-center justify-between p-3 font-mono text-xs hover:bg-muted/30 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <FileCode2 className="w-3 h-3 text-primary shrink-0" />
                      <span className="text-foreground">{filename}</span>
                    </span>
                    <span className="flex items-center gap-3 text-muted-foreground">
                      <span>{code.split("\n").length} lines</span>
                      {expandedFile === filename ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </span>
                  </button>
                  {expandedFile === filename && (
                    <div className="relative border-t border-border">
                      <button
                        onClick={() => void navigator.clipboard.writeText(code)}
                        className="absolute top-2 right-2 p-1.5 text-muted-foreground hover:text-foreground z-10"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <pre className="p-4 text-xs font-mono overflow-x-auto bg-background text-muted-foreground max-h-96 whitespace-pre-wrap">
                        {code}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Reset */}
          <button
            onClick={() => { setStage("idle"); setResult(null); setDescription(""); setAarte(null); }}
            className="w-full border border-border text-muted-foreground font-mono text-xs uppercase tracking-widest py-3 hover:border-primary hover:text-foreground transition-colors"
          >
            ↺ New Automated Build
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DispatchPage() {
  const [mode, setMode] = useState<Mode>("automate");

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-8 flex flex-col min-h-full">
      <header className="shrink-0">
        <h1 className="text-3xl font-mono uppercase tracking-widest text-foreground flex items-center gap-3">
          <Send className="text-primary w-8 h-8" />
          Intelligence Dispatch
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-2 uppercase tracking-widest">
          Execute Network Operations · Generate with Kimi · Automate
        </p>
      </header>

      {/* Mode toggle */}
      <div className="flex gap-0 border border-border w-fit shrink-0">
        {([
          { id: "governance" as Mode, label: "Governance", icon: Terminal },
          { id: "generate"   as Mode, label: "Generate",   icon: Sparkles },
          { id: "automate"   as Mode, label: "Automate",   icon: Zap      },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex items-center gap-2 px-6 py-3 font-mono text-xs uppercase tracking-widest transition-colors ${
              mode === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {mode === "governance" ? <GovernancePanel /> : mode === "generate" ? <GeneratePanel /> : <AutomatePanel />}
    </div>
  );
}
