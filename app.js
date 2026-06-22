const TAX_RATE = 0.0825;
const ADMIN_EMAIL = "treyhartle695@gmail.com";
const ADMIN_CODE = "10BSBL";
const CATEGORIES = ["Shirts", "Shorts", "Pants", "Hoodies"];

const STORE_KEY = "offspeed_baseball_store_v2";
const STATE_KEY = "offspeed_baseball_state_v2";

const starterData = {
  products: [],
  customers: [],
  orders: [],
  paymentTransactions: [],
  discountCodes: [
    { code: "FIRSTPITCH", type: "percent", value: 15, active: true },
    { code: "CLEANUP", type: "fixed", value: 10, active: true },
  ],
  paymentSettings: {
    provider: "mock",
    destinationName: "",
    payoutEmail: "",
    stripeAccountId: "",
    statementDescriptor: "OFFSPEED BASEBALL",
  },
};

const defaultState = {
  view: "shopping",
  selectedProductId: "",
  menuOpen: false,
  query: "",
  category: "All",
  cart: [],
  user: null,
  developerUnlocked: false,
  checkout: {
    discountCode: "",
    name: "",
    email: "",
    card: "",
    expiry: "",
    cvc: "",
  },
  adminForm: {
    name: "",
    price: "",
    description: "",
    category: "Shirts",
    image: "",
    fileName: "",
  },
  adminDiscountEditIndex: null,
  openOrderId: null,
  toast: "",
};

// --- Initialization Wrapper ---
document.addEventListener("DOMContentLoaded", () => {
  window.$app = document.querySelector("#app");
  if (!window.$app) return;

  window.store = structuredClone(starterData);
  window.state = readJson(STATE_KEY, defaultState);

  initFirebaseSync();

  if (
    !window.store.products ||
    !window.store.orders ||
    !window.store.customers ||
    !window.store.discountCodes
  ) {
    window.store = starterData;
  }

  window.store.paymentSettings = {
    ...starterData.paymentSettings,
    ...(window.store.paymentSettings || {}),
  };
  window.store.paymentTransactions = window.store.paymentTransactions || [];
  window.store.customers = window.store.customers || [];
  window.store.discountCodes =
    window.store.discountCodes || starterData.discountCodes.slice();
  window.store.orders = window.store.orders || [];

  window.state = {
    ...defaultState,
    ...window.state,
    checkout: { ...defaultState.checkout, ...(window.state.checkout || {}) },
    adminForm: { ...defaultState.adminForm, ...(window.state.adminForm || {}) },
  };

  render();
});


async function initFirebaseSync() {
  const fb = window.firebaseServices;
  if (!fb?.db) {
    window.store = readJson(STORE_KEY, starterData);
    render();
    return;
  }

  const ref = fb.doc(fb.db, "stores", "main");

  const snap = await fb.getDoc(ref);
  if (!snap.exists()) {
    window.store = structuredClone(starterData);

    if (fb.auth.currentUser) {
      await fb.setDoc(ref, starterData);
    }
  } else {
    window.store = { ...structuredClone(starterData), ...snap.data() };
  }

  fb.onSnapshot(ref, (docSnap) => {
    if (docSnap.exists()) {
      window.store = {
        ...structuredClone(starterData),
        ...docSnap.data(),
        products: Array.isArray(docSnap.data()?.products) ? docSnap.data().products : [],
      };
      render();
    }
  });

  render();
}


