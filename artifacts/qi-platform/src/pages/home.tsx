import { useGetQiStatus, useGetQiNetwork, useGetQiEngines } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatUptime, formatDateTime } from "@/lib/utils";
import { StatusBadge, LoadingView, ErrorView } from "@/components/ui/status";
import { Activity, ShieldAlert, Cpu, Network, Clock, Database, Smartphone, Monitor, Filter, Link2, Lock, Unlock, RefreshCw, CheckCircle2, AlertTriangle, Bot } from "lucide-react";
import { Link } from "wouter";

interface IntakeStats {
  processed: number; passed: number; flagged: number; blocked: number;
  lastProcessed: string | null; passRate: number;
}
interface SourcerootStatus {
  status: "pending" | "bound" | "error"; fileId: string | null;
  uploadedAt: string | null; account: string; filename: string;
}
interface LockStatus {
  locked: boolean; lockedAt: string | null; reason: string | null;
  lockedKeys: string[]; attempts: number; message: string;
}

type AarteDecision = "proceed" | "retry" | "review" | "abort";
interface AarteAnalysis {
  decision: AarteDecision; shouldDeploy: boolean;
  optimalBackend: string; timestamp: string;
}
interface AarteStatus { ok: boolean; lastAnalysis: AarteAnalysis | null; }

const AARTE_COLORS: Record<AarteDecision, { text: string; border: string; bg: string }> = {
  proceed: { text: "text-[#00ff66]", border: "border-[#00ff66]/20", bg: "bg-[#00ff66]/5"  },
  retry:   { text: "text-[#ffb000]", border: "border-[#ffb000]/20", bg: "bg-[#ffb000]/5"  },
  review:  { text: "text-[#ffb000]", border: "border-[#ffb000]/20", bg: "bg-[#ffb000]/5"  },
  abort:   { text: "text-[#ff003c]", border: "border-[#ff003c]/20", bg: "bg-[#ff003c]/5"  },
};

