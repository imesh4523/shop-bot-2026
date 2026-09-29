const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/shopbot' });

async function run() {
  try {
    const paymentRes = await pool.query('SELECT * FROM payments WHERE id = 16');
    const payment = paymentRes.rows[0];
    const userRes = await pool.query('SELECT * FROM telegram_users WHERE id = 257');
    const user = userRes.rows[0];

    console.log('Payment 16:', payment);
    console.log('User 257:', user);

    // Call the internal endpoint or check
    const http = require('http');
    const payload = JSON.stringify({
      paymentId: 16,
      secret: 'youuhost_internal_secret_2026'
    });

    const req = http.request({
      hostname: '127.0.0.1',
      port: 80,
      path: '/api/internal/payment-success',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Response status:', res.statusCode);
        console.log('Response body:', data);
        pool.end();
      });
    });

    req.on('error', (err) => {
      console.error('Request error:', err.message);
      pool.end();
    });

    req.write(payload);
    req.end();
  } catch (e) {
    console.error('Error:', e);
    pool.end();
  }
}

run();
