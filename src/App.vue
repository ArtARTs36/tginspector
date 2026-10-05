<script setup lang="ts">
import { computed, ref } from 'vue'
import { createTelegramClient, TelegramApiError, type TelegramClient } from './api'
import {
  buildObservedChats,
  getChatDisplayName,
  getUpdatePreview,
  getUpdateTimestamp,
  getUpdateType,
} from './inspector'
import type { ObservedChat, TelegramUpdate, TelegramUser, WebhookInfo } from './types'

type Tab = 'me' | 'chats' | 'updates' | 'webhook'

const tokenInput = ref('')
const tokenVisible = ref(false)
const client = ref<TelegramClient | null>(null)
const bot = ref<TelegramUser | null>(null)
const webhook = ref<WebhookInfo | null>(null)
const updates = ref<TelegramUpdate[]>([])
const selectedUpdateId = ref<number | null>(null)
const activeTab = ref<Tab>('me')
const connecting = ref(false)
const loadingUpdates = ref(false)
const error = ref('')

const observedChats = computed<ObservedChat[]>(() => buildObservedChats(updates.value))
const selectedUpdate = computed(() => updates.value.find((item) => item.update_id === selectedUpdateId.value) ?? null)
const hasWebhook = computed(() => Boolean(webhook.value?.url))

async function connect() {
  const token = tokenInput.value.trim()
  if (!token) {
    error.value = 'Enter a bot token first.'
    return
  }

  connecting.value = true
  error.value = ''

  const nextClient = createTelegramClient(token)
  try {
    const me = await nextClient.getMe()
    const webhookInfo = await nextClient.getWebhookInfo()

    client.value = nextClient
    bot.value = me
    webhook.value = webhookInfo
    tokenInput.value = ''
    activeTab.value = 'me'
  } catch (cause) {
    client.value = null
    bot.value = null
    webhook.value = null
    error.value = formatError(cause)
  } finally {
    connecting.value = false
  }
}

function disconnect() {
  tokenInput.value = ''
  client.value = null
  bot.value = null
  webhook.value = null
  updates.value = []
  selectedUpdateId.value = null
  activeTab.value = 'me'
  error.value = ''
}

async function refreshWebhook() {
  if (!client.value) return
  error.value = ''
  try {
    webhook.value = await client.value.getWebhookInfo()
  } catch (cause) {
    error.value = formatError(cause)
  }
}

async function loadUpdates() {
  if (!client.value) return
  loadingUpdates.value = true
  error.value = ''

  try {
    const result = await client.value.getUpdates()
    updates.value = result
    if (result.length && !selectedUpdate.value) {
      selectedUpdateId.value = result[result.length - 1].update_id
    }
  } catch (cause) {
    error.value = formatError(cause)
  } finally {
    loadingUpdates.value = false
  }
}

function formatError(cause: unknown): string {
  if (cause instanceof TelegramApiError) {
    return cause.code ? `${cause.message} (Telegram ${cause.code})` : cause.message
  }
  return 'Unexpected error while talking to Telegram.'
}

function formatDate(timestamp?: number): string {
  if (!timestamp) return '—'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(timestamp * 1000))
}

