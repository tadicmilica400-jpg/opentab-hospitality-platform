export default function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="section-title">
      <span>{title}</span>
      {subtitle && <small>{subtitle}</small>}
    </div>
  );
}
