import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { isMain, relativePath, violation, printViolations } from "./lib.mjs";

const DRAFT_2020_12 = "https://json-schema.org/draft/2020-12/schema";

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
      violations.push(
        violation(
          "SCHEMA_DRAFT_2020_12_INVALID",
          path,
          draftValidation.errors.join("; ").slice(0, 2_048),
        ),
      );
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
