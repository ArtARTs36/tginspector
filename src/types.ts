export type TelegramResponse<T> =
  | { ok: true; result: T }
  | { ok: false; error_code: number; description: string; parameters?: Record<string, unknown> }

export interface TelegramUser {
  id: number
  is_bot: boolean
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  can_join_groups?: boolean
  can_read_all_group_messages?: boolean
  supports_inline_queries?: boolean
  can_connect_to_business?: boolean
  has_main_web_app?: boolean
}

export interface TelegramChat {
  id: number
  type: 'private' | 'group' | 'supergroup' | 'channel' | string
  title?: string
  username?: string
  first_name?: string
  last_name?: string
  is_forum?: boolean
}

export interface WebhookInfo {
  url: string
  has_custom_certificate: boolean
  pending_update_count: number
  ip_address?: string
  last_error_date?: number
  last_error_message?: string
  last_synchronization_error_date?: number
  max_connections?: number
  allowed_updates?: string[]
}

export interface TelegramMessageLike {
  message_id?: number
  message_thread_id?: number
  date?: number
  chat?: TelegramChat
  text?: string
  caption?: string
  is_topic_message?: boolean
  forum_topic_created?: { name: string; icon_color?: number; icon_custom_emoji_id?: string }
  forum_topic_edited?: { name?: string; icon_custom_emoji_id?: string }
  [key: string]: unknown
}

export interface TelegramUpdate {
  update_id: number
  [key: string]: unknown
}

export interface ObservedThread {
  id: number
  title: string
  lastSeenAt?: number
}

export interface ObservedChat {
  chat: TelegramChat
  threads: ObservedThread[]
  lastSeenAt?: number
  updateCount: number
}
