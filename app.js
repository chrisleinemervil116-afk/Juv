const STORAGE_KEY = 'nextplay_state_v1';

const defaultState = {
  users: [],
  currentUserId: null,
  products: [
    { id: 'p1', name: 'Free Fire - Diamonds', price: 157, category: 'Mobile' },
    { id: 'p2', name: 'FC Mobile - Points', price: 95, category: 'Mobile' },
    { id: 'p3', name: 'eFootball - Pièces', price: 220, category: 'Mobile' },
    { id: 'p4', name: 'PUBG Mobile - UC', price: 180, category: 'Mobile' },
    { id: 'p5', name: 'Blood Strike - GOLD', price: 157, category: 'Mobile' },
    { id: 'p6', name: 'Roblox - Robux', price: 750, category: 'Mobile' }
  ],
  orders: [],
  transactions: []
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      users: parsed.users || [],
      products: parsed.products || defaultState.products,
      orders: parsed.orders || [],
      transactions: parsed.transactions || []
    };
  } catch {
    return structuredClone(defaultState);
  }
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getCurrentUser() {
  return state.users.find((u) => u.id === state.currentUserId) || null;
}

function formatHTG(value) {
  return `${Number(value).toLocaleString('fr-FR')} HTG`;
}

function appendTransaction(userId, type, amount, label) {
  state.transactions.unshift({
    id: `TX-${Date.now()}`,
    userId,
    type,
    amount,
    label,
    at: new Date().toISOString()
  });
}

function createPaidOrder(user, productName, amount) {
  if (user.wallet < amount) {
    alert('Solde insuffisant. Merci de recharger votre wallet.');
    return false;
  }

  user.wallet -= amount;
  state.orders.unshift({
    id: `ORD-${Date.now()}`,
    userId: user.id,
    product: productName,
    amount,
    status: 'Livré',
    at: new Date().toISOString()
  });
  appendTransaction(user.id, 'Débit', amount, `Commande ${productName}`);
  saveState();
  refreshWalletUI();
  return true;
}

function initLayout() {
  const toggle = document.querySelector('[data-menu-toggle]');
  const sidebar = document.querySelector('.sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  }
}

function refreshWalletUI() {
  const user = getCurrentUser();
  document.querySelectorAll('[data-wallet-amount]').forEach((el) => {
    el.textContent = formatHTG(user ? user.wallet : 0);
  });

  document.querySelectorAll('[data-auth-link]').forEach((el) => {
    if (user) {
      el.textContent = `Bonjour, ${user.fullName.split(' ')[0]}`;
      el.setAttribute('href', 'profile.html');
    } else {
      el.textContent = 'Se connecter';
      el.setAttribute('href', 'auth.html');
    }
  });
}

function initWallet() {
  const balanceEl = document.querySelector('[data-balance]');
  const addForm = document.querySelector('[data-add-funds]');
  const txBody = document.querySelector('[data-transactions]');
  const methodSelect = document.querySelector('[data-payment-method]');
  const paymentInfo = document.querySelector('[data-payment-info]');
  const proofInput = document.querySelector('[data-proof-upload]');
  const proofStatus = document.querySelector('[data-proof-status]');
  if (!balanceEl) return;

  const user = getCurrentUser();
  if (!user) {
    balanceEl.textContent = 'Connectez-vous pour gérer votre wallet';
    return;
  }

  const paymentAccounts = {
    MonCash: { number: '34186164', name: 'Juvens Mervil' },
    NatCash: { number: '42219380', name: 'Mervil Celicien' }
  };

  const renderMethodInfo = () => {
    if (!methodSelect || !paymentInfo) return;
    const method = methodSelect.value;
    const account = paymentAccounts[method];
    if (!account) return;
    paymentInfo.innerHTML = `<p><strong>${method} :</strong> ${account.number}</p><p><strong>Nom :</strong> ${account.name}</p>`;
  };

  const renderWallet = () => {
    balanceEl.textContent = formatHTG(user.wallet);
    if (txBody) {
      const userTx = state.transactions.filter((t) => t.userId === user.id).slice(0, 8);
      txBody.innerHTML = userTx.length
        ? userTx
            .map(
              (t) => `<tr><td>${new Date(t.at).toLocaleString('fr-FR')}</td><td>${t.label}</td><td>${t.type}</td><td>${formatHTG(t.amount)}</td></tr>`
            )
            .join('')
        : '<tr><td colspan="4">Aucune transaction pour le moment.</td></tr>';
    }
  };

  renderWallet();
  renderMethodInfo();

  if (methodSelect) {
    methodSelect.addEventListener('change', renderMethodInfo);
  }

  if (proofInput && proofStatus) {
    proofInput.addEventListener('change', () => {
      const file = proofInput.files && proofInput.files[0];
      proofStatus.textContent = file ? `Photo sélectionnée: ${file.name}` : 'Aucune photo sélectionnée.';
      proofStatus.classList.toggle('ok', !!file);
    });
  }

  if (addForm) {
    addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const amount = Number(addForm.amount.value || 0);
      const method = addForm.method.value;
      const file = proofInput && proofInput.files ? proofInput.files[0] : null;

      if (amount <= 0) return;
      if (!file) {
        if (proofStatus) {
          proofStatus.textContent = '⚠️ Veuillez uploader une photo de preuve.';
          proofStatus.classList.remove('ok');
        }
        return;
      }

      user.wallet += amount;
      appendTransaction(user.id, 'Crédit', amount, `Recharge via ${method} (preuve: ${file.name})`);
      saveState();
      renderWallet();
      refreshWalletUI();
      addForm.reset();
      renderMethodInfo();
      if (proofStatus) {
        proofStatus.textContent = 'Aucune photo sélectionnée.';
        proofStatus.classList.remove('ok');
      }
    });
  }
}

