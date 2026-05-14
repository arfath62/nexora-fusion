import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Video as VideoIcon, ChevronLeft, ChevronRight, Image, Music, Pause, Play, Plus, Scissors, Zap } from 'lucide-react';

interface TimelineProps {
  duration: number;
  currentTime: number;
  onTimeChange: (time: number) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
  clips: {
    id: string;
    type: 'video' | 'audio' | 'text' | 'image';
    start: number;
    end: number;
    track: number;
    name: string;
    color: string;
    url?: string;
  }[];
  onUpload?: (file: File) => void;
  selectedClipId?: string | null;
  onSelectClip?: (clipId: string) => void;
}

export default function Timeline({ 
  duration, 
  currentTime, 
  onTimeChange, 
  isPlaying,
  onPlayPause,
  clips,
  onUpload,
  selectedClipId,
  onSelectClip
}: TimelineProps) {
  const [zoom, setZoom] = useState(1);
  const [scrollPosition, setScrollPosition] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate pixel per second based on zoom
  const pixelsPerSecond = 100 * zoom;
  const totalWidth = duration * pixelsPerSecond;
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const clickedTime = (offsetX + scrollPosition) / pixelsPerSecond;
    
    if (clickedTime >= 0 && clickedTime <= duration) {
      onTimeChange(clickedTime);
    }
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleTimelineClick(e);
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && timelineRef.current) {
      handleTimelineClick(e);
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);
  
  const handleScroll = () => {
    if (containerRef.current) {
      setScrollPosition(containerRef.current.scrollLeft);
    }
  };
  
  // Ensure playhead stays in view during playback
  useEffect(() => {
    if (containerRef.current && !isDragging) {
      const playheadPosition = currentTime * pixelsPerSecond;
      const containerWidth = containerRef.current.clientWidth;
      
      // If playhead is outside the visible area, scroll to it
      if (playheadPosition < scrollPosition || playheadPosition > scrollPosition + containerWidth - 100) {
        containerRef.current.scrollTo({
          left: playheadPosition - containerWidth / 2,
          behavior: 'smooth'
        });
      }
    }
  }, [currentTime, pixelsPerSecond, scrollPosition, isDragging]);
  
  // Generate time markers
  const timeMarkers = [];
  const markerInterval = zoom < 0.5 ? 10 : zoom < 1 ? 5 : 1; // Adjust marker frequency based on zoom
  
  for (let i = 0; i <= duration; i += markerInterval) {
    timeMarkers.push(
      <div 
        key={i} 
        className="absolute top-0 h-4 flex flex-col items-center"
        style={{ left: `${i * pixelsPerSecond}px` }}
      >
        <div className="h-full w-px bg-white/20"></div>
        <span className="text-xs text-gray-400 mt-1">{formatTime(i)}</span>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col bg-black/40 border-t border-white/10">
      {/* Controls */}
      <div className="h-12 border-b border-white/10 flex items-center px-3 bg-black/20">
        <button 
          className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10"
          onClick={onPlayPause}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        
        <button className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 ml-2">
          <Scissors size={16} />
        </button>
        
        <button className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10">
          <Zap size={16} />
        </button>
        
        <div className="h-6 w-px bg-white/10 mx-3"></div>
        
        <div className="text-sm text-white font-medium">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
        
        <div className="ml-auto flex items-center gap-2">
          <button 
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10"
            onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
            disabled={zoom <= 0.25}
          >
            <ChevronLeft size={16} />
          </button>
          
          <span className="text-xs text-gray-400">{Math.round(zoom * 100)}%</span>
          
          <button 
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10"
            onClick={() => setZoom(Math.min(2, zoom + 0.25))}
            disabled={zoom >= 2}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      
      {/* Add Track Section */}
      <div className="p-2 flex gap-2 border-b border-white/10">
        <label className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 text-xs flex items-center gap-1 cursor-pointer">
          <Plus size={14} />
          <VideoIcon size={14} />
          <span>Video</span>
          <input type="file" accept="video/*" className="hidden" onChange={(e) => {
            if (e.target.files?.[0] && onUpload) {
              onUpload(e.target.files[0]);
              e.target.value = '';
            }
          }} />
        </label>
        <label className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 text-xs flex items-center gap-1 cursor-pointer">
          <Plus size={14} />
          <Music size={14} />
          <span>Audio</span>
          <input type="file" accept="audio/*" className="hidden" onChange={(e) => {
            if (e.target.files?.[0] && onUpload) {
              onUpload(e.target.files[0]);
              e.target.value = '';
            }
          }} />
        </label>
        <label className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 text-xs flex items-center gap-1 cursor-pointer">
          <Plus size={14} />
          <Image size={14} />
          <span>Image</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
            if (e.target.files?.[0] && onUpload) {
              onUpload(e.target.files[0]);
              e.target.value = '';
            }
          }} />
        </label>
      </div>
      
      {/* Timeline */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-auto relative"
        onScroll={handleScroll}
      >
        {/* Track labels */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-black/60 z-10 flex flex-col border-r border-white/10">
          <div className="h-8 border-b border-white/10"></div>
          <div className="h-12 border-b border-white/10 flex items-center px-3 text-xs text-white">Video 1</div>
          <div className="h-12 border-b border-white/10 flex items-center px-3 text-xs text-white">Video 2</div>
          <div className="h-12 border-b border-white/10 flex items-center px-3 text-xs text-white">Audio</div>
          <div className="h-12 border-b border-white/10 flex items-center px-3 text-xs text-white">Text</div>
        </div>
        
        <div className="ml-24 relative">
          {/* Time markers */}
          <div className="h-8 border-b border-white/10 relative">
            {timeMarkers}
          </div>
          
          {/* Tracks */}
          <div 
            ref={timelineRef}
            className="relative" 
            style={{ width: `${totalWidth}px`, height: 'calc(100% - 32px)' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
          >
            {/* Track backgrounds */}
            <div className="h-12 border-b border-white/10 bg-white/5"></div>
            <div className="h-12 border-b border-white/10 bg-white/5"></div>
            <div className="h-12 border-b border-white/10 bg-white/5"></div>
            <div className="h-12 border-b border-white/10 bg-white/5"></div>
            
            {/* Clips */}
            {clips.map((clip) => (
              <motion.div
                key={clip.id}
                className="absolute rounded-md border overflow-hidden cursor-pointer"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onSelectClip?.(clip.id);
                }}
                style={{
                  left: `${clip.start * pixelsPerSecond}px`,
                  top: `${clip.track * 48}px`,
                  width: `${(clip.end - clip.start) * pixelsPerSecond}px`,
                  height: '40px',
                  backgroundColor: `${clip.color}40`,
                  borderColor: selectedClipId === clip.id ? '#ffffff' : clip.color,
                  boxShadow: selectedClipId === clip.id ? '0 0 0 2px rgba(99, 102, 241, 0.7)' : undefined,
                }}
                whileHover={{ y: -2 }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                <div className="h-5 px-2 flex items-center text-xs text-white font-medium bg-black/40">
                  {clip.type === 'video' && <VideoIcon size={12} className="mr-1" />}
                  {clip.type === 'audio' && <Music size={12} className="mr-1" />}
                  {clip.name}
                </div>
              </motion.div>
            ))}
            
            {/* Playhead */}
            <div 
              className="absolute top-0 bottom-0 w-px bg-indigo-500 z-10 pointer-events-none"
              style={{ left: `${currentTime * pixelsPerSecond}px` }}
            >
              <div className="w-3 h-3 -ml-1.5 bg-indigo-500 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
