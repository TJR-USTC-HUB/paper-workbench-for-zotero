import { afterEach, describe, expect, it, vi } from "vitest";

import {
  detectOpenAIModelTransports,
  fetchOpenAIModels,
  testPresetConnectivity,
} from "../../src/modules/preset-utils";
import type { ModelPreset } from "../../src/settings/types";

const preset: ModelPreset = {
  id: "deepseek",
  label: "DeepSeek",
  provider: "openai",
  apiKey: "sk-test",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-v4-pro",
  models: ["deepseek-v4-flash", "deepseek-v4-pro"],
  maxTokens: 8192,
};

describe("preset connectivity protocol detection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["zh-CN", "连通性测试。只回复 OK。"],
    ["en-US", "Connectivity test. Reply OK only."],
  ])(
    "localizes the connectivity instruction for %s without changing its reply token",
    async (locale, instructions) => {
      vi.stubGlobal("Zotero", {
        locale: "en-US",
        Prefs: { get: () => locale },
      });
      let body: Record<string, unknown> | undefined;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          body = JSON.parse(String(init?.body)) as Record<string, unknown>;
          return new Response(null, { status: 200 });
        }),
      );

      await testPresetConnectivity(preset, new AbortController().signal);

      expect(body?.instructions).toBe(instructions);
      expect(body?.input).toEqual([{ role: "user", content: "Reply OK." }]);
    },
  );

  it("prefers Responses then saves Chat Completions when the model rejects Responses", async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        requests.push({
          url,
          body: JSON.parse(String(init?.body)) as Record<string, unknown>,
        });
        if (url.endsWith("/responses")) {
          return new Response(
            JSON.stringify({
              error: {
                message:
                  "Codex integration with deepseek-v4-pro will be available starting early August 2026. Please use deepseek-v4-flash instead for now.",
                type: "invalid_request_error",
                code: "invalid_request_error",
              },
            }),
            { status: 400 },
          );
        }
        if (url.endsWith("/chat/completions")) {
          return new Response(JSON.stringify({ choices: [] }), { status: 200 });
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );

    const result = await testPresetConnectivity(
      preset,
      new AbortController().signal,
    );

    expect(requests.map(({ url }) => url)).toEqual([
      "https://api.deepseek.com/responses",
      "https://api.deepseek.com/chat/completions",
    ]);
    expect(requests.map(({ body }) => body.model)).toEqual([
      "deepseek-v4-pro",
      "deepseek-v4-pro",
    ]);
    expect(result.preset.extras?.openaiChatCompletionsModels).toEqual([
      "deepseek-v4-pro",
    ]);
    expect(result.preset.extras?.openaiUseChatCompletions).toBeUndefined();
    expect(result.message).toContain("已切换为 Chat Completions");
  });

  it("detects the transport for every model when a configuration is added", async () => {
    const requests: Array<{ url: string; model: unknown }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        requests.push({ url, model: body.model });
        if (url.endsWith("/responses") && body.model === "deepseek-v4-flash") {
          return new Response(null, { status: 200 });
        }
        if (url.endsWith("/responses") && body.model === "deepseek-v4-pro") {
          return new Response(
            JSON.stringify({
              error: {
                message:
                  "Codex integration with deepseek-v4-pro will be available later. Please use deepseek-v4-flash instead for now.",
              },
            }),
            { status: 400 },
          );
        }
        if (
          url.endsWith("/chat/completions") &&
          body.model === "deepseek-v4-pro"
        ) {
          return new Response(null, { status: 200 });
        }
        throw new Error(`Unexpected request: ${url} / ${String(body.model)}`);
      }),
    );

    const detected = await detectOpenAIModelTransports(
      preset,
      new AbortController().signal,
    );

    expect(requests).toEqual([
      {
        url: "https://api.deepseek.com/responses",
        model: "deepseek-v4-flash",
      },
      {
        url: "https://api.deepseek.com/responses",
        model: "deepseek-v4-pro",
      },
      {
        url: "https://api.deepseek.com/chat/completions",
        model: "deepseek-v4-pro",
      },
    ]);
    expect(detected.model).toBe("deepseek-v4-pro");
    expect(detected.extras?.openaiChatCompletionsModels).toEqual([
      "deepseek-v4-pro",
    ]);
  });

  it("does not hide authentication errors behind a Chat Completions fallback", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(String(input));
        return new Response(
          JSON.stringify({
            error: { message: "Invalid API key", type: "authentication_error" },
          }),
          { status: 401 },
        );
      }),
    );

    await expect(
      testPresetConnectivity(preset, new AbortController().signal),
    ).rejects.toThrow("HTTP 401");
    expect(urls).toEqual(["https://api.deepseek.com/responses"]);
  });

  it("discovers, normalizes, deduplicates, and sorts OpenAI-compatible models", async () => {
    const request = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe("https://relay.example/v1/models");
        expect(init?.method).toBe("GET");
        expect(init?.headers).toEqual({ Authorization: "Bearer secret-key" });
        return new Response(
          JSON.stringify({
            data: [
              { id: "gpt-6.1-sol" },
              { id: " model-10 " },
              { id: "model-2" },
              { id: "gpt-6.1-sol" },
              { id: "" },
              null,
            ],
          }),
          { status: 200 },
        );
      },
    );
    vi.stubGlobal("fetch", request);

    await expect(
      fetchOpenAIModels(
        "https://relay.example/v1/",
        "secret-key",
        new AbortController().signal,
      ),
    ).resolves.toEqual(["gpt-6.1-sol", "model-2", "model-10"]);
    expect(request).toHaveBeenCalledOnce();
  });

  it("does not append a second models segment", async () => {
    const request = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://relay.example/v1/models");
      return new Response(JSON.stringify({ data: [{ id: "gpt-test" }] }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", request);

    await expect(
      fetchOpenAIModels(
        "https://relay.example/v1/models/",
        "secret-key",
        new AbortController().signal,
      ),
    ).resolves.toEqual(["gpt-test"]);
  });

  it("reports model discovery failures without exposing the API key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: "secret-key must not be echoed" }),
            { status: 401 },
          ),
      ),
    );

    const error = await fetchOpenAIModels(
      "https://relay.example/v1",
      "secret-key",
      new AbortController().signal,
    ).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("HTTP 401");
    expect((error as Error).message).not.toContain("secret-key");
  });

  it("rejects empty or malformed model lists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ data: [{ id: "" }, {}] }), {
            status: 200,
          }),
      ),
    );

    await expect(
      fetchOpenAIModels(
        "https://relay.example/v1",
        "secret-key",
        new AbortController().signal,
      ),
    ).rejects.toThrow("接口未返回可用模型");
  });
});
