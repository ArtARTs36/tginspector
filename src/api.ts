import type {
  TelegramMessageLike,
  TelegramResponse,
  TelegramUpdate,
  TelegramUser,
  WebhookInfo,
} from './types'

export class TelegramApiError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message)
    this.name = 'TelegramApiError'
  }
}

export interface SendMessageParams {
  chatId: string
  messageThreadId?: number
  text: string
}

export interface TelegramClient {
  getMe(): Promise<TelegramUser>
  getWebhookInfo(): Promise<WebhookInfo>
  getUpdates(): Promise<TelegramUpdate[]>
  sendMessage(params: SendMessageParams): Promise<TelegramMessageLike>
}

function normalizeChatId(chatId: string): string | number {
  if (!/^-?\d+$/.test(chatId)) return chatId

  const value = Number(chatId)
  return Number.isSafeInteger(value) ? value : chatId
}

export function createTelegramClient(token: string): TelegramClient {
  const baseUrl = `https://api.telegram.org/bot${token}`

  async function call<T>(method: string, body: Record<string, unknown> = {}): Promise<T> {
    let response: Response

    try {
      response = await fetch(`${baseUrl}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      })
    } catch {
      throw new TelegramApiError('Could not reach Telegram Bot API. Check your network connection.')
    }

    let payload: TelegramResponse<T>
    try {
      payload = (await response.json()) as TelegramResponse<T>
    } catch {
      throw new TelegramApiError(`Telegram returned an unreadable response (${response.status}).`, response.status)
    }

    if (!payload.ok) {
      throw new TelegramApiError(payload.description || 'Telegram Bot API request failed.', payload.error_code)
    }

    return payload.result
  }

  return {
    getMe: () => call<TelegramUser>('getMe'),
    getWebhookInfo: () => call<WebhookInfo>('getWebhookInfo'),
    getUpdates: () => call<TelegramUpdate[]>('getUpdates', { limit: 100, timeout: 0 }),
    sendMessage: ({ chatId, messageThreadId, text }) =>
      call<TelegramMessageLike>('sendMessage', {
        chat_id: normalizeChatId(chatId),
        ...(messageThreadId === undefined ? {} : { message_thread_id: messageThreadId }),
        text,
      }),
  }
}
