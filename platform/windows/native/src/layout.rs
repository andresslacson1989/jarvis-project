use std::path::{Path, PathBuf};

#[cfg(feature = "test-support")]
use std::sync::atomic::{AtomicBool, Ordering};

use super::{
    NativeError, NativeErrorKind, REQUIRED_DATA_DIRECTORIES,
    handles::OwnedHandle,
    identity::{self, FileIdentity},
    security::ExplicitSecurity,
};

const ROOT_NAME: &str = "JARVIS";
const STATE_FILE_NAME: &str = "owner.state";

#[cfg(feature = "test-support")]
static REPLACE_ROOT_AFTER_SNAPSHOT: AtomicBool = AtomicBool::new(false);

#[derive(Debug)]
pub(super) struct PreparedLayout {
    pub(super) local_app_data: PathBuf,
    pub(super) parent: OwnedHandle,
    pub(super) parent_identity: FileIdentity,
}

#[derive(Debug)]
pub(super) struct Layout {
    pub(super) _local_app_data: PathBuf,
    pub(super) _parent: OwnedHandle,
    pub(super) parent_identity: FileIdentity,
    pub(super) _root: OwnedHandle,
    pub(super) root_identity: FileIdentity,
    pub(super) _children: Vec<OwnedHandle>,
    pub(super) _root_path: PathBuf,
    pub(super) state_path: PathBuf,
}

pub(super) fn prepare() -> Result<PreparedLayout, NativeError> {
    let local_app_data = identity::local_app_data()?;
    let path_snapshot = identity::validate_trusted_path_chain(&local_app_data, true)?;
    let parent = identity::open_directory(&local_app_data, None)?;
    let parent_identity = identity::identity(&parent)?;
    if path_snapshot.final_identity != parent_identity {
        record_test_failure!("layout.prepare_path_identity", "FileIdentity::compare", 0);
        return Err(NativeError {
            kind: NativeErrorKind::SecurityBoundaryUnavailable,
        });
    }
    Ok(PreparedLayout {
        local_app_data,
        parent,
        parent_identity,
    })
}

impl PreparedLayout {
    pub(super) fn validate_existing(
        self,
        sid: &str,
        security: &ExplicitSecurity,
    ) -> Result<Layout, NativeError> {
        let before = identity::validate_trusted_path_chain(&self.local_app_data, true)?;
        let current_parent = identity::open_directory(&self.local_app_data, None)?;
        let current_identity = identity::identity(&current_parent)?;
        if current_identity != self.parent_identity || before.final_identity != current_identity {
            record_test_failure!(
                "layout.validate_parent_identity",
                "FileIdentity::compare",
                0,
            );
            return Err(NativeError {
                kind: NativeErrorKind::SecurityBoundaryUnavailable,
            });
        }

        let root_path = self.local_app_data.join(ROOT_NAME);
        let root = identity::open_directory(&root_path, None)?;
        security.validate_handle(
            &root,
            sid,
            windows_sys::Win32::Security::Authorization::SE_FILE_OBJECT,
        )?;
        let root_identity = identity::identity(&root)?;
        let root_snapshot = identity::validate_trusted_path_chain(&root_path, true)?;
        if root_snapshot.final_identity != root_identity {
            record_test_failure!(
                "layout.validate_root_snapshot_identity",
                "FileIdentity::compare",
                0
            );
            return Err(NativeError {
                kind: NativeErrorKind::PathIdentityMismatch,
            });
        }
        let mut children = Vec::with_capacity(REQUIRED_DATA_DIRECTORIES.len());
        let mut child_snapshots = Vec::with_capacity(REQUIRED_DATA_DIRECTORIES.len());
        for name in REQUIRED_DATA_DIRECTORIES {
            let child_path = root_path.join(name);
            let child = identity::open_directory(&child_path, None)?;
            security.validate_handle(
                &child,
                sid,
                windows_sys::Win32::Security::Authorization::SE_FILE_OBJECT,
            )?;
            let child_identity = identity::identity(&child)?;
            let child_snapshot = identity::validate_trusted_path_chain(&child_path, true)?;
            if child_snapshot.final_identity != child_identity {
                record_test_failure!(
                    "layout.validate_child_snapshot_identity",
                    "FileIdentity::compare",
                    0
                );
                return Err(NativeError {
                    kind: NativeErrorKind::PathIdentityMismatch,
                });
            }
            child_snapshots.push((child_path, child_identity, child_snapshot));
            children.push(child);
        }
        let after = identity::validate_trusted_path_chain(&self.local_app_data, true)?;
        if after != before {
            record_test_failure!(
                "layout.validate_parent_chain_changed",
                "FileIdentity::compare",
                0
            );
            return Err(NativeError {
                kind: NativeErrorKind::SecurityBoundaryUnavailable,
            });
        }
        revalidate_layout_identities(LayoutIdentityExpectations {
            local_app_data: &self.local_app_data,
            root_path: &root_path,
            expected_parent: self.parent_identity,
            expected_root: root_identity,
            expected_root_snapshot: &root_snapshot,
            expected_children: &child_snapshots,
            sid,
            security,
        })?;

        Ok(Layout {
            _local_app_data: self.local_app_data,
            _parent: self.parent,
            parent_identity: self.parent_identity,
            _root: root,
            root_identity,
            _children: children,
            _root_path: root_path.clone(),
            state_path: root_path.join(STATE_FILE_NAME),
        })
    }

