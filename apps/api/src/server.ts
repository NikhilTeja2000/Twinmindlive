import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import { buildDefaultSettings } from '@twinmind/shared';

import { config } from './config.js';
import { GroqClient } from './clients/GroqClient.js';
import { HttpError } from './errors/HttpError.js';

import { SessionStore } from './services/SessionStore.js';
import { SettingsStore } from './services/SettingsStore.js';
import { ApiKeyStore } from './services/ApiKeyStore.js';
import { ApiKeyValidationService } from './services/ApiKeyValidationService.js';
import { AudioChunkService } from './services/AudioChunkService.js';
import { TranscriptionService } from './services/TranscriptionService.js';
import { TranscriptContextService } from './services/TranscriptContextService.js';
import { SuggestionService } from './services/SuggestionService.js';
import { SuggestionParser } from './services/SuggestionParser.js';
import { ChatService } from './services/ChatService.js';
import { ExpandedAnswerService } from './services/ExpandedAnswerService.js';
import { ChatMessageFactory } from './services/ChatMessageFactory.js';
import { ChunkPipelineService } from './services/ChunkPipelineService.js';
import { ExportService } from './services/ExportService.js';
import { SessionTimelineLogger } from './services/SessionTimelineLogger.js';

import { registerSessionController } from './controllers/SessionController.js';
import { registerChatController } from './controllers/ChatController.js';
import { registerSettingsController } from './controllers/SettingsController.js';
import { registerExportController } from './controllers/ExportController.js';

async function main(): Promise<void> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    },
    bodyLimit: 30 * 1024 * 1024,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (config.corsOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });
  await app.register(multipart, {
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },
    attachFieldsToBody: false,
  });

  // ── Dependency graph (explicit, hand-wired; single construction site) ──
  const apiKeys = new ApiKeyStore(config.groqApiKey);
  const groq = new GroqClient(apiKeys);

  const settings = new SettingsStore(
    buildDefaultSettings({
      suggestionModel: config.llmModel,
      chatModel: config.llmModel,
      transcriptionModel: config.transcriptionModel,
      temperature: config.llmTemperature,
      maxTokens: config.llmMaxTokens,
      chunkSeconds: config.chunkSeconds,
      transcriptContextChunks: config.transcriptContextChunks,
      chatContextTurns: config.chatContextTurns,
      suggestionReasoningEffort: config.llmSuggestionReasoningEffort,
      chatReasoningEffort: config.llmChatReasoningEffort,
    }),
  );

  const sessions = new SessionStore();
  const audio = new AudioChunkService();
  const transcription = new TranscriptionService(groq, settings);
  const contextSvc = new TranscriptContextService();
  const suggestionParser = new SuggestionParser();
  const suggestionSvc = new SuggestionService(groq, suggestionParser);
  const exporter = new ExportService();
  const timeline = new SessionTimelineLogger(app.log);
  const messageFactory = new ChatMessageFactory();

  const chat = new ChatService(groq, sessions, settings, contextSvc, messageFactory, timeline);
  const expand = new ExpandedAnswerService(
    groq,
    sessions,
    settings,
    contextSvc,
    messageFactory,
    timeline,
  );
  const pipeline = new ChunkPipelineService(
    sessions,
    settings,
    transcription,
    contextSvc,
    suggestionSvc,
    timeline,
  );

  // ── Controllers ──
  registerSessionController(app, { sessions, settings, audio, pipeline, timeline });
  registerChatController(app, { chat, expand });
  const apiKeyValidation = new ApiKeyValidationService(groq, apiKeys, settings);
  registerSettingsController(app, { settings, apiKeys, apiKeyValidation });
  registerExportController(app, { sessions, settings, exporter });

  app.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }));

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.status).send({ error: err.message });
    }
    // FastifyError (validation, empty body, malformed JSON, etc.) carries its
    // own 4xx statusCode — surface it instead of flattening to 500.
    const fastifyStatus = (err as { statusCode?: number }).statusCode;
    if (typeof fastifyStatus === 'number' && fastifyStatus >= 400 && fastifyStatus < 500) {
      return reply.status(fastifyStatus).send({ error: err.message });
    }
    app.log.error({ err }, 'unhandled error');
    return reply.status(500).send({ error: 'Internal server error' });
  });

  await app.listen({ port: config.port, host: config.host });
  app.log.info(
    `Twinmind API listening on http://${config.host}:${config.port}  (transcription=${config.transcriptionModel}, llm=${config.llmModel})`,
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal API startup error:', err);
  process.exit(1);
});