function initShop() {
  const buttons = document.querySelectorAll('[data-buy-product]');
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const user = getCurrentUser();
      const productId = btn.getAttribute('data-buy-product');
      const product = state.products.find((p) => p.id === productId);
      if (!product) return;

      if (!user) {
        window.location.href = 'auth.html';
        return;
      }

      const ok = createPaidOrder(user, product.name, product.price);
      if (ok) alert('Commande validée et payée avec wallet ✅');
    });
  });
}

function initFreeFireProduct() {
  const packSelect = document.querySelector('[data-ff-pack]');
  const otherSelect = document.querySelector('[data-ff-other]');
  const buyBtn = document.querySelector('[data-ff-buy]');
  const warning = document.querySelector('[data-ff-warning]');
  const priceEl = document.querySelector('[data-ff-price]');
  if (!packSelect || !buyBtn || !warning || !priceEl) return;

  const updateSelectionUI = () => {
    const option = packSelect.options[packSelect.selectedIndex];
    const amount = Number(option?.value || 0);
    if (amount > 0) {
      priceEl.textContent = `Prix: ${formatHTG(amount)}`;
      warning.textContent = '✅ Pack sélectionné, vous pouvez ajouter au panier.';
      warning.classList.remove('warn');
      warning.classList.add('ok');
    } else {
      priceEl.textContent = 'Prix: --';
      warning.textContent = '⚠️ Veuillez sélectionner un pack ci-dessus';
      warning.classList.remove('ok');
      warning.classList.add('warn');
    }
  };

  packSelect.addEventListener('change', updateSelectionUI);
  updateSelectionUI();

  buyBtn.addEventListener('click', () => {
    const user = getCurrentUser();
    if (!user) {
      window.location.href = 'auth.html';
      return;
    }

    const option = packSelect.options[packSelect.selectedIndex];
    const amount = Number(option?.value || 0);
    const label = option?.dataset.label;
    if (!amount || !label) {
      warning.textContent = '⚠️ Veuillez sélectionner un pack ci-dessus';
      warning.classList.remove('ok');
      warning.classList.add('warn');
      return;
    }

    const extra = otherSelect && otherSelect.value ? ` + ${otherSelect.value}` : '';
    const productName = `Free Fire ${label}${extra}`;
    const ok = createPaidOrder(user, productName, amount);
    if (ok) {
      warning.textContent = '✅ Produit ajouté et payé avec votre wallet.';
      warning.classList.remove('warn');
      warning.classList.add('ok');
    }
  });
}


