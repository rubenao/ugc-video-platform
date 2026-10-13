class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// Envuelve los handlers async para que cualquier excepción llegue al errorHandler.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function decodeBody(data) {
  if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
    const text = Buffer.from(data).toString('utf8');
    try { return JSON.parse(text); } catch { return text; }
  }
  return data;
}

function stringify(value) {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

// Extrae un mensaje legible de un error de axios (ElevenLabs, Replicate, ApiMart...).
function upstreamMessage(err) {
  const body = decodeBody(err.response?.data);
  if (body == null || body === '') return err.message;
  if (typeof body === 'string') return body;

  const candidate =
    body.detail?.message ||
    body.detail ||
    body.message ||
    body.error?.message ||
    body.error;
  return stringify(candidate || body);
}

function upstreamError(err, logLabel) {
  if (err instanceof HttpError) return err;
  const message = upstreamMessage(err);
  if (logLabel) console.error(`${logLabel}:`, message);
  return new HttpError(500, message);
}

module.exports = { HttpError, asyncHandler, upstreamError, upstreamMessage };
