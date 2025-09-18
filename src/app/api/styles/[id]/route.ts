import { NextResponse } from "next/server";

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

function findStyleIndex(store: StyleStore, id: string) {
  return store.styles.findIndex((style) => style.id === id);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = styleEntrySchema.parse(body);
    const store = await readJsonFile<StyleStore>("styles.json", DEFAULT_STYLE_STORE);
    const idx = findStyleIndex(store, id);
    if (idx === -1) {
      return NextResponse.json({ message: "风格不存在" }, { status: 404 });
    }

    const exists = store.categories.some((cat) => cat.id === parsed.categoryId);
    if (!exists) {
      return NextResponse.json({ message: "分类不存在" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const updated: StyleEntry = {
      ...store.styles[idx],
      name: parsed.name,
      categoryId: parsed.categoryId,
      content: parsed.content,
      usageCount: parsed.usageCount ?? store.styles[idx].usageCount,
      updatedAt: now,
    };

    store.styles[idx] = updated;
    await writeJsonFile("styles.json", store);

    return NextResponse.json(updated);
  } catch (error: unknown) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "更新风格失败" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const store = await readJsonFile<StyleStore>("styles.json", DEFAULT_STYLE_STORE);
  const idx = findStyleIndex(store, id);
  if (idx === -1) {
    return NextResponse.json({ message: "风格不存在" }, { status: 404 });
  }

  store.styles.splice(idx, 1);
  await writeJsonFile("styles.json", store);

  return NextResponse.json({ success: true });
}
