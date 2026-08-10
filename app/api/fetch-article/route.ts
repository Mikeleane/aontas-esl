import { NextResponse } from "next/server";
import { fetchExternalText } from "@/lib/server/fetchExternalText";
import { checkRateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, route: "fetch-article", method: "GET" }, { status: 200 });
}

export async function POST(req: Request) {
  const rate = checkRateLimit(req, { bucket: "fetch-article", limit: 30 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body in request." }, { status: 400 });
    }

    const url = String(body?.url || "").trim();
    if (!url) return NextResponse.json({ error: "Missing 'url' in request body." }, { status: 400 });

    let JSDOM: any;
    let Readability: any;
    try {
      const [{ JSDOM: J }, { Readability: R }] = await Promise.all([
        import("jsdom"),
        import("@mozilla/readability"),
      ]);
      JSDOM = J;
      Readability = R;
    } catch (error) {
      console.error("Failed to import jsdom/readability:", error);
      return NextResponse.json({ error: "Server HTML parsing is unavailable." }, { status: 500 });
    }

    let upstream;
    try {
      upstream = await fetchExternalText(url, {
        maxBytes: 2 * 1024 * 1024,
        timeoutMs: 12_000,
        headers: {
          "User-Agent": "AontasESL/1.0 (+article reader)",
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
        },
      });
    } catch (error: any) {
      return NextResponse.json({ error: error?.message || "Could not fetch article URL." }, { status: 400 });
    }

    if (upstream.status < 200 || upstream.status >= 300) {
      return NextResponse.json({ error: `Failed to fetch article (status ${upstream.status}).` }, { status: 502 });
    }
    if (!upstream.text.trim()) return NextResponse.json({ error: "Empty response from article URL." }, { status: 502 });

    const contentType = upstream.contentType.toLowerCase();
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml+xml") && !contentType.includes("text/plain")) {
      return NextResponse.json({ error: "That URL did not return a supported text/HTML document." }, { status: 415 });
    }

    if (contentType.includes("text/plain")) {
      return NextResponse.json({ title: null, text: upstream.text.trim() }, { status: 200 });
    }

    const dom = new JSDOM(upstream.text, { url: upstream.finalUrl });
    const article = new Readability(dom.window.document).parse();
    if (!article?.textContent?.trim()) {
      return NextResponse.json({ error: "Could not extract readable article text from that page. Try pasting the text manually." }, { status: 422 });
    }

    return NextResponse.json({ title: article.title ?? null, text: article.textContent.trim() }, { status: 200 });
  } catch (error) {
    console.error("fetch-article route error", error);
    return NextResponse.json({ error: "Unexpected error while fetching article." }, { status: 500 });
  }
}
