import fs from 'node:fs';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import { getPrisma, isDatabaseConfigured } from '../db';
import { readDb, writeDb } from '../store';
import { v4 as uuid } from 'uuid';

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

function hasFfmpegBinary(): boolean {
  return Boolean(ffmpegPath && fs.existsSync(ffmpegPath));
}

function buildVideoFilters(clip: any): string[] {
  const filters: string[] = [];
  const brightness = Number(clip.brightness ?? 0) / 100;
  const contrast = 1 + Number(clip.contrast ?? 0) / 100;
  const saturation = 1 + Number(clip.saturation ?? 0) / 100;

  if (brightness !== 0 || contrast !== 1 || saturation !== 1) {
    filters.push(`eq=brightness=${brightness.toFixed(2)}:contrast=${contrast.toFixed(2)}:saturation=${saturation.toFixed(2)}`);
  }

  if (clip.filter === 'noir') filters.push('hue=s=0,eq=contrast=1.25');
  if (clip.filter === 'vintage') filters.push('colorchannelmixer=.9:.1:.1:0:.05:.85:.1:0:.05:.1:.8');
  if (clip.filter === 'vibrant') filters.push('eq=contrast=1.08:saturation=1.3');
  if (clip.filter === 'cinematic') filters.push('eq=contrast=1.14:saturation=1.12:brightness=-0.02');
  if (clip.filter === 'warm') filters.push('colorbalance=rs=.08:gs=.02:bs=-.06');
  if (clip.filter === 'cool') filters.push('colorbalance=rs=-.06:gs=.02:bs=.08');
  if (clip.blur) filters.push(`boxblur=${Math.max(0, Number(clip.blur)).toFixed(1)}`);

  const speed = Number(clip.playbackRate ?? 1);
  if (speed > 0 && speed !== 1) {
    filters.push(`setpts=${(1 / speed).toFixed(3)}*PTS`);
  }

  return filters;
}

function escapeDrawtext(value: string): string {
  return String(value).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/%/g, '\\%');
}

function textOverlayFilter(clip: any, videoDuration: number): string {
  const style = clip.textStyle ?? {};
  const size = Math.max(12, Math.min(96, Number(style.size ?? 28)));
  const color = String(style.color ?? '#ffffff').replace('#', '0x');
  const background = style.background ? ':box=1:boxcolor=black@0.65:boxborderw=14' : '';
  const y = style.position === 'top' ? 'h*0.12' : style.position === 'center' ? '(h-text_h)/2' : 'h*0.82-text_h';
  const start = Math.max(0, Number(clip.start ?? 0));
  const end = Math.min(videoDuration, Math.max(start + 0.1, Number(clip.end ?? start + 5)));
  return `drawtext=text='${escapeDrawtext(clip.name)}':fontcolor=${color}:fontsize=${size}:x=(w-text_w)/2:y=${y}${background}:enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'`;
}

export async function queueVideoJob(params: {
  jobId: string;
  command: string;
  isPrisma: boolean;
}): Promise<void> {
  // Process asynchronously without blocking the queue
  processJob(params).catch(console.error);
}

