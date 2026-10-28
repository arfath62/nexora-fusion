import { useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Maximize2, Plus, Redo, RotateCcw, Share2, Undo } from 'lucide-react';

interface VideoPreviewProps {
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onEnded: () => void;
  clips?: any[];
  onUndo?: () => void;
  onRedo?: () => void;
  onReset?: () => void;
  onAddText?: () => void;
  onFullscreen?: () => void;
  onShare?: () => void;
  onDownload?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isExporting?: boolean;
  screenRatio?: string;
}

const filterPresets: Record<string, string> = {
  none: '',
  cinematic: 'contrast(1.14) saturate(1.12) brightness(0.96)',
  vibrant: 'contrast(1.08) saturate(1.32) brightness(1.04)',
  noir: 'grayscale(1) contrast(1.28)',
  vintage: 'sepia(0.42) contrast(0.96) saturate(0.9)',
  warm: 'sepia(0.16) saturate(1.12) brightness(1.03)',
  cool: 'hue-rotate(186deg) saturate(1.08) brightness(0.98)',
};

function buildClipFilter(clip: any) {
  const preset = filterPresets[clip?.filter ?? 'none'] ?? '';
  const brightness = 1 + Number(clip?.brightness ?? 0) / 100;
  const contrast = 1 + Number(clip?.contrast ?? 0) / 100;
  const saturation = 1 + Number(clip?.saturation ?? 0) / 100;
  const blur = Number(clip?.blur ?? 0);
  return `${preset} brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) blur(${blur}px)`.trim();
}

