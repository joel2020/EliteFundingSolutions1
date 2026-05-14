export const COMPANY = {
  name: 'Elite Funding Solutions',
  legalName: 'Elite Funding Solutions LLC',
  phone: '(813) 702-8787',
  phoneHref: '8137028787',
  email: 'info@elitefundingsolution.com',
  domain: 'https://elitefundingsolution.com',
  street: '2202 N Westshore Blvd.',
  city: 'Tampa',
  state: 'FL',
  zip: '33607',
  get addressLines() {
    return [this.name, this.street, `${this.city}, ${this.state} ${this.zip}`];
  },
  get mailingAddress() {
    return `${this.name}, ${this.street}, ${this.city}, ${this.state} ${this.zip}`;
  },
};

export const LEGAL_EFFECTIVE_DATE = 'May 13, 2026';
export const CONSENT_VERSION = 'elite_legal_consent_2026-05-13';
