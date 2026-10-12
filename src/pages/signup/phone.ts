import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/**
 * Country codes for the mobile number.
 *
 * The codes and what a valid number looks like in each country come from
 * libphonenumber (Google's numbering data, packaged with the app); country
 * names come from the browser, in English. Nothing is fetched at sign-up.
 */

export interface DialCode {
  country: CountryCode;
  name: string;
  code: string;
}

const names = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();

/** Every country, by name, with India first - most students are there. */
export const DIAL_CODES: DialCode[] = getCountries()
  .map((country) => ({ country, name: names?.of(country) ?? country, code: getCountryCallingCode(country) }))
  .sort((a, b) => (a.country === 'IN' ? -1 : b.country === 'IN' ? 1 : a.name.localeCompare(b.name)));

/** The country the browser says the student is in ("en-IN" -> IN), else India. */
export function guessCountry(): CountryCode {
  const region = (navigator.languages ?? [navigator.language])
    .map((l) => l.split('-')[1]?.toUpperCase())
    .find((r) => r && DIAL_CODES.some((d) => d.country === r));
  return (region as CountryCode | undefined) ?? 'IN';
}

/** Whether a number is a real one for that country. */
export function isValidMobile(number: string, country: CountryCode): boolean {
  return Boolean(parsePhoneNumberFromString(number, country)?.isValid());
}
