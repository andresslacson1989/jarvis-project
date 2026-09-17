import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { isMain, relativePath, violation, printViolations } from "./lib.mjs";

const DRAFT_2020_12 = "https://json-schema.org/draft/2020-12/schema";
const BOOTSTRAP_IDENTITY_FIELDS = Object.freeze([
  "contractSuiteVersion",
  "releaseProfileVersion",
  "canonicalValuesId",
  "protocolMajor",
]);
const SUPPORTED_BOOTSTRAP_IDENTITY = Object.freeze({
  contractSuiteVersion: "1.0.8",
  releaseProfileVersion: "1.0.9",
  canonicalValuesId: "jarvis.contract-values.v1.0.8",
  protocolMajor: 1,
});
const BOOTSTRAP_IDENTITY_PATHS = Object.freeze({
  canonicalSchema: "packages/schemas/src/canonical/v1/contract-values.schema.json",
  canonicalValues: "packages/schemas/src/canonical/v1/jarvis-v1.0.8.contract-values.json",
  bootstrapSchema: "packages/schemas/src/config/v1/bootstrap-configuration.schema.json",
  protocolSource: "packages/protocol/src/config.ts",
});

export function validateDraft202012Schema(schema) {
  const validator = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  let valid = false;
  let thrownError;
  try {
    valid = validator.validateSchema(schema);
  } catch (error) {
    thrownError = error instanceof Error ? error.message : String(error);
  }
  return Object.freeze({
    valid,
    errors: valid
      ? []
      : thrownError
        ? [thrownError]
        : (validator.errors ?? []).map((error) => `${error.instancePath || "#"} ${error.message ?? "schema validation failed"}`),
  });
}

export function validateSchemaInstance(schema, instance) {
  const validator = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  try {
    const validate = validator.compile(schema);
    const valid = validate(instance);
    return Object.freeze({
      valid,
      errors: valid ? [] : (validate.errors ?? []).map((error) => `${error.instancePath || "#"} ${error.message ?? "instance validation failed"}`),
    });
  } catch (error) {
    return Object.freeze({ valid: false, errors: [error instanceof Error ? error.message : String(error)] });
  }
}

async function collectSchemas(current, out) {
  if (!existsSync(current)) return;
  const entries = await readdir(current, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
  for (const entry of entries) {
    const path = resolve(current, entry.name);
    if (entry.isDirectory()) await collectSchemas(path, out);
    else if (entry.isFile() && entry.name.endsWith(".schema.json")) out.push(path);
  }
}

function walkObjects(value, visit) {
  if (Array.isArray(value)) {
    for (const item of value) walkObjects(item, visit);
  } else if (value && typeof value === "object") {
    visit(value);
    for (const child of Object.values(value)) walkObjects(child, visit);
  }
}

function isBootstrapIdentityLikeField(field) {
  return field === "schemaVersion" || field === "protocolMajor" || /Version$/.test(field) || /^canonical.*Id$/.test(field);
}

function schemaIdentity(schema, path, violations) {
  const identity = {};
  const properties = schema?.properties;
  const required = schema?.required;
  if (!properties || typeof properties !== "object" || Array.isArray(properties) || !Array.isArray(required)) {
    violations.push(violation("SCHEMA_BOOTSTRAP_IDENTITY_STRUCTURE", path, "identity schema must expose object properties and a required array"));
    return identity;
  }

  for (const field of BOOTSTRAP_IDENTITY_FIELDS) {
    const property = properties[field];
    if (!property || typeof property !== "object" || Array.isArray(property) || !("const" in property) || !required.includes(field)) {
      violations.push(violation("SCHEMA_BOOTSTRAP_IDENTITY_FIELD_MISSING", path, `${field} must be required and defined by const`));
      continue;
    }
    identity[field] = property.const;
  }

  const allowedIdentityFields = new Set(["schemaVersion", ...BOOTSTRAP_IDENTITY_FIELDS]);
  for (const field of Object.keys(properties)) {
    if (isBootstrapIdentityLikeField(field) && !allowedIdentityFields.has(field)) {
      violations.push(violation("SCHEMA_BOOTSTRAP_IDENTITY_FIELD_EXTRA", path, `unsupported identity field ${field}`));
    }
  }
  return identity;
}

function canonicalIdentity(values, path, violations) {
  const identity = {};
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    violations.push(violation("SCHEMA_BOOTSTRAP_IDENTITY_STRUCTURE", path, "canonical values must be a JSON object"));
    return identity;
  }
  for (const field of BOOTSTRAP_IDENTITY_FIELDS) {
    if (!(field in values)) {
      violations.push(violation("SCHEMA_BOOTSTRAP_IDENTITY_FIELD_MISSING", path, `${field} is required`));
      continue;
    }
    identity[field] = values[field];
  }
  return identity;
}

