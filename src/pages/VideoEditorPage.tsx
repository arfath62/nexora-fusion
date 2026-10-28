import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Captions, Lock, Save, Scissors, Sparkles, Trash2, Volume2 } from 'lucide-react';
import VideoPreview from '../components/VideoEditor/VideoPreview';
import Timeline from '../components/VideoEditor/Timeline';
import CommandInput from '../components/VideoEditor/CommandInput';
import databaseService from '../services/DatabaseService';
import { useAuth } from '../contexts/AuthContext';
import { getApiBaseUrl } from '../lib/apiEnv';
import { getFeatureAccess, type PlanId } from '../lib/featureAccess';

type Clip = {
  id: string;
  type: 'video' | 'audio' | 'text' | 'image';
  start: number;
  end: number;
  track: number;
  name: string;
  color: string;
  url?: string;
  sourceStart?: number;
  filter?: 'none' | 'cinematic' | 'vibrant' | 'noir' | 'vintage' | 'warm' | 'cool';
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
  playbackRate?: number;
  opacity?: number;
  effect?: 'none' | 'fade-in' | 'fade-out' | 'zoom-in';
  textStyle?: {
    size: number;
    color: string;
    background: string;
    position: 'top' | 'center' | 'bottom';
    weight: 'normal' | 'bold';
  };
};

type ScreenRatio = {
  id: string;
  label: string;
  value: string;
};

const defaultScreenRatio = '16 / 9';

const screenRatios: ScreenRatio[] = [
  { id: defaultScreenRatio, label: 'Default 16:9', value: defaultScreenRatio },
  { id: '9 / 16', label: 'Story 9:16', value: '9 / 16' },
  { id: '1 / 1', label: 'Square 1:1', value: '1 / 1' },
  { id: '4 / 5', label: 'Post 4:5', value: '4 / 5' },
  { id: '4 / 3', label: 'Classic 4:3', value: '4 / 3' },
  { id: '21 / 9', label: 'Wide 21:9', value: '21 / 9' },
];

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

const defaultTextStyle: NonNullable<Clip['textStyle']> = {
  size: 28,
  color: '#ffffff',
  background: 'rgba(0,0,0,0.72)',
  position: 'bottom',
  weight: 'bold',
};

const captionStylePresets: Record<string, NonNullable<Clip['textStyle']>> = {
  classic: defaultTextStyle,
  creator: { size: 34, color: '#ffffff', background: 'rgba(79,70,229,0.82)', position: 'bottom', weight: 'bold' },
  minimal: { size: 24, color: '#ffffff', background: 'rgba(0,0,0,0.28)', position: 'bottom', weight: 'normal' },
  headline: { size: 42, color: '#111827', background: 'rgba(250,204,21,0.92)', position: 'center', weight: 'bold' },
  subtitle: { size: 22, color: '#e5e7eb', background: 'rgba(15,23,42,0.76)', position: 'bottom', weight: 'normal' },
};

