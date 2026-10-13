const axios = require('axios');
const { upstreamError } = require('../utils/errors');

const firstOutput = (output) => (Array.isArray(output) ? output[0] : output);

class ReplicateClient {
  constructor({ token }) {
    this.http = axios.create({
      baseURL: 'https://api.replicate.com/v1',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' }
    });
  }

  // wait: segundos para la cabecera "Prefer: wait=N" (respuesta síncrona si termina a tiempo).
  async createPrediction(model, input, { wait, timeout = 30000 } = {}) {
    try {
      const r = await this.http.post(
        `/models/${model}/predictions`,
        { input },
        {
          headers: wait ? { Prefer: `wait=${wait}` } : {},
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          timeout
        }
      );
      return r.data;
    } catch (err) { throw upstreamError(err); }
  }

  async getStatus(id) {
    try {
      const r = await this.http.get(`/predictions/${id}`);
      return { status: r.data.status, output: firstOutput(r.data.output), error: r.data.error };
    } catch (err) { throw upstreamError(err); }
  }
}

ReplicateClient.firstOutput = firstOutput;
module.exports = ReplicateClient;
