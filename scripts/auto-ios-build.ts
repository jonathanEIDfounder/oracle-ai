import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Oracle AI - Automated iOS Build Setup");
  console.log("═══════════════════════════════════════════════════════════");

  const [owner, repo] = (process.env.GITHUB_REPO || "").split("/");
  if (!owner || !repo) {
    console.log("Error: GITHUB_REPO not set");
    process.exit(1);
  }

  console.log(`\nRepository: ${owner}/${repo}`);

  try {
    const { data } = await octokit.repos.get({ owner, repo });
    console.log(`Status: ${data.private ? "Private" : "Public"}`);
    console.log(`URL: ${data.html_url}`);
    
    const { data: files } = await octokit.repos.getContent({ owner, repo, path: "" });
    const hasCodemagic = Array.isArray(files) && files.some(f => f.name === "codemagic.yaml");
    const hasIos = Array.isArray(files) && files.some(f => f.name === "ios");
    
    console.log(`\nBuild Files:`);
    console.log(`  codemagic.yaml: ${hasCodemagic ? "✓" : "✗"}`);
    console.log(`  ios/: ${hasIos ? "✓" : "✗"}`);

    if (hasCodemagic && hasIos) {
      console.log(`\n═══════════════════════════════════════════════════════════`);
      console.log(`  READY FOR iOS BUILD`);
      console.log(`═══════════════════════════════════════════════════════════`);
      console.log(`\nOne-time setup (2 minutes):`);
      console.log(`\n  1. Open: https://codemagic.io/apps`);
      console.log(`  2. Click "Add application"`);
      console.log(`  3. Select GitHub → ${owner}/${repo}`);
      console.log(`  4. Choose "codemagic.yaml" configuration`);
      console.log(`  5. Click "Start new build"`);
      console.log(`\nAfter first build, future builds trigger automatically on push.`);
      console.log(`\nApple credentials needed in Codemagic:`);
      console.log(`  - Team ID, App Store Connect API Key`);
      console.log(`  - These are entered in Codemagic UI (Settings → Integrations)`);
    } else {
      console.log(`\nMissing required files for iOS build.`);
    }
  } catch (error: any) {
    console.log(`Error: ${error.message}`);
  }
}

main();
