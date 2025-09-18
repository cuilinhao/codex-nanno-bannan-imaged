import { promises as fs } from "fs";
import path from "path";
import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { readJsonFile, writeJsonFile } from "@/lib/storage";
import type { ReferenceImage, ReferenceStore } from "@/types";

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

async function ensureReferenceDir() {
  await fs.mkdir(REFERENCE_ROOT, { recursive: true });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ categoryId: string }> },
) {
  const { categoryId } = await context.params;
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const sourceType = String(formData.get("sourceType") ?? "upload");
  const description = String(formData.get("description") ?? "").trim();
  const url = formData.get("url");
  const file = formData.get("file");

  if (!name) {
    return NextResponse.json({ message: "参考图名称不能为空" }, { status: 400 });
  }

  const store = await readJsonFile<ReferenceStore>(
    "references.json",
    DEFAULT_REFERENCE_STORE,
  );
  const category = store.categories.find((cat) => cat.id === categoryId);
  if (!category) {
    return NextResponse.json({ message: "分类不存在" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  let record: ReferenceImage;

  if (sourceType === "url") {
    if (!url || typeof url !== "string") {
      return NextResponse.json({ message: "请输入有效的图片URL" }, { status: 400 });
    }

    record = {
      id,
      name,
      description,
      sourceType: "url",
      path: url,
      url,
      createdAt: now,
    };
  } else {
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "请上传图片文件" }, { status: 400 });
    }

    await ensureReferenceDir();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = path.extname(file.name) || ".png";
    const filename = `${id}${ext}`;
    const filePath = path.join(REFERENCE_ROOT, filename);
    await fs.writeFile(filePath, buffer);

    record = {
      id,
      name,
      description,
      sourceType: "upload",
      path: `/reference/${filename}`,
      createdAt: now,
    };
  }

  category.images.push(record);
  await writeJsonFile("references.json", store);

  return NextResponse.json(record, { status: 201 });
}
