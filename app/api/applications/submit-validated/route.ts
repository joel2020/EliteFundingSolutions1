import { NextResponse } from 'next/server';
import { POST as submitApplication } from '../submit/route';
import { digitsOnly } from '@/lib/security';
import { requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

type IssueMap = Record<string, string[]>;

const addIssue = (issues: IssueMap, field: string, message: string) => {
  issues[field] = [...(issues[field] || []), message];
};

const isValidDate = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
};

const hasText = (value: unknown, min = 1) => typeof value === 'string' && value.trim().length >= min;

async function readPayload(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.clone().formData();
    const payload = formData.get('payload');
    if (typeof payload !== 'string') throw new Error('Missing application payload.');
    return JSON.parse(payload);
  }

  return request.clone().json();
}

function validateShortApplication(payload: any, issues: IssueMap) {
  if (!hasText(payload.full_name, 2)) addIssue(issues, 'full_name', 'Full legal name is required.');
  if (!hasText(payload.home_address, 5)) addIssue(issues, 'home_address', 'Home address is required.');
  if (digitsOnly(payload.ssn || '').length !== 9) addIssue(issues, 'ssn', 'Full SSN must be 9 digits.');
  if (!isValidDate(payload.dob)) addIssue(issues, 'dob', 'Date of birth is required.');
  if (digitsOnly(payload.cell_phone || '').length < 10) addIssue(issues, 'cell_phone', 'A valid cell phone number is required.');
  const ownership = Number(String(payload.ownership_percentage || '100').replace(/%/g, ''));
  if (!Number.isFinite(ownership) || ownership <= 0 || ownership > 100) addIssue(issues, 'ownership_percentage', 'Ownership percentage must be between 1 and 100.');
  if (!hasText(payload.company_name, 2)) addIssue(issues, 'company_name', 'Company name is required.');
  if (!hasText(payload.business_address, 5)) addIssue(issues, 'business_address', 'Business address is required.');
  if (digitsOnly(payload.ein || '').length !== 9) addIssue(issues, 'ein', 'Full EIN / Tax ID must be 9 digits.');
  if (!isValidDate(payload.business_start_date)) addIssue(issues, 'business_start_date', 'Business start date is required.');
}

function validateFullApplication(payload: any, issues: IssueMap) {
  const owner = payload.owner1 || {};
  if (!hasText(payload.legal_name, 2)) addIssue(issues, 'legal_name', 'Company legal name is required.');
  if (!hasText(payload.address, 5)) addIssue(issues, 'address', 'Business address is required.');
  if (digitsOnly(payload.ein || '').length !== 9) addIssue(issues, 'ein', 'Full EIN / Tax ID must be 9 digits.');
  if (!isValidDate(payload.start_date)) addIssue(issues, 'start_date', 'Business start date is required.');
  if (!hasText(owner.first_name) || !hasText(owner.last_name)) addIssue(issues, 'owner1', 'Owner full legal name is required.');
  if (!hasText(owner.address, 5)) addIssue(issues, 'owner1.address', 'Owner home address is required.');
  if (digitsOnly(owner.ssn || '').length !== 9) addIssue(issues, 'owner1.ssn', 'Full owner SSN must be 9 digits.');
  if (!isValidDate(owner.dob)) addIssue(issues, 'owner1.dob', 'Owner date of birth is required.');

  const ownerPhone = owner.mobile || owner.phone || payload.business_mobile || payload.business_phone;
  if (digitsOnly(ownerPhone || '').length < 10) addIssue(issues, 'owner1.phone', 'A valid cell phone number is required.');
}

function validateMinimumApplicationFields(payload: any) {
  const issues: IssueMap = {};
  if (payload && typeof payload === 'object' && 'full_name' in payload) {
    validateShortApplication(payload, issues);
  } else {
    validateFullApplication(payload, issues);
  }
  return issues;
}

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  let payload: any;

  try {
    payload = await readPayload(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid application payload.' }, { status: 400 });
  }

  const fieldErrors = validateMinimumApplicationFields(payload);
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'Please complete the required identity, business, and consent fields before submitting.',
        issues: { fieldErrors },
      },
      { status: 400 },
    );
  }

  return submitApplication(request);
}
