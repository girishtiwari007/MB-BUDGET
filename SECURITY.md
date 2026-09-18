# Portal security setup

## Local write actions

The portal's public GitHub Pages site is read-only. Upload, backup, and MBRLR sync actions run only through the local server, which binds to `127.0.0.1`.

Create `upload_password.json` in the repository root by copying `upload_password.example.json`, then replace the example with a long, unique password. This file is ignored by Git. You can instead set the `MB_BUDGET_UPLOAD_PASSWORD` environment variable before starting the local server.

Every local write endpoint now requires this password. Do not add it to HTML, JavaScript, a Git commit, or a browser prompt shortcut.

## Free AI-style CAPTCHA: Cloudflare Turnstile

Use Cloudflare Turnstile in **Managed** mode for public forms. It provides a low-friction, adaptive challenge rather than a traditional image puzzle.

1. Create a free Cloudflare account and add a Turnstile widget for `girishtiwari007.github.io`.
2. Choose **Managed** mode and copy the public site key and private secret key.
3. Protect a server-side form endpoint by rendering the widget with the public key and validating the response token at `https://challenges.cloudflare.com/turnstile/v0/siteverify` with the secret key.
4. Keep the secret only in the server's environment. Reject requests when validation fails, a token is older than five minutes, or a token was already used.

GitHub Pages cannot validate CAPTCHA tokens or hide portal files because it has no server-side runtime. Turnstile can protect a form only after that form posts to a serverless function or other backend that performs Siteverify validation.

## Browser controls

The portal disables the context menu and common inspection/source shortcuts for the normal protected view. These controls discourage casual copying, but a browser owner can always inspect downloaded public files. Do not store confidential data, passwords, or private exports in a public GitHub Pages repository.
