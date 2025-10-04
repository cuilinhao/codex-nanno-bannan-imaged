'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { FolderUpIcon } from 'lucide-react';

export interface VideoTaskFormValues {
  number?: string;
  prompt: string;
  imageUrls: string[];
  aspectRatio: string;
  watermark: string;
  callbackUrl: string;
  seeds: string;
  enableFallback: boolean;
  enableTranslation: boolean;
}

export type VideoTaskFormSubmitPayload = Omit<VideoTaskFormValues, 'number'>;

interface VideoTaskFormProps {
  mode: 'create' | 'edit';
  initialValues: VideoTaskFormValues;
  onSubmit: (payload: VideoTaskFormSubmitPayload) => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  disableUpload?: boolean;
}

interface ImageUploadItem {
  id: string;
  name: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  url?: string;
  error?: string;
}

const ASPECT_RATIO_OPTIONS = ['16:9', '9:16', '1:1', '4:3'];

export function createEmptyVideoTaskDraft(defaults?: Partial<VideoTaskFormValues>): VideoTaskFormValues {
  return {
    prompt: '',
    imageUrls: [],
    aspectRatio: defaults?.aspectRatio ?? '16:9',
    watermark: defaults?.watermark ?? '',
    callbackUrl: defaults?.callbackUrl ?? '',
    seeds: defaults?.seeds ?? '',
    enableFallback: defaults?.enableFallback ?? false,
    enableTranslation: defaults?.enableTranslation ?? true,
  };
}

