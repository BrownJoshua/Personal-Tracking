import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

/**
 * Provides a MongoDB URI to the integration tests.
 * - MONGO_TEST_URI set (e.g. a CI service container): use it.
 * - otherwise: start mongodb-memory-server (downloads a mongod binary on first run).
 */
export default async function setup(project: TestProject) {
  if (process.env.MONGO_TEST_URI) {
    project.provide("mongoUri", process.env.MONGO_TEST_URI);
    return;
  }
  const { MongoMemoryReplSet } = await import("mongodb-memory-server");
  const server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  project.provide("mongoUri", server.getUri());
  return async () => {
    await server.stop();
  };
}
