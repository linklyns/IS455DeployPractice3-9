function sigmoid(value) {
  if (value > 35) {
    return 1;
  }

  if (value < -35) {
    return 0;
  }

  return 1 / (1 + Math.exp(-value));
}

function dotProduct(left, right) {
  let sum = 0;

  for (let index = 0; index < left.length; index += 1) {
    sum += left[index] * right[index];
  }

  return sum;
}

function standardize(matrix) {
  const featureCount = matrix[0]?.length || 0;
  const means = new Array(featureCount).fill(0);
  const stds = new Array(featureCount).fill(1);

  for (let featureIndex = 0; featureIndex < featureCount; featureIndex += 1) {
    let sum = 0;

    for (const row of matrix) {
      sum += row[featureIndex];
    }

    means[featureIndex] = sum / matrix.length;

    let variance = 0;

    for (const row of matrix) {
      const delta = row[featureIndex] - means[featureIndex];
      variance += delta * delta;
    }

    stds[featureIndex] = Math.sqrt(variance / matrix.length) || 1;
  }

  const standardized = matrix.map((row) =>
    row.map((value, featureIndex) => (value - means[featureIndex]) / stds[featureIndex])
  );

  return { standardized, means, stds };
}

function standardizeWithScalers(matrix, means, stds) {
  return matrix.map((row) =>
    row.map((value, featureIndex) => (value - means[featureIndex]) / stds[featureIndex])
  );
}

function trainBalancedLogisticRegression(matrix, targets, options = {}) {
  const learningRate = options.learningRate || 0.05;
  const epochs = options.epochs || 500;

  const { standardized, means, stds } = standardize(matrix);
  const featureCount = standardized[0]?.length || 0;
  const weights = new Array(featureCount).fill(0);
  let bias = 0;

  const positives = targets.filter((value) => value === 1).length;
  const negatives = targets.length - positives;
  const positiveWeight = positives === 0 ? 1 : targets.length / (2 * positives);
  const negativeWeight = negatives === 0 ? 1 : targets.length / (2 * negatives);

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradientWeights = new Array(featureCount).fill(0);
    let gradientBias = 0;

    for (let rowIndex = 0; rowIndex < standardized.length; rowIndex += 1) {
      const row = standardized[rowIndex];
      const target = targets[rowIndex];
      const prediction = sigmoid(dotProduct(row, weights) + bias);
      const classWeight = target === 1 ? positiveWeight : negativeWeight;
      const error = (prediction - target) * classWeight;

      for (let featureIndex = 0; featureIndex < featureCount; featureIndex += 1) {
        gradientWeights[featureIndex] += error * row[featureIndex];
      }

      gradientBias += error;
    }

    for (let featureIndex = 0; featureIndex < featureCount; featureIndex += 1) {
      weights[featureIndex] -= (learningRate * gradientWeights[featureIndex]) / standardized.length;
    }

    bias -= (learningRate * gradientBias) / standardized.length;
  }

  return {
    weights,
    bias,
    means,
    stds,
  };
}

function predictProbabilities(matrix, model) {
  const standardized = standardizeWithScalers(matrix, model.means, model.stds);
  return standardized.map((row) => sigmoid(dotProduct(row, model.weights) + model.bias));
}

function evaluateBinary(targets, probabilities, threshold = 0.5) {
  let truePositive = 0;
  let falsePositive = 0;
  let trueNegative = 0;
  let falseNegative = 0;

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    const prediction = probabilities[index] >= threshold ? 1 : 0;

    if (prediction === 1 && target === 1) {
      truePositive += 1;
    } else if (prediction === 1 && target === 0) {
      falsePositive += 1;
    } else if (prediction === 0 && target === 0) {
      trueNegative += 1;
    } else {
      falseNegative += 1;
    }
  }

  const total = targets.length || 1;
  const accuracy = (truePositive + trueNegative) / total;
  const precision = truePositive === 0 ? 0 : truePositive / (truePositive + falsePositive);
  const recall = truePositive === 0 ? 0 : truePositive / (truePositive + falseNegative);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return {
    accuracy,
    precision,
    recall,
    f1,
    confusionMatrix: {
      truePositive,
      falsePositive,
      trueNegative,
      falseNegative,
    },
  };
}

module.exports = {
  trainBalancedLogisticRegression,
  predictProbabilities,
  evaluateBinary,
};
