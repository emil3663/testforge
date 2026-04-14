import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  const { code } = await req.json();

  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  // Write the generated test inside the project so @playwright/test can be resolved
  const runsDir = join(process.cwd(), ".playwright-runs");
  await mkdir(runsDir, { recursive: true });
  const testFile = join(runsDir, `test-${randomUUID()}.spec.ts`);

  try {
    await writeFile(testFile, code, "utf8");

    const start = Date.now();
    const playwrightBin = join(
      process.cwd(),
      "node_modules",
      ".bin",
      "playwright"
    );

    const { stdout, stderr } = await execFileAsync(
      playwrightBin,
      [
        "test",
        testFile,
        "--reporter=line",
        "--timeout=30000",
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          HOME: process.env.HOME ?? "/tmp",
        },
        timeout: 120_000,
      }
    ).catch((err: { stdout?: string; stderr?: string }) => ({
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
    }));

    const duration = Date.now() - start;
    const combined = [stdout, stderr].filter(Boolean).join("\n").trim();
    const passed =
      /\d+ passed/.test(combined) && !/ failed/.test(combined);

    return NextResponse.json({ passed, output: combined, duration });
  } finally {
    await unlink(testFile).catch(() => {});
  }
}
