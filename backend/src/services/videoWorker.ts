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

    const firstVideoUrl = videoClips[0].url;
    const inputFilename = firstVideoUrl.split('/').pop();
    const inputPath = path.join(process.cwd(), 'uploads', inputFilename!);

    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    await new Promise((resolve, reject) => {
      const clipDuration = Math.max(0.5, Number(videoClips[0].end ?? 10) - Number(videoClips[0].start ?? 0));
      const sourceStart = Math.max(0, Number(videoClips[0].sourceStart ?? 0));
      const filters = buildVideoFilters(videoClips[0]);
      let command = ffmpeg(inputPath).setStartTime(sourceStart).setDuration(clipDuration);
      
      if (params.command.includes('trim') || params.command.includes('cut')) {
         command = command.setDuration(Math.min(clipDuration, 10)); 
      }

      if (filters.length > 0) {
        command = command.videoFilters(filters);
      }

      command
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
