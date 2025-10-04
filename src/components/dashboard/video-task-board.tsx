'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { PlusIcon, PencilIcon, Trash2Icon, FilmIcon, PlayCircleIcon } from 'lucide-react';
import { api, VideoTask } from '@/lib/api';
import { cn } from '@/lib/utils';
import { VideoTaskForm, VideoTaskFormSubmitPayload, VideoTaskFormValues } from './video-task-form';

const STATUS_COLOR: Record<string, string> = {
  等待中: 'bg-slate-100 text-slate-700 border border-slate-200',
  生成中: 'bg-blue-100 text-blue-700 border border-blue-200',
  下载中: 'bg-amber-100 text-amber-700 border border-amber-200',
  成功: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  失败: 'bg-rose-100 text-rose-700 border border-rose-200',
  提交中: 'bg-sky-100 text-sky-700 border border-sky-200',
};

function mapTaskToFormValues(task: VideoTask): VideoTaskFormValues {
  return {
    number: task.number,
    prompt: task.prompt,
    imageUrls: task.imageUrls,
    aspectRatio: task.aspectRatio,
    watermark: task.watermark ?? '',
    callbackUrl: task.callbackUrl ?? '',
    seeds: task.seeds ?? '',
    enableFallback: task.enableFallback,
    enableTranslation: task.enableTranslation,
  };
}