const captionLanguages = [
  ['auto', 'Auto detect'],
  ['en', 'English'],
  ['hi', 'Hindi'],
  ['hi-Latn', 'Hinglish'],
  ['es', 'Spanish'],
  ['fr', 'French'],
  ['de', 'German'],
  ['it', 'Italian'],
  ['pt', 'Portuguese'],
  ['nl', 'Dutch'],
  ['sv', 'Swedish'],
  ['no', 'Norwegian'],
  ['da', 'Danish'],
  ['fi', 'Finnish'],
  ['pl', 'Polish'],
  ['cs', 'Czech'],
  ['sk', 'Slovak'],
  ['hu', 'Hungarian'],
  ['ro', 'Romanian'],
  ['bg', 'Bulgarian'],
  ['el', 'Greek'],
  ['tr', 'Turkish'],
  ['ru', 'Russian'],
  ['uk', 'Ukrainian'],
  ['ar', 'Arabic'],
  ['he', 'Hebrew'],
  ['fa', 'Persian'],
  ['ur', 'Urdu'],
  ['bn', 'Bengali'],
  ['ta', 'Tamil'],
  ['te', 'Telugu'],
  ['mr', 'Marathi'],
  ['gu', 'Gujarati'],
  ['kn', 'Kannada'],
  ['ml', 'Malayalam'],
  ['pa', 'Punjabi'],
  ['ne', 'Nepali'],
  ['si', 'Sinhala'],
  ['zh', 'Chinese'],
  ['ja', 'Japanese'],
  ['ko', 'Korean'],
  ['th', 'Thai'],
  ['vi', 'Vietnamese'],
  ['id', 'Indonesian'],
  ['ms', 'Malay'],
  ['fil', 'Filipino'],
  ['sw', 'Swahili'],
  ['af', 'Afrikaans'],
  ['am', 'Amharic'],
  ['az', 'Azerbaijani'],
  ['ca', 'Catalan'],
  ['et', 'Estonian'],
  ['hr', 'Croatian'],
  ['is', 'Icelandic'],
  ['ka', 'Georgian'],
  ['kk', 'Kazakh'],
  ['lt', 'Lithuanian'],
  ['lv', 'Latvian'],
  ['sl', 'Slovenian'],
  ['sr', 'Serbian'],
] as const;

