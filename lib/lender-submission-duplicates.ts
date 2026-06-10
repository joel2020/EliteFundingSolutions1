export const ACTIVE_FUNDER_SUBMISSION_STATUSES = [
  'draft',
  'submitted',
  'in_review',
  'more_info_needed',
  'approved',
  'funded',
];

export function isActiveFunderSubmissionStatus(status: unknown) {
  return ACTIVE_FUNDER_SUBMISSION_STATUSES.includes(String(status || '').toLowerCase());
}
