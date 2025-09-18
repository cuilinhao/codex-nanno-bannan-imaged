import { NextResponse } from "next/server";

import { readJsonFile, writeJsonFile } from "@/lib/storage";
import { referenceCategorySchema } from "@/lib/validators";
import type { ReferenceStore } from "@/types";

const DEFAULT_REFERENCE_STORE: ReferenceStore = {
  categories: [
    {
      id: "default",
      name: "默认参考图",
      images: [],
    },
  ],
};

export async function PUT(
  request: Request,
  context: { params: Promise<{ categoryId: string }> },
) {
  try {
    const { categoryId } = await context.params;
    if (categoryId === "default") {
      return NextResponse.json({ message: "默认分类不可编辑" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = referenceCategorySchema.parse(body);

    const store = await readJsonFile<ReferenceStore>(
      "references.json",
      DEFAULT_REFERENCE_STORE,
    );
    const category = store.categories.find((cat) => cat.id === categoryId);
    if (!category) {
      return NextResponse.json({ message: "分类不存在" }, { status: 404 });
    }

    category.name = parsed.name;
    await writeJsonFile("references.json", store);

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
  context: { params: Promise<{ categoryId: string }> },
) {
  const { categoryId } = await context.params;
  if (categoryId === "default") {
    return NextResponse.json({ message: "默认分类不可删除" }, { status: 400 });
  }

  const store = await readJsonFile<ReferenceStore>(
    "references.json",
    DEFAULT_REFERENCE_STORE,
  );
  const idx = store.categories.findIndex((cat) => cat.id === categoryId);
  if (idx === -1) {
    return NextResponse.json({ message: "分类不存在" }, { status: 404 });
  }

  const [removed] = store.categories.splice(idx, 1);
  await writeJsonFile("references.json", store);

  return NextResponse.json({ success: true, removed });
}
