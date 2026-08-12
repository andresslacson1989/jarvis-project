export type DataSensitivity = "PUBLIC" | "PRIVATE" | "SENSITIVE" | "SECRET";
export type DataLocality = "LOCAL_ONLY" | "ANY_APPROVED_PROVIDER";

export interface DataPolicy {
  sensitivity: DataSensitivity;
  locality: DataLocality;
}

export interface MoneyAmount {
  currency: string;
  nanoUnits: string;
}

export type CanonicalQuantity = string;