export default function Home() {
  const { data: status, isLoading, isError } = useGetQiStatus({
    query: { refetchInterval: 10000 }
  });
  const { data: networkLayers } = useGetQiNetwork({ query: { refetchInterval: 15000 } });
  const { data: engines } = useGetQiEngines({ query: { refetchInterval: 15000 } });
  const { data: intake } = useQuery<IntakeStats>({
    queryKey: ["qi-intake"],
    queryFn: () => fetch("/api/qi/intake").then((r) => r.json() as Promise<IntakeStats>),
    refetchInterval: 10000,
  });
  const { data: sourceroot } = useQuery<SourcerootStatus>({
    queryKey: ["qi-sourceroot"],
    queryFn: () => fetch("/api/qi/sourceroot").then((r) => r.json() as Promise<SourcerootStatus>),
    refetchInterval: 30000,
  });
  const { data: lockStatus } = useQuery<LockStatus>({
    queryKey: ["qi-lock-status"],
    queryFn: () => fetch("/api/qi/lock-status").then((r) => r.json() as Promise<LockStatus>),
    refetchInterval: 5000,
  });
  const { data: aarteStatus } = useQuery<AarteStatus>({
    queryKey: ["aarte-status"],
    queryFn: () => fetch("/api/aarte/status").then((r) => r.json() as Promise<AarteStatus>),
    refetchInterval: 30000,
  });

  const queryClient = useQueryClient();
  const [pulling,   setPulling]   = useState(false);
  const [pullResult, setPullResult] = useState<{ ok: boolean; status?: string; error?: string } | null>(null);

  async function pullSourceroot() {
    setPulling(true); setPullResult(null);
    try {
      const r = await fetch("/api/qi/sourceroot/pull", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Token": "f679ab7288b11a59ffc8ea43687b5ec6dfec3db86e8dbf017b471c7a2a00dc4d",
        },
      });
      const data = await r.json() as { ok: boolean; status?: string; error?: string };
      setPullResult(data);
      if (data.ok) void queryClient.invalidateQueries({ queryKey: ["qi-sourceroot"] });
    } catch (err) {
      setPullResult({ ok: false, error: err instanceof Error ? err.message : "Network error" });
    } finally {
      setPulling(false);
    }
  }

  if (isLoading) return <LoadingView />;
  if (isError || !status) return <ErrorView />;

  // Use live layer/engine arrays when available; fall back to the counts from status
  const totalNetwork = networkLayers?.length ?? status.networkLayers ?? 7;
  const onlineNetwork = networkLayers
    ? networkLayers.filter((l: { status: string }) => l.status === 'online').length
    : totalNetwork;
  const totalEngines = engines?.length ?? status.engines ?? 5;
  const onlineEngines = engines
    ? engines.filter((e: { status: string }) => e.status === 'online').length
    : totalEngines;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ── Rotation lock banner ── */}
      {lockStatus?.locked && (
        <div className="border border-[#ff003c] bg-[#ff003c]/10 p-4 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3 font-mono">
            <Lock className="w-5 h-5 text-[#ff003c] shrink-0" />
            <div>
              <div className="text-[#ff003c] font-bold uppercase tracking-widest text-sm">
                API LOCKED — ROTATION IN PROGRESS
              </div>
              <div className="text-[#ff003c]/70 text-[10px] mt-0.5 uppercase tracking-widest">
                {lockStatus.lockedKeys.join(" + ").toUpperCase()} INVALID · {lockStatus.attempts} request{lockStatus.attempts !== 1 ? "s" : ""} blocked · locked {lockStatus.lockedAt?.slice(11, 19)} UTC
              </div>
            </div>
          </div>
          <Link href="/rotate" className="flex items-center gap-2 border border-[#ff003c] px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-[#ff003c] hover:bg-[#ff003c]/10 transition-colors shrink-0">
            <Unlock className="w-3 h-3" /> Rotate Keys
          </Link>
        </div>
      )}
      {lockStatus && !lockStatus.locked && (
        <div className="border border-[#00ff66]/20 bg-[#00ff66]/5 px-4 py-2.5 flex items-center gap-3 font-mono text-[10px] text-[#00ff66]">
          <Unlock className="w-3.5 h-3.5 shrink-0" />
          <span className="uppercase tracking-widest">API UNLOCKED — Generation active · All keys valid</span>
        </div>
      )}

      <header className="mb-8">
        <h1 className="text-3xl font-mono uppercase tracking-widest text-foreground flex items-center gap-3">
          <Activity className="text-primary w-8 h-8" />
          Command Center
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-2 uppercase tracking-widest">Live System Telemetry</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Identity */}
        <div className="col-span-1 lg:col-span-2 border border-border bg-card p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-bl-full pointer-events-none" />
          <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-border pb-2">
            <ShieldAlert className="w-4 h-4" /> Governance Identity
          </h2>
          <div className="grid grid-cols-2 gap-y-6 gap-x-4">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest mb-1.5">Governor</div>
              <div className="font-mono text-lg text-foreground">{status.governor}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest mb-1.5">Governor ID</div>
              <div className="font-mono text-sm text-foreground break-all">{status.governorId}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest mb-1.5">Sovereign ID</div>
              <div className="font-mono text-2xl text-primary">{status.sovereignId}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest mb-1.5">Governance Level</div>
              <div className="font-mono text-lg text-foreground">{status.governance}</div>
            </div>
          </div>
        </div>

        {/* Platform Status */}
        <div className="border border-border bg-card p-6 flex flex-col">
          <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-border pb-2">
            <Activity className="w-4 h-4" /> Platform State
          </h2>
          <div className="space-y-5 flex-1 justify-center flex flex-col">
             <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <span className="text-xs font-mono text-muted-foreground uppercase">Version</span>
                <span className="text-sm font-mono text-primary">{status.version}</span>
             </div>
             <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <span className="text-xs font-mono text-muted-foreground uppercase">Sealed</span>
                <span className={`text-sm font-mono ${status.sealed ? 'text-[#00ff66]' : 'text-[#ffb000]'}`}>
                  {status.sealed ? 'YES' : 'NO'}
                </span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-muted-foreground uppercase">Platform</span>
                <span className="text-sm font-mono text-foreground">{status.platform}</span>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Uptime */}
        <div className="border border-border bg-card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
            <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Uptime</h2>
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <div className="font-mono text-xl text-foreground mt-2">{formatUptime(status.uptime)}</div>
        </div>

        {/* Last Snapshot */}
        <div className="border border-border bg-card p-6 col-span-1 lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
            <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Last Snapshot</h2>
            <Database className="w-4 h-4 text-primary" />
          </div>
          <div className="font-mono text-lg text-foreground mt-2">
            {status.lastSnapshot ? formatDateTime(status.lastSnapshot) : 'N/A'}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground mt-auto pt-4 uppercase tracking-widest">
            Armed At: {status.armedAt ? formatDateTime(status.armedAt) : 'N/A'}
          </div>
        </div>
        
        {/* Network & Engines Summary */}
        <div className="border border-border bg-card p-6 flex flex-col justify-between">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Network</h2>
              <Network className="w-3 h-3 text-primary" />
            </div>
            <div className="font-mono text-sm flex items-center gap-2">
               <span className={onlineNetwork === totalNetwork ? "text-[#00ff66]" : "text-[#ffb000]"}>
                 {onlineNetwork} / {totalNetwork}
               </span> 
               <span className="text-xs text-muted-foreground">ONLINE</span>
            </div>
          </div>
          <div className="h-px w-full bg-border/50 my-2" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Compute</h2>
              <Cpu className="w-3 h-3 text-primary" />
            </div>
            <div className="font-mono text-sm flex items-center gap-2">
               <span className={onlineEngines === totalEngines ? "text-[#00ff66]" : "text-[#ffb000]"}>
                 {onlineEngines} / {totalEngines}
               </span> 
               <span className="text-xs text-muted-foreground">ONLINE</span>
            </div>
          </div>
        </div>
      </div>
      {/* Kimi Account Binding */}
      <div className={`border p-6 ${sourceroot?.status === "bound" ? "border-[#00ff66]/20 bg-[#00ff66]/5" : "border-[#ffb000]/20 bg-[#ffb000]/5"}`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Link2 className={`w-4 h-4 ${sourceroot?.status === "bound" ? "text-[#00ff66]" : "text-[#ffb000]"}`} />
            Kimi Account Binding — S1AF Sourceroot
          </h2>
          <span className={`font-mono text-[10px] uppercase tracking-widest font-bold ${sourceroot?.status === "bound" ? "text-[#00ff66]" : "text-[#ffb000]"}`}>
            {sourceroot?.status === "bound" ? "BOUND" : sourceroot?.status === "error" ? "ERROR" : "PENDING"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 font-mono text-[10px] text-muted-foreground">
          <span>Account: <span className="text-foreground">Jonathan Sherman — OCSO-S1AF-GOV-1</span></span>
          <span>File: <span className="text-foreground">{sourceroot?.filename ?? "s1af-sovereign-sourceroot-v1.md"}</span></span>
          <span>File ID: <span className="text-primary">{sourceroot?.fileId ?? (sourceroot?.status === "bound" ? "…" : "pending upload")}</span></span>
          <span>Injected: <span className="text-foreground">every kimiComplete() call</span></span>
          {sourceroot?.uploadedAt && (
            <span className="col-span-2">Bound at: <span className="text-foreground">{sourceroot.uploadedAt.slice(0, 19).replace("T", " ")} UTC</span></span>
          )}
        </div>
        <div className="mt-4 flex items-center gap-4 flex-wrap">
          <button
            onClick={pullSourceroot}
            disabled={pulling}
            className="flex items-center gap-2 px-4 py-2 border border-primary/40 text-primary font-mono text-[10px] uppercase tracking-widest hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${pulling ? "animate-spin" : ""}`} />
            {pulling ? "Pulling from Kimi 2.6…" : "Pull from Kimi 2.6"}
          </button>
          {pullResult && (
            pullResult.ok
              ? <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#00ff66] uppercase tracking-widest">
                  <CheckCircle2 className="w-3 h-3" /> Sourceroot {pullResult.status ?? "refreshed"}
                </span>
              : <span className="flex items-center gap-1.5 font-mono text-[10px] text-red-400 uppercase tracking-widest">
                  <AlertTriangle className="w-3 h-3" /> {pullResult.error ?? "Pull failed"}
                </span>
          )}
        </div>
        <div className="mt-3 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          Sovereign context bound exclusively to your Kimi account · No other account can access this context
        </div>
      </div>

      {/* Intake Filter Stats */}
      <div className="border border-primary/20 bg-card p-6">
        <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
          <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" /> Sentient Intake Filter
          </h2>
          <span className="font-mono text-[10px] text-primary uppercase tracking-widest">
            {intake ? `${Math.round((intake.passRate ?? 1) * 100)}% PASS RATE` : "COMPUTING…"}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Processed", value: intake?.processed ?? 0, color: "text-foreground" },
            { label: "Passed",    value: intake?.passed    ?? 0, color: "text-[#00ff66]"  },
            { label: "Flagged",   value: intake?.flagged   ?? 0, color: "text-[#ffb000]"  },
            { label: "Blocked",   value: intake?.blocked   ?? 0, color: "text-red-400"    },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <div className={`font-mono text-2xl font-bold ${color}`}>{value}</div>
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-1">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          Only beneficial AI signals reach you · Non-beneficial content is blocked at the sovereign boundary
        </div>
      </div>

      {/* AARTE — Apple AI Decision Engine */}
      {(() => {
        const last = aarteStatus?.lastAnalysis;
        const c = last ? AARTE_COLORS[last.decision] : AARTE_COLORS["review"];
        return (
          <div className={`border p-6 ${last ? `${c.border} ${c.bg}` : "border-border bg-card"}`}>
            <div className="flex items-center justify-between mb-4 border-b border-current/10 pb-2">
              <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                Apple AI Decision Engine — AARTE
              </h2>
              <span className={`font-mono text-[10px] uppercase tracking-widest font-bold ${last ? c.text : "text-muted-foreground"}`}>
                {last ? last.decision.toUpperCase() : "STANDBY"}
              </span>
            </div>
            {last ? (
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Decision</div>
                  <div className={`font-mono text-xl font-bold uppercase ${c.text}`}>{last.decision}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Auto-Deploy Gate</div>
                  <div className={`font-mono text-xl font-bold ${last.shouldDeploy ? "text-[#00ff66]" : "text-[#ff003c]"}`}>
                    {last.shouldDeploy ? "CLEARED" : "BLOCKED"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Optimal Quantum Backend</div>
                  <div className="font-mono text-sm text-foreground">{last.optimalBackend || "—"}</div>
                  <div className="font-mono text-[10px] text-muted-foreground mt-1">
                    Last: {last.timestamp.slice(11, 19)} UTC
                  </div>
                </div>
              </div>
            ) : (
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest py-2">
                No analysis yet — run a build in Intelligence Dispatch to activate AARTE
              </div>
            )}
          </div>
        );
      })()}

      {/* Platform Coverage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          {
            id: "ios",
            name: "iOS",
            icon: Smartphone,
            accent: "border-cyan-500/30",
            iconColor: "text-cyan-400",
            label: "iPhone XR — Hardware Locked",
            target: "Deployment Target: iOS 16.0+",
            lock: "DeviceGuard + Face ID",
            status: "armed",
          },
          {
            id: "macos",
            name: "macOS",
            icon: Monitor,
            accent: "border-violet-500/30",
            iconColor: "text-violet-400",
            label: "Local Mac — Native Process",
            target: "Deployment Target: macOS 14.0+",
            lock: "Touch ID / Password",
            status: "armed",
          },
        ].map(({ id, name, icon: Icon, accent, iconColor, label, target, lock, status }) => (
          <div key={id} className={`border ${accent} bg-card p-5 flex items-center gap-5`}>
            <div className="w-12 h-12 bg-background border border-border flex items-center justify-center shrink-0">
              <Icon className={`w-6 h-6 ${iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1.5">
                <span className="font-mono font-bold text-sm uppercase tracking-widest text-foreground">{name}</span>
                <StatusBadge status={status} />
              </div>
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{label}</div>
              <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{target} · {lock}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