// --- Helper Functions ---
function escapeHtml(unsafe) {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(unsafe) {
  return escapeHtml(unsafe).replace(/"/g, "&quot;");
}

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return "id_" + Math.random().toString(36).substring(2, 11);
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

async function save() {
  try {
    localStorage.setItem(
      STATE_KEY,
      JSON.stringify({ ...window.state, toast: "" })
    );

    // Always keep a local backup so refreshes don't lose data.
    localStorage.setItem(STORE_KEY, JSON.stringify(window.store));

    const fb = window.firebaseServices;

    // Only sync to Firestore when Firebase is loaded and a user is signed in.
    if (fb?.db && fb.auth?.currentUser) {
      const storeSize = new Blob([JSON.stringify(window.store)]).size;

      if (storeSize > 900000) {
        const msg = "⚠️ Store is getting too large for Firebase. Try using smaller images or removing old products.";
        console.warn(msg, "Current size:", storeSize, "bytes");
        setState({ toast: msg });
        clearToast();
        return;
      }

      await fb.setDoc(
        fb.doc(fb.db, "stores", "main"),
        window.store
      );
    }
  } catch (error) {
    console.error("Storage error:", error);
  }
}


async function forceCloudSave() {
  const fb = window.firebaseServices;
  if (!fb?.db || !fb.auth?.currentUser) {
    setState({ toast: "Sign in to save to cloud." });
    clearToast();
    return;
  }
  try {
    const storeSize = new Blob([JSON.stringify(window.store)]).size;
    if (storeSize > 900000) {
      setState({ toast: "⚠️ Store is too large for Firebase. Use smaller images or remove products." });
      clearToast();
      return;
    }

    await fb.setDoc(fb.doc(fb.db, "stores", "main"), window.store);
    setState({ toast: "✅ Saved to Cloud" });
  } catch (e) {
    console.error(e);
    setState({ toast: "❌ Cloud save failed" });
  }
  clearToast();
}

function setState(patch, options = {}) {
  window.state = { ...window.state, ...patch };
  save();
  render();
  restoreFocus(options.focus);
}

function setNested(section, patch, options = {}) {
  setState({ [section]: { ...window.state[section], ...patch } }, options);
}

function restoreFocus(selector) {
  if (!selector) return;
  const element = document.querySelector(selector);
  if (!element) return;
  element.focus();
}

function isDeveloper() {
  return Boolean(
    window.state.developerUnlocked ||
      window.state.user?.email?.toLowerCase() === ADMIN_EMAIL
  );
}

function routeTo(view, extra = {}) {
  setState({ view, selectedProductId: "", menuOpen: false, ...extra });
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

function clearToast() {
  setTimeout(() => setState({ toast: "" }), 3000);
}

function sendEmail(to, subject, body) {
  const params = new URLSearchParams({
    subject,
    body,
  });
  const mailto = `mailto:${encodeURIComponent(to)}?${params.toString()}`;
  window.location.href = mailto;
}

function getCurrentCustomer() {
  const email = window.state.user?.email;
  if (!email) return null;
  return (
    window.store.customers.find(
      (c) => c.email && c.email.toLowerCase() === email.toLowerCase()
    ) || null
  );
}

function upsertCustomer(email, name) {
  if (!email) return null;
  const lower = email.toLowerCase();
  let customer = window.store.customers.find(
    (c) => c.email.toLowerCase() === lower
  );
  const now = Date.now();
  if (!customer) {
    customer = {
      name: name || lower.split("@")[0],
      email,
      createdAt: now,
      earnedCodes: [],
    };
    window.store.customers.push(customer);
  } else {
    customer.name = name || customer.name;
    if (!customer.createdAt) customer.createdAt = now;
    if (!Array.isArray(customer.earnedCodes)) customer.earnedCodes = [];
  }
  save();
  return customer;
}

function accountAgeDays(customer) {
  if (!customer?.createdAt) return 0;
  const diff = Date.now() - customer.createdAt;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function availableDiscountCodes() {
  return window.store.discountCodes.filter((c) => c.active);
}

function customerEarnedCodes(customer) {
  if (!customer) return [];
  return Array.isArray(customer.earnedCodes) ? customer.earnedCodes : [];
}

function formatAddress(addr) {
  if (!addr) return "N/A";
  const parts = [
    addr.name || "",
    addr.street || "",
    [addr.city, addr.state, addr.zip].filter(Boolean).join(" "),
    addr.phone || "",
  ].filter(Boolean);
  return parts.join(", ") || "N/A";
}

// --- Render & Core Logic ---
function render() {
  const developer = isDeveloper();
  window.$app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <h1 class="logo">Offspeed Baseball</h1>
        <button class="hamburger" type="button" data-action="toggle-menu" aria-label="Open menu">
          <span class="hamburger-lines"></span>
        </button>
      </header>
      <nav class="nav ${developer ? "has-admin" : ""}" aria-label="Main navigation">
        ${navButton("shopping", "Shopping")}
        ${navButton(
          "cart",
          `Cart (${window.state.cart.reduce((sum, item) => sum + item.qty, 0)})`
        )}
        ${navButton("checkout", "Checkout")}
        ${developer ? navButton("admin", "Admin") : ""}
      </nav>
      ${window.state.menuOpen ? renderMenu(developer) : ""}
      <main class="main">${renderMain(developer)}</main>
      ${
        window.state.toast
          ? `<div class="toast" role="status">${escapeHtml(
              window.state.toast
            )}</div>`
          : ""
      }
      ${developer ? `<button class="cloud-save-btn" type="button" data-action="cloud-save">💾 Save to Cloud</button>` : ""}
    </div>
  `;
  bindEvents();
}

function navButton(view, label) {
  const active = window.state.view === view ? "active" : "";
  return `<button class="${active}" type="button" data-route="${view}">${label}</button>`;
}

function renderMenu(developer) {
  return `
    <div class="menu-backdrop" data-action="toggle-menu"></div>
    <aside class="menu" aria-label="Menu">
      <div class="menu-head">
        <h2>Menu</h2>
        <button class="icon-button" type="button" data-action="toggle-menu" aria-label="Close menu">&times;</button>
      </div>
      <section class="menu-section">
        <h3>Search</h3>
        <input class="input" data-field="query" value="${escapeAttr(
          window.state.query
        )}" placeholder="Item name" />
      </section>
      <section class="menu-section">
        <h3>Items</h3>
        <div class="chips">
          ${["All", ...CATEGORIES]
            .map(
              (category) => `
              <button type="button" class="chip ${
                window.state.category === category ? "active" : ""
              }" data-category="${category}">
                ${category}
              </button>`
            )
            .join("")}
        </div>
      </section>
      <section class="menu-section">
        <h3>Settings</h3>
        <div class="stack">
          <input class="input" data-secret-code placeholder="Secret code" />
          <button class="ghost" type="button" data-action="apply-code">Apply</button>
          <div class="small meta">${
            developer ? "Developer mode active" : "Customer mode"
          }</div>
          ${
            developer
              ? `<button class="ghost" type="button" data-action="exit-dev">Exit Dev Mode</button>`
              : ""
          }
        </div>
      </section>
      <section class="menu-section">
        <h3>Account</h3>
        ${renderAccount()}
      </section>
    </aside>
  `;
}

function renderAccount() {
  const customer = getCurrentCustomer();
  const earned = customerEarnedCodes(customer);
  const activeCodes = availableDiscountCodes();

  if (!window.state.user) {
    return `
      <div class="stack">
        <label class="label">Gmail<input class="input" data-login-email placeholder="name@gmail.com" /></label>
        <label class="label">Name<input class="input" data-login-name placeholder="Full name" /></label>
        <button class="primary" type="button" data-action="login">Continue with Google</button>
      </div>
    `;
  }
  return `
    <div class="stack">
      <div>
        <div class="meta">${escapeHtml(window.state.user.name)}</div>
        <div class="small">${escapeHtml(window.state.user.email)}</div>
        ${
          customer
            ? `<div class="small">Account age: ${accountAgeDays(
                customer
              )} days</div>`
            : ""
        }
      </div>
      <label class="label">Switch Gmail<input class="input" data-login-email value="${escapeAttr(
        window.state.user.email
      )}" /></label>
      <label class="label">Switch Name<input class="input" data-login-name value="${escapeAttr(
        window.state.user.name
      )}" /></label>
      <button class="ghost" type="button" data-action="login">Switch Google Account</button>
      <button class="ghost" type="button" data-action="logout">Log Out</button>

      <h4 class="panel-title">Discount Codes</h4>
      ${
        activeCodes.length
          ? `<div class="small">${activeCodes
              .map((c) =>
                escapeHtml(
                  `${c.code} / ${
                    c.type === "percent" ? `${c.value}%` : money(c.value)
                  }`
                )
              )
              .join("<br />")}</div>`
          : `<div class="small">No active discount codes.</div>`
      }

      <h4 class="panel-title">Earned Codes</h4>
      ${
        earned.length
          ? `<div class="small">${earned
              .map((code) => escapeHtml(code))
              .join("<br />")}</div>`
          : `<div class="small">You haven't earned any special codes yet.</div>`
      }
    </div>
  `;
}

function renderMain(developer) {
  if (window.state.selectedProductId) return renderProductDetail(developer);
  if (window.state.view === "cart") return renderCart();
  if (window.state.view === "checkout") return renderCheckout();
  if (window.state.view === "admin" && developer) return renderAdmin();
  return renderShopping();
}

function renderShopping() {
  const products = filteredProducts();
  return `
    <section class="hero-strip">
      <h2>${escapeHtml(
        window.state.category === "All" ? "Shop" : window.state.category
      )}</h2>
      <div class="meta">${products.length} items</div>
    </section>
    ${
      products.length
        ? `<section class="grid">${products.map(renderProductCard).join("")}</section>`
        : `<div class="empty">No listings yet</div>`
    }
  `;
}

function renderProductCard(product) {
  const displayPrice = product.salePrice
    ? `<s style="opacity: 0.6; margin-right: 0.4rem;">${money(
        product.price
      )}</s> <span style="color: red;">${money(product.salePrice)}</span>`
    : money(product.price);
  return `
    <article class="card">
      <button class="card-figure" type="button" data-product="${
        product.id
      }" aria-label="View ${escapeAttr(product.name)}">
        ${productFigure(product)}
      </button>
      <div class="card-body">
        <div class="stack">
          <h3>${escapeHtml(product.name)}</h3>
          <div class="row between">
            <span class="meta">${escapeHtml(product.category)}</span>
            <span class="price">${displayPrice}</span>
          </div>
        </div>
        <div class="actions">
          <button class="ghost" type="button" data-product="${
            product.id
          }">Details</button>
          <button class="primary" type="button" data-add="${
            product.id
          }">Add To Cart</button>
        </div>
      </div>
    </article>
  `;
}

function productFigure(product) {
  if (product.image)
    return `<img src="${product.image}" alt="${escapeHtml(
      product.name
    )} product image" />`;
  return baseballSvg();
}

