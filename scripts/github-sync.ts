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

const IGNORE_PATTERNS = [
  'node_modules', '.git', '.cache', '.config', '.upm', 
  'ios/App/Pods', '.replit', 'replit.nix', '.breakpoints',
  '.env', '.env.local', 'package-lock.json'
];

function shouldIgnore(filePath: string): boolean {
  return IGNORE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function getAllFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const relativePath = path.relative(baseDir, fullPath);
    
    if (shouldIgnore(relativePath)) continue;
    
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else if (stat.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Oracle AI - Full GitHub Sync');
  console.log('═══════════════════════════════════════════════════════════');

  const octokit = await getGitHubClient();
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`✓ Authenticated as: ${user.login}`);

  const owner = user.login;
  const repo = 'oracle-ai';
  const branch = 'main';

  let isEmpty = false;
  try {
    await octokit.repos.getContent({ owner, repo, path: 'README.md' });
    console.log(`✓ Repository has content`);
  } catch (e: any) {
    if (e.status === 404) {
      isEmpty = true;
      console.log('Repository is empty, initializing...');
      
      await octokit.repos.createOrUpdateFileContents({
        owner, repo,
        path: 'README.md',
        message: 'Initial commit',
        content: Buffer.from('# Oracle AI\n\nQuantum Intelligence Platform').toString('base64'),
        branch
      });
      console.log('✓ Created initial commit');
    } else {
      throw e;
    }
  }

  const { data: ref } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const baseSha = ref.object.sha;

  const files = getAllFiles('.');
  console.log(`\nUploading ${files.length} files...`);

  const tree: { path: string; mode: '100644'; type: 'blob'; content: string }[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      tree.push({ path: file, mode: '100644', type: 'blob', content });
    } catch (e) {
      const content = fs.readFileSync(file).toString('base64');
      tree.push({ path: file, mode: '100644', type: 'blob', content });
    }
  }

  const { data: newTree } = await octokit.git.createTree({
    owner, repo, tree, base_tree: baseSha
  });

  const { data: commit } = await octokit.git.createCommit({
    owner, repo,
    message: 'Oracle AI - Full sync from Replit',
    tree: newTree.sha,
    parents: [baseSha]
  });

  await octokit.git.updateRef({
    owner, repo,
    ref: `heads/${branch}`,
    sha: commit.sha
  });

  console.log(`\n✓ Pushed ${files.length} files to https://github.com/${owner}/${repo}`);
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
