"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
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
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  createStyle,
  createStyleCategory,
  deleteStyle,
  deleteStyleCategory,
  getStyleStore,
  updateStyle,
  updateStyleCategory,
} from "@/lib/api";
import type { StyleCategory, StyleEntry, StyleStore } from "@/types";
import { Edit, FolderPlus, PlusCircle, Trash2 } from "lucide-react";

const fetchStyles = () => getStyleStore();

const categorySchema = z.object({
  name: z.string().min(1, "请输入分类名称"),
  description: z.string().optional(),
});

const styleSchema = z.object({
  name: z.string().min(1, "请输入风格名称"),
  content: z.string().min(1, "请输入风格提示词"),
  categoryId: z.string().min(1, "请选择所属分类"),
});

interface CategoryDialogProps {
  trigger: React.ReactNode;
  mode: "create" | "edit";
  initialValue?: StyleCategory;
  onSubmit: (values: z.infer<typeof categorySchema>) => Promise<void>;
  disableEdit?: boolean;
}

function CategoryDialog({ trigger, mode, initialValue, onSubmit, disableEdit }: CategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: initialValue?.name ?? "",
      description: initialValue?.description ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      name: initialValue?.name ?? "",
      description: initialValue?.description ?? "",
    });
  }, [initialValue, form]);

  const handleSubmit = async (values: z.infer<typeof categorySchema>) => {
    await onSubmit(values);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !disableEdit && setOpen(value)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "新增分类" : "编辑分类"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={form.handleSubmit((values) => handleSubmit(values))}
        >
          <div className="grid gap-2">
            <Label htmlFor="category-name">分类名称</Label>
            <Input id="category-name" {...form.register("name")}
              disabled={disableEdit}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category-description">分类描述</Label>
            <Textarea
              id="category-description"
              rows={3}
              {...form.register("description")}
              disabled={disableEdit}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={disableEdit}>
              {mode === "create" ? "创建分类" : "保存修改"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface StyleDialogProps {
  trigger: React.ReactNode;
  mode: "create" | "edit";
  initialValue?: StyleEntry;
  categories: StyleCategory[];
  onSubmit: (values: z.infer<typeof styleSchema>) => Promise<void>;
}

function StyleDialog({ trigger, mode, initialValue, categories, onSubmit }: StyleDialogProps) {
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof styleSchema>>({
    resolver: zodResolver(styleSchema),
    defaultValues: {
      name: initialValue?.name ?? "",
      content: initialValue?.content ?? "",
      categoryId: initialValue?.categoryId ?? categories[0]?.id ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      name: initialValue?.name ?? "",
      content: initialValue?.content ?? "",
      categoryId: initialValue?.categoryId ?? categories[0]?.id ?? "",
    });
  }, [initialValue, categories, form]);

  const handleSubmit = async (values: z.infer<typeof styleSchema>) => {
    await onSubmit(values);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "新增风格" : "编辑风格"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={form.handleSubmit((values) => handleSubmit(values))}
        >
          <div className="grid gap-2">
            <Label htmlFor="style-name">风格名称</Label>
            <Input id="style-name" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="style-category">所属分类</Label>
            <select
              id="style-category"
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              {...form.register("categoryId")}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="style-content">风格提示词</Label>
            <Textarea id="style-content" rows={8} {...form.register("content")} />
            {form.formState.errors.content ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.content.message}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="submit">{mode === "create" ? "创建风格" : "保存修改"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StyleLibrary() {
  const { data, mutate, isLoading } = useSWR<StyleStore>("/api/styles", fetchStyles);
  const [selectedCategory, setSelectedCategory] = useState<string>("default");

  useEffect(() => {
    if (!data) return;
    const exists = data.categories.find((cat) => cat.id === selectedCategory);
    if (!exists) {
      setSelectedCategory(data.categories[0]?.id ?? "");
    }
  }, [data, selectedCategory]);

  const categories = data?.categories ?? [];
  const styles = useMemo(() => {
    if (!data) return [] as StyleEntry[];
    return data.styles.filter((style) => style.categoryId === selectedCategory);
  }, [data, selectedCategory]);

  const handleCreateCategory = async (values: z.infer<typeof categorySchema>) => {
    try {
      const category = await createStyleCategory(values);
      await mutate();
      setSelectedCategory(category.id);
      toast.success("分类创建成功");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "创建分类失败");
    }
  };

  const handleUpdateCategory = async (category: StyleCategory, values: z.infer<typeof categorySchema>) => {
    try {
      await updateStyleCategory(category.id, values);
      await mutate();
      toast.success("分类已更新");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "更新分类失败");
    }
  };

  const handleDeleteCategory = async (category: StyleCategory) => {
    if (category.id === "default") {
      toast.error("默认分类不可删除");
      return;
    }

    if (!confirm(`删除分类「${category.name}」后，风格将移动到默认分类，是否继续？`)) {
      return;
    }

    try {
      await deleteStyleCategory(category.id);
      await mutate();
      toast.success("分类已删除");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "删除分类失败");
    }
  };

  const handleCreateStyle = async (values: z.infer<typeof styleSchema>) => {
    try {
      await createStyle(values);
      await mutate();
      toast.success("风格创建成功");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "创建风格失败");
    }
  };

  const handleUpdateStyle = async (style: StyleEntry, values: z.infer<typeof styleSchema>) => {
    try {
      await updateStyle(style.id, values);
      await mutate();
      toast.success("风格已更新");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "更新风格失败");
    }
  };

  const handleDeleteStyle = async (style: StyleEntry) => {
    if (!confirm(`确定要删除风格「${style.name}」吗？`)) {
      return;
    }
    try {
      await deleteStyle(style.id);
      await mutate();
      toast.success("风格已删除");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "删除风格失败");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>风格分类</CardTitle>
          <CardDescription>
            管理风格分类，方便不同场景下快速切换提示词模板。
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
                  <AlertDescription>请先创建风格分类。</AlertDescription>
                </Alert>
              ) : (
                categories.map((category) => (
                  <div
                    key={category.id}
                    className={`flex items-start justify-between rounded-md border px-3 py-2 text-sm ${selectedCategory === category.id ? "border-primary bg-primary/10" : "hover:border-primary"}`}
                  >
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={() => setSelectedCategory(category.id)}
                    >
                      <div className="font-medium">{category.name}</div>
                      {category.description ? (
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {category.description}
                        </div>
                      ) : null}
                    </button>
                    <div className="ml-2 flex items-center gap-1">
                      <CategoryDialog
                        mode="edit"
                        initialValue={category}
                        onSubmit={(values) => handleUpdateCategory(category, values)}
                        disableEdit={category.id === "default"}
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
            <CardTitle>风格清单</CardTitle>
            <CardDescription>
              为当前分类整理的提示词模板，可在主界面直接引用。
            </CardDescription>
          </div>
          <StyleDialog
            mode="create"
            categories={categories}
            onSubmit={handleCreateStyle}
            trigger={
              <Button disabled={categories.length === 0}>
                <PlusCircle className="mr-2 h-4 w-4" />
                新增风格
              </Button>
            }
          />
        </CardHeader>
        <Separator />
        <CardContent className="flex-1 overflow-hidden">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">正在加载风格...</p>
          ) : styles.length === 0 ? (
            <Alert>
              <AlertTitle>当前分类暂无风格</AlertTitle>
              <AlertDescription>点击右上角按钮创建第一个风格模板。</AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-[460px] pr-4">
              <div className="space-y-4">
                {styles.map((style) => (
                  <div key={style.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold">{style.name}</h3>
                        <Badge variant="outline">调用 {style.usageCount}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <StyleDialog
                          mode="edit"
                          categories={categories}
                          initialValue={style}
                          onSubmit={(values) => handleUpdateStyle(style, values)}
                          trigger={
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => void handleDeleteStyle(style)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {style.content}
                    </pre>
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
