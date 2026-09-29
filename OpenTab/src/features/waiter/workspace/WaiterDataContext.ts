// Autori: Milica Tadić ([student ID omitted], SSU11-15), Boško Trifunović ([student ID omitted], SSU16-20)
import { createContext } from "react";
import type { WaiterDataContextValue } from "./WaiterDataProvider";

export const WaiterDataContext = createContext<WaiterDataContextValue | null>(null);
