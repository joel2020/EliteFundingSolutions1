import type { Metadata } from 'next';
import ContactForm from './contact-form';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Contact Us | Elite Funding Solutions',
  description: 'Contact Elite Funding Solutions for business funding questions, application support, documentation guidance, and partner-network funding options.',
  path: '/contact',
});

export default function ContactPage() {
  return <ContactForm />;
}
