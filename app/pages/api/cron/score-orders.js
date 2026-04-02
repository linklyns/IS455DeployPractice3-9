import { runNightlyScoring } from '../../../lib/ml/score';

function isAuthorized(req) {
  const configuredSecret = process.env.CRON_SECRET;

  if (!configuredSecret) {
    return true;
  }

  const bearerToken = req.headers.authorization || '';
  const querySecret = typeof req.query.secret === 'string' ? req.query.secret : '';

  return bearerToken === `Bearer ${configuredSecret}` || querySecret === configuredSecret;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized cron request.' });
  }

  try {
    const result = await runNightlyScoring();

    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Nightly scoring failed.' });
  }
}
