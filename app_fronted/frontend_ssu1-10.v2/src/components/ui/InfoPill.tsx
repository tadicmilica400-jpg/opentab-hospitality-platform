export default function InfoPill({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`info-pill ${className}`}>
      <span className="info-label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  );
}
