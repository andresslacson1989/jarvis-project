//! Bounded JARVIS Argon2id profiles for the Windows FULL_HOST.
//!
//! This module owns the qualified derivation boundary.  Callers provide a
//! profile and transient secret bytes; no password, recovery secret, salt, or
//! derived output is persisted here.  Profile validation happens before the
//! Argon2 implementation receives any attacker-controlled parameter.

use argon2::{Algorithm, Argon2, Params, Version};

const ARGON2ID_VERSION: u32 = 0x13;
const PARALLELISM: u32 = 4;
const SESSION_MEMORY_KIB: u32 = 65_536;
const PORTABLE_BACKUP_MEMORY_KIB: u32 = 262_144;
const MIN_MEMORY_KIB: u32 = 65_536;
const MAX_MEMORY_KIB: u32 = 4_194_304;
const MIN_ITERATIONS: u32 = 3;
const MAX_ITERATIONS: u32 = 100;
const MIN_SALT_BYTES: usize = 16;
const MAX_SALT_BYTES: usize = 1_024;
const MIN_OUTPUT_BYTES: usize = 32;
const MAX_OUTPUT_BYTES: usize = 1_024;
const MAX_PROFILE_ID_BYTES: usize = 128;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum KdfPurpose {
    SessionPassword,
    PortableRecovery,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Argon2idProfile {
    pub profile_id: String,
    pub purpose: KdfPurpose,
    pub version: u32,
    pub memory_kib: u32,
    pub iterations: u32,
    pub parallelism: u32,
    pub salt_bytes: usize,
    pub output_bytes: usize,
}

impl Argon2idProfile {
    pub fn session_password() -> Self {
        Self {
            profile_id: "session-password-v1".to_owned(),
            purpose: KdfPurpose::SessionPassword,
            version: ARGON2ID_VERSION,
            memory_kib: SESSION_MEMORY_KIB,
            iterations: MIN_ITERATIONS,
            parallelism: PARALLELISM,
            salt_bytes: MIN_SALT_BYTES,
            output_bytes: MIN_OUTPUT_BYTES,
        }
    }

    pub fn portable_recovery() -> Self {
        Self {
            profile_id: "portable-recovery-v1".to_owned(),
            purpose: KdfPurpose::PortableRecovery,
            version: ARGON2ID_VERSION,
            memory_kib: SESSION_MEMORY_KIB,
            iterations: MIN_ITERATIONS,
            parallelism: PARALLELISM,
            salt_bytes: MIN_SALT_BYTES,
            output_bytes: MIN_OUTPUT_BYTES,
        }
    }

    pub fn portable_backup_passphrase() -> Self {
        Self {
            profile_id: "portable-backup-passphrase-v1".to_owned(),
            purpose: KdfPurpose::PortableRecovery,
            version: ARGON2ID_VERSION,
            memory_kib: PORTABLE_BACKUP_MEMORY_KIB,
            iterations: MIN_ITERATIONS,
            parallelism: PARALLELISM,
            salt_bytes: MIN_SALT_BYTES,
            output_bytes: MIN_OUTPUT_BYTES,
        }
    }

    pub fn persisted_session_password(
        profile_id: &str,
        memory_kib: u32,
        iterations: u32,
        parallelism: u32,
        salt_bytes: usize,
        output_bytes: usize,
    ) -> Result<Self, KdfError> {
        let profile = Self {
            profile_id: profile_id.to_owned(),
            purpose: KdfPurpose::SessionPassword,
            version: ARGON2ID_VERSION,
            memory_kib,
            iterations,
            parallelism,
            salt_bytes,
            output_bytes,
        };
        if profile.profile_id != "session-password-v1" {
            return Err(KdfError::InvalidProfile(
                "session-password profile identity is unsupported",
            ));
        }
        profile.validate()?;
        Ok(profile)
    }

    pub fn validate(&self) -> Result<(), KdfError> {
        if self.profile_id.is_empty()
            || self.profile_id.len() > MAX_PROFILE_ID_BYTES
            || !self
                .profile_id
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
        {
            return Err(KdfError::InvalidProfile(
                "profile id is not bounded and canonical",
            ));
        }
        if self.version != ARGON2ID_VERSION {
            return Err(KdfError::InvalidProfile("Argon2id version is not 0x13"));
        }
        if !(MIN_MEMORY_KIB..=MAX_MEMORY_KIB).contains(&self.memory_kib) {
            return Err(KdfError::InvalidProfile(
                "memoryKiB is outside the approved bounds",
            ));
        }
        if !(MIN_ITERATIONS..=MAX_ITERATIONS).contains(&self.iterations) {
            return Err(KdfError::InvalidProfile(
                "iterations are outside the approved bounds",
            ));
        }
        if self.parallelism != PARALLELISM {
            return Err(KdfError::InvalidProfile("parallelism must equal 4"));
        }
        if !(MIN_SALT_BYTES..=MAX_SALT_BYTES).contains(&self.salt_bytes) {
            return Err(KdfError::InvalidProfile(
                "saltBytes is outside the approved bounds",
            ));
        }
        if !(MIN_OUTPUT_BYTES..=MAX_OUTPUT_BYTES).contains(&self.output_bytes) {
            return Err(KdfError::InvalidProfile(
                "outputBytes is outside the approved bounds",
            ));
        }
        Ok(())
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum KdfError {
    InvalidProfile(&'static str),
    InvalidSaltLength { expected: usize, actual: usize },
    NativeRandomFailure(u32),
    DerivationFailure,
}

impl std::fmt::Display for KdfError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidProfile(detail) => write!(formatter, "invalid Argon2id profile: {detail}"),
            Self::InvalidSaltLength { expected, actual } => {
                write!(
                    formatter,
                    "invalid Argon2id salt length: expected {expected}, got {actual}"
                )
            }
            Self::NativeRandomFailure(code) => {
                write!(formatter, "Windows CSPRNG failed with status {code}")
            }
            Self::DerivationFailure => write!(formatter, "Argon2id derivation failed"),
        }
    }
}

impl std::error::Error for KdfError {}

pub fn generate_salt(profile: &Argon2idProfile) -> Result<Vec<u8>, KdfError> {
    profile.validate()?;
    let mut salt = vec![0_u8; profile.salt_bytes];
    fill_random(&mut salt)?;
    Ok(salt)
}

pub fn derive_argon2id(
    profile: &Argon2idProfile,
    secret: &[u8],
    salt: &[u8],
) -> Result<Vec<u8>, KdfError> {
    profile.validate()?;
    if salt.len() != profile.salt_bytes {
        return Err(KdfError::InvalidSaltLength {
            expected: profile.salt_bytes,
            actual: salt.len(),
        });
    }
    let params = Params::new(
        profile.memory_kib,
        profile.iterations,
        profile.parallelism,
        Some(profile.output_bytes),
    )
    .map_err(|_| KdfError::InvalidProfile("Argon2id parameters were rejected"))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut output = vec![0_u8; profile.output_bytes];
    argon2
        .hash_password_into(secret, salt, &mut output)
        .map_err(|_| KdfError::DerivationFailure)?;
    Ok(output)
}

pub fn constant_time_equal(left: &[u8], right: &[u8]) -> bool {
    let mut difference = (left.len() ^ right.len()) as u8;
    let max = left.len().max(right.len());
    for index in 0..max {
        let left_byte = left.get(index).copied().unwrap_or(0);
        let right_byte = right.get(index).copied().unwrap_or(0);
        difference |= left_byte ^ right_byte;
    }
    difference == 0
}

#[cfg(windows)]
fn fill_random(bytes: &mut [u8]) -> Result<(), KdfError> {
    use windows_sys::Win32::Security::Cryptography::{
        BCRYPT_USE_SYSTEM_PREFERRED_RNG, BCryptGenRandom,
    };
    // SAFETY: BCryptGenRandom writes only to the valid mutable buffer passed
    // with its exact bounded length and uses the system-preferred CSPRNG.
    let status = unsafe {
        BCryptGenRandom(
            std::ptr::null_mut(),
            bytes.as_mut_ptr(),
            bytes.len() as u32,
            BCRYPT_USE_SYSTEM_PREFERRED_RNG,
        )
    };
    if status == 0 {
        Ok(())
    } else {
        Err(KdfError::NativeRandomFailure(status as u32))
    }
}

#[cfg(not(windows))]
fn fill_random(_bytes: &mut [u8]) -> Result<(), KdfError> {
    Err(KdfError::NativeRandomFailure(1))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn approved_profiles_match_contract_floors() {
        let session = Argon2idProfile::session_password();
        assert_eq!(session.memory_kib, 65_536);
        assert_eq!(session.iterations, 3);
        assert_eq!(session.parallelism, 4);
        assert_eq!(session.salt_bytes, 16);
        assert_eq!(session.output_bytes, 32);
        assert_eq!(session.version, 0x13);
        assert!(session.validate().is_ok());

        let portable = Argon2idProfile::portable_backup_passphrase();
        assert_eq!(portable.memory_kib, 262_144);
        assert!(portable.validate().is_ok());
    }

    #[test]
    fn under_floor_and_unsafe_profiles_are_rejected() {
        let mut profile = Argon2idProfile::session_password();
        profile.memory_kib = 65_535;
        assert!(profile.validate().is_err());
        profile = Argon2idProfile::session_password();
        profile.iterations = 2;
        assert!(profile.validate().is_err());
        profile = Argon2idProfile::session_password();
        profile.parallelism = 3;
        assert!(profile.validate().is_err());
        profile = Argon2idProfile::session_password();
        profile.salt_bytes = 15;
        assert!(profile.validate().is_err());
        profile = Argon2idProfile::session_password();
        profile.output_bytes = 31;
        assert!(profile.validate().is_err());
        profile = Argon2idProfile::session_password();
        profile.memory_kib = MAX_MEMORY_KIB + 1;
        assert!(profile.validate().is_err());
    }

    #[test]
    fn derivation_is_deterministic_and_salt_bound() {
        let profile = Argon2idProfile::session_password();
        let salt = [0x42_u8; 16];
        let first = derive_argon2id(&profile, b"test-only-secret", &salt)
            .expect("contract-floor derivation must succeed");
        let second =
            derive_argon2id(&profile, b"test-only-secret", &salt).expect("same inputs must derive");
        assert_eq!(first, second);
        let changed_salt = [0x43_u8; 16];
        let changed = derive_argon2id(&profile, b"test-only-secret", &changed_salt)
            .expect("changed salt must derive");
        assert_ne!(first, changed);
        assert_eq!(first.len(), 32);
    }

    #[test]
    fn generated_salt_matches_profile_and_is_not_constant() {
        let profile = Argon2idProfile::session_password();
        let first = generate_salt(&profile).expect("Windows CSPRNG must be available");
        let second = generate_salt(&profile).expect("Windows CSPRNG must be available");
        assert_eq!(first.len(), 16);
        assert_ne!(first, second);
    }

    #[test]
    fn persisted_session_profile_is_revalidated_before_derivation() {
        let profile = Argon2idProfile::persisted_session_password(
            "session-password-v1",
            65_536,
            3,
            4,
            16,
            32,
        )
        .expect("qualified persisted profile must be accepted");
        let derived = derive_argon2id(&profile, b"test-only-secret", &[0x42; 16])
            .expect("qualified persisted profile must derive");
        assert!(constant_time_equal(&derived, &derived));
        assert!(!constant_time_equal(&derived, &[0; 32]));
        assert!(
            Argon2idProfile::persisted_session_password("other-profile", 65_536, 3, 4, 16, 32)
                .is_err()
        );
        assert!(
            Argon2idProfile::persisted_session_password(
                "session-password-v1",
                65_535,
                3,
                4,
                16,
                32
            )
            .is_err()
        );
    }
}
