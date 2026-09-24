import type { MessageKey } from './en';

export type Locale = 'en' | 'hi' | 'mr';

/** A translation may leave any key out; English stands in for it. */
export type Messages = Partial<Record<MessageKey, string>>;

export type { MessageKey };
