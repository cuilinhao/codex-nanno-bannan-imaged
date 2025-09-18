import { NextResponse } from "next/server";

import { readJsonFile, writeJsonFile } from "@/lib/storage";
import { configSchema } from "@/lib/validators";
import type { AppConfig } from "@/types";

const DEFAULT_CONFIG: AppConfig = {
  selectedKeyId: "",
  maxConcurrency: 5,
  retryCount: 2,
  saveDirectory: "public/generated",
  autoSaveBase64: true,
};

export async function GET() {
  const config = await readJsonFile<AppConfig>("config.json", DEFAULT_CONFIG);
  return NextResponse.json(config);
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = configSchema.parse(body);
    const config: AppConfig = {
      selectedKeyId: parsed.selectedKeyId ?? "",
      maxConcurrency: parsed.maxConcurrency,
      retryCount: parsed.retryCount,
      saveDirectory: parsed.saveDirectory,
      autoSaveBase64: parsed.autoSaveBase64,
    };
    await writeJsonFile("config.json", config);
    return NextResponse.json(config);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "配置更新失败",
      },
      { status: 400 },
    );
  }
}
