import React, { useEffect, useState } from 'react';
import {
  Download, File as FileIcon, FileArchive, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo,
  Loader2, Maximize2, Play, Presentation, X,
} from 'lucide-react';
import { cn } from './UIComponents';
import { fileBlob, GroupAttachment } from '../services/groupService';

// Files in the group chat, shown by what they are: photos inline, video and audio players,
// PDFs previewed in a viewer, and everything else as a card to download.

export type MediaKind = 'image' | 'video' | 'audio' | 'pdf' | 'doc' | 'sheet' | 'slides' | 'text' | 'archive' | 'file';

export const mediaKind = (type: string, name = ''): MediaKind => {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (type === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (/word/.test(type) || ['doc', 'docx'].includes(ext)) return 'doc';
  if (/sheet|excel/.test(type) || ['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet';
  if (/presentation|powerpoint/.test(type) || ['ppt', 'pptx'].includes(ext)) return 'slides';
  if (/zip/.test(type) || ext === 'zip') return 'archive';
  if (type.startsWith('text/')) return 'text';
  return 'file';
};

export const KIND_STYLE: Record<MediaKind, { icon: React.ElementType; tone: string; label: string }> = {
  image: { icon: FileImage, tone: 'text-gray-500 bg-gray-100 dark:bg-white/[.06] dark:text-gray-400', label: 'Image' },
  video: { icon: FileVideo, tone: 'text-gray-500 bg-gray-100 dark:bg-white/[.06] dark:text-gray-400', label: 'Video' },
  audio: { icon: FileAudio, tone: 'text-gray-500 bg-gray-100 dark:bg-white/[.06] dark:text-gray-400', label: 'Audio' },
  pdf: { icon: FileText, tone: 'text-gray-500 bg-gray-100 dark:bg-white/[.06] dark:text-gray-400', label: 'PDF' },
  doc: { icon: FileText, tone: 'text-gray-500 bg-gray-100 dark:bg-white/[.06] dark:text-gray-400', label: 'Word' },
  sheet: { icon: FileSpreadsheet, tone: 'text-gray-500 bg-gray-100 dark:bg-white/[.06] dark:text-gray-400', label: 'Spreadsheet' },
  slides: { icon: Presentation, tone: 'text-gray-500 bg-gray-100 dark:bg-white/[.06] dark:text-gray-400', label: 'Slides' },
  text: { icon: FileText, tone: 'text-gray-500 bg-gray-100 dark:bg-white/[.06] dark:text-gray-400', label: 'Text' },
  archive: { icon: FileArchive, tone: 'text-gray-500 bg-gray-100 dark:bg-white/[.06] dark:text-gray-400', label: 'Zip' },
  file: { icon: FileIcon, tone: 'text-gray-500 bg-gray-100 dark:bg-white/[.06] dark:text-gray-400', label: 'File' },
};

export const formatSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// One download per file for the whole session; previews reuse the same object URL.
const urls = new Map<string, Promise<string>>();
export const fileUrl = (groupId: string, file: GroupAttachment) => {
  if (!urls.has(file.id)) {
    const loading = fileBlob(groupId, file.id).then(blob => URL.createObjectURL(blob));
    loading.catch(() => urls.delete(file.id));
    urls.set(file.id, loading);
  }
  return urls.get(file.id)!;
};

const useFileUrl = (groupId: string, file: GroupAttachment, enabled: boolean) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    fileUrl(groupId, file).then(u => live && setUrl(u)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [groupId, file, enabled]);
  return { url, failed };
};

export const downloadFile = async (groupId: string, file: GroupAttachment) => {
  const a = document.createElement('a');
  a.href = await fileUrl(groupId, file);
  a.download = file.filename;
  a.click();
};

/** Full-screen viewer for photos, PDFs and video. */
export const MediaViewer: React.FC<{ groupId: string; file: GroupAttachment; onClose: () => void }> = ({ groupId, file, onClose }) => {
  const kind = mediaKind(file.content_type, file.filename);
  const { url, failed } = useFileUrl(groupId, file, true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/85 backdrop-blur-sm animate-in" role="dialog" aria-label={file.filename} onClick={onClose}>
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 text-white" onClick={e => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{file.filename}</p>
          <p className="text-xs text-white/60">{KIND_STYLE[kind].label} · {formatSize(file.size_bytes)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => downloadFile(groupId, file)} className="flex h-9 items-center gap-1.5 rounded-md px-3 text-sm hover:bg-white/10" aria-label="Download">
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download</span>
          </button>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/10" aria-label="Close viewer">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 pt-0" onClick={e => e.stopPropagation()}>
        {failed ? <p className="text-sm text-white/70">Couldn't open this file.</p>
          : !url ? <Loader2 className="h-6 w-6 animate-spin text-white/70" />
          : kind === 'image' ? <img src={url} alt={file.filename} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
          : kind === 'video' ? <video src={url} controls autoPlay className="max-h-full max-w-full rounded-lg shadow-2xl" />
          : kind === 'pdf' ? <iframe src={url} title={file.filename} className="h-full w-full max-w-5xl rounded-lg bg-white" />
          : <p className="text-sm text-white/70">No preview for this type. Download it to open.</p>}
      </div>
    </div>
  );
};

const Thumb: React.FC<{ groupId: string; file: GroupAttachment; onOpen: () => void; className?: string }> = ({ groupId, file, onOpen, className }) => {
  const { url, failed } = useFileUrl(groupId, file, true);
  return (
    <button onClick={onOpen} className={cn("group/thumb relative block overflow-hidden rounded-lg bg-black/5 dark:bg-white/5", className)} aria-label={`Open ${file.filename}`}>
      {url ? <img src={url} alt={file.filename} className="h-full w-full object-cover transition-opacity duration-150 group-hover/thumb:opacity-90" />
        : <span className="flex h-full w-full items-center justify-center">{failed ? <FileImage className="h-5 w-5 text-gray-400" /> : <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}</span>}
      <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-black/50 text-white opacity-0 transition-opacity group-hover/thumb:opacity-100">
        <Maximize2 className="h-3.5 w-3.5" />
      </span>
    </button>
  );
};

const VideoTile: React.FC<{ groupId: string; file: GroupAttachment }> = ({ groupId, file }) => {
  const [play, setPlay] = useState(false);
  const { url } = useFileUrl(groupId, file, play);
  return play && url ? (
    <video src={url} controls autoPlay className="w-full max-w-sm rounded-lg bg-black" />
  ) : (
    <button onClick={() => setPlay(true)} className="relative flex aspect-video w-full max-w-sm items-center justify-center overflow-hidden rounded-lg bg-gray-900 text-white">
      {play ? <Loader2 className="h-6 w-6 animate-spin" /> : (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25">
          <Play className="ml-0.5 h-5 w-5 fill-white" />
        </span>
      )}
      <span className="absolute bottom-2 left-2 right-2 truncate text-left text-xs text-white/80">{file.filename} · {formatSize(file.size_bytes)}</span>
    </button>
  );
};

const AudioTile: React.FC<{ groupId: string; file: GroupAttachment; mine: boolean }> = ({ groupId, file, mine }) => {
  const [play, setPlay] = useState(false);
  const { url } = useFileUrl(groupId, file, play);
  return (
    <div className={cn("w-64 max-w-full rounded-lg border p-2.5", mine ? "border-white/20 bg-white/10" : "border-gray-200 bg-white dark:border-white/[.08] dark:bg-white/[.03]")}>
      <div className="flex items-center gap-2.5">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", KIND_STYLE.audio.tone)}><FileAudio className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{file.filename}</p>
          <p className={cn("text-[11px]", mine ? "text-white/70" : "text-gray-500")}>{formatSize(file.size_bytes)}</p>
        </div>
        {!play && (
          <button onClick={() => setPlay(true)} className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white transition-colors hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white")} aria-label={`Play ${file.filename}`}>
            <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
          </button>
        )}
      </div>
      {play && (url ? <audio src={url} controls autoPlay className="mt-2 h-9 w-full" /> : <Loader2 className="mx-auto mt-2 h-4 w-4 animate-spin" />)}
    </div>
  );
};

export const FileCard: React.FC<{ groupId: string; file: GroupAttachment; mine?: boolean; onPreview?: () => void }> = ({ groupId, file, mine = false, onPreview }) => {
  const kind = mediaKind(file.content_type, file.filename);
  const style = KIND_STYLE[kind];
  return (
    <div className={cn("flex w-64 max-w-full items-center gap-2.5 rounded-lg border p-2.5", mine ? "border-white/20 bg-white/10" : "border-gray-200 bg-white dark:border-white/[.08] dark:bg-white/[.03]")}>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", style.tone)}><style.icon className="h-4.5 w-4.5" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{file.filename}</p>
        <p className={cn("text-[11px]", mine ? "text-white/70" : "text-gray-500")}>{style.label} · {formatSize(file.size_bytes)}</p>
      </div>
      {onPreview && (
        <button onClick={onPreview} className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", mine ? "hover:bg-white/15" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[.06]")} title="Preview" aria-label={`Preview ${file.filename}`}>
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      )}
      <button onClick={() => downloadFile(groupId, file)} className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", mine ? "hover:bg-white/15" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[.06]")} title="Download" aria-label={`Download ${file.filename}`}>
        <Download className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

