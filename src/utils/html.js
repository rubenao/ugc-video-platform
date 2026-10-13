const axios = require('axios');

function htmlToText(html, maxChars) {
  return String(html)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

// Descarga una página y devuelve su texto plano ('' si falla).
async function fetchPageText(url, { maxChars = 3000, timeout = 10000 } = {}) {
  try {
    const res = await axios.get(url, {
      timeout,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)' },
      maxContentLength: 500000
    });
    return htmlToText(res.data, maxChars);
  } catch (err) {
    console.warn('URL fetch warning:', url, err.message);
    return '';
  }
}

module.exports = { fetchPageText };