export default function VideoPreview({
  currentTime,
  isPlaying,
  onTimeUpdate,
  onEnded,
  clips,
  onUndo,
  onRedo,
  onReset,
  onAddText,
  onFullscreen,
  onShare,
  onDownload,
  canUndo,
  canRedo,
  isExporting,
  screenRatio = '16 / 9',
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeMediaClip = useMemo(
    () =>
      clips?.find(
        (clip) =>
          (clip.type === 'video' || clip.type === 'image') &&
          clip.url &&
          currentTime >= clip.start &&
          currentTime < clip.end
      ),
    [clips, currentTime]
  );
  const activeAudioClip = useMemo(
    () =>
      clips?.find(
        (clip) =>
          clip.type === 'audio' &&
          clip.url &&
          currentTime >= clip.start &&
          currentTime < clip.end
      ),
    [clips, currentTime]
  );
  
  // Sync video playback with timeline
  useEffect(() => {
    if (videoRef.current) {
      const clipStart = activeMediaClip?.start ?? 0;
      const sourceStart = activeMediaClip?.sourceStart ?? 0;
      const clipLocalTime = Math.max(0, currentTime - clipStart + sourceStart);
      if (Math.abs(videoRef.current.currentTime - clipLocalTime) > 0.5) {
        videoRef.current.currentTime = clipLocalTime;
      }
      videoRef.current.playbackRate = activeMediaClip?.playbackRate ?? 1;
      
      if (isPlaying && videoRef.current.paused) {
        videoRef.current.play();
      } else if (!isPlaying && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [currentTime, isPlaying, activeMediaClip]);

  useEffect(() => {
    if (!audioRef.current || !activeAudioClip) return;
    const clipLocalTime = Math.max(0, currentTime - activeAudioClip.start + (activeAudioClip.sourceStart ?? 0));
    if (Math.abs(audioRef.current.currentTime - clipLocalTime) > 0.5) {
      audioRef.current.currentTime = clipLocalTime;
    }
    audioRef.current.playbackRate = activeAudioClip.playbackRate ?? 1;
    audioRef.current.volume = Math.max(0, Math.min(1, (activeAudioClip.opacity ?? 100) / 100));
    if (isPlaying && audioRef.current.paused) {
      audioRef.current.play();
    } else if (!isPlaying && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, [currentTime, isPlaying, activeAudioClip]);
  
  const handleTimeUpdate = () => {
    if (videoRef.current && activeMediaClip) {
      const sourceStart = activeMediaClip.sourceStart ?? 0;
      onTimeUpdate(activeMediaClip.start + Math.max(0, videoRef.current.currentTime - sourceStart));
    }
  };
  
  // Find active clips based on current time
  const activeVideoUrl = activeMediaClip?.type === 'video' ? activeMediaClip.url : null;
  
  const activeTextClip = clips?.find(clip => clip.type === 'text' && currentTime >= clip.start && currentTime < clip.end);
  const activeFilter = activeMediaClip ? buildClipFilter(activeMediaClip) : '';
  const activeEffectClass =
    activeMediaClip?.effect === 'zoom-in'
      ? 'scale-105'
      : activeMediaClip?.effect === 'fade-in'
        ? 'opacity-90'
        : activeMediaClip?.effect === 'fade-out'
          ? 'opacity-80'
          : '';
  const textStyle = activeTextClip?.textStyle ?? {
    size: 28,
    color: '#ffffff',
    background: 'rgba(0,0,0,0.72)',
    position: 'bottom',
    weight: 'bold',
  };
  const textPositionClass =
    textStyle.position === 'top'
      ? 'top-8'
      : textStyle.position === 'center'
        ? 'top-1/2 -translate-y-1/2'
        : 'bottom-8';
  
  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="h-12 border-b border-white/10 flex items-center px-3 bg-black/20">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-40"
            title="Undo"
          >
            <Undo size={16} />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-40"
            title="Redo"
          >
            <Redo size={16} />
          </button>
        </div>
        
        <div className="h-6 w-px bg-white/10 mx-3"></div>
        
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onReset}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10"
            title="Reset selected clip"
          >
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            onClick={onAddText}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10"
            title="Add text"
          >
            <Plus size={16} />
          </button>
        </div>
        
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onFullscreen}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10"
            title="Fullscreen preview"
          >
            <Maximize2 size={16} />
          </button>
          <button
            type="button"
            onClick={onShare}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10"
            title="Copy share link"
          >
            <Share2 size={16} />
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={isExporting}
            className="p-1.5 rounded-md text-indigo-400 hover:text-indigo-300 hover:bg-white/10 disabled:opacity-50"
            title={isExporting ? 'Exporting video' : 'Export and download'}
          >
            <Download size={16} />
          </button>
        </div>
      </div>
      
      {/* Video preview */}
      <div className="flex-1 flex items-center justify-center p-4 bg-[#050507]">
        {activeAudioClip?.url && <audio key={activeAudioClip.url} ref={audioRef} src={activeAudioClip.url} preload="auto" />}
        <motion.div 
          className="relative flex w-full max-w-[min(100%,56rem)] items-center justify-center overflow-hidden rounded-lg bg-black shadow-2xl"
          style={{
            aspectRatio: screenRatio,
            maxHeight: 'calc(100vh - 22rem)',
            width: screenRatio === '9 / 16' ? 'min(100%, 24rem)' : undefined,
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          {activeVideoUrl ? (
            <video
              key={activeVideoUrl}
              ref={videoRef}
              src={activeVideoUrl}
              className={`h-full w-full bg-black object-contain transition-all duration-300 ${activeEffectClass}`}
              style={{ filter: activeFilter, opacity: (activeMediaClip?.opacity ?? 100) / 100 }}
              onTimeUpdate={handleTimeUpdate}
              onEnded={onEnded}
              controls
              playsInline
            />
          ) : activeMediaClip?.type === 'image' ? (
            <img
              src={activeMediaClip.url}
              alt={activeMediaClip.name}
              className={`h-full w-full object-contain transition-all duration-300 ${activeEffectClass}`}
              style={{ filter: activeFilter, opacity: (activeMediaClip?.opacity ?? 100) / 100 }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center border border-white/10 bg-white/5 px-6 text-center text-sm text-gray-400">
              Upload a video from the timeline to preview and edit it here.
            </div>
          )}
          
          {/* Text Overlay */}
          {activeTextClip && (
            <div className={`absolute left-0 right-0 flex justify-center px-6 ${textPositionClass}`}>
              <div
                className="max-w-[82%] rounded-lg px-6 py-3 text-center shadow-lg backdrop-blur-sm"
                style={{
                  background: textStyle.background,
                  color: textStyle.color,
                  fontSize: `${textStyle.size}px`,
                  fontWeight: textStyle.weight,
                }}
              >
                {activeTextClip.name}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
