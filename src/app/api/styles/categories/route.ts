import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { readJsonFile, writeJsonFile } from "@/lib/storage";
import { styleCategorySchema } from "@/lib/validators";
import type { StyleCategory, StyleStore } from "@/types";

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = styleCategorySchema.parse(body);
    const store = await readJsonFile<StyleStore>("styles.json", DEFAULT_STYLE_STORE);

    const duplicated = store.categories.find((cat) => cat.name === parsed.name);
    if (duplicated) {
      return NextResponse.json({ message: "分类名称已存在" }, { status: 400 });
    }

    const category: StyleCategory = {
      id: crypto.randomUUID(),
      name: parsed.name,
      description: parsed.description,
    };

    store.categories.push(category);
    await writeJsonFile("styles.json", store);

    return NextResponse.json(category, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "创建分类失败" },
      { status: 400 },
    );
  }
}
