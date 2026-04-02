const { Pool } = require('pg');
const { openDatabase, queryAll } = require('../lib/sqlite');

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required for the import script.');
  }

  return new Pool({
    connectionString,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  });
}

function toBoolean(value) {
  return value === 1 || value === '1' || value === true || value === 'true';
}

async function importRows(pool, text, rows) {
  for (const row of rows) {
    await pool.query(text, row);
  }
}

async function main() {
  const pool = getPool();
  const { database } = await openDatabase();

  try {
    const customers = queryAll(
      database,
      `
        select customer_id, full_name, email, city, state, customer_segment, loyalty_tier
        from customers
        order by customer_id
      `
    );

    const orders = queryAll(
      database,
      `
        select
          order_id,
          customer_id,
          order_datetime,
          order_subtotal,
          shipping_fee,
          tax_amount,
          order_total,
          payment_method,
          device_type,
          ip_country,
          promo_used,
          promo_code,
          risk_score,
          is_fraud
        from orders
        order by order_id
      `
    );

    const feedback = queryAll(
      database,
      `
        select feedback_id, order_id, feedback_label, review_notes, reviewed_at
        from fraud_feedback
        order by feedback_id
      `
    );

    await pool.query('begin');

    await importRows(
      pool,
      `
        insert into customers (
          customer_id, full_name, email, city, state, customer_segment, loyalty_tier
        ) values ($1, $2, $3, $4, $5, $6, $7)
        on conflict (customer_id) do update set
          full_name = excluded.full_name,
          email = excluded.email,
          city = excluded.city,
          state = excluded.state,
          customer_segment = excluded.customer_segment,
          loyalty_tier = excluded.loyalty_tier
      `,
      customers.map((row) => [
        row.customer_id,
        row.full_name,
        row.email,
        row.city,
        row.state,
        row.customer_segment,
        row.loyalty_tier,
      ])
    );

    await importRows(
      pool,
      `
        insert into orders (
          order_id,
          customer_id,
          order_datetime,
          order_subtotal,
          shipping_fee,
          tax_amount,
          order_total,
          payment_method,
          device_type,
          ip_country,
          promo_used,
          promo_code,
          risk_score,
          is_fraud
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        on conflict (order_id) do update set
          customer_id = excluded.customer_id,
          order_datetime = excluded.order_datetime,
          order_subtotal = excluded.order_subtotal,
          shipping_fee = excluded.shipping_fee,
          tax_amount = excluded.tax_amount,
          order_total = excluded.order_total,
          payment_method = excluded.payment_method,
          device_type = excluded.device_type,
          ip_country = excluded.ip_country,
          promo_used = excluded.promo_used,
          promo_code = excluded.promo_code,
          risk_score = excluded.risk_score,
          is_fraud = excluded.is_fraud
      `,
      orders.map((row) => [
        row.order_id,
        row.customer_id,
        row.order_datetime,
        row.order_subtotal,
        row.shipping_fee,
        row.tax_amount,
        row.order_total,
        row.payment_method,
        row.device_type,
        row.ip_country,
        toBoolean(row.promo_used),
        row.promo_code,
        row.risk_score,
        toBoolean(row.is_fraud),
      ])
    );

    await importRows(
      pool,
      `
        insert into fraud_feedback (
          feedback_id, order_id, feedback_label, review_notes, reviewed_at
        ) values ($1, $2, $3, $4, $5)
        on conflict (order_id) do update set
          feedback_label = excluded.feedback_label,
          review_notes = excluded.review_notes,
          reviewed_at = excluded.reviewed_at
      `,
      feedback.map((row) => [
        row.feedback_id,
        row.order_id,
        row.feedback_label,
        row.review_notes,
        row.reviewed_at,
      ])
    );

    await pool.query('commit');

    console.log(`Imported ${customers.length} customers, ${orders.length} orders, ${feedback.length} feedback rows.`);
  } catch (error) {
    await pool.query('rollback');
    throw error;
  } finally {
    database.close();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});