function baseballSvg() {
  return `
    <div class="baseball" aria-hidden="true">
      <svg viewBox="0 0 200 200" role="img">
        <circle cx="100" cy="100" r="82" fill="#fff" stroke="#000" stroke-width="8"></circle>
        <path d="M61 36 C88 68 88 132 61 164" fill="none" stroke="#000" stroke-width="7"></path>
        <path d="M139 36 C112 68 112 132 139 164" fill="none" stroke="#000" stroke-width="7"></path>
        <g stroke="#000" stroke-width="5" stroke-linecap="square">
          <path d="M65 57 L78 50"></path><path d="M72 75 L87 69"></path>
          <path d="M76 96 L91 94"></path><path d="M74 118 L89 123"></path>
          <path d="M65 143 L79 151"></path><path d="M135 57 L122 50"></path>
          <path d="M128 75 L113 69"></path><path d="M124 96 L109 94"></path>
          <path d="M126 118 L111 123"></path><path d="M135 143 L121 151"></path>
        </g>
      </svg>
    </div>
  `;
}

function renderProductDetail(developer) {
  const product = window.store.products.find(
    (item) => item.id === window.state.selectedProductId
  );
  if (!product) return `<div class="empty">Item not found</div>`;
  const displayPrice = product.salePrice
    ? `<s style="opacity: 0.6; margin-right: 0.4rem;">${money(
        product.price
      )}</s> <span style="color: red;">${money(product.salePrice)}</span>`
    : money(product.price);
  return `
    <section class="detail">
      <div class="card-figure detail-figure">${productFigure(product)}</div>
      <div class="detail-body">
        <button class="ghost" type="button" data-action="back-shopping">Back</button>
        <h2>${escapeHtml(product.name)}</h2>
        <div class="row between">
          <span class="meta">${escapeHtml(product.category)}</span>
          <span class="price">${displayPrice}</span>
        </div>
        <p>${escapeHtml(product.description)}</p>
        <button class="primary" type="button" data-add="${product.id}">Add To Cart</button>
        ${
          developer
            ? `
          <hr style="width: 100%; border: 0; border-top: 1px solid #000; margin: 1.5rem 0 0.5rem;" />
          <h3 style="margin-bottom: 0;">Admin Controls</h3>
          <div class="row">
            <input class="input" style="flex: 1;" type="number" id="sale-price-input" placeholder="Sale Price (e.g. 19.99)" step="0.01" />
            <button class="ghost" type="button" data-action="set-sale" data-id="${product.id}">Set Sale</button>
            <button class="ghost" type="button" data-action="remove-sale" data-id="${product.id}">Remove Sale</button>
          </div>
          <button class="ghost" style="color: red; border-color: red; margin-top: 0.5rem;" type="button" data-action="delete-product" data-id="${product.id}">Delete Listing</button>
        `
            : ""
        }
      </div>
    </section>
  `;
}

