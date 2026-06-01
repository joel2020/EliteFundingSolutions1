export const APPLICATION_DISCLOSURE_SECTIONS = [
  {
    title: 'Authorization',
    paragraphs: [
      'I certify that the information submitted in this application is accurate and complete to the best of my knowledge.',
      'I authorize Elite Funding Solutions and its funding partners to review my business, identity, ownership, application details, uploaded documents, and related financial information for business funding options.',
    ],
  },
  {
    title: 'Credit Review Consent',
    paragraphs: [
      'I authorize Elite Funding Solutions, its affiliates, service providers, funding partners, funders, banks, processors, and underwriting partners to obtain business, consumer, personal, investigative, credit, bank, processor, and financial reports for underwriting, verification, fraud prevention, renewal review, servicing, and compliance purposes.',
      'Credit review may include soft or hard inquiries depending on the funding product, funding partner, and stage of review.',
    ],
  },
  {
    title: 'Electronic Signature Consent',
    paragraphs: [
      'I consent to electronic records, electronic communications, and electronic signatures for this application and related funding review.',
      'My typed name, checkbox selections, submission timestamp, IP address, user agent, and consent version may be stored as evidence of my authorization and electronic signature.',
    ],
  },
  {
    title: 'Communication Consent',
    paragraphs: [
      'I authorize Elite Funding Solutions to contact me about this application, missing information, document requests, funding options, underwriting updates, and related services by phone, email, and text message where permitted.',
      'Message and data rates may apply for text messages. Consent to optional text messaging is not required where prohibited by law.',
    ],
  },
  {
    title: 'Privacy Notice',
    paragraphs: [
      'Elite Funding Solutions treats nonpublic personal information and business funding information as confidential and uses reasonable administrative, technical, and physical safeguards to protect submitted data.',
      'Application information may be shared with funding partners, service providers, affiliates, and other recipients who need the information to evaluate, verify, process, service, or comply with legal obligations related to the application.',
    ],
  },
] as const;

export const APPLICATION_CHECKBOX_CONSENT =
  'I have read and agree to the Authorization, Credit Review Consent, Electronic Signature Consent, Communication Consent, and Privacy Notice above.';