    pub(super) fn finish(
        self,
        security: &ExplicitSecurity,
        sid: &str,
    ) -> Result<Layout, NativeError> {
        let before = identity::validate_trusted_path_chain(&self.local_app_data, true)?;
        let current_parent = identity::open_directory(&self.local_app_data, None)?;
        let current_identity = identity::identity(&current_parent)?;
        if current_identity != self.parent_identity || before.final_identity != current_identity {
            record_test_failure!("layout.finish_parent_identity", "FileIdentity::compare", 0);
            return Err(NativeError {
                kind: NativeErrorKind::SecurityBoundaryUnavailable,
            });
        }

        let root_path = self.local_app_data.join(ROOT_NAME);
        let root = identity::create_or_open_directory(&root_path, security, sid)?;
        let root_identity = identity::identity(&root)?;
        let root_snapshot = identity::validate_trusted_path_chain(&root_path, true)?;
        if root_snapshot.final_identity != root_identity {
            record_test_failure!(
                "layout.finish_root_snapshot_identity",
                "FileIdentity::compare",
                0
            );
            return Err(NativeError {
                kind: NativeErrorKind::PathIdentityMismatch,
            });
        }

        #[cfg(feature = "test-support")]
        if REPLACE_ROOT_AFTER_SNAPSHOT.swap(false, Ordering::AcqRel) {
            replace_root_for_test(&root_path)?;
        }

        let mut children = Vec::with_capacity(REQUIRED_DATA_DIRECTORIES.len());
        let mut child_snapshots = Vec::with_capacity(REQUIRED_DATA_DIRECTORIES.len());
        for name in REQUIRED_DATA_DIRECTORIES {
            let path = root_path.join(name);
            let child = identity::create_or_open_directory(&path, security, sid)?;
            let child_identity = identity::identity(&child)?;
            let child_snapshot = identity::validate_trusted_path_chain(&path, true)?;
            if child_snapshot.final_identity != child_identity {
                record_test_failure!(
                    "layout.finish_child_snapshot_identity",
                    "FileIdentity::compare",
                    0
                );
                return Err(NativeError {
                    kind: NativeErrorKind::PathIdentityMismatch,
                });
            }
            child_snapshots.push((path, child_identity, child_snapshot));
            children.push(child);
        }

        let after = identity::validate_trusted_path_chain(&self.local_app_data, true)?;
        if after != before {
            record_test_failure!(
                "layout.finish_parent_chain_changed",
                "FileIdentity::compare",
                0
            );
            return Err(NativeError {
                kind: NativeErrorKind::SecurityBoundaryUnavailable,
            });
        }
        revalidate_layout_identities(LayoutIdentityExpectations {
            local_app_data: &self.local_app_data,
            root_path: &root_path,
            expected_parent: self.parent_identity,
            expected_root: root_identity,
            expected_root_snapshot: &root_snapshot,
            expected_children: &child_snapshots,
            sid,
            security,
        })?;

        let state_path = root_path.join(STATE_FILE_NAME);
        Ok(Layout {
            _local_app_data: self.local_app_data,
            _parent: self.parent,
            parent_identity: self.parent_identity,
            _root: root,
            root_identity,
            _children: children,
            _root_path: root_path,
            state_path,
        })
    }
}

struct LayoutIdentityExpectations<'a> {
    local_app_data: &'a Path,
    root_path: &'a Path,
    expected_parent: FileIdentity,
    expected_root: FileIdentity,
    expected_root_snapshot: &'a identity::PathChainSnapshot,
    expected_children: &'a [(PathBuf, FileIdentity, identity::PathChainSnapshot)],
    sid: &'a str,
    security: &'a ExplicitSecurity,
}

