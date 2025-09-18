import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { readJsonFile, writeJsonFile } from "@/lib/storage";
import { referenceCategorySchema } from "@/lib/validators";
import type { ReferenceCategory, ReferenceStore } from "@/types";

const DEFAULT_REFERENCE_STORE: ReferenceStore = {
  categories: [
    {
      id: "default",
      name: "默认参考图",
      images: [],
    },
  ],
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = referenceCategorySchema.parse(body);

    const store = await readJsonFile<ReferenceStore>(
      "references.json",
      DEFAULT_REFERENCE_STORE,
    );

    const duplicated = store.categories.find((cat) => cat.name === parsed.name);
    if (duplicated) {
      return NextResponse.json({ message: "分类名称已存在" }, { status: 400 });
    }

    const category: ReferenceCategory = {
      id: crypto.randomUUID(),
      name: parsed.name,
      images: [],
    };

    store.categories.push(category);
    await writeJsonFile("references.json", store);

    return NextResponse.json(category, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "创建分类失败" },
      { status: 400 },
    );
  }
}
