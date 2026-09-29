export type PaymentMode = "cash" | "card" | "split";

export type CheckoutLine = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  paid: boolean;
};