function initFc26Product() {
  const packSelect = document.querySelector('[data-fc-pack]');
  const emailInput = document.querySelector('[data-fc-email]');
  const passInput = document.querySelector('[data-fc-pass]');
  const whatsappInput = document.querySelector('[data-fc-whatsapp]');
  const buyBtn = document.querySelector('[data-fc-buy]');
  const warning = document.querySelector('[data-fc-warning]');
  const priceEl = document.querySelector('[data-fc-price]');
  if (!packSelect || !emailInput || !passInput || !whatsappInput || !buyBtn || !warning || !priceEl) return;

  const updateSelectionUI = () => {
    const option = packSelect.options[packSelect.selectedIndex];
    const amount = Number(option?.value || 0);
    if (amount > 0) {
      priceEl.textContent = `Prix: ${formatHTG(amount)}`;
      warning.textContent = '✅ Pack sélectionné.';
      warning.classList.remove('warn');
      warning.classList.add('ok');
    } else {
      priceEl.textContent = 'Prix: --';
      warning.textContent = '⚠️ Veuillez sélectionner un pack de points.';
      warning.classList.remove('ok');
      warning.classList.add('warn');
    }
  };

  packSelect.addEventListener('change', updateSelectionUI);
  updateSelectionUI();

  buyBtn.addEventListener('click', () => {
    const user = getCurrentUser();
    if (!user) {
      window.location.href = 'auth.html';
      return;
    }

    const option = packSelect.options[packSelect.selectedIndex];
    const amount = Number(option?.value || 0);
    const label = option?.dataset.label;
    const email = emailInput.value.trim();
    const password = passInput.value.trim();
    const whatsapp = whatsappInput.value.trim();

    if (!amount || !label) {
      warning.textContent = '⚠️ Veuillez sélectionner un pack de points.';
      warning.classList.remove('ok');
      warning.classList.add('warn');
      return;
    }

    if (!email || !password || !whatsapp) {
      warning.textContent = '⚠️ Renseignez les informations du compte.';
      warning.classList.remove('ok');
      warning.classList.add('warn');
      return;
    }

    const productName = `FC26 ${label} - ${whatsapp}`;
    const ok = createPaidOrder(user, productName, amount);
    if (ok) {
      warning.textContent = '✅ FC Points ajoutés avec succès.';
      warning.classList.remove('warn');
      warning.classList.add('ok');
      passInput.value = '';
    }
  });
}


function initPubgProduct() {
  const packSelect = document.querySelector('[data-pubg-pack]');
  const playerInput = document.querySelector('[data-pubg-player]');
  const buyBtn = document.querySelector('[data-pubg-buy]');
  const warning = document.querySelector('[data-pubg-warning]');
  const priceEl = document.querySelector('[data-pubg-price]');
  if (!packSelect || !playerInput || !buyBtn || !warning || !priceEl) return;

  const updateSelectionUI = () => {
    const option = packSelect.options[packSelect.selectedIndex];
    const amount = Number(option?.value || 0);
    if (amount > 0) {
      priceEl.textContent = `Prix: ${formatHTG(amount)}`;
      warning.textContent = '✅ Pack sélectionné.';
      warning.classList.remove('warn');
      warning.classList.add('ok');
    } else {
      priceEl.textContent = 'Prix: --';
      warning.textContent = '⚠️ Sélectionnez un pack et renseignez votre compte.';
      warning.classList.remove('ok');
      warning.classList.add('warn');
    }
  };

  packSelect.addEventListener('change', updateSelectionUI);
  updateSelectionUI();

  buyBtn.addEventListener('click', () => {
    const user = getCurrentUser();
    if (!user) {
      window.location.href = 'auth.html';
      return;
    }

    const option = packSelect.options[packSelect.selectedIndex];
    const amount = Number(option?.value || 0);
    const label = option?.dataset.label;
    const player = playerInput.value.trim();

    if (!amount || !label) {
      warning.textContent = '⚠️ Veuillez sélectionner un pack UC.';
      warning.classList.remove('ok');
      warning.classList.add('warn');
      return;
    }

    if (!player) {
      warning.textContent = '⚠️ Veuillez entrer votre email ou ID joueur.';
      warning.classList.remove('ok');
      warning.classList.add('warn');
      return;
    }

    const productName = `PUBG UC ${label} - ${player}`;
    const ok = createPaidOrder(user, productName, amount);
    if (ok) {
      warning.textContent = '✅ Recharge PUBG traitée avec succès.';
      warning.classList.remove('warn');
      warning.classList.add('ok');
    }
  });
}