function renderCart() {
  const details = cartDetails();
  return `
    <section class="hero-strip">
      <h2>Cart</h2>
      <div class="meta">${details.lines.length} lines</div>
    </section>
    ${
      details.lines.length
        ? `
        <div class="checkout-layout">
          <div class="cart-lines">${details.lines
            .map(renderCartLine)
            .join("")}</div>
          ${renderSummary(details, true)}
        </div>`
        : `<div class="empty">Your cart is empty</div>`
    }
  `;
}

function renderCartLine(line) {
  const activePrice = line.product.salePrice
    ? line.product.salePrice
    : line.product.price;
  return `
    <article class="cart-line">
      <div>
        <h3>${escapeHtml(line.product.name)}</h3>
        <div class="small">${escapeHtml(line.product.category)} / ${money(
    activePrice
  )} each</div>
      </div>
      <div class="stack">
        <div class="qty" aria-label="Quantity">
          <button type="button" data-dec="${line.product.id}">-</button>
          <span>${line.qty}</span>
          <button type="button" data-add="${line.product.id}">+</button>
        </div>
        <div class="price">${money(line.lineTotal)}</div>
        <button class="ghost" type="button" data-remove="${
          line.product.id
        }">Remove</button>
      </div>
    </article>
  `;
}

function renderCheckout() {
  return `
    <section class="hero-strip">
      <h2>Checkout</h2>
    </section>
    <div class="empty">Set up stripe</div>
  `;
}

function renderSummary(details, showCheckoutButton) {
  return `
    <aside class="summary">
      <div class="summary-row"><span>Subtotal</span><strong>${money(
        details.subtotal
      )}</strong></div>
      <div class="summary-row"><span>Discount</span><strong>${money(
        details.discount
      )}</strong></div>
      <div class="summary-row"><span>Tax</span><strong>${money(
        details.tax
      )}</strong></div>
      <div class="summary-row"><span>Payment</span><strong>${paymentStatusLabel()}</strong></div>
      <div class="summary-row total"><span>Total</span><span>${money(
        details.total
      )}</span></div>
      <div class="small">Destination: ${escapeHtml(
        paymentDestinationLabel()
      )}</div>
      ${
        showCheckoutButton
          ? `<button class="primary" type="button" data-route="checkout">Checkout</button>`
          : ""
      }
    </aside>
  `;
}

function renderAdmin() {
  return `
    <section class="hero-strip">
      <h2>Admin</h2>
      <div class="meta">${window.store.products.length} listings</div>
    </section>
    <div class="admin-layout">
      <form class="panel stack" data-admin-form>
        <h3 class="panel-title">New Listing</h3>
        <div class="dropzone" data-dropzone style="cursor: pointer;">
          ${
            window.state.adminForm.image
              ? `<img class="preview" src="${window.state.adminForm.image}" alt="Product upload preview" style="max-width: 100px;" />`
              : "Click to upload image"
          }
          <input type="file" data-file-input accept="image/*" hidden />
        </div>
        <label class="label">Name<input class="input" data-admin="name" value="${escapeAttr(
          window.state.adminForm.name
        )}" required /></label>
        <label class="label">Price<input class="input" data-admin="price" value="${escapeAttr(
          window.state.adminForm.price
        )}" type="number" min="0" step="0.01" required /></label>
        <label class="label">Description<textarea class="textarea" data-admin="description" required>${escapeHtml(
          window.state.adminForm.description
        )}</textarea></label>
        <label class="label">Category
          <select class="select" data-admin="category">
            ${CATEGORIES.map(
              (category) =>
                `<option ${
                  window.state.adminForm.category === category ? "selected" : ""
                }>${category}</option>`
            ).join("")}
          </select>
        </label>
        <button class="primary" type="submit">Publish Listing</button>
      </form>
      <div class="dashboard-grid">
        ${renderPaymentPanel()}
        ${renderTransactionsPanel()}
        ${renderDiscountCodesPanel()}
        ${renderCustomersPanel()}
        ${renderOrdersPanel()}
      </div>
    </div>
  `;
}

