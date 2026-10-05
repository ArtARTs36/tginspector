import type {
  ObservedChat,
  ObservedThread,
  TelegramChat,
  TelegramMessageLike,
  TelegramUpdate,
} from './types'

const DIRECT_CHAT_KEYS = [
  'message',
  'edited_message',
  'channel_post',
  'edited_channel_post',
  'business_message',
  'edited_business_message',
  'deleted_business_messages',
  'my_chat_member',
  'chat_member',
  'chat_join_request',
  'message_reaction',
  'message_reaction_count',
  'chat_boost',
  'removed_chat_boost',
] as const

interface ChatContext {
  chat: TelegramChat
  message?: TelegramMessageLike
  date?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isChat(value: unknown): value is TelegramChat {
  return isRecord(value) && typeof value.id === 'number' && typeof value.type === 'string'
}

function asMessageLike(value: unknown): TelegramMessageLike | undefined {
  return isRecord(value) ? (value as TelegramMessageLike) : undefined
}

function extractContexts(update: TelegramUpdate): ChatContext[] {
  const contexts: ChatContext[] = []

  for (const key of DIRECT_CHAT_KEYS) {
    const value = update[key]
    if (!isRecord(value) || !isChat(value.chat)) continue

    contexts.push({
      chat: value.chat,
      message: asMessageLike(value),
      date: typeof value.date === 'number' ? value.date : undefined,
    })
  }

  const callbackQuery = update.callback_query
  if (isRecord(callbackQuery)) {
    const message = asMessageLike(callbackQuery.message)
    if (message && isChat(message.chat)) {
      contexts.push({ chat: message.chat, message, date: message.date })
    }
  }

  return contexts
}

function chatName(chat: TelegramChat): string {
  if (chat.title) return chat.title
  const name = [chat.first_name, chat.last_name].filter(Boolean).join(' ')
  if (name) return name
  if (chat.username) return `@${chat.username}`
  return String(chat.id)
}

function threadFromMessage(message: TelegramMessageLike | undefined): ObservedThread | undefined {
  if (!message || typeof message.message_thread_id !== 'number') return undefined

  let title = `Thread #${message.message_thread_id}`
  if (message.forum_topic_created?.name) title = message.forum_topic_created.name
  if (message.forum_topic_edited?.name) title = message.forum_topic_edited.name

  return {
    id: message.message_thread_id,
    title,
    lastSeenAt: message.date,
  }
}

export function buildObservedChats(updates: TelegramUpdate[]): ObservedChat[] {
  const chats = new Map<number, ObservedChat>()

  for (const update of updates) {
    for (const context of extractContexts(update)) {
      const existing = chats.get(context.chat.id)
      const observed: ObservedChat = existing ?? {
        chat: context.chat,
        threads: [],
        updateCount: 0,
      }

      observed.chat = { ...observed.chat, ...context.chat }
      observed.updateCount += 1
      if (context.date && (!observed.lastSeenAt || context.date > observed.lastSeenAt)) {
        observed.lastSeenAt = context.date
      }

      const thread = threadFromMessage(context.message)
      if (thread) {
        const index = observed.threads.findIndex((item) => item.id === thread.id)
        if (index === -1) {
          observed.threads.push(thread)
        } else {
          const current = observed.threads[index]
          observed.threads[index] = {
            ...current,
            ...thread,
            title: thread.title.startsWith('Thread #') && !current.title.startsWith('Thread #')
              ? current.title
              : thread.title,
          }
        }
      }

      chats.set(context.chat.id, observed)
    }
  }

  return [...chats.values()]
    .map((chat) => ({
      ...chat,
      threads: [...chat.threads].sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0)),
    }))
    .sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0) || chatName(a.chat).localeCompare(chatName(b.chat)))
}

export function getUpdateType(update: TelegramUpdate): string {
  return Object.keys(update).find((key) => key !== 'update_id') ?? 'unknown'
}

export function getUpdatePreview(update: TelegramUpdate): string {
  const type = getUpdateType(update)
  const value = update[type]
  if (!isRecord(value)) return type

  const text = typeof value.text === 'string' ? value.text : typeof value.caption === 'string' ? value.caption : undefined
  if (text) return text

  if (isChat(value.chat)) return chatName(value.chat)

  if (type === 'callback_query' && isRecord(value.message) && isChat(value.message.chat)) {
    return chatName(value.message.chat)
  }

  return type.replaceAll('_', ' ')
}

export function getUpdateTimestamp(update: TelegramUpdate): number | undefined {
  const type = getUpdateType(update)
  const value = update[type]
  if (isRecord(value) && typeof value.date === 'number') return value.date

  if (type === 'callback_query' && isRecord(value) && isRecord(value.message) && typeof value.message.date === 'number') {
    return value.message.date
  }

  return undefined
}

export function getChatDisplayName(chat: TelegramChat): string {
  return chatName(chat)
}
