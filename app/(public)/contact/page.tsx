import type { Metadata } from 'next';
import ContactForm from './contact-form';

export const metadata: Metadata = {
  title: 'Contact Us | Elite Funding Solutions',
  description: 'Contact Elite Funding Solutions for business funding questions, application support, documentation guidance, and partner-network funding options.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return <ContactForm />;
}
