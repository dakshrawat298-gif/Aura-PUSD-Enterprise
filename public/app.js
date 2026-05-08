(() => {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────────
  const state = {
    walletAddress: null,
    mode: 'enterprise',
    employeeCount: 0,
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
  const btnAddEmployee  = document.getElementById('btnAddEmployee');

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
      console.warn('[Aura] No wallet connected. Aborting disburse.');
      showToast('Please connect your wallet first!', 'error');
      flashButton(btnDisburse, 'Connect wallet first');
      return;
    }

    const payrollData = getPayrollFromDOM();

    if (payrollData.length === 0) {
      console.warn('[Aura] No valid payroll entries. Aborting disburse.');
      showToast('Add at least one valid payroll entry first.', 'error');
      flashButton(btnDisburse, 'Add payroll data first');
      return;
    }

    console.log('[Aura] Disburse triggered.');
    console.log('[Aura] Sender wallet:', state.walletAddress);
    console.log('[Aura] Payroll payload:', payrollData);

    // Phase 7 will wire this to the Node.js backend.
  });

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
