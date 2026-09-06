use std::{ptr, slice};

use windows_sys::Win32::{
    Foundation::{GENERIC_ALL, HLOCAL},
    Security::Authorization::{
        ConvertSidToStringSidW, ConvertStringSecurityDescriptorToSecurityDescriptorW,
        ConvertStringSidToSidW, GetSecurityInfo, SE_FILE_OBJECT, SetSecurityInfo,
    },
    Security::{
        ACCESS_ALLOWED_ACE, ACL_SIZE_INFORMATION, AclSizeInformation, DACL_SECURITY_INFORMATION,
        EqualSid, GetAce, GetAclInformation, GetSecurityDescriptorControl,
        GetSecurityDescriptorDacl, OBJECT_SECURITY_INFORMATION,
        PROTECTED_DACL_SECURITY_INFORMATION, SE_DACL_PROTECTED, SECURITY_ATTRIBUTES, TOKEN_QUERY,
        TOKEN_USER, TokenUser,
    },
    Storage::FileSystem::FILE_ALL_ACCESS,
    System::Threading::{GetCurrentProcess, OpenProcessToken},
};

const ACCESS_ALLOWED_ACE_TYPE: u8 = 0;

use super::{
    NativeError, NativeErrorKind,
    handles::{OwnedHandle, native_failure, wide},
};

/// A protected object descriptor whose backing allocation outlives the
/// SECURITY_ATTRIBUTES value passed to every creator.
pub(super) struct ExplicitSecurity {
    descriptor: windows_sys::Win32::Security::PSECURITY_DESCRIPTOR,
    dacl: *mut windows_sys::Win32::Security::ACL,
    attrs: SECURITY_ATTRIBUTES,
    _sddl: Vec<u16>,
}

impl ExplicitSecurity {
    pub(super) fn for_sid(sid: &str) -> Result<Self, NativeError> {
        let sddl = wide(&format!("D:P(A;;GA;;;{sid})"));
        let mut descriptor = ptr::null_mut();
        let mut descriptor_size = 0u32;

        // SAFETY: the SDDL buffer is NUL terminated and remains owned by the
        // returned value. Windows allocates the descriptor, which is released
        // by Drop below.
        let ok = unsafe {
            ConvertStringSecurityDescriptorToSecurityDescriptorW(
                sddl.as_ptr(),
                windows_sys::Win32::Security::Authorization::SDDL_REVISION_1,
                &mut descriptor,
                &mut descriptor_size,
            )
        };
        if ok == 0 || descriptor.is_null() || descriptor_size == 0 {
            return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
        }

        let attrs = SECURITY_ATTRIBUTES {
            nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: descriptor,
            bInheritHandle: 0,
        };

        let mut dacl = ptr::null_mut();
        let mut dacl_present = 0;
        let mut dacl_defaulted = 0;
        // SAFETY: descriptor was returned by the successful conversion and
        // all output pointers are writable.
        if unsafe {
            windows_sys::Win32::Security::GetSecurityDescriptorDacl(
                descriptor,
                &mut dacl_present,
                &mut dacl,
                &mut dacl_defaulted,
            )
        } == 0
            || dacl_present == 0
            || dacl.is_null()
        {
            // SAFETY: descriptor is the LocalAlloc-owned conversion result.
            unsafe {
                let _ = windows_sys::Win32::Foundation::LocalFree(descriptor as HLOCAL);
            }
            return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
        }

        Ok(Self {
            descriptor,
            dacl,
            attrs,
            _sddl: sddl,
        })
    }

    pub(super) fn as_ptr(&self) -> *const SECURITY_ATTRIBUTES {
        &self.attrs
    }

