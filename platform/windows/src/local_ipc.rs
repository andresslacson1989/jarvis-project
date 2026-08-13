//! Windows V1 PlatformLocalIpc endpoint.
//!
//! This module owns only the native endpoint/security boundary. Bootstrap
//! authentication and framed protocol negotiation are implemented by the next
//! IPC subsection; a connected peer is not trusted merely because Windows
//! allowed it through the DACL/session gate.

use std::error::Error;
use std::fmt::{Display, Formatter};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const IPC_PROTOCOL_MAJOR: u32 = 1;
pub const MAX_IPC_FRAME_BYTES: usize = 1024 * 1024;
const MAX_BOOTSTRAP_FRAME_BYTES: usize = 64 * 1024;
const BOOTSTRAP_SECRET_BYTES: usize = 32;
const HANDSHAKE_NONCE_BYTES: usize = 32;
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
    protocol_major: u32,
}

impl std::fmt::Debug for BootstrapMaterial {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("BootstrapMaterial")
            .field("endpoint_name", &self.endpoint_name)
            .field("protocol_major", &self.protocol_major)
            .field("secret", &"<redacted>")
            .finish()
    }
}

impl BootstrapMaterial {
    #[cfg(windows)]
    fn new(endpoint_name: &str) -> Result<Self, LocalIpcError> {
        let secret = windows::random_bytes::<BOOTSTRAP_SECRET_BYTES>()?;
        Ok(Self {
            endpoint_name: endpoint_name.to_owned(),
            secret,
            protocol_major: IPC_PROTOCOL_MAJOR,
        })
    }

    #[cfg(test)]
    fn from_test_parts(endpoint_name: &str, secret: [u8; BOOTSTRAP_SECRET_BYTES]) -> Self {
        Self {
            endpoint_name: endpoint_name.to_owned(),
            secret,
            protocol_major: IPC_PROTOCOL_MAJOR,
        }
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
        };
        let payload = serde_json::to_vec(&wire).map_err(|_| LocalIpcError {
            state: LocalIpcState::BootstrapEncodingFailed,
            detail: "bootstrap material could not be encoded".to_owned(),
            win32_error: None,
        })?;
        encode_frame(&payload, MAX_BOOTSTRAP_FRAME_BYTES)
    }

    fn secret(&self) -> &[u8; BOOTSTRAP_SECRET_BYTES] {
        &self.secret
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AuthenticatedCoreSession {
    pub protocol_major: u32,
    pub session_id: u32,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BootstrapWire {
    protocol_major: u32,
    endpoint: String,
    secret: String,
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
        AuthenticatedCoreSession, BootstrapMaterial, ChallengeWire, HANDSHAKE_NONCE_BYTES,
        HelloWire, IPC_PROTOCOL_MAJOR, LocalIpcError, LocalIpcState, MAX_IPC_FRAME_BYTES,
        WelcomeWire, encode_frame,
    };
    use serde::{Deserialize, Serialize};
    use std::ffi::c_void;
    use std::mem::{MaybeUninit, size_of};
    use std::os::windows::ffi::OsStrExt;
    use std::ptr::null_mut;
    use std::sync::mpsc::{RecvTimeoutError, channel};
    use std::thread::sleep;
    use std::time::{Duration, Instant};

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
        FILE_FLAG_FIRST_PIPE_INSTANCE, PIPE_ACCESS_DUPLEX,
    };
    use windows_sys::Win32::Storage::FileSystem::{ReadFile, WriteFile};
    use windows_sys::Win32::System::Pipes::{
        ConnectNamedPipe, CreateNamedPipeW, CreatePipe, DisconnectNamedPipe,
        GetNamedPipeClientSessionId, PIPE_READMODE_BYTE, PIPE_REJECT_REMOTE_CLIENTS,
        PIPE_TYPE_BYTE, PIPE_WAIT, PeekNamedPipe,
    };
    use windows_sys::Win32::System::RemoteDesktop::ProcessIdToSessionId;
    use windows_sys::Win32::System::Threading::{
        GetCurrentProcess, GetCurrentProcessId, OpenProcessToken,
    };

    const PIPE_BUFFER_BYTES: u32 = 64 * 1024;
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
        let worker = std::thread::spawn(move || {
            // SAFETY: the server retains ownership of the named-pipe handle
            // until this bounded connect attempt is cancelled.
            let connected = unsafe { ConnectNamedPipe(raw_handle as HANDLE, null_mut()) };
            let result = if connected != 0 {
                Ok(())
            } else {
                // SAFETY: GetLastError reads this worker thread's Windows
                // error state immediately after ConnectNamedPipe returned.
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

        match receiver.recv_timeout(HANDSHAKE_TIMEOUT) {
            Ok(result) => {
                let _ = worker.join();
                result
            }
            Err(RecvTimeoutError::Timeout) => {
                // SAFETY: cancelling the synchronous connect wakes the
                // worker before the handle is used by the next lifecycle.
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
            let endpoint_name = random_endpoint_name()?;
            let sid = current_user_sid_string()?;
            let security_descriptor_sddl = format!("D:P(A;;GA;;;{sid})");
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

            let bootstrap_material = BootstrapMaterial::new(&endpoint_name)?;
            Ok(Self {
                endpoint_name,
                security_descriptor_sddl,
                session_id: current_session_id()?,
                handle,
                bootstrap_material,
            })
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
            if client_session != self.session_id {
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
            let result = write_all(writer.raw(), &frame);
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
        use std::ptr::{null, null_mut};
        use std::thread;
        use windows_sys::Win32::Foundation::{GENERIC_READ, GENERIC_WRITE};
        use windows_sys::Win32::Storage::FileSystem::{
            CreateFileW, FILE_ATTRIBUTE_NORMAL, FILE_SHARE_NONE, OPEN_EXISTING,
        };

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
                    .starts_with("D:P(A;;GA;;;S-1-")
            );
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
            });
            let authenticated = server
                .authenticate_client()
                .expect("native handshake must authenticate");
            assert_eq!(authenticated.protocol_major, IPC_PROTOCOL_MAJOR);
            client.join().expect("client thread must exit");
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