function protocolSourceIdentity(source, path, violations) {
  const identity = {};
  const interfaceMatch = String(source).match(/export interface BootstrapConfigurationV1\s*\{([\s\S]*?)^\}/m);
  if (!interfaceMatch) {
    violations.push(violation("SCHEMA_BOOTSTRAP_PROTOCOL_SOURCE_INVALID", path, "BootstrapConfigurationV1 interface is missing or malformed"));
    return identity;
  }

  const body = interfaceMatch[1];
  for (const field of BOOTSTRAP_IDENTITY_FIELDS) {
    const fieldMatch = body.match(new RegExp(`^ {2}${field}:\\s*(?:\"([^\"\\r\\n]+)\"|([0-9]+));\\s*$`, "m"));
    if (!fieldMatch) {
      violations.push(violation("SCHEMA_BOOTSTRAP_IDENTITY_FIELD_MISSING", path, `${field} must be a top-level string or integer literal`));
      continue;
    }
    identity[field] = fieldMatch[1] ?? Number(fieldMatch[2]);
  }

  const allowedIdentityFields = new Set(["schemaVersion", ...BOOTSTRAP_IDENTITY_FIELDS]);
  for (const fieldMatch of body.matchAll(/^ {2}([A-Za-z_$][A-Za-z0-9_$]*):[^;\r\n]+;\s*$/gm)) {
    const field = fieldMatch[1];
    if (isBootstrapIdentityLikeField(field) && !allowedIdentityFields.has(field)) {
      violations.push(violation("SCHEMA_BOOTSTRAP_IDENTITY_FIELD_EXTRA", path, `unsupported identity field ${field}`));
    }
  }
  return identity;
}

function validateSupportedAndMatchingIdentities(identities, violations) {
  for (const [source, identity] of Object.entries(identities)) {
    for (const field of BOOTSTRAP_IDENTITY_FIELDS) {
      if (!(field in identity)) continue;
      if (identity[field] !== SUPPORTED_BOOTSTRAP_IDENTITY[field]) {
        violations.push(violation("SCHEMA_BOOTSTRAP_IDENTITY_UNSUPPORTED", source, `${field}=${JSON.stringify(identity[field])} is unsupported; expected ${JSON.stringify(SUPPORTED_BOOTSTRAP_IDENTITY[field])}`));
      }
    }
  }

  const canonical = identities[BOOTSTRAP_IDENTITY_PATHS.canonicalValues] ?? {};
  for (const [source, identity] of Object.entries(identities)) {
    if (source === BOOTSTRAP_IDENTITY_PATHS.canonicalValues) continue;
    for (const field of BOOTSTRAP_IDENTITY_FIELDS) {
      if (!(field in canonical) || !(field in identity)) continue;
      if (identity[field] !== canonical[field]) {
        violations.push(violation("SCHEMA_BOOTSTRAP_IDENTITY_MISMATCH", source, `${field} must match ${BOOTSTRAP_IDENTITY_PATHS.canonicalValues}`));
      }
    }
  }
}

export async function validateBootstrapIdentityArtifacts(rootDir) {
  const violations = [];
  const resolvedPaths = Object.fromEntries(Object.entries(BOOTSTRAP_IDENTITY_PATHS).map(([name, path]) => [name, resolve(rootDir, path)]));
  const presentCount = Object.values(resolvedPaths).filter((path) => existsSync(path)).length;
  if (presentCount === 0) return { violations };

  for (const [name, absolutePath] of Object.entries(resolvedPaths)) {
    if (!existsSync(absolutePath)) {
      violations.push(violation("SCHEMA_BOOTSTRAP_IDENTITY_ARTIFACT_MISSING", BOOTSTRAP_IDENTITY_PATHS[name], "required cross-file identity artifact is missing"));
    }
  }
  if (violations.length > 0) return { violations };

  let canonicalSchema;
  let canonicalValues;
  let bootstrapSchema;
  let protocolSource;
  try {
    [canonicalSchema, canonicalValues, bootstrapSchema, protocolSource] = await Promise.all([
      readFile(resolvedPaths.canonicalSchema, "utf8").then(JSON.parse),
      readFile(resolvedPaths.canonicalValues, "utf8").then(JSON.parse),
      readFile(resolvedPaths.bootstrapSchema, "utf8").then(JSON.parse),
      readFile(resolvedPaths.protocolSource, "utf8"),
    ]);
  } catch (error) {
    violations.push(violation("SCHEMA_BOOTSTRAP_IDENTITY_ARTIFACT_INVALID", "bootstrap identity artifacts", error instanceof Error ? error.message : String(error)));
    return { violations };
  }

  const identities = {
    [BOOTSTRAP_IDENTITY_PATHS.canonicalSchema]: schemaIdentity(canonicalSchema, BOOTSTRAP_IDENTITY_PATHS.canonicalSchema, violations),
    [BOOTSTRAP_IDENTITY_PATHS.canonicalValues]: canonicalIdentity(canonicalValues, BOOTSTRAP_IDENTITY_PATHS.canonicalValues, violations),
    [BOOTSTRAP_IDENTITY_PATHS.bootstrapSchema]: schemaIdentity(bootstrapSchema, BOOTSTRAP_IDENTITY_PATHS.bootstrapSchema, violations),
    [BOOTSTRAP_IDENTITY_PATHS.protocolSource]: protocolSourceIdentity(protocolSource, BOOTSTRAP_IDENTITY_PATHS.protocolSource, violations),
  };
  validateSupportedAndMatchingIdentities(identities, violations);
  return { violations };
}

