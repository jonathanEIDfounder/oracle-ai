import { Octokit } from "@octokit/rest";
import * as sodium from "tweetsodium";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = (process.env.GITHUB_REPO || "").split("/");

async function addSecret(name: string, value: string) {
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
  const secrets = {
    ASC_KEY_ID: process.env.ASC_KEY_ID || "",
    ASC_ISSUER_ID: process.env.ASC_ISSUER_ID || "",
    ASC_KEY_CONTENT: process.env.ASC_KEY_CONTENT || "",
    APPLE_TEAM_ID: process.env.APPLE_TEAM_ID || ""
  };
  
  console.log("Adding secrets to GitHub repository...");
  
  for (const [name, value] of Object.entries(secrets)) {
    if (value) {
      await addSecret(name, value);
    } else {
      console.log(`⚠ Skipping ${name} (not set)`);
    }
  }
  
  console.log("\n✓ All secrets configured. Triggering build...");
  
  await octokit.actions.createWorkflowDispatch({
    owner,
    repo,
    workflow_id: "ios-build.yml",
    ref: "main"
  });
  
  console.log("✓ Build triggered! Check: https://github.com/" + owner + "/" + repo + "/actions");
}

main().catch(console.error);
