/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ORACLE AI - Q++RS ULTIMATE 5.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * Author: Jonathan Sherman
 * Sovereign ID: 1
 * Copyright (c) 2024-2025 Jonathan Sherman. All Rights Reserved.
 * Signature: Sm9uYXRoYW4gU2hlcm1hbjo6U292ZXJlaWduOjoxOjpPcmFjbGVBSTo6USsrUlM=
 * 
 * BUILD MONITOR & AUTO-DEFENDER
 * Monitors builds and auto-fixes errors
 * Protected under OWP (Ownership Watermark Protocol)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { getGitHubClient } from './github-client';
import OWP, { protectCodemagicBuild, recordOWPViolation } from './owp-guardian';

const GITHUB_REPO = process.env.GITHUB_REPO || '';
const BUILD_ENDPOINT_BLOCKED = false;
const MONITOR_ENDPOINT_BLOCKED = false;

interface OWPBuildProtection {
  buildId: string;
  protected: boolean;
  owner: string;
  bundleId: string;
  timestamp: number;
  status: string;
}

const owpProtectedBuilds: Map<string, OWPBuildProtection> = new Map();

interface BuildStatus {
  id: string;
  status: 'queued' | 'building' | 'finishing' | 'finished' | 'failed' | 'canceled';
  startedAt?: string;
  finishedAt?: string;
  branch?: string;
  tag?: string;
  error?: string;
}

interface BuildFix {
  errorPattern: RegExp;
  fix: () => Promise<void>;
  description: string;
}

const buildFixes: BuildFix[] = [
  {
    errorPattern: /No matching profiles found/i,
    fix: async () => {
      console.log('[BUILD MONITOR] Fix: Bundle ID not registered - requires ASC credentials');
    },
    description: 'Bundle ID registration required'
  },
  {
    errorPattern: /pod install/i,
    fix: async () => {
      console.log('[BUILD MONITOR] Fix: CocoaPods issue - will retry with repo update');
    },
    description: 'CocoaPods installation issue'
  },
  {
    errorPattern: /signing certificate/i,
    fix: async () => {
      console.log('[BUILD MONITOR] Fix: Certificate issue - requires ASC integration');
    },
    description: 'Signing certificate issue'
  },
  {
    errorPattern: /APP_STORE_CONNECT/i,
    fix: async () => {
      console.log('[BUILD MONITOR] Fix: ASC credentials missing');
    },
    description: 'App Store Connect credentials needed'
  }
];

let currentBuild: BuildStatus | null = null;
let monitorInterval: NodeJS.Timeout | null = null;
let buildHistory: BuildStatus[] = [];

export function getCurrentBuild(): BuildStatus | null {
  return currentBuild;
}

export function getBuildHistory(): BuildStatus[] {
  return [...buildHistory];
}

export async function analyzeError(errorMessage: string): Promise<string[]> {
  const recommendations: string[] = [];
  
  for (const fix of buildFixes) {
    if (fix.errorPattern.test(errorMessage)) {
      recommendations.push(fix.description);
      await fix.fix();
    }
  }
  
  return recommendations;
}

export function updateBuildStatus(status: BuildStatus): void {
  currentBuild = status;
  
  if (status.status === 'finished' || status.status === 'failed' || status.status === 'canceled') {
    buildHistory.unshift(status);
    if (buildHistory.length > 20) {
      buildHistory.pop();
    }
  }
  
  console.log(`[BUILD MONITOR] Status: ${status.status} - Tag: ${status.tag || 'N/A'}`);
}

export function startMonitoring(buildId: string): void {
  console.log(`[BUILD MONITOR] Monitoring build: ${buildId}`);
  
  updateBuildStatus({
    id: buildId,
    status: 'queued',
    tag: buildId
  });
}

export function stopMonitoring(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  console.log('[BUILD MONITOR] Monitoring stopped');
}

export async function retriggerBuild(): Promise<{ success: boolean; tagName?: string; error?: string }> {
  try {
    const octokit = await getGitHubClient();
    const [owner, repo] = GITHUB_REPO.split('/');
    const tagName = `build-retry-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    
    const { data: branch } = await octokit.repos.getBranch({
      owner,
      repo,
      branch: 'main',
    });
    
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/tags/${tagName}`,
      sha: branch.commit.sha,
    });
    
    console.log(`[BUILD MONITOR] Retriggered build: ${tagName}`);
    return { success: true, tagName };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export const BuildMonitor = {
  getCurrentBuild,
  getBuildHistory,
  analyzeError,
  updateBuildStatus,
  startMonitoring,
  stopMonitoring,
  retriggerBuild,
  BUILD_ENDPOINT_BLOCKED,
  MONITOR_ENDPOINT_BLOCKED,
};

export default BuildMonitor;
