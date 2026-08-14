//! Windows V1 PlatformLocalIpc endpoint.
//!
//! This module owns the native endpoint/security boundary and the bounded
//! bootstrap handshake. A connected peer is not trusted merely because
//! Windows allowed it through the DACL/session gate.

use std::error::Error;
use std::fmt::{Display, Formatter};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const IPC_PROTOCOL_MAJOR: u32 = 1;
pub const MAX_IPC_FRAME_BYTES: usize = 1024 * 1024;
const MAX_BOOTSTRAP_FRAME_BYTES: usize = 64 * 1024;
const BOOTSTRAP_SECRET_BYTES: usize = 32;
const BOOTSTRAP_DATABASE_DEK_BYTES: usize = 32;
const HANDSHAKE_NONCE_BYTES: usize = 32;
const MAX_SESSION_PASSWORD_BYTES: usize = 4096;
const MAX_LOCAL_BACKUP_SLOT_BYTES: usize = 64 * 1024;
const HMAC_BLOCK_BYTES: usize = 64;
const HANDSHAKE_DOMAIN: &[u8] = b"JARVIS-CORE-IPC-BOOTSTRAP-V1\0";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LocalIpcState {
    UnsupportedPlatform,
    RandomnessFailed,
    IdentityFailed,
    SecurityDescriptorFailed,
    EndpointCreationFailed,
    ClientConnectionFailed,
    ClientSessionRejected,
    ClientSessionInspectionFailed,
    BootstrapEncodingFailed,
    BootstrapChannelFailed,
    FrameTooLarge,
    FrameMalformed,
    ProtocolMismatch,
    AuthenticationFailed,
    HandshakeTimeout,
    ControlPlaneRequestFailed,
    ControlPlaneResponseInvalid,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalIpcError {
    pub state: LocalIpcState,
    pub detail: String,
    pub win32_error: Option<u32>,
}

impl Display for LocalIpcError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        if let Some(win32_error) = self.win32_error {
            write!(
                formatter,
                "{:?}: {} (Win32 error {})",
                self.state, self.detail, win32_error
            )
        } else {
            write!(formatter, "{:?}: {}", self.state, self.detail)
        }
    }
}

impl Error for LocalIpcError {}

/// Bootstrap material is deliberately opaque in diagnostics. The secret is
/// transferred only through the inherited anonymous channel and is never part
/// of a command line, normal environment value, or log message.
#[derive(Clone, PartialEq, Eq)]
pub struct BootstrapMaterial {
    endpoint_name: String,
    secret: [u8; BOOTSTRAP_SECRET_BYTES],
    database_dek: [u8; BOOTSTRAP_DATABASE_DEK_BYTES],
    secure_storage_endpoint: String,
    secure_storage_secret: [u8; BOOTSTRAP_SECRET_BYTES],
    protocol_major: u32,
}

impl std::fmt::Debug for BootstrapMaterial {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("BootstrapMaterial")
            .field("endpoint_name", &self.endpoint_name)
            .field("protocol_major", &self.protocol_major)
            .field("secret", &"<redacted>")
            .field("database_dek", &"<redacted>")
            .field("secure_storage_endpoint", &self.secure_storage_endpoint)
            .field("secure_storage_secret", &"<redacted>")
            .finish()
    }
}

impl BootstrapMaterial {
    #[cfg(windows)]
    fn new(endpoint_name: &str, database_dek: &[u8; BOOTSTRAP_DATABASE_DEK_BYTES]) -> Result<Self, LocalIpcError> {
        let secret = windows::random_bytes::<BOOTSTRAP_SECRET_BYTES>()?;
        Ok(Self {
            endpoint_name: endpoint_name.to_owned(),
            secret,
            database_dek: *database_dek,
            secure_storage_endpoint: endpoint_name.to_owned(),
            secure_storage_secret: secret,
            protocol_major: IPC_PROTOCOL_MAJOR,
        })
    }

    #[cfg(test)]
    fn from_test_parts(endpoint_name: &str, secret: [u8; BOOTSTRAP_SECRET_BYTES]) -> Self {
        Self {
            endpoint_name: endpoint_name.to_owned(),
            secret,
            database_dek: [0; BOOTSTRAP_DATABASE_DEK_BYTES],
            secure_storage_endpoint: endpoint_name.to_owned(),
            secure_storage_secret: secret,
            protocol_major: IPC_PROTOCOL_MAJOR,
        }
    }

    fn with_secure_storage(mut self, secure_storage: &Self) -> Self {
        self.secure_storage_endpoint = secure_storage.endpoint_name.clone();
        self.secure_storage_secret = secure_storage.secret;
        self
    }

    pub fn endpoint_name(&self) -> &str {
        &self.endpoint_name
    }

    pub fn protocol_major(&self) -> u32 {
        self.protocol_major
    }

    fn encode_frame(&self) -> Result<Vec<u8>, LocalIpcError> {
        let wire = BootstrapWire {
            protocol_major: self.protocol_major,
            endpoint: self.endpoint_name.clone(),
            secret: hex_encode(&self.secret),
            database_dek: hex_encode(&self.database_dek),
            secure_storage_endpoint: self.secure_storage_endpoint.clone(),
            secure_storage_secret: hex_encode(&self.secure_storage_secret),
        };
        let payload = serde_json::to_vec(&wire).map_err(|_| LocalIpcError {
            state: LocalIpcState::BootstrapEncodingFailed,
            detail: "bootstrap material could not be encoded".to_owned(),
            win32_error: None,
        })?;
        encode_frame(&payload, MAX_BOOTSTRAP_FRAME_BYTES)
    }

    #[cfg(test)]
    pub fn encode_frame_for_test(&self) -> Result<Vec<u8>, LocalIpcError> {
        self.encode_frame()
    }

    fn secret(&self) -> &[u8; BOOTSTRAP_SECRET_BYTES] {
        &self.secret
    }

    pub fn database_dek(&self) -> &[u8; BOOTSTRAP_DATABASE_DEK_BYTES] {
        &self.database_dek
    }

    pub fn secure_storage_endpoint(&self) -> &str {
        &self.secure_storage_endpoint
    }

    pub fn secure_storage_secret(&self) -> &[u8; BOOTSTRAP_SECRET_BYTES] {
        &self.secure_storage_secret
    }
}

