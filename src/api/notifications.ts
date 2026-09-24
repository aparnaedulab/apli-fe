import { api } from './client';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  /**
   * What the notification is about, as the writer left it.
   *
   * Application moves carry `{ applicationId, status }`, which is what lets a
   * screen attach an update to the thing it happened to rather than only
   * listing it.
   */
  payload: Record<string, unknown> | null;
}

export const notificationApi = {
  list: () =>
    api.get<{ notifications: Notification[]; unreadCount: number }>('/notifications'),

  /** The application moves only - what the applications page is a home for. */
  applicationUpdates: () =>
    api
      .get<{ notifications: Notification[]; unreadCount: number }>('/notifications')
      .then((r) => r.notifications.filter((n) => n.type.startsWith('application.'))),

  /** Tests somebody has set, for the page those live on. */
  assessmentUpdates: () =>
    api
      .get<{ notifications: Notification[]; unreadCount: number }>('/notifications')
      .then((r) => r.notifications.filter((n) => n.type.startsWith('assessment.'))),

  markRead: (ids?: string[]) => api.post<{ read: number }>('/notifications/read', { ids }),
};
