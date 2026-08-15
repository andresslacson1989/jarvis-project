//! Independent Rust verification of the deterministic TypeScript authority descriptor vector.

#[cfg(test)]
mod tests {
    use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
    use serde_json::Value;
    use sha2::{Digest, Sha256};

    const VECTOR: &str = include_str!("../../../../tests/fixtures/authority-action-v1-golden.json");

    fn canonical(value: &Value) -> String {
        match value {
            Value::Null => "null".to_owned(),
            Value::Bool(value) => value.to_string(),
            Value::Number(value) => value.to_string(),
            Value::String(value) => {
                serde_json::to_string(value).expect("vector string is JSON-safe")
            }
            Value::Array(values) => format!(
                "[{}]",
                values.iter().map(canonical).collect::<Vec<_>>().join(",")
            ),
            Value::Object(values) => {
                let mut keys = values.keys().collect::<Vec<_>>();
                keys.sort();
                format!(
                    "{{{}}}",
                    keys.into_iter()
                        .map(|key| format!(
                            "{}:{}",
                            serde_json::to_string(key).expect("key is JSON-safe"),
                            canonical(&values[key])
                        ))
                        .collect::<Vec<_>>()
                        .join(","),
                )
            }
        }
    }

    fn hex_encode(bytes: impl AsRef<[u8]>) -> String {
        bytes
            .as_ref()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect()
    }

    #[test]
    fn canonical_action_descriptor_matches_ts_golden_vector() {
        let vector: Value = serde_json::from_str(VECTOR).expect("golden vector JSON is valid");
        let descriptor = &vector["descriptor"];
        let canonical_bytes = canonical(descriptor);
        assert_eq!(
            canonical_bytes,
            vector["canonicalUtf8"]
                .as_str()
                .expect("canonical vector is a string")
        );
        let digest = Sha256::digest(canonical_bytes.as_bytes());
        assert_eq!(
            hex_encode(digest),
            vector["sha256Hex"]
                .as_str()
                .expect("sha vector is a string")
        );
        assert_eq!(
            URL_SAFE_NO_PAD.encode(digest),
            vector["base64url"]
                .as_str()
                .expect("base64 vector is a string")
        );
    }
}