function renderPaymentPanel() {
  const settings = window.store.paymentSettings;
  return `
    <form class="panel stack" data-payment-form>
      <h3 class="panel-title">Payment Setup</h3>
      <label class="label">Checkout Mode
        <select class="select" data-payment="provider" name="provider">
          <option value="mock" ${
            settings.provider === "mock" ? "selected" : ""
          }>Mock Checkout</option>
          <option value="stripe" ${
            settings.provider === "stripe" ? "selected" : ""
          }>Stripe Account</option>
        </select>
      </label>
      <label class="label">Destination Name<input class="input" data-payment="destinationName" name="destinationName" value="${escapeAttr(
        settings.destinationName
      )}" /></label>
      <label class="label">Payout Email<input class="input" data-payment="payoutEmail" name="payoutEmail" value="${escapeAttr(
        settings.payoutEmail
      )}" /></label>
      <label class="label">Stripe Account ID<input class="input" data-payment="stripeAccountId" name="stripeAccountId" value="${escapeAttr(
        settings.stripeAccountId
      )}" /></label>
      <button class="primary" type="submit">Save Payment Setup</button>
    </form>
  `;
}

function renderTransactionsPanel() {
  const paidTotal = window.store.paymentTransactions.reduce(
    (sum, trans) => sum + Number(trans.amount || 0),
    0
  );
  return `
    <section class="panel stack">
      <h3 class="panel-title">Payments</h3>
      <div class="meta">${money(paidTotal)} paid / ${
    window.store.paymentTransactions.length
  } transactions</div>
    </section>
  `;
}

function renderDiscountCodesPanel() {
  const editingIndex = window.state.adminDiscountEditIndex;
  const editing =
    editingIndex !== null && window.store.discountCodes[editingIndex]
      ? window.store.discountCodes[editingIndex]
      : null;

  return `
    <section class="panel stack" data-discount-panel>
      <h3 class="panel-title">Discount Codes</h3>
      <div class="table">
        ${
          window.store.discountCodes.length
            ? window.store.discountCodes
                .map(
                  (code, index) => `
          <div class="table-row">
            <span>${escapeHtml(code.code)}</span>
            <span>${escapeHtml(
              code.type === "percent" ? `${code.value}%` : money(code.value)
            )}</span>
            <span>${code.active ? "Active" : "Inactive"}</span>
            <button class="ghost" type="button" data-edit-discount="${index}">Edit</button>
            <button class="ghost" type="button" data-delete-discount="${index}">Delete</button>
          </div>`
                )
                .join("")
            : `<div class="table-row"><span>No discount codes yet</span></div>`
        }
      </div>
      <form class="stack" data-discount-form>
        <label class="label">Code<input class="input" name="code" value="${escapeAttr(
          editing?.code || ""
        )}" required /></label>
        <label class="label">Type
          <select class="select" name="type">
            <option value="percent" ${
              !editing || editing?.type === "percent" ? "selected" : ""
            }>Percent</option>
            <option value="fixed" ${
              editing?.type === "fixed" ? "selected" : ""
            }>Fixed</option>
          </select>
        </label>
        <label class="label">Value<input class="input" name="value" type="number" min="0" step="0.01" value="${escapeAttr(
          editing?.value ?? ""
        )}" required /></label>
        <label class="label">Active
          <select class="select" name="active">
            <option value="true" ${
              !editing || editing?.active ? "selected" : ""
            }>Active</option>
            <option value="false" ${
              editing && !editing?.active ? "selected" : ""
            }>Inactive</option>
          </select>
        </label>
        <button class="primary" type="submit">${
          editing ? "Save Discount Code" : "Add Discount Code"
        }</button>
      </form>

      <form class="stack" data-bulk-discount-form>
        <h4 class="panel-title">Send Code To Accounts Older Than X Days</h4>
        <label class="label">Discount Code
          <select class="select" name="code">
            ${window.store.discountCodes
              .map(
                (c) =>
                  `<option value="${escapeAttr(c.code)}">${escapeHtml(
                    c.code
                  )}</option>`
              )
              .join("")}
          </select>
        </label>
        <label class="label">Account Age (days)<input class="input" name="days" type="number" min="0" value="10" /></label>
        <button class="ghost" type="submit">Send To Eligible Accounts</button>
      </form>
    </section>
  `;
}

