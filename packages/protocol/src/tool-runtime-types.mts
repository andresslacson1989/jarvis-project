export type ToolSchemaValidator = (value: unknown) => Readonly<Record<string, unknown>>;

export class ToolSchemaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolSchemaValidationError";
  }
}

export class ToolSchemaRegistry {
  private readonly validators = new Map<string, ToolSchemaValidator>();

  register(schemaId: string, validator: ToolSchemaValidator): void {
    if (this.validators.has(schemaId)) throw new Error(`schema already registered: ${schemaId}`);
    this.validators.set(schemaId, validator);
  }

  validate(schemaId: string, value: unknown): Readonly<Record<string, unknown>> {
    const validator = this.validators.get(schemaId);
    if (validator === undefined) throw new ToolSchemaValidationError(`schema is not registered: ${schemaId}`);
    try {
      return Object.freeze(validator(value));
    } catch (error) {
      if (error instanceof ToolSchemaValidationError) throw error;
      throw new ToolSchemaValidationError("tool schema validation failed");
    }
  }
}
