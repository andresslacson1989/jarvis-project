//! Independent Rust verification of the deterministic TypeScript backup vectors.

#[cfg(test)]
mod tests {
    use aes_gcm::aead::AeadInPlace;
    use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
    use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
    use hmac::{Hmac, Mac};
    use serde_json::Value;
    use sha2::{Digest, Sha256};

    const VECTOR: &str = include_str!("../../../../tests/fixtures/backup-v1-golden.json");

    fn hex_bytes(value: &str) -> Vec<u8> {
        assert!(value.len().is_multiple_of(2));
        (0..value.len())
            .step_by(2)
            .map(|index| {
                u8::from_str_radix(&value[index..index + 2], 16).expect("vector hex is valid")
            })
            .collect()
    }

    fn hex_encode(bytes: impl AsRef<[u8]>) -> String {
        bytes
            .as_ref()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect()
    }

    fn string_field<'a>(value: &'a Value, field: &str) -> &'a str {
        value[field].as_str().expect("vector field is a string")
    }

    fn canonical_descriptor(descriptor: &Value) -> String {
        format!(
            "{{\"backupId\":\"{}\",\"chunkCount\":\"{}\",\"chunkSizeBytes\":{},\"createdAt\":\"{}\",\"domain\":\"{}\",\"formatId\":\"{}\",\"formatVersion\":{},\"keySlotCount\":{},\"noncePrefix\":\"{}\",\"outerAead\":\"{}\",\"payloadManifestSha256\":\"{}\",\"plaintextBytes\":\"{}\",\"protectionClass\":\"{}\"}}",
            string_field(descriptor, "backupId"),
            string_field(descriptor, "chunkCount"),
            descriptor["chunkSizeBytes"]
                .as_u64()
                .expect("chunk size is numeric"),
            string_field(descriptor, "createdAt"),
            string_field(descriptor, "domain"),
            string_field(descriptor, "formatId"),
            descriptor["formatVersion"]
                .as_u64()
                .expect("format version is numeric"),
            descriptor["keySlotCount"]
                .as_u64()
                .expect("slot count is numeric"),
            string_field(descriptor, "noncePrefix"),
            string_field(descriptor, "outerAead"),
            string_field(descriptor, "payloadManifestSha256"),
            string_field(descriptor, "plaintextBytes"),
            string_field(descriptor, "protectionClass"),
        )
    }

    fn chunk_aad(
        descriptor: &Value,
        descriptor_sha256: &str,
        index: &str,
        plaintext_length: usize,
    ) -> String {
        format!(
            "{{\"backupId\":\"{}\",\"chunkCount\":\"{}\",\"chunkIndex\":\"{}\",\"descriptorSha256\":\"{}\",\"domain\":\"jarvis.backup.chunk.v1\",\"plaintextLength\":{}}}",
            string_field(descriptor, "backupId"),
            string_field(descriptor, "chunkCount"),
            index,
            descriptor_sha256,
            plaintext_length,
        )
    }

    fn recovery_slot_aad(descriptor: &Value, descriptor_sha256: &str, slot_id: &str) -> String {
        format!(
            "{{\"backupId\":\"{}\",\"descriptorSha256\":\"{}\",\"domain\":\"jarvis.backup.keyslot.v1\",\"slotId\":\"{}\",\"slotType\":\"GENERATED_RECOVERY_V1\",\"wrapAead\":\"AES_256_GCM\"}}",
            string_field(descriptor, "backupId"),
            descriptor_sha256,
            slot_id,
        )
    }

    fn hkdf_sha256(ikm: &[u8], salt: &[u8], info: &[u8]) -> [u8; 32] {
        type HmacSha256 = Hmac<Sha256>;
        let mut extract = <HmacSha256 as Mac>::new_from_slice(salt).expect("HKDF salt is valid");
        extract.update(ikm);
        let pseudorandom_key = extract.finalize().into_bytes();
        let mut expand =
            <HmacSha256 as Mac>::new_from_slice(&pseudorandom_key).expect("HKDF PRK is valid");
        expand.update(info);
        expand.update(&[1]);
        let output = expand.finalize().into_bytes();
        output.into()
    }

    #[test]
    fn rust_reproduces_typescript_backup_golden_vectors() {
        let vector: Value = serde_json::from_str(VECTOR).expect("golden vector JSON is valid");
        assert_eq!(vector["version"].as_u64(), Some(1));
        let descriptor = &vector["descriptor"];
        let canonical = canonical_descriptor(descriptor);
        assert_eq!(canonical, string_field(&vector, "descriptorCanonicalUtf8"));
        let descriptor_digest = Sha256::digest(canonical.as_bytes());
        assert_eq!(
            hex_encode(descriptor_digest),
            string_field(&vector, "descriptorSha256Hex")
        );
        let descriptor_sha256 = URL_SAFE_NO_PAD.encode(descriptor_digest);
        let key = hex_bytes(string_field(&vector, "keyHex"));
        let nonce_prefix = hex_bytes(string_field(&vector, "noncePrefixHex"));
        let mut plaintext = vec![
            0u8;
            descriptor["plaintextBytes"]
                .as_str()
                .expect("plaintext length is text")
                .parse()
                .expect("plaintext length is bounded")
        ];
        for (index, byte) in plaintext.iter_mut().enumerate() {
            *byte = (index % 251) as u8;
        }

        let cipher = Aes256Gcm::new_from_slice(&key).expect("AES-256 key is valid");
        for (chunk_index, expected) in vector["chunks"]
            .as_array()
            .expect("chunks are an array")
            .iter()
            .enumerate()
        {
            let plaintext_length = expected["plaintextLength"]
                .as_u64()
                .expect("chunk length is numeric") as usize;
            let start = chunk_index * 4_194_304;
            let mut ciphertext = plaintext[start..start + plaintext_length].to_vec();
            let mut nonce_bytes = [0u8; 12];
            nonce_bytes[..4].copy_from_slice(&nonce_prefix);
            nonce_bytes[4..].copy_from_slice(&(chunk_index as u64).to_be_bytes());
            let aad = chunk_aad(
                descriptor,
                &descriptor_sha256,
                string_field(expected, "index"),
                plaintext_length,
            );
            assert_eq!(aad, string_field(expected, "aadCanonicalUtf8"));
            let tag = cipher
                .encrypt_in_place_detached(
                    Nonce::from_slice(&nonce_bytes),
                    aad.as_bytes(),
                    &mut ciphertext,
                )
                .expect("AES-GCM vector encryption succeeds");
            ciphertext.extend_from_slice(&tag);
            assert_eq!(hex_encode(nonce_bytes), string_field(expected, "nonceHex"));
            assert_eq!(
                hex_encode(Sha256::digest(&ciphertext)),
                string_field(expected, "ciphertextSha256Hex")
            );
        }

        let recovery_secret = hex_bytes(string_field(&vector, "recoverySecretHex"));
        let slot = &vector["recoverySlot"];
        let slot_id = string_field(slot, "slotId");
        let kek = hkdf_sha256(
            &recovery_secret,
            &descriptor_digest,
            format!("jarvis.backup.generated-recovery.v1/{slot_id}").as_bytes(),
        );
        let mut wrapped = hex_bytes(string_field(slot, "wrappedBackupDekHex"));
        let tag = hex_bytes(string_field(slot, "tagHex"));
        let slot_cipher = Aes256Gcm::new_from_slice(&kek).expect("slot AES-256 key is valid");
        let slot_nonce = hex_bytes(string_field(slot, "nonceHex"));
        slot_cipher
            .decrypt_in_place_detached(
                Nonce::from_slice(&slot_nonce),
                recovery_slot_aad(descriptor, &descriptor_sha256, slot_id).as_bytes(),
                &mut wrapped,
                tag.as_slice().into(),
            )
            .expect("generated recovery slot vector decrypts");
        assert_eq!(wrapped, key);
    }
}