function parseImageUrls(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeSegment(segment: string) {
  return segment
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function sanitizeRelativePath(raw: string) {
  const parts = raw.split(/[\\/]/).filter(Boolean);
  return parts
    .map(sanitizeSegment)
    .filter(Boolean)
    .join('/');
}

export function VideoTaskForm({
  mode,
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
  cancelLabel,
  isSubmitting,
  disableUpload,
}: VideoTaskFormProps) {
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [values, setValues] = useState<VideoTaskFormValues>(() => ({ ...initialValues }));
  const [imageUploads, setImageUploads] = useState<ImageUploadItem[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
      folderInputRef.current.setAttribute('directory', '');
    }
  }, []);

  useEffect(() => {
    setValues({ ...initialValues });
    setImageUploads([]);
    setIsUploadingImages(false);
  }, [initialValues]);

  const uploadFileToR2 = async (
    file: File,
    batchPrefix: string,
    onProgress: (value: number) => void,
  ): Promise<{ key: string; publicUrl?: string | null; readUrl?: string | null }> => {
    const contentType = file.type || 'application/octet-stream';
    const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? file.name;
    const trimmed = relative.includes('/') ? relative.split('/').slice(1).join('/') : relative;
    const sanitized = sanitizeRelativePath(trimmed || file.name) || sanitizeSegment(file.name) || 'image';
    const key = `${batchPrefix}/${sanitized}`;

    console.log('[VideoTaskForm] 预签名请求', { key, contentType, size: file.size });
    const presignResponse = await fetch('/api/r2/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, contentType }),
    });

    if (!presignResponse.ok) {
      const message = await presignResponse.text();
      throw new Error(message || '获取预签名链接失败');
    }

    const presignData = (await presignResponse.json()) as {
      url: string;
      key: string;
      publicUrl?: string | null;
    };
    console.log('[VideoTaskForm] 预签名成功', presignData);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', presignData.url, true);
      xhr.setRequestHeader('Content-Type', contentType);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 204) {
          onProgress(100);
          resolve();
        } else {
          reject(new Error(`上传失败 (HTTP ${xhr.status})`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('上传过程中发生错误'));
      };

      xhr.ontimeout = () => {
        reject(new Error('上传超时'));
      };

      xhr.send(file);
    });

    let readUrl = presignData.publicUrl ?? null;
    if (!readUrl) {
      const readResponse = await fetch(`/api/r2/presign-get?key=${encodeURIComponent(presignData.key)}`);
      if (readResponse.ok) {
        const readData = (await readResponse.json()) as { url?: string };
        readUrl = readData.url ?? null;
      }
    }

    console.log('[VideoTaskForm] 单文件上传完成', { key: presignData.key, readUrl, publicUrl: presignData.publicUrl });
    return { key: presignData.key, publicUrl: presignData.publicUrl, readUrl };
  };

  const uploadImagesFromFiles = async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (!imageFiles.length) {
      toast.error('所选文件夹内没有图片文件');
      return;
    }

    const batchPrefix = `uploads/video-references/${Date.now()}`;
    const batchId = Date.now();
    const initialStates = imageFiles.map((file, index) => ({
      id: `${batchId}-${index}`,
      name: file.name,
      progress: 0,
      status: 'pending' as const,
    }));
    setImageUploads(initialStates);
    setIsUploadingImages(true);

    const collectedUrls: string[] = [];

    for (let index = 0; index < imageFiles.length; index += 1) {
      const file = imageFiles[index];
      const itemId = initialStates[index].id;
      setImageUploads((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, status: 'uploading', progress: 0 } : item)),
      );

      try {
        const result = await uploadFileToR2(file, batchPrefix, (progress) => {
          setImageUploads((prev) =>
            prev.map((item) => (item.id === itemId ? { ...item, progress } : item)),
          );
        });

        const finalUrl = result.publicUrl ?? result.readUrl;
        setImageUploads((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  status: 'success',
                  progress: 100,
                  url: finalUrl ?? undefined,
                }
              : item,
          ),
        );

        if (finalUrl) {
          collectedUrls.push(finalUrl);
        }
      } catch (error) {
        const message = (error as Error).message || '上传失败';
        console.error('[VideoTaskForm] 上传失败', { file: file.name, message });
        setImageUploads((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  status: 'error',
                  error: message,
                }
              : item,
          ),
        );
        toast.error(`${file.name}: ${message}`);
      }
    }

    if (collectedUrls.length) {
      setValues((prev) => {
        const merged = Array.from(new Set([...prev.imageUrls, ...collectedUrls]));
        return { ...prev, imageUrls: merged };
      });
      toast.success(`已添加 ${collectedUrls.length} 张参考图`);
    }

    setIsUploadingImages(false);
  };

  const handleFolderButtonClick = () => {
    folderInputRef.current?.click();
  };

  const handleFolderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!fileList.length) return;
    void uploadImagesFromFiles(fileList);
  };

  const handleSubmit = () => {
    if (!values.prompt.trim()) {
      toast.error('请填写视频提示词');
      return;
    }

    const payload: VideoTaskFormSubmitPayload = {
      prompt: values.prompt.trim(),
      imageUrls: values.imageUrls,
      aspectRatio: values.aspectRatio,
      watermark: values.watermark,
      callbackUrl: values.callbackUrl,
      seeds: values.seeds,
      enableFallback: values.enableFallback,
      enableTranslation: values.enableTranslation,
    };

    onSubmit(payload);
  };

  return (
    <div className="flex h-full flex-col">
      <input
        ref={folderInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleFolderChange}
        disabled={disableUpload}
      />
      <ScrollArea className="flex-1 pr-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="video-prompt">视频提示词</Label>
            <Textarea
              id="video-prompt"
              rows={6}
              value={values.prompt}
              onChange={(event) => setValues((prev) => ({ ...prev, prompt: event.target.value }))}
              placeholder="请输入适用于 Veo3 的视频提示词..."
            />
          </div>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="video-images">参考图 URL（每行一个，可选）</Label>
              <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3 max-h-40 overflow-y-auto">
                {values.imageUrls.length > 0 ? (
                  values.imageUrls.map((url, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs group">
                      <span className="text-slate-500 shrink-0">{idx + 1}.</span>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline truncate flex-1"
                        title={url}
                      >
                        {url}
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setValues((prev) => ({
                            ...prev,
                            imageUrls: prev.imageUrls.filter((_, i) => i !== idx),
                          }));
                        }}
                        className="text-rose-500 hover:text-rose-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-2">暂无参考图，请上传文件夹或手动粘贴 URL</p>
                )}
              </div>
              <Textarea
                id="video-images"
                rows={2}
                value=""
                onChange={(event) => {
                  const newUrls = parseImageUrls(event.target.value);
                  if (newUrls.length > 0) {
                    setValues((prev) => ({
                      ...prev,
                      imageUrls: Array.from(new Set([...prev.imageUrls, ...newUrls])),
                    }));
                    event.target.value = '';
                  }
                }}
                placeholder="粘贴 URL 后自动添加，支持多行..."
                className="text-xs"
                disabled={disableUpload}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFolderButtonClick}
                disabled={disableUpload || isUploadingImages}
              >
                <FolderUpIcon className="mr-2 h-4 w-4" /> 上传参考图文件夹
              </Button>
              <span className="text-xs text-muted-foreground">
                选择包含图片的文件夹，系统将自动上传并填入 URL。
                {isUploadingImages ? ' 正在上传...' : ''}
              </span>
            </div>
            {imageUploads.length > 0 && (
              <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3 max-h-48 overflow-y-auto">
                {imageUploads.map((item) => (
                  <div key={item.id} className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-slate-700 truncate max-w-[200px]" title={item.name}>
                        {item.name}
                      </span>
                      <span
                        className={cn(
                          'whitespace-nowrap rounded px-1.5 py-0.5 font-medium',
                          item.status === 'success'
                            ? 'bg-emerald-100 text-emerald-700'
                            : item.status === 'error'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-sky-100 text-sky-700',
                        )}
                      >
                        {item.status === 'success' ? '成功' : item.status === 'error' ? '失败' : '上传中'}
                      </span>
                    </div>
                    <Progress value={item.progress} className="h-1.5" />
                    {item.url ? (
                      <div className="text-xs">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline truncate block"
                          title={item.url}
                        >
                          {item.url}
                        </a>
                      </div>
                    ) : null}
                    {item.error ? <p className="text-xs text-rose-600">{item.error}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>画幅比例</Label>
            <Select
              value={values.aspectRatio}
              onValueChange={(value) => setValues((prev) => ({ ...prev, aspectRatio: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择画幅" />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_RATIO_OPTIONS.map((ratio) => (
                  <SelectItem key={ratio} value={ratio}>
                    {ratio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="video-watermark">水印（可选）</Label>
            <Input
              id="video-watermark"
              value={values.watermark}
              onChange={(event) => setValues((prev) => ({ ...prev, watermark: event.target.value }))}
              placeholder="例如：MyBrand"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="video-callback">回调地址（可选）</Label>
            <Input
              id="video-callback"
              value={values.callbackUrl}
              onChange={(event) => setValues((prev) => ({ ...prev, callbackUrl: event.target.value }))}
              placeholder="https://your-domain.com/callback"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="video-seeds">随机种子（可选）</Label>
            <Input
              id="video-seeds"
              value={values.seeds}
              onChange={(event) => setValues((prev) => ({ ...prev, seeds: event.target.value }))}
              placeholder="例如：12345"
            />
          </div>
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="video-fallback"
                checked={values.enableFallback}
                onCheckedChange={(checked) =>
                  setValues((prev) => ({ ...prev, enableFallback: Boolean(checked) }))
                }
              />
              <Label htmlFor="video-fallback" className="text-sm text-muted-foreground">
                启用备用模型 (enableFallback)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="video-translation"
                checked={values.enableTranslation}
                onCheckedChange={(checked) =>
                  setValues((prev) => ({ ...prev, enableTranslation: Boolean(checked) }))
                }
              />
              <Label htmlFor="video-translation" className="text-sm text-muted-foreground">
                启用提示词翻译 (enableTranslation)
              </Label>
            </div>
          </div>
        </div>
      </ScrollArea>
      <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
        {onCancel ? (
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            {cancelLabel ?? '取消'}
          </Button>
        ) : null}
        <Button onClick={handleSubmit} disabled={isSubmitting || !values.prompt.trim()}>
          {isSubmitting ? '提交中...' : submitLabel ?? (mode === 'edit' ? '更新任务' : '保存任务')}
        </Button>
      </div>
    </div>
  );
}
