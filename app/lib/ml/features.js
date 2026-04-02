function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function toBinaryNumber(value) {
  return value === true || value === 1 || value === '1' ? 1 : 0;
}

function toTimestamp(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function buildCategoryMap(rows, columnName) {
  return [...new Set(rows.map((row) => (row[columnName] || 'unknown').toString().trim() || 'unknown'))].sort();
}

function buildFeatureSchema(rows) {
  return {
    numericFeatures: [
      'order_subtotal',
      'shipping_fee',
      'tax_amount',
      'order_total',
      'promo_used',
      'order_hour',
      'order_day',
    ],
    categoricalFeatures: {
      payment_method: buildCategoryMap(rows, 'payment_method'),
      device_type: buildCategoryMap(rows, 'device_type'),
      ip_country: buildCategoryMap(rows, 'ip_country'),
    },
  };
}

function transformRowToFeatures(row, schema) {
  const timestamp = toTimestamp(row.order_datetime);
  const orderHour = timestamp ? timestamp.getUTCHours() : 0;
  const orderDay = timestamp ? ((timestamp.getUTCDay() + 6) % 7) : 0;

  const base = [
    toNumber(row.order_subtotal),
    toNumber(row.shipping_fee),
    toNumber(row.tax_amount),
    toNumber(row.order_total),
    toBinaryNumber(row.promo_used),
    orderHour,
    orderDay,
  ];

  const categorical = [];

  for (const [columnName, categories] of Object.entries(schema.categoricalFeatures)) {
    const value = (row[columnName] || 'unknown').toString().trim() || 'unknown';

    for (const category of categories) {
      categorical.push(value === category ? 1 : 0);
    }
  }

  return [...base, ...categorical];
}

function rowsToMatrix(rows, schema) {
  return rows.map((row) => transformRowToFeatures(row, schema));
}

function rowsToTarget(rows) {
  return rows.map((row) => toBinaryNumber(row.is_fraud));
}

module.exports = {
  buildFeatureSchema,
  rowsToMatrix,
  rowsToTarget,
};
