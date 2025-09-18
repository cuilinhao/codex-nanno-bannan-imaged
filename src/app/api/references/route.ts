import { NextResponse } from "next/server";

import { readJsonFile } from "@/lib/storage";
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

export async function GET() {
  const store = await readJsonFile<ReferenceStore>(
    "references.json",
    DEFAULT_REFERENCE_STORE,
  );
  return NextResponse.json(store);
}
