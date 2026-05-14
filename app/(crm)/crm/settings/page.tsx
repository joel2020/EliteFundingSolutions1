import { CrmTopbar } from '@/components/crm/topbar';
import { GmailConnection } from '@/components/gmail/gmail-connection';
import { GmailStatusToast } from './settings-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Bell, Shield } from 'lucide-react';
import { Suspense } from 'react';

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Suspense fallback={null}>
        <GmailStatusToast />
      </Suspense>
      <CrmTopbar
        title="Settings"
        subtitle="Manage your account and integrations"
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Gmail Integration */}
          <GmailConnection />

          {/* Email Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                  <Mail className="w-5 h-5 text-[#2563EB]" />
                </div>
                <div>
                  <CardTitle>Email Settings</CardTitle>
                  <CardDescription>Configure email preferences and templates</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-[#71717A]">
                <p className="mb-2">Email integrations:</p>
                <ul className="space-y-1">
                  <li>✓ Resend - Transactional emails (configured)</li>
                  <li>✓ Gmail - Personal work emails (see above)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#FEF3C7] flex items-center justify-center">
                  <Bell className="w-5 h-5 text-[#D97706]" />
                </div>
                <div>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>Manage your notification preferences</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-[#71717A]">
                Email notifications for:
                <ul className="mt-2 space-y-1">
                  <li>✓ New applications</li>
                  <li>✓ Document uploads</li>
                  <li>✓ Status changes</li>
                  <li>✓ Task assignments</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#DCFCE7] flex items-center justify-center">
                  <Shield className="w-5 h-5 text-[#059669]" />
                </div>
                <div>
                  <CardTitle>Security</CardTitle>
                  <CardDescription>Password and authentication settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-[#71717A]">
                <p>✓ Multi-factor authentication</p>
                <p>✓ Secure session management</p>
                <p>✓ Activity logging</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
