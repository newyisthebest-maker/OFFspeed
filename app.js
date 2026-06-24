
async function isDeveloperEmail(email) {
  email = (email || "").toLowerCase();
  if (email === OWNER_EMAIL) return true;

  try {
    const fb = window.firebaseServices;
    if (!fb?.db) return false;

    const snap = await fb.getDoc(
      fb.doc(fb.db, "developerEmails", email)
    );

    return snap.exists();
  } catch (e) {
    console.error("Developer check failed:", e);
    return false;
  }
}

async function addDeveloperEmail(email) {
  const fb = window.firebaseServices;
  if (!fb?.db) return;

  email = email.trim().toLowerCase();
  if (!email || email === OWNER_EMAIL) return;

  await fb.setDoc(
    fb.doc(fb.db, "developerEmails", email),
    {
      addedAt: Date.now()
    }
  );
}

async function removeDeveloperEmail(email) {
  const fb = window.firebaseServices;
  if (!fb?.db) return;

  email = email.trim().toLowerCase();
  if (!email || email === OWNER_EMAIL) return;

  await fb.deleteDoc(
    fb.doc(fb.db, "developerEmails", email)
  );
}

const OWNER_EMAIL = "newyisthebest@gmail.com";
const STRIPE_PUBLIC_KEY = "pk_test_51TlgZkL3sCBtyY1dNSNijpJ4uEPRTIQQ3CD5PfmqL67VPGKWHvwYuEPsgVYpvkCwBQ2GYz9WFQZHHMm8GUCLuc3400RDusnpB2";
const BACKEND_URL = "https://offspeed-server.onrender.com";
const TAX_RATE = 0;
const ADMIN_EMAIL = "treyhartle695@gmail.com";
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
    images: [],
  },
  adminDiscountEditIndex: null,
  developerEmails: [],
  openOrderId: null,
  currentProductImageIndex: 0,
  toast: "",
};

// --- Initialization Wrapper ---
document.addEventListener("DOMContentLoaded", async () => {
  window.$app = document.querySelector("#app");
  if (!window.$app) return;

  window.store = structuredClone(starterData);
  window.state = readJson(STATE_KEY, defaultState);

  await initFirebaseSync();

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
  window.firebaseLoaded = false;
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

    try {
      await fb.setDoc(ref, starterData);
    } catch (e) {
      console.error("Initial cloud save failed:", e);
    }
  } else {
    window.store = { ...structuredClone(starterData), ...snap.data() };
  }

  fb.onSnapshot(ref, (docSnap) => {
    if (docSnap.exists()) {
      window.store = {
        ...structuredClone(starterData),
        ...docSnap.data(),
        products: window.store.products || [],
      };
      render();
    }
  });

  await loadProductsFromCloud();
  if (typeof loadDeveloperEmails === "function") await loadDeveloperEmails();
  window.firebaseLoaded = true;
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


async function waitForFirebaseUser(timeout = 5000) {
  const fb = window.firebaseServices;
  if (!fb?.auth) return null;
  if (fb.auth.currentUser) return fb.auth.currentUser;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsub && unsub();
      resolve(fb.auth.currentUser || null);
    }, timeout);
    const unsub = fb.onAuthStateChanged
      ? fb.onAuthStateChanged(fb.auth, (user) => {
          clearTimeout(timer);
          unsub && unsub();
          resolve(user || null);
        })
      : null;
  });
}



function buildLocalStoreCache() {
  return {
    discountCodes: window.store.discountCodes || [],
    customers: window.store.customers || [],
    orders: window.store.orders || [],
    paymentSettings: window.store.paymentSettings || {},
    paymentTransactions: window.store.paymentTransactions || [],
    developerEmails: window.store.developerEmails || []
  };
}


function safeSaveStoreCache() {
  const cache = {
    discountCodes: window.store?.discountCodes || [],
    customers: window.store?.customers || [],
    orders: window.store?.orders || [],
    paymentSettings: window.store?.paymentSettings || {},
    paymentTransactions: window.store?.paymentTransactions || [],
    developerEmails: window.store?.developerEmails || []
  };

  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("Could not save store cache, skipping local cache.", e);
    try {
      localStorage.removeItem(STORE_KEY);
    } catch (_) {}
  }
}


async function loadProductsFromCloud() {
  const fb = window.firebaseServices;
  if (!fb?.db || !fb.getDocs) return;
  try {
    const snap = await fb.getDocs(fb.collection(fb.db, "stores", "main", "products"));
    window.store.products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    safeSaveStoreCache();
    render();
  } catch (e) {
    console.error("Failed loading products collection:", e);
  }
}

async function syncProductsToCloud() {
  const fb = window.firebaseServices;
  if (!fb?.db || !fb.collection) return;
  try {
    const col = fb.collection(fb.db, "stores", "main", "products");
    const existing = await fb.getDocs(col);
    const existingIds = new Set(existing.docs.map(d => d.id));

    for (const p of window.store.products) {
      await fb.setDoc(fb.doc(fb.db, "stores", "main", "products", p.id), p);
      existingIds.delete(p.id);
    }

    for (const id of existingIds) {
      await fb.deleteDoc(fb.doc(fb.db, "stores", "main", "products", id));
    }
  } catch (e) {
    console.error("Products collection sync failed:", e);
  }
}

async function save() {
  try {
    localStorage.setItem(
      STATE_KEY,
      JSON.stringify({ ...window.state, toast: "" })
    );

    // Always keep a local backup so refreshes don't lose data.
    safeSaveStoreCache();

    const fb = window.firebaseServices;

    // Prevent startup from overwriting Firestore with an empty store.
    if (fb?.db && window.firebaseLoaded) {
      const cloudStore = buildCloudStore();
      const storeSize = new Blob([JSON.stringify(cloudStore)]).size;

      if (storeSize > 900000) {
        const msg = "⚠️ Store is getting too large for Firebase. Try using smaller images or removing old products.";
        console.warn(msg, "Current size:", storeSize, "bytes");
        setState({ toast: msg });
        clearToast();
        return;
      }

      await fb.setDoc(
        fb.doc(fb.db, "stores", "main"),
        cloudStore
      );
    }
  } catch (error) {
    console.error("Storage error:", error);
  }
}


// Manual cloud save removed - autosave enabled

function setState(patch, options = {}) {
  window.state = { ...window.state, ...patch };
  save();
  render();
  restoreFocus(options.focus);
}

