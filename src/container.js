const config = require('./config');

const ElevenLabsClient = require('./clients/elevenLabsClient');
const ReplicateClient = require('./clients/replicateClient');
const ApiMartClient = require('./clients/apimartClient');
const LlmClient = require('./clients/llmClient');

const AudioService = require('./services/audioService');
const AvatarService = require('./services/avatarService');
const BrochureService = require('./services/brochureService');
const DownloadService = require('./services/downloadService');
const DubbingService = require('./services/dubbingService');
const ImageService = require('./services/imageService');
const PromptService = require('./services/promptService');
const SocialService = require('./services/socialService');
const VideoGenerationService = require('./services/videoGenerationService');
const VideoService = require('./services/videoService');
const VoiceService = require('./services/voiceService');

// Composition root: único lugar donde se instancian y conectan las dependencias.
function buildServices() {
  const elevenLabs = new ElevenLabsClient({ apiKey: config.keys.elevenlabs });
  const replicate = new ReplicateClient({ token: config.keys.replicate });
  const apimart = new ApiMartClient({ apiKey: config.keys.apimart });
  const llm = new LlmClient({ apiKey: config.keys.openai });

  const uploadsDir = config.paths.uploads;
  const imageService = new ImageService({ apimart });

  return {
    voiceService: new VoiceService({ elevenLabs }),
    audioService: new AudioService({ elevenLabs, uploadsDir }),
    dubbingService: new DubbingService({ elevenLabs, uploadsDir, languages: config.dubbingLanguages }),
    avatarService: new AvatarService({ imageService }),
    promptService: new PromptService({ llm }),
    videoService: new VideoService({ replicate, uploadsDir }),
    socialService: new SocialService({ llm, imageService }),
    imageService,
    videoGenerationService: new VideoGenerationService({ apimart }),
    brochureService: new BrochureService({ imageService, llm, logosDir: config.paths.logos }),
    downloadService: new DownloadService()
  };
}

module.exports = buildServices;