impl Drop for BootstrapMaterial {
    fn drop(&mut self) {
        self.secret.fill(0);
        self.database_dek.fill(0);
        self.secure_storage_secret.fill(0);
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AuthenticatedCoreSession {
    pub protocol_major: u32,
    pub session_id: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthenticatedCoreStatus {
    pub protocol_major: u32,
    pub platform: &'static str,
    pub runtime_role: &'static str,
    pub architecture: &'static str,
    pub service_state: &'static str,
    pub transport_state: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SecureStorageProtectionRequest {
    pub correlation_id: String,
    pub database_dek: [u8; BOOTSTRAP_DATABASE_DEK_BYTES],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalBackupDekProtectionRequest {
    pub correlation_id: String,
    pub backup_dek: [u8; BOOTSTRAP_DATABASE_DEK_BYTES],
    pub descriptor_digest: [u8; 32],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalBackupDekUnprotectionRequest {
    pub correlation_id: String,
    pub protected_backup_dek: Vec<u8>,
    pub descriptor_digest: [u8; 32],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SecureStorageHandleOperationRequest {
    pub operation: String,
    pub correlation_id: String,
    pub handle: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionPasswordDerivationRequest {
    pub correlation_id: String,
    pub password: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionPasswordVerifier {
    pub profile_id: String,
    pub algorithm: String,
    pub version: u32,
    pub memory_kib: u32,
    pub iterations: u32,
    pub parallelism: u32,
    pub salt: Vec<u8>,
    pub verifier: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SecureStorageOperation {
    Protect(SecureStorageProtectionRequest),
    ProtectLocalBackupDek(LocalBackupDekProtectionRequest),
    UnprotectLocalBackupDek(LocalBackupDekUnprotectionRequest),
    Commit(SecureStorageHandleOperationRequest),
    Abort(SecureStorageHandleOperationRequest),
    DeriveSessionPassword(SessionPasswordDerivationRequest),
}

impl Drop for SessionPasswordDerivationRequest {
    fn drop(&mut self) {
        self.password.fill(0);
    }
}

impl Drop for LocalBackupDekProtectionRequest {
    fn drop(&mut self) {
        self.backup_dek.fill(0);
        self.descriptor_digest.fill(0);
    }
}

impl Drop for LocalBackupDekUnprotectionRequest {
    fn drop(&mut self) {
        self.protected_backup_dek.fill(0);
        self.descriptor_digest.fill(0);
    }
}

impl Drop for SessionPasswordVerifier {
    fn drop(&mut self) {
        self.salt.fill(0);
        self.verifier.fill(0);
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BootstrapWire {
    protocol_major: u32,
    endpoint: String,
    secret: String,
    database_dek: String,
    secure_storage_endpoint: String,
    secure_storage_secret: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ChallengeWire {
    kind: String,
    protocol_major: u32,
    supported_protocol_majors: Vec<u32>,
    nonce: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct HelloWire {
    kind: String,
    protocol_major: u32,
    proof: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WelcomeWire {
    kind: String,
    protocol_major: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CoreStatusRequestWire {
    protocol_version: u32,
    kind: &'static str,
    id: Option<&'static str>,
    name: &'static str,
    correlation_id: String,
    payload: EmptyPayloadWire,
}

#[derive(Debug, Serialize)]
#[serde(deny_unknown_fields)]
struct EmptyPayloadWire {}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CoreStatusResponseWire {
    ok: bool,
    result: Option<CoreStatusResultWire>,
    error: Option<CoreStatusErrorWire>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CoreStatusResultWire {
    protocol_major: u32,
    platform: String,
    runtime_role: String,
    architecture: String,
    service_state: String,
    transport_state: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CoreStatusErrorWire {
    code: String,
    category: String,
    message: String,
    retryable: bool,
    correlation_id: String,
    details: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SecureStorageProtectionRequestWire {
    protocol_version: u32,
    kind: String,
    operation: String,
    correlation_id: String,
    database_dek: String,
    proof: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LocalBackupDekProtectionRequestWire {
    protocol_version: u32,
    kind: String,
    operation: String,
    correlation_id: String,
    backup_dek: String,
    descriptor_digest: String,
    proof: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LocalBackupDekUnprotectionRequestWire {
    protocol_version: u32,
    kind: String,
    operation: String,
    correlation_id: String,
    protected_backup_dek: String,
    descriptor_digest: String,
    proof: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SecureStorageHandleOperationRequestWire {
    protocol_version: u32,
    kind: String,
    operation: String,
    correlation_id: String,
    handle: String,
    proof: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SessionPasswordDerivationRequestWire {
    protocol_version: u32,
    kind: String,
    operation: String,
    correlation_id: String,
    password: String,
    proof: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SecureStorageProtectionResponseWire {
    ok: bool,
    correlation_id: String,
    handle: Option<String>,
    error_code: Option<&'static str>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalBackupDekResponseWire {
    ok: bool,
    correlation_id: String,
    operation: &'static str,
    protected_backup_dek: Option<String>,
    backup_dek: Option<String>,
    error_code: Option<&'static str>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionPasswordVerifierResponseWire {
    ok: bool,
    correlation_id: String,
    profile_id: Option<String>,
    algorithm: Option<String>,
    version: Option<u32>,
    #[serde(rename = "memoryKiB")]
    memory_kib: Option<u32>,
    iterations: Option<u32>,
    parallelism: Option<u32>,
    salt: Option<String>,
    verifier: Option<String>,
    error_code: Option<&'static str>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SecureStorageResponseAckWire {
    kind: String,
    correlation_id: String,
}

fn encode_frame(payload: &[u8], ceiling: usize) -> Result<Vec<u8>, LocalIpcError> {
    if payload.len() > ceiling || payload.len() > u32::MAX as usize {
        return Err(LocalIpcError {
            state: LocalIpcState::FrameTooLarge,
            detail: "IPC frame exceeds the bounded protocol ceiling".to_owned(),
            win32_error: None,
        });
    }
    let mut frame = Vec::with_capacity(4 + payload.len());
    frame.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    frame.extend_from_slice(payload);
    Ok(frame)
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut result = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        use std::fmt::Write;
        write!(&mut result, "{byte:02x}").expect("writing to String cannot fail");
    }
    result
}

fn hex_decode(value: &str, expected_bytes: usize) -> Option<Vec<u8>> {
    if value.len() != expected_bytes * 2 || !value.is_ascii() {
        return None;
    }
    let bytes = value.as_bytes();
    let mut result = Vec::with_capacity(expected_bytes);
    for pair in bytes.chunks_exact(2) {
        let high = (pair[0] as char).to_digit(16)? as u8;
        let low = (pair[1] as char).to_digit(16)? as u8;
        result.push((high << 4) | low);
    }
    Some(result)
}

fn hmac_sha256(key: &[u8], message: &[u8]) -> [u8; 32] {
    let mut normalized_key = [0u8; HMAC_BLOCK_BYTES];
    if key.len() > HMAC_BLOCK_BYTES {
        normalized_key[..32].copy_from_slice(&Sha256::digest(key));
    } else {
        normalized_key[..key.len()].copy_from_slice(key);
    }
    let mut inner = [0u8; HMAC_BLOCK_BYTES];
    let mut outer = [0u8; HMAC_BLOCK_BYTES];
    for index in 0..HMAC_BLOCK_BYTES {
        inner[index] = normalized_key[index] ^ 0x36;
        outer[index] = normalized_key[index] ^ 0x5c;
    }
    let mut inner_hash = Sha256::new();
    inner_hash.update(inner);
    inner_hash.update(message);
    let inner_digest = inner_hash.finalize();
    let mut outer_hash = Sha256::new();
    outer_hash.update(outer);
    outer_hash.update(inner_digest);
    outer_hash.finalize().into()
}

fn handshake_proof(secret: &[u8], protocol_major: u32, nonce: &[u8]) -> [u8; 32] {
    let mut message = Vec::with_capacity(HANDSHAKE_DOMAIN.len() + 4 + nonce.len());
    message.extend_from_slice(HANDSHAKE_DOMAIN);
    message.extend_from_slice(&protocol_major.to_le_bytes());
    message.extend_from_slice(nonce);
    hmac_sha256(secret, &message)
}

fn secure_storage_proof(
    secret: &[u8],
    correlation_id: &str,
    database_dek: &[u8; BOOTSTRAP_DATABASE_DEK_BYTES],
) -> [u8; 32] {
    const DOMAIN: &[u8] = b"JARVIS-CORE-SECURE-STORAGE-V1\0";
    let mut message = Vec::with_capacity(DOMAIN.len() + correlation_id.len() + database_dek.len());
    message.extend_from_slice(DOMAIN);
    message.extend_from_slice(correlation_id.as_bytes());
    message.extend_from_slice(database_dek);
    hmac_sha256(secret, &message)
}

fn local_backup_dek_proof(
    secret: &[u8],
    operation: &str,
    correlation_id: &str,
    protected_or_plaintext: &[u8],
    descriptor_digest: &[u8; 32],
) -> [u8; 32] {
    const DOMAIN: &[u8] = b"JARVIS-CORE-SECURE-STORAGE-V1\0";
    let mut message = Vec::with_capacity(
        DOMAIN.len()
            + operation.len()
            + correlation_id.len()
            + protected_or_plaintext.len()
            + descriptor_digest.len()
            + 3,
    );
    message.extend_from_slice(DOMAIN);
    message.extend_from_slice(operation.as_bytes());
    message.push(0);
    message.extend_from_slice(correlation_id.as_bytes());
    message.push(0);
    message.extend_from_slice(protected_or_plaintext);
    message.push(0);
    message.extend_from_slice(descriptor_digest);
    hmac_sha256(secret, &message)
}

fn secure_storage_handle_proof(
    secret: &[u8],
    operation: &str,
    correlation_id: &str,
    handle: &str,
) -> [u8; 32] {
    const DOMAIN: &[u8] = b"JARVIS-CORE-SECURE-STORAGE-V1\0";
    let mut message = Vec::with_capacity(
        DOMAIN.len() + operation.len() + correlation_id.len() + handle.len() + 3,
    );
    message.extend_from_slice(DOMAIN);
    message.extend_from_slice(operation.as_bytes());
    message.push(0);
    message.extend_from_slice(correlation_id.as_bytes());
    message.push(0);
    message.extend_from_slice(handle.as_bytes());
    hmac_sha256(secret, &message)
}

fn session_password_proof(secret: &[u8], correlation_id: &str, password: &[u8]) -> [u8; 32] {
    const DOMAIN: &[u8] = b"JARVIS-CORE-SESSION-PASSWORD-KDF-V1\0";
    let mut message = Vec::with_capacity(DOMAIN.len() + correlation_id.len() + password.len());
    message.extend_from_slice(DOMAIN);
    message.extend_from_slice(correlation_id.as_bytes());
    message.extend_from_slice(password);
    hmac_sha256(secret, &message)
}

fn constant_time_equal(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    let mut difference = 0u8;
    for (left, right) in left.iter().zip(right) {
        difference |= left ^ right;
    }
    difference == 0
}

#[cfg(windows)]
mod windows {
    use super::{
        AuthenticatedCoreSession, AuthenticatedCoreStatus, BootstrapMaterial, ChallengeWire,
        CoreStatusRequestWire, CoreStatusResponseWire, EmptyPayloadWire, HANDSHAKE_NONCE_BYTES,
        HelloWire, IPC_PROTOCOL_MAJOR, LocalIpcError, LocalIpcState,
        MAX_IPC_FRAME_BYTES, BOOTSTRAP_DATABASE_DEK_BYTES, MAX_LOCAL_BACKUP_SLOT_BYTES,
        SecureStorageOperation, LocalBackupDekProtectionRequest,
        LocalBackupDekProtectionRequestWire, LocalBackupDekResponseWire,
        LocalBackupDekUnprotectionRequest, LocalBackupDekUnprotectionRequestWire,
        SecureStorageProtectionRequest, SecureStorageHandleOperationRequest,
        SecureStorageHandleOperationRequestWire,
        SecureStorageProtectionRequestWire, SecureStorageProtectionResponseWire,
        SecureStorageResponseAckWire, SessionPasswordDerivationRequest,
        SessionPasswordDerivationRequestWire, SessionPasswordVerifier,
        SessionPasswordVerifierResponseWire, MAX_SESSION_PASSWORD_BYTES,
        WelcomeWire, encode_frame,
    };
    use serde::{Deserialize, Serialize};
    use std::ffi::c_void;
    use std::mem::{MaybeUninit, size_of};
    use std::os::windows::ffi::OsStrExt;
    use std::ptr::null_mut;
    use std::sync::mpsc::{RecvTimeoutError, channel};
    use std::thread::sleep;
    use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

    use windows_sys::Win32::Foundation::{
        CloseHandle, ERROR_PIPE_CONNECTED, GetLastError, HANDLE, HANDLE_FLAG_INHERIT,
        INVALID_HANDLE_VALUE, LocalFree, SetHandleInformation,
    };
    use windows_sys::Win32::Security::Authorization::{
        ConvertSidToStringSidW, ConvertStringSecurityDescriptorToSecurityDescriptorW,
    };
    use windows_sys::Win32::Security::Cryptography::{
        BCRYPT_USE_SYSTEM_PREFERRED_RNG, BCryptGenRandom,
    };
    use windows_sys::Win32::Security::{
        GetTokenInformation, SECURITY_ATTRIBUTES, TOKEN_QUERY, TOKEN_USER, TokenUser,
    };
    use windows_sys::Win32::Storage::FileSystem::{
        FILE_FLAG_FIRST_PIPE_INSTANCE, PIPE_ACCESS_DUPLEX, ReadFile, WriteFile,
    };
    use windows_sys::Win32::System::IO::CancelSynchronousIo;
    use windows_sys::Win32::System::Pipes::{
        ConnectNamedPipe, CreateNamedPipeW, CreatePipe, DisconnectNamedPipe,
        GetNamedPipeClientSessionId, PIPE_READMODE_BYTE, PIPE_REJECT_REMOTE_CLIENTS,
        PIPE_TYPE_BYTE, PIPE_WAIT, PeekNamedPipe,
    };
    use windows_sys::Win32::System::RemoteDesktop::ProcessIdToSessionId;
    use windows_sys::Win32::System::Threading::{
        GetCurrentProcess, GetCurrentProcessId, GetCurrentThreadId, OpenProcessToken, OpenThread,
        THREAD_TERMINATE,
    };

    const PIPE_BUFFER_BYTES: u32 = 64 * 1024;
    // Explicit named-pipe exchange rights. This is the union of the
    // read/write data, attribute, extended-attribute, READ_CONTROL,
    // SYNCHRONIZE, and FILE_CREATE_PIPE_INSTANCE rights required by the
    // duplex server/client boundary. It deliberately avoids GA/FILE_ALL_ACCESS
    // and does not grant delete, write-DAC, or write-owner authority.
    const PIPE_EXCHANGE_ACCESS_MASK: u32 = 0x0012_019F;
    const SECURITY_DESCRIPTOR_REVISION: u32 = 1;
    const RANDOM_NAME_BYTES: usize = 16;
    const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(5);

    #[derive(Debug)]
    struct OwnedHandle(HANDLE);

    // SAFETY: the host owns this opaque kernel handle and only transfers the
    // wrapper as part of the single native lifecycle object. No raw pointer
    // memory is dereferenced through the handle value.
    unsafe impl Send for OwnedHandle {}
    // SAFETY: the same opaque handle is used only through synchronized native
    // lifecycle operations; no pointed-to memory is accessed through it.
    unsafe impl Sync for OwnedHandle {}

    impl OwnedHandle {
        fn new(handle: HANDLE) -> Option<Self> {
            if handle.is_null() || handle == INVALID_HANDLE_VALUE {
                None
            } else {
                Some(Self(handle))
            }
        }

        fn raw(&self) -> HANDLE {
            self.0
        }
    }

    impl Drop for OwnedHandle {
        fn drop(&mut self) {
            // SAFETY: this wrapper is constructed only from an owned Windows
            // handle and closes it exactly once.
            unsafe { CloseHandle(self.0) };
        }
    }

    fn win32_error(state: LocalIpcState, detail: &'static str) -> LocalIpcError {
        // SAFETY: GetLastError reads the calling thread's Windows error state
        // and has no pointer or handle precondition.
        let win32_error = unsafe { GetLastError() };
        LocalIpcError {
            state,
            detail: detail.to_owned(),
            win32_error: Some(win32_error),
        }
    }

    fn plain_error(state: LocalIpcState, detail: impl Into<String>) -> LocalIpcError {
        LocalIpcError {
            state,
            detail: detail.into(),
            win32_error: None,
        }
    }

    fn write_all(handle: HANDLE, bytes: &[u8]) -> Result<(), LocalIpcError> {
        let mut offset = 0usize;
        while offset < bytes.len() {
            let remaining = bytes.len() - offset;
            let chunk = remaining.min(u32::MAX as usize);
            let mut written = 0u32;
            // SAFETY: the handle is an owned synchronous pipe handle and the
            // source slice remains valid for the duration of this call.
            let result = unsafe {
                WriteFile(
                    handle,
                    bytes[offset..offset + chunk].as_ptr().cast(),
                    chunk as u32,
                    &mut written,
                    null_mut(),
                )
            };
            if result == 0 || written == 0 {
                return Err(win32_error(
                    LocalIpcState::BootstrapChannelFailed,
                    "pipe frame write failed",
                ));
            }
            offset += written as usize;
        }
        Ok(())
    }

    fn write_all_sync(handle: HANDLE, bytes: &[u8]) -> Result<(), LocalIpcError> {
        let mut offset = 0usize;
        while offset < bytes.len() {
            let remaining = bytes.len() - offset;
            let chunk = remaining.min(u32::MAX as usize);
            let mut written = 0u32;
            // SAFETY: the anonymous bootstrap writer is synchronous and the
            // source slice remains valid for the duration of this call.
            let result = unsafe {
                WriteFile(
                    handle,
                    bytes[offset..offset + chunk].as_ptr().cast(),
                    chunk as u32,
                    &mut written,
                    null_mut(),
                )
            };
            if result == 0 || written == 0 {
                return Err(win32_error(
                    LocalIpcState::BootstrapChannelFailed,
                    "bootstrap frame write failed",
                ));
            }
            offset += written as usize;
        }
        Ok(())
    }

    fn read_exact_with_deadline(
        handle: HANDLE,
        output: &mut [u8],
        deadline: Instant,
    ) -> Result<(), LocalIpcError> {
        let mut offset = 0usize;
        while offset < output.len() {
            if Instant::now() >= deadline {
                return Err(plain_error(
                    LocalIpcState::HandshakeTimeout,
                    "Core IPC handshake exceeded its bounded timeout",
                ));
            }
            let mut available = 0u32;
            let mut total = 0u32;
            // SAFETY: the handle is a connected byte-mode named pipe and the
            // output counters are valid writable locations. A null buffer is
            // explicitly permitted when only availability is queried.
            let peeked = unsafe {
                PeekNamedPipe(
                    handle,
                    null_mut(),
                    0,
                    null_mut(),
                    &mut available,
                    &mut total,
                )
            };
            if peeked == 0 {
                return Err(win32_error(
                    LocalIpcState::ClientConnectionFailed,
                    "PeekNamedPipe failed while reading the handshake",
                ));
            }
            if available == 0 {
                sleep(Duration::from_millis(5));
                continue;
            }
            let amount = available.min((output.len() - offset) as u32);
            let mut read = 0u32;
            // SAFETY: the destination range is valid for `amount` bytes, the
            // pipe is synchronous, and the read is bounded by the available
            // byte count obtained immediately above.
            let result = unsafe {
                ReadFile(
                    handle,
                    output[offset..offset + amount as usize].as_mut_ptr().cast(),
                    amount,
                    &mut read,
                    null_mut(),
                )
            };
            if result == 0 || read == 0 {
                return Err(win32_error(
                    LocalIpcState::ClientConnectionFailed,
                    "pipe frame read failed",
                ));
            }
            offset += read as usize;
        }
        Ok(())
    }

    fn write_json_frame<T: Serialize>(handle: HANDLE, value: &T) -> Result<(), LocalIpcError> {
        let payload = serde_json::to_vec(value).map_err(|_| LocalIpcError {
            state: LocalIpcState::FrameMalformed,
            detail: "IPC handshake frame could not be encoded".to_owned(),
            win32_error: None,
        })?;
        let frame = encode_frame(&payload, MAX_IPC_FRAME_BYTES)?;
        write_all(handle, &frame)
    }

    fn read_json_frame<T: for<'de> Deserialize<'de>>(
        handle: HANDLE,
        deadline: Instant,
    ) -> Result<T, LocalIpcError> {
        let mut length_bytes = [0u8; 4];
        read_exact_with_deadline(handle, &mut length_bytes, deadline)?;
        let length = u32::from_le_bytes(length_bytes) as usize;
        if length > MAX_IPC_FRAME_BYTES {
            return Err(plain_error(
                LocalIpcState::FrameTooLarge,
                "IPC frame length exceeds the 1 MiB ceiling",
            ));
        }
        let mut payload = vec![0u8; length];
        read_exact_with_deadline(handle, &mut payload, deadline)?;
        serde_json::from_slice(&payload).map_err(|_| LocalIpcError {
            state: LocalIpcState::FrameMalformed,
            detail: "IPC frame is not valid bounded JSON for the expected handshake message"
                .to_owned(),
            win32_error: None,
        })
    }

    fn connect_named_pipe_with_deadline(handle: HANDLE) -> Result<(), LocalIpcError> {
        let raw_handle = handle as usize;
        let (sender, receiver) = channel();
        let (thread_id_sender, thread_id_receiver) = channel();
        let worker = std::thread::spawn(move || {
            // SAFETY: GetCurrentThreadId has no preconditions and reports the
            // exact worker targeted by the timeout cancellation path.
            let _ = thread_id_sender.send(unsafe { GetCurrentThreadId() });
            // SAFETY: the server retains ownership of the synchronous named
            // pipe handle until this worker returns or is cancelled.
            let connected = unsafe { ConnectNamedPipe(raw_handle as HANDLE, null_mut()) };
            let result = if connected != 0 {
                Ok(())
            } else {
                // SAFETY: GetLastError is read immediately after the call.
                let error = unsafe { GetLastError() };
                if error == ERROR_PIPE_CONNECTED {
                    Ok(())
                } else {
                    Err(LocalIpcError {
                        state: LocalIpcState::ClientConnectionFailed,
                        detail: "ConnectNamedPipe failed".to_owned(),
                        win32_error: Some(error),
                    })
                }
            };
            let _ = sender.send(result);
        });
        let worker_thread_id = match thread_id_receiver.recv_timeout(Duration::from_secs(1)) {
            Ok(thread_id) => thread_id,
            Err(_) => {
                // SAFETY: the owned server handle is reset before joining the
                // initialization-failed worker.
                unsafe { DisconnectNamedPipe(handle) };
                let _ = worker.join();
                return Err(plain_error(
                    LocalIpcState::ClientConnectionFailed,
                    "Core IPC connection worker did not initialize",
                ));
            }
        };
        match receiver.recv_timeout(HANDSHAKE_TIMEOUT) {
            Ok(result) => {
                let _ = worker.join();
                result
            }
            Err(RecvTimeoutError::Timeout) => {
                // SAFETY: THREAD_TERMINATE is the access right required by
                // CancelSynchronousIo for the target worker thread.
                let worker_handle = unsafe { OpenThread(THREAD_TERMINATE, 0, worker_thread_id) };
                if !worker_handle.is_null() {
                    // SAFETY: this handle targets only the worker performing
                    // the synchronous ConnectNamedPipe call.
                    unsafe { CancelSynchronousIo(worker_handle) };
                    // SAFETY: OpenThread returned an owned handle.
                    unsafe { CloseHandle(worker_handle) };
                }
                // SAFETY: reset the server instance after cancellation before
                // joining the worker and returning the bounded timeout.
                unsafe { DisconnectNamedPipe(handle) };
                let _ = worker.join();
                Err(plain_error(
                    LocalIpcState::HandshakeTimeout,
                    "Core IPC client connection exceeded its bounded timeout",
                ))
            }
            Err(RecvTimeoutError::Disconnected) => {
                let _ = worker.join();
                Err(plain_error(
                    LocalIpcState::ClientConnectionFailed,
                    "Core IPC connection worker exited without a result",
                ))
            }
        }
    }

    fn wide(value: &str) -> Vec<u16> {
        std::ffi::OsStr::new(value)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    pub(super) fn random_bytes<const N: usize>() -> Result<[u8; N], LocalIpcError> {
        let mut bytes = [0u8; N];
        // SAFETY: `bytes` is a valid writable buffer and the system-preferred
        // BCrypt RNG is the Windows CSPRNG required for an unpredictable
        // per-launch endpoint identity.
        let status = unsafe {
            BCryptGenRandom(
                0 as _,
                bytes.as_mut_ptr(),
                bytes.len() as u32,
                BCRYPT_USE_SYSTEM_PREFERRED_RNG,
            )
        };
        if status != 0 {
            return Err(plain_error(
                LocalIpcState::RandomnessFailed,
                "BCryptGenRandom failed; secure Core IPC bootstrap is blocked",
            ));
        }
        Ok(bytes)
    }

    fn random_endpoint_name() -> Result<String, LocalIpcError> {
        let bytes = random_bytes::<RANDOM_NAME_BYTES>()?;

        let mut suffix = String::with_capacity(bytes.len() * 2);
        for byte in bytes {
            use std::fmt::Write;
            write!(&mut suffix, "{byte:02x}").expect("writing to String cannot fail");
        }
        Ok(format!(r"\\.\pipe\jarvis-core-{suffix}"))
    }

    fn current_user_sid_string() -> Result<String, LocalIpcError> {
        let mut token = null_mut();
        // SAFETY: the current-process pseudo-handle is valid and `token` is a
        // valid output pointer for the owned token handle.
        if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) } == 0 {
            return Err(win32_error(
                LocalIpcState::IdentityFailed,
                "OpenProcessToken failed",
            ));
        }
        let token = OwnedHandle::new(token).ok_or_else(|| {
            plain_error(
                LocalIpcState::IdentityFailed,
                "OpenProcessToken returned an invalid handle",
            )
        })?;

        let mut required_bytes = 0u32;
        // SAFETY: the first call intentionally supplies no output buffer to
        // obtain the required TOKEN_USER size.
        unsafe {
            GetTokenInformation(token.raw(), TokenUser, null_mut(), 0, &mut required_bytes);
        }
        if required_bytes == 0 {
            return Err(win32_error(
                LocalIpcState::IdentityFailed,
                "GetTokenInformation did not report a TOKEN_USER size",
            ));
        }

        let word_count = (required_bytes as usize).div_ceil(size_of::<usize>());
        let mut storage = vec![MaybeUninit::<usize>::uninit(); word_count];
        let mut returned_bytes = 0u32;
        // SAFETY: `storage` is aligned writable storage large enough for the
        // TOKEN_USER record reported by Windows.
        let queried = unsafe {
            GetTokenInformation(
                token.raw(),
                TokenUser,
                storage.as_mut_ptr().cast::<c_void>(),
                (storage.len() * size_of::<usize>()) as u32,
                &mut returned_bytes,
            )
        };
        if queried == 0 || returned_bytes < size_of::<TOKEN_USER>() as u32 {
            return Err(win32_error(
                LocalIpcState::IdentityFailed,
                "GetTokenInformation(TOKEN_USER) failed",
            ));
        }

        // SAFETY: Windows populated a complete TOKEN_USER record in the
        // aligned storage above; the SID pointer remains valid until storage
        // is dropped, and conversion completes before then.
        let user = unsafe { storage.as_ptr().cast::<TOKEN_USER>().read() };
        let mut sid_string = null_mut();
        // SAFETY: `user.User.Sid` is the validated SID pointer returned by the
        // current process token and `sid_string` is an output pointer.
        if unsafe { ConvertSidToStringSidW(user.User.Sid, &mut sid_string) } == 0 {
            return Err(win32_error(
                LocalIpcState::IdentityFailed,
                "ConvertSidToStringSidW failed",
            ));
        }

        // SAFETY: sid_string was allocated and populated by the Windows SID
        // conversion API; the bounded NUL scan and LocalFree use that owned
        // allocation before it is dropped.
        let sid = unsafe {
            let mut length = 0usize;
            while *sid_string.add(length) != 0 {
                length += 1;
            }
            let value = String::from_utf16_lossy(std::slice::from_raw_parts(sid_string, length));
            LocalFree(sid_string.cast());
            value
        };
        if sid.is_empty() {
            return Err(plain_error(
                LocalIpcState::IdentityFailed,
                "current user SID is empty",
            ));
        }
        Ok(sid)
    }

    fn current_session_id() -> Result<u32, LocalIpcError> {
        let mut session_id = 0u32;
        // SAFETY: current process ID is valid and the output pointer is valid.
        if unsafe { ProcessIdToSessionId(GetCurrentProcessId(), &mut session_id) } == 0 {
            Err(win32_error(
                LocalIpcState::IdentityFailed,
                "ProcessIdToSessionId failed",
            ))
        } else {
            Ok(session_id)
        }
    }

    fn is_uuid_v7(value: &str) -> bool {
        let bytes = value.as_bytes();
        bytes.len() == 36
            && bytes[8] == b'-'
            && bytes[13] == b'-'
            && bytes[18] == b'-'
            && bytes[23] == b'-'
            && bytes[14] == b'7'
            && matches!(bytes[19], b'8'..=b'9' | b'a'..=b'b' | b'A'..=b'B')
            && bytes.iter().enumerate().all(|(index, byte)| {
                matches!(index, 8 | 13 | 18 | 23) || (*byte as char).is_ascii_hexdigit()
            })
    }

    fn random_uuid_v7() -> Result<String, LocalIpcError> {
        let mut bytes = random_bytes::<16>()?;
        let milliseconds = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| plain_error(LocalIpcState::RandomnessFailed, "system clock is before Unix epoch"))?
            .as_millis() as u64;
        let timestamp = milliseconds.to_be_bytes();
        bytes[..6].copy_from_slice(&timestamp[2..]);
        bytes[6] = (bytes[6] & 0x0f) | 0x70;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        Ok(format!(
            "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
            bytes[0],
            bytes[1],
            bytes[2],
            bytes[3],
            bytes[4],
            bytes[5],
            bytes[6],
            bytes[7],
            bytes[8],
            bytes[9],
            bytes[10],
            bytes[11],
            bytes[12],
            bytes[13],
            bytes[14],
            bytes[15]
        ))
    }

    fn session_matches(expected: u32, actual: u32) -> bool {
        expected == actual
    }

    #[derive(Debug)]
    pub struct NamedPipeServer {
        endpoint_name: String,
        security_descriptor_sddl: String,
        session_id: u32,
        handle: OwnedHandle,
        bootstrap_material: BootstrapMaterial,
    }

    impl NamedPipeServer {
        pub fn bind() -> Result<Self, LocalIpcError> {
            Self::bind_with_database_dek([0; BOOTSTRAP_DATABASE_DEK_BYTES])
        }

        pub fn bind_with_database_dek(
            database_dek: [u8; BOOTSTRAP_DATABASE_DEK_BYTES],
        ) -> Result<Self, LocalIpcError> {
            let endpoint_name = random_endpoint_name()?;
            let sid = current_user_sid_string()?;
            let security_descriptor_sddl =
                format!("D:P(A;;0x{PIPE_EXCHANGE_ACCESS_MASK:08X};;;{sid})");
            let descriptor_text = wide(&security_descriptor_sddl);
            let mut descriptor = null_mut();
            // SAFETY: the SDDL buffer is NUL-terminated and the descriptor
            // output pointer is valid. Windows allocates the descriptor for
            // this call; it is freed after CreateNamedPipeW returns.
            if unsafe {
                ConvertStringSecurityDescriptorToSecurityDescriptorW(
                    descriptor_text.as_ptr(),
                    SECURITY_DESCRIPTOR_REVISION,
                    &mut descriptor,
                    null_mut(),
                )
            } == 0
            {
                return Err(win32_error(
                    LocalIpcState::SecurityDescriptorFailed,
                    "ConvertStringSecurityDescriptorToSecurityDescriptorW failed",
                ));
            }

            let attributes = SECURITY_ATTRIBUTES {
                nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
                lpSecurityDescriptor: descriptor,
                bInheritHandle: 0,
            };
            let endpoint_text = wide(&endpoint_name);
            // SAFETY: all buffers and the explicit protected DACL remain alive
            // for the duration of object creation. Remote clients are rejected
            // by the pipe mode in addition to the DACL.
            let handle = unsafe {
                CreateNamedPipeW(
                    endpoint_text.as_ptr(),
                    PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE,
                    PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
                    1,
                    PIPE_BUFFER_BYTES,
                    PIPE_BUFFER_BYTES,
                    0,
                    &attributes,
                )
            };
            // SAFETY: the descriptor was allocated by the conversion API and
            // is no longer needed after CreateNamedPipeW returned.
            unsafe { LocalFree(descriptor.cast()) };
            let handle = OwnedHandle::new(handle).ok_or_else(|| {
                win32_error(
                    LocalIpcState::EndpointCreationFailed,
                    "CreateNamedPipeW failed; Core IPC endpoint was not created",
                )
            })?;

            let bootstrap_material = BootstrapMaterial::new(&endpoint_name, &database_dek)?;
            Ok(Self {
                endpoint_name,
                security_descriptor_sddl,
                session_id: current_session_id()?,
                handle,
                bootstrap_material,
            })
        }

        pub fn bind_with_database_dek_and_secure_storage(
            database_dek: [u8; BOOTSTRAP_DATABASE_DEK_BYTES],
        ) -> Result<(Self, Self), LocalIpcError> {
            let secure_storage = Self::bind_with_database_dek([0; BOOTSTRAP_DATABASE_DEK_BYTES])?;
            let mut core = Self::bind_with_database_dek(database_dek)?;
            core.bootstrap_material = core
                .bootstrap_material
                .clone()
                .with_secure_storage(&secure_storage.bootstrap_material);
            Ok((core, secure_storage))
        }

        pub fn endpoint_name(&self) -> &str {
            &self.endpoint_name
        }

        pub fn security_descriptor_sddl(&self) -> &str {
            &self.security_descriptor_sddl
        }

        pub fn session_id(&self) -> u32 {
            self.session_id
        }

        pub fn bootstrap_material(&self) -> &BootstrapMaterial {
            &self.bootstrap_material
        }

        pub fn create_bootstrap_channel(&self) -> Result<BootstrapChannel, LocalIpcError> {
            BootstrapChannel::new()
        }

        /// Wait for one client and enforce the current interactive session.
        /// Bootstrap authentication is intentionally a separate later gate.
        pub fn accept_client(&self) -> Result<u32, LocalIpcError> {
            connect_named_pipe_with_deadline(self.handle.raw())?;

            let mut client_session = 0u32;
            // SAFETY: the connected pipe handle is valid and the output
            // session pointer is valid.
            if unsafe { GetNamedPipeClientSessionId(self.handle.raw(), &mut client_session) } == 0 {
                unsafe { DisconnectNamedPipe(self.handle.raw()) };
                return Err(win32_error(
                    LocalIpcState::ClientSessionInspectionFailed,
                    "GetNamedPipeClientSessionId failed",
                ));
            }
            if !session_matches(self.session_id, client_session) {
                // SAFETY: the server owns a valid connected pipe handle and
                // disconnecting it is the intended rejection cleanup.
                unsafe { DisconnectNamedPipe(self.handle.raw()) };
                return Err(plain_error(
                    LocalIpcState::ClientSessionRejected,
                    "named-pipe client belongs to a different Windows session",
                ));
            }
            Ok(client_session)
        }

        pub fn disconnect_client(&self) {
            // SAFETY: disconnecting an owned named-pipe server handle is safe;
            // the operation is idempotent for the lifecycle boundary.
            unsafe { DisconnectNamedPipe(self.handle.raw()) };
        }

        /// Authenticate the already session-qualified client with a one-time
        /// challenge/response. A Windows principal without the bootstrap
        /// secret is never promoted to a trusted Core peer.
        pub fn authenticate_client(&self) -> Result<AuthenticatedCoreSession, LocalIpcError> {
            let session_id = self.accept_client()?;
            let nonce = random_bytes::<HANDSHAKE_NONCE_BYTES>()?;
            let challenge = ChallengeWire {
                kind: "challenge".to_owned(),
                protocol_major: IPC_PROTOCOL_MAJOR,
                supported_protocol_majors: vec![IPC_PROTOCOL_MAJOR],
                nonce: super::hex_encode(&nonce),
            };
            let result = (|| {
                write_json_frame(self.handle.raw(), &challenge)?;
                let hello: HelloWire =
                    read_json_frame(self.handle.raw(), Instant::now() + HANDSHAKE_TIMEOUT)?;
                if hello.kind != "hello"
                    || hello.protocol_major != IPC_PROTOCOL_MAJOR
                    || !challenge
                        .supported_protocol_majors
                        .contains(&hello.protocol_major)
                {
                    return Err(plain_error(
                        LocalIpcState::ProtocolMismatch,
                        "Core IPC protocol-major negotiation failed",
                    ));
                }
                let received = super::hex_decode(&hello.proof, 32).ok_or_else(|| {
                    plain_error(
                        LocalIpcState::AuthenticationFailed,
                        "Core IPC bootstrap proof has an invalid shape",
                    )
                })?;
                let expected = super::handshake_proof(
                    self.bootstrap_material.secret(),
                    IPC_PROTOCOL_MAJOR,
                    &nonce,
                );
                if !super::constant_time_equal(&received, &expected) {
                    return Err(plain_error(
                        LocalIpcState::AuthenticationFailed,
                        "Core IPC bootstrap authentication failed",
                    ));
                }
                write_json_frame(
                    self.handle.raw(),
                    &WelcomeWire {
                        kind: "welcome".to_owned(),
                        protocol_major: IPC_PROTOCOL_MAJOR,
                    },
                )?;
                Ok(AuthenticatedCoreSession {
                    protocol_major: IPC_PROTOCOL_MAJOR,
                    session_id,
                })
            })();
            if result.is_err() {
                self.disconnect_client();
            }
            result
        }

        /// Send only the harmless locked status request after the bootstrap
        /// handshake. No state mutation, tool, provider, or shell request is
        /// representable through this Phase-2 control-plane method.
        pub fn request_locked_status(
            &self,
            session: &AuthenticatedCoreSession,
        ) -> Result<AuthenticatedCoreStatus, LocalIpcError> {
            if session.protocol_major != IPC_PROTOCOL_MAJOR
                || session.session_id != self.session_id
            {
                return Err(plain_error(
                    LocalIpcState::AuthenticationFailed,
                    "Core status request requires the current authenticated session",
                ));
            }
            let correlation_id = random_uuid_v7()?;
            write_json_frame(
                self.handle.raw(),
                &CoreStatusRequestWire {
                    protocol_version: IPC_PROTOCOL_MAJOR,
                    kind: "request",
                    id: None,
                    name: "get_core_status",
                    correlation_id,
                    payload: EmptyPayloadWire {},
                },
            )
            .map_err(|error| {
                plain_error(
                    LocalIpcState::ControlPlaneRequestFailed,
                    format!("Core status request could not be written: {:?}", error.state),
                )
            })?;

            let response: CoreStatusResponseWire = read_json_frame(
                self.handle.raw(),
                Instant::now() + HANDSHAKE_TIMEOUT,
            )
            .map_err(|error| {
                plain_error(
                    LocalIpcState::ControlPlaneRequestFailed,
                    format!("Core status response could not be read: {:?}", error.state),
                )
            })?;
            if !response.ok {
                if let Some(error) = response.error.as_ref() {
                    let valid_error = !error.code.is_empty()
                        && !error.category.is_empty()
                        && !error.message.is_empty()
                        && is_uuid_v7(&error.correlation_id);
                    let _ = (error.retryable, &error.details);
                    if valid_error && response.result.is_none() {
                        return Err(plain_error(
                            LocalIpcState::ControlPlaneRequestFailed,
                            "Core rejected the locked status request",
                        ));
                    }
                }
                return Err(plain_error(
                    LocalIpcState::ControlPlaneResponseInvalid,
                    "Core returned an invalid status response union",
                ));
            }

            let result = response.result.ok_or_else(|| {
                plain_error(
                    LocalIpcState::ControlPlaneResponseInvalid,
                    "Core status response omitted its result",
                )
            })?;
            if response.error.is_some()
                || result.protocol_major != IPC_PROTOCOL_MAJOR
                || result.platform != "WINDOWS"
                || result.runtime_role != "FULL_HOST"
                || result.architecture != "x64"
                || result.service_state != "LOCKED"
                || result.transport_state != "NOT_CONNECTED"
            {
                return Err(plain_error(
                    LocalIpcState::ControlPlaneResponseInvalid,
                    "Core status response did not match the locked V1 contract",
                ));
            }
            Ok(AuthenticatedCoreStatus {
                protocol_major: result.protocol_major,
                platform: "WINDOWS",
                runtime_role: "FULL_HOST",
                architecture: "x64",
                service_state: "LOCKED",
                transport_state: "NOT_CONNECTED",
            })
        }

        pub fn receive_secure_storage_operation(
            &self,
            session: &AuthenticatedCoreSession,
        ) -> Result<SecureStorageOperation, LocalIpcError> {
            if session.protocol_major != IPC_PROTOCOL_MAJOR || session.session_id != self.session_id {
                return Err(plain_error(
                    LocalIpcState::AuthenticationFailed,
                    "secure-storage request requires the current authenticated session",
                ));
            }
            let value: serde_json::Value = read_json_frame(
                self.handle.raw(),
                Instant::now() + HANDSHAKE_TIMEOUT,
            )?;
            let operation = value
                .get("operation")
                .and_then(serde_json::Value::as_str)
                .map(str::to_owned)
                .ok_or_else(|| {
                    plain_error(
                        LocalIpcState::ControlPlaneRequestFailed,
                        "secure-storage operation identity is invalid",
                    )
                })?;
            match operation.as_str() {
                "protect_new_database_dek" => {
                    let request: SecureStorageProtectionRequestWire =
                        serde_json::from_value(value).map_err(|_| {
                            plain_error(
                                LocalIpcState::ControlPlaneRequestFailed,
                                "secure-storage protection request shape is invalid",
                            )
                        })?;
                    if request.protocol_version != IPC_PROTOCOL_MAJOR
                        || request.kind != "request"
                        || request.operation != "protect_new_database_dek"
                        || !is_uuid_v7(&request.correlation_id)
                    {
                        return Err(plain_error(
                            LocalIpcState::ControlPlaneRequestFailed,
                            "secure-storage operation identity is invalid",
                        ));
                    }
                    let database_dek = super::hex_decode(
                        &request.database_dek,
                        BOOTSTRAP_DATABASE_DEK_BYTES,
                    )
                    .ok_or_else(|| {
                        plain_error(
                            LocalIpcState::ControlPlaneRequestFailed,
                            "secure-storage DB_DEK encoding is invalid",
                        )
                    })?;
                    let database_dek: [u8; BOOTSTRAP_DATABASE_DEK_BYTES] =
                        database_dek.try_into().map_err(|_| {
                            plain_error(
                                LocalIpcState::ControlPlaneRequestFailed,
                                "secure-storage DB_DEK length is invalid",
                            )
                        })?;
                    let received = super::hex_decode(&request.proof, 32).ok_or_else(|| {
                        plain_error(
                            LocalIpcState::AuthenticationFailed,
                            "secure-storage proof encoding is invalid",
                        )
                    })?;
                    let expected = super::secure_storage_proof(
                        self.bootstrap_material.secure_storage_secret(),
                        &request.correlation_id,
                        &database_dek,
                    );
                    if !super::constant_time_equal(&received, &expected) {
                        return Err(plain_error(
                            LocalIpcState::AuthenticationFailed,
                            "secure-storage operation authentication failed",
                        ));
                    }
                    Ok(SecureStorageOperation::Protect(
                        SecureStorageProtectionRequest {
                            correlation_id: request.correlation_id,
                            database_dek,
                        },
                    ))
                }
                "protect_local_backup_dek" => {
                    let request: LocalBackupDekProtectionRequestWire =
                        serde_json::from_value(value).map_err(|_| {
                            plain_error(
                                LocalIpcState::ControlPlaneRequestFailed,
                                "local backup-dek protection request shape is invalid",
                            )
                        })?;
                    if request.protocol_version != IPC_PROTOCOL_MAJOR
                        || request.kind != "request"
                        || request.operation != operation
                        || !is_uuid_v7(&request.correlation_id)
                    {
                        return Err(plain_error(
                            LocalIpcState::ControlPlaneRequestFailed,
                            "local backup-dek operation identity is invalid",
                        ));
                    }
                    let backup_dek = super::hex_decode(
                        &request.backup_dek,
                        BOOTSTRAP_DATABASE_DEK_BYTES,
                    )
                    .ok_or_else(|| {
                        plain_error(
                            LocalIpcState::ControlPlaneRequestFailed,
                            "local backup-dek encoding is invalid",
                        )
                    })?;
                    let backup_dek: [u8; BOOTSTRAP_DATABASE_DEK_BYTES] =
                        backup_dek.try_into().map_err(|_| {
                            plain_error(
                                LocalIpcState::ControlPlaneRequestFailed,
                                "local backup-dek length is invalid",
                            )
                        })?;
                    let descriptor_digest = super::hex_decode(&request.descriptor_digest, 32)
                        .ok_or_else(|| {
                            plain_error(
                                LocalIpcState::ControlPlaneRequestFailed,
                                "local backup-dek descriptor binding is invalid",
                            )
                        })?;
                    let descriptor_digest: [u8; 32] = descriptor_digest.try_into().map_err(|_| {
                        plain_error(
                            LocalIpcState::ControlPlaneRequestFailed,
                            "local backup-dek descriptor binding length is invalid",
                        )
                    })?;
                    let received = super::hex_decode(&request.proof, 32).ok_or_else(|| {
                        plain_error(
                            LocalIpcState::AuthenticationFailed,
                            "local backup-dek proof encoding is invalid",
                        )
                    })?;
                    let expected = super::local_backup_dek_proof(
                        self.bootstrap_material.secure_storage_secret(),
                        &operation,
                        &request.correlation_id,
                        &backup_dek,
                        &descriptor_digest,
                    );
                    if !super::constant_time_equal(&received, &expected) {
                        return Err(plain_error(
                            LocalIpcState::AuthenticationFailed,
                            "local backup-dek operation authentication failed",
                        ));
                    }
                    Ok(SecureStorageOperation::ProtectLocalBackupDek(
                        LocalBackupDekProtectionRequest {
                            correlation_id: request.correlation_id,
                            backup_dek,
                            descriptor_digest,
                        },
                    ))
                }
                "unprotect_local_backup_dek" => {
                    let request: LocalBackupDekUnprotectionRequestWire =
                        serde_json::from_value(value).map_err(|_| {
                            plain_error(
                                LocalIpcState::ControlPlaneRequestFailed,
                                "local backup-dek unprotection request shape is invalid",
                            )
                        })?;
                    if request.protocol_version != IPC_PROTOCOL_MAJOR
                        || request.kind != "request"
                        || request.operation != operation
                        || !is_uuid_v7(&request.correlation_id)
                    {
                        return Err(plain_error(
                            LocalIpcState::ControlPlaneRequestFailed,
                            "local backup-dek operation identity is invalid",
                        ));
                    }
                    let protected_backup_dek = super::hex_decode(
                        &request.protected_backup_dek,
                        request.protected_backup_dek.len() / 2,
                    )
                    .filter(|value| {
                        !value.is_empty() && value.len() <= MAX_LOCAL_BACKUP_SLOT_BYTES
                    })
                    .ok_or_else(|| {
                        plain_error(
                            LocalIpcState::ControlPlaneRequestFailed,
                            "local backup-dek protected blob is invalid",
                        )
                    })?;
                    let descriptor_digest = super::hex_decode(&request.descriptor_digest, 32)
                        .ok_or_else(|| {
                            plain_error(
                                LocalIpcState::ControlPlaneRequestFailed,
                                "local backup-dek descriptor binding is invalid",
                            )
                        })?;
                    let descriptor_digest: [u8; 32] = descriptor_digest.try_into().map_err(|_| {
                        plain_error(
                            LocalIpcState::ControlPlaneRequestFailed,
                            "local backup-dek descriptor binding length is invalid",
                        )
                    })?;
                    let received = super::hex_decode(&request.proof, 32).ok_or_else(|| {
                        plain_error(
                            LocalIpcState::AuthenticationFailed,
                            "local backup-dek proof encoding is invalid",
                        )
                    })?;
                    let expected = super::local_backup_dek_proof(
                        self.bootstrap_material.secure_storage_secret(),
                        &operation,
                        &request.correlation_id,
                        &protected_backup_dek,
                        &descriptor_digest,
                    );
                    if !super::constant_time_equal(&received, &expected) {
                        return Err(plain_error(
                            LocalIpcState::AuthenticationFailed,
                            "local backup-dek operation authentication failed",
                        ));
                    }
                    Ok(SecureStorageOperation::UnprotectLocalBackupDek(
                        LocalBackupDekUnprotectionRequest {
                            correlation_id: request.correlation_id,
                            protected_backup_dek,
                            descriptor_digest,
                        },
                    ))
                }
                "commit_staged_database_dek" | "abort_staged_database_dek" => {
                    let request: SecureStorageHandleOperationRequestWire =
                        serde_json::from_value(value).map_err(|_| {
                            plain_error(
                                LocalIpcState::ControlPlaneRequestFailed,
                                "secure-storage handle request shape is invalid",
                            )
                        })?;
                    if request.protocol_version != IPC_PROTOCOL_MAJOR
                        || request.kind != "request"
                        || request.operation != operation
                        || !is_uuid_v7(&request.correlation_id)
                        || request.handle.is_empty()
                    {
                        return Err(plain_error(
                            LocalIpcState::ControlPlaneRequestFailed,
                            "secure-storage operation identity is invalid",
                        ));
                    }
                    let received = super::hex_decode(&request.proof, 32).ok_or_else(|| {
                        plain_error(
                            LocalIpcState::AuthenticationFailed,
                            "secure-storage proof encoding is invalid",
                        )
                    })?;
                    let expected = super::secure_storage_handle_proof(
                        self.bootstrap_material.secure_storage_secret(),
                        &request.operation,
                        &request.correlation_id,
                        &request.handle,
                    );
                    if !super::constant_time_equal(&received, &expected) {
                        return Err(plain_error(
                            LocalIpcState::AuthenticationFailed,
                            "secure-storage operation authentication failed",
                        ));
                    }
                    let request = SecureStorageHandleOperationRequest {
                        operation: request.operation.clone(),
                        correlation_id: request.correlation_id,
                        handle: request.handle,
                    };
                    if operation == "commit_staged_database_dek" {
                        Ok(SecureStorageOperation::Commit(request))
                    } else {
                        Ok(SecureStorageOperation::Abort(request))
                    }
                }
                "derive_session_password_verifier" => {
                    let request: SessionPasswordDerivationRequestWire =
                        serde_json::from_value(value).map_err(|_| {
                            plain_error(
                                LocalIpcState::ControlPlaneRequestFailed,
                                "session-password derivation request shape is invalid",
                            )
                        })?;
                    if request.protocol_version != IPC_PROTOCOL_MAJOR
                        || request.kind != "request"
                        || request.operation != operation
                        || !is_uuid_v7(&request.correlation_id)
                    {
                        return Err(plain_error(
                            LocalIpcState::ControlPlaneRequestFailed,
                            "session-password operation identity is invalid",
                        ));
                    }
                    let password = super::hex_decode(&request.password, request.password.len() / 2)
                        .filter(|password| !password.is_empty() && password.len() <= MAX_SESSION_PASSWORD_BYTES)
                        .ok_or_else(|| {
                            plain_error(
                                LocalIpcState::ControlPlaneRequestFailed,
                                "session-password encoding or size is invalid",
                            )
                        })?;
                    let received = super::hex_decode(&request.proof, 32).ok_or_else(|| {
                        plain_error(
                            LocalIpcState::AuthenticationFailed,
                            "session-password proof encoding is invalid",
                        )
                    })?;
                    let expected = super::session_password_proof(
                        self.bootstrap_material.secure_storage_secret(),
                        &request.correlation_id,
                        &password,
                    );
                    if !super::constant_time_equal(&received, &expected) {
                        return Err(plain_error(
                            LocalIpcState::AuthenticationFailed,
                            "session-password operation authentication failed",
                        ));
                    }
                    Ok(SecureStorageOperation::DeriveSessionPassword(
                        SessionPasswordDerivationRequest {
                            correlation_id: request.correlation_id,
                            password,
                        },
                    ))
                }
                _ => Err(plain_error(
                    LocalIpcState::ControlPlaneRequestFailed,
                    "secure-storage operation is unsupported",
                )),
            }
        }

        pub fn respond_secure_storage_protection(
            &self,
            session: &AuthenticatedCoreSession,
            correlation_id: String,
            handle: Result<String, &'static str>,
        ) -> Result<(), LocalIpcError> {
            if session.protocol_major != IPC_PROTOCOL_MAJOR || session.session_id != self.session_id {
                return Err(plain_error(
                    LocalIpcState::AuthenticationFailed,
                    "secure-storage response requires the current authenticated session",
                ));
            }
            let (ok, handle, error_code) = match handle {
                Ok(handle) => (true, Some(handle), None),
                Err(code) => (false, None, Some(code)),
            };
            write_json_frame(
                self.handle.raw(),
                &SecureStorageProtectionResponseWire {
                    ok,
                    correlation_id: correlation_id.clone(),
                    handle,
                    error_code,
                },
            )?;
            let acknowledgement: SecureStorageResponseAckWire =
                read_json_frame(self.handle.raw(), Instant::now() + HANDSHAKE_TIMEOUT)?;
            if acknowledgement.kind != "response_ack"
                || acknowledgement.correlation_id != correlation_id
            {
                return Err(plain_error(
                    LocalIpcState::ControlPlaneResponseInvalid,
                    "secure-storage response acknowledgement was invalid",
                ));
            }
            Ok(())
        }

        pub fn respond_local_backup_dek(
            &self,
            session: &AuthenticatedCoreSession,
            correlation_id: String,
            operation: &'static str,
            mut value: Result<Vec<u8>, &'static str>,
        ) -> Result<(), LocalIpcError> {
            if session.protocol_major != IPC_PROTOCOL_MAJOR || session.session_id != self.session_id {
                return Err(plain_error(
                    LocalIpcState::AuthenticationFailed,
                    "local backup-dek response requires the current authenticated session",
                ));
            }
            let response = match &value {
                Ok(value) if operation == "protect_local_backup_dek" => LocalBackupDekResponseWire {
                    ok: true,
                    correlation_id: correlation_id.clone(),
                    operation,
                    protected_backup_dek: Some(super::hex_encode(value)),
                    backup_dek: None,
                    error_code: None,
                },
                Ok(value) => LocalBackupDekResponseWire {
                    ok: true,
                    correlation_id: correlation_id.clone(),
                    operation,
                    protected_backup_dek: None,
                    backup_dek: Some(super::hex_encode(value)),
                    error_code: None,
                },
                Err(error_code) => LocalBackupDekResponseWire {
                    ok: false,
                    correlation_id: correlation_id.clone(),
                    operation,
                    protected_backup_dek: None,
                    backup_dek: None,
                    error_code: Some(error_code),
                },
            };
            if let Ok(bytes) = value.as_mut() {
                bytes.fill(0);
            }
            write_json_frame(self.handle.raw(), &response)?;
            let acknowledgement: SecureStorageResponseAckWire =
                read_json_frame(self.handle.raw(), Instant::now() + HANDSHAKE_TIMEOUT)?;
            if acknowledgement.kind != "response_ack"
                || acknowledgement.correlation_id != correlation_id
            {
                return Err(plain_error(
                    LocalIpcState::ControlPlaneResponseInvalid,
                    "local backup-dek response acknowledgement was invalid",
                ));
            }
            Ok(())
        }

        pub fn respond_session_password_verifier(
            &self,
            session: &AuthenticatedCoreSession,
            correlation_id: String,
            verifier: Result<SessionPasswordVerifier, &'static str>,
        ) -> Result<(), LocalIpcError> {
            if session.protocol_major != IPC_PROTOCOL_MAJOR || session.session_id != self.session_id {
                return Err(plain_error(
                    LocalIpcState::AuthenticationFailed,
                    "session-password response requires the current authenticated session",
                ));
            }
            let response = match verifier {
                Ok(verifier) => SessionPasswordVerifierResponseWire {
                    ok: true,
                    correlation_id: correlation_id.clone(),
                    profile_id: Some(verifier.profile_id.clone()),
                    algorithm: Some(verifier.algorithm.clone()),
                    version: Some(verifier.version),
                    memory_kib: Some(verifier.memory_kib),
                    iterations: Some(verifier.iterations),
                    parallelism: Some(verifier.parallelism),
                    salt: Some(super::hex_encode(&verifier.salt)),
                    verifier: Some(super::hex_encode(&verifier.verifier)),
                    error_code: None,
                },
                Err(error_code) => SessionPasswordVerifierResponseWire {
                    ok: false,
                    correlation_id: correlation_id.clone(),
                    profile_id: None,
                    algorithm: None,
                    version: None,
                    memory_kib: None,
                    iterations: None,
                    parallelism: None,
                    salt: None,
                    verifier: None,
                    error_code: Some(error_code),
                },
            };
            write_json_frame(self.handle.raw(), &response)?;
            let acknowledgement: SecureStorageResponseAckWire =
                read_json_frame(self.handle.raw(), Instant::now() + HANDSHAKE_TIMEOUT)?;
            if acknowledgement.kind != "response_ack"
                || acknowledgement.correlation_id != correlation_id
            {
                return Err(plain_error(
                    LocalIpcState::ControlPlaneResponseInvalid,
                    "session-password response acknowledgement was invalid",
                ));
            }
            Ok(())
        }
    }

    #[derive(Debug)]
    pub struct BootstrapChannel {
        reader: Option<OwnedHandle>,
        writer: Option<OwnedHandle>,
    }

    impl BootstrapChannel {
        fn new() -> Result<Self, LocalIpcError> {
            let attributes = SECURITY_ATTRIBUTES {
                nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
                lpSecurityDescriptor: null_mut(),
                bInheritHandle: 1,
            };
            let mut reader = null_mut();
            let mut writer = null_mut();
            // SAFETY: the output handles and security attributes are valid;
            // the anonymous pipe is inherited only by the explicitly selected
            // Core stdin handle during process creation.
            if unsafe { CreatePipe(&mut reader, &mut writer, &attributes, 0) } == 0 {
                return Err(win32_error(
                    LocalIpcState::BootstrapChannelFailed,
                    "CreatePipe failed for Core bootstrap transfer",
                ));
            }
            let reader = match OwnedHandle::new(reader) {
                Some(reader) => reader,
                None => {
                    // SAFETY: CreatePipe returned an invalid reader while the
                    // writer is still owned by this failure path.
                    unsafe { CloseHandle(writer) };
                    return Err(plain_error(
                        LocalIpcState::BootstrapChannelFailed,
                        "CreatePipe returned an invalid reader handle",
                    ));
                }
            };
            let writer = OwnedHandle::new(writer).ok_or_else(|| {
                // SAFETY: the reader is owned above; this is the only writer
                // handle returned by CreatePipe and it must be closed here.
                unsafe { CloseHandle(reader.raw()) };
                plain_error(
                    LocalIpcState::BootstrapChannelFailed,
                    "CreatePipe returned an invalid writer handle",
                )
            })?;
            // SAFETY: the reader is the single handle intentionally selected
            // for inheritance by PROC_THREAD_ATTRIBUTE_HANDLE_LIST.
            if unsafe {
                SetHandleInformation(reader.raw(), HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT)
            } == 0
            {
                return Err(win32_error(
                    LocalIpcState::BootstrapChannelFailed,
                    "SetHandleInformation failed for the bootstrap reader",
                ));
            }
            // SAFETY: the writer is owned by the host and must not be inherited
            // by Core; only the reader is placed in the explicit handle list.
            if unsafe { SetHandleInformation(writer.raw(), HANDLE_FLAG_INHERIT, 0) } == 0 {
                return Err(win32_error(
                    LocalIpcState::BootstrapChannelFailed,
                    "SetHandleInformation failed for the bootstrap writer",
                ));
            }
            Ok(Self {
                reader: Some(reader),
                writer: Some(writer),
            })
        }

        pub fn reader_handle(&self) -> HANDLE {
            self.reader
                .as_ref()
                .expect("bootstrap reader is available")
                .raw()
        }

        pub fn close_reader(&mut self) {
            self.reader.take();
        }

        pub fn write_material(
            &mut self,
            material: &BootstrapMaterial,
        ) -> Result<(), LocalIpcError> {
            if material.protocol_major() != IPC_PROTOCOL_MAJOR {
                return Err(plain_error(
                    LocalIpcState::ProtocolMismatch,
                    "bootstrap material protocol major is unsupported",
                ));
            }
            if material.endpoint_name().is_empty() {
                return Err(plain_error(
                    LocalIpcState::BootstrapEncodingFailed,
                    "bootstrap material endpoint is empty",
                ));
            }
            let writer = self.writer.take().ok_or_else(|| {
                plain_error(
                    LocalIpcState::BootstrapChannelFailed,
                    "bootstrap channel is single-use",
                )
            })?;
            let frame = material.encode_frame()?;
            let result = write_all_sync(writer.raw(), &frame);
            drop(writer);
            result
        }
    }

    impl Drop for NamedPipeServer {
        fn drop(&mut self) {
            // SAFETY: the handle is owned and remains valid until field drop.
            unsafe { DisconnectNamedPipe(self.handle.raw()) };
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use crate::local_ipc::{
            BOOTSTRAP_SECRET_BYTES, constant_time_equal, handshake_proof, hex_decode, hex_encode,
        };
        use std::io::Write;
        use std::path::{Path, PathBuf};
        use std::process::{Command, Stdio};
        use std::ptr::{null, null_mut};
        use std::thread::{self, sleep};
        use windows_sys::Win32::Foundation::{GENERIC_READ, GENERIC_WRITE};
        use windows_sys::Win32::Security::{
            CreateRestrictedToken, ImpersonateLoggedOnUser, RevertToSelf, SID_AND_ATTRIBUTES,
            TOKEN_DUPLICATE, DISABLE_MAX_PRIVILEGE,
        };
        use windows_sys::Win32::Storage::FileSystem::{
            CreateFileW, FILE_ATTRIBUTE_NORMAL, FILE_SHARE_NONE, OPEN_EXISTING,
        };

        fn temporary_database_path(label: &str) -> PathBuf {
            std::env::temp_dir().join(format!(
                "jarvis-{label}-{}-{}.db",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .expect("system clock must be after Unix epoch")
                    .as_nanos()
            ))
        }

        fn remove_database_artifacts(database_path: &Path) {
            for suffix in ["", "-wal", "-shm"] {
                let path = if suffix.is_empty() {
                    database_path.to_owned()
                } else {
                    PathBuf::from(format!("{}{}", database_path.display(), suffix))
                };
                let _ = std::fs::remove_file(path);
            }
        }

        fn connect_client(endpoint: &str) -> OwnedHandle {
            let endpoint = wide(endpoint);
            // SAFETY: the endpoint is generated by the server and the client
            // requests only the named-pipe duplex access.
            let handle = unsafe {
                CreateFileW(
                    endpoint.as_ptr(),
                    GENERIC_READ | GENERIC_WRITE,
                    FILE_SHARE_NONE,
                    null(),
                    OPEN_EXISTING,
                    FILE_ATTRIBUTE_NORMAL,
                    null_mut(),
                )
            };
            OwnedHandle::new(handle).expect("test client must connect to the intended endpoint")
        }

        #[test]
        fn endpoint_is_unpredictable_local_and_explicitly_acl_bound() {
            let first = NamedPipeServer::bind().expect("first named pipe must bind");
            let second = NamedPipeServer::bind().expect("second named pipe must bind");
            assert_ne!(first.endpoint_name(), second.endpoint_name());
            assert!(first.endpoint_name().starts_with(r"\\.\pipe\jarvis-core-"));
            assert!(!first.endpoint_name().contains("http"));
            assert!(
                first
                    .security_descriptor_sddl()
                    .starts_with("D:P(A;;0x0012019F;;;S-1-")
            );
            assert!(!first.security_descriptor_sddl().contains("GA"));
            assert!(!first.security_descriptor_sddl().contains("WD"));
            assert!(!first.security_descriptor_sddl().contains("AN"));
        }

        #[test]
        fn same_session_client_passes_the_native_boundary() {
            let server = NamedPipeServer::bind().expect("named pipe must bind");
            let endpoint = server.endpoint_name().to_owned();
            let client = thread::spawn(move || {
                let endpoint = wide(&endpoint);
                // SAFETY: the endpoint is the server-generated NUL-terminated
                // local pipe name and the client requests only pipe I/O.
                let handle = unsafe {
                    CreateFileW(
                        endpoint.as_ptr(),
                        GENERIC_READ | GENERIC_WRITE,
                        FILE_SHARE_NONE,
                        null(),
                        OPEN_EXISTING,
                        FILE_ATTRIBUTE_NORMAL,
                        null_mut(),
                    )
                };
                let owned = OwnedHandle::new(handle).expect("same-session client must connect");
                sleep(Duration::from_millis(100));
                drop(owned);
            });
            let session = server
                .accept_client()
                .expect("same-session client must pass native boundary");
            assert_eq!(session, server.session_id());
            server.disconnect_client();
            client.join().expect("client thread must exit");
        }

        #[test]
        fn remote_named_pipe_path_is_rejected() {
            let server = NamedPipeServer::bind().expect("named pipe must bind");
            let remote_endpoint = server
                .endpoint_name()
                .replacen(r"\\.\pipe\", r"\\127.0.0.1\pipe\", 1);
            let endpoint = wide(&remote_endpoint);
            // SAFETY: the endpoint is derived from the server-generated name;
            // this deliberately uses the Windows remote-client path so the
            // pipe's local-only policy is exercised by the OS.
            let handle = unsafe {
                CreateFileW(
                    endpoint.as_ptr(),
                    GENERIC_READ | GENERIC_WRITE,
                    FILE_SHARE_NONE,
                    null(),
                    OPEN_EXISTING,
                    FILE_ATTRIBUTE_NORMAL,
                    null_mut(),
                )
            };
            assert!(
                OwnedHandle::new(handle).is_none(),
                "remote named-pipe path must not obtain a client handle"
            );
            server.disconnect_client();
        }

        #[test]
        fn restricted_principal_token_is_denied_by_the_sid_only_dacl() {
            let server = NamedPipeServer::bind().expect("named pipe must bind");
            let mut token = null_mut();
            // SAFETY: the current process owns this token request and the
            // output pointer is valid for the Windows API call.
            assert_ne!(
                unsafe {
                    OpenProcessToken(
                        GetCurrentProcess(),
                        TOKEN_QUERY | TOKEN_DUPLICATE,
                        &mut token,
                    )
                },
                0,
                "the current process token must be queryable for the live ACL test"
            );
            let token = OwnedHandle::new(token).expect("the process token must be valid");
            let mut required_bytes = 0u32;
            // SAFETY: the first query intentionally requests the required
            // bounded buffer size and passes a valid output pointer.
            unsafe {
                GetTokenInformation(token.raw(), TokenUser, null_mut(), 0, &mut required_bytes);
            }
            assert!(required_bytes > 0);
            let word_count = (required_bytes as usize).div_ceil(size_of::<usize>());
            let mut storage = vec![MaybeUninit::<usize>::uninit(); word_count];
            let mut returned_bytes = 0u32;
            // SAFETY: the allocated MaybeUninit buffer is sized from the
            // preceding Windows query and its output pointer is valid.
            assert_ne!(
                unsafe {
                    GetTokenInformation(
                        token.raw(),
                        TokenUser,
                        storage.as_mut_ptr().cast::<c_void>(),
                        (storage.len() * size_of::<usize>()) as u32,
                        &mut returned_bytes,
                    )
                },
                0
            );
            // SAFETY: Windows filled the buffer as TOKEN_USER in the prior
            // successful query, so reading the initialized structure is valid.
            let user = unsafe { storage.as_ptr().cast::<TOKEN_USER>().read() };
            let disabled_sid = SID_AND_ATTRIBUTES {
                Sid: user.User.Sid,
                Attributes: 0,
            };
            let mut restricted = null_mut();
            // SAFETY: the token and SID pointers are owned/validated above,
            // and the restricted-token output pointer is valid.
            assert_ne!(
                unsafe {
                    CreateRestrictedToken(
                        token.raw(),
                        DISABLE_MAX_PRIVILEGE,
                        1,
                        &disabled_sid,
                        0,
                        null_mut(),
                        0,
                        null_mut(),
                        &mut restricted,
                    )
                },
                0,
                "the restricted test token must be created"
            );
            let restricted = OwnedHandle::new(restricted).expect("restricted token must be valid");
            // SAFETY: the restricted token is a valid owned impersonation
            // token and the current test thread is the caller.
            assert_ne!(
                unsafe { ImpersonateLoggedOnUser(restricted.raw()) },
                0,
                "the test thread must impersonate the restricted token"
            );
            let endpoint = wide(server.endpoint_name());
            // SAFETY: the endpoint buffer is NUL-terminated and the call is
            // made only to qualify the current Windows named-pipe ACL.
            let handle = unsafe {
                CreateFileW(
                    endpoint.as_ptr(),
                    GENERIC_READ | GENERIC_WRITE,
                    FILE_SHARE_NONE,
                    null(),
                    OPEN_EXISTING,
                    FILE_ATTRIBUTE_NORMAL,
                    null_mut(),
                )
            };
            let denied = OwnedHandle::new(handle).is_none();
            // SAFETY: the test thread currently impersonates a valid token;
            // RevertToSelf has no output pointer and restores the thread.
            assert_ne!(unsafe { RevertToSelf() }, 0, "the test thread must revert identity");
            assert!(denied, "a restricted principal must not pass the SID-only DACL");
            server.disconnect_client();
        }

        #[test]
        #[ignore = "requires a separately logged-on Windows account to run the external client"]
        fn external_principal_qualification_fixture() {
            let server = NamedPipeServer::bind().expect("named pipe must bind");
            println!("JARVIS_EXTERNAL_IPC_ENDPOINT={}", server.endpoint_name());
            std::io::stdout()
                .flush()
                .expect("qualification endpoint must be visible");
            println!("Keep this test running while the separate account attempts only to open the endpoint.");
            std::io::stdout()
                .flush()
                .expect("qualification instructions must be visible");
            sleep(Duration::from_secs(600));
        }

        #[test]
        fn unconnected_server_accept_is_bounded_and_cleans_up() {
            let server = NamedPipeServer::bind().expect("named pipe must bind");
            let started = Instant::now();
            let error = server
                .accept_client()
                .expect_err("an unconnected endpoint must time out");
            assert_eq!(error.state, LocalIpcState::HandshakeTimeout);
            assert!(
                started.elapsed() < Duration::from_secs(7),
                "bounded accept must not exceed its startup deadline"
            );
        }

        #[test]
        fn bootstrap_material_is_framed_and_secret_is_not_debuggable() {
            let secret = [0x5au8; BOOTSTRAP_SECRET_BYTES];
            let material = BootstrapMaterial::from_test_parts(
                r"\\.\pipe\jarvis-core-0123456789abcdef0123456789abcdef",
                secret,
            );
            let frame = material
                .encode_frame()
                .expect("bootstrap material must encode");
            assert_eq!(
                u32::from_le_bytes(frame[..4].try_into().unwrap()) as usize,
                frame.len() - 4
            );
            assert!(!format!("{material:?}").contains("5a5a5a"));
            assert!(String::from_utf8_lossy(&frame).contains("0123456789abcdef"));
        }

        #[test]
        fn bootstrap_proof_is_bound_to_protocol_and_nonce() {
            let secret = [0x42u8; BOOTSTRAP_SECRET_BYTES];
            let nonce = [0x11u8; HANDSHAKE_NONCE_BYTES];
            let first = handshake_proof(&secret, IPC_PROTOCOL_MAJOR, &nonce);
            let changed_nonce = [0x12u8; HANDSHAKE_NONCE_BYTES];
            let second = handshake_proof(&secret, IPC_PROTOCOL_MAJOR, &changed_nonce);
            let changed_protocol = handshake_proof(&secret, 2, &nonce);
            assert!(constant_time_equal(&first, &first));
            assert!(!constant_time_equal(&first, &second));
            assert!(!constant_time_equal(&first, &changed_protocol));
        }

        #[test]
        fn mismatched_session_identity_is_rejected_by_the_native_gate() {
            assert!(!session_matches(1, 2));
            assert!(session_matches(7, 7));
        }

        #[test]
        fn native_host_and_client_complete_authenticated_handshake() {
            let server = NamedPipeServer::bind().expect("named pipe must bind");
            let endpoint = server.endpoint_name().to_owned();
            let secret = *server.bootstrap_material().secret();
            let client = thread::spawn(move || {
                let endpoint = wide(&endpoint);
                // SAFETY: the endpoint is generated by the server and the
                // client requests only the named-pipe duplex access.
                let handle = unsafe {
                    CreateFileW(
                        endpoint.as_ptr(),
                        GENERIC_READ | GENERIC_WRITE,
                        FILE_SHARE_NONE,
                        null(),
                        OPEN_EXISTING,
                        FILE_ATTRIBUTE_NORMAL,
                        null_mut(),
                    )
                };
                let owned = OwnedHandle::new(handle).expect("client must connect");
                let challenge: ChallengeWire =
                    read_json_frame(owned.raw(), Instant::now() + HANDSHAKE_TIMEOUT)
                        .expect("client must receive challenge");
                assert_eq!(challenge.protocol_major, IPC_PROTOCOL_MAJOR);
                let nonce = hex_decode(&challenge.nonce, HANDSHAKE_NONCE_BYTES)
                    .expect("challenge nonce must be valid");
                write_json_frame(
                    owned.raw(),
                    &HelloWire {
                        kind: "hello".to_owned(),
                        protocol_major: IPC_PROTOCOL_MAJOR,
                        proof: hex_encode(&handshake_proof(&secret, IPC_PROTOCOL_MAJOR, &nonce)),
                    },
                )
                .expect("client must send proof");
                let welcome: WelcomeWire =
                    read_json_frame(owned.raw(), Instant::now() + HANDSHAKE_TIMEOUT)
                        .expect("client must receive welcome");
                assert_eq!(welcome.kind, "welcome");
                let request: serde_json::Value =
                    read_json_frame(owned.raw(), Instant::now() + HANDSHAKE_TIMEOUT)
                        .expect("client must receive the locked status request");
                assert_eq!(request["protocolVersion"], 1);
                assert_eq!(request["kind"], "request");
                assert!(request["id"].is_null());
                assert_eq!(request["name"], "get_core_status");
                assert!(request["correlationId"].is_string());
                assert_eq!(request["payload"], serde_json::json!({}));
                write_json_frame(
                    owned.raw(),
                    &serde_json::json!({
                        "ok": true,
                        "result": {
                            "protocolMajor": 1,
                            "platform": "WINDOWS",
                            "runtimeRole": "FULL_HOST",
                            "architecture": "x64",
                            "serviceState": "LOCKED",
                            "transportState": "NOT_CONNECTED"
                        },
                        "error": null
                    }),
                )
                .expect("client must return the deterministic locked status");
                sleep(Duration::from_millis(100));
            });
            let authenticated = server
                .authenticate_client()
                .expect("native handshake must authenticate");
            assert_eq!(authenticated.protocol_major, IPC_PROTOCOL_MAJOR);
            let status = server
                .request_locked_status(&authenticated)
                .expect("authenticated Core must return locked status");
            assert_eq!(status.protocol_major, IPC_PROTOCOL_MAJOR);
            assert_eq!(status.platform, "WINDOWS");
            assert_eq!(status.runtime_role, "FULL_HOST");
            assert_eq!(status.architecture, "x64");
            assert_eq!(status.service_state, "LOCKED");
            assert_eq!(status.transport_state, "NOT_CONNECTED");
            client.join().expect("client thread must exit");
        }

        #[test]
        fn packaged_node_client_can_authenticate_native_server() {
            let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../../../target/x86_64-pc-windows-msvc/release/resources/core-runtime");
            let node = root.join("runtime/node.exe");
            let entrypoint = root.join("core/dist/main.js");
            if !node.is_file() || !entrypoint.is_file() {
                return;
            }
            let database_path = temporary_database_path("packaged-node");
            let server = NamedPipeServer::bind_with_database_dek([0; 32])
                .expect("named pipe must bind");
            let mut child = Command::new(node)
                .arg(&entrypoint)
                .current_dir(&root)
                .env_clear()
                .env(
                    "SystemRoot",
                    std::env::var_os("SystemRoot").expect("SystemRoot exists"),
                )
                .env("WINDIR", std::env::var_os("WINDIR").expect("WINDIR exists"))
                .env("JARVIS_CORE_ROOT", &root)
                .env("JARVIS_CORE_ENTRYPOINT", &entrypoint)
                .env("JARVIS_TUF_METADATA_DIR", root.join("tuf/metadata"))
                .env("JARVIS_DATABASE_PATH", &database_path)
                .stdin(Stdio::piped())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .expect("packaged Core must launch");
            let frame = server
                .bootstrap_material()
                .encode_frame()
                .expect("bootstrap frame must encode");
            child
                .stdin
                .take()
                .expect("Core stdin must be available")
                .write_all(&frame)
                .expect("bootstrap frame must reach Core");
            let authenticated = server
                .authenticate_client()
                .expect("packaged Core must authenticate to the native server");
            assert_eq!(authenticated.protocol_major, IPC_PROTOCOL_MAJOR);
            let _ = child.kill();
            let _ = child.wait();
            remove_database_artifacts(&database_path);
        }

        #[test]
        fn supervised_packaged_core_authenticates_native_server() {
            let release_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../../../target/x86_64-pc-windows-msvc/release");
            let resource_dir = if release_dir
                .join("resources")
                .join(crate::core_runtime::RELEASE_RUNTIME_DIRECTORY)
                .is_dir()
            {
                release_dir.join("resources")
            } else {
                release_dir
            };
            let resource_dir = std::fs::canonicalize(resource_dir)
                .expect("release resource directory must canonicalize");
            let root = resource_dir.join("core-runtime");
            if !root.is_dir() {
                return;
            }
            let layout = crate::core_runtime::CoreRuntimePolicy::new()
                .load_verified_layout(resource_dir)
                .expect("packaged Core runtime must be qualified");
            let manifest_path = root.join("runtime-manifest.json");
            let database_path = temporary_database_path("supervised-core");
            let server = NamedPipeServer::bind_with_database_dek([0; 32])
                .expect("named pipe must bind");
            let mut bootstrap_channel = server
                .create_bootstrap_channel()
                .expect("bootstrap channel must be created");
            bootstrap_channel
                .write_material(server.bootstrap_material())
                .expect("bootstrap material must be written");
            let supervisor = crate::process_supervisor::PlatformProcessSupervisor::new()
                .expect("Job Object must be created");
            let process = supervisor
                .launch_core_with_bootstrap_and_database(
                    &layout,
                    &manifest_path,
                    bootstrap_channel.reader_handle(),
                    &database_path,
                )
                .expect("supervised Core must launch");
            bootstrap_channel.close_reader();
            let authenticated = server
                .authenticate_client()
                .expect("supervised packaged Core must authenticate");
            assert_eq!(authenticated.protocol_major, IPC_PROTOCOL_MAJOR);
            process
                .terminate(0x4A52_5649)
                .expect("test Core must terminate");
            remove_database_artifacts(&database_path);
        }

        #[test]
        fn wrong_bootstrap_secret_is_rejected_after_native_session_check() {
            let server = NamedPipeServer::bind().expect("named pipe must bind");
            let endpoint = server.endpoint_name().to_owned();
            let client = thread::spawn(move || {
                let endpoint = wide(&endpoint);
                // SAFETY: the endpoint is server-generated and the requested
                // handle is limited to the named-pipe client boundary.
                let handle = unsafe {
                    CreateFileW(
                        endpoint.as_ptr(),
                        GENERIC_READ | GENERIC_WRITE,
                        FILE_SHARE_NONE,
                        null(),
                        OPEN_EXISTING,
                        FILE_ATTRIBUTE_NORMAL,
                        null_mut(),
                    )
                };
                let owned = OwnedHandle::new(handle).expect("client must connect");
                let challenge: ChallengeWire =
                    read_json_frame(owned.raw(), Instant::now() + HANDSHAKE_TIMEOUT)
                        .expect("client must receive challenge");
                let nonce = hex_decode(&challenge.nonce, HANDSHAKE_NONCE_BYTES)
                    .expect("challenge nonce must be valid");
                let wrong_secret = [0xa5u8; BOOTSTRAP_SECRET_BYTES];
                write_json_frame(
                    owned.raw(),
                    &HelloWire {
                        kind: "hello".to_owned(),
                        protocol_major: IPC_PROTOCOL_MAJOR,
                        proof: hex_encode(&handshake_proof(
                            &wrong_secret,
                            IPC_PROTOCOL_MAJOR,
                            &nonce,
                        )),
                    },
                )
                .expect("client must send the wrong proof");
            });
            let error = server
                .authenticate_client()
                .expect_err("wrong bootstrap secret must fail closed");
            assert_eq!(error.state, LocalIpcState::AuthenticationFailed);
            client.join().expect("client thread must exit");
        }

        #[test]
        fn protocol_mismatch_is_rejected_before_authentication() {
            let server = NamedPipeServer::bind().expect("named pipe must bind");
            let endpoint = server.endpoint_name().to_owned();
            let client = thread::spawn(move || {
                let owned = connect_client(&endpoint);
                let challenge: ChallengeWire =
                    read_json_frame(owned.raw(), Instant::now() + HANDSHAKE_TIMEOUT)
                        .expect("client must receive challenge");
                let nonce = hex_decode(&challenge.nonce, HANDSHAKE_NONCE_BYTES)
                    .expect("challenge nonce must be valid");
                write_json_frame(
                    owned.raw(),
                    &HelloWire {
                        kind: "hello".to_owned(),
                        protocol_major: IPC_PROTOCOL_MAJOR + 1,
                        proof: hex_encode(&handshake_proof(
                            &[0u8; BOOTSTRAP_SECRET_BYTES],
                            IPC_PROTOCOL_MAJOR + 1,
                            &nonce,
                        )),
                    },
                )
                .expect("client must send protocol-mismatch frame");
            });
            let error = server
                .authenticate_client()
                .expect_err("unsupported protocol major must fail closed");
            assert_eq!(error.state, LocalIpcState::ProtocolMismatch);
            client.join().expect("client thread must exit");
        }

        #[test]
        fn malformed_handshake_frame_is_rejected_and_disconnected() {
            let server = NamedPipeServer::bind().expect("named pipe must bind");
            let endpoint = server.endpoint_name().to_owned();
            let client = thread::spawn(move || {
                let owned = connect_client(&endpoint);
                let _: ChallengeWire =
                    read_json_frame(owned.raw(), Instant::now() + HANDSHAKE_TIMEOUT)
                        .expect("client must receive challenge");
                write_all(owned.raw(), &[1, 0, 0, 0, b'{'])
                    .expect("client must send malformed frame");
                sleep(Duration::from_millis(200));
            });
            let error = server
                .authenticate_client()
                .expect_err("malformed handshake frame must fail closed");
            assert_eq!(error.state, LocalIpcState::FrameMalformed);
            client.join().expect("client thread must exit");
        }

        #[test]
        fn oversized_handshake_frame_is_rejected_before_allocation() {
            let server = NamedPipeServer::bind().expect("named pipe must bind");
            let endpoint = server.endpoint_name().to_owned();
            let client = thread::spawn(move || {
                let owned = connect_client(&endpoint);
                let _: ChallengeWire =
                    read_json_frame(owned.raw(), Instant::now() + HANDSHAKE_TIMEOUT)
                        .expect("client must receive challenge");
                let length = ((MAX_IPC_FRAME_BYTES + 1) as u32).to_le_bytes();
                write_all(owned.raw(), &length).expect("client must send oversized length");
            });
            let error = server
                .authenticate_client()
                .expect_err("oversized handshake frame must fail closed");
            assert_eq!(error.state, LocalIpcState::FrameTooLarge);
            client.join().expect("client thread must exit");
        }
    }
}

#[cfg(windows)]
pub use windows::{BootstrapChannel, NamedPipeServer};

#[cfg(not(windows))]
#[derive(Debug)]
pub struct NamedPipeServer;

#[cfg(not(windows))]
impl NamedPipeServer {
    pub fn bind() -> Result<Self, LocalIpcError> {
        Err(LocalIpcError {
            state: LocalIpcState::UnsupportedPlatform,
            detail: "Windows named-pipe IPC is unavailable on this target".to_owned(),
            win32_error: None,
        })
    }
}
