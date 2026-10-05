// Colors mirror the default TUI theme; src/ cannot import from clients/.
const PAGE_BACKGROUND = "#111111";
const CARD_BACKGROUND = "#181818";
const CARD_BORDER = "#222222";
const TEXT = "#c6c6c6";
const MUTED = "#808080";
const ACCENT = "#EC5B2B";
const SUCCESS = "#8CC265";
const DANGER = "#FF5F56";

export interface OAuthCallbackPage {
    readonly ok: boolean;
    readonly title: string;
    readonly detail: string;
    readonly status?: number;
}

function escapeHtml(text: string): string {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

export function oauthCallbackHtml(page: OAuthCallbackPage): string {
    const title = escapeHtml(page.title);
    const detail = escapeHtml(page.detail);
    const mark = page.ok ? "✓" : "!";
    const markColor = page.ok ? SUCCESS : DANGER;
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vera · ${title}</title>
<style>
    html, body { margin: 0; height: 100%; }
    body {
        background: ${PAGE_BACKGROUND};
        color: ${TEXT};
        font: 15px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        box-sizing: border-box;
    }
    main {
        background: ${CARD_BACKGROUND};
        border: 1px solid ${CARD_BORDER};
        border-radius: 8px;
        padding: 32px 36px;
        max-width: 440px;
        width: 100%;
        box-sizing: border-box;
    }
    .brand { color: ${ACCENT}; font-weight: 600; letter-spacing: 0.04em; margin: 0 0 24px; }
    h1 { font-size: 20px; font-weight: 600; margin: 0 0 12px; color: #ffffff; }
    .mark { color: ${markColor}; margin-right: 10px; }
    p { margin: 0; color: ${MUTED}; }
</style>
</head>
<body>
<main>
    <p class="brand">vera</p>
    <h1><span class="mark">${mark}</span>${title}</h1>
    <p>${detail}</p>
</main>
</body>
</html>
`;
}

export function oauthCallbackResponse(page: OAuthCallbackPage): Response {
    return new Response(oauthCallbackHtml(page), {
        status: page.status ?? (page.ok ? 200 : 400),
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}