function formatId(value: number): string {
  return new Intl.NumberFormat('en-US', { useGrouping: false }).format(value)
}
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">TG</div>
        <div>
          <h1>Telegram Bot Inspector</h1>
          <p>Bot API diagnostics, entirely in your browser.</p>
        </div>
      </div>

      <div v-if="bot" class="connection-pill">
        <span class="status-dot" />
        <span>@{{ bot.username ?? bot.first_name }}</span>
        <button class="link-button" type="button" @click="disconnect">Disconnect</button>
      </div>
    </header>

    <section v-if="!bot" class="connect-layout">
      <div class="connect-card panel">
        <div class="eyebrow">Connect</div>
        <h2>Paste a BotFather token</h2>
        <p class="muted connect-copy">
          The token lives only in this tab's JavaScript memory. It is never persisted in cookies,
          localStorage, sessionStorage, or this page's URL.
        </p>

        <form class="token-form" @submit.prevent="connect">
          <label for="bot-token">Bot token</label>
          <div class="token-field">
            <input
              id="bot-token"
              v-model="tokenInput"
              :type="tokenVisible ? 'text' : 'password'"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              placeholder="123456789:AA..."
            />
            <button type="button" class="secondary-button" @click="tokenVisible = !tokenVisible">
              {{ tokenVisible ? 'Hide' : 'Show' }}
            </button>
          </div>
          <button class="primary-button" type="submit" :disabled="connecting">
            {{ connecting ? 'Connecting…' : 'Connect to Telegram' }}
          </button>
        </form>

        <div v-if="error" class="error-banner" role="alert">{{ error }}</div>

        <div class="security-note">
          <strong>Direct connection.</strong>
          Requests go from this browser directly to <code>api.telegram.org</code>. There is no tginspector backend.
        </div>
      </div>
    </section>

    <template v-else>
      <div v-if="error" class="error-banner global-error" role="alert">{{ error }}</div>

      <nav class="tabs" aria-label="Inspector sections">
        <button :class="{ active: activeTab === 'me' }" @click="activeTab = 'me'">Me</button>
        <button :class="{ active: activeTab === 'chats' }" @click="activeTab = 'chats'">
          Chats <span class="count-badge">{{ observedChats.length }}</span>
        </button>
        <button :class="{ active: activeTab === 'updates' }" @click="activeTab = 'updates'">
          Updates <span class="count-badge">{{ updates.length }}</span>
        </button>
        <button :class="{ active: activeTab === 'webhook' }" @click="activeTab = 'webhook'">Webhook</button>
      </nav>

      <section v-if="activeTab === 'me'" class="dashboard-grid">
        <article class="panel profile-panel">
          <div class="eyebrow">getMe</div>
          <div class="bot-avatar">{{ bot.first_name.slice(0, 1).toUpperCase() }}</div>
          <h2>{{ bot.first_name }}<span v-if="bot.last_name"> {{ bot.last_name }}</span></h2>
          <p v-if="bot.username" class="handle">@{{ bot.username }}</p>

          <dl class="details-grid">
            <div><dt>Bot ID</dt><dd class="mono">{{ formatId(bot.id) }}</dd></div>
            <div><dt>Join groups</dt><dd>{{ bot.can_join_groups ? 'Yes' : 'No' }}</dd></div>
            <div><dt>Read all group messages</dt><dd>{{ bot.can_read_all_group_messages ? 'Yes' : 'No' }}</dd></div>
            <div><dt>Inline queries</dt><dd>{{ bot.supports_inline_queries ? 'Yes' : 'No' }}</dd></div>
          </dl>
        </article>

        <article class="panel action-panel">
          <div class="eyebrow">Observe</div>
          <h2>Load pending updates</h2>
          <p class="muted">
            tginspector calls <code>getUpdates</code> without an offset, so it does not acknowledge the returned updates.
          </p>
          <button class="primary-button" :disabled="loadingUpdates || hasWebhook" @click="loadUpdates">
            {{ loadingUpdates ? 'Loading…' : 'Load updates' }}
          </button>
          <p v-if="hasWebhook" class="warning-text">
            An outgoing webhook is active. Telegram does not allow <code>getUpdates</code> while a webhook is configured.
          </p>
          <p v-else-if="updates.length" class="success-text">
            Found {{ updates.length }} pending update{{ updates.length === 1 ? '' : 's' }} and {{ observedChats.length }} observed chat{{ observedChats.length === 1 ? '' : 's' }}.
          </p>
        </article>

        <article class="panel webhook-summary">
          <div class="eyebrow">Webhook</div>
          <div class="metric-row">
            <div>
              <span class="metric-label">Status</span>
              <strong>{{ hasWebhook ? 'Active' : 'Not configured' }}</strong>
            </div>
            <div>
              <span class="metric-label">Pending</span>
              <strong>{{ webhook?.pending_update_count ?? 0 }}</strong>
            </div>
          </div>
          <p v-if="webhook?.url" class="mono break-all">{{ webhook.url }}</p>
          <button class="secondary-button" @click="refreshWebhook">Refresh</button>
        </article>
      </section>

      <section v-else-if="activeTab === 'chats'" class="content-stack">
        <div class="section-heading">
          <div>
            <div class="eyebrow">Observed state</div>
            <h2>Chats & threads</h2>
            <p class="muted">Bot API has no listChats endpoint. These are chats observed in the currently pending updates.</p>
          </div>
          <button class="primary-button" :disabled="loadingUpdates || hasWebhook" @click="loadUpdates">
            {{ loadingUpdates ? 'Refreshing…' : 'Refresh updates' }}
          </button>
        </div>

        <div v-if="!observedChats.length" class="empty-state panel">
          <h3>No chats observed yet</h3>
          <p>Load pending updates to discover chats and forum thread IDs visible to this bot.</p>
        </div>

        <div v-else class="chat-grid">
          <article v-for="item in observedChats" :key="item.chat.id" class="panel chat-card">
            <div class="chat-card-header">
              <div>
                <span class="chat-type">{{ item.chat.type }}</span>
                <h3>{{ getChatDisplayName(item.chat) }}</h3>
                <span v-if="item.chat.username" class="handle">@{{ item.chat.username }}</span>
              </div>
              <span class="updates-chip">{{ item.updateCount }} update{{ item.updateCount === 1 ? '' : 's' }}</span>
            </div>

            <dl class="compact-details">
              <div><dt>chat_id</dt><dd class="mono">{{ formatId(item.chat.id) }}</dd></div>
              <div><dt>Forum</dt><dd>{{ item.chat.is_forum ? 'Yes' : 'No' }}</dd></div>
              <div><dt>Last seen</dt><dd>{{ formatDate(item.lastSeenAt) }}</dd></div>
            </dl>

            <div class="threads-block">
              <div class="threads-title">Threads</div>
              <p v-if="!item.threads.length" class="muted small">No <code>message_thread_id</code> observed.</p>
              <div v-else class="thread-list">
                <div v-for="thread in item.threads" :key="thread.id" class="thread-row">
                  <span>{{ thread.title }}</span>
                  <code>{{ thread.id }}</code>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section v-else-if="activeTab === 'updates'" class="content-stack">
        <div class="section-heading">
          <div>
            <div class="eyebrow">getUpdates</div>
            <h2>Pending updates</h2>
            <p class="muted">Select an update to inspect its raw Telegram payload.</p>
          </div>
          <button class="primary-button" :disabled="loadingUpdates || hasWebhook" @click="loadUpdates">
            {{ loadingUpdates ? 'Refreshing…' : 'Refresh' }}
          </button>
        </div>

        <div v-if="hasWebhook" class="warning-banner panel">
          <strong>Webhook is active.</strong> Telegram rejects <code>getUpdates</code> until the webhook is removed. tginspector will not alter it automatically.
        </div>

        <div v-if="!updates.length" class="empty-state panel">
          <h3>No pending updates loaded</h3>
          <p>There may be no pending events, another consumer may already have acknowledged them, or a webhook may be active.</p>
        </div>

        <div v-else class="updates-layout">
          <div class="panel update-list">
            <button
              v-for="update in [...updates].reverse()"
              :key="update.update_id"
              class="update-row"
              :class="{ selected: selectedUpdateId === update.update_id }"
              @click="selectedUpdateId = update.update_id"
            >
              <div class="update-row-top">
                <span class="update-type">{{ getUpdateType(update) }}</span>
                <code>#{{ update.update_id }}</code>
              </div>
              <strong>{{ getUpdatePreview(update) }}</strong>
              <small>{{ formatDate(getUpdateTimestamp(update)) }}</small>
            </button>
          </div>

          <div class="panel raw-panel">
            <template v-if="selectedUpdate">
              <div class="raw-heading">
                <div>
                  <div class="eyebrow">Raw JSON</div>
                  <h3>{{ getUpdateType(selectedUpdate) }} #{{ selectedUpdate.update_id }}</h3>
                </div>
              </div>
              <pre>{{ JSON.stringify(selectedUpdate, null, 2) }}</pre>
            </template>
            <div v-else class="empty-state compact">
              <p>Select an update.</p>
            </div>
          </div>
        </div>
      </section>

      <section v-else class="content-stack">
        <div class="section-heading">
          <div>
            <div class="eyebrow">getWebhookInfo</div>
            <h2>Webhook status</h2>
          </div>
          <button class="secondary-button" @click="refreshWebhook">Refresh</button>
        </div>

        <article class="panel webhook-panel">
          <dl class="details-grid wide">
            <div><dt>Status</dt><dd>{{ hasWebhook ? 'Active' : 'Not configured' }}</dd></div>
            <div><dt>Pending updates</dt><dd>{{ webhook?.pending_update_count ?? 0 }}</dd></div>
            <div><dt>Max connections</dt><dd>{{ webhook?.max_connections ?? '—' }}</dd></div>
            <div><dt>IP address</dt><dd class="mono">{{ webhook?.ip_address ?? '—' }}</dd></div>
            <div class="full-row"><dt>URL</dt><dd class="mono break-all">{{ webhook?.url || '—' }}</dd></div>
            <div class="full-row"><dt>Allowed updates</dt><dd class="mono">{{ webhook?.allowed_updates?.join(', ') || 'Default' }}</dd></div>
            <div v-if="webhook?.last_error_message" class="full-row error-detail">
              <dt>Last error</dt>
              <dd>{{ webhook.last_error_message }}<span v-if="webhook.last_error_date"> · {{ formatDate(webhook.last_error_date) }}</span></dd>
            </div>
          </dl>
        </article>
      </section>
    </template>

    <footer>
      <span>tginspector · no backend · no token persistence</span>
      <a href="https://github.com/ArtARTs36/tginspector" target="_blank" rel="noreferrer">GitHub</a>
    </footer>
  </main>
</template>
