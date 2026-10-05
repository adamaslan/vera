import {
    readProviderCatalogSnapshot,
    writeProviderCatalogSnapshot,
} from "./catalog-cache.ts";
import type {
    CatalogModel,
    ProviderCatalog,
    ReasoningLevel,
} from "./catalog-shape.ts";
import {
    refreshRejectedOpenAICodexAuthorization,
    resolveOpenAICodexAuthorization,
    type OpenAICodexAuthorization,
    type OpenAICodexAuthorizationOptions,
} from "../providers/openai-codex-oauth.ts";

const PROVIDER = "openai-codex";
const DEFAULT_BASE_URL = "https://chatgpt.com/backend-api/codex";
// The server lists only models whose minimum client version is at or below
// this, so a model newer than it stays hidden until it is raised.
export const CODEX_CLIENT_VERSION = "99.0.0";

export interface CodexCatalogFetchOptions extends OpenAICodexAuthorizationOptions {
    readonly baseUrl?: string;
    readonly cacheDir?: string;
}

export function readCodexCatalog(cacheDir?: string): ProviderCatalog {
    return readProviderCatalogSnapshot(
        PROVIDER,
        cacheDir === undefined ? {} : { cacheDir },
    );
}

// Throws when the request fails, so a failed refresh never replaces the saved list.
export async function fetchCodexCatalog(
    options: CodexCatalogFetchOptions = {},
): Promise<ProviderCatalog> {
    const fetchRequest = options.fetch ?? globalThis.fetch;
    const url = `${options.baseUrl ?? DEFAULT_BASE_URL}/models?client_version=${CODEX_CLIENT_VERSION}`;
    const send = (authorization: OpenAICodexAuthorization): Promise<Response> => {
        const headers: Record<string, string> = {
            Authorization: `Bearer ${authorization.accessToken}`,
            Accept: "application/json",
            originator: "vera",
        };
        if (authorization.accountId !== undefined) {
            headers["chatgpt-account-id"] = authorization.accountId;
        }
        return fetchRequest(url, { headers, signal: AbortSignal.timeout(10_000) });
    };

    const authorization = await resolveOpenAICodexAuthorization(options);
    let response = await send(authorization);
    if (response.status === 401) {
        response = await send(await refreshRejectedOpenAICodexAuthorization(
            authorization.accessToken,
            options,
        ));
    }
    if (!response.ok) {
        throw new Error(`OpenAI Codex models returned ${response.status}`);
    }

    const catalog = {
        ...normalizeCodexModelCache(await response.json()),
        fetched_at: new Date().toISOString(),
    };
    if (catalog.models.length === 0) {
        throw new Error("OpenAI Codex listed no models");
    }
    writeProviderCatalogSnapshot(
        catalog,
        options.cacheDir === undefined ? {} : { cacheDir: options.cacheDir },
    );
    return catalog;
}

export function normalizeCodexModelCache(raw: unknown): ProviderCatalog {
    try {
        if (!isRecord(raw) || !Array.isArray(raw.models)) {
            return emptyCatalog();
        }

        const models: CatalogModel[] = [];
        for (const value of raw.models) {
            const model = normalizeModel(value);
            if (model !== undefined) {
                models.push(model);
            }
        }

        return {
            schema_version: 2,
            provider: PROVIDER,
            ...(typeof raw.fetched_at === "string"
                ? { fetched_at: raw.fetched_at }
                : {}),
            models,
        };
    } catch {
        return emptyCatalog();
    }
}

function normalizeModel(value: unknown): CatalogModel | undefined {
    if (
        !isRecord(value)
        || typeof value.slug !== "string"
        || typeof value.display_name !== "string"
        || value.visibility === "hide"
    ) {
        return undefined;
    }

    return {
        id: value.slug,
        label: value.display_name,
        ...(typeof value.description === "string"
            ? { description: value.description }
            : {}),
        ...(typeof value.priority === "number"
            ? { order: value.priority }
            : {}),
        ...(typeof value.context_window === "number"
            ? { context_window: value.context_window }
            : {}),
        ...(typeof value.default_reasoning_level === "string"
            ? { default_level: value.default_reasoning_level }
            : {}),
        levels: normalizeLevels(value.supported_reasoning_levels),
    };
}

function normalizeLevels(value: unknown): ReasoningLevel[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const levels: ReasoningLevel[] = [];
    for (const entry of value) {
        if (!isRecord(entry) || typeof entry.effort !== "string") {
            continue;
        }
        levels.push({
            id: entry.effort,
            label: reasoningLevelLabel(entry.effort),
            ...(typeof entry.description === "string"
                ? { description: entry.description }
                : {}),
        });
    }
    return levels.reverse();
}

function reasoningLevelLabel(id: string): string {
    if (id === "xhigh") {
        return "Extra High";
    }
    return id
        .split(/[-_]/)
        .filter((part) => part.length > 0)
        .map((part) => part[0]!.toUpperCase() + part.slice(1))
        .join(" ");
}

function emptyCatalog(): ProviderCatalog {
    return {
        schema_version: 2,
        provider: PROVIDER,
        models: [],
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
