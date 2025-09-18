"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Image from "next/image";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createReferenceCategory,
  deleteReferenceCategory,
  deleteReferenceImage,
  getReferenceStore,
  updateReferenceCategory,
  uploadReferenceImage,
} from "@/lib/api";
import type { ReferenceCategory, ReferenceImage, ReferenceStore } from "@/types";
import { Edit, FolderPlus, ImagePlus, Trash2 } from "lucide-react";

const fetchReferences = () => getReferenceStore();

const categorySchema = z.object({
  name: z.string().min(1, "请输入分类名称"),
});

const urlSchema = z.object({
  name: z.string().min(1, "请输入图片名称"),
  url: z.string().url("请输入有效的图片 URL"),
  description: z.string().optional(),
});

const uploadSchema = z.object({
  name: z.string().min(1, "请输入图片名称"),
  description: z.string().optional(),
});

interface CategoryDialogProps {
  trigger: React.ReactNode;
  mode: "create" | "edit";
  initialValue?: ReferenceCategory;
  onSubmit: (values: z.infer<typeof categorySchema>) => Promise<void>;
  disabled?: boolean;
}

function CategoryDialog({ trigger, mode, initialValue, onSubmit, disabled }: CategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: initialValue?.name ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      name: initialValue?.name ?? "",
    });
  }, [initialValue, form]);

  const handleSubmit = async (values: z.infer<typeof categorySchema>) => {
    await onSubmit(values);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !disabled && setOpen(value)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "新增分类" : "编辑分类"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={form.handleSubmit((values) => handleSubmit(values))}
        >
          <div className="grid gap-2">
            <Label htmlFor="reference-category-name">分类名称</Label>
            <Input
              id="reference-category-name"
              {...form.register("name")}
              disabled={disabled}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={disabled}>
              {mode === "create" ? "创建分类" : "保存修改"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ReferenceDialogProps {
  trigger: React.ReactNode;
  categoryId: string;
  onCreated: () => Promise<void>;
}

function ReferenceDialog({ trigger, categoryId, onCreated }: ReferenceDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const urlForm = useForm<z.infer<typeof urlSchema>>({
    resolver: zodResolver(urlSchema),
    defaultValues: {
      name: "",
      url: "",
      description: "",
    },
  });

  const uploadForm = useForm<z.infer<typeof uploadSchema>>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const [mode, setMode] = useState<"upload" | "url">("upload");

  const resetAll = () => {
    urlForm.reset();
    uploadForm.reset();
    setFile(null);
  };

  const handleSubmit = async () => {
    if (mode === "upload") {
      const valid = await uploadForm.trigger();
      if (!valid) return;
      if (!file) {
        toast.error("请先选择要上传的图片");
        return;
      }
      const values = uploadForm.getValues();
      await uploadReferenceImage(categoryId, {
        name: values.name,
        sourceType: "upload",
        description: values.description,
        file,
      });
    } else {
      const valid = await urlForm.trigger();
      if (!valid) return;
      const values = urlForm.getValues();
      await uploadReferenceImage(categoryId, {
        name: values.name,
        sourceType: "url",
        description: values.description,
        url: values.url,
      });
    }
    await onCreated();
    resetAll();
    setOpen(false);
    toast.success("参考图添加成功");
  };

  return (
    <Dialog open={open} onOpenChange={(value) => {
      setOpen(value);
      if (!value) {
        resetAll();
      }
    }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>新增参考图</DialogTitle>
        </DialogHeader>
        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as "upload" | "url")}
          className="grid gap-4"
        >
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="upload">上传文件</TabsTrigger>
            <TabsTrigger value="url">引用链接</TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="reference-upload-name">图片名称</Label>
              <Input id="reference-upload-name" {...uploadForm.register("name")} />
              {uploadForm.formState.errors.name ? (
                <p className="text-xs text-destructive">
                  {uploadForm.formState.errors.name.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reference-upload-desc">备注</Label>
              <Input id="reference-upload-desc" {...uploadForm.register("description")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reference-upload-file">选择图片</Label>
              <Input
                id="reference-upload-file"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  setFile(selected ?? null);
                }}
              />
              {file ? (
                <p className="text-xs text-muted-foreground">已选择：{file.name}</p>
              ) : (
                <p className="text-xs text-muted-foreground">支持常见图片格式，单个文件建议不超过 10MB。</p>
              )}
            </div>
          </TabsContent>
          <TabsContent value="url" className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="reference-url-name">图片名称</Label>
              <Input id="reference-url-name" {...urlForm.register("name")} />
              {urlForm.formState.errors.name ? (
                <p className="text-xs text-destructive">
                  {urlForm.formState.errors.name.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reference-url-link">图片 URL</Label>
              <Input id="reference-url-link" {...urlForm.register("url")} />
              {urlForm.formState.errors.url ? (
                <p className="text-xs text-destructive">
                  {urlForm.formState.errors.url.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reference-url-desc">备注</Label>
              <Input id="reference-url-desc" {...urlForm.register("description")} />
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button onClick={() => void handleSubmit()}>添加参考图</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReferenceLibrary() {
  const { data, mutate, isLoading } = useSWR<ReferenceStore>("/api/references", fetchReferences);
  const [selectedCategory, setSelectedCategory] = useState<string>("default");

  useEffect(() => {
    if (!data) return;
    const exists = data.categories.find((cat) => cat.id === selectedCategory);
    if (!exists) {
      setSelectedCategory(data.categories[0]?.id ?? "");
    }
  }, [data, selectedCategory]);

  const categories = data?.categories ?? [];
  const images = useMemo(() => {
    if (!data) return [] as ReferenceImage[];
    const category = data.categories.find((cat) => cat.id === selectedCategory);
    return category?.images ?? [];
  }, [data, selectedCategory]);

  const handleCreateCategory = async (values: z.infer<typeof categorySchema>) => {
    try {
      const category = await createReferenceCategory(values);
      await mutate();
      setSelectedCategory(category.id);
      toast.success("分类创建成功");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "创建分类失败");
    }
  };

  const handleUpdateCategory = async (
    category: ReferenceCategory,
    values: z.infer<typeof categorySchema>,
  ) => {
    try {
      await updateReferenceCategory(category.id, values);
      await mutate();
      toast.success("分类已更新");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "更新分类失败");
    }
  };

  const handleDeleteCategory = async (category: ReferenceCategory) => {
    if (category.id === "default") {
      toast.error("默认分类不可删除");
      return;
    }
    if (!confirm(`确定删除分类「${category.name}」吗？该分类下的参考图将一并删除。`)) {
      return;
    }
    try {
      await deleteReferenceCategory(category.id);
      await mutate();
      toast.success("分类已删除");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "删除分类失败");
    }
  };

  const handleDeleteImage = async (image: ReferenceImage) => {
    if (!data) return;
    const category = data.categories.find((cat) => cat.images.some((item) => item.id === image.id));
    if (!category) return;
    if (!confirm(`确定删除参考图「${image.name}」吗？`)) {
      return;
    }
    try {
      await deleteReferenceImage(category.id, image.id);
      await mutate();
      toast.success("参考图已删除");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "删除参考图失败");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>参考图分类</CardTitle>
          <CardDescription>
            将参考图按项目、场景或风格进行归类管理。
          </CardDescription>
          <CategoryDialog
            mode="create"
            onSubmit={handleCreateCategory}
            trigger={
              <Button size="sm" className="w-full">
                <FolderPlus className="mr-2 h-4 w-4" />
                新建分类
              </Button>
            }
          />
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-3">
            <div className="space-y-2">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">加载中...</p>
              ) : categories.length === 0 ? (
                <Alert>
                  <AlertTitle>暂无分类</AlertTitle>
                  <AlertDescription>请先创建参考图分类。</AlertDescription>
                </Alert>
              ) : (
                categories.map((category) => (
                  <div
                    key={category.id}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${selectedCategory === category.id ? "border-primary bg-primary/10" : "hover:border-primary"}`}
                  >
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={() => setSelectedCategory(category.id)}
                    >
                      <div className="font-medium">{category.name}</div>
                      <div className="text-xs text-muted-foreground">
                        含 {category.images.length} 张参考图
                      </div>
                    </button>
                    <div className="ml-2 flex items-center gap-1">
                      <CategoryDialog
                        mode="edit"
                        initialValue={category}
                        disabled={category.id === "default"}
                        onSubmit={(values) => handleUpdateCategory(category, values)}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={category.id === "default"}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => void handleDeleteCategory(category)}
                        disabled={category.id === "default"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>参考图列表</CardTitle>
            <CardDescription>
              支持直接上传或引用外部链接，可在批量出图时选用。
            </CardDescription>
          </div>
          <ReferenceDialog
            categoryId={selectedCategory}
            onCreated={async () => {
              await mutate();
            }}
            trigger={
              <Button disabled={!selectedCategory}>
                <ImagePlus className="mr-2 h-4 w-4" />
                新增参考图
              </Button>
            }
          />
        </CardHeader>
        <Separator />
        <CardContent className="flex-1 overflow-hidden">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">正在加载参考图...</p>
          ) : images.length === 0 ? (
            <Alert>
              <AlertTitle>暂无参考图</AlertTitle>
              <AlertDescription>
                为当前分类添加图片后，可在生成任务中作为视觉提示。
              </AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-[460px] pr-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {images.map((image) => (
                  <div key={image.id} className="flex flex-col overflow-hidden rounded-lg border">
                    <div className="relative h-40 bg-muted">
                      <Image
                        src={image.path}
                        alt={image.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 33vw, 200px"
                        unoptimized={image.sourceType === "url"}
                      />
                      <Button
                        size="icon"
                        variant="secondary"
                        className="absolute right-2 top-2 h-8 w-8 rounded-full bg-background/80"
                        onClick={() => {
                          void handleDeleteImage(image);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex-1 space-y-1 p-3">
                      <div className="text-sm font-semibold">{image.name}</div>
                      {image.description ? (
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {image.description}
                        </div>
                      ) : null}
                      <div className="text-xs text-muted-foreground break-all">
                        {image.sourceType === "upload" ? image.path : image.url}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
