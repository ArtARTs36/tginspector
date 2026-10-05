# tginspector

A browser-only inspector for the Telegram Bot API.

Paste a BotFather token and inspect the bot identity, webhook status, pending updates, observed chats and forum thread IDs. tginspector has no backend: the browser talks directly to `api.telegram.org`.

## Security model

- The bot token is kept only in JavaScript memory for the current page lifetime.
- No cookies, `localStorage`, `sessionStorage`, analytics, error reporting, or third-party runtime scripts.
- The token is never placed in the tginspector URL.
- Requests are sent directly to `https://api.telegram.org`.
- Reloading or closing the tab drops the token.

The Bot API requires the token in the Telegram request path, so it remains visible in the browser's own network developer tools while a request exists.

## Current scope

- `getMe`
- `getWebhookInfo`
- `getUpdates` without `offset` (does not acknowledge returned updates)
- observed chats derived from pending updates
- observed `message_thread_id` values and forum topic names when present
- raw update JSON

Telegram does not expose a `listChats` Bot API method. Chat and thread lists therefore contain only entities observed in the updates available to the bot. `getUpdates` is unavailable while an outgoing webhook is configured; tginspector never removes a webhook automatically.

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

The Vite build uses relative asset URLs so the same output works on GitHub project Pages.
