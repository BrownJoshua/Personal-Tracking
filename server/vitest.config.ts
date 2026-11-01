import { defineConfig } from "vitest/config";

const env = {
  NODE_ENV: "test",
  MONGODB_URI: "mongodb://127.0.0.1:27017/unused-in-unit-tests",
  JWT_ACCESS_SECRET: "test-secret-test-secret-test-secret-0123456789",
  BCRYPT_ROUNDS: "4",
};

export default defineConfig({
  test: {
    environment: "node",
    env,
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["test/unit/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["test/integration/**/*.test.ts"],
          // Starts one MongoDB for the run: MONGO_TEST_URI if set, otherwise mongodb-memory-server.
          globalSetup: ["./test/integration/globalSetup.ts"],
          fileParallelism: false,
          testTimeout: 20000,
          hookTimeout: 120000,
        },
      },
    ],
  },
});