function renderCustomersPanel() {
  return `
    <section class="panel stack">
      <h3 class="panel-title">Customers</h3>
      <div class="table">
        ${
          window.store.customers.length
            ? window.store.customers
                .map(
                  (c, index) => `
          <div class="table-row">
            <span>${escapeHtml(c.name || "")}</span>
            <span>${escapeHtml(c.email || "")}</span>
            <button class="ghost" type="button" data-delete-customer="${index}">Delete</button>
          </div>`
                )
                .join("")
            : `<div class="table-row"><span>No customers yet</span></div>`
        }
      </div>
    </section>
  `;
}

function renderOrdersPanel() {
  const openId = window.state.openOrderId;
  return `
    <section class="panel stack">
      <h3 class="panel-title">Order History</h3>
      <div class="table">
        ${
          window.store.orders.length
            ? window.store.orders
                .map((o) => {
                  const isOpen = openId === o.id;
                  const itemsHtml = (o.items || [])
                    .map((it) =>
                      escapeHtml(
                        `${it.name} x${it.qty} @ ${money(it.price || 0)}`
                      )
                    )
                    .join("<br />");
                  return `
            <div class="table-row">
              <span>${escapeHtml(o.customerEmail || "")}</span>
              <span>${money(o.total || 0)}</span>
              <button class="ghost" type="button" data-view-order="${escapeAttr(
                o.id
              )}">${isOpen ? "Hide Details" : "View Details"}</button>
            </div>
            ${
              isOpen
                ? `
              <div class="table-row">
                <span><strong>Billing:</strong> ${escapeHtml(
                  formatAddress(o.billing)
                )}</span>
                <span><strong>Delivery:</strong> ${escapeHtml(
                  formatAddress(o.delivery)
                )}</span>
                <span><strong>Items:</strong><br />${itemsHtml}</span>
              </div>`
                : ""
            }`;
                })
                .join("")
            : `<div class="table-row"><span>No orders yet</span></div>`
        }
      </div>
    </section>
  `;
}

// --- Event Handlers & Data Logic ---
function bindEvents() {
  document
    .querySelectorAll("[data-route]")
    .forEach((b) =>
      b.addEventListener("click", () => routeTo(b.dataset.route))
    );
  document
    .querySelectorAll("[data-action='toggle-menu']")
    .forEach((b) =>
      b.addEventListener("click", () =>
        setState({ menuOpen: !window.state.menuOpen })
      )
    );
  document
    .querySelectorAll("[data-product]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        setState({ selectedProductId: b.dataset.product, view: "shopping" })
      )
    );
  document
    .querySelectorAll("[data-add]")
    .forEach((b) =>
      b.addEventListener("click", () => addToCart(b.dataset.add))
    );
  document
    .querySelectorAll("[data-dec]")
    .forEach((b) =>
      b.addEventListener("click", () => changeQty(b.dataset.dec, -1))
    );
  document
    .querySelectorAll("[data-remove]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        setState({
          cart: window.state.cart.filter(
            (l) => l.productId !== b.dataset.remove
          ),
        })
      )
    );
  document
    .querySelectorAll("[data-category]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        setState({
          category: b.dataset.category,
          view: "shopping",
          menuOpen: false,
        })
      )
    );
  
  // Admin controls
  document.querySelectorAll("[data-action='set-sale']").forEach((b) =>
    b.addEventListener("click", () => setSale(b.dataset.id))
  );
  document.querySelectorAll("[data-action='remove-sale']").forEach((b) =>
    b.addEventListener("click", () => removeSale(b.dataset.id))
  );
  document.querySelectorAll("[data-action='delete-product']").forEach((b) =>
    b.addEventListener("click", () => deleteProduct(b.dataset.id))
  );
  // Sync admin form inputs
  document.querySelectorAll("[data-admin]").forEach((input) => {
    input.addEventListener("input", (e) => {
      setNested("adminForm", { [input.dataset.admin]: e.target.value });
    });
  });

  // File Upload Logic
  const fileInput = document.querySelector("[data-file-input]");
  fileInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 900;
        let { width, height } = img;
        const scale = Math.min(maxSize / width, maxSize / height, 1);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.82);
        setNested("adminForm", {
          image: compressed,
          fileName: file.name
        });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  const dropzone = document.querySelector("[data-dropzone]");
  dropzone?.addEventListener("click", () => {
    document.querySelector("[data-file-input]").click();
  });

  document
    .querySelector("[data-field='query']")
    ?.addEventListener("input", (e) =>
      setState({ query: e.target.value, view: "shopping" })
    );
  document
    .querySelector("[data-action='apply-code']")
    ?.addEventListener("click", () => {
      const code = document
        .querySelector("[data-secret-code]")
        ?.value.trim()
        .toUpperCase();
      const accepted = code === ADMIN_CODE;
      setState({
        developerUnlocked: accepted || window.state.developerUnlocked,
        toast: accepted ? "Dev mode active" : "Code invalid",
      });
      clearToast();
    });
  document
    .querySelector("[data-action='exit-dev']")
    ?.addEventListener("click", () =>
      setState({ developerUnlocked: false, toast: "Dev mode off" })
    );
  document
    .querySelector("[data-action='login']")
    ?.addEventListener("click", login);
  document
    .querySelector("[data-action='cloud-save']")
    ?.addEventListener("click", forceCloudSave);
  document
    .querySelector("[data-action='logout']")
    ?.addEventListener("click", async () => {
      const fb = window.firebaseServices;
      try {
        if (fb?.auth) await fb.signOut(fb.auth);
      } catch (e) {
        console.error(e);
      }
      setState({ user: null, developerUnlocked: false, view: "shopping" });
    });
  document
    .querySelector("[data-action='back-shopping']")
    ?.addEventListener("click", () =>
      setState({ selectedProductId: "", view: "shopping" })
    );
  document
    .querySelector("[data-admin-form]")
    ?.addEventListener("submit", publishListing);
  document
    .querySelector("[data-payment-form]")
    ?.addEventListener("submit", savePaymentSettings);

  document
    .querySelector("[data-discount-form]")
    ?.addEventListener("submit", handleDiscountForm);
  document
    .querySelector("[data-bulk-discount-form]")
    ?.addEventListener("submit", handleBulkDiscount);

  document
    .querySelectorAll("[data-delete-discount]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        deleteDiscount(Number(b.dataset.deleteDiscount))
      )
    );
  document
    .querySelectorAll("[data-edit-discount]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        startEditDiscount(Number(b.dataset.editDiscount))
      )
    );

  document
    .querySelectorAll("[data-delete-customer]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        deleteCustomer(Number(b.dataset.deleteCustomer))
      )
    );

  document
    .querySelectorAll("[data-view-order]")
    .forEach((b) =>
      b.addEventListener("click", () => {
        const id = b.dataset.viewOrder;
        setState({
          openOrderId: window.state.openOrderId === id ? null : id,
        });
      })
    );
}

