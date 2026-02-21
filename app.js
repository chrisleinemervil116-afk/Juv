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
  if (!balanceEl) return;

  const user = getCurrentUser();
  if (!user) {
    balanceEl.textContent = 'Connectez-vous pour gérer votre wallet';
    return;
  }

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

  if (addForm) {
    addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const amount = Number(addForm.amount.value || 0);
      if (amount <= 0) return;
      user.wallet += amount;
      appendTransaction(user.id, 'Crédit', amount, `Recharge via ${addForm.method.value}`);
      saveState();
      renderWallet();
      refreshWalletUI();
      addForm.reset();
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
  initOrders();
  syncRealtime();
});
