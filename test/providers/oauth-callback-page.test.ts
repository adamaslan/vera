import { expect, test } from "bun:test";

import { oauthCallbackHtml, oauthCallbackResponse } from "../../src/providers/oauth-callback-page.ts";

test("the sign-in page says what happened and where to go next", async () => {
    const response = oauthCallbackResponse({
        ok: true,
        title: "Signed in to ChatGPT",
        detail: "Return to Vera. You can close this tab.",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    const html = await response.text();
    expect(html).toContain("<title>Vera · Signed in to ChatGPT</title>");
    expect(html).toContain("Return to Vera. You can close this tab.");
    expect(html).toContain('name="viewport"');
});

test("a failed sign-in answers 400 and escapes what the provider sent", () => {
    const response = oauthCallbackResponse({
        ok: false,
        title: "Sign-in did not finish",
        detail: 'ChatGPT answered "<script>alert(1)</script>".',
    });
    const html = oauthCallbackHtml({ ok: false, title: "x", detail: "<b>&'\"" });

    expect(response.status).toBe(400);
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;&amp;&#39;&quot;");
});
