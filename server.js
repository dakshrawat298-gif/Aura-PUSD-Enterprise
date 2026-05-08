'use strict';

const express = require('express');
const path    = require('path');

const { createBatchTransferTransaction } = require('./src/solanaPayroll');

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ─── Static assets ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── API: Build batch payroll transaction ─────────────────────────────────────
app.post('/api/build-payroll-tx', async (req, res) => {
  const { senderPublicKey, recipientsArray, tokenMint } = req.body;

  if (!senderPublicKey || !recipientsArray || !tokenMint) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: senderPublicKey, recipientsArray, tokenMint.',
    });
  }

  try {
    const transactionBase64 = await createBatchTransferTransaction({
      senderPublicKey,
      recipientsArray,
      tokenMint,
    });

    return res.json({ success: true, transactionBase64 });
  } catch (err) {
    console.error('[Aura] /api/build-payroll-tx error:', err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// ─── Fallback route (SPA support) ────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(process.env.PORT || 5000, '0.0.0.0', () => {
  console.log("Aura Enterprise Server Running on port 5000");
});
