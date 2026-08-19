import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/**/*.test.ts",
      // oracle-ai deploy HMAC tests — exercises s1af-deploy.ts router directly
      "../../docs/oracle-ai/server/*.test.ts",
    ],
    // Set required env vars before any module (including CONFIG singleton) is imported
    env: {
      PORT: "3001",
      DEPLOY_SECRET: "test-deploy-secret-ok",
      SESSION_SECRET: "test-session-secret-xxxxx",
      MOONSHOT_API_KEY: "test-moonshot-key-xxxxx",
      GITHUB_PAT: "ghp_expired_initial_000000000000000",
    },
  },
});
