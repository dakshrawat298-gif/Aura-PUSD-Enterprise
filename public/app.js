(() => {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────────
  const state = {
    walletAddress: null,
    mode: 'enterprise',
    employeeCount: 0,
    lastPayrollData: [],
  };

  // ─── DOM References ───────────────────────────────────────────────────────────
  const btnConnect      = document.getElementById('btnConnect');
  const csvInput        = document.getElementById('csvInput');
  const uploadArea      = document.getElementById('uploadArea');
  const employeeList    = document.getElementById('employeeList');
  const recipientBadge  = document.getElementById('recipientBadge');
  const totalAmount     = document.getElementById('totalAmount');
  const employeeCountDisplay = document.getElementById('employeeCountDisplay');
  const btnDisburse     = document.getElementById('btnDisburse');
  const disburseWrapper = document.getElementById('disburseWrapper');
  const btnAddEmployee  = document.getElementById('btnAddEmployee');

  // Progress card
  const cardProgress    = document.getElementById('cardProgress');
  const progressList    = document.getElementById('progressList');
  const progressBadge   = document.getElementById('progressBadge');
  const postPayment     = document.getElementById('postPayment');
  const successBanner   = document.getElementById('successBanner');
  const btnDownloadReport = document.getElementById('btnDownloadReport');
  const btnNewRun       = document.getElementById('btnNewRun');

  // Toggle
  const modeToggle      = document.getElementById('modeToggle');
  const togglePills     = modeToggle.querySelectorAll('.toggle-pill');

  // Enterprise cards
  const cardImportCSV    = document.getElementById('cardImportCSV');
  const cardBatchPayroll = document.getElementById('cardBatchPayroll');

  // Creator card
  const cardCreator  = document.getElementById('cardCreator');
  const creatorWallet= document.getElementById('creatorWallet');
  const tipAmount    = document.getElementById('tipAmount');
  const quickPills   = document.getElementById('quickPills');
  const tipMessage   = document.getElementById('tipMessage');
  const charCount    = document.getElementById('charCount');
  const btnSendTip   = document.getElementById('btnSendTip');

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

  // ─── Toast Notification System ───────────────────────────────────────────────

  const toastContainer = document.getElementById('toast-container');

  /**
   * Display a premium glassmorphic toast notification.
   * @param {string} message
   * @param {'success'|'error'|'info'} [type='info']
   * @param {number} [duration=3500] ms before auto-dismiss
   */
  function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon"></span>
      <span class="toast-message">${message}</span>
    `;

    toastContainer.appendChild(toast);

    const dismiss = () => {
      if (toast.classList.contains('removing')) return;
      toast.classList.add('removing');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    };

    const timer = setTimeout(dismiss, duration);
    toast.addEventListener('click', () => { clearTimeout(timer); dismiss(); });
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

  // ─── Payroll Total ────────────────────────────────────────────────────────────

  function recalculateTotal() {
    const inputs = employeeList.querySelectorAll('.emp-amount-input');
    let total = 0;
    inputs.forEach(input => {
      const val = parseFloat(input.value);
      if (!isNaN(val)) total += val;
    });
    totalAmount.textContent = `${formatAmount(total)} PUSD`;

    const count = employeeList.querySelectorAll('.emp-card').length;
    recipientBadge.textContent = `${count} Recipient${count !== 1 ? 's' : ''}`;
    employeeCountDisplay.textContent = count;
  }

  // ─── Employee Card Factory ────────────────────────────────────────────────────

  /**
   * Build and append one editable employee card to the list.
   * @param {{ walletAddress?: string, amount?: number }} [data]
   */
  function addEmployee(data = {}) {
    state.employeeCount += 1;
    const index = state.employeeCount;

    const li = document.createElement('li');
    li.className = 'emp-card';

    li.innerHTML = `
      <div class="emp-card-header">
        <div class="emp-card-label">
          <span class="emp-dot"></span>
          <span class="emp-name">Employee ${index}</span>
        </div>
        <button class="emp-remove" type="button">Remove</button>
      </div>
      <input
        type="text"
        class="field-input wallet-input emp-wallet-input"
        placeholder="Solana wallet address"
        value="${data.walletAddress || ''}"
        autocomplete="off"
        spellcheck="false"
      />
      <div class="amount-wrapper">
        <input
          type="number"
          class="field-input emp-amount-input"
          placeholder="0.00"
          value="${data.amount != null ? data.amount : ''}"
          min="0"
          step="0.01"
        />
        <span class="amount-suffix">PUSD</span>
      </div>
    `;

    // Remove handler
    li.querySelector('.emp-remove').addEventListener('click', () => {
      li.remove();
      recalculateTotal();
    });

    // Live total recalc on amount change
    li.querySelector('.emp-amount-input').addEventListener('input', recalculateTotal);

    employeeList.appendChild(li);
    recalculateTotal();
  }

  // ─── Read live payroll data from DOM ─────────────────────────────────────────

  function getPayrollFromDOM() {
    const cards = employeeList.querySelectorAll('.emp-card');
    const records = [];
    cards.forEach(card => {
      const wallet = card.querySelector('.emp-wallet-input').value.trim();
      const amount = parseFloat(card.querySelector('.emp-amount-input').value);
      if (wallet && !isNaN(amount) && amount > 0) {
        records.push({ walletAddress: wallet, amount });
      }
    });
    return records;
  }

  // Add Employee button
  btnAddEmployee.addEventListener('click', () => addEmployee());

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

      showToast('Wallet Connected Successfully', 'success');
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
      showToast('Wallet Disconnected', 'info');
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

  // ─── 3. Render editable payroll list ─────────────────────────────────────────

  /**
   * Clear the list and rebuild editable cards from a records array.
   * Pre-fills wallet + amount inputs so the user can still edit before disbursing.
   * @param {{ walletAddress: string, amount: number }[]} records
   */
  function renderPayrollList(records) {
    employeeList.innerHTML = '';
    state.employeeCount = 0;

    records.forEach(rec => addEmployee(rec));
  }

  // ─── 4. Disburse Trigger ─────────────────────────────────────────────────────
  btnDisburse.addEventListener('click', () => {
    if (!state.walletAddress) {
      showToast('Please connect your wallet first!', 'error');
      flashButton(btnDisburse, 'Connect wallet first');
      return;
    }

    const payrollData = getPayrollFromDOM();

    if (payrollData.length === 0) {
      showToast('Add at least one valid payroll entry first.', 'error');
      flashButton(btnDisburse, 'Add payroll data first');
      return;
    }

    state.lastPayrollData = payrollData;
    runDisburseSimulation(payrollData);
  });

  // ─── Disburse Simulation ──────────────────────────────────────────────────────

  function runDisburseSimulation(payrollData) {
    const total = payrollData.length;

    // 1. Lock the button
    btnDisburse.disabled = true;
    btnDisburse.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Running Payroll…`;

    // 2. Hide input cards, reveal progress card
    cardImportCSV.style.display    = 'none';
    cardBatchPayroll.style.display = 'none';
    cardProgress.style.display     = '';
    postPayment.style.display      = 'none';

    // 3. Build progress rows
    progressList.innerHTML = '';
    progressBadge.textContent = `0 / ${total}`;

    const rows = payrollData.map((rec, i) => {
      const li = document.createElement('li');
      li.className = 'progress-row';

      const shortWallet = `${rec.walletAddress.slice(0, 5)}…${rec.walletAddress.slice(-4)}`;
      li.innerHTML = `
        <span class="progress-dot"></span>
        <div class="progress-info">
          <span class="progress-wallet">${shortWallet}</span>
          <span class="progress-amount">${formatAmount(rec.amount)} PUSD</span>
        </div>
        <span class="progress-status">Pending…</span>
        <a class="progress-view" href="https://solscan.io/" target="_blank" rel="noopener">View ↗</a>
      `;

      progressList.appendChild(li);
      return li;
    });

    // 4. Animate each row in sequence with staggered timing
    const STEP_MS   = 500;   // delay between each employee starting
    const PHASE1_MS = 700;   // "Waiting for signature…"
    const PHASE2_MS = 1600;  // "Confirming on-chain…"
    const PHASE3_MS = 2600;  // "Paid ✓"

    let confirmedCount = 0;

    rows.forEach((row, i) => {
      const offset = i * STEP_MS;
      const dot    = row.querySelector('.progress-dot');
      const status = row.querySelector('.progress-status');
      const viewLink = row.querySelector('.progress-view');

      setTimeout(() => {
        status.textContent = 'Deriving stealth address…';
      }, offset);

      setTimeout(() => {
        status.textContent = 'Waiting for signature…';
      }, offset + PHASE1_MS);

      setTimeout(() => {
        status.textContent = 'Confirming on-chain…';
      }, offset + PHASE2_MS);

      setTimeout(() => {
        dot.classList.add('confirmed');
        row.classList.add('confirmed');
        status.textContent = 'Paid ✓';
        status.classList.add('paid');
        viewLink.classList.add('visible');

        confirmedCount += 1;
        progressBadge.textContent = `${confirmedCount} / ${total}`;

        // When last employee is confirmed
        if (confirmedCount === total) {
          onAllConfirmed(total);
        }
      }, offset + PHASE3_MS);
    });
  }

  function onAllConfirmed(total) {
    showToast(`All ${total} payroll transactions confirmed!`, 'success');

    successBanner.textContent = `All ${total} payroll transaction${total !== 1 ? 's' : ''} confirmed.`;
    postPayment.style.display  = '';

    btnDisburse.disabled = false;
    btnDisburse.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Payroll Complete`;
    btnDisburse.style.background = 'linear-gradient(135deg, #10b981, #059669)';
  }

  // ─── CSV Report Download ──────────────────────────────────────────────────────

  function downloadPayrollCSV() {
    const data = state.lastPayrollData;
    if (!data || data.length === 0) return;

    const now    = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const header = 'walletAddress,amount,status,timestamp';
    const rows   = data.map(r => `${r.walletAddress},${r.amount},Confirmed,${now}`);
    const csv    = [header, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `aura-payroll-${now}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  btnDownloadReport.addEventListener('click', downloadPayrollCSV);

  // ─── Reset / New Payroll Run ──────────────────────────────────────────────────

  function resetPayrollUI() {
    // Hide progress, reveal inputs
    cardProgress.style.display     = 'none';
    cardImportCSV.style.display    = '';
    cardBatchPayroll.style.display = '';
    postPayment.style.display      = 'none';

    // Clear progress list
    progressList.innerHTML = '';
    progressBadge.textContent = '0 / 0';

    // Reset employee list
    employeeList.innerHTML = '';
    state.employeeCount = 0;
    state.lastPayrollData = [];
    addEmployee();

    // Reset disburse button
    btnDisburse.disabled = false;
    btnDisburse.style.background = '';
    btnDisburse.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
      Disburse Payroll`;

    showToast('New payroll run ready.', 'info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  btnNewRun.addEventListener('click', resetPayrollUI);

  // ─── 5. Mode Toggle ──────────────────────────────────────────────────────────

  function setMode(mode) {
    state.mode = mode;

    togglePills.forEach(pill => {
      pill.classList.toggle('active', pill.dataset.mode === mode);
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

    const isAlreadySelected = pill.classList.contains('selected');
    quickPills.querySelectorAll('.quick-pill').forEach(p => p.classList.remove('selected'));

    if (!isAlreadySelected) {
      pill.classList.add('selected');
      tipAmount.value = pill.dataset.amount;
    } else {
      tipAmount.value = '';
    }
  });

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

    // Phase 7 will wire this to the stealth address backend.
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

  // ─── Init — seed one blank employee row ──────────────────────────────────────
  addEmployee();

})();