function setNested(section, patch, options = {}) {
  // Prevent full re-render on every keystroke in the admin form.
  if (section === "adminForm") {
    window.state = {
      ...window.state,
      adminForm: { ...window.state.adminForm, ...patch },
    };
    localStorage.setItem(
      STATE_KEY,
      JSON.stringify({ ...window.state, toast: "" })
    );
    return;
  }
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
      window.state.user?.email?.toLowerCase() === ADMIN_EMAIL || window.state.user?.email?.toLowerCase() === OWNER_EMAIL
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
      ${renderMenu(developer)}
      <main class="main">${renderMain(developer)}</main>
      ${
        window.state.toast
          ? `<div class="toast" role="status">${escapeHtml(
              window.state.toast
            )}</div>`
          : ""
      }
      
    </div>
  `;
  bindEvents();

  if (window.state.view === "checkout") {
    window._stripeCardMounted = false;
    requestAnimationFrame(() => mountStripeCheckout());
  }
}

function navButton(view, label) {
  const active = window.state.view === view ? "active" : "";
  return `<button class="${active}" type="button" data-route="${view}">${label}</button>`;
}

function renderMenu(developer) {
  const openClass = window.state.menuOpen ? "open" : "";
  return `
    <div class="menu-backdrop ${openClass}" data-action="toggle-menu"></div>
    <aside class="menu ${openClass}" aria-label="Menu">
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
          <div class="small meta">${ developer ? "Developer mode active" : "Customer mode" }</div>
          ${
            developer && window.state.user?.email?.toLowerCase() !== OWNER_EMAIL
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
  const mainImage = (product.images && product.images[0]) || product.image;
  if (mainImage)
    return `<img src="${mainImage}" alt="${escapeHtml(
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
      <div class="card-figure detail-figure">
      <button type="button" data-gallery-prev>&lt;</button>
      <div data-gallery-image>${productFigure({...product,image:((product.images&&product.images.length?product.images[window.state.currentProductImageIndex||0]:product.image)||product.image)})}</div>
      <button type="button" data-gallery-next>&gt;</button>
      </div>
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
  const details = cartDetails();
  const userName = window.state.user?.name || "";

  return `
    <section class="hero-strip">
      <h2>Checkout</h2>
    </section>
    <div class="checkout-layout">
      <div class="stack checkout-form-col">

        <div class="panel stack">
          <h3 class="panel-title">Shipping Address</h3>
          <label class="label">Full Name
            <input class="input" id="ship-name" placeholder="Jane Smith" value="${escapeAttr(userName)}" autocomplete="name" />
          </label>
          <label class="label">Street Address
            <input class="input" id="ship-street" placeholder="123 Main St" autocomplete="street-address" />
          </label>
          <label class="label">City
            <input class="input" id="ship-city" placeholder="Springfield" autocomplete="address-level2" />
          </label>
          <div class="row">
            <label class="label" style="flex:1">State
              <input class="input" id="ship-state" placeholder="IL" maxlength="2" autocomplete="address-level1" />
            </label>
            <label class="label" style="flex:2">ZIP Code
              <input class="input" id="ship-zip" placeholder="62701" maxlength="10" autocomplete="postal-code" />
            </label>
          </div>
          <label class="label">Phone (optional)
            <input class="input" id="ship-phone" placeholder="555-555-5555" autocomplete="tel" />
          </label>
        </div>

        <div class="panel stack">
          <h3 class="panel-title">Discount Code</h3>
          <div class="row">
            <input class="input" id="discount-input"
              placeholder="Enter code"
              value="${escapeAttr(window.state.checkout.discountCode || "")}"
              style="flex:1" />
            <button class="ghost" type="button" id="apply-discount-btn">Apply</button>
          </div>
          ${window.state.checkout.discountCode
            ? `<div class="small checkout-code-applied">✓ Code applied: ${escapeHtml(window.state.checkout.discountCode)}</div>`
            : ""}
        </div>

        <div class="panel stack">
          <h3 class="panel-title">Card Details</h3>
          <div id="stripe-card-element" class="stripe-card-box"></div>
          <div id="stripe-errors" class="stripe-error-msg"></div>
        </div>

        <button class="primary" type="button" id="pay-btn" style="font-size:1.1rem; min-height:3.4rem;">
          Pay ${money(details.total)}
        </button>
        <div id="payment-status" class="payment-status-msg"></div>

      </div>
      ${renderSummary(details, false)}
    </div>
  `;
}


async function mountStripeCheckout() {
  if (window.state.view !== "checkout") return;

  const cardContainer = document.getElementById("stripe-card-element");
  if (!cardContainer) return;
  if (window._stripeCardMounted) return;
  window._stripeCardMounted = true;

  // If STRIPE_PUBLIC_KEY hasn't been set yet, show a message
  if (!STRIPE_PUBLIC_KEY || STRIPE_PUBLIC_KEY.includes("YOUR_PUBLISHABLE_KEY")) {
    cardContainer.textContent = "⚠️ Stripe public key not configured.";
    return;
  }

  const stripe = Stripe(STRIPE_PUBLIC_KEY);
  const elements = stripe.elements();
  const cardElement = elements.create("card", {
    style: {
      base: {
        fontSize: "16px",
        color: "#000",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        "::placeholder": { color: "#999" }
      },
      invalid: { color: "#c0392b" }
    }
  });
  cardElement.mount("#stripe-card-element");

  cardElement.on("change", (event) => {
    const errorDiv = document.getElementById("stripe-errors");
    if (errorDiv) {
      errorDiv.textContent = event.error ? event.error.message : "";
    }
  });

  document.getElementById("apply-discount-btn")?.addEventListener("click", () => {
    const code = document.getElementById("discount-input")?.value?.trim() || "";
    window._stripeCardMounted = false;
    setNested("checkout", { discountCode: code });
  });

  document.getElementById("pay-btn")?.addEventListener("click", async () => {
    const statusDiv = document.getElementById("payment-status");
    const payBtn = document.getElementById("pay-btn");

    // Must be logged in
    if (!window.state.user) {
      statusDiv.textContent = "Please log in before paying.";
      statusDiv.className = "payment-status-msg payment-status-fail";
      return;
    }

    // Must have items in cart
    const details = cartDetails();
    if (!details.lines.length) {
      statusDiv.textContent = "Your cart is empty. Add items before checking out.";
      statusDiv.className = "payment-status-msg payment-status-fail";
      return;
    }

    const shipping = {
      name:   document.getElementById("ship-name")?.value?.trim() || "",
      street: document.getElementById("ship-street")?.value?.trim() || "",
      city:   document.getElementById("ship-city")?.value?.trim() || "",
      state:  document.getElementById("ship-state")?.value?.trim() || "",
      zip:    document.getElementById("ship-zip")?.value?.trim() || "",
      phone:  document.getElementById("ship-phone")?.value?.trim() || "",
    };

    if (!shipping.name || !shipping.street || !shipping.city || !shipping.state || !shipping.zip) {
      statusDiv.textContent = "Please fill in all shipping fields.";
      statusDiv.className = "payment-status-msg payment-status-fail";
      return;
    }

    payBtn.disabled = true;
    payBtn.textContent = "Processing…";
    statusDiv.textContent = "";
    statusDiv.className = "payment-status-msg";

    try {
      const amountInCents = Math.round(details.total * 100);

      const response = await fetch(`${BACKEND_URL}/create-payment-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountInCents,
          customerEmail: window.state.user.email
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "Server error");

      const { error, paymentIntent } = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: shipping.name,
            email: window.state.user.email,
            address: {
              line1: shipping.street,
              city: shipping.city,
              state: shipping.state,
              postal_code: shipping.zip,
              country: "US"
            }
          }
        }
      });

      if (error) {
        statusDiv.textContent = "Oops sorry, payment failed.";
        statusDiv.className = "payment-status-msg payment-status-fail";
        payBtn.disabled = false;
        payBtn.textContent = "Try Again";
        return;
      }

      if (paymentIntent.status === "succeeded") {
        await saveCompletedOrder(shipping, details, paymentIntent.id);
        statusDiv.textContent = "Payment accepted";
        statusDiv.className = "payment-status-msg payment-status-success";
        payBtn.disabled = true;
        payBtn.textContent = "Thank you!";
        payBtn.style.cursor = "default";
        setTimeout(() => {
          setState({ cart: [], view: "shopping", toast: "Order placed!" });
          clearToast();
        }, 2500);
      }

    } catch (err) {
      console.error("Payment error:", err);
      statusDiv.textContent = "Oops sorry, payment failed.";
      statusDiv.className = "payment-status-msg payment-status-fail";
      payBtn.disabled = false;
      payBtn.textContent = "Try Again";
    }
  });
}


