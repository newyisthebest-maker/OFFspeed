# Welcome Email Setup — OFFspeed Baseball

## How it works
When a new user signs in via Google, your `app.js` calls `upsertCustomer()` which writes their email/name to Firestore's `customers` collection. The Firebase Cloud Function in `functions/index.js` watches for new documents there and automatically sends them a welcome email via Gmail.

---

## Setup Steps

### 1. Install Firebase CLI (if you haven't)
```bash
npm install -g firebase-tools
firebase login
```

### 2. Link to your Firebase project
```bash
firebase use ofsp-88c9d
```

### 3. Create a Gmail App Password
Gmail won't let you use your real password for sending email via code. You need an **App Password**:

1. Go to your Google Account → **Security**
2. Under "How you sign in to Google," enable **2-Step Verification** (required)
3. Search for **"App passwords"** and create one for "Mail"
4. Copy the 16-character password — you'll use it in the next step

### 4. Store your Gmail credentials as Firebase secrets
```bash
firebase functions:secrets:set GMAIL_USER
# When prompted, enter: youraddress@gmail.com

firebase functions:secrets:set GMAIL_APP_PASSWORD
# When prompted, enter: the 16-character app password from step 3
```

### 5. Install function dependencies
```bash
cd functions
npm install
cd ..
```

### 6. Deploy the function
```bash
firebase deploy --only functions
```

---

## Customizing the Email
Edit `functions/index.js` — the `html:` section of `mailOptions` is the email body. You can change the subject line, colors, text, or add a logo image.

## Only sends once per user
The function triggers on **new** Firestore documents, so it only fires the first time someone signs in (when their customer doc is created). Returning users won't get another email.

## Checking logs
```bash
firebase functions:log
```
