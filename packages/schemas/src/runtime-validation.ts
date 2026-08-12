/** Vendor-neutral runtime validation contract for canonical boundary schemas. */
export interface SchemaValidationIssue {
  readonly instancePath: string;
  readonly schemaPath: string;
  readonly keyword: string;
  readonly message: string;
}

export type SchemaValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly SchemaValidationIssue[] };

/**
 * Inputs cross trust/process boundaries as unknown and become typed values only
 * after a concrete validator returns an `ok: true` result. Implementations must
 * not use coercion for security material or exact-money fields, must enforce the
 * declared Draft 2020-12 format assertions (including `date-time`), and must
 * preserve bounded validation diagnostics rather than leaking raw inputs.
 */
export interface RuntimeSchemaValidator<T> {
  readonly schemaId: string;
  validate(input: unknown): SchemaValidationResult<T>;
}
