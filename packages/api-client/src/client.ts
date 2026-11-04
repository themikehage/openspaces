import type { ApprovalDecision } from "@openspaces/core";
import {
  adapterInfoSchema,
  sessionSchema,
  type AdapterInfoDto,
  type CreateSessionRequest,
  type SessionDto,
} from "@openspaces/protocol";
import { z } from "zod";
import { request } from "./http.js";

const sessionsResponse = z.object({ sessions: z.array(sessionSchema) });
const adaptersResponse = z.object({ adapters: z.array(adapterInfoSchema) });
const projectsResponse = z.object({ projects: z.array(z.string()) });

export interface OpenSpacesClient {
  listSessions(signal?: AbortSignal): Promise<SessionDto[]>;
  getSession(id: string, signal?: AbortSignal): Promise<SessionDto>;
  createSession(input: CreateSessionRequest): Promise<SessionDto>;
  prompt(id: string, text: string): Promise<void>;
  interrupt(id: string): Promise<void>;
  resolveApproval(id: string, approvalId: string, decision: ApprovalDecision): Promise<void>;
  resumeSession(id: string): Promise<SessionDto>;
  closeSession(id: string): Promise<void>;
  listAdapters(signal?: AbortSignal): Promise<AdapterInfoDto[]>;
  listProjects(signal?: AbortSignal): Promise<string[]>;
}

export function createClient(baseUrl = ""): OpenSpacesClient {
  const call = <T>(path: string, schema: z.ZodType<T> | undefined, options = {}) =>
    request<T>(baseUrl, path, schema, options);
  const enc = encodeURIComponent;
  return {
    listSessions: async (signal) =>
      (await call("/api/sessions", sessionsResponse, { ...(signal ? { signal } : {}) })).sessions,
    getSession: (id, signal) =>
      call(`/api/sessions/${enc(id)}`, sessionSchema, { ...(signal ? { signal } : {}) }),
    createSession: (input) => call("/api/sessions", sessionSchema, { method: "POST", body: input }),
    prompt: async (id, text) => {
      await call(`/api/sessions/${enc(id)}/prompt`, undefined, { method: "POST", body: { text } });
    },
    interrupt: async (id) => {
      await call(`/api/sessions/${enc(id)}/interrupt`, undefined, { method: "POST" });
    },
    resolveApproval: async (id, approvalId, decision) => {
      await call(`/api/sessions/${enc(id)}/approvals/${enc(approvalId)}`, undefined, {
        method: "POST",
        body: { decision },
      });
    },
    resumeSession: (id) =>
      call(`/api/sessions/${enc(id)}/resume`, sessionSchema, { method: "POST" }),
    closeSession: async (id) => {
      await call(`/api/sessions/${enc(id)}`, undefined, { method: "DELETE" });
    },
    listAdapters: async (signal) =>
      (await call("/api/adapters", adaptersResponse, { ...(signal ? { signal } : {}) })).adapters,
    listProjects: async (signal) =>
      (await call("/api/projects", projectsResponse, { ...(signal ? { signal } : {}) })).projects,
  };
}
