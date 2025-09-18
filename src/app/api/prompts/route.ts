import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { readJsonFile, writeJsonFile } from "@/lib/storage";
import { promptSchema } from "@/lib/validators";
import type { PromptRecord, PromptStore } from "@/types";

const DEFAULT_PROMPT_STORE: PromptStore = {
  prompts: [],
};

export async function GET() {
  const store = await readJsonFile<PromptStore>("prompts.json", DEFAULT_PROMPT_STORE);
  return NextResponse.json(store);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = promptSchema.parse(body);
    const store = await readJsonFile<PromptStore>("prompts.json", DEFAULT_PROMPT_STORE);
    const now = new Date().toISOString();

    const record: PromptRecord = {
      id: crypto.randomUUID(),
      number: parsed.number ?? "",
      prompt: parsed.prompt,
      status: parsed.status ?? "等待中",
      imageUrl: parsed.imageUrl,
      errorMsg: parsed.errorMsg,
      apiPlatform: parsed.apiPlatform,
      createdAt: now,
      updatedAt: now,
    };

    store.prompts.push(record);
    await writeJsonFile("prompts.json", store);

    return NextResponse.json(record, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "新增提示词失败" },
      { status: 400 },
    );
  }
}
