const fs = require('fs');
const path = require('path');
const { queryAll, queryOne } = require('../postgres');
const { rowsToMatrix } = require('./features');
const { predictProbabilities } = require('./logistic');

function getModelPath() {
  return process.env.FRAUD_MODEL_PATH || path.join(process.cwd(), 'model_artifacts', 'fraud_model.json');
}

function loadModelArtifact() {
  const modelPath = getModelPath();

  if (!fs.existsSync(modelPath)) {
    throw new Error(`Model artifact not found at ${modelPath}`);
  }

  return JSON.parse(fs.readFileSync(modelPath, 'utf8'));
}

async function fetchUnscoredOrders(limit) {
  return queryAll(
    `
      SELECT
        order_id,
        order_datetime,
        order_subtotal,
        shipping_fee,
        tax_amount,
        order_total,
        payment_method,
        device_type,
        ip_country,
        promo_used
      FROM orders
      WHERE risk_scored_at IS NULL
      ORDER BY order_datetime ASC, order_id ASC
      LIMIT $1
    `,
    [limit]
  );
}

async function updateOrderScore(orderId, riskScore, modelVersion) {
  return queryOne(
    `
      UPDATE orders
      SET
        risk_score = $2,
        risk_scored_at = CURRENT_TIMESTAMP,
        model_version = $3
      WHERE order_id = $1
      RETURNING order_id
    `,
    [orderId, riskScore, modelVersion]
  );
}

async function runNightlyScoring(options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 500;
  const artifact = loadModelArtifact();
  const unscoredOrders = await fetchUnscoredOrders(limit);

  if (unscoredOrders.length === 0) {
    return {
      scanned: 0,
      scored: 0,
      modelVersion: artifact.modelVersion,
    };
  }

  const matrix = rowsToMatrix(unscoredOrders, artifact.schema);
  const probabilities = predictProbabilities(matrix, artifact.model);

  let scored = 0;

  for (let index = 0; index < unscoredOrders.length; index += 1) {
    const order = unscoredOrders[index];
    const scorePercent = Math.max(0, Math.min(100, Math.round(probabilities[index] * 10000) / 100));
    const updated = await updateOrderScore(order.order_id, scorePercent, artifact.modelVersion);

    if (updated) {
      scored += 1;
    }
  }

  return {
    scanned: unscoredOrders.length,
    scored,
    modelVersion: artifact.modelVersion,
  };
}

module.exports = {
  runNightlyScoring,
};