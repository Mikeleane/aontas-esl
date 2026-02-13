import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  const root = (process.env.H5P_ROOT ?? "");

  try {
    const dirents = await fs.readdir(root, { withFileTypes: true });
    const folders = dirents
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((name) => !name.startsWith("_"));

    const items = await Promise.all(
      folders.map(async (id) => {
        const h5pJsonPath = path.join(root, id, "h5p.json");
        try {
          const raw = await fs.readFile(h5pJsonPath, "utf8");
          const json = JSON.parse(raw);
          return {
            id,
            title: json?.title || undefined,
            mainLibrary: json?.mainLibrary || undefined,
          };
        } catch {
          return { id };
        }
      })
    );

    items.sort((a, b) => a.id.localeCompare(b.id));
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Could not read public/h5p folder", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}

