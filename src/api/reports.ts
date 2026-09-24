import { api } from './client';

/** Placement statistics and the NAAC / NIRF / NBA workbook. */

export type PlacementType = 'FINAL' | 'INTERNSHIP';

export interface SalaryStats {
  count: number;
  highest: number | null;
  median: number | null;
  average: number | null;
}

export interface Outcome {
  applied: number;
  placed: number;
  placedPct: number | null;
  offersMade: number;
  offersAccepted: number;
  recruiters: number;
  pay: SalaryStats;
  payBasis: { fromFixed: number; fromRangeMin: number; missing: number };
  payUnit: 'annual CTC' | 'monthly stipend';
}

export interface PlacementReport {
  scope: { kind: 'college' | 'tenant'; name: string };
  filter: { year: number | null; placement: { id: string; name: string; type: PlacementType } | null };
  years: number[];
  drives: { id: string; name: string; year: number; type: PlacementType; college: string }[];
  pool: number;
  final: Outcome;
  internship: Outcome;
  byBranch: {
    course: string | null;
    branch: string | null;
    pool: number;
    placed: number;
    placedPct: number | null;
    medianCtc: number | null;
    highestCtc: number | null;
  }[];
  byCompany: { company: string; offers: number; accepted: number; medianCtc: number | null; highestCtc: number | null }[];
  byCollege: {
    collegeId: string | null;
    college: string;
    code: string | null;
    pool: number;
    placed: number;
    placedPct: number | null;
    medianCtc: number | null;
    recruiters: number;
  }[];
  notTracked: string[];
  consentNote: string;
  generatedAt: string;
}

export interface ReportQuery {
  year?: number;
  placementId?: string;
}

function qs(q: ReportQuery): string {
  const p = new URLSearchParams();
  if (q.placementId) p.set('placementId', q.placementId);
  else if (q.year) p.set('year', String(q.year));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export type ReportScope = 'college' | 'tenant';

export const reportsApi = {
  get: (scope: ReportScope, q: ReportQuery = {}) => api.get<PlacementReport>(`/reports/${scope}${qs(q)}`),
  download: (scope: ReportScope, q: ReportQuery, filename: string) =>
    api.download(`/reports/${scope}.xlsx${qs(q)}`, filename),
};