async function saveCompletedOrder(shipping, details, stripePaymentId) {
  const orderId = generateId();
  const now = Date.now();

  const order = {
    id: orderId,
    customerName: window.state.user.name,
    customerEmail: window.state.user.email,
    items: details.lines.map(l => ({
      productId: l.productId,
      name: l.product.name,
      qty: l.qty,
      price: l.product.salePrice || l.product.price
    })),
    subtotal: details.subtotal,
    discount: details.discount,
    tax: details.tax,
    total: details.total,
    delivery: shipping,
    billing: shipping,
    createdAt: now,
    paymentProvider: "stripe",
    paymentStatus: "paid",
    paymentReference: stripePaymentId,
    discountCode: window.state.checkout.discountCode || ""
  };

  try {
    const fb = window.firebaseServices;
    if (fb?.db && fb?.addDoc && fb?.collection) {
      await fb.addDoc(fb.collection(fb.db, "stores", "main", "orders"), order);
    }
  } catch (e) {
    console.error("Failed to save order to Firebase:", e);
  }

  window.store.orders = [...(window.store.orders || []), order];
  upsertCustomer(window.state.user.email, window.state.user.name);
  setNested("checkout", { discountCode: "" });
  await save();
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
        <div class="uploader-nav">
          <button type="button" class="gallery-arrow left" data-upload-prev>&lt;</button>
          <div class="dropzone" data-dropzone style="cursor: pointer;">
            ${
              (window.state.adminForm.images?.[(typeof window.OFFspeedImageSlot==='number'?window.OFFspeedImageSlot:(window.state.adminForm.uploadSlot||0))])
                ? `<img class="preview" src="${window.state.adminForm.images[window.state.adminForm.uploadSlot || 0]}" alt="Product upload preview" style="max-width: 180px; max-height:180px;" /><div>${((typeof window.OFFspeedImageSlot==="number"?window.OFFspeedImageSlot:window.state.adminForm.uploadSlot) || 0) === 0 ? "Main Image" : "Image " + (((typeof window.OFFspeedImageSlot==="number"?window.OFFspeedImageSlot:window.state.adminForm.uploadSlot) || 0)+1)}</div>`
                : `Click to upload ${(((typeof window.OFFspeedImageSlot==="number"?window.OFFspeedImageSlot:window.state.adminForm.uploadSlot) || 0) === 0 ? "Main Image" : "Image " + (((typeof window.OFFspeedImageSlot==="number"?window.OFFspeedImageSlot:window.state.adminForm.uploadSlot) || 0)+1))}`
            }
            <input type="file" data-file-input accept="image/*" hidden />
          <div data-image-slot-label style="margin-top:8px;font-weight:700;text-align:center;">Editing: ${(((typeof window.OFFspeedImageSlot==="number"?window.OFFspeedImageSlot:window.state.adminForm.uploadSlot) || 0) === 0 ? "Main Image" : "Image " + (((typeof window.OFFspeedImageSlot==="number"?window.OFFspeedImageSlot:window.state.adminForm.uploadSlot) || 0)+1))}</div>
          </div>
          <button type="button" class="gallery-arrow right" data-upload-next>&gt;</button>
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
        ${renderDiscountCodesPanel()}
        ${renderCustomersPanel()}
        ${renderOrdersPanel()}
        ${renderDeveloperPanel()}
      </div>
    </div>
  `;
}


function renderDeveloperPanel() {
 const emails=(window.state.developerEmails||[]).filter(e=>e!==OWNER_EMAIL);
 return `
 <section class="panel stack dev-panel">
 <h3 class="panel-title">Developer Access</h3>
 <div class="dev-manage-row"><input class="input" data-dev-email placeholder="gmail@example.com"><button class="primary" type="button" data-action="add-dev-email">Add Developer</button></div>
 <div class="dev-list">${emails.length?emails.map(e=>`<button type="button" class="ghost dev-email-item" data-remove-dev="${e}">${e} ✕</button>`).join(''):'<div class="meta">No extra developers</div>'}</div>
 </section>`;
}

function renderPaymentPanel() {
  return "";
}

function renderTransactionsPanel() {
  return "";
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
      b.addEventListener("click", (e) => {
        const isHamburger = b.classList.contains("hamburger");
        const isClose = b.classList.contains("icon-button");
        const isBackdrop = b.classList.contains("menu-backdrop");

        if (isHamburger) {
          setState({ menuOpen: true });
        } else if (isClose || isBackdrop) {
          setState({ menuOpen: false });
        }

        e.stopPropagation();
      })
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
      setNested(
        "adminForm",
        { [input.dataset.admin]: e.target.value },
        { focus: `[data-admin="${input.dataset.admin}"]` }
      );
    });
  });

  // File Upload Logic
  const fileInput = document.querySelector("[data-file-input]");
  fileInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const slot = (typeof window.OFFspeedImageSlot === "number"
      ? window.OFFspeedImageSlot
      : (window.state.adminForm.uploadSlot || 0));

    const reader = new FileReader();
    reader.onload = (event) => {
      const images = [...(window.state.adminForm.images || [])];

      images[slot] = event.target.result;

      setNested("adminForm", {
        images,
        image: images[0] || "",
        fileName: file.name,
        uploadSlot: slot
      });

      window.OFFspeedImageSlot = slot;
      render();
    };
    reader.readAsDataURL(file);
  });

const dropzone = document.querySelector("[data-dropzone]");
  dropzone?.addEventListener("click", () => {
    document.querySelector("[data-file-input]").click();
  });

  document.querySelector("[data-gallery-prev]")?.addEventListener("click", () => {
    const product = window.store.products.find(p => p.id === window.state.selectedProductId);
    const images = product?.images?.length ? product.images : [product?.image];
    const idx = ((window.state.currentProductImageIndex || 0) - 1 + images.length) % images.length;
    setState({ currentProductImageIndex: idx });
  });
  document.querySelector("[data-gallery-next]")?.addEventListener("click", () => {
    const product = window.store.products.find(p => p.id === window.state.selectedProductId);
    const images = product?.images?.length ? product.images : [product?.image];
    const idx = ((window.state.currentProductImageIndex || 0) + 1) % images.length;
    setState({ currentProductImageIndex: idx });
  });

  document.querySelector("[data-upload-prev]")?.addEventListener("click", () => {
    if (window.prevImageSlot) window.prevImageSlot();
  });
  document.querySelector("[data-upload-next]")?.addEventListener("click", () => {
    if (window.nextImageSlot) window.nextImageSlot();
  });

  document
    .querySelector("[data-field='query']")
    ?.addEventListener("input", (e) => {
      const value = e.target.value;
      const cursor = e.target.selectionStart;

      // Avoid a full re-render so the menu animation doesn't replay.
      window.state.query = value;
      window.state.view = "shopping";
      save();

      const main = document.querySelector(".main");
      if (main) {
        main.innerHTML = renderMain(isDeveloper());
      }

      requestAnimationFrame(() => {
        const input = document.querySelector("[data-field='query']");
        if (input) {
          input.focus();
          input.value = value;
          try { input.setSelectionRange(cursor, cursor); } catch {}
        }
      });
    });
  document
    .querySelector("[data-action='exit-dev']")
    ?.addEventListener("click", () =>
      setState({ developerUnlocked: false, toast: "You must reset the site to gain developer access again" })
    );
  
  document
    .querySelector("[data-action='add-dev-email']")
    ?.addEventListener("click", async () => {
      const email = document.querySelector("[data-dev-email]")?.value.trim().toLowerCase();
      if (!email || email === OWNER_EMAIL) return;
      const fb = window.firebaseServices;
      if (fb?.db) {
        await fb.setDoc(fb.doc(fb.db,"developerEmails",email), { email, addedAt: Date.now() });
        await loadDeveloperEmails(); const inp=document.querySelector("[data-dev-email]"); if(inp) inp.value=""; setState({ toast: "Developer added" });
        clearToast();
      }
    });

  document.querySelectorAll("[data-remove-dev]").forEach(btn=>btn.addEventListener("click", async ()=>{ const email=btn.dataset.removeDev; const fb=window.firebaseServices; if(fb?.db){ await fb.deleteDoc(fb.doc(fb.db,"developerEmails",email)); await loadDeveloperEmails(); if(window.store.user?.email?.toLowerCase()===email?.toLowerCase()){ setState({developerUnlocked:false}); } setState({toast:"Developer removed"}); clearToast();}}));

  document
    .querySelector("[data-action='login']")
    ?.addEventListener("click", login);
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
  const tax = 0;
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
  const q = String(window.state.query || "").toLowerCase().trim();
  return window.store.products.filter((p) => {
    const haystack = [
      p.name,
      p.description,
      p.category,
      ...(Array.isArray(p.tags) ? p.tags : [])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      (!q || haystack.includes(q)) &&
      (window.state.category === "All" || p.category === window.state.category)
    );
  });
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

    const owner = email === OWNER_EMAIL;
    let extraDev = false;
    try {
      const fb = window.firebaseServices;
      if (fb?.db && !owner) {
        const snap = await fb.getDoc(fb.doc(fb.db,"developerEmails",email));
        extraDev = snap.exists();
      }
    } catch(e){ console.error(e); }

    setState({
      user: { email, name },
      developerUnlocked: owner || extraDev,
      menuOpen: false,
      toast: owner || extraDev ? "Developer mode active" : "Signed in",
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
  const productId = generateId();
  const product = {
    id: productId,
    name: form.name || "",
    price: Number(form.price) || 0,
    category: form.category || "Other",
    description: form.description || "",
    image: "",
    images: [],
  };

  try {
    const fb = window.firebaseServices;

    if (fb?.storage) {
      const sourceImages = (form.images && form.images.length ? form.images : [form.image]).filter(Boolean);
      const urls = [];

      for (let i = 0; i < sourceImages.length; i++) {
        const img = sourceImages[i];
        const blob = await (await fetch(img)).blob();
        const imageRef = fb.ref(fb.storage, `products/${productId}/${Date.now()}_${i}.webp`);
        await fb.uploadBytes(imageRef, blob);
        urls.push(await fb.getDownloadURL(imageRef));
      }

      product.images = urls;
      product.image = urls[0] || "";
    } else {
      product.images = (form.images && form.images.length ? form.images : [form.image]).filter(Boolean);
      product.image = product.images[0] || "";
    }

    window.store.products.unshift(product);
    safeSaveStoreCache();

    if (fb?.db) {
      await fb.setDoc(fb.doc(fb.db, "stores", "main", "products", product.id), product);
    }
  } catch (err) {
    console.error("Product cloud save failed:", err);
    setState({ toast: "Upload failed. Check Storage rules." });
    clearToast();
    return;
  }

  await loadProductsFromCloud();

  setState({
    adminForm: defaultState.adminForm,
    toast: "Published!",
    view: "shopping",
    category: "All",
    query: ""
  });
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
  developerEmails: [],
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

async function deleteProduct(productId) {
  if (!confirm("Are you sure?")) return;

  const product = window.store.products.find((p) => p.id === productId);

  try {
    const fb = window.firebaseServices;

    if (fb?.db && fb?.deleteDoc && fb?.doc) {
      await fb.deleteDoc(
        fb.doc(fb.db, "stores", "main", "products", productId)
      );
    }
  } catch (err) {
    console.error("Failed deleting product from cloud:", err);
  }

  window.store.products = window.store.products.filter((p) => p.id !== productId);
  save();
  setState({
    selectedProductId: "",
    view: "shopping",
    toast: "Product deleted"
  });
  clearToast();
}



let devEmailUnsubscribe = null;

async function loadDeveloperEmails(){
  try{
    const fb = window.firebaseServices;
    if (!fb?.db || !fb?.collection || !fb?.getDocs) {
      console.error('Missing Firebase services:', Object.keys(fb || {}));
      return;
    }

    const snap = await fb.getDocs(
      fb.collection(fb.db, 'developerEmails')
    );

    const emails = [];
    snap.forEach(d => emails.push(d.id));
    setState({ developerEmails: emails.sort() });
  }catch(e){
    console.error(e);
  }
}


window.refreshDeveloperStatus = async function(){
  try{
    const fb = window.firebaseServices;
    const user = fb?.auth?.currentUser;
    if (!user) {
      setState({ developerUnlocked:false });
      return;
    }
    const email = (user.email || '').toLowerCase();
    const isDev = await isDeveloperEmail(email);
    setState({
      user:{
        email,
        name:user.displayName || email.split('@')[0]
      },
      developerUnlocked:isDev
    });
  }catch(e){
    console.error('Developer refresh failed:', e);
  }
};

window.addEventListener("load", () => {

  const wait = setInterval(() => {
    const fb = window.firebaseServices;
    if (!fb?.auth) return;
    clearInterval(wait);
    fb.onAuthStateChanged(fb.auth, (user) => {
      if (user) {
        const email = (user.email || '').toLowerCase();
        loadDeveloperEmails();
        window.refreshDeveloperStatus();
        isDeveloperEmail(email).then((isDev) => {
          setState({
            user: {
              email,
              name: user.displayName || email.split('@')[0]
            },
            developerUnlocked: isDev
          });
        });
      } else {
        setState({ user: null, developerUnlocked: false });
      }
    });
  }, 250);
});


// Added by ChatGPT: search highlight helper
window.highlightSearchText = function(text, query){
  if (!query) return String(text ?? "");
  const escaped = String(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(text ?? "").replace(
    new RegExp("(" + escaped + ")", "ig"),
    "<mark>$1</mark>"
  );
};


// Added by ChatGPT: search suggestion dropdown
window.updateSearchSuggestions = function(){
  const input = document.querySelector('input[type="search"], #search, .search-input');
  if (!input) return;

  let box = document.getElementById('searchSuggestions');
  if (!box) {
    box = document.createElement('div');
    box.id = 'searchSuggestions';
    box.className = 'search-suggestions';
    input.parentElement && input.parentElement.appendChild(box);
  }

  const q = (window.state?.searchQuery || input.value || '').toLowerCase().trim();
  if (!q) { box.innerHTML = ''; return; }

  const products = window.store?.products || [];
  const matches = products.filter(p =>
    (p.name || '').toLowerCase().includes(q)
  ).slice(0,8);

  box.innerHTML = matches.map(p =>
    `<div class="search-suggestion" data-id="${p.id}">
      ${p.name || 'Unnamed Product'}
    </div>`
  ).join('');

  box.querySelectorAll('.search-suggestion').forEach(el => {
    el.onclick = () => {
      const id = el.dataset.id;
      const card = document.querySelector(`[data-product-id="${id}"]`);
      if (card) {
        card.scrollIntoView({behavior:'smooth', block:'center'});
        card.classList.add('search-hit');
        setTimeout(()=>card.classList.remove('search-hit'), 2000);
      }
      box.innerHTML = '';
    };
  });
};

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.matches('input[type="search"], #search, .search-input')) {
    setTimeout(() => window.updateSearchSuggestions(), 0);
  }
});



// Developer email handlers survive re-renders
document.addEventListener("click", async (e) => {
  const addBtn = e.target.closest("[data-action='add-dev-email']");
  if (addBtn) {
    const email = document.querySelector("[data-dev-email]")?.value?.trim()?.toLowerCase();
    if (!email || email === OWNER_EMAIL) return;
    const fb = window.firebaseServices;
    try {
      await fb.setDoc(fb.doc(fb.db, "developerEmails", email), {
        email,
        addedAt: Date.now()
      });
      if (typeof loadDeveloperEmails === "function") await loadDeveloperEmails();
      const inp = document.querySelector("[data-dev-email]");
      if (inp) inp.value = "";
      setState({ toast: "Developer added" });
      clearToast();
    } catch (err) {
      console.error("Failed to add developer:", err);
    }
    return;
  }

  const removeBtn = e.target.closest("[data-remove-dev]");
  if (removeBtn) {
    const email = removeBtn.dataset.removeDev;
    if (!email || email === OWNER_EMAIL) return;
    const fb = window.firebaseServices;
    try {
      if (fb.deleteDoc) {
        await fb.deleteDoc(fb.doc(fb.db, "developerEmails", email));
      }
      if (typeof loadDeveloperEmails === "function") await loadDeveloperEmails();
    } catch (err) {
      console.error("Failed to remove developer:", err);
    }
  }
});


document.addEventListener('visibilitychange', () => {
  if (!document.hidden && window.refreshDeveloperStatus) {
    window.refreshDeveloperStatus();
  }
});

window.addEventListener('focus', () => {
  if (window.refreshDeveloperStatus) {
    window.refreshDeveloperStatus();
  }
});


// Menu now stays open until the user closes it manually.


document.addEventListener("click", (e) => {
  const product = window.store.products.find((p)=>p.id===window.state.selectedProductId);
  if (!product) return;
  const images = (product.images && product.images.length ? product.images : [product.image]).filter(Boolean);
  if (!images.length) return;
  window.state.galleryIndex = window.state.galleryIndex || 0;
  if (e.target.closest("[data-gallery-next]")) {
    window.state.galleryIndex = (window.state.galleryIndex + 1) % images.length;
  } else if (e.target.closest("[data-gallery-prev]")) {
    window.state.galleryIndex = (window.state.galleryIndex - 1 + images.length) % images.length;
  } else {
    return;
  }
  const holder = document.querySelector("[data-gallery-image]");
  if (holder) holder.innerHTML = `<img src="${images[window.state.galleryIndex]}" style="max-width:100%;">`;
});


// Developer uploader image slot navigator
window.OFFspeedImageSlot = 0;
window.OFFspeedMaxImages = 5;

window.nextImageSlot = function () {
  window.OFFspeedImageSlot =
    (window.OFFspeedImageSlot + 1) % window.OFFspeedMaxImages;
  if (window.state && window.state.adminForm) {
    window.state.adminForm.uploadSlot = window.OFFspeedImageSlot;
    render();
  }
  const label = document.querySelector('[data-image-slot-label]');
  if (label) {
    label.textContent = 'Editing: ' + (window.OFFspeedImageSlot === 0 ? 'Main Image' : 'Image ' + (window.OFFspeedImageSlot + 1));
  }
};

window.prevImageSlot = function () {
  window.OFFspeedImageSlot =
    (window.OFFspeedImageSlot - 1 + window.OFFspeedMaxImages) %
    window.OFFspeedMaxImages;
  if (window.state && window.state.adminForm) {
    window.state.adminForm.uploadSlot = window.OFFspeedImageSlot;
    render();
  }
  const label = document.querySelector('[data-image-slot-label]');
  if (label) {
    label.textContent = 'Editing: ' + (window.OFFspeedImageSlot === 0 ? 'Main Image' : 'Image ' + (window.OFFspeedImageSlot + 1));
  }
};
function buildCloudStore() {
  return {
    discountCodes: window.store.discountCodes || [],
    customers: window.store.customers || [],
    paymentSettings: window.store.paymentSettings || {},
    paymentTransactions: window.store.paymentTransactions || [],
    orders: window.store.orders || []
  };
}




import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot, collection, getDocs, addDoc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyA7hrdCSBsV6QIS99E70OXvPRzrPLH_lk0",
  authDomain: "ofsp-88c9d.firebaseapp.com",
  projectId: "ofsp-88c9d",
  storageBucket: "ofsp-88c9d.firebasestorage.app",
  messagingSenderId: "278239012324",
  appId: "1:278239012324:web:249cffc214042ea127d3f1",
  measurementId: "G-1PHVC3ZYWP"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

window.firebaseServices = {
  auth, db, storage, ref, uploadBytes, getDownloadURL, GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged,
  doc, setDoc, getDoc, onSnapshot, collection, getDocs, addDoc, updateDoc, deleteDoc
};

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Offspeed Baseball</title>
    <link rel="stylesheet" href="./styles.css" />
    <script src="https://js.stripe.com/v3/"></script>
  </head>
  <body>
    <div id="app"></div>

    <div class="dev-warning">This page is under development and you may not purchase anything currently. Please do not put any cards or data into this site.</div>
    <script src="./app.js"></script>
  <script type="module" src="./firebase.js"></script>
</body>
</html>

# Offspeed Baseball

Minimal black-and-white e-commerce app for a clothing brand.

## Run

Open `index.html` in a browser. No install step is required.

The storefront starts with zero listings. Add products from the hidden Admin tab when you are ready.

## Project Setup

This version is intentionally dependency-free so it stays small and works without paid services. The structure mirrors a React/Firebase/Stripe app:

- `index.html`: app mount point
- `styles.css`: minimalist black-and-white UI
- `app.js`: component rendering, state management, auth mock, database mock, cart, checkout, and admin logic

## Database Schema

```js
{
  products: [
    { id, name, price, category, description, image, createdAt }
  ],
  customers: [
    { name, email, createdAt }
  ],
  orders: [
    { id, customerName, customerEmail, items, subtotal, discount, tax, total, createdAt, paymentProvider, paymentStatus, paymentReference, payoutStatus, payoutDestination }
  ],
  paymentTransactions: [
    { id, orderId, amount, subtotal, tax, discount, provider, status, payoutStatus, destination, cardLastFour, createdAt }
  ],
  paymentSettings: {
    provider,
    destinationName,
    payoutEmail,
    stripeAccountId,
    statementDescriptor
  ],
  discountCodes: [
    { code, type, value, active }
  ]
}
```

The app stores this schema in `localStorage`, which can be replaced with Firestore collections using the same object shapes:

- `products`
- `customers`
- `orders`
- `paymentTransactions`
- `paymentSettings`
- `discountCodes`

## App Architecture

```txt
App Shell
  Header
  Navigation: Shopping, Cart, Checkout, Admin when allowed
  Hamburger Menu
    Search
    Category Filters
    Settings Secret Code
    Account
  Shopping View
    Product Grid
    Product Detail
  Cart View
    Quantity Controls
    Tax and Total Summary
  Checkout View
    Mock Card Form
    Order Creation
  Admin Dashboard
    Metrics
    Payment Setup
    Payment Transactions
    PNG Upload
    Product Listing Form
```

## Admin Access

Developer mode activates when:

- the signed-in Gmail is `treyhartle695@gmail.com`
- or the Settings code is `10BSBL`

## Firebase and Stripe Upgrade Path

Replace the local `store` reads/writes in `app.js` with:

- Firebase Auth `signInWithPopup(new GoogleAuthProvider())`
- Firestore `products`, `customers`, `orders`, and `discountCodes` collections
- Stripe Checkout Session creation from a server route

The checkout included here is a functional test payment form. Once Admin saves a payment destination, checkout processes orders as paid, creates a payment transaction, and routes that transaction to the saved destination record. It does not move real money. To accept real payments, connect the same destination settings to a Stripe account and create Checkout Sessions from a server route.

:root {
  color: #000;
  background: #fff;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  font-size: 16px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  background: #fff;
  color: #000;
}

button,
input,
select,
textarea {
  font: inherit;
  color: #000;
}

button {
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 1;
}

.shell {
  min-height: 100vh;
  background: #fff;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: 4rem 1fr 4rem;
  align-items: center;
  min-height: 5.25rem;
  border-bottom: 1px solid #000;
  background: #fff;
}

.logo {
  grid-column: 2;
  margin: 0;
  padding: 1.15rem 0;
  text-align: center;
  font-size: clamp(1.65rem, 5vw, 3.4rem);
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
}

.hamburger {
  grid-column: 3;
  width: 4rem;
  height: 5.25rem;
  border: 0;
  border-left: 1px solid #000;
  background: #fff;
  display: grid;
  place-items: center;
}

.hamburger-lines,
.hamburger-lines::before,
.hamburger-lines::after {
  display: block;
  width: 1.3rem;
  height: 2px;
  background: #000;
}

.hamburger-lines {
  position: relative;
}

.hamburger-lines::before,
.hamburger-lines::after {
  content: "";
  position: absolute;
  left: 0;
}

.hamburger-lines::before {
  top: -7px;
}

.hamburger-lines::after {
  top: 7px;
}

.nav {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-bottom: 1px solid #000;
}

.nav.has-admin {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.nav button {
  min-height: 3rem;
  border: 0;
  border-right: 1px solid #000;
  background: #fff;
  color: #000;
  font-weight: 800;
  text-transform: uppercase;
}

.nav button:last-child {
  border-right: 0;
}

.nav .active,
.nav button:hover,
.nav button:focus-visible,
.hamburger:hover,
.hamburger:focus-visible,
.primary:hover,
.primary:focus-visible,
.ghost:hover,
.ghost:focus-visible,
.chip.active,
.chip:hover,
.chip:focus-visible {
  background: #000;
  color: #fff;
  outline: 0;
}

.menu {
  position: fixed;
  inset: 0 0 0 auto;
  z-index: 30;
  width: min(27rem, 85vw);
  overflow-y: auto;
  border-left: 1px solid #000;
  background: #fff;
  transform: translateX(100%);
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.menu.open {
  transform: translateX(0);
}

.menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 25;
  background: rgba(0,0,0,0.45);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity;
}

.menu-backdrop.open {
  opacity: 1;
  pointer-events: auto;
}

.menu-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 3.4rem;
  border-bottom: 1px solid #000;
}

.menu-head h2 {
  margin: 0;
  padding: 0 1rem;
  font-size: 1rem;
  text-transform: uppercase;
}

.icon-button {
  width: 3.4rem;
  height: 3.4rem;
  border: 0;
  border-left: 1px solid #000;
  background: #fff;
  font-size: 1.6rem;
  line-height: 1;
}

.menu-section {
  border-bottom: 1px solid #000;
  padding: 1rem;
}

.menu-section h3,
.panel-title {
  margin: 0 0 0.8rem;
  font-size: 0.85rem;
  font-weight: 900;
  text-transform: uppercase;
}

.stack {
  display: grid;
  gap: 0.75rem;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.between {
  justify-content: space-between;
}

.input,
.select,
.textarea {
  width: 100%;
  border: 1px solid #000;
  border-radius: 0;
  background: #fff;
  padding: 0.78rem 0.85rem;
}

.textarea {
  min-height: 7rem;
  resize: vertical;
}

.input:focus,
.select:focus,
.textarea:focus {
  outline: 2px solid #000;
  outline-offset: 2px;
}

.label {
  display: grid;
  gap: 0.35rem;
  font-size: 0.78rem;
  font-weight: 900;
  text-transform: uppercase;
}

.chips {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.chip,
.ghost,
.primary {
  min-height: 2.8rem;
  border: 1px solid #000;
  background: #fff;
  color: #000;
  font-weight: 900;
  text-transform: uppercase;
}

.primary {
  background: #000;
  color: #fff;
}

.primary:hover,
.primary:focus-visible {
  background: #fff;
  color: #000;
}

.main {
  width: min(1120px, calc(100vw - 2rem));
  margin: 0 auto;
  padding: 2rem 0 4rem;
}

.hero-strip {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: end;
  gap: 1rem;
  margin-bottom: 1.4rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #000;
}

.hero-strip h2 {
  margin: 0;
  font-size: clamp(1.8rem, 7vw, 5rem);
  line-height: 0.95;
  letter-spacing: 0;
  text-transform: uppercase;
}

.meta {
  font-weight: 900;
  text-transform: uppercase;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.card {
  display: grid;
  min-height: 26rem;
  border: 1px solid #000;
  background: #fff;
}

.card-figure {
  position: relative;
  display: grid;
  min-height: 15rem;
  place-items: center;
  border-bottom: 1px solid #000;
  overflow: hidden;
}

.card-figure img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 1rem;
  filter: none;
}

.card-body {
  display: grid;
  align-content: space-between;
  gap: 1rem;
  padding: 1rem;
}

.card h3,
.detail h2 {
  margin: 0;
  font-size: 1.1rem;
  text-transform: uppercase;
}

.price {
  font-size: 1.2rem;
  font-weight: 900;
}

.small {
  font-size: 0.86rem;
}

.muted {
  color: #000;
}

.actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.detail {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.8fr);
  gap: 1rem;
  border: 1px solid #000;
}

.detail-figure {
  min-height: 25rem;
  border-right: 1px solid #000;
}

.detail-body {
  display: grid;
  gap: 1rem;
  align-content: start;
  padding: 1rem;
}

.baseball {
  width: min(64%, 14rem);
  aspect-ratio: 1;
}

.baseball svg {
  display: block;
  width: 100%;
  height: 100%;
}

.cart-lines,
.dashboard-grid {
  display: grid;
  gap: 1rem;
}

.cart-line,
.panel {
  border: 1px solid #000;
  background: #fff;
  padding: 1rem;
}

.cart-line {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1rem;
}

.qty {
  display: inline-grid;
  grid-template-columns: 2.5rem 2.5rem 2.5rem;
  border: 1px solid #000;
}

.qty button,
.qty span {
  display: grid;
  min-height: 2.5rem;
  place-items: center;
  border: 0;
  border-right: 1px solid #000;
  background: #fff;
  font-weight: 900;
}

.qty button:last-child {
  border-right: 0;
}

.summary {
  display: grid;
  gap: 0.65rem;
  border: 1px solid #000;
  padding: 1rem;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.total {
  border-top: 1px solid #000;
  padding-top: 0.75rem;
  font-size: 1.2rem;
  font-weight: 900;
}

.payment-status {
  border: 1px solid #000;
  padding: 0.85rem;
}

.checkout-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 22rem;
  gap: 1rem;
  align-items: start;
}

.admin-layout {
  display: grid;
  grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1.2fr);
  gap: 1rem;
}

.dropzone {
  display: grid;
  min-height: 10rem;
  place-items: center;
  border: 2px dashed #000;
  background: #fff;
  text-align: center;
  font-weight: 900;
  text-transform: uppercase;
}

.dropzone.dragging {
  background: #000;
  color: #fff;
}

.preview {
  width: 100%;
  max-height: 12rem;
  object-fit: contain;
  border: 1px solid #000;
}

.table {
  display: grid;
  border: 1px solid #000;
}

.table-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.75rem;
  border-bottom: 1px solid #000;
  padding: 0.75rem;
}

.table-row:last-child {
  border-bottom: 0;
}

.empty {
  display: grid;
  min-height: 14rem;
  place-items: center;
  border: 1px solid #000;
  text-align: center;
  font-weight: 900;
  text-transform: uppercase;
}

.toast {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 40;
  max-width: min(22rem, calc(100vw - 2rem));
  border: 1px solid #000;
  background: #000;
  color: #fff;
  padding: 1rem;
  font-weight: 900;
  text-transform: uppercase;
}

@media (max-width: 760px) {
  .main {
    width: min(100vw - 1rem, 1120px);
    padding-top: 1rem;
  }

  .hero-strip,
  .detail,
  .checkout-layout,
  .admin-layout {
    grid-template-columns: 1fr;
  }

  .detail-figure {
    border-right: 0;
    border-bottom: 1px solid #000;
  }

  .actions,
  .chips {
    grid-template-columns: 1fr;
  }

  .cart-line {
    grid-template-columns: 1fr;
  }

  .table-row {
    grid-template-columns: 1fr;
  }
}

.cloud-save-btn{position:fixed;bottom:20px;right:20px;z-index:9999;padding:12px 16px;border-radius:999px;border:none;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.2)}

mark{background:#ffd54a;color:inherit;padding:0 2px;border-radius:3px;}

.search-suggestions{position:absolute;left:0;right:0;top:100%;background:#111;border:1px solid #333;border-radius:8px;max-height:250px;overflow:auto;z-index:9999}
.search-suggestion{padding:10px;cursor:pointer}
.search-suggestion:hover{background:#222}
.search-hit{outline:3px solid #ffd54a}


/* Smooth drawer animations */
.menu {
  transform: translateX(100%);
}

.menu.open {
  animation: menuSlideIn 0.32s cubic-bezier(.22,1,.36,1) forwards;
}

.menu-backdrop {
  opacity: 0;
  pointer-events: none;
}

.menu-backdrop.open {
  animation: backdropIn 0.32s cubic-bezier(.22,1,.36,1) forwards;
}

@keyframes menuSlideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes menuSlideOut {
  from { transform: translateX(0); }
  to { transform: translateX(100%); }
}

@keyframes backdropIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes backdropOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

[data-secret-code],[data-action="apply-code"]{display:none!important;}

.dev-tools{display:grid;gap:.5rem;margin-bottom:1rem}.dev-actions{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}.dev-actions button{width:100%}

.dev-manage-row{display:flex;gap:8px;align-items:center}.dev-manage-row .input{flex:1}.dev-list{display:flex;flex-wrap:wrap;gap:8px}.dev-email-item{text-align:left}


/* Product gallery arrows */
.product-gallery,
.gallery-container {
  position: relative;
}

.gallery-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 999px;
  background: rgba(0,0,0,.55);
  color: #fff;
  font-size: 28px;
  cursor: pointer;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gallery-arrow.left { left: 12px; }
.gallery-arrow.right { right: 12px; }

.gallery-arrow:hover {
  background: rgba(0,0,0,.75);
}

/* Dev uploader arrows */
.image-slot-nav{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:12px;
  margin:10px 0;
}
.image-slot-nav button{
  width:40px;
  height:40px;
  border-radius:50%;
}


.detail-figure{position:relative;display:flex;align-items:center;justify-content:center;}
.detail-figure .gallery-arrow{
position:absolute;
top:50%;
transform:translateY(-50%);
width:42px;height:42px;border-radius:50%;
border:none;background:rgba(0,0,0,.65);color:#fff;
font-size:24px;z-index:5;
}
.detail-figure .gallery-arrow.left{left:12px;}
.detail-figure .gallery-arrow.right{right:12px;}
.uploader-nav{display:flex;align-items:center;gap:12px;}
.uploader-nav .gallery-arrow{
position:static;
transform:none;
width:42px;height:42px;border-radius:50%;
border:1px solid #000;background:#fff;color:#000;
}


/* Better gallery arrows */
.gallery-arrow{
  background:#fff !important;
  color:#000 !important;
  border:none;
  width:48px;
  height:48px;
  border-radius:50%;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:28px;
  font-weight:700;
  box-shadow:0 4px 16px rgba(0,0,0,.25);
}
.dropzone{
  min-height:220px !important;
  width:100% !important;
}
.dropzone .preview{
  max-width:180px !important;
  max-height:180px !important;
}


/* Admin uploader arrows */
[data-upload-prev], [data-upload-next]{
  width:42px;
  height:42px;
  border:none;
  border-radius:999px;
  background:#fff;
  color:#111;
  font-size:24px;
  font-weight:700;
  box-shadow:0 4px 14px rgba(0,0,0,.18);
  cursor:pointer;
}
[data-image-slot-label]{
  font-size:16px;
  font-weight:700;
}


/* Improved gallery and uploader styling */
.gallery-arrow,
.product-gallery-arrow,
.image-nav-btn {
  background: #fff !important;
  color: #000 !important;
  border: none;
  border-radius: 999px;
  width: 44px;
  height: 44px;
  box-shadow: 0 8px 24px rgba(0,0,0,.22);
  display:flex;
  align-items:center;
  justify-content:center;
  font-size: 24px;
  transition: transform .15s ease, box-shadow .15s ease;
}
.gallery-arrow:hover,
.product-gallery-arrow:hover,
.image-nav-btn:hover {
  transform: scale(1.08);
  box-shadow: 0 12px 30px rgba(0,0,0,.28);
}

.admin-image-switcher,
.image-slot-nav {
  display:flex;
  align-items:center;
  justify-content:center;
  gap:12px;
  margin:12px 0;
}

.image-slot-label {
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 14px;
  padding: 10px 16px;
  font-weight: 600;
  min-width: 180px;
  text-align:center;
}

.upload-card,
.image-upload-card {
  border-radius: 20px;
  padding: 16px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
}


/* Bigger pure white gallery arrows */
.gallery-arrow,
.product-arrow,
.image-arrow,
.gallery-nav button,
.product-gallery button {
  width: 58px !important;
  height: 58px !important;
  border-radius: 50% !important;
  background: #fff !important;
  color: #000 !important;
  border: none !important;
  font-size: 34px !important;
  font-weight: 700 !important;
  box-shadow: 0 6px 18px rgba(0,0,0,.30) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.gallery-arrow.left,
.product-arrow.left,
.image-arrow.left {
  left: 16px !important;
}

.gallery-arrow.right,
.product-arrow.right,
.image-arrow.right {
  right: 16px !important;
}


/* REAL shopping product gallery arrow overrides */
.detail-figure .gallery-arrow,
.product-detail .gallery-arrow,
.product-modal .gallery-arrow,
.detail-gallery .gallery-arrow,
.gallery-arrow {
  background: #ffffff !important;
  color: #000000 !important;
  width: 60px !important;
  height: 60px !important;
  min-width: 60px !important;
  min-height: 60px !important;
  border-radius: 999px !important;
  border: none !important;
  font-size: 34px !important;
  font-weight: 800 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  line-height: 1 !important;
  box-shadow: 0 8px 22px rgba(0,0,0,.30) !important;
}

.detail-figure .gallery-arrow span,
.gallery-arrow span {
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
}

/* Admin uploader arrows centered */
.admin-image-nav button,
.image-slot-nav button,
[data-upload-prev],
[data-upload-next] {
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
  line-height:1 !important;
}


/* Simple black chevron arrows */
.gallery-arrow,
[data-upload-prev],
[data-upload-next],
.image-slot-nav button,
.admin-image-nav button {
  background: transparent !important;
  box-shadow: none !important;
  border: none !important;
  color: transparent !important;
  font-size: 0 !important;
}

.gallery-arrow::before,
[data-upload-prev]::before,
[data-upload-next]::before,
.image-slot-nav button::before,
.admin-image-nav button::before {
  content: "";
  width: 22px;
  height: 22px;
  border-top: 6px solid #000;
  border-right: 6px solid #000;
  display: block;
}

.gallery-arrow.left::before,
[data-upload-prev]::before {
  transform: rotate(-135deg);
}

.gallery-arrow.right::before,
[data-upload-next]::before {
  transform: rotate(45deg);
}


.dev-warning {
  position: fixed;
  left: 50%;
  bottom: max(12px, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  color: #ff7a00;
  font-size: 13px;
  font-weight: 700;
  text-align: center;
  width: calc(100% - 20px);
  max-width: 900px;
  z-index: 2147483647;
  pointer-events: none;
  user-select: none;
}

/* ── Stripe Checkout ── */
.checkout-form-col {
  flex: 1;
  min-width: 280px;
}

.stripe-card-box {
  border: 1px solid #000;
  padding: 0.85rem;
  background: #fff;
  min-height: 44px;
}

.stripe-error-msg {
  color: #c0392b;
  font-size: 0.85rem;
  min-height: 1.2em;
  font-weight: 700;
}

.checkout-code-applied {
  color: #1a7a1a;
  font-weight: 700;
}

.payment-status-msg {
  text-align: center;
  font-weight: 900;
  font-size: 1rem;
  min-height: 1.5em;
  text-transform: uppercase;
  padding: 0.5rem 0;
}

.payment-status-success {
  color: #1a7a1a;
  border: 1px solid #1a7a1a;
  padding: 1rem;
}

.payment-status-fail {
  color: #c0392b;
  border: 1px solid #c0392b;
  padding: 1rem;
}
