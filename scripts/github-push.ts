import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

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

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Oracle AI - GitHub Repository Sync');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    const octokit = await getGitHubClient();
    
    const { data: user } = await octokit.users.getAuthenticated();
    console.log(`\n✓ Authenticated as: ${user.login}`);

    const repoName = 'oracle-ai';
    
    let repo;
    try {
      const { data } = await octokit.repos.get({ owner: user.login, repo: repoName });
      repo = data;
      console.log(`✓ Repository exists: ${repo.html_url}`);
    } catch (e: any) {
      if (e.status === 404) {
        console.log('Creating repository...');
        const { data } = await octokit.repos.createForAuthenticatedUser({
          name: repoName,
          description: 'Oracle AI - Quantum Intelligence Platform',
          private: false,
          auto_init: false
        });
        repo = data;
        console.log(`✓ Repository created: ${repo.html_url}`);
      } else {
        throw e;
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Repository ready. Push using Git tab or run:');
    console.log(`  git remote add origin ${repo.clone_url}`);
    console.log('  git push -u origin main');
    console.log('═══════════════════════════════════════════════════════════');

  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
