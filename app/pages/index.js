import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

function formatDateTime(value) {
  if (!value) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function feedbackLabelText(label) {
  if (label === 'fraud') {
    return 'Fraud';
  }

  if (label === 'not_fraud') {
    return 'Not fraud';
  }

  return 'No review';
}

function feedbackLabelTone(label) {
  if (label === 'fraud') {
    return 'danger';
  }

  if (label === 'not_fraud') {
    return 'calm';
  }

  return 'warning';
}

function getToneClass(tone) {
  if (tone === 'danger') {
    return 'tone-danger';
  }

  if (tone === 'warning') {
    return 'tone-warning';
  }

  return 'tone-calm';
}

function buildSearchIndex(order) {
  return [
    order.order_id,
    order.full_name,
    order.email,
    order.city,
    order.state,
    order.customer_segment,
    order.loyalty_tier,
    order.payment_method,
    order.device_type,
    order.promo_code,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export default function Home({ initialDashboard }) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialDashboard.orders);
  const [selectedOrderId, setSelectedOrderId] = useState(
    initialDashboard.orders[0]?.order_id || null
  );
  const [reviewNotes, setReviewNotes] = useState(initialDashboard.orders[0]?.review_notes || '');
  const [searchTerm, setSearchTerm] = useState(initialDashboard.searchTerm || '');
  const [savingLabel, setSavingLabel] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  const selectedOrder = orders.find((order) => order.order_id === selectedOrderId) || null;
  const currentPage = initialDashboard.page || 1;
  const pageSize = initialDashboard.pageSize || 50;
  const totalMatches = initialDashboard.totalMatches || 0;
  const totalPages = Math.max(1, Math.ceil(totalMatches / pageSize));
  const startItem = totalMatches === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalMatches);
  const hasPreviousPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;

  useEffect(() => {
    setOrders(initialDashboard.orders);
    setSelectedOrderId(initialDashboard.orders[0]?.order_id || null);
    setReviewNotes(selectedOrder?.review_notes || '');
    setStatusMessage('');
    setSavingLabel(null);
    setSearchTerm(initialDashboard.searchTerm || '');
  }, [initialDashboard.orders, initialDashboard.page, initialDashboard.searchTerm]);

  useEffect(() => {
    setReviewNotes(selectedOrder?.review_notes || '');
  }, [selectedOrder?.review_notes, selectedOrderId]);

  function navigateToDashboard(nextPage, nextSearchTerm = searchTerm) {
    const query = {
      page: String(nextPage),
    };

    if (nextSearchTerm.trim()) {
      query.q = nextSearchTerm.trim();
    }

    router.push({ pathname: '/', query });
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    navigateToDashboard(1, searchTerm);
  }

  function handlePreviousPage() {
    if (hasPreviousPage) {
      navigateToDashboard(currentPage - 1);
    }
  }

  function handleNextPage() {
    if (hasNextPage) {
      navigateToDashboard(currentPage + 1);
    }
  }

  async function submitFeedback(feedbackLabel) {
    if (!selectedOrder) {
      return;
    }

    setSavingLabel(feedbackLabel);
    setStatusMessage('Saving feedback...');

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: selectedOrder.order_id,
          feedbackLabel,
          reviewNotes,
        }),
      });

      const rawPayload = await response.text();
      let payload = null;

      try {
        payload = rawPayload ? JSON.parse(rawPayload) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to save feedback.');
      }

      const updatedFeedback = payload?.feedback;

      if (!updatedFeedback) {
        throw new Error('Could not read the saved feedback response.');
      }

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.order_id === selectedOrder.order_id
            ? {
                ...order,
                feedback_label: updatedFeedback.feedback_label,
                review_notes: updatedFeedback.review_notes,
                reviewed_at: updatedFeedback.reviewed_at,
              }
            : order
        )
      );
      setStatusMessage('Feedback saved.');
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setSavingLabel(null);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Local fraud review workflow</p>
          <h1>Review suspicious orders and capture a clean feedback trail.</h1>
          <p className="hero-copy">
            This dashboard reads from <strong>shop.db</strong>, highlights high-risk orders,
            and stores human review decisions back into SQLite.
          </p>
        </div>

        <div className="hero-badges">
          <span className="hero-badge">Operational data</span>
          <span className="hero-badge">SQLite persistence</span>
          <span className="hero-badge">Local-only</span>
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <span>Total orders</span>
          <strong>{initialDashboard.stats.totalOrders.toLocaleString()}</strong>
        </article>
        <article className="stat-card">
          <span>Reviewed orders</span>
          <strong>{initialDashboard.stats.reviewedOrders.toLocaleString()}</strong>
        </article>
        <article className="stat-card">
          <span>High-risk orders</span>
          <strong>{initialDashboard.stats.highRiskOrders.toLocaleString()}</strong>
        </article>
        <article className="stat-card">
          <span>Average risk score</span>
          <strong>{initialDashboard.stats.averageRiskScore.toFixed(1)}%</strong>
        </article>
      </section>

      <section className="workspace-grid">
        <div className="panel panel-table">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Orders</p>
              <h2>Scoreboard</h2>
              <p className="status-line">
                Showing {startItem}-{endItem} of {totalMatches.toLocaleString()} matching orders
              </p>
            </div>

            <form className="search-box" onSubmit={handleSearchSubmit}>
              <span>Search</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Order ID, customer, city, or payment method"
              />
            </form>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Risk</th>
                  <th>Total</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const feedbackTone = getToneClass(feedbackLabelTone(order.feedback_label));

                  return (
                    <tr
                      key={order.order_id}
                      className={selectedOrderId === order.order_id ? 'selected-row' : ''}
                      onClick={() => setSelectedOrderId(order.order_id)}
                    >
                      <td>
                        <strong>#{order.order_id}</strong>
                        <span>{formatDateTime(order.order_datetime)}</span>
                      </td>
                      <td>
                        <strong>{order.full_name}</strong>
                        <span>
                          {order.city}, {order.state}
                        </span>
                      </td>
                      <td>
                        <div className={`tone-pill ${getToneClass(order.risk_band.tone)}`}>
                          {order.risk_band.label}
                        </div>
                        <span>{order.risk_score.toFixed(1)}%</span>
                      </td>
                      <td>
                        <strong>{formatCurrency(order.order_total)}</strong>
                        <span>{order.payment_method}</span>
                      </td>
                      <td>
                        <div className={`tone-pill ${feedbackTone}`}>
                          {feedbackLabelText(order.feedback_label)}
                        </div>
                        <span>{order.reviewed_at ? formatDateTime(order.reviewed_at) : 'Waiting'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pagination-row">
            <button type="button" className="secondary-action" onClick={handlePreviousPage} disabled={!hasPreviousPage}>
              Previous
            </button>
            <span>
              Page {currentPage.toLocaleString()} of {totalPages.toLocaleString()}
            </span>
            <button type="button" className="secondary-action" onClick={handleNextPage} disabled={!hasNextPage}>
              Next
            </button>
          </div>
        </div>

        <aside className="panel panel-detail">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Selected order</p>
              <h2>Review panel</h2>
            </div>
          </div>

          {selectedOrder ? (
            <div className="detail-stack">
              <div className="detail-card">
                <div className={`detail-score ${getToneClass(selectedOrder.risk_band.tone)}`}>
                  {selectedOrder.risk_score.toFixed(1)}%
                </div>

                <div>
                  <h3>#{selectedOrder.order_id}</h3>
                  <p>{selectedOrder.full_name}</p>
                  <p>
                    {selectedOrder.city}, {selectedOrder.state}
                  </p>
                </div>
              </div>

              <dl className="detail-list">
                <div>
                  <dt>Predicted band</dt>
                  <dd>{selectedOrder.risk_band.label}</dd>
                </div>
                <div>
                  <dt>Actual label</dt>
                  <dd>{selectedOrder.is_fraud ? 'Fraud' : 'Not fraud'}</dd>
                </div>
                <div>
                  <dt>Payment method</dt>
                  <dd>{selectedOrder.payment_method}</dd>
                </div>
                <div>
                  <dt>Device</dt>
                  <dd>{selectedOrder.device_type}</dd>
                </div>
                <div>
                  <dt>Promo</dt>
                  <dd>{selectedOrder.promo_used ? selectedOrder.promo_code || 'Used' : 'None'}</dd>
                </div>
                <div>
                  <dt>Review status</dt>
                  <dd>{feedbackLabelText(selectedOrder.feedback_label)}</dd>
                </div>
              </dl>

              <label className="notes-box">
                <span>Review notes</span>
                <textarea
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  placeholder="Add the reason for your decision..."
                  rows={5}
                />
              </label>

              <div className="action-row">
                <button
                  type="button"
                  className="primary-action danger"
                  onClick={() => submitFeedback('fraud')}
                  disabled={savingLabel !== null}
                >
                  {savingLabel === 'fraud' ? 'Saving...' : 'Mark as fraud'}
                </button>
                <button
                  type="button"
                  className="primary-action calm"
                  onClick={() => submitFeedback('not_fraud')}
                  disabled={savingLabel !== null}
                >
                  {savingLabel === 'not_fraud' ? 'Saving...' : 'Mark as not fraud'}
                </button>
              </div>

              <p className="status-line">{statusMessage}</p>
            </div>
          ) : (
            <div className="empty-state">
              <p>No order is selected.</p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

export async function getServerSideProps(context) {
  const { getDashboardData } = require('../lib/orders');
  const page = Number.parseInt(context.query.page, 10);
  const searchTerm = typeof context.query.q === 'string' ? context.query.q : '';
  const initialDashboard = await getDashboardData({
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: 50,
    searchTerm,
  });

  return {
    props: {
      initialDashboard: JSON.parse(JSON.stringify(initialDashboard)),
    },
  };
}