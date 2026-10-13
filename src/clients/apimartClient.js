const axios = require('axios');
const { HttpError, upstreamError } = require('../utils/errors');

const normalizeStatus = (status = 'processing') => {
  if (status === 'completed' || status === 'success') return 'succeeded';
  if (status === 'failed' || status === 'error') return 'failed';
  return status;
};

class ApiMartClient {
  constructor({ apiKey }) {
    this.apiKey = apiKey;
    this.http = axios.create({
      baseURL: 'https://api.apimart.ai/v1',
      headers: { Authorization: `Bearer ${apiKey}` }
    });
  }

  assertConfigured() {
    if (!this.apiKey) throw new HttpError(400, 'APIMART_API_KEY no está configurada en el servidor');
  }

  // Envía una generación asíncrona (imagen/video) y devuelve su task_id.
  async submit(endpoint, body, logLabel) {
    this.assertConfigured();
    let data;
    try {
      const r = await this.http.post(endpoint, body, {
        headers: { 'Content-Type': 'application/json' },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 60000
      });
      data = r.data;
    } catch (err) { throw upstreamError(err, logLabel); }

    const entry = Array.isArray(data?.data) ? data.data[0] : data?.data;
    const taskId = entry?.task_id || entry?.id;
    if (!taskId) throw new HttpError(500, 'ApiMart no devolvió un task_id', { raw: data });
    return { task_id: taskId, status: entry.status || 'submitted' };
  }

  // resultKey: 'images' | 'videos'
  async getTask(id, resultKey) {
    try {
      const r = await this.http.get(`/tasks/${id}`);
      const d = r.data?.data || {};
      const output = (d.result?.[resultKey] || [])
        .map(item => (Array.isArray(item.url) ? item.url[0] : item.url))
        .filter(Boolean);
      return {
        status: normalizeStatus(d.status),
        progress: d.progress,
        output,
        error: d.error || d.fail_reason || null
      };
    } catch (err) { throw upstreamError(err); }
  }
}

module.exports = ApiMartClient;
