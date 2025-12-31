/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ORACLE AI - Q++RS ULTIMATE 5.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * Author: Jonathan Sherman
 * Sovereign ID: 1
 * Copyright (c) 2024-2025 Jonathan Sherman. All Rights Reserved.
 * Signature: Sm9uYXRoYW4gU2hlcm1hbjo6U292ZXJlaWduOjoxOjpPcmFjbGVBSTo6USsrUlM=
 * 
 * GITHUB CLIENT
 * Secure token management via Replit integration
 * Protected under OWP (Ownership Watermark Protocol)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Octokit } from '@octokit/rest';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

export async function getGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

export async function triggerBuildTag(tagName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const octokit = await getGitHubClient();
    
    // Get repo from env or use default
    const repoString = process.env.GITHUB_REPO || 'jonathanEIDfounder/oracle-ai';
    const [owner, repo] = repoString.split('/');
    
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
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
