const { queryAll, queryOne } = require('./postgres');

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatRiskBand(score) {
  if (score >= 70) {
    return { label: 'High risk', tone: 'danger' };
  }

  if (score >= 35) {
    return { label: 'Review', tone: 'warning' };
  }

  return { label: 'Low risk', tone: 'calm' };
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeFeedbackLabel(value) {
  const label = normalizeText(value).toLowerCase();

  if (label === 'fraud' || label === 'not_fraud') {
    return label;
  }

  throw new Error('Feedback label must be fraud or not_fraud.');
}

function buildOrderSearchClause(searchTerm) {
  const normalizedSearchTerm = normalizeText(searchTerm).toLowerCase();

  if (!normalizedSearchTerm) {
    return {
      whereClause: '',
      parameters: [],
    };
  }

  return {
    whereClause: `
      WHERE LOWER(
        CAST(o.order_id AS TEXT) || ' ' ||
        COALESCE(c.full_name, '') || ' ' ||
        COALESCE(c.email, '') || ' ' ||
        COALESCE(c.city, '') || ' ' ||
        COALESCE(c.state, '') || ' ' ||
        COALESCE(c.customer_segment, '') || ' ' ||
        COALESCE(c.loyalty_tier, '') || ' ' ||
        COALESCE(o.payment_method, '') || ' ' ||
        COALESCE(o.device_type, '') || ' ' ||
        COALESCE(o.ip_country, '') || ' ' ||
        COALESCE(o.promo_code, '')
      ) LIKE $1
    `,
    parameters: [`%${normalizedSearchTerm}%`],
  };
}

function mapOrder(order) {
  const riskScore = toNumber(order.risk_score);
  const riskBand = formatRiskBand(riskScore);

  return {
    order_id: order.order_id,
    customer_id: order.customer_id,
    order_datetime: order.order_datetime,
    order_total: toNumber(order.order_total),
    order_subtotal: toNumber(order.order_subtotal),
    shipping_fee: toNumber(order.shipping_fee),
    tax_amount: toNumber(order.tax_amount),
    payment_method: order.payment_method || 'Unknown',
    device_type: order.device_type || 'Unknown',
    ip_country: order.ip_country || 'Unknown',
    promo_used: toNumber(order.promo_used),
    promo_code: order.promo_code || '',
    risk_score: riskScore,
    risk_band: riskBand,
    is_fraud: toNumber(order.is_fraud),
    full_name: order.full_name || 'Unknown customer',
    email: order.email || '',
    city: order.city || '',
    state: order.state || '',
    customer_segment: order.customer_segment || '',
    loyalty_tier: order.loyalty_tier || '',
    feedback_label: order.feedback_label || null,
    review_notes: order.review_notes || '',
    reviewed_at: order.reviewed_at || null,
  };
}

async function getDashboardData({ page = 1, pageSize = 50, searchTerm = '' } = {}) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 50;
  const offset = (safePage - 1) * safePageSize;
  const { whereClause, parameters } = buildOrderSearchClause(searchTerm);

  const statsRow = await queryOne(
    `
      SELECT
        COUNT(*) AS totalOrders,
        SUM(CASE WHEN f.feedback_label IS NOT NULL THEN 1 ELSE 0 END) AS reviewedOrders,
        SUM(CASE WHEN o.risk_score >= 70 THEN 1 ELSE 0 END) AS highRiskOrders,
        AVG(o.risk_score) AS averageRiskScore
      FROM orders o
      JOIN customers c ON c.customer_id = o.customer_id
      LEFT JOIN fraud_feedback f ON f.order_id = o.order_id
    `
  );

  const totalMatchesRow = await queryOne(
    `
      SELECT COUNT(*) AS totalMatches
      FROM orders o
      JOIN customers c ON c.customer_id = o.customer_id
      LEFT JOIN fraud_feedback f ON f.order_id = o.order_id
      ${whereClause}
    `,
    parameters
  );

  const parameterOffset = parameters.length;
  const orders = await queryAll(
    `
      SELECT
        o.order_id,
        o.customer_id,
        o.order_datetime,
        o.order_subtotal,
        o.shipping_fee,
        o.tax_amount,
        o.order_total,
        o.payment_method,
        o.device_type,
        o.ip_country,
        o.promo_used,
        o.promo_code,
        o.risk_score,
        o.is_fraud,
        c.full_name,
        c.email,
        c.city,
        c.state,
        c.customer_segment,
        c.loyalty_tier,
        f.feedback_label,
        f.review_notes,
        f.reviewed_at
      FROM orders o
      JOIN customers c ON c.customer_id = o.customer_id
      LEFT JOIN fraud_feedback f ON f.order_id = o.order_id
      ${whereClause}
      ORDER BY o.risk_score DESC, o.order_datetime DESC, o.order_id DESC
      LIMIT $${parameterOffset + 1} OFFSET $${parameterOffset + 2}
    `,
    [...parameters, safePageSize, offset]
  );

  const stats = {
    totalOrders: toNumber(statsRow?.totalOrders),
    reviewedOrders: toNumber(statsRow?.reviewedOrders),
    highRiskOrders: toNumber(statsRow?.highRiskOrders),
    averageRiskScore: toNumber(statsRow?.averageRiskScore),
  };

  return {
    orders: orders.map(mapOrder),
    stats,
    databasePath: 'supabase',
    page: safePage,
    pageSize: safePageSize,
    totalMatches: toNumber(totalMatchesRow?.totalMatches),
    searchTerm: normalizeText(searchTerm),
  };
}

async function saveFeedback({ orderId, feedbackLabel, reviewNotes }) {
  return queryOne(
    `
      INSERT INTO fraud_feedback (order_id, feedback_label, review_notes, reviewed_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (order_id)
      DO UPDATE SET
        feedback_label = EXCLUDED.feedback_label,
        review_notes = EXCLUDED.review_notes,
        reviewed_at = CURRENT_TIMESTAMP
      RETURNING order_id, feedback_label, review_notes, reviewed_at
    `,
    [orderId, normalizeFeedbackLabel(feedbackLabel), normalizeText(reviewNotes)]
  );
}

module.exports = {
  getDashboardData,
  saveFeedback,
  formatRiskBand,
};
