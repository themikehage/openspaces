import { query, type Options, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

export type SdkMessageLike = { type: string } & Record<string, unknown>;

export interface ClaudeQuery extends AsyncIterable<SdkMessageLike> {
  interrupt(): Promise<unknown>;
  close(): void;
}

export interface QueryParams {
  prompt: AsyncIterable<SDKUserMessage>;
  options: Options;
}

export type QueryFn = (params: QueryParams) => ClaudeQuery;

export const sdkQuery: QueryFn = (params) => query(params) as unknown as ClaudeQuery;