/** All of a message's files, laid out by type. */
export const MessageMedia: React.FC<{ groupId: string; files: GroupAttachment[]; mine: boolean; onOpen: (file: GroupAttachment) => void }> = ({ groupId, files, mine, onOpen }) => {
  const images = files.filter(f => mediaKind(f.content_type, f.filename) === 'image');
  const rest = files.filter(f => mediaKind(f.content_type, f.filename) !== 'image');
  return (
    <div className="space-y-1.5">
      {images.length > 0 && (
        <div className={cn("grid gap-1", images.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
          {images.map((file, i) => (
            <Thumb
              key={file.id}
              groupId={groupId}
              file={file}
              onOpen={() => onOpen(file)}
              className={cn(images.length === 1 ? "max-h-72 w-full max-w-sm aspect-[4/3]" : "aspect-square w-32 sm:w-36", images.length === 3 && i === 0 && "col-span-2 w-full aspect-[2/1]")}
            />
          ))}
        </div>
      )}
      {rest.map(file => {
        const kind = mediaKind(file.content_type, file.filename);
        if (kind === 'video') return <VideoTile key={file.id} groupId={groupId} file={file} />;
        if (kind === 'audio') return <AudioTile key={file.id} groupId={groupId} file={file} mine={mine} />;
        return <FileCard key={file.id} groupId={groupId} file={file} mine={mine} onPreview={kind === 'pdf' ? () => onOpen(file) : undefined} />;
      })}
    </div>
  );
};