export function VideoTaskBoard() {
  const queryClient = useQueryClient();
  const { data: videoData, isLoading } = useQuery({
    queryKey: ['video-tasks'],
    queryFn: api.getVideoTasks,
    refetchInterval: (query) => {
      const running = (query.state.data?.videoTasks as VideoTask[] | undefined)?.some((task) =>
        ['生成中', '任务已提交，等待处理...', '生成完成，开始下载...'].includes(task.status),
      );
      return running ? 5000 : false;
    },
  });

  const videoTasks = useMemo(() => videoData?.videoTasks ?? [], [videoData]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VideoTask | null>(null);

  const updateTaskMutation = useMutation({
    mutationFn: ({ number, payload }: { number: string; payload: Partial<VideoTask> }) =>
      api.updateVideoTask(number, payload),
    onSuccess: () => {
      toast.success('视频任务已更新');
      queryClient.invalidateQueries({ queryKey: ['video-tasks'] });
      setEditDialogOpen(false);
      setEditing(null);
    },
    onError: (error: Error) => toast.error(error.message || '更新视频任务失败'),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (number: string) => api.removeVideoTask(number),
    onSuccess: () => {
      toast.success('视频任务已删除');
      queryClient.invalidateQueries({ queryKey: ['video-tasks'] });
      setSelected(new Set());
    },
    onError: (error: Error) => toast.error(error.message || '删除视频任务失败'),
  });

  const clearTasksMutation = useMutation({
    mutationFn: api.clearVideoTasks,
    onSuccess: () => {
      toast.success('已清空视频任务');
      queryClient.invalidateQueries({ queryKey: ['video-tasks'] });
      setSelected(new Set());
    },
    onError: (error: Error) => toast.error(error.message || '清空视频任务失败'),
  });

  const generateMutation = useMutation({
    mutationFn: (numbers?: string[]) => api.startVideoGeneration(numbers?.length ? numbers : undefined),
    onSuccess: (response) => {
      if (response.success) {
        toast.success('视频任务已提交');
        queryClient.invalidateQueries({ queryKey: ['video-tasks'] });
      } else {
        toast.info(response.message ?? '没有待生成的视频任务');
      }
    },
    onError: (error: Error) => toast.error(error.message || '启动图生视频失败'),
  });

  const sortedTasks = useMemo(
    () =>
      [...videoTasks].sort((a, b) => Number.parseInt(a.number, 10) - Number.parseInt(b.number, 10)),
    [videoTasks],
  );

  const overallProgress = useMemo(() => {
    if (!videoTasks.length) return 0;
    const total = videoTasks.reduce((acc, task) => acc + (task.status === '成功' ? 100 : task.progress ?? 0), 0);
    return Math.round(total / videoTasks.length);
  }, [videoTasks]);

  const handleSelect = (number: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(number);
      } else {
        next.delete(number);
      }
      return next;
    });
  };

  const openEditDialog = () => {
    if (!selected.size) {
      toast.warning('请先选择要编辑的任务');
      return;
    }
    if (selected.size > 1) {
      toast.warning('一次只能编辑一个视频任务');
      return;
    }
    const number = Array.from(selected)[0];
    const task = videoTasks.find((item) => item.number === number);
    if (!task) return;
    setEditing(task);
    setEditDialogOpen(true);
  };

  const handleEditSubmit = (payload: VideoTaskFormSubmitPayload) => {
    if (!editing) return;
    updateTaskMutation.mutate({ number: editing.number, payload });
  };

  const handleDialogChange = (open: boolean) => {
    setEditDialogOpen(open);
    if (!open) {
      setEditing(null);
    }
  };

  const handleDeleteSelected = () => {
    if (!selected.size) {
      toast.warning('请先选择要删除的任务');
      return;
    }
    selected.forEach((number) => deleteTaskMutation.mutate(number));
  };

  const handleStartGeneration = () => {
    generateMutation.mutate(selected.size ? Array.from(selected) : undefined);
  };

  return (
    <Card className="shadow-sm border border-slate-200">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-semibold">🎬 图生视频任务</CardTitle>
            <CardDescription>提交图片 URL 与提示词，批量生成 Veo3 视频</CardDescription>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>任务总数: {videoTasks.length}</span>
            <span className="text-emerald-600">成功 {videoTasks.filter((item) => item.status === '成功').length}</span>
            <span className="text-rose-600">失败 {videoTasks.filter((item) => item.status === '失败').length}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href="/video/create">
              <PlusIcon className="mr-2 h-4 w-4" /> 添加任务
            </Link>
          </Button>
          <Button variant="secondary" size="sm" onClick={openEditDialog} disabled={!selected.size}>
            <PencilIcon className="mr-2 h-4 w-4" /> 编辑选中
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDeleteSelected}
            disabled={!selected.size}
          >
            <Trash2Icon className="mr-2 h-4 w-4" /> 删除选中
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => clearTasksMutation.mutate()}
            disabled={!videoTasks.length}
          >
            <Trash2Icon className="mr-2 h-4 w-4" /> 清空全部
          </Button>
          <Button
            size="sm"
            className="ml-auto bg-purple-600 hover:bg-purple-700"
            disabled={generateMutation.isPending}
            onClick={handleStartGeneration}
          >
            <PlayCircleIcon className="mr-2 h-4 w-4" /> 开始生成视频
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="mb-2 flex items-center gap-3 text-sm font-medium text-slate-700">
            <FilmIcon className="h-4 w-4" /> 当前批次整体进度
          </div>
          <Progress value={overallProgress} className="h-2" />
          <div className="mt-2 text-xs text-muted-foreground">{overallProgress}%</div>
        </div>

        <ScrollArea className="h-[360px] rounded-md border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-100">
                <TableHead className="w-12">选择</TableHead>
                <TableHead className="w-16">编号</TableHead>
                <TableHead className="min-w-[350px]">提示词与参考图</TableHead>
                <TableHead className="w-[220px]">状态</TableHead>
                <TableHead className="w-24">进度</TableHead>
                <TableHead className="w-32">视频</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    正在加载视频任务...
                  </TableCell>
                </TableRow>
              ) : !sortedTasks.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    暂无视频任务，请先添加。
                  </TableCell>
                </TableRow>
              ) : (
                sortedTasks.map((task) => (
                  <TableRow key={task.number} className="text-sm">
                    <TableCell>
                      <Checkbox
                        checked={selected.has(task.number)}
                        onCheckedChange={(checked) => handleSelect(task.number, Boolean(checked))}
                      />
                    </TableCell>
                    <TableCell className="font-semibold text-slate-700">{task.number}</TableCell>
                    <TableCell className="max-w-md">
                      <div className="space-y-3">
                        <div className="rounded-md bg-slate-50 p-3">
                          <div className="mb-1 text-xs font-medium text-slate-500">提示词</div>
                          <div className="max-h-24 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                            {task.prompt}
                          </div>
                        </div>
                        {task.imageUrls?.length ? (
                          <div className="rounded-md border border-slate-200 bg-blue-50/50 p-3">
                            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-blue-700">
                              📷 参考图片 ({task.imageUrls.length})
                            </div>
                            <div className="space-y-2">
                              {task.imageUrls.map((url, idx) => (
                                <div
                                  key={url}
                                  className="group overflow-hidden rounded border border-blue-200 bg-white p-2 transition-all hover:border-blue-400 hover:shadow-sm"
                                >
                                  <div className="mb-1 text-xs font-medium text-slate-500">图片 {idx + 1}</div>
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block break-words text-xs leading-relaxed text-blue-600 hover:text-blue-700 hover:underline"
                                    style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                                    title="点击查看图片"
                                  >
                                    {url}
                                  </a>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-center">
                            <p className="text-xs text-slate-400">无参考图片</p>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[200px]">
                      <Badge className={cn('font-medium', STATUS_COLOR[task.status] ?? 'bg-slate-100 text-slate-700')}>
                        {task.status}
                      </Badge>
                      {task.errorMsg && (
                        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3">
                          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                            ⚠️ 错误详情
                          </div>
                          <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-rose-600">
                            {task.errorMsg}
                          </p>
                          {task.errorMsg.includes('content policy') && (
                            <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2">
                              <p className="text-xs text-amber-800">
                                💡 <strong>建议：</strong>修改提示词避免敏感内容，或启用 Fallback API
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Progress value={task.status === '成功' ? 100 : task.progress ?? 0} className="h-2" />
                      <span className="mt-2 block text-xs text-muted-foreground">
                        {task.status === '成功' ? '100%' : `${task.progress ?? 0}%`}
                      </span>
                    </TableCell>
                    <TableCell>
                      {task.localPath ? (
                        <a
                          href={`/${task.localPath}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 underline hover:text-blue-700"
                        >
                          打开本地文件
                        </a>
                      ) : task.remoteUrl ? (
                        <a
                          href={task.remoteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 underline hover:text-blue-700"
                        >
                          查看远程地址
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>

      <Dialog open={editDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editing ? `编辑视频任务 #${editing.number}` : '编辑视频任务'}
            </DialogTitle>
            <DialogDescription>调整提示词或参考图，更新 Veo3 视频任务。</DialogDescription>
          </DialogHeader>
          {editing ? (
            <VideoTaskForm
              mode="edit"
              initialValues={mapTaskToFormValues(editing)}
              onSubmit={handleEditSubmit}
              onCancel={() => handleDialogChange(false)}
              isSubmitting={updateTaskMutation.isPending}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
