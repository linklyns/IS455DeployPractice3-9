const fs = require('fs');
const path = require('path');
const { openDatabase, queryAll } = require('../lib/sqlite');

function sqlValue(value) {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function rowsToValues(rows, columns) {
  return rows
    .map((row) => `(${columns.map((column) => sqlValue(row[column])).join(', ')})`)
    .join(',\n');
}

function toBooleanSqlValue(value) {
  return value === 1 || value === '1' || value === true || value === 'true' ? 'true' : 'false';
}

function chunk(array, size) {
  const chunks = [];

  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }

  return chunks;
}

async function main() {
  const { database } = await openDatabase();

  try {
    const customers = queryAll(
      database,
      `select customer_id, full_name, email, city, state, customer_segment, loyalty_tier from customers order by customer_id`
    );
    const orders = queryAll(
      database,
      `select order_id, customer_id, order_datetime, order_subtotal, shipping_fee, tax_amount, order_total, payment_method, device_type, ip_country, promo_used, promo_code, risk_score, is_fraud from orders order by order_id`
    );
    const feedback = queryAll(
      database,
      `select feedback_id, order_id, feedback_label, review_notes, reviewed_at from fraud_feedback order by feedback_id`
    );

    const lines = [];
    lines.push('begin;');
    lines.push('truncate table fraud_feedback, orders, customers restart identity cascade;');
    lines.push('');

    for (const customerChunk of chunk(customers, 100)) {
      lines.push('insert into customers (customer_id, full_name, email, city, state, customer_segment, loyalty_tier) values');
      lines.push(
        rowsToValues(customerChunk, [
          'customer_id',
          'full_name',
          'email',
          'city',
          'state',
          'customer_segment',
          'loyalty_tier',
        ]) + ';'
      );
      lines.push('');
    }

    for (const orderChunk of chunk(orders, 100)) {
      lines.push(
        'insert into orders (order_id, customer_id, order_datetime, order_subtotal, shipping_fee, tax_amount, order_total, payment_method, device_type, ip_country, promo_used, promo_code, risk_score, is_fraud) values'
      );
      lines.push(
        orderChunk
          .map(
            (row) =>
              `(${[
                row.order_id,
                row.customer_id,
                sqlValue(row.order_datetime),
                sqlValue(row.order_subtotal),
                sqlValue(row.shipping_fee),
                sqlValue(row.tax_amount),
                sqlValue(row.order_total),
                sqlValue(row.payment_method),
                sqlValue(row.device_type),
                sqlValue(row.ip_country),
                toBooleanSqlValue(row.promo_used),
                sqlValue(row.promo_code),
                sqlValue(row.risk_score),
                toBooleanSqlValue(row.is_fraud),
              ].join(', ')})`
          )
          .join(',\n') + ';'
      );
      lines.push('');
    }

    for (const feedbackChunk of chunk(feedback, 100)) {
      lines.push('insert into fraud_feedback (feedback_id, order_id, feedback_label, review_notes, reviewed_at) values');
      lines.push(
        rowsToValues(feedbackChunk, [
          'feedback_id',
          'order_id',
          'feedback_label',
          'review_notes',
          'reviewed_at',
        ]) + ';'
      );
      lines.push('');
    }

    lines.push('commit;');

    const outputPath = path.join(process.cwd(), '..', 'supabase', 'seed.sql');
    fs.writeFileSync(outputPath, lines.join('\n'));

    console.log(`Wrote ${outputPath}`);
    console.log(`Customers: ${customers.length}, Orders: ${orders.length}, Feedback: ${feedback.length}`);
  } finally {
    database.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});