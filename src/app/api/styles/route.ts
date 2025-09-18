import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { readJsonFile, writeJsonFile } from "@/lib/storage";
import { styleEntrySchema } from "@/lib/validators";
import type { StyleEntry, StyleStore } from "@/types";

const DEFAULT_STYLE_STORE: StyleStore = {
  styles: [],
  categories: [
    {
      id: "default",
      name: "默认风格",
      description: "通用风格分类",
    },
  ],
};

export async function GET() {
  const store = await readJsonFile<StyleStore>("styles.json", DEFAULT_STYLE_STORE);
  return NextResponse.json(store);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = styleEntrySchema.parse(body);
    const store = await readJsonFile<StyleStore>("styles.json", DEFAULT_STYLE_STORE);

    const exists = store.categories.some((cat) => cat.id === parsed.categoryId);
    if (!exists) {
      return NextResponse.json({ message: "分类不存在" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const entry: StyleEntry = {
      id: crypto.randomUUID(),
      name: parsed.name,
      categoryId: parsed.categoryId,
      content: parsed.content,
      usageCount: parsed.usageCount ?? 0,
      createdAt: now,
      updatedAt: now,
    };

    store.styles.push(entry);
    await writeJsonFile("styles.json", store);

    return NextResponse.json(entry, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "创建风格失败" },
      { status: 400 },
    );
  }
}
