//! Windows V1 PlatformLocalIpc endpoint.
//!
//! This module owns only the native endpoint/security boundary. Bootstrap
//! authentication and framed protocol negotiation are implemented by the next
//! IPC subsection; a connected peer is not trusted merely because Windows
//! allowed it through the DACL/session gate.

use std::error::Error;
use std::fmt::{Display, Formatter};

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

#[cfg(windows)]
mod windows {
    use super::{LocalIpcError, LocalIpcState};
    use std::ffi::c_void;
    use std::mem::{MaybeUninit, size_of};
    use std::os::windows::ffi::OsStrExt;
    use std::ptr::null_mut;

    use windows_sys::Win32::Foundation::{
        CloseHandle, ERROR_PIPE_CONNECTED, GetLastError, HANDLE, INVALID_HANDLE_VALUE, LocalFree,
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
    use windows_sys::Win32::System::Pipes::{
        ConnectNamedPipe, CreateNamedPipeW, DisconnectNamedPipe, GetNamedPipeClientSessionId,
        PIPE_READMODE_BYTE, PIPE_REJECT_REMOTE_CLIENTS, PIPE_TYPE_BYTE, PIPE_WAIT,
    };
    use windows_sys::Win32::System::RemoteDesktop::ProcessIdToSessionId;
    use windows_sys::Win32::System::Threading::{
        GetCurrentProcess, GetCurrentProcessId, OpenProcessToken,
    };

    const PIPE_BUFFER_BYTES: u32 = 64 * 1024;
    const SECURITY_DESCRIPTOR_REVISION: u32 = 1;
    const RANDOM_NAME_BYTES: usize = 16;

    #[derive(Debug)]
    struct OwnedHandle(HANDLE);

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

    fn wide(value: &str) -> Vec<u16> {
        std::ffi::OsStr::new(value)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    fn random_endpoint_name() -> Result<String, LocalIpcError> {
        let mut bytes = [0u8; RANDOM_NAME_BYTES];
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
                "BCryptGenRandom failed; Core IPC endpoint creation is blocked",
            ));
        }

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

            Ok(Self {
                endpoint_name,
                security_descriptor_sddl,
                session_id: current_session_id()?,
                handle,
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

        /// Wait for one client and enforce the current interactive session.
        /// Bootstrap authentication is intentionally a separate later gate.
        pub fn accept_client(&self) -> Result<u32, LocalIpcError> {
            // SAFETY: this is a synchronous server handle and no overlapped
            // structure is used.
            let connected = unsafe { ConnectNamedPipe(self.handle.raw(), null_mut()) };
            if connected == 0 {
                // SAFETY: GetLastError reads the calling thread's Windows
                // error state and has no pointer or handle precondition.
                let error = unsafe { GetLastError() };
                if error != ERROR_PIPE_CONNECTED {
                    return Err(LocalIpcError {
                        state: LocalIpcState::ClientConnectionFailed,
                        detail: "ConnectNamedPipe failed".to_owned(),
                        win32_error: Some(error),
                    });
                }
            }

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
                drop(owned);
            });
            let session = server
                .accept_client()
                .expect("same-session client must pass native boundary");
            assert_eq!(session, server.session_id());
            server.disconnect_client();
            client.join().expect("client thread must exit");
        }
    }
}

#[cfg(windows)]
pub use windows::NamedPipeServer;

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
