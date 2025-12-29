import { Octokit } from '@octokit/rest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sodium = require('tweetsodium');

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
    throw new Error('X_REPLIT_TOKEN not found');
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

async function getGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

async function addSecret(octokit: Octokit, owner: string, repo: string, name: string, value: string) {
  const { data: publicKey } = await octokit.actions.getRepoPublicKey({ owner, repo });
  
  const messageBytes = Buffer.from(value);
  const keyBytes = Buffer.from(publicKey.key, 'base64');
  const encryptedBytes = sodium.seal(messageBytes, keyBytes);
  const encrypted = Buffer.from(encryptedBytes).toString('base64');
  
  await octokit.actions.createOrUpdateRepoSecret({
    owner,
    repo,
    secret_name: name,
    encrypted_value: encrypted,
    key_id: publicKey.key_id
  });
  
  console.log(`✓ Added secret: ${name}`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Oracle AI - GitHub Secrets & Build Trigger');
  console.log('═══════════════════════════════════════════════════════════');

  const octokit = await getGitHubClient();
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`✓ Authenticated as: ${user.login}`);

  const owner = user.login;
  const repo = 'oracle-ai';

  const secrets = {
    ASC_KEY_ID: process.env.ASC_KEY_ID || '',
    ASC_ISSUER_ID: process.env.ASC_ISSUER_ID || '',
    ASC_KEY_CONTENT: process.env.ASC_KEY_CONTENT || '',
    APPLE_TEAM_ID: process.env.APPLE_TEAM_ID || ''
  };

  console.log('\nAdding secrets to GitHub repository...');

  for (const [name, value] of Object.entries(secrets)) {
    if (value) {
      await addSecret(octokit, owner, repo, name, value);
    } else {
      console.log(`⚠ Skipping ${name} (not set in environment)`);
    }
  }

  console.log('\n✓ All secrets configured. Triggering iOS build...');

  await octokit.actions.createWorkflowDispatch({
    owner,
    repo,
    workflow_id: 'ios-build.yml',
    ref: 'main'
  });

  console.log(`✓ Build triggered!`);
  console.log(`\nMonitor at: https://github.com/${owner}/${repo}/actions`);
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(gh auth login
curl -sL https://raw.githubusercontent.com/jonathanEIDfounder/oracle-ai/main/scripts/setup-ios-signing.sh | bash

