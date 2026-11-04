import { createAcpAdapter } from "@openspaces/adapter-acp";
import type { AgentAdapter } from "@openspaces/core";
import { createDevinManifest } from "./manifest.js";

export function createDevinAdapter(binary?: string): AgentAdapter {
  return createAcpAdapter(createDevinManifest(binary));
}
