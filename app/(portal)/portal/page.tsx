'use client';

import { useEffect, useState } from 'react';
import { supabase, DEFAULT_ORG_ID } from '@/lib/supabase';
import { FileText, Upload, MessageSquare, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  draft: { label: 'Draft', icon: FileText, color: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Submitted', icon: CheckCircle, color: 'bg-blue-100 text-blue-700' },
  in_review: { label: 'In Review', icon: Clock, color: 'bg-yellow-100 text-yellow-700' },
  docs_requested: { label: 'Docs Needed', icon: AlertCircle, color: 'bg-orange-100 text-orange-700' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'bg-green-100 text-green-700' },
  declined: { label: 'Declined', icon: AlertCircle, color: 'bg-red-100 text-red-700' },
};

export default function ClientPortalPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadPortalData();
  }, []);

  const loadPortalData = async () => {
    try {
      const [
        { data: apps },
        { data: docs },
        { data: offerData },
      ] = await Promise.all([
        supabase.from('applications').select('*').eq('organization_id', DEFAULT_ORG_ID).order('created_at', { ascending: false }).limit(5),
        supabase.from('documents').select('*').eq('organization_id', DEFAULT_ORG_ID).order('created_at', { ascending: false }).limit(10),
        supabase.from('offers').select('*').eq('organization_id', DEFAULT_ORG_ID).order('created_at', { ascending: false }).limit(5),
      ]);

      setApplications(apps || []);
      setDocuments(docs || []);
      setOffers(offerData || []);
    } catch (error) {
      console.error('Error loading portal data:', error);
    }
    setLoading(false);
  };

  const handleFileUpload = async () => {
    if (!uploadFile) {
      toast.error('Please select a file');
      return;
    }

    setUploading(true);
    try {
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${DEFAULT_ORG_ID}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, uploadFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          organization_id: DEFAULT_ORG_ID,
          document_type: 'other',
          file_name: uploadFile.name,
          file_path: filePath,
          file_url: publicUrl,
          file_size: uploadFile.size,
        });

      if (dbError) throw dbError;

      toast.success('Document uploaded successfully');
      setShowUploadDialog(false);
      setUploadFile(null);
      loadPortalData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload document');
    }
    setUploading(false);
  };

  const sendMessage = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    const { error } = await supabase
      .from('messages')
      .insert({
        organization_id: DEFAULT_ORG_ID,
        message_type: 'client_inquiry',
        content: message,
        status: 'unread',
      });

    if (error) {
      toast.error('Failed to send message');
    } else {
      toast.success('Message sent to your advisor');
      setShowMessageDialog(false);
      setMessage('');
    }
  };

  const getApplicationProgress = (status: string) => {
    const stages = ['submitted', 'in_review', 'docs_requested', 'approved'];
    const currentIndex = stages.indexOf(status);
    return currentIndex >= 0 ? ((currentIndex + 1) / stages.length) * 100 : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-[#A1A1AA]">Loading your portal...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <div className="bg-white border-b border-[#E4E4E7]">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#09090B]">Client Portal</h1>
              <p className="text-[#71717A]">Track your applications and funding status</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowUploadDialog(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
              <Button onClick={() => setShowMessageDialog(true)}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Message Advisor
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="applications" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="offers">Offers</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          {/* Applications Tab */}
          <TabsContent value="applications">
            <div className="space-y-4">
              {applications.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-[#A1A1AA]" />
                    <p className="text-[#71717A]">No applications yet</p>
                  </CardContent>
                </Card>
              ) : (
                applications.map((app) => {
                  const status = statusConfig[app.status];
                  const Icon = status?.icon || FileText;
                  const progress = getApplicationProgress(app.status);
                  
                  return (
                    <Card key={app.id}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-semibold text-lg text-[#09090B] mb-1">
                              {app.business_name || 'Application'}
                            </h3>
                            <p className="text-sm text-[#71717A]">
                              Requested: ${app.requested_amount?.toLocaleString() || '0'}
                            </p>
                          </div>
                          <Badge className={status?.color}>
                            <Icon className="w-3 h-3 mr-1" />
                            {status?.label || app.status}
                          </Badge>
                        </div>

                        <div className="mb-4">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-[#71717A]">Progress</span>
                            <span className="font-semibold text-[#09090B]">{Math.round(progress)}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>

                        <div className="text-xs text-[#A1A1AA]">
                          Submitted {new Date(app.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* Offers Tab */}
          <TabsContent value="offers">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {offers.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="py-12 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-[#A1A1AA]" />
                    <p className="text-[#71717A]">No offers yet</p>
                  </CardContent>
                </Card>
              ) : (
                offers.map((offer) => (
                  <Card key={offer.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{offer.business_name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-[#71717A]">Funding Amount</span>
                          <span className="font-semibold text-[#09090B]">${offer.funding_amount?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#71717A]">Total Payback</span>
                          <span className="font-semibold text-[#09090B]">${offer.total_payback?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#71717A]">Payment</span>
                          <span className="font-semibold text-[#09090B]">
                            ${offer.payment_amount?.toLocaleString()} {offer.payment_frequency}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#71717A]">Term</span>
                          <span className="font-semibold text-[#09090B]">{offer.term_months} months</span>
                        </div>
                        <Button className="w-full mt-4">
                          Accept Offer
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="py-12 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-[#A1A1AA]" />
                    <p className="text-[#71717A] mb-4">No documents uploaded</p>
                    <Button onClick={() => setShowUploadDialog(true)}>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Document
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                documents.map((doc) => (
                  <Card key={doc.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                          <FileText className="w-5 h-5 text-[#2563EB]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-[#09090B] truncate">{doc.file_name}</div>
                          <div className="text-xs text-[#71717A]">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="w-full" onClick={() => window.open(doc.file_url, '_blank')}>
                        View
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>Upload a document for your application</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="file">Select File</Label>
            <Input
              id="file"
              type="file"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
            <Button onClick={handleFileUpload} disabled={uploading || !uploadFile}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message Your Advisor</DialogTitle>
            <DialogDescription>Send a message to your funding advisor</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Type your message here..."
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMessageDialog(false)}>Cancel</Button>
            <Button onClick={sendMessage}>
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
