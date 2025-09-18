import { NextResponse } from "next/server";

import { readJsonFile, writeJsonFile } from "@/lib/storage";
import { styleCategorySchema } from "@/lib/validators";
import type { StyleStore } from "@/types";

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

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (id === "default") {
      return NextResponse.json({ message: "默认分类不可编辑" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = styleCategorySchema.parse(body);

    const store = await readJsonFile<StyleStore>("styles.json", DEFAULT_STYLE_STORE);
    const category = store.categories.find((cat) => cat.id === id);
    if (!category) {
      return NextResponse.json({ message: "分类不存在" }, { status: 404 });
    }

    category.name = parsed.name;
    category.description = parsed.description;

    await writeJsonFile("styles.json", store);

    return NextResponse.json(category);
  } catch (error: unknown) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "更新分类失败" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (id === "default") {
    return NextResponse.json({ message: "默认分类不可删除" }, { status: 400 });
  }

  const store = await readJsonFile<StyleStore>("styles.json", DEFAULT_STYLE_STORE);
  const idx = store.categories.findIndex((cat) => cat.id === id);
  if (idx === -1) {
    return NextResponse.json({ message: "分类不存在" }, { status: 404 });
  }

  store.categories.splice(idx, 1);
  store.styles = store.styles.map((style) =>
    style.categoryId === id ? { ...style, categoryId: "default" } : style,
  );

  await writeJsonFile("styles.json", store);

  return NextResponse.json({ success: true });
}