async function processJob(params: { jobId: string; command: string; isPrisma: boolean }) {
  const updateStatus = async (status: string, result?: string, error?: string) => {
    if (params.isPrisma && isDatabaseConfigured()) {
      const prisma = getPrisma();
      await prisma.videoJob.update({
        where: { id: params.jobId },
        data: { status, result, error, finishedAt: ['completed', 'failed'].includes(status) ? new Date() : undefined },
      });
      return;
    }
    const db = await readDb();
    const current = db.videoJobs[params.jobId];
    if (current) {
      db.videoJobs[params.jobId] = {
        ...current,
        status: status as any,
        result,
        error,
        finishedAt: ['completed', 'failed'].includes(status) ? new Date().toISOString() : undefined,
      };
      await writeDb(db);
    }
  };

  await updateStatus('processing');

  if (!hasFfmpegBinary()) {
    await updateStatus('failed', undefined, 'FFmpeg binary not available on host.');
    return;
  }

  try {
    let projectId: string | undefined;
    let clips: any[] = [];
    
    if (params.isPrisma && isDatabaseConfigured()) {
      const prisma = getPrisma();
      const job = await prisma.videoJob.findUnique({ where: { id: params.jobId } });
      if (job) {
        projectId = job.projectId;
        const project = await prisma.videoProject.findUnique({ where: { id: projectId } });
        if (project && Array.isArray(project.clips)) {
          clips = project.clips;
        }
      }
    } else {
      const db = await readDb();
      const job = db.videoJobs[params.jobId];
      if (job) {
        projectId = job.projectId;
        const projectKey = Object.keys(db.videoProjects).find(k => k.endsWith(`::${projectId}`));
        if (projectKey && db.videoProjects[projectKey]) {
          clips = db.videoProjects[projectKey].clips;
        }
      }
    }

    if (!projectId || clips.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await updateStatus('completed', `Processed command: "${params.command}" (Simulated - no clips)`);
      return;
    }

    const videoClips = clips.filter(c => c.type === 'video' && c.url);
    if (videoClips.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await updateStatus('completed', `Processed command: "${params.command}" (Simulated - no valid video clips)`);
      return;
    }

    const outputFilename = `rendered-${uuid()}.mp4`;
    const outputPath = path.join(process.cwd(), 'uploads', outputFilename);
    // Construct the absolute URL (assuming frontend runs on port 5173, backend on 4000)
    // We don't know the exact protocol/host here, so we return a relative path
    const outputUrl = `/uploads/${outputFilename}`; 

    await new Promise((resolve, reject) => {
      const orderedClips = [...videoClips].sort((a, b) => Number(a.start) - Number(b.start));
      let command = ffmpeg();
      const filterGraph: string[] = [];

      orderedClips.forEach((clip, index) => {
        const filename = path.basename(new URL(clip.url, 'http://localhost').pathname);
        const inputPath = path.join(process.cwd(), 'uploads', filename);
        if (!fs.existsSync(inputPath)) throw new Error(`Input file not found: ${filename}`);
        const clipDuration = Math.max(0.5, Number(clip.end ?? 10) - Number(clip.start ?? 0));
        const sourceStart = Math.max(0, Number(clip.sourceStart ?? 0));
        const speed = Math.max(0.25, Number(clip.playbackRate ?? 1));
        command = command.input(inputPath).inputOptions([`-ss ${sourceStart}`, `-t ${clipDuration * speed}`]);
        const effects = buildVideoFilters(clip);
        if (clip.effect === 'fade-in') effects.push('fade=t=in:st=0:d=0.45');
        if (clip.effect === 'fade-out') effects.push(`fade=t=out:st=${Math.max(0, clipDuration - 0.45).toFixed(2)}:d=0.45`);
        if (clip.effect === 'zoom-in') effects.push(`zoompan=z='min(zoom+0.0008,1.12)':d=${Math.ceil(clipDuration * 30)}:s=1280x720:fps=30`);
        filterGraph.push(`[${index}:v]${[...effects, 'scale=1280:720:force_original_aspect_ratio=decrease', 'pad=1280:720:(ow-iw)/2:(oh-ih)/2', 'fps=30', 'setsar=1', 'setpts=PTS-STARTPTS'].join(',')}[v${index}]`);
      });

      const concatInputs = orderedClips.map((_, index) => `[v${index}]`).join('');
      filterGraph.push(`${concatInputs}concat=n=${orderedClips.length}:v=1:a=0[base]`);
      const textClips = clips.filter((clip) => clip.type === 'text' && clip.name && clip.id !== 'text-welcome');
      let previous = 'base';
      textClips.forEach((clip, index) => {
        const output = `text${index}`;
        filterGraph.push(`[${previous}]${textOverlayFilter(clip, Number(clips.reduce((max, item) => Math.max(max, Number(item.end ?? 0)), 0)))}[${output}]`);
        previous = output;
      });

      command
        .complexFilter(filterGraph, previous)
        .outputOptions(['-movflags +faststart'])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    await updateStatus('completed', JSON.stringify({ message: `Rendered successfully!`, url: outputUrl }));

  } catch (err: any) {
    console.error('Video processing error:', err);
    await updateStatus('failed', undefined, err.message || 'Unknown error');
  }
}
