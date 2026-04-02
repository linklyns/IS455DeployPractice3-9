const fs = require('fs');
const path = require('path');
const { queryAll } = require('../lib/postgres');
const { buildFeatureSchema, rowsToMatrix, rowsToTarget } = require('../lib/ml/features');
const {
  trainBalancedLogisticRegression,
  predictProbabilities,
  evaluateBinary,
} = require('../lib/ml/logistic');

function splitRows(rows) {
  const trainRows = [];
  const testRows = [];

  for (const row of rows) {
    const orderId = Number(row.order_id) || 0;
    const bucket = ((orderId * 2654435761) >>> 0) % 5;

    if (bucket === 0) {
      testRows.push(row);
    } else {
      trainRows.push(row);
    }
  }

  return { trainRows, testRows };
}

function writeModelArtifact(artifact) {
  const artifactDirectory = path.join(process.cwd(), 'model_artifacts');
  const artifactPath = path.join(artifactDirectory, 'fraud_model.json');

  fs.mkdirSync(artifactDirectory, { recursive: true });
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

  return artifactPath;
}

async function loadTrainingRows() {
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
        promo_used,
        is_fraud
      FROM orders
      WHERE is_fraud IS NOT NULL
      ORDER BY order_datetime ASC, order_id ASC
    `
  );
}

async function main() {
  const rows = await loadTrainingRows();

  if (rows.length < 100) {
    throw new Error('Not enough rows to train model. Need at least 100 orders.');
  }

  const { trainRows, testRows } = splitRows(rows);

  if (trainRows.length === 0 || testRows.length === 0) {
    throw new Error('Could not split dataset into train/test sets.');
  }

  const schema = buildFeatureSchema(trainRows);
  const XTrain = rowsToMatrix(trainRows, schema);
  const yTrain = rowsToTarget(trainRows);
  const XTest = rowsToMatrix(testRows, schema);
  const yTest = rowsToTarget(testRows);

  const model = trainBalancedLogisticRegression(XTrain, yTrain, {
    learningRate: 0.04,
    epochs: 650,
  });

  const probabilities = predictProbabilities(XTest, model);
  const metrics = evaluateBinary(yTest, probabilities, 0.5);

  const modelVersion = `balanced_logistic_${new Date().toISOString()}`;
  const artifact = {
    modelVersion,
    trainedAt: new Date().toISOString(),
    rowCount: rows.length,
    trainCount: trainRows.length,
    testCount: testRows.length,
    schema,
    model,
    metrics,
  };

  const artifactPath = writeModelArtifact(artifact);

  console.log('Model training complete.');
  console.log(`Artifact: ${artifactPath}`);
  console.log(`Train rows: ${trainRows.length}, Test rows: ${testRows.length}`);
  console.log(`Fraud recall (test): ${metrics.recall.toFixed(4)}`);
  console.log(`Fraud precision (test): ${metrics.precision.toFixed(4)}`);
  console.log(`Accuracy (test): ${metrics.accuracy.toFixed(4)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
