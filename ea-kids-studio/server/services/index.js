// Registers domain services onto ctx and wires job handlers.
import { createCosts } from './costs.js';
import { createMedia } from './media.js';
import { createProjects } from './projects.js';
import { createCharacters } from './characters.js';
import { createIdeas } from './ideas.js';
import { createLlm } from '../providers/llm.js';
import { registerGenerationJobs } from './generation.js';
import { createNarration } from './narration.js';
import { createRender } from './render.js';
import { createPublishing } from './publishing.js';
import { createYouTube } from './youtube.js';
import { createAnalytics } from './analytics.js';
import { createBackup } from './backup.js';

export function registerServices(ctx) {
  ctx.costs = createCosts(ctx);
  ctx.media = createMedia(ctx);
  ctx.projects = createProjects(ctx);
  ctx.characters = createCharacters(ctx);
  ctx.ideas = createIdeas(ctx);
  ctx.llm = createLlm(ctx);
  registerGenerationJobs(ctx);
  ctx.narration = createNarration(ctx);
  ctx.render = createRender(ctx);
  ctx.publishing = createPublishing(ctx);
  ctx.youtube = createYouTube(ctx);
  ctx.analytics = createAnalytics(ctx);
  ctx.backup = createBackup(ctx);
  ctx.ideas.seed();
  ctx.seedPromise = ctx.characters.seed().catch((e) => ctx.log.error('character seed failed', { error: e.message }));
  return ctx;
}