export async function checkSchemas(rootDir) {
  const schemaRoot = resolve(rootDir, "packages", "schemas", "src");
  const files = [];
  await collectSchemas(schemaRoot, files);
  files.sort((a, b) => a.localeCompare(b, "en"));
  const violations = [];
  const ids = new Map();

  if (files.length === 0) {
    violations.push(violation("SCHEMA_INVENTORY_EMPTY", "packages/schemas/src", "schema inventory must not be empty"));
  }

  for (const file of files) {
    const path = relativePath(rootDir, file);
    let schema;
    try {
      schema = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      violations.push(violation("SCHEMA_INVALID_JSON", path, error instanceof Error ? error.message : String(error)));
      continue;
    }

    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
      violations.push(violation("SCHEMA_INVALID_ROOT", path, "schema root must be a JSON object"));
      continue;
    }
    if (schema.$schema !== DRAFT_2020_12) {
      violations.push(violation("SCHEMA_WRONG_DRAFT", path, `expected ${DRAFT_2020_12}`));
    }
    const draftValidation = validateDraft202012Schema(schema);
    if (!draftValidation.valid) {
      violations.push(violation("SCHEMA_DRAFT_2020_12_INVALID", path, draftValidation.errors.join("; ").slice(0, 2_048)));
    }
    if (path === "packages/schemas/src/canonical/v1/contract-values.schema.json") {
      const instancePath = resolve(schemaRoot, "canonical", "v1", "jarvis-v1.0.8.contract-values.json");
      try {
        const instance = JSON.parse(await readFile(instancePath, "utf8"));
        const instanceValidation = validateSchemaInstance(schema, instance);
        if (!instanceValidation.valid) {
          violations.push(violation("SCHEMA_CANONICAL_INSTANCE_INVALID", relativePath(rootDir, instancePath), instanceValidation.errors.join("; ").slice(0, 2_048)));
        }
      } catch (error) {
        violations.push(violation("SCHEMA_CANONICAL_INSTANCE_UNREADABLE", relativePath(rootDir, instancePath), error instanceof Error ? error.message : String(error)));
      }
    }
    if (typeof schema.$id === "string") {
      const prior = ids.get(schema.$id);
      if (prior) {
        violations.push(violation("SCHEMA_DUPLICATE_ID", path, `${schema.$id} already used by ${prior}`));
      } else {
        ids.set(schema.$id, path);
      }
    }

    walkObjects(schema, (node) => {
      if (typeof node.$ref !== "string" || node.$ref.startsWith("#") || node.$ref.includes("://")) return;
      const filePart = node.$ref.split("#", 1)[0];
      if (!filePart) return;
      const target = resolve(dirname(file), filePart);
      const relativeTarget = relative(schemaRoot, target);
      const escapes = relativeTarget === ".." || relativeTarget.startsWith(`..${sep}`) || relativeTarget.includes(`${sep}..${sep}`);
      if (escapes) {
        violations.push(violation("SCHEMA_REF_ESCAPE", path, `local $ref escapes schema root: ${node.$ref}`));
      } else if (!existsSync(target)) {
        violations.push(violation("SCHEMA_UNRESOLVED_REF", path, `unresolved local $ref: ${node.$ref}`));
      }
    });
  }

  const bootstrapIdentity = await validateBootstrapIdentityArtifacts(rootDir);
  violations.push(...bootstrapIdentity.violations);

  return { schemaCount: files.length, uniqueIdCount: ids.size, violations };
}

if (isMain(import.meta.url)) {
  const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const result = await checkSchemas(rootDir);
  if (result.violations.length > 0) {
    printViolations("schema", result.violations);
    process.exit(1);
  }
  console.log(`[schema] PASS schemas=${result.schemaCount} uniqueIds=${result.uniqueIdCount}`);
}
