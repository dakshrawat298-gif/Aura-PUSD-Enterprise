(() => {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────────
  const state = {
    walletAddress: null,
    payrollData: [],
    mode: 'enterprise',
  };

  // ─── DOM References ───────────────────────────────────────────────────────────
  const btnConnect      = document.getElementById('btnConnect');
  const csvInput        = document.getElementById('csvInput');
  const uploadArea      = document.getElementById('uploadArea');
  const employeeList    = document.getElementById('employeeList');
  const recipientBadge  = document.getElementById('recipientBadge');
  const totalAmount     = document.getElementById('totalAmount');
  const btnDisburse     = document.getElementById('btnDisburse');
  const disburseWrapper = document.getElementById('disburseWrapper');

  // Toggle
  const modeToggle      = document.getElementById('modeToggle');
  const togglePills     = modeToggle.querySelectorAll('.toggle-pill');

  // Enterprise cards
  const cardImportCSV   = document.getElementById('cardImportCSV');
  const cardBatchPayroll= document.getElementById('cardBatchPayroll');

  // Creator card
  const cardCreator     = document.getElementById('cardCreator');
  const creatorWallet   = document.getElementById('creatorWallet');
  const tipAmount       = document.getElementById('tipAmount');
  const quickPills      = document.getElementById('quickPills');
  const tipMessage      = document.getElementById('tipMessage');
  const charCount       = document.getElementById('charCount');
  const btnSendTip      = document.getElementById('btnSendTip');

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function abbreviateAddress(address) {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 4)}…${address.slice(-4)}`;
  }

  function formatAmount(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    return num.toLocaleString('en-US', { maximumFractionDigits: 6 });
  }

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

  function flashButton(btn, message) {
    const original = btn.innerHTML;
    btn.textContent = message;
    btn.style.opacity = '0.7';
    setTimeout(() => {
      btn.innerHTML = original;
      btn.style.opacity = '';
    }, 2000);
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
      btnConnect.style.background = 'rgba(16, 185, 129, 0.12)';
      btnConnect.style.border = '1px solid rgba(16, 185, 129, 0.35)';
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

  btnConnect.addEventListener('click', connectWallet);

  // ─── 2. CSV File Handling ─────────────────────────────────────────────────────

  function parseCSV(raw) {
    const lines = raw
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length < 2) return [];

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

  function handleCSVFile(file) {
    if (!file || !file.name.endsWith('.csv')) {
      showUploadFeedback('Please upload a valid .csv file.', 'error');
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const records = parseCSV(e.target.result);

      if (records.length === 0) {
        showUploadFeedback('No valid records found. Expected columns: walletAddress, amount.', 'error');
        return;
      }

      state.payrollData = records;
      showUploadFeedback(`✓ Loaded ${records.length} recipient${records.length !== 1 ? 's' : ''} from CSV.`, 'success');
      renderPayrollList(records);
    };

    reader.onerror = () => showUploadFeedback('Failed to read file. Please try again.', 'error');
    reader.readAsText(file);
  }

  csvInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleCSVFile(file);
    e.target.value = '';
  });

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });

  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleCSVFile(file);
  });

  // ─── 3. Dynamic UI Updates ────────────────────────────────────────────────────

  function renderPayrollList(records) {
    employeeList.innerHTML = '';

    records.forEach((rec, i) => {
      const li = document.createElement('li');
      li.className = 'employee-item';
      li.innerHTML = `
        <div class="employee-avatar">E${i + 1}</div>
        <div class="employee-info">
          <span class="employee-name">Employee ${i + 1}</span>
          <span class="employee-address">${abbreviateAddress(rec.walletAddress)}</span>
        </div>
        <span class="employee-amount">${formatAmount(rec.amount)} PUSD</span>
      `;
      employeeList.appendChild(li);
    });

    recipientBadge.textContent = `${records.length} Recipient${records.length !== 1 ? 's' : ''}`;

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

    // Phase 6 will wire this to the Node.js backend.
  });

  // ─── 5. Mode Toggle ──────────────────────────────────────────────────────────

  function setMode(mode) {
    state.mode = mode;

    // Update pill active states
    togglePills.forEach(pill => {
      if (pill.dataset.mode === mode) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });

    if (mode === 'enterprise') {
      cardImportCSV.style.display    = '';
      cardBatchPayroll.style.display = '';
      cardCreator.style.display      = 'none';
      disburseWrapper.style.display  = '';
    } else {
      cardImportCSV.style.display    = 'none';
      cardBatchPayroll.style.display = 'none';
      cardCreator.style.display      = '';
      disburseWrapper.style.display  = 'none';
    }
  }

  modeToggle.addEventListener('click', (e) => {
    const pill = e.target.closest('.toggle-pill');
    if (!pill) return;
    const mode = pill.dataset.mode;
    if (mode && mode !== state.mode) setMode(mode);
  });

  // ─── 6. Creator — Quick-Select Pills ─────────────────────────────────────────
  quickPills.addEventListener('click', (e) => {
    const pill = e.target.closest('.quick-pill');
    if (!pill) return;

    // Toggle selected state
    const isAlreadySelected = pill.classList.contains('selected');
    quickPills.querySelectorAll('.quick-pill').forEach(p => p.classList.remove('selected'));

    if (!isAlreadySelected) {
      pill.classList.add('selected');
      tipAmount.value = pill.dataset.amount;
    } else {
      tipAmount.value = '';
    }
  });

  // Clear quick-pill selection when user manually edits the amount
  tipAmount.addEventListener('input', () => {
    quickPills.querySelectorAll('.quick-pill').forEach(p => p.classList.remove('selected'));
  });

  // ─── 7. Creator — Char Counter ────────────────────────────────────────────────
  tipMessage.addEventListener('input', () => {
    charCount.textContent = tipMessage.value.length;
  });

  // ─── 8. Creator — Send Tip Trigger ───────────────────────────────────────────
  btnSendTip.addEventListener('click', () => {
    if (!state.walletAddress) {
      console.warn('[Aura] No wallet connected. Aborting tip.');
      flashButton(btnSendTip, 'Connect wallet first');
      return;
    }

    const wallet = creatorWallet.value.trim();
    const amount = parseFloat(tipAmount.value);

    if (!wallet) {
      console.warn('[Aura] No creator wallet entered.');
      flashButton(btnSendTip, 'Enter a wallet address');
      return;
    }

    if (!amount || amount <= 0) {
      console.warn('[Aura] Invalid tip amount.');
      flashButton(btnSendTip, 'Enter a valid amount');
      return;
    }

    const payload = {
      sender: state.walletAddress,
      recipient: wallet,
      amount,
      message: tipMessage.value.trim() || null,
    };

    console.log('[Aura] Anonymous tip triggered.');
    console.log('[Aura] Tip payload:', payload);

    // Phase 6 will wire this to the stealth address backend.
  });

  // ─── Drag-over CSS injection ──────────────────────────────────────────────────
  const dragStyle = document.createElement('style');
  dragStyle.textContent = `
    .upload-area.drag-over {
      background: rgba(16, 185, 129, 0.07) !important;
      border-color: rgba(16, 185, 129, 0.5) !important;
    }
  `;
  document.head.appendChild(dragStyle);

})();
