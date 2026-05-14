import { useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Maximize2, Plus, Redo, RotateCcw, Share2, Undo } from 'lucide-react';

interface VideoPreviewProps {
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onEnded: () => void;
  clips?: any[];
}

export default function VideoPreview({ currentTime, isPlaying, onTimeUpdate, onEnded, clips }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
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
  
  // Sync video playback with timeline
  useEffect(() => {
    if (videoRef.current) {
      if (Math.abs(videoRef.current.currentTime - currentTime) > 0.5) {
        videoRef.current.currentTime = currentTime;
      }
      
      if (isPlaying && videoRef.current.paused) {
        videoRef.current.play();
      } else if (!isPlaying && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [currentTime, isPlaying]);
  
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      onTimeUpdate(videoRef.current.currentTime);
    }
  };
  
  // Find active clips based on current time
  const activeVideoUrl = activeMediaClip?.type === 'video' ? activeMediaClip.url : null;
  
  const activeTextClip = clips?.find(clip => clip.type === 'text' && currentTime >= clip.start && currentTime < clip.end);
  
  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="h-12 border-b border-white/10 flex items-center px-3 bg-black/20">
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10">
            <Undo size={16} />
          </button>
          <button className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10">
            <Redo size={16} />
          </button>
        </div>
        
        <div className="h-6 w-px bg-white/10 mx-3"></div>
        
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10">
            <RotateCcw size={16} />
          </button>
          <button className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10">
            <Plus size={16} />
          </button>
        </div>
        
        <div className="ml-auto flex items-center gap-1">
          <button className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10">
            <Maximize2 size={16} />
          </button>
          <button className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10">
            <Share2 size={16} />
          </button>
          <button className="p-1.5 rounded-md text-indigo-400 hover:text-indigo-300 hover:bg-white/10">
            <Download size={16} />
          </button>
        </div>
      </div>
      
      {/* Video preview */}
      <div className="flex-1 flex items-center justify-center p-4 bg-[#050507]">
        <motion.div 
          className="relative max-w-full max-h-full rounded-lg overflow-hidden shadow-2xl"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          {activeVideoUrl ? (
            <video
              key={activeVideoUrl}
              ref={videoRef}
              src={activeVideoUrl}
              className="max-h-[calc(100vh-22rem)] max-w-full bg-black"
              onTimeUpdate={handleTimeUpdate}
              onEnded={onEnded}
              controls
              playsInline
            />
          ) : activeMediaClip?.type === 'image' ? (
            <img src={activeMediaClip.url} alt={activeMediaClip.name} className="max-h-[calc(100vh-22rem)] max-w-full object-contain" />
          ) : (
            <div className="flex h-72 w-[min(48rem,70vw)] items-center justify-center rounded-lg border border-white/10 bg-white/5 px-6 text-center text-sm text-gray-400">
              Upload a video from the timeline to preview and edit it here.
            </div>
          )}
          
          {/* Text Overlay */}
          {activeTextClip && (
            <div className="absolute bottom-8 left-0 right-0 flex justify-center">
              <div className="bg-black/70 backdrop-blur-sm px-6 py-3 rounded-lg text-white font-bold text-2xl shadow-lg">
                {activeTextClip.name}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
