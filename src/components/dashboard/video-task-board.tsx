'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
import { Trash2Icon, FilmIcon, PlayCircleIcon } from 'lucide-react';
import { api, VideoTask } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  VideoTaskForm,
  VideoTaskFormSubmitPayload,
  createEmptyVideoTaskDraft,
} from './video-task-form';

const STATUS_COLOR: Record<string, string> = {
  等待中: 'bg-slate-100 text-slate-700 border border-slate-200',
  生成中: 'bg-blue-100 text-blue-700 border border-blue-200',
  下载中: 'bg-amber-100 text-amber-700 border border-amber-200',
  成功: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  失败: 'bg-rose-100 text-rose-700 border border-rose-200',
  提交中: 'bg-sky-100 text-sky-700 border border-sky-200',
};

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

  const { data: settings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });

  const videoTasks = useMemo(() => videoData?.videoTasks ?? [], [videoData]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const initialFormValues = useMemo(
    () =>
      createEmptyVideoTaskDraft({
        aspectRatio: settings?.videoSettings.defaultAspectRatio,
        watermark: settings?.videoSettings.defaultWatermark,
        callbackUrl: settings?.videoSettings.defaultCallback,
        enableFallback: settings?.videoSettings.enableFallback,
        enableTranslation: settings?.videoSettings.enableTranslation,
      }),
    [settings],
  );

  const addTaskMutation = useMutation({
    mutationFn: async (payload: VideoTaskFormSubmitPayload) => {
      // 一个图片对应一个任务，需要拆分
      console.log('[VideoTaskBoard] 开始创建任务，图片数量:', payload.imageUrls.length);
      console.log('[VideoTaskBoard] 提交的数据:', payload);

      const tasks = payload.imageUrls.map((imageUrl, index) => {
        const promptLines = payload.prompt.split(/\r?\n/).filter(Boolean);
        const singlePrompt = promptLines[index]?.replace(/^\d+\.\s*/, '').trim() || payload.prompt;

        const taskPayload = {
          prompt: singlePrompt,
          imageUrls: [imageUrl],
          aspectRatio: payload.aspectRatio,
          watermark: payload.watermark,
          callbackUrl: payload.callbackUrl,
          seeds: payload.seeds,
          enableFallback: payload.enableFallback,
          enableTranslation: payload.enableTranslation,
        };

        console.log(`[VideoTaskBoard] 任务 ${index + 1}:`, taskPayload);

        return api.addVideoTask(taskPayload);
      });

      const results = await Promise.all(tasks);
      console.log('[VideoTaskBoard] 任务创建完成，结果:', results);

      return results;
    },
    onSuccess: (results) => {
      const count = results?.length || 0;
      toast.success(`已添加 ${count} 个视频任务`);
      queryClient.invalidateQueries({ queryKey: ['video-tasks'] });
    },
    onError: (error: Error) => toast.error(error.message || '添加视频任务失败'),
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

  const handleFormSubmit = (payload: VideoTaskFormSubmitPayload) => {
    addTaskMutation.mutate(payload);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 左侧：任务列表 */}
      <Card className="shadow-sm border border-slate-200">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-semibold">🎬 图生视频任务</CardTitle>
              <CardDescription>批量生成 Veo3 视频任务列表</CardDescription>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>任务总数: {videoTasks.length}</span>
              <span className="text-emerald-600">成功 {videoTasks.filter((item) => item.status === '成功').length}</span>
              <span className="text-rose-600">失败 {videoTasks.filter((item) => item.status === '失败').length}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
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

          <ScrollArea className="h-[500px] rounded-md border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100">
                  <TableHead className="w-12">选择</TableHead>
                  <TableHead className="w-16">编号</TableHead>
                  <TableHead>提示词与参考图</TableHead>
                  <TableHead className="w-24">状态</TableHead>
                  <TableHead className="w-20">进度</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      正在加载视频任务...
                    </TableCell>
                  </TableRow>
                ) : !sortedTasks.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      暂无视频任务，请在右侧添加。
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
                        <div className="space-y-2">
                          <div className="text-xs text-slate-600 line-clamp-2">{task.prompt}</div>
                          {task.imageUrls?.[0] && (
                            <div className="text-xs text-blue-600 truncate" title={task.imageUrls[0]}>
                              📷 {task.imageUrls[0]}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('font-medium text-xs', STATUS_COLOR[task.status] ?? 'bg-slate-100 text-slate-700')}>
                          {task.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={task.status === '成功' ? 100 : task.progress ?? 0} className="h-1.5" />
                          <span className="text-xs text-muted-foreground">
                            {task.status === '成功' ? '100%' : `${task.progress ?? 0}%`}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 右侧：新建任务表单 */}
      <Card className="shadow-sm border border-slate-200">
        <CardHeader>
          <CardTitle>新建图生视频任务</CardTitle>
          <CardDescription>
            填写 Veo3 视频提示词与参考图，一个图片对应一个任务
            {isSettingsLoading ? ' (正在读取默认设置...)' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="min-h-[500px]">
            <VideoTaskForm
              mode="create"
              initialValues={initialFormValues}
              onSubmit={handleFormSubmit}
              isSubmitting={addTaskMutation.isPending}
              submitLabel={addTaskMutation.isPending ? '提交中...' : '添加任务'}
              disableUpload={isSettingsLoading}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
