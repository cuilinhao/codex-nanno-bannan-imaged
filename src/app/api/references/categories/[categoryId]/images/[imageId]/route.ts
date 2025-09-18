import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

import { readJsonFile, writeJsonFile } from "@/lib/storage";
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

const REFERENCE_ROOT = path.join(process.cwd(), "public", "reference");

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ categoryId: string; imageId: string }> },
) {
  const { categoryId, imageId } = await context.params;
  const store = await readJsonFile<ReferenceStore>(
    "references.json",
    DEFAULT_REFERENCE_STORE,
  );
  const category = store.categories.find((cat) => cat.id === categoryId);
  if (!category) {
    return NextResponse.json({ message: "分类不存在" }, { status: 404 });
  }

  const idx = category.images.findIndex((img) => img.id === imageId);
  if (idx === -1) {
    return NextResponse.json({ message: "参考图不存在" }, { status: 404 });
  }

  const [removed] = category.images.splice(idx, 1);
  await writeJsonFile("references.json", store);

  if (removed.sourceType === "upload") {
    const relativePath = removed.path.startsWith("/reference/")
      ? removed.path.replace("/reference/", "")
      : removed.path.replace(/^\//, "");
    const filePath = path.join(REFERENCE_ROOT, relativePath);
    try {
      await fs.unlink(filePath);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn(`删除文件失败: ${filePath}`, error);
      }
    }
  }

  return NextResponse.json({ success: true });
}