    pub(super) fn apply_to_handle(
        &self,
        handle: &OwnedHandle,
        object_type: windows_sys::Win32::Security::Authorization::SE_OBJECT_TYPE,
    ) -> Result<(), NativeError> {
        let information: OBJECT_SECURITY_INFORMATION =
            DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION;
        // SAFETY: the object handle and descriptor-backed DACL are valid for
        // this synchronous security update.
        let result = unsafe {
            SetSecurityInfo(
                handle.raw(),
                object_type,
                information,
                ptr::null_mut(),
                ptr::null_mut(),
                self.dacl,
                ptr::null_mut(),
            )
        };
        if result == 0 {
            Ok(())
        } else {
            Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable))
        }
    }

    pub(super) fn validate_handle(
        &self,
        handle: &OwnedHandle,
        sid: &str,
    ) -> Result<(), NativeError> {
        let sid_w = wide(sid);
        let mut expected_sid = ptr::null_mut();
        // SAFETY: the SID string is NUL terminated and the output pointer is
        // valid for one LocalAlloc-owned SID value.
        if unsafe { ConvertStringSidToSidW(sid_w.as_ptr(), &mut expected_sid) } == 0
            || expected_sid.is_null()
        {
            return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
        }

        let mut descriptor = ptr::null_mut();
        let mut dacl = ptr::null_mut();
        // SAFETY: the handle is valid and all output pointers are writable.
        let result = unsafe {
            GetSecurityInfo(
                handle.raw(),
                SE_FILE_OBJECT,
                DACL_SECURITY_INFORMATION,
                ptr::null_mut(),
                ptr::null_mut(),
                &mut dacl,
                ptr::null_mut(),
                &mut descriptor,
            )
        };
        let valid = if result == 0 && !descriptor.is_null() && !dacl.is_null() {
            let mut control = 0u16;
            let mut revision = 0u32;
            let mut dacl_present = 0;
            let mut dacl_defaulted = 0;
            // SAFETY: the descriptor/dacl pointers were returned by the
            // successful GetSecurityInfo call.
            let control_ok =
                unsafe { GetSecurityDescriptorControl(descriptor, &mut control, &mut revision) }
                    != 0;
            // SAFETY: the descriptor pointer is valid and outputs are writable.
            let dacl_ok = unsafe {
                GetSecurityDescriptorDacl(
                    descriptor,
                    &mut dacl_present,
                    &mut dacl,
                    &mut dacl_defaulted,
                )
            } != 0;
            if !control_ok || !dacl_ok || dacl_present == 0 || (control & SE_DACL_PROTECTED) == 0 {
                false
            } else {
                let mut size = ACL_SIZE_INFORMATION::default();
                // SAFETY: the ACL pointer and size output are valid.
                let acl_ok = unsafe {
                    GetAclInformation(
                        dacl,
                        &mut size as *mut _ as *mut _,
                        std::mem::size_of::<ACL_SIZE_INFORMATION>() as u32,
                        AclSizeInformation,
                    )
                } != 0;
                if !acl_ok || size.AceCount != 1 {
                    false
                } else {
                    let mut ace = ptr::null_mut();
                    // SAFETY: the ACL has exactly one entry according to the
                    // validated ACL_SIZE_INFORMATION.
                    let ace_ok = unsafe { GetAce(dacl, 0, &mut ace) } != 0;
                    if !ace_ok || ace.is_null() {
                        false
                    } else {
                        // SAFETY: the first ACE is at least the fixed
                        // ACCESS_ALLOWED_ACE header/fields by Windows ACL
                        // layout; the type and size checks avoid over-read.
                        let allowed = unsafe { &*(ace.cast::<ACCESS_ALLOWED_ACE>()) };
                        let sid_start = &allowed.SidStart as *const u32 as *mut std::ffi::c_void;
                        // SAFETY: the SID pointer is within the validated
                        // ACCESS_ALLOWED_ACE returned by GetAce.
                        let equal_sid = unsafe { EqualSid(sid_start, expected_sid) } != 0;
                        allowed.Header.AceType == ACCESS_ALLOWED_ACE_TYPE
                            && allowed.Header.AceFlags == 0
                            && allowed.Header.AceSize as usize
                                >= std::mem::size_of::<ACCESS_ALLOWED_ACE>()
                            && (allowed.Mask == GENERIC_ALL || allowed.Mask == FILE_ALL_ACCESS)
                            && equal_sid
                    }
                }
            }
        } else {
            false
        };

        // SAFETY: both allocations are owned by LocalAlloc-compatible Win32
        // security APIs.
        unsafe {
            let _ = windows_sys::Win32::Foundation::LocalFree(expected_sid as HLOCAL);
            if !descriptor.is_null() {
                let _ = windows_sys::Win32::Foundation::LocalFree(descriptor as HLOCAL);
            }
        }
        if valid {
            Ok(())
        } else {
            Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable))
        }
    }
}

impl Drop for ExplicitSecurity {
    fn drop(&mut self) {
        // SAFETY: ConvertStringSecurityDescriptorToSecurityDescriptorW
        // allocates with LocalAlloc and LocalFree owns the matching release.
        unsafe {
            let _ = windows_sys::Win32::Foundation::LocalFree(self.descriptor as HLOCAL);
        }
    }
}

pub(super) fn current_sid() -> Result<String, NativeError> {
    let mut token = ptr::null_mut();
    // SAFETY: GetCurrentProcess returns a valid pseudo-handle and the output
    // pointer is valid for one HANDLE value.
    let opened = unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) };
    if opened == 0 {
        return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
    }
    let token = OwnedHandle::from_raw(token, NativeErrorKind::SecurityBoundaryUnavailable)?;

    let mut length = 0u32;
    // SAFETY: the first call intentionally supplies a null buffer to obtain
    // the required TOKEN_USER size.
    unsafe {
        let _ = windows_sys::Win32::Security::GetTokenInformation(
            token.raw(),
            TokenUser,
            ptr::null_mut(),
            0,
            &mut length,
        );
    }
    if length == 0 {
        return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
    }

    let word_count = (length as usize).div_ceil(std::mem::size_of::<u64>());
    let mut buffer = vec![0u64; word_count];
    // SAFETY: the buffer has the size returned by the first query and is
    // aligned sufficiently for the Windows TOKEN_USER structure because Vec
    // allocations meet the platform alignment requirement for u8 buffers.
    let queried = unsafe {
        windows_sys::Win32::Security::GetTokenInformation(
            token.raw(),
            TokenUser,
            buffer.as_mut_ptr().cast(),
            (buffer.len() * std::mem::size_of::<u64>()) as u32,
            &mut length,
        )
    };
    if queried == 0 {
        return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
    }

    // SAFETY: GetTokenInformation wrote a complete TOKEN_USER record into the
    // sized buffer; the SID pointer is owned by that buffer.
    let user = unsafe { &*(buffer.as_ptr().cast::<TOKEN_USER>()) };
    let mut sid_string = ptr::null_mut();
    // SAFETY: the SID pointer came from the validated TOKEN_USER record and
    // the output pointer is valid for one PWSTR value.
    let converted = unsafe { ConvertSidToStringSidW(user.User.Sid, &mut sid_string) };
    if converted == 0 || sid_string.is_null() {
        return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
    }

    // SAFETY: Windows returns a NUL-terminated UTF-16 SID string.
    let sid = unsafe {
        let mut length = 0usize;
        while *sid_string.add(length) != 0 {
            length += 1;
        }
        String::from_utf16(slice::from_raw_parts(sid_string, length))
    }
    .map_err(|_| native_failure(NativeErrorKind::SecurityBoundaryUnavailable));

    // SAFETY: ConvertSidToStringSidW allocates its result with LocalAlloc.
    unsafe {
        let _ = windows_sys::Win32::Foundation::LocalFree(sid_string as HLOCAL);
    }

    sid
}
