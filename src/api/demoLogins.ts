import { api } from './client';

export type DemoGroup = 'University' | 'Placement cell' | 'Company' | 'Student';

export interface DemoLogin {
  email: string;
  group: DemoGroup;
  name: string;
  situation: string;
  tryThis: string[];
  exists: boolean;
  lastLoginAt: string | null;
}

export interface DemoLogins {
  /** Whether this server allows the reset (DEMO_LOGINS=true). */
  enabled: boolean;
  built: boolean;
  builtAt: string | null;
  password: string;
  missing: number;
  logins: DemoLogin[];
}

/** The platform team's demo logins, and the reset that puts them back. */
export const demoLoginsApi = {
  list: () => api.get<DemoLogins>('/platform/demo-logins'),
  reset: () =>
    api.post<DemoLogins & { result: { logins: number; seconds: number } }>('/platform/demo-logins/reset'),
};