function initEfootballProduct() {
  const packSelect = document.querySelector('[data-efootball-pack]');
  const emailInput = document.querySelector('[data-efootball-email]');
  const passInput = document.querySelector('[data-efootball-pass]');
  const whatsappInput = document.querySelector('[data-efootball-whatsapp]');
  const summaryPack = document.querySelector('[data-efootball-summary-pack]');
  const summaryPrice = document.querySelector('[data-efootball-summary-price]');
  const buyBtn = document.querySelector('[data-efootball-buy]');
  const warning = document.querySelector('[data-efootball-warning]');
  const priceEl = document.querySelector('[data-efootball-price]');
  if (!packSelect || !emailInput || !passInput || !whatsappInput || !summaryPack || !summaryPrice || !buyBtn || !warning || !priceEl) return;

  const updateSelectionUI = () => {
    const option = packSelect.options[packSelect.selectedIndex];
    const amount = Number(option?.value || 0);
    const label = option?.dataset.label;
    if (amount > 0 && label) {
      priceEl.textContent = `Prix: ${formatHTG(amount)}`;
      summaryPack.textContent = label;
      summaryPrice.textContent = formatHTG(amount);
      warning.textContent = '✅ Pack sélectionné.';
      warning.classList.remove('warn');
      warning.classList.add('ok');
    } else {
      priceEl.textContent = 'Prix: --';
      summaryPack.textContent = '--';
      summaryPrice.textContent = '--';
      warning.textContent = '⚠️ Sélectionnez un pack et remplissez les informations du compte.';
      warning.classList.remove('ok');
      warning.classList.add('warn');
    }
  };

  packSelect.addEventListener('change', updateSelectionUI);
  updateSelectionUI();

  buyBtn.addEventListener('click', () => {
    const user = getCurrentUser();
    if (!user) {
      window.location.href = 'auth.html';
      return;
    }

    const option = packSelect.options[packSelect.selectedIndex];
    const amount = Number(option?.value || 0);
    const label = option?.dataset.label;
    const email = emailInput.value.trim();
    const password = passInput.value.trim();
    const whatsapp = whatsappInput.value.trim();

    if (!amount || !label) {
      warning.textContent = '⚠️ Veuillez sélectionner un pack eFootball.';
      warning.classList.remove('ok');
      warning.classList.add('warn');
      return;
    }

    if (!email || !password || !whatsapp) {
      warning.textContent = '⚠️ Renseignez les informations du compte.';
      warning.classList.remove('ok');
      warning.classList.add('warn');
      return;
    }

    const productName = `eFootball ${label} - ${whatsapp}`;
    const ok = createPaidOrder(user, productName, amount);
    if (ok) {
      warning.textContent = '✅ Recharge eFootball traitée avec succès.';
      warning.classList.remove('warn');
      warning.classList.add('ok');
      passInput.value = '';
    }
  });
}


function initNetflixProduct() {
  const packSelect = document.querySelector('[data-netflix-pack]');
  const emailInput = document.querySelector('[data-netflix-email]');
  const whatsappInput = document.querySelector('[data-netflix-whatsapp]');
  const promoEl = document.querySelector('[data-netflix-promo]');
  const summaryDuration = document.querySelector('[data-netflix-summary-duration]');
  const summaryPrice = document.querySelector('[data-netflix-summary-price]');
  const buyBtn = document.querySelector('[data-netflix-buy]');
  const warning = document.querySelector('[data-netflix-warning]');
  if (!packSelect || !emailInput || !whatsappInput || !promoEl || !summaryDuration || !summaryPrice || !buyBtn || !warning) return;

  const updateSelectionUI = () => {
    const option = packSelect.options[packSelect.selectedIndex];
    const amount = Number(option?.value || 0);
    const duration = option?.dataset.label;
    const original = Number(option?.dataset.original || 0);

    if (amount > 0 && duration) {
      summaryDuration.textContent = duration;
      summaryPrice.textContent = formatHTG(amount);
      promoEl.textContent = original > amount ? `Promotion: ${formatHTG(original)} → ${formatHTG(amount)}` : 'Promotion: Prix standard';
      warning.textContent = '✅ Forfait sélectionné.';
      warning.classList.remove('warn');
      warning.classList.add('ok');
    } else {
      summaryDuration.textContent = '--';
      summaryPrice.textContent = '--';
      promoEl.textContent = 'Promotion: --';
      warning.textContent = '⚠️ Sélectionnez un forfait et remplissez vos informations.';
      warning.classList.remove('ok');
      warning.classList.add('warn');
    }
  };

  packSelect.addEventListener('change', updateSelectionUI);
  updateSelectionUI();

  buyBtn.addEventListener('click', () => {
    const user = getCurrentUser();
    if (!user) {
      window.location.href = 'auth.html';
      return;
    }

    const option = packSelect.options[packSelect.selectedIndex];
    const amount = Number(option?.value || 0);
    const duration = option?.dataset.label;
    const email = emailInput.value.trim();
    const whatsapp = whatsappInput.value.trim();

    if (!amount || !duration) {
      warning.textContent = '⚠️ Veuillez sélectionner une durée d’abonnement.';
      warning.classList.remove('ok');
      warning.classList.add('warn');
      return;
    }

    if (!email || !whatsapp) {
      warning.textContent = '⚠️ Renseignez votre email Netflix et WhatsApp.';
      warning.classList.remove('ok');
      warning.classList.add('warn');
      return;
    }

    const productName = `Netflix Premium ${duration} - ${whatsapp}`;
    const ok = createPaidOrder(user, productName, amount);
    if (ok) {
      warning.textContent = '✅ Abonnement Netflix ajouté avec succès.';
      warning.classList.remove('warn');
      warning.classList.add('ok');
    }
  });
}

