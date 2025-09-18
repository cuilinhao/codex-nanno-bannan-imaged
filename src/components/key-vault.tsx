"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getKeys, createKey, updateKey, deleteKey } from "@/lib/api";
import { apiPlatformValues } from "@/lib/validators";
import type { ApiKeyEntry, KeyStore } from "@/types";
import { Delete, Pencil, Plus } from "lucide-react";

const fetchKeys = () => getKeys();

const keyFormSchema = z.object({
  name: z.string().min(1, "请输入密钥名称"),
  apiKey: z.string().min(1, "请输入完整的 API 密钥"),
  platform: z.enum(apiPlatformValues),
});

interface KeyFormDialogProps {
  trigger: React.ReactNode;
  initialValue?: ApiKeyEntry;
  onSubmit: (values: z.infer<typeof keyFormSchema>) => Promise<void>;
  mode: "create" | "edit";
}

function KeyFormDialog({ trigger, initialValue, onSubmit, mode }: KeyFormDialogProps) {
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof keyFormSchema>>({
    resolver: zodResolver(keyFormSchema),
    defaultValues: {
      name: initialValue?.name ?? "",
      apiKey: initialValue?.apiKey ?? "",
      platform: (initialValue?.platform as z.infer<typeof keyFormSchema>["platform"]) ?? "云雾",
    },
  });

  const resetForm = () =>
    form.reset({
      name: initialValue?.name ?? "",
      apiKey: initialValue?.apiKey ?? "",
      platform: (initialValue?.platform as z.infer<typeof keyFormSchema>["platform"]) ?? "云雾",
    });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  };

  const handleSubmit = async (values: z.infer<typeof keyFormSchema>) => {
    await onSubmit(values);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "新增密钥" : "编辑密钥"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={form.handleSubmit((values) => handleSubmit(values))}
        >
          <div className="grid gap-2">
            <Label htmlFor="key-name">密钥名称</Label>
            <Input
              id="key-name"
              placeholder="例如：团队云雾主账号"
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="key-platform">API 平台</Label>
            <Select
              value={form.watch("platform")}
              onValueChange={(value) => form.setValue("platform", value as z.infer<typeof keyFormSchema>["platform"])}
            >
              <SelectTrigger id="key-platform">
                <SelectValue placeholder="选择API平台" />
              </SelectTrigger>
              <SelectContent>
                {apiPlatformValues.map((platform) => (
                  <SelectItem key={platform} value={platform}>
                    {platform}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="key-value">API 密钥</Label>
            <Input
              id="key-value"
              type="password"
              placeholder="请输入完整的密钥字符串"
              {...form.register("apiKey")}
            />
            {form.formState.errors.apiKey ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.apiKey.message}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="submit">{mode === "create" ? "添加密钥" : "保存修改"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function KeyVault() {
  const { data, mutate, isLoading } = useSWR<KeyStore>("/api/keys", fetchKeys);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const hasKeys = !!data && data.keys.length > 0;

  const handleCreate = async (values: z.infer<typeof keyFormSchema>) => {
    try {
      await createKey(values);
      await mutate();
      toast.success("密钥添加成功");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "添加密钥失败");
    }
  };

  const handleUpdate = async (key: ApiKeyEntry, values: z.infer<typeof keyFormSchema>) => {
    try {
      await updateKey(key.id, values);
      await mutate();
      toast.success("密钥更新成功");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "更新密钥失败");
    }
  };

  const handleDelete = async (key: ApiKeyEntry) => {
    if (!confirm(`确定要删除密钥「${key.name}」吗？删除后不可恢复。`)) {
      return;
    }
    try {
      setPendingId(key.id);
      await deleteKey(key.id);
      await mutate();
      toast.success("密钥已删除");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setPendingId(null);
    }
  };

  const platformSummary = useMemo(() => {
    if (!data) return [] as { platform: ApiKeyEntry["platform"]; count: number }[];
    const aggregated = new Map<ApiKeyEntry["platform"], number>();
    data.keys.forEach((key) => {
      aggregated.set(key.platform, (aggregated.get(key.platform) ?? 0) + 1);
    });
    return Array.from(aggregated.entries()).map(([platform, count]) => ({ platform, count }));
  }, [data]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>密钥库</CardTitle>
          <CardDescription>
            管理各平台 API 密钥，可在基础配置中选择默认使用项。
          </CardDescription>
        </div>
        <KeyFormDialog
          mode="create"
          onSubmit={handleCreate}
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              新增密钥
            </Button>
          }
        />
      </CardHeader>
      <CardContent className="space-y-6">
        {platformSummary.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {platformSummary.map((item) => (
              <Badge key={item.platform} variant="secondary">
                {item.platform} × {item.count}
              </Badge>
            ))}
          </div>
        ) : null}
        <Separator />
        {isLoading ? (
          <p className="text-sm text-muted-foreground">正在加载密钥...</p>
        ) : !hasKeys ? (
          <Alert>
            <AlertTitle>暂无密钥</AlertTitle>
            <AlertDescription>
              添加您的第一条 API 密钥后即可开始批量出图。
            </AlertDescription>
          </Alert>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[220px]">密钥名称</TableHead>
                  <TableHead className="w-[120px]">所属平台</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>最后使用</TableHead>
                  <TableHead className="w-[140px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell>
                      <div className="font-semibold">{key.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {key.apiKey.slice(0, 6)}****{key.apiKey.slice(-4)}
                      </div>
                    </TableCell>
                    <TableCell>{key.platform}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(key.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {key.lastUsed ? new Date(key.lastUsed).toLocaleString() : "--"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <KeyFormDialog
                          mode="edit"
                          initialValue={key}
                          onSubmit={(values) => handleUpdate(key, values)}
                          trigger={
                            <Button variant="ghost" size="icon">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => void handleDelete(key)}
                          disabled={pendingId === key.id}
                        >
                          <Delete className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
