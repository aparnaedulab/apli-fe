import { api } from './client';

/**
 * What an institution shows the world before anyone signs in: enough to paint
 * its sign-in page, and the Contact us it chose to publish. Nothing else.
 */
export interface PublicTenant {
  name: string;
  shortName: string | null;
  slug: string;
  tagline: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  brandColor: string;
  supportEmail: string | null;
  supportPhone: string | null;
  supportAltPhone: string | null;
  supportWhatsapp: string | null;
  officeHours: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

export const publicTenantApi = {
  /** 404 for an unknown or not-yet-live address, 503 while suspended. */
  get: (slug: string) =>
    api.get<{ tenant: PublicTenant }>(`/public/tenants/${encodeURIComponent(slug)}`),
};
