import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

function safeReadDirs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

export async function GET() {
  const root = (process.env.H5P_ROOT ?? "");
  const dirs = safeReadDirs(root);

  const ids = dirs
    .filter((name) => name && !name.startsWith("_")) // ignore _player
    .filter((name) => fs.existsSync(path.join(root, name, "h5p.json")))
    .sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ ids });
}

