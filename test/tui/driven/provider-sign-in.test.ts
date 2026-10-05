import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startTuiTestSession } from "../../support/tui-harness.ts";
import { createTuiCatalogRefreshDependencies } from "../../support/tui-catalog-refresh-child.ts";
import type { ClientCommand } from "../../../src/engine/protocol.ts";

test("signing in to a provider asks for its model list", async () => {
    const commands: ClientCommand[] = [];
    let finishSignIn = () => {};
    const session = await startTuiTestSession({
        home: mkdtempSync(join(tmpdir(), "vera-provider-sign-in-")),
        width: 120,
        height: 36,
        dependencies: () => ({
            ...createTuiCatalogRefreshDependencies({
                onCommand: (command) => commands.push(command),
            }),
            loginProvider: async (_providerId, onBrowserUnavailable) => {
                onBrowserUnavailable("https://auth.example/crow-sign-in");
                await new Promise<void>((resolve) => finishSignIn = resolve);
            },
        }),
    });
    try {
        await session.waitForVisiblePane("Start a conversation");
        session.sendKey("C-p");
        await session.waitForVisiblePane("Commands");
        session.sendText("configure providers");
        await session.waitForVisiblePane("Configure providers");
        session.sendKey("Enter");
        await session.waitForVisiblePane("API keys");
        session.sendText("codex");
        await session.settle();
        session.sendKey("Enter");
        await session.waitForVisiblePane("Set this provider up and read its catalog");
        session.sendKey("Enter");
        // The list stays open and the row reports the sign-in in progress.
        await session.waitForVisiblePane("signing in…");
        expect(session.captureVisiblePane()).toContain("Configure providers");
        finishSignIn();
        await session.waitForVisiblePane("Signed in to OpenAI Codex");
        await session.settle();
        expect(session.captureVisiblePane()).not.toContain("signing in…");
        await session.waitForVisiblePane("Sign in to OpenAI Codex here: https://auth.example/crow-sign-in");
        expect(
            commands.filter((command) => command.type === "catalog_refresh"),
        ).toMatchObject([
            { type: "catalog_refresh", provider: "openai-codex" },
        ]);
    } finally {
        await session.close();
    }
}, 15_000);
