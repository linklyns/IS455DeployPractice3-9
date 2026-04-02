import { saveFeedback } from '../../lib/orders';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const { orderId, feedbackLabel, reviewNotes } = req.body || {};
    const numericOrderId = Number(orderId);

    if (!Number.isInteger(numericOrderId)) {
      return res.status(400).json({ error: 'A valid orderId is required.' });
    }

    const savedFeedback = await saveFeedback({
      orderId: numericOrderId,
      feedbackLabel,
      reviewNotes,
    });

    return res.status(200).json({
      ok: true,
      feedback: savedFeedback,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Could not save feedback.' });
  }
}