import { api } from './client';

/**
 * The campus feed.
 *
 * One college's, always. A student reads their own college's posts and
 * nobody else's - the same fence every other part of this platform keeps -
 * so nothing here takes a college id: the server knows whose feed to open
 * from who is asking.
 */

export interface FeedMedia {
  url: string;
  kind: 'photo' | 'video';
}

export interface FeedComment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string };
  mine: boolean;
}

export interface FeedPost {
  id: string;
  /**
   * What they wrote, as HTML.
   *
   * Sanitised by the server against a tight allowlist on the way in, so what
   * arrives here is already exactly what a browser will render.
   */
  bodyHtml: string;
  media: FeedMedia[];
  createdAt: string;
  /** Whether the college is speaking as itself rather than a person. */
  authorKind: 'STUDENT' | 'COLLEGE' | 'COMPANY';
  author: { id: string; name: string };
  mine: boolean;
  likes: number;
  likedByMe: boolean;
  comments: FeedComment[];
}

export const feedApi = {
  list: (before?: string) =>
    api.get<{ posts: FeedPost[]; canPostAsCollege: boolean }>(
      `/feed${before ? `?before=${encodeURIComponent(before)}` : ''}`,
    ),

  post: (bodyHtml: string, media: FeedMedia[], asCollege = false) =>
    api.post<{ post: FeedPost }>('/feed', { bodyHtml, media, asCollege }).then((r) => r.post),

  /** A photograph or clip, sniffed by its bytes and stored under a random name. */
  upload: async (file: File): Promise<FeedMedia> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/feed/media', {
      method: 'POST',
      body: form,
      credentials: 'include',
    });
    if (!res.ok) {
      const problem = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(problem?.message ?? 'That file did not upload.');
    }
    return (await res.json()) as FeedMedia;
  },

  like: (id: string, on: boolean) =>
    on
      ? api.post<{ likes: number; likedByMe: boolean }>(`/feed/${id}/like`)
      : api.delete<{ likes: number; likedByMe: boolean }>(`/feed/${id}/like`),

  comment: (id: string, body: string) =>
    api.post<{ comment: FeedComment }>(`/feed/${id}/comments`, { body }).then((r) => r.comment),

  remove: (id: string) => api.delete<{ removed: boolean }>(`/feed/${id}`),

  removeComment: (id: string) => api.delete<{ removed: boolean }>(`/feed/comments/${id}`),
};
