import { Resend } from 'resend';
import { COMPANY } from '@/lib/company';

const senderEmail = process.env.SENDER_EMAIL || 'onboarding@resend.dev';

export interface EmailData {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailData) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return { success: false, error: 'RESEND_API_KEY is not configured' };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const data = await resend.emails.send({
      from: senderEmail,
      to: [to],
      subject,
      html,
    });
    return { success: true, data };
  } catch (error: any) {
    console.error('Email send error. Check provider logs for details.');
    return { success: false, error: error.message };
  }
}

const complianceFooter = `
  <p>${COMPANY.legalName}<br/>${COMPANY.street}<br/>${COMPANY.city}, ${COMPANY.state} ${COMPANY.zip}</p>
  <p>You may opt out of marketing emails by replying with "unsubscribe" or contacting ${COMPANY.email}. For texts, reply STOP to opt out.</p>
`;

// Email Templates
export const emailTemplates = {
  applicationReceived: (businessName: string, amount: number) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 40px 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Application Received</h1>
      </div>
      <div style="padding: 40px 20px; background: #ffffff;">
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Dear ${businessName},
        </p>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Thank you for submitting your funding application for <strong>$${amount.toLocaleString()}</strong>.
        </p>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Our underwriting team will review your application within 24-48 hours. We'll notify you as soon as we have an update.
        </p>
        <div style="margin: 30px 0; padding: 20px; background: #eff6ff; border-left: 4px solid #2563eb; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; color: #1e40af;">
            <strong>Next Steps:</strong><br/>
            1. We'll review your application<br/>
            2. Request any additional documents if needed<br/>
            3. Provide you with funding offers
          </p>
        </div>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          If you have any questions, please don't hesitate to reach out.
        </p>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Best regards,<br/>
          <strong>Elite Funding Solutions Team</strong>
        </p>
      </div>
      <div style="padding: 20px; text-align: center; background: #f9fafb; color: #6b7280; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Elite Funding Solutions. All rights reserved.</p>${complianceFooter}
      </div>
    </div>
  `,

  documentRequest: (businessName: string, documents: string[]) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%); padding: 40px 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Documents Requested</h1>
      </div>
      <div style="padding: 40px 20px; background: #ffffff;">
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Dear ${businessName},
        </p>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          To continue processing your application, we need the following documents:
        </p>
        <ul style="font-size: 16px; color: #374151; line-height: 1.8; padding-left: 20px;">
          ${documents.map(doc => `<li>${doc}</li>`).join('')}
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="#" style="display: inline-block; padding: 14px 32px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Upload Documents</a>
        </div>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Please upload these documents at your earliest convenience to avoid delays.
        </p>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Best regards,<br/>
          <strong>Elite Funding Solutions Team</strong>
        </p>
      </div>
      <div style="padding: 20px; text-align: center; background: #f9fafb; color: #6b7280; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Elite Funding Solutions. All rights reserved.</p>${complianceFooter}
      </div>
    </div>
  `,

  offerReady: (businessName: string, amount: number, payment: number) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 40px 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Funding Offer Ready!</h1>
      </div>
      <div style="padding: 40px 20px; background: #ffffff;">
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Dear ${businessName},
        </p>
        <p style="font-size: 18px; color: #059669; line-height: 1.6; font-weight: 600;">
          Great news! Your funding application has been approved.
        </p>
        <div style="margin: 30px 0; padding: 25px; background: #f0fdf4; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">Approved Funding Amount</p>
          <p style="margin: 0; font-size: 36px; color: #059669; font-weight: bold;">$${amount.toLocaleString()}</p>
          <p style="margin: 15px 0 0 0; font-size: 14px; color: #6b7280;">Monthly Payment: $${payment.toLocaleString()}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="#" style="display: inline-block; padding: 14px 32px; background: #059669; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">View Offer Details</a>
        </div>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Please review the complete offer in your portal and let us know if you have any questions.
        </p>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Best regards,<br/>
          <strong>Elite Funding Solutions Team</strong>
        </p>
      </div>
      <div style="padding: 20px; text-align: center; background: #f9fafb; color: #6b7280; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Elite Funding Solutions. All rights reserved.</p>${complianceFooter}
      </div>
    </div>
  `,
};
