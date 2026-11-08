import { PhoneArt } from '@/components/PhoneArt';
import { Seo } from '@/components/Seo';
import { LinkButton } from '@/components/ui';

export default function NotFound() {
  return (
    <section className="container flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <Seo title="Page not found" noindex />
      <PhoneArt className="h-56 w-auto -rotate-6 animate-float" color="#FF7A18" accent="#7C3AED" />
      <h1 className="mt-8 text-5xl font-extrabold text-gradient-dark">404</h1>
      <p className="mt-2 text-lg text-slate-600">This page seems to have lost its signal.</p>
      <div className="mt-6 flex gap-3">
        <LinkButton to="/">Go home</LinkButton>
        <LinkButton to="/mobiles" variant="outline">Browse mobiles</LinkButton>
      </div>
    </section>
  );
}