function addToCart(productId) {
  const existing = window.state.cart.find((l) => l.productId === productId);
  const cart = existing
    ? window.state.cart.map((l) =>
        l.productId === productId ? { ...l, qty: l.qty + 1 } : l
      )
    : [...window.state.cart, { productId, qty: 1 }];
  setState({ cart, toast: "Added to cart" });
  clearToast();
}

function changeQty(productId, amount) {
  const cart = window.state.cart
    .map((l) =>
      l.productId === productId ? { ...l, qty: l.qty + amount } : l
    )
    .filter((l) => l.qty > 0);
  setState({ cart });
}

function cartDetails() {
  const lines = window.state.cart
    .map((line) => {
      const product = window.store.products.find(
        (p) => p.id === line.productId
      );
      if (!product) return null;
      const price = product.salePrice || product.price;
      return { ...line, product, lineTotal: price * line.qty };
    })
    .filter(Boolean);
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const discount = getDiscount(subtotal);
  const taxable = Math.max(subtotal - discount, 0);
  const tax = taxable * TAX_RATE;
  return { lines, subtotal, discount, tax, total: taxable + tax };
}

function getDiscount(subtotal) {
  const code = window.state.checkout.discountCode.trim().toUpperCase();
  const d = window.store.discountCodes.find(
    (i) => i.active && i.code === code
  );
  if (!d) return 0;
  return d.type === "percent"
    ? subtotal * (d.value / 100)
    : Math.min(d.value, subtotal);
}

function paymentIsConfigured() {
  const s = window.store.paymentSettings;
  return Boolean(
    s.stripeAccountId?.trim() ||
      s.payoutEmail?.trim() ||
      s.destinationName?.trim()
  );
}

function paymentProviderLabel() {
  return window.store.paymentSettings.provider === "stripe" ? "Stripe" : "Mock";
}
function paymentDestinationLabel() {
  return "Configured";
}
function paymentStatusLabel() {
  return paymentIsConfigured() ? "Payment Ready" : "Setup Required";
}
function cardLastFour() {
  return String(window.state.checkout.card || "")
    .replace(/\D/g, "")
    .slice(-4);
}
function paymentFormIsReady() {
  return paymentIsConfigured() && window.state.checkout.card?.length >= 12;
}

function filteredProducts() {
  const q = window.state.query.toLowerCase();
  return window.store.products.filter(
    (p) =>
      (!q || p.name.toLowerCase().includes(q)) &&
      (window.state.category === "All" || p.category === window.state.category)
  );
}

async function login() {
  const fb = window.firebaseServices;
  if (!fb) {
    setState({ toast: "Firebase not ready" });
    clearToast();
    return;
  }

  try {
    const provider = new fb.GoogleAuthProvider();
    const result = await fb.signInWithPopup(fb.auth, provider);
    const user = result.user;

    const email = (user.email || "").toLowerCase();
    const name = user.displayName || email.split("@")[0];

    upsertCustomer(email, name);

    setState({
      user: { email, name },
      menuOpen: false,
      toast: "Signed in",
    });
    clearToast();
  } catch (err) {
    console.error(err);
    setState({ toast: "Google sign-in failed" });
    clearToast();
  }
}

async function publishListing(e) {
  e.preventDefault();
  const form = window.state.adminForm;
  const product = {
    id: generateId(),
    name: form.name || "",
    price: Number(form.price) || 0,
    category: form.category || "Other",
    description: form.description || "",
    image: form.image || "",
  };
  window.store.products.unshift(product);
  await save();
  setState({ adminForm: defaultState.adminForm, toast: "Published!" });
  clearToast();
}

