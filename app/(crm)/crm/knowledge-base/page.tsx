'use client';
/* eslint-disable @next/next/no-img-element -- Knowledge base images are user-managed external screenshots. */

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CrmTopbar } from '@/components/crm/topbar';
import { useCrmUser } from '@/lib/crm-auth';
import { toast } from 'sonner';

const categories = ['Getting Started', 'Client Management', 'Pipeline & Deal Flow', 'AI Analysis Tools', 'Lender Submission Process', 'The Vault'];
const seedArticles = [
  { id: 'getting-started-overview', category: 'Getting Started', title: 'CRM operating flow', body: 'Every deal should move from lead to application, documents, underwriting, lender submission, offer, contract, funded outcome, or Vault outcome. Keep notes and documents on the deal record.' },
  { id: 'pipeline-new-deal', category: 'Pipeline & Deal Flow', title: 'Create a new deal', body: 'Use Pipeline > New Deal, link or create the client, upload bank statements and identity documents, then open Full Details to review readiness and lender matching.' },
  { id: 'ai-analysis', category: 'AI Analysis Tools', title: 'Review statement analysis', body: 'The AI panel tracks deposits, withdrawals, net cash flow, daily ledger balance, negative days, NSF count, and recurring debit positions.' },
  { id: 'vault-follow-up', category: 'The Vault', title: 'Revisit non-funded deals', body: 'Use The Vault to find declined, withdrawn, or incomplete deals. Add notes with follow-up timing so the team can revive good files later.' },
];

export default function KnowledgeBasePage() {
  const { profile } = useCrmUser();
  const [articles, setArticles] = useState<any[]>(seedArticles);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Getting Started');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrls, setImageUrls] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const canEdit = ['super_admin', 'admin', 'manager'].includes(profile?.role || '');

  const loadArticles = async () => {
    const response = await fetch('/api/crm/knowledge-base/articles');
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.success) setArticles(result.articles.length ? result.articles : seedArticles);
  };

  useEffect(() => {
    loadArticles().catch(() => setArticles(seedArticles));
  }, []);

  const filtered = useMemo(() => articles.filter((article) => [article.category, article.title, article.body].join(' ').toLowerCase().includes(search.toLowerCase())), [articles, search]);

  const saveArticle = async () => {
    if (!title.trim() || !body.trim()) return;
    const payload = { category, title: title.trim(), body: body.trim(), image_urls: imageUrls.split('\n').map((url) => url.trim()).filter(Boolean) };
    const response = await fetch(editingId ? `/api/crm/knowledge-base/articles/${editingId}` : '/api/crm/knowledge-base/articles', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) { toast.error(result.error || 'Unable to save article'); return; }
    toast.success(editingId ? 'Article updated' : 'Article saved');
    await loadArticles();
    setEditingId(null);
    setTitle('');
    setBody('');
    setImageUrls('');
  };

  const editArticle = (article: any) => {
    setEditingId(article.id);
    setCategory(article.category);
    setTitle(article.title);
    setBody(article.body);
    setImageUrls((article.image_urls || []).join('\n'));
  };

  const deleteArticle = async (id: string) => {
    const response = await fetch(`/api/crm/knowledge-base/articles/${id}`, { method: 'DELETE' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) { toast.error(result.error || 'Unable to delete article'); return; }
    toast.success('Article deleted');
    await loadArticles();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <CrmTopbar title="Knowledge Base" subtitle="Internal CRM playbooks, onboarding notes, and process guides" />
      <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-5">
        <div className="mb-4 flex items-center gap-2 rounded-[8px] border border-[#E2E8F0] bg-white px-3">
          <Search className="h-4 w-4 text-[#64748B]" />
          <Input className="h-11 border-0 shadow-none focus-visible:ring-0" placeholder="Search guides" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
          <div className="rounded-[8px] border border-[#E2E8F0] bg-white p-3">
            {categories.map((item) => <button key={item} className="flex w-full items-center gap-2 rounded-[7px] px-3 py-2 text-left text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC]"><BookOpen className="h-4 w-4 text-[#0F2B5B]" />{item}</button>)}
          </div>
          <div className="grid gap-4">
            {canEdit && <div className="rounded-[8px] border border-[#E2E8F0] bg-white p-4"><h2 className="text-sm font-semibold text-[#0F172A]">{editingId ? 'Edit article' : 'Add article'}</h2><div className="mt-3 grid gap-3"><Select value={category} onValueChange={setCategory}><SelectTrigger className="rounded-[7px]"><SelectValue /></SelectTrigger><SelectContent>{categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><div><Label>Title</Label><Input className="mt-1 rounded-[7px]" value={title} onChange={(event) => setTitle(event.target.value)} /></div><div><Label>Article body</Label><Textarea className="mt-1 min-h-[130px] rounded-[7px]" value={body} onChange={(event) => setBody(event.target.value)} /></div><div><Label>Image URLs</Label><Textarea className="mt-1 min-h-[70px] rounded-[7px]" value={imageUrls} onChange={(event) => setImageUrls(event.target.value)} placeholder="One screenshot/image URL per line" /></div><div className="flex gap-2"><Button className="w-fit rounded-[7px] bg-[#0F2B5B]" onClick={saveArticle}>{editingId ? 'Update article' : 'Save article'}</Button>{editingId && <Button variant="outline" className="rounded-[7px]" onClick={() => { setEditingId(null); setTitle(''); setBody(''); setImageUrls(''); }}>Cancel</Button>}</div></div></div>}
            {filtered.map((article: any) => <article key={article.id} className="rounded-[8px] border border-[#E2E8F0] bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase text-[#64748B]">{article.category}</p><h2 className="mt-1 text-lg font-semibold text-[#0F172A]">{article.title}</h2></div>{canEdit && <div className="flex gap-2"><Button variant="outline" size="sm" className="h-8 rounded-[7px]" onClick={() => editArticle(article)}>Edit</Button><Button variant="outline" size="sm" className="h-8 rounded-[7px]" onClick={() => deleteArticle(article.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div>}</div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#334155]">{article.body}</p>{(article.image_urls || []).length > 0 && <div className="mt-3 grid gap-2 md:grid-cols-2">{article.image_urls.map((url: string) => <img key={url} src={url} alt={article.title} className="max-h-[260px] w-full rounded-[8px] border border-[#E2E8F0] object-cover" />)}</div>}</article>)}
          </div>
        </div>
      </div>
    </div>
  );
}