const parseTimeToSeconds = (value: string) => {
  const normalized = value.trim();
  if (normalized.includes(':')) {
    const parts = normalized.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return Number(normalized.replace(/[^\d.]/g, ''));
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function VideoEditorPage() {
  const { user } = useAuth();
  const projectId = `default-video-project-${user?.id ?? 'local'}`;
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(60); // Assume 1 minute video
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [clips, setClips] = useState<Clip[]>(initialClips);
  const clipsRef = useRef<Clip[]>(initialClips);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState('Upload a video, select a clip, or type an edit command.');
  const [captionLanguage, setCaptionLanguage] = useState('auto');
  const [captionPreset, setCaptionPreset] = useState('classic');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [clipHistory, setClipHistory] = useState<Clip[][]>([]);
  const [redoStack, setRedoStack] = useState<Clip[][]>([]);
  const [screenRatio, setScreenRatio] = useState(defaultScreenRatio);
  const [workspacePlan, setWorkspacePlan] = useState<PlanId>('Starter');
  const [planReady, setPlanReady] = useState(false);
  const selectedClip = clips.find((clip) => clip.id === selectedClipId) ?? null;
  const videoAccess = getFeatureAccess('video', workspacePlan);

  useEffect(() => {
    let cancelled = false;
    databaseService
      .getWorkspaceSettings()
      .then((workspace) => {
        if (!cancelled) setWorkspacePlan(workspace.plan);
      })
      .catch(() => {
        if (!cancelled) setWorkspacePlan('Starter');
      })
      .finally(() => {
        if (!cancelled) setPlanReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!planReady || !videoAccess.available) return;
    const loadProject = async () => {
      try {
        const project = await databaseService.getVideoProject(projectId);
        if (!project) return;

        if (Array.isArray(project.clips)) setClips(project.clips);
        if (typeof project.videoDuration === 'number') setVideoDuration(project.videoDuration);
        if (screenRatios.some((ratio) => ratio.value === project.screenRatio)) setScreenRatio(project.screenRatio);
        if (Array.isArray(project.commandHistory)) setCommandHistory(project.commandHistory);
      } catch (error) {
        console.error('Failed to load video project:', error);
      }
    };

    loadProject();
  }, [projectId, planReady, videoAccess.available]);

  useEffect(() => {
    if (!planReady || !videoAccess.available) return;
    const saveProject = async () => {
      try {
        await databaseService.saveVideoProject(projectId, {
          id: projectId,
          updatedAt: new Date().toISOString(),
          clips,
          commandHistory,
          videoDuration,
          screenRatio,
        });
      } catch (error) {
        console.error('Failed to save video project:', error);
      }
    };

    saveProject();
  }, [clips, commandHistory, videoDuration, screenRatio, projectId, planReady, videoAccess.available]);
  
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

  const updateClips = (updater: (prev: Clip[]) => Clip[]) => {
    setClips((prev) => {
      const next = updater(prev);
      clipsRef.current = next;
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        setClipHistory((history) => [...history.slice(-29), prev]);
        setRedoStack([]);
      }
      return next;
    });
  };

  const getAppendPosition = (type: Clip['type'], preferredStart?: number) => {
    const track = type === 'audio' ? 2 : type === 'text' ? 3 : 0;
    const trackEnd = clips
      .filter((clip) => clip.track === track && clip.id !== 'text-welcome')
      .reduce((max, clip) => Math.max(max, clip.end), 0);
    const visualEnd = type === 'video' || type === 'image'
      ? clips
          .filter((clip) => (clip.type === 'video' || clip.type === 'image') && clip.id !== 'text-welcome')
          .reduce((max, clip) => Math.max(max, clip.end), 0)
      : 0;
    return {
      track,
      start: Math.max(preferredStart ?? 0, trackEnd, visualEnd),
    };
  };

  const handleUndo = () => {
    const previous = clipHistory[clipHistory.length - 1];
    if (!previous) return;
    setRedoStack((prev) => [clips, ...prev]);
    setClipHistory((prev) => prev.slice(0, -1));
    setClips(previous);
    setSelectedClipId(null);
    setEditStatus('Undid the last timeline edit.');
  };

  const handleRedo = () => {
    const next = redoStack[0];
    if (!next) return;
    setClipHistory((prev) => [...prev, clips]);
    setRedoStack((prev) => prev.slice(1));
    setClips(next);
    setSelectedClipId(null);
    setEditStatus('Redid the timeline edit.');
  };

  const resetSelectedClip = () => {
    if (!selectedClip) {
      setEditStatus('Select a clip before resetting.');
      return;
    }
    updateSelectedClip({
      filter: 'none',
      brightness: 0,
      contrast: 0,
      saturation: 0,
      blur: 0,
      playbackRate: 1,
      opacity: 100,
      effect: 'none',
      textStyle: selectedClip.type === 'text' ? defaultTextStyle : selectedClip.textStyle,
    });
    setEditStatus('Reset selected clip adjustments.');
  };

  const applyQuickLook = () => {
    if (!selectedClip) {
      setEditStatus('Select a clip before applying a quick look.');
      return;
    }
    updateSelectedClip({ filter: 'cinematic', contrast: 16, saturation: 12, effect: 'fade-in' });
    setEditStatus('Applied a cinematic quick look.');
  };

  const openFullscreenPreview = () => {
    const preview = document.querySelector('[data-video-preview]');
    if (preview instanceof HTMLElement) {
      void preview.requestFullscreen?.();
    }
  };

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?project=${encodeURIComponent(projectId)}`);
    setEditStatus('Project share link copied.');
  };

  const downloadUrl = (url: string, filename: string) => {
    const apiBaseUrl = getApiBaseUrl();
    const absoluteUrl = url.startsWith('http') ? url : `${apiBaseUrl}${url}`;
    const anchor = document.createElement('a');
    anchor.href = absoluteUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const exportVideo = async () => {
    if (!clips.some((clip) => clip.type === 'video' && clip.url)) {
      setEditStatus('Upload a video clip before exporting.');
      return;
    }
    setIsExporting(true);
    setEditStatus('Exporting video...');
    try {
      await databaseService.saveVideoProject(projectId, {
        id: projectId,
        updatedAt: new Date().toISOString(),
        clips: clipsRef.current,
        commandHistory,
        videoDuration,
        screenRatio,
      });
      const job = await databaseService.createVideoJob(projectId, 'export final video');
      const startedAt = Date.now();
      while (Date.now() - startedAt < 120000) {
        const updatedJob = await databaseService.getVideoJob(job.id);
        if (updatedJob.status === 'completed') {
          const result = typeof updatedJob.result === 'string' ? JSON.parse(updatedJob.result) : updatedJob.result;
          if (result?.url) {
            downloadUrl(result.url, `nexora-export-${new Date().toISOString().slice(0, 10)}.mp4`);
            setEditStatus('Video exported and download started.');
            return;
          }
          throw new Error('Export completed without a download URL.');
        }
        if (updatedJob.status === 'failed') {
          throw new Error(updatedJob.error || 'Video export failed.');
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      throw new Error('Video export timed out.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Video export failed.';
      setEditStatus(message);
      alert(message);
    } finally {
      setIsExporting(false);
    }
  };
  
  const handleUpload = async (file: File, preferredStart?: number) => {
    try {
      const data = await databaseService.uploadMedia(file);
      const type = file.type.startsWith('audio') ? 'audio' as const : 
                   file.type.startsWith('image') ? 'image' as const : 'video' as const;
      const defaultDuration = type === 'video' ? 30 : type === 'audio' ? 10 : 8;
      const position = getAppendPosition(type, preferredStart);
      
      const newClip: Clip = {
        id: `clip_${Date.now()}`,
        type,
        start: position.start,
        end: position.start + defaultDuration,
        track: position.track,
        name: data.originalName,
        color: type === 'audio' ? '#10B981' : type === 'image' ? '#F59E0B' : '#8B5CF6',
        url: data.url,
        sourceStart: 0,
        filter: 'none',
        brightness: 0,
        contrast: 0,
        saturation: 0,
        playbackRate: 1,
        opacity: 100,
        effect: 'none',
      };
      updateClips(prev => {
        return [...prev.filter((clip) => clip.id !== 'text-welcome'), newClip];
      });
      setSelectedClipId(newClip.id);
      setVideoDuration((duration) => Math.max(duration, newClip.end));
      setCurrentTime(newClip.start);
      setEditStatus(`${data.originalName} uploaded at ${newClip.start.toFixed(1)}s.`);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  const updateSelectedClip = (patch: Partial<Clip>) => {
    if (!selectedClip) return;
    updateClips((prev) =>
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

  const addTextClip = (text: string, start = currentTime, duration = 5) => {
    const newText: Clip = {
      id: `text_${Date.now()}`,
      type: 'text',
      start: clamp(start, 0, Math.max(videoDuration, start + duration)),
      end: clamp(start + duration, start + 0.5, Math.max(videoDuration, start + duration)),
      track: 3,
      name: text,
      color: '#F59E0B',
      textStyle: captionStylePresets[captionPreset] ?? defaultTextStyle,
    };
    updateClips((prev) => [...prev.filter((clip) => clip.id !== 'text-welcome'), newText]);
    setSelectedClipId(newText.id);
    setEditStatus(`Added caption/text: "${text}"`);
  };

  const addCaptionClips = (captions: Array<{ start: number; end: number; text: string }>, sourceClip: Clip) => {
    const style = captionStylePresets[captionPreset] ?? defaultTextStyle;
    const captionClips: Clip[] = captions.map((caption, index) => ({
      id: `caption_${Date.now()}_${index}`,
      type: 'text',
      start: sourceClip.start + Math.max(0, caption.start),
      end: sourceClip.start + Math.max(caption.end, caption.start + 0.8),
      track: 3,
      name: caption.text,
      color: '#F59E0B',
      textStyle: style,
    }));
    updateClips((prev) => [...prev.filter((clip) => clip.id !== 'text-welcome'), ...captionClips]);
    setSelectedClipId(captionClips[0]?.id ?? sourceClip.id);
    setEditStatus(`Added ${captionClips.length} real-time caption segments.`);
  };

  const generateCaptions = async () => {
    const sourceClip = selectedClip?.url ? selectedClip : clips.find((clip) => (clip.type === 'video' || clip.type === 'audio') && clip.url);
    if (!sourceClip?.url) {
      setEditStatus('Upload or select a video/audio clip before generating captions.');
      return;
    }
    setIsTranscribing(true);
    setEditStatus(`Transcribing ${sourceClip.name} in ${captionLanguages.find(([code]) => code === captionLanguage)?.[1] ?? captionLanguage}...`);
    try {
      const result = await databaseService.transcribeMedia(sourceClip.url, captionLanguage);
      addCaptionClips(result.captions, sourceClip);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transcription failed';
      setEditStatus(message);
      alert(message);
    } finally {
      setIsTranscribing(false);
    }
  };

  const applyPatchToEditableClips = (patch: Partial<Clip>, scope: 'selected' | 'all' = 'selected') => {
    updateClips((prev) =>
      prev.map((clip) => {
        const isEditableMedia = clip.type === 'video' || clip.type === 'image';
        const shouldPatch = scope === 'all' ? isEditableMedia : clip.id === selectedClipId;
        return shouldPatch ? { ...clip, ...patch } : clip;
      })
    );
  };

  const cutTimelineRange = (from: number, to: number) => {
    const start = clamp(Math.min(from, to), 0, videoDuration);
    const end = clamp(Math.max(from, to), start + 0.1, videoDuration);
    updateClips((prev) =>
      prev.flatMap((clip) => {
        if (clip.end <= start || clip.start >= end) return [clip];
        if (clip.start >= start && clip.end <= end) return [];

        const sourceStart = clip.sourceStart ?? 0;
        if (clip.start < start && clip.end > end) {
          return [
            { ...clip, end: start, name: `${clip.name} before cut` },
            {
              ...clip,
              id: `${clip.id}_after_cut_${Date.now()}`,
              start: end,
              sourceStart: sourceStart + (end - clip.start),
              name: `${clip.name} after cut`,
            },
          ];
        }

        if (clip.start < start) return [{ ...clip, end: start }];
        return [{ ...clip, start: end, sourceStart: sourceStart + (end - clip.start) }];
      })
    );
    setCurrentTime(start);
    setEditStatus(`Cut timeline section ${start.toFixed(1)}s to ${end.toFixed(1)}s.`);
  };

  const deleteSelectedClip = () => {
    if (!selectedClip) return;
    updateClips((prev) => prev.filter((clip) => clip.id !== selectedClip.id));
    setSelectedClipId(null);
  };

  const splitSelectedClip = () => {
    if (!selectedClip || currentTime <= selectedClip.start || currentTime >= selectedClip.end) return;
    const sourceStart = selectedClip.sourceStart ?? 0;
    const left: Clip = { ...selectedClip, end: currentTime, name: `${selectedClip.name} A` };
    const right: Clip = {
      ...selectedClip,
      id: `${selectedClip.id}_split_${Date.now()}`,
      start: currentTime,
      sourceStart: sourceStart + (currentTime - selectedClip.start),
      name: `${selectedClip.name} B`,
    };
    updateClips((prev) => prev.flatMap((clip) => (clip.id === selectedClip.id ? [left, right] : [clip])));
    setSelectedClipId(right.id);
  };

  const applyLocalCommand = (command: string) => {
    const lower = command.toLowerCase();
    const quoted = command.match(/"([^"]+)"/)?.[1];
    const range = lower.match(/(?:from|between)\s+([\d:.]+)\s+(?:to|and|-)\s+([\d:.]+)/);
    const at = lower.match(/\bat\s+([\d:.]+)/);
    const duration = lower.match(/(?:for|duration)\s+([\d.]+)\s*(?:s|sec|seconds)?/);

    if ((lower.includes('cut') || lower.includes('remove') || lower.includes('delete')) && range) {
      cutTimelineRange(parseTimeToSeconds(range[1]), parseTimeToSeconds(range[2]));
      return true;
    }

    if (lower.includes('trim') && range && selectedClip) {
      const start = parseTimeToSeconds(range[1]);
      const end = parseTimeToSeconds(range[2]);
      updateSelectedClip({ start, end });
      setEditStatus(`Trimmed selected clip to ${start.toFixed(1)}s - ${end.toFixed(1)}s.`);
      return true;
    }

    if (lower.includes('caption') || lower.includes('subtitle') || lower.includes('add text')) {
      if (lower.includes('auto') || lower.includes('transcript') || lower.includes('transcribe')) {
        generateCaptions();
        return true;
      }
      addTextClip(quoted || 'New caption', at ? parseTimeToSeconds(at[1]) : currentTime, duration ? Number(duration[1]) : 5);
      return true;
    }

    const filter = ['cinematic', 'vibrant', 'noir', 'vintage', 'warm', 'cool'].find((item) => lower.includes(item)) as Clip['filter'];
    if (lower.includes('filter') || filter) {
      applyPatchToEditableClips({ filter: filter || 'cinematic' }, lower.includes('entire') || lower.includes('all') ? 'all' : 'selected');
      setEditStatus(`Applied ${filter || 'cinematic'} filter.`);
      return true;
    }

    const adjustment = lower.match(/(brightness|contrast|saturation)\s+(?:to|by)?\s*([+-]?\d+)/);
    if (adjustment) {
      const key = adjustment[1] as 'brightness' | 'contrast' | 'saturation';
      const value = clamp(Number(adjustment[2]), -100, 100);
      applyPatchToEditableClips({ [key]: value } as Partial<Clip>, lower.includes('entire') || lower.includes('all') ? 'all' : 'selected');
      setEditStatus(`Set ${key} to ${value}%.`);
      return true;
    }

    const speed = lower.match(/(?:speed|slow motion|faster|playback).*(0\.\d+|\d+(?:\.\d+)?)x?/);
    if (speed) {
      const playbackRate = clamp(Number(speed[1]), 0.25, 4);
      applyPatchToEditableClips({ playbackRate });
      setEditStatus(`Changed selected clip speed to ${playbackRate}x.`);
      return true;
    }

    if (lower.includes('fade in')) {
      applyPatchToEditableClips({ effect: 'fade-in' });
      setEditStatus('Added fade-in effect to selected clip.');
      return true;
    }

    if (lower.includes('fade out')) {
      applyPatchToEditableClips({ effect: 'fade-out' });
      setEditStatus('Added fade-out effect to selected clip.');
      return true;
    }

    if (lower.includes('zoom')) {
      applyPatchToEditableClips({ effect: 'zoom-in' });
      setEditStatus('Added zoom-in effect to selected clip.');
      return true;
    }

    if (lower.includes('style') && selectedClip?.type === 'text') {
      const position = lower.includes('top') ? 'top' : lower.includes('center') ? 'center' : 'bottom';
      const size = lower.includes('large') || lower.includes('big') ? 40 : lower.includes('small') ? 20 : selectedClip.textStyle?.size ?? 28;
      updateSelectedClip({ textStyle: { ...defaultTextStyle, ...(selectedClip.textStyle ?? {}), position, size } });
      setEditStatus('Updated caption style.');
      return true;
    }

    return false;
  };
  
  const handleCommandSubmit = async (command: string) => {
    setIsProcessingCommand(true);
    setCommandHistory(prev => [...prev, command]);

    const shouldRender = /render|export|download|final/i.test(command);
    const handledLocally = applyLocalCommand(command);
    if (handledLocally && !shouldRender) {
      setIsProcessingCommand(false);
      return;
    }
    
    try {
      await databaseService.saveVideoProject(projectId, {
        id: projectId,
        updatedAt: new Date().toISOString(),
        // Command edits are state updates; render the freshly computed timeline, not the prior React snapshot.
        clips: clipsRef.current,
        commandHistory: [...commandHistory, command],
        videoDuration,
        screenRatio,
      });

      const job = await databaseService.createVideoJob(projectId, command);
      
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
            addTextClip('New Text', currentTime, 5);
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
  
  if (planReady && !videoAccess.available) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-white">
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-200">
            <Lock size={22} />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">Plan locked</p>
          <h1 className="mt-2 text-2xl font-semibold">Video Editor is available on Growth and Scale</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-300">
            Your current plan is {workspacePlan}. Upgrade to {videoAccess.minimumPlan} to upload media, generate
            captions, and export videos.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/app/billing"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              View plans
            </Link>
            <Link
              to="/app/chat"
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-white/10"
            >
              Go to AI Chat
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex">
        {/* Video preview section */}
        <div className="w-2/3 border-r border-white/10" data-video-preview>
          <VideoPreview
            currentTime={currentTime}
            isPlaying={isPlaying}
            onTimeUpdate={handleTimeChange}
            onEnded={handleVideoEnded}
            clips={clips}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onReset={resetSelectedClip}
            onAddText={() => addTextClip('New caption', currentTime, 5)}
            onFullscreen={openFullscreenPreview}
            onShare={copyShareLink}
            onDownload={exportVideo}
            canUndo={clipHistory.length > 0}
            canRedo={redoStack.length > 0}
            isExporting={isExporting}
            screenRatio={screenRatio}
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
                <div className="border-b border-white/10 p-4">
                  <label className="mb-2 block text-xs text-gray-400">Screen ratio</label>
                  <div className="grid grid-cols-2 gap-2">
                    {screenRatios.map((ratio) => (
                      <button
                        key={ratio.id}
                        type="button"
                        onClick={() => {
                          setScreenRatio(ratio.value);
                          setEditStatus(`Screen ratio set to ${ratio.label}.`);
                        }}
                        className={`rounded-md border px-3 py-2 text-left text-xs transition ${
                          screenRatio === ratio.value
                            ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
                            : 'border-white/10 bg-black/30 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        {ratio.label}
                      </button>
                    ))}
                  </div>
                </div>
                {selectedClip ? (
                <div className="p-4 space-y-3">
                  <div className="rounded-md border border-indigo-400/20 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-100">
                    {editStatus}
                  </div>
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
                      onClick={() => databaseService.saveVideoProject(projectId, {
                        id: projectId,
                        updatedAt: new Date().toISOString(),
                        clips,
                        commandHistory,
                        videoDuration,
                        screenRatio,
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
                  {(selectedClip.type === 'audio' || selectedClip.type === 'video') && (
                    <div className="flex items-center gap-2 rounded-md border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                      <Volume2 size={14} />
                      Voice/audio preview is enabled for this clip.
                    </div>
                  )}
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
                    <select
                      value={selectedClip?.filter ?? 'none'}
                      onChange={(e) => updateSelectedClip({ filter: e.target.value as Clip['filter'] })}
                      disabled={!selectedClip || (selectedClip.type !== 'video' && selectedClip.type !== 'image')}
                      className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white disabled:opacity-50"
                    >
                      <option value="none">None</option>
                      <option value="cinematic">Cinematic</option>
                      <option value="vibrant">Vibrant</option>
                      <option value="noir">Noir</option>
                      <option value="vintage">Vintage</option>
                      <option value="warm">Warm</option>
                      <option value="cool">Cool</option>
                    </select>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="block text-xs text-gray-400">Brightness</label>
                      <span className="text-xs text-gray-400">{selectedClip?.brightness ?? 0}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="-100" 
                      max="100" 
                      value={selectedClip?.brightness ?? 0}
                      onChange={(e) => updateSelectedClip({ brightness: Number(e.target.value) })}
                      disabled={!selectedClip}
                      className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="block text-xs text-gray-400">Contrast</label>
                      <span className="text-xs text-gray-400">{selectedClip?.contrast ?? 0}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="-100" 
                      max="100" 
                      value={selectedClip?.contrast ?? 0}
                      onChange={(e) => updateSelectedClip({ contrast: Number(e.target.value) })}
                      disabled={!selectedClip}
                      className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="block text-xs text-gray-400">Saturation</label>
                      <span className="text-xs text-gray-400">{selectedClip?.saturation ?? 0}%</span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={selectedClip?.saturation ?? 0}
                      onChange={(e) => updateSelectedClip({ saturation: Number(e.target.value) })}
                      disabled={!selectedClip}
                      className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => addTextClip('New caption', currentTime, 5)}
                      className="inline-flex items-center justify-center gap-1 rounded-md bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15"
                    >
                      <Sparkles size={14} />
                      Caption
                    </button>
                    <button
                      type="button"
                      onClick={() => selectedClip && updateSelectedClip({ filter: 'cinematic', contrast: 16, saturation: 12, effect: 'fade-in' })}
                      disabled={!selectedClip}
                      className="inline-flex items-center justify-center gap-1 rounded-md bg-indigo-500/20 px-3 py-2 text-xs text-indigo-100 hover:bg-indigo-500/30 disabled:opacity-50"
                    >
                      <Sparkles size={14} />
                      AI Look
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Captions */}
              <motion.div
                className="bg-white/5 rounded-lg border border-white/10 overflow-hidden"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
              >
                <div className="px-4 py-2 bg-white/5 border-b border-white/10">
                  <h3 className="text-sm font-medium text-white">Captions & Transcript</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1 text-xs text-gray-400">
                      Language
                      <select
                        value={captionLanguage}
                        onChange={(e) => setCaptionLanguage(e.target.value)}
                        className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white"
                      >
                        {captionLanguages.map(([code, label]) => (
                          <option key={code} value={code}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs text-gray-400">
                      Style
                      <select
                        value={captionPreset}
                        onChange={(e) => setCaptionPreset(e.target.value)}
                        className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white"
                      >
                        <option value="classic">Classic</option>
                        <option value="creator">Creator</option>
                        <option value="minimal">Minimal</option>
                        <option value="headline">Headline</option>
                        <option value="subtitle">Subtitle</option>
                      </select>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={generateCaptions}
                    disabled={isTranscribing || !clips.some((clip) => (clip.type === 'video' || clip.type === 'audio') && clip.url)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    <Captions size={16} />
                    {isTranscribing ? 'Transcribing...' : 'Auto-generate real-time captions'}
                  </button>
                  {selectedClip?.type === 'text' && (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-1 text-xs text-gray-400">
                        Position
                        <select
                          value={selectedClip.textStyle?.position ?? 'bottom'}
                          onChange={(e) => updateSelectedClip({ textStyle: { ...defaultTextStyle, ...(selectedClip.textStyle ?? {}), position: e.target.value as any } })}
                          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white"
                        >
                          <option value="top">Top</option>
                          <option value="center">Center</option>
                          <option value="bottom">Bottom</option>
                        </select>
                      </label>
                      <label className="space-y-1 text-xs text-gray-400">
                        Size
                        <input
                          type="number"
                          min={14}
                          max={64}
                          value={selectedClip.textStyle?.size ?? 28}
                          onChange={(e) => updateSelectedClip({ textStyle: { ...defaultTextStyle, ...(selectedClip.textStyle ?? {}), size: Number(e.target.value) } })}
                          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white"
                        />
                      </label>
                    </div>
                  )}
                  <p className="text-xs leading-relaxed text-gray-400">
                    Supports Hindi, Hinglish, English, Spanish, and 50+ language options. Captions appear on the timeline and update live while the video plays.
                  </p>
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
          onSplit={splitSelectedClip}
          onMagic={applyQuickLook}
        />
      </div>
      
      <CommandInput 
        onSubmit={handleCommandSubmit}
        isProcessing={isProcessingCommand}
      />
    </div>
  );
}
