import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { defaultHostLogPath } from "../../src/host/host-log.ts";
import { refreshCodexCatalog } from "../../src/host/runtime.ts";
import { createAuthStorage } from "../../src/providers/auth-storage.ts";

const fixture: unknown = JSON.parse(readFileSync(
    new URL("../fixtures/codex-models-cache.json", import.meta.url),
    "utf8",
));
const directories: string[] = [];

function scratch(): string {
    const directory = mkdtempSync(join(tmpdir(), "vera-codex-outcome-"));
    directories.push(directory);
    return directory;
}

function signedIn(directory: string) {
    const authStorage = createAuthStorage({ path: join(directory, "auth.json") });
    authStorage.setCredential("openai-codex", {
        type: "oauth",
        token: JSON.stringify({
            schema_version: 1,
            access_token: "access-1",
            refresh_token: "refresh-1",
            expires_at: Date.now() + 3_600_000,
            account_id: "account-1",
        }),
    });
    return authStorage;
}

const answering = (response: () => Response) =>
    (async () => response()) as unknown as typeof globalThis.fetch;

afterEach(() => {
    while (directories.length > 0) {
        rmSync(directories.pop()!, { recursive: true, force: true });
    }
});

test("a signed-out Codex is left out of the refresh report", async () => {
    const directory = scratch();
    expect(await refreshCodexCatalog(
        createAuthStorage({ path: join(directory, "auth.json") }),
        { cacheDir: directory, fetch: answering(() => Response.json(fixture)) },
    )).toBeUndefined();
});

test("a Codex refresh reports its model count, and a failure keeps and counts the saved list", async () => {
    const directory = scratch();
    const authStorage = signedIn(directory);

    const fetched = await refreshCodexCatalog(authStorage, {
        cacheDir: directory, fetch: answering(() => Response.json(fixture)),
    });
    expect(fetched?.provider).toBe("openai-codex");
    expect(fetched?.models).toBeGreaterThan(0);

    const failed = await refreshCodexCatalog(authStorage, {
        cacheDir: directory, fetch: answering(() => new Response("down", { status: 503 })),
    });
    expect(failed).toEqual({ provider: "openai-codex", failure: "unavailable", keptModels: fetched!.models! });

    const log = defaultHostLogPath();
    expect(existsSync(log)).toBe(true);
    const last = readFileSync(log, "utf8").trim().split("\n").at(-1)!;
    expect(JSON.parse(last)).toMatchObject({ type: "codex_catalog_refresh_failed", failure: "unavailable" });
});
