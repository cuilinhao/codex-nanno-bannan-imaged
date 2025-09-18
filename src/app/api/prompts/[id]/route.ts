import { NextResponse } from "next/server";

import { readJsonFile, writeJsonFile } from "@/lib/storage";
import { promptSchema } from "@/lib/validators";
import type { PromptRecord, PromptStore } from "@/types";

const DEFAULT_PROMPT_STORE: PromptStore = {
  prompts: [],
};

function findPromptIndex(store: PromptStore, id: string) {
  return store.prompts.findIndex((item) => item.id === id);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = promptSchema.parse(body);
    const store = await readJsonFile<PromptStore>("prompts.json", DEFAULT_PROMPT_STORE);
    const idx = findPromptIndex(store, id);
    if (idx === -1) {
      return NextResponse.json({ message: "提示词不存在" }, { status: 404 });
    }

    const existing = store.prompts[idx];
    const updated: PromptRecord = {
      ...existing,
      number: parsed.number ?? existing.number,
      prompt: parsed.prompt ?? existing.prompt,
      status: parsed.status ?? existing.status,
      imageUrl: parsed.imageUrl ?? existing.imageUrl,
      errorMsg: parsed.errorMsg ?? existing.errorMsg,
      apiPlatform: parsed.apiPlatform ?? existing.apiPlatform,
      updatedAt: new Date().toISOString(),
    };

    store.prompts[idx] = updated;
    await writeJsonFile("prompts.json", store);

    return NextResponse.json(updated);
  } catch (error: unknown) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "更新提示词失败" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const store = await readJsonFile<PromptStore>("prompts.json", DEFAULT_PROMPT_STORE);
  const idx = findPromptIndex(store, id);
  if (idx === -1) {
    return NextResponse.json({ message: "提示词不存在" }, { status: 404 });
  }

  store.prompts.splice(idx, 1);
  await writeJsonFile("prompts.json", store);

  return NextResponse.json({ success: true });
}