function initOrders() {
  const ordersBody = document.querySelector('[data-orders]');
  if (!ordersBody) return;
  const user = getCurrentUser();
  if (!user) {
    ordersBody.innerHTML = '<tr><td colspan="5">Veuillez vous connecter pour voir vos commandes.</td></tr>';
    return;
  }

  const userOrders = state.orders.filter((o) => o.userId === user.id);
  ordersBody.innerHTML = userOrders.length
    ? userOrders
        .map(
          (o) => `<tr><td>${o.id}</td><td>${o.product}</td><td>${formatHTG(o.amount)}</td><td>${new Date(o.at).toLocaleDateString('fr-FR')}</td><td><span class="badge success">${o.status}</span></td></tr>`
        )
        .join('')
    : '<tr><td colspan="5">Aucune commande pour le moment.</td></tr>';
}

function initAuth() {
  const registerForm = document.querySelector('[data-register-form]');
  const loginForm = document.querySelector('[data-login-form]');

  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fullName = registerForm.fullName.value.trim();
      const email = registerForm.email.value.trim().toLowerCase();
      const password = registerForm.password.value;
      if (state.users.some((u) => u.email === email)) {
        alert('Cet email est déjà utilisé.');
        return;
      }
      const user = { id: `U-${Date.now()}`, fullName, email, password, wallet: 0 };
      state.users.push(user);
      state.currentUserId = user.id;
      saveState();
      window.location.href = 'profile.html';
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = loginForm.email.value.trim().toLowerCase();
      const password = loginForm.password.value;
      const user = state.users.find((u) => u.email === email && u.password === password);
      if (!user) {
        alert('Email ou mot de passe invalide.');
        return;
      }
      state.currentUserId = user.id;
      saveState();
      window.location.href = 'profile.html';
    });
  }
}

function initProfile() {
  const nameEl = document.querySelector('[data-profile-name]');
  const emailEl = document.querySelector('[data-profile-email]');
  const walletEl = document.querySelector('[data-profile-wallet]');
  const logoutBtn = document.querySelector('[data-logout]');
  const form = document.querySelector('[data-profile-form]');
  const user = getCurrentUser();

  if (!nameEl || !emailEl || !walletEl) return;

  if (!user) {
    window.location.href = 'auth.html';
    return;
  }

  const render = () => {
    nameEl.textContent = user.fullName;
    emailEl.textContent = user.email;
    walletEl.textContent = formatHTG(user.wallet);
    if (form) {
      form.fullName.value = user.fullName;
      form.email.value = user.email;
    }
  };

  render();

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      user.fullName = form.fullName.value.trim();
      user.email = form.email.value.trim().toLowerCase();
      saveState();
      refreshWalletUI();
      render();
      alert('Profil mis à jour.');
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      state.currentUserId = null;
      saveState();
      window.location.href = 'auth.html';
    });
  }
}

function syncRealtime() {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      state = loadState();
      refreshWalletUI();
      initOrders();
      initWallet();
    }
  });

  setInterval(() => {
    const latest = loadState();
    if (JSON.stringify(latest) !== JSON.stringify(state)) {
      state = latest;
      refreshWalletUI();
      initOrders();
      initWallet();
    }
  }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
  initLayout();
  refreshWalletUI();
  initAuth();
  initProfile();
  initWallet();
  initShop();
  initFreeFireProduct();
  initFc26Product();
  initPubgProduct();
  initEfootballProduct();
  initNetflixProduct();
  initOrders();
  syncRealtime();
});
