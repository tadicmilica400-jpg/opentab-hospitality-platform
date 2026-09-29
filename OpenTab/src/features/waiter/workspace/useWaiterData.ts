// Autori: Milica Tadić ([student ID omitted], SSU11-15), Boško Trifunović ([student ID omitted], SSU16-20)
import { useContext } from "react";
import { WaiterDataContext } from "./WaiterDataContext";

export function useWaiterData() {
  const value = useContext(WaiterDataContext);

  if (!value) {
    throw new Error("useWaiterData must be used inside WaiterDataProvider");
  }

  return value;
}
