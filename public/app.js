(() => {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────────
  const state = {
    walletAddress: null,
    payrollData: [],
  };

  // ─── DOM References ───────────────────────────────────────────────────────────
  const btnConnect     = document.getElementById('btnConnect');
  const csvInput       = document.getElementById('csvInput');
  const uploadArea     = document.getElementById('uploadArea');
  const employeeList   = document.getElementById('employeeList');
  const recipientBadge = document.getElementById('recipientBadge');
  const totalAmount    = document.getElementById('totalAmount');
  const btnDisburse    = document.getElementById('btnDisburse');

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Abbreviate a wallet address for display: "81TG...4LJQ"
   * @param {string} address
   * @returns {string}
   */
  function abbreviateAddress(address) {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 4)}…${address.slice(-4)}`;
  }

  /**
   * Format a number with comma thousands separators.
   * @param {number|string} value
   * @returns {string}
   */
  function formatAmount(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    return num.toLocaleString('en-US', { maximumFractionDigits: 6 });
  }

  /**
   * Show an inline toast-style notification inside the upload area.
   * @param {string} message
   * @param {'error'|'success'|'info'} type
   */
  function showUploadFeedback(message, type = 'info') {
    const existing = document.getElementById('uploadFeedback');
    if (existing) existing.remove();

    const el = document.createElement('p');
    el.id = 'uploadFeedback';
    el.textContent = message;
    el.style.cssText = `
      margin-top: 8px;
      font-size: 12px;
      font-weight: 500;
      color: ${type === 'error' ? '#f87171' : type === 'success' ? '#34d399' : 'rgba(255,255,255,0.5)'};
    `;
    uploadArea.appendChild(el);
  }

  // ─── 1. Phantom Wallet Connection ─────────────────────────────────────────────
  async function connectWallet() {
    const provider = window.solana;

    if (!provider || !provider.isPhantom) {
      showWalletError();
      return;
    }

    try {
      btnConnect.textContent = 'Connecting…';
      btnConnect.disabled = true;

      const response = await provider.connect();
      state.walletAddress = response.publicKey.toString();

      btnConnect.textContent = abbreviateAddress(state.walletAddress);
      btnConnect.style.background = 'rgba(139, 92, 246, 0.15)';
      btnConnect.style.border = '1px solid rgba(139, 92, 246, 0.35)';
      btnConnect.disabled = false;

      console.log('[Aura] Wallet connected:', state.walletAddress);
    } catch (err) {
      console.error('[Aura] Wallet connection rejected:', err);
      btnConnect.textContent = 'Connect Wallet';
      btnConnect.disabled = false;
    }
  }

  function showWalletError() {
    btnConnect.textContent = 'Install Phantom';
    btnConnect.disabled = false;
    btnConnect.style.background = 'rgba(248, 113, 113, 0.15)';
    btnConnect.style.border = '1px solid rgba(248, 113, 113, 0.35)';
    btnConnect.style.color = '#f87171';
    btnConnect.onclick = () => window.open('https://phantom.app/', '_blank');
    console.warn('[Aura] Phantom wallet not detected.');
  }

  // Listen for wallet connect/disconnect events
  if (window.solana) {
    window.solana.on('connect', () => {
      if (state.walletAddress) return;
      state.walletAddress = window.solana.publicKey?.toString() ?? null;
    });

    window.solana.on('disconnect', () => {
      state.walletAddress = null;
      btnConnect.textContent = 'Connect Wallet';
      btnConnect.style.background = '';
      btnConnect.style.border = '';
      btnConnect.style.color = '';
      btnConnect.onclick = connectWallet;
      console.log('[Aura] Wallet disconnected.');
    });
  }

  // ─── 2. CSV File Handling ─────────────────────────────────────────────────────

  /**
   * Parse a raw CSV string into an array of { walletAddress, amount } objects.
   * Skips the header row and any blank lines.
   * @param {string} raw
   * @returns {{ walletAddress: string, amount: number }[]}
   */
  function parseCSV(raw) {
    const lines = raw
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length < 2) return [];

    // Detect and skip header row (contains non-numeric second column)
    let startIndex = 0;
    const firstCols = lines[0].split(',');
    if (firstCols.length >= 2 && isNaN(parseFloat(firstCols[1].trim()))) {
      startIndex = 1;
    }

    const records = [];
    for (let i = startIndex; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < 2) continue;

      const walletAddress = cols[0].trim();
      const amount = parseFloat(cols[1].trim());

      if (!walletAddress || isNaN(amount)) continue;

      records.push({ walletAddress, amount });
    }

    return records;
  }

  /**
   * Handle the FileReader result and kick off UI update.
   * @param {File} file
   */
  function handleCSVFile(file) {
    if (!file || !file.name.endsWith('.csv')) {
      showUploadFeedback('Please upload a valid .csv file.', 'error');
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const raw = e.target.result;
      const records = parseCSV(raw);

      if (records.length === 0) {
        showUploadFeedback('CSV parsed but no valid records found. Expected columns: walletAddress, amount.', 'error');
        return;
      }

      state.payrollData = records;
      showUploadFeedback(`✓ Loaded ${records.length} recipient${records.length !== 1 ? 's' : ''} from CSV.`, 'success');
      renderPayrollList(records);
    };

    reader.onerror = () => {
      showUploadFeedback('Failed to read file. Please try again.', 'error');
    };

    reader.readAsText(file);
  }

  // File input change
  csvInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleCSVFile(file);
    e.target.value = '';
  });

  // Drag and drop
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleCSVFile(file);
  });

  // ─── 3. Dynamic UI Updates ────────────────────────────────────────────────────

  /**
   * Generate avatar initials from an index.
   * @param {number} index
   * @returns {string}
   */
  function avatarLabel(index) {
    return `E${index + 1}`;
  }

  /**
   * Re-render the employee list and totals from a records array.
   * @param {{ walletAddress: string, amount: number }[]} records
   */
  function renderPayrollList(records) {
    // Clear existing list items
    employeeList.innerHTML = '';

    records.forEach((rec, i) => {
      const li = document.createElement('li');
      li.className = 'employee-item';
      li.innerHTML = `
        <div class="employee-avatar">${avatarLabel(i)}</div>
        <div class="employee-info">
          <span class="employee-name">Employee ${i + 1}</span>
          <span class="employee-address">${abbreviateAddress(rec.walletAddress)}</span>
        </div>
        <span class="employee-amount">${formatAmount(rec.amount)} PUSD</span>
      `;
      employeeList.appendChild(li);
    });

    // Update badge
    recipientBadge.textContent = `${records.length} Recipient${records.length !== 1 ? 's' : ''}`;

    // Update total
    const total = records.reduce((sum, r) => sum + r.amount, 0);
    totalAmount.textContent = `${formatAmount(total)} PUSD`;
  }

  // ─── 4. Disburse Trigger ─────────────────────────────────────────────────────
  btnDisburse.addEventListener('click', () => {
    if (!state.walletAddress) {
      console.warn('[Aura] No wallet connected. Aborting disburse.');
      flashButton(btnDisburse, 'Connect wallet first');
      return;
    }

    if (state.payrollData.length === 0) {
      console.warn('[Aura] No payroll data loaded. Aborting disburse.');
      flashButton(btnDisburse, 'No payroll data');
      return;
    }

    console.log('[Aura] Disburse triggered.');
    console.log('[Aura] Sender wallet:', state.walletAddress);
    console.log('[Aura] Payroll payload:', state.payrollData);

    // Phase 3 will wire this to the Node.js backend.
  });

  /**
   * Briefly flash the disburse button with a message, then restore.
   * @param {HTMLElement} btn
   * @param {string} message
   */
  function flashButton(btn, message) {
    const original = btn.innerHTML;
    btn.textContent = message;
    btn.style.opacity = '0.7';
    setTimeout(() => {
      btn.innerHTML = original;
      btn.style.opacity = '';
    }, 2000);
  }

  // ─── Drag-over CSS injection ──────────────────────────────────────────────────
  const dragStyle = document.createElement('style');
  dragStyle.textContent = `
    .upload-area.drag-over {
      background: rgba(139, 92, 246, 0.08) !important;
      border-color: rgba(139, 92, 246, 0.5) !important;
    }
  `;
  document.head.appendChild(dragStyle);

  // ─── Init ─────────────────────────────────────────────────────────────────────
  btnConnect.addEventListener('click', connectWallet);

})();
