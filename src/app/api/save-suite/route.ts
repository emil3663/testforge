import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { join, relative } from "path";

const GENERATED_SUITES_DIR = join(process.cwd(), ".playwright-runs", "generated-suites");

function slugifyDescription(description: string) {
    const normalized = description
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);

    return normalized || "generated-best-practice-suite";
}

function extractSuiteTitles(code: string) {
    return [...code.matchAll(/test\.describe\('([^']+)'/g)].map((match) => match[1]);
}

export async function POST(req: NextRequest) {
    const { code, description } = await req.json().catch(() => ({}));

    if (!code || typeof code !== "string") {
        return NextResponse.json({ error: "code is required" }, { status: 400 });
    }

    if (!description || typeof description !== "string") {
        return NextResponse.json({ error: "description is required" }, { status: 400 });
    }

    const fileName = `${slugifyDescription(description)}.spec.ts`;
    const filePath = join(GENERATED_SUITES_DIR, fileName);
    const suiteTitles = extractSuiteTitles(code);

    await mkdir(GENERATED_SUITES_DIR, { recursive: true });
    await writeFile(filePath, `${code.trim()}\n`, "utf8");

    return NextResponse.json({
        fileName,
        filePath: relative(process.cwd(), filePath).replace(/\\/g, "/"),
        suiteTitles,
    });
}