fn revalidate_layout_identities(
    expectations: LayoutIdentityExpectations<'_>,
) -> Result<(), NativeError> {
    let parent_snapshot = identity::validate_trusted_path_chain(expectations.local_app_data, true)?;
    if parent_snapshot.final_identity != expectations.expected_parent {
        record_test_failure!(
            "layout.revalidate_parent_identity",
            "FileIdentity::compare",
            0
        );
        return Err(NativeError {
            kind: NativeErrorKind::PathIdentityMismatch,
        });
    }

    let root_snapshot = identity::validate_trusted_path_chain(expectations.root_path, true)?;
    if root_snapshot != *expectations.expected_root_snapshot
        || root_snapshot.final_identity != expectations.expected_root
    {
        record_test_failure!(
            "layout.revalidate_root_identity",
            "PathChainSnapshot::compare",
            0
        );
        return Err(NativeError {
            kind: NativeErrorKind::PathIdentityMismatch,
        });
    }
    let root = identity::open_directory(expectations.root_path, None)?;
    expectations.security.validate_handle(
        &root,
        expectations.sid,
        windows_sys::Win32::Security::Authorization::SE_FILE_OBJECT,
    )?;
    if identity::identity(&root)? != expectations.expected_root {
        record_test_failure!(
            "layout.revalidate_root_handle_identity",
            "FileIdentity::compare",
            0
        );
        return Err(NativeError {
            kind: NativeErrorKind::PathIdentityMismatch,
        });
    }

    for (child_path, expected_child, expected_snapshot) in expectations.expected_children {
        let child_snapshot = identity::validate_trusted_path_chain(child_path, true)?;
        if child_snapshot != *expected_snapshot || child_snapshot.final_identity != *expected_child
        {
            record_test_failure!(
                "layout.revalidate_child_identity",
                "PathChainSnapshot::compare",
                0
            );
            return Err(NativeError {
                kind: NativeErrorKind::PathIdentityMismatch,
            });
        }
        let child = identity::open_directory(child_path, None)?;
        expectations.security.validate_handle(
            &child,
            expectations.sid,
            windows_sys::Win32::Security::Authorization::SE_FILE_OBJECT,
        )?;
        if identity::identity(&child)? != *expected_child {
            record_test_failure!(
                "layout.revalidate_child_handle_identity",
                "FileIdentity::compare",
                0
            );
            return Err(NativeError {
                kind: NativeErrorKind::PathIdentityMismatch,
            });
        }
    }
    Ok(())
}

#[cfg(feature = "test-support")]
fn replace_root_for_test(root_path: &Path) -> Result<(), NativeError> {
    let backup_path = root_path.with_file_name("JARVIS-replaced-root");
    let _ = std::fs::remove_dir_all(&backup_path);
    std::fs::rename(root_path, &backup_path).map_err(|_| NativeError {
        kind: NativeErrorKind::PathIdentityMismatch,
    })?;
    std::fs::create_dir(root_path).map_err(|_| NativeError {
        kind: NativeErrorKind::PathIdentityMismatch,
    })?;
    Ok(())
}

#[cfg(all(test, feature = "test-support"))]
mod tests {
    use std::sync::{Mutex, OnceLock};

    use super::{PreparedLayout, REPLACE_ROOT_AFTER_SNAPSHOT};
    use crate::{
        identity,
        security::{DIRECTORY_ACCESS_MASK, ExplicitSecurity, current_sid},
    };

    static LAYOUT_TEST_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

    #[test]
    fn finish_rejects_root_replacement_between_root_and_children() {
        let _guard = LAYOUT_TEST_LOCK
            .get_or_init(|| Mutex::new(()))
            .lock()
            .expect("layout test lock must not be poisoned");
        let fixture = std::env::temp_dir().join(format!(
            "JARVIS-LayoutReplacement-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("test clock must be after Unix epoch")
                .as_nanos()
        ));
        std::fs::create_dir_all(&fixture).expect("layout fixture must be created");
        let parent = identity::open_directory(&fixture, None).expect("layout parent must open");
        let parent_identity = identity::identity(&parent).expect("layout parent identity");
        let prepared = PreparedLayout {
            local_app_data: fixture.clone(),
            parent,
            parent_identity,
        };
        let sid = current_sid().expect("the Windows test principal must have a SID");
        let security = ExplicitSecurity::for_sid(&sid, DIRECTORY_ACCESS_MASK)
            .expect("layout security descriptor must be created");

        REPLACE_ROOT_AFTER_SNAPSHOT.store(true, std::sync::atomic::Ordering::Release);
        let error = prepared
            .finish(&security, &sid)
            .expect_err("mixed-root layout must never be returned");
        REPLACE_ROOT_AFTER_SNAPSHOT.store(false, std::sync::atomic::Ordering::Release);
        assert!(
            fixture.join("JARVIS-replaced-root").is_dir(),
            "the fault injection must replace the root between layout operations"
        );
        assert!(matches!(
            error.kind,
            crate::NativeErrorKind::PathIdentityMismatch
                | crate::NativeErrorKind::SecurityBoundaryUnavailable
        ));
        std::fs::remove_dir_all(fixture).expect("layout replacement fixture must be removed");
    }
}
