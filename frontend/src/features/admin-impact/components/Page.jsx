import PageHeader from '../../../components/PageHeader';

// Shared page frame for the Admin and Impact screens: orange title band, then content on cream.
export default function Page({ title, subtitle, children }) {
  return (
    <main>
      <PageHeader title={title}>{subtitle}</PageHeader>
      <div className="mx-auto max-w-6xl px-5 py-12 md:px-10 md:py-20">{children}</div>
    </main>
  );
}
