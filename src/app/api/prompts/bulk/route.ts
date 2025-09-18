import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { writeJsonFile } from "@/lib/storage";
import type { PromptRecord, PromptStore } from "@/types";

const bulkSchema = z.object({
  items: z
    .array(
      z.object({
        number: z.string().optional(),
        prompt: z.string().min(1, "提示词不能为空"),
      }),
    )
    .max(5000, "一次导入最多 5000 条提示词"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = bulkSchema.parse(body);
    const now = new Date().toISOString();

    const prompts: PromptRecord[] = parsed.items.map((item) => ({
      id: crypto.randomUUID(),
      number: item.number ?? "",
      prompt: item.prompt,
      status: "等待中",
      createdAt: now,
      updatedAt: now,
    }));

    const store: PromptStore = { prompts };
    await writeJsonFile("prompts.json", store);

    return NextResponse.json(store, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "批量导入失败" },
      { status: 400 },
    );
  }
}
