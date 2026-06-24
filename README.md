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
