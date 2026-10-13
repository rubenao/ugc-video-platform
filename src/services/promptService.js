const { HttpError } = require('../utils/errors');
const avatarPrompts = require('../prompts/avatar');

class PromptService {
  constructor({ llm }) {
    this.llm = llm;
  }

  async generateAvatarPrompt(characteristics) {
    if (!characteristics) throw new HttpError(400, 'characteristics requerido');

    if (this.llm.available) {
      try {
        return await this.llm.complete({
          system: avatarPrompts.SYSTEM,
          user: avatarPrompts.userPrompt(characteristics),
          maxTokens: 250
        });
      } catch (err) {
        console.warn('OpenAI API error, usando plantilla:', err.message);
      }
    }
    return avatarPrompts.templatePrompt(characteristics);
  }
}

module.exports = PromptService;
