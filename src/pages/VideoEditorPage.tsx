import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Scissors, Trash2 } from 'lucide-react';
import VideoPreview from '../components/VideoEditor/VideoPreview';
import Timeline from '../components/VideoEditor/Timeline';
import CommandInput from '../components/VideoEditor/CommandInput';
import databaseService from '../services/DatabaseService';

type Clip = {
  id: string;
  type: 'video' | 'audio' | 'text' | 'image';
  start: number;
  end: number;
  track: number;
  name: string;
  color: string;
  url?: string;
};

const initialClips: Clip[] = [
  {
    id: 'text-welcome',
    type: 'text',
    start: 0,
    end: 5,
    track: 3,
    name: 'Upload a video to start',
    color: '#F59E0B',
  },
];

export default function VideoEditorPage() {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(60); // Assume 1 minute video
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [clips, setClips] = useState<Clip[]>(initialClips);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const selectedClip = clips.find((clip) => clip.id === selectedClipId) ?? null;

  useEffect(() => {
    const loadProject = async () => {
      try {
        const project = await databaseService.getVideoProject('default-video-project');
        if (!project) return;

        if (Array.isArray(project.clips)) setClips(project.clips);
        if (typeof project.videoDuration === 'number') setVideoDuration(project.videoDuration);
        if (Array.isArray(project.commandHistory)) setCommandHistory(project.commandHistory);
      } catch (error) {
        console.error('Failed to load video project:', error);
      }
    };

    loadProject();
  }, []);

  useEffect(() => {
    const saveProject = async () => {
      try {
        await databaseService.saveVideoProject('default-video-project', {
          id: 'default-video-project',
          updatedAt: new Date().toISOString(),
          clips,
          commandHistory,
          videoDuration,
        });
      } catch (error) {
        console.error('Failed to save video project:', error);
      }
    };

    saveProject();
  }, [clips, commandHistory, videoDuration]);
  
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };
  
  const handleTimeChange = (time: number) => {
    setCurrentTime(time);
  };
  
  const handleVideoEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };
  
  const handleUpload = async (file: File) => {
    try {
      const data = await databaseService.uploadMedia(file);
      const type = file.type.startsWith('audio') ? 'audio' as const : 
                   file.type.startsWith('image') ? 'image' as const : 'video' as const;
      
      const newClip: Clip = {
        id: `clip_${Date.now()}`,
        type,
        start: type === 'video' ? 0 : currentTime,
        end: type === 'video' ? Math.max(videoDuration, 30) : currentTime + 10,
        track: type === 'audio' ? 2 : 0,
        name: data.originalName,
        color: type === 'audio' ? '#10B981' : type === 'image' ? '#F59E0B' : '#8B5CF6',
        url: data.url
      };
      setClips(prev => {
        const withoutPlaceholders = type === 'video' ? prev.filter((clip) => clip.url || clip.type !== 'video') : prev;
        return [...withoutPlaceholders.filter((clip) => clip.id !== 'text-welcome'), newClip];
      });
      setSelectedClipId(newClip.id);
      if (type === 'video') setCurrentTime(0);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  const updateSelectedClip = (patch: Partial<Clip>) => {
    if (!selectedClip) return;
    setClips((prev) =>
      prev.map((clip) =>
        clip.id === selectedClip.id
          ? {
              ...clip,
              ...patch,
              start: Math.max(0, patch.start ?? clip.start),
              end: Math.max((patch.start ?? clip.start) + 0.5, patch.end ?? clip.end),
            }
          : clip
      )
    );
  };

  const deleteSelectedClip = () => {
    if (!selectedClip) return;
    setClips((prev) => prev.filter((clip) => clip.id !== selectedClip.id));
    setSelectedClipId(null);
  };

  const splitSelectedClip = () => {
    if (!selectedClip || currentTime <= selectedClip.start || currentTime >= selectedClip.end) return;
    const left: Clip = { ...selectedClip, end: currentTime, name: `${selectedClip.name} A` };
    const right: Clip = {
      ...selectedClip,
      id: `${selectedClip.id}_split_${Date.now()}`,
      start: currentTime,
      name: `${selectedClip.name} B`,
    };
    setClips((prev) => prev.flatMap((clip) => (clip.id === selectedClip.id ? [left, right] : [clip])));
    setSelectedClipId(right.id);
  };
  
  const handleCommandSubmit = async (command: string) => {
    setIsProcessingCommand(true);
    setCommandHistory(prev => [...prev, command]);
    
    try {
      await databaseService.saveVideoProject('default-video-project', {
        id: 'default-video-project',
        updatedAt: new Date().toISOString(),
        clips,
        commandHistory: [...commandHistory, command],
        videoDuration,
      });

      const job = await databaseService.createVideoJob('default-video-project', command);
      
      const poll = async () => {
        const updatedJob = await databaseService.getVideoJob(job.id);
        if (updatedJob.status === 'completed') {
          setIsProcessingCommand(false);
          try {
             if (updatedJob.result) {
                const res = JSON.parse(updatedJob.result);
                if (res.url && (command.includes('render') || command.includes('export'))) {
                   alert('Video Rendered Successfully! Download at: ' + res.url);
                }
             }
          } catch(e) {}
          
          if (command.includes('add text')) {
            const newText: any = {
              id: `text${Date.now()}`,
              type: 'text' as const,
              start: currentTime,
              end: currentTime + 5,
              track: 3,
              name: 'New Text',
              color: '#F59E0B'
            };
            setClips(prev => [...prev, newText]);
          }
        } else if (updatedJob.status === 'failed') {
          setIsProcessingCommand(false);
          console.error('Job failed:', updatedJob.error);
          alert('Job Failed: ' + updatedJob.error);
        } else {
          setTimeout(poll, 1000);
        }
      };
      
      poll();
    } catch (error) {
      console.error('Failed to submit command:', error);
      setIsProcessingCommand(false);
    }
  };
  
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex">
        {/* Video preview section */}
        <div className="w-2/3 border-r border-white/10">
          <VideoPreview 
            currentTime={currentTime}
            isPlaying={isPlaying}
            onTimeUpdate={handleTimeChange}
            onEnded={handleVideoEnded}
            clips={clips}
          />
        </div>
        
        {/* Side panel - Simplified version */}
        <div className="w-1/3 flex flex-col bg-black/20 backdrop-blur-xl">
          <div className="h-12 border-b border-white/10 flex items-center px-4">
            <h2 className="text-sm font-medium text-white">Properties</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {/* Clip Properties */}
              <motion.div 
                className="bg-white/5 rounded-lg border border-white/10 overflow-hidden"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="px-4 py-2 bg-white/5 border-b border-white/10">
                  <h3 className="text-sm font-medium text-white">Video Settings</h3>
                </div>
                {selectedClip ? (
                <div className="p-4 space-y-3">
                  <div className="space-y-1">
                    <label className="block text-xs text-gray-400">Selected clip</label>
                    <input
                      value={selectedClip.name}
                      onChange={(e) => updateSelectedClip({ name: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs text-gray-400">Start</label>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={selectedClip.start}
                        onChange={(e) => updateSelectedClip({ start: Number(e.target.value) })}
                        className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs text-gray-400">End</label>
                      <input
                        type="number"
                        min={selectedClip.start + 0.5}
                        step={0.1}
                        value={selectedClip.end}
                        onChange={(e) => updateSelectedClip({ end: Number(e.target.value) })}
                        className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => databaseService.saveVideoProject('default-video-project', {
                        id: 'default-video-project',
                        updatedAt: new Date().toISOString(),
                        clips,
                        commandHistory,
                        videoDuration,
                      })}
                      className="flex items-center justify-center gap-1 rounded-md bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15"
                    >
                      <Save size={14} />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={splitSelectedClip}
                      className="flex items-center justify-center gap-1 rounded-md bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15"
                    >
                      <Scissors size={14} />
                      Split
                    </button>
                    <button
                      type="button"
                      onClick={deleteSelectedClip}
                      className="flex items-center justify-center gap-1 rounded-md bg-red-500/15 px-3 py-2 text-xs text-red-100 hover:bg-red-500/25"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
                ) : (
                  <div className="p-4 text-sm text-gray-400">Select a clip on the timeline to edit it.</div>
                )}
              </motion.div>
              
              {/* Effects */}
              <motion.div 
                className="bg-white/5 rounded-lg border border-white/10 overflow-hidden"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <div className="px-4 py-2 bg-white/5 border-b border-white/10">
                  <h3 className="text-sm font-medium text-white">Effects</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="space-y-1">
                    <label className="block text-xs text-gray-400">Filter</label>
                    <select className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white">
                      <option>None</option>
                      <option>Cinematic</option>
                      <option>Vibrant</option>
                      <option>Noir</option>
                      <option>Vintage</option>
                    </select>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="block text-xs text-gray-400">Brightness</label>
                      <span className="text-xs text-gray-400">0%</span>
                    </div>
                    <input 
                      type="range" 
                      min="-100" 
                      max="100" 
                      value="0" 
                      className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="block text-xs text-gray-400">Contrast</label>
                      <span className="text-xs text-gray-400">0%</span>
                    </div>
                    <input 
                      type="range" 
                      min="-100" 
                      max="100" 
                      value="0" 
                      className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500"
                    />
                  </div>
                </div>
              </motion.div>
              
              {/* Command History */}
              <motion.div 
                className="bg-white/5 rounded-lg border border-white/10 overflow-hidden"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <div className="px-4 py-2 bg-white/5 border-b border-white/10">
                  <h3 className="text-sm font-medium text-white">Command History</h3>
                </div>
                <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                  {commandHistory.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No commands yet. Try entering a command below.</p>
                  ) : (
                    commandHistory.map((cmd, i) => (
                      <div key={i} className="text-xs text-gray-300 bg-black/20 p-2 rounded">
                        {cmd}
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Timeline and command input */}
      <div className="h-64 border-t border-white/10">
        <Timeline 
          duration={videoDuration}
          currentTime={currentTime}
          onTimeChange={handleTimeChange}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          clips={clips as any}
          onUpload={handleUpload}
          selectedClipId={selectedClipId}
          onSelectClip={setSelectedClipId}
        />
      </div>
      
      <CommandInput 
        onSubmit={handleCommandSubmit}
        isProcessing={isProcessingCommand}
      />
    </div>
  );
}
