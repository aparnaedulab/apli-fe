import { api } from './client';
import type { AuthUser } from '../auth/AuthContext';
import type { CompanySize, CompanyStatus } from './company';

/**
 * The only endpoints that work without a session. Everything else on the
 * platform arrives by invitation; a company is the one party that can turn up
 * uninvited, because nobody at the university knows they exist yet.
 */

export interface RegisterOptions {
  industries: { id: string; name: string }[];
}

export interface CompanyRegistration {
  company: {
    name: string;
    legalName?: string;
    industryId?: string;
    sizeBand?: CompanySize | '';
    foundedYear?: number;
    gstin?: string;
    cin?: string;
    website?: string;
    careersUrl?: string;
    linkedinUrl?: string;
    about?: string;
    city?: string;
    state?: string;
    address?: string;
    pincode?: string;
  };
  contact: { fullName: string; email: string; password: string };
}

export const registrationApi = {
  options: () => api.get<RegisterOptions>('/auth/register/options'),

  /** No session comes back: the account waits for the company to be verified. */
  registerCompany: (data: CompanyRegistration) =>
    api.post<{ company: { id: string; name: string; status: CompanyStatus } }>(
      '/auth/register/company',
      data,
    ),
};
