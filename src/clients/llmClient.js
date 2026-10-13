// Cliente LLM (OpenAI). El SDK y la API key son opcionales: si faltan,
// `available` es false y los servicios usan sus respuestas de respaldo.
class LlmClient {
  constructor({ apiKey, model = 'gpt-4o-mini' }) {
    this.model = model;
    this.client = null;
    try {
      const OpenAI = require('openai');
      if (apiKey) this.client = new OpenAI({ apiKey });
    } catch { /* SDK no instalado */ }
  }

  get available() {
    return Boolean(this.client);
  }

  // user: string o array de partes de contenido (texto/imagen).
  async complete({ system, user, maxTokens }) {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    });
    return completion.choices[0].message.content.trim();
  }
}

module.exports = LlmClient;
