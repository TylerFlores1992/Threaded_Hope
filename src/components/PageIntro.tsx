export function PageIntro({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="border-b border-border bg-sand">
      <div className="mx-auto max-w-4xl px-4 py-14 text-center">
        <h1 className="font-serif text-4xl text-ink">{title}</h1>
        {subtitle && (
          <p className="mx-auto mt-3 max-w-2xl text-ink-soft">{subtitle}</p>
        )}
      </div>
    </header>
  );
}
