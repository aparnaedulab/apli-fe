import { api } from './client';

/** The student help panel's questions, for the signed-in person's institution. */
export const helpApi = {
  faq: () => api.get<{ questions: { question: string; answer: string }[] }>('/help/faq').then((r) => r.questions),
};
