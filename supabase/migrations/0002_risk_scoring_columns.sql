alter table if exists orders
  add column if not exists risk_scored_at timestamptz;

alter table if exists orders
  add column if not exists model_version text;

create index if not exists idx_orders_risk_scored_at
  on orders (risk_scored_at);