function savePaymentSettings(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  window.store.paymentSettings = {
    ...window.store.paymentSettings,
    provider: formData.get("provider"),
    destinationName: formData.get("destinationName"),
    payoutEmail: formData.get("payoutEmail"),
    stripeAccountId: formData.get("stripeAccountId"),
  };
  save();
  setState({ toast: "Saved!" });
  clearToast();
}

function handleDiscountForm(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const code = String(formData.get("code") || "")
    .trim()
    .toUpperCase();
  const type = formData.get("type") === "fixed" ? "fixed" : "percent";
  const value = Number(formData.get("value") || 0);
  const active = formData.get("active") !== "false";

  if (!code) {
    setState({ toast: "Code is required" });
    clearToast();
    return;
  }

  const discount = { code, type, value, active };
  const idx = window.state.adminDiscountEditIndex;

  if (idx !== null && window.store.discountCodes[idx]) {
    window.store.discountCodes[idx] = discount;
  } else {
    window.store.discountCodes.push(discount);
  }

  save();
  setState({
    toast: idx !== null ? "Discount updated" : "Discount added",
    adminDiscountEditIndex: null,
  });
  clearToast();
  e.target.reset();
}

function deleteDiscount(index) {
  if (
    index < 0 ||
    index >= window.store.discountCodes.length ||
    !window.store.discountCodes.length
  )
    return;
  window.store.discountCodes.splice(index, 1);
  save();
  const newIndex =
    window.state.adminDiscountEditIndex === index
      ? null
      : window.state.adminDiscountEditIndex;
  setState({ toast: "Discount deleted", adminDiscountEditIndex: newIndex });
  clearToast();
}

function startEditDiscount(index) {
  if (
    index < 0 ||
    index >= window.store.discountCodes.length ||
    !window.store.discountCodes[index]
  )
    return;
  setState({ adminDiscountEditIndex: index });
}

function handleBulkDiscount(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const code = String(formData.get("code") || "")
    .trim()
    .toUpperCase();
  const days = Number(formData.get("days") || 0);

  if (!code) {
    setState({ toast: "Choose a discount code" });
    clearToast();
    return;
  }

  const now = Date.now();
  const ms = days * 24 * 60 * 60 * 1000;

  const eligibleCustomers = window.store.customers.filter((c) => {
    if (!c.createdAt) return false;
    return now - c.createdAt >= ms;
  });

  if (!eligibleCustomers.length) {
    setState({ toast: "No eligible accounts" });
    clearToast();
    return;
  }

  const recipients = eligibleCustomers.map((c) => c.email).join(",");
  const subject = "You unlocked a discount at OFFSPEED BASEBALL";
  const body =
    `Thanks for being with OFFSPEED BASEBALL.\n\n` +
    `Here is your code: ${code}\n\n` +
    `Apply it at checkout next time you shop.\n\n` +
    `Play ball,\nOFFSPEED BASEBALL`;

  sendEmail(recipients, subject, body);

  window.store.customers = window.store.customers.map((c) => {
    if (!eligibleCustomers.find((ec) => ec.email === c.email)) return c;
    const earned = Array.isArray(c.earnedCodes) ? c.earnedCodes.slice() : [];
    if (!earned.includes(code)) earned.push(code);
    return { ...c, earnedCodes: earned };
  });
  save();

  setState({
    toast: "Email draft opened for eligible accounts",
  });
  clearToast();
}

function deleteCustomer(index) {
  if (index < 0 || index >= window.store.customers.length) return;
  window.store.customers.splice(index, 1);
  save();
  setState({ toast: "Customer deleted" });
  clearToast();
}

// Admin helper functions
function setSale(productId) {
  const input = document.getElementById("sale-price-input");
  const salePrice = Number(input.value);
  if (!salePrice || salePrice <= 0) {
    setState({ toast: "Enter valid sale price" });
    clearToast();
    return;
  }
  window.store.products = window.store.products.map((p) =>
    p.id === productId ? { ...p, salePrice } : p
  );
  save();
  setState({ toast: "Sale set!" });
  clearToast();
}

function removeSale(productId) {
  window.store.products = window.store.products.map((p) =>
    p.id === productId ? { ...p, salePrice: undefined } : p
  );
  save();
  setState({ toast: "Sale removed" });
  clearToast();
}

function deleteProduct(productId) {
  if (!confirm("Are you sure?")) return;
  window.store.products = window.store.products.filter((p) => p.id !== productId);
  save();
  setState({ selectedProductId: "", view: "shopping", toast: "Product deleted" });
  clearToast();
}

window.addEventListener("load", () => {
  const wait = setInterval(() => {
    const fb = window.firebaseServices;
    if (!fb?.auth) return;
    clearInterval(wait);
    fb.onAuthStateChanged(fb.auth, (user) => {
      if (user) {
        setState({
          user: {
            email: (user.email || "").toLowerCase(),
            name: user.displayName || (user.email || "").split("@")[0]
          }
        });
      }
    });
  }, 250);
});
