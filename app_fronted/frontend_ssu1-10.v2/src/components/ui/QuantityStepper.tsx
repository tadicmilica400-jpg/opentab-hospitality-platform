interface QuantityStepperProps {
  value: number;
  onMinus: () => void;
  onPlus: () => void;
  min?: number;
}

export default function QuantityStepper({ value, onMinus, onPlus, min = 1 }: QuantityStepperProps) {
  return (
    <div className="quantity-stepper">
      <button className="qty-btn minus" type="button" onClick={onMinus} disabled={value <= min} aria-label="Smanji količinu">−</button>
      <span className="qty-value">{value}</span>
      <button className="qty-btn plus" type="button" onClick={onPlus} aria-label="Povećaj količinu">+</button>
    </div>
  );
}
