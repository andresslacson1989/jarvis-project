use std::path::PathBuf;

use super::{
    NativeError, NativeErrorKind, REQUIRED_DATA_DIRECTORIES,
    handles::OwnedHandle,
    identity::{self, FileIdentity},
    security::ExplicitSecurity,
};

const ROOT_NAME: &str = "JARVIS";
const STATE_FILE_NAME: &str = "owner.state";

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
    let parent = identity::open_directory(&local_app_data, None)?;
    let parent_identity = identity::identity(&parent)?;
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
        let current_parent = identity::open_directory(&self.local_app_data, None)?;
        let current_identity = identity::identity(&current_parent)?;
        if current_identity != self.parent_identity {
            return Err(NativeError {
                kind: NativeErrorKind::SecurityBoundaryUnavailable,
            });
        }

        let root_path = self.local_app_data.join(ROOT_NAME);
        let root = identity::open_directory(&root_path, None)?;
        security.validate_handle(&root, sid)?;
        let root_identity = identity::identity(&root)?;
        let mut children = Vec::with_capacity(REQUIRED_DATA_DIRECTORIES.len());
        for name in REQUIRED_DATA_DIRECTORIES {
            let child = identity::open_directory(&root_path.join(name), None)?;
            security.validate_handle(&child, sid)?;
            children.push(child);
        }

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
        let current_parent = identity::open_directory(&self.local_app_data, None)?;
        let current_identity = identity::identity(&current_parent)?;
        if current_identity != self.parent_identity {
            return Err(NativeError {
                kind: NativeErrorKind::SecurityBoundaryUnavailable,
            });
        }

        let root_path = self.local_app_data.join(ROOT_NAME);
        let root = identity::create_or_open_directory(&root_path, security, sid)?;
        let root_identity = identity::identity(&root)?;
        let mut children = Vec::with_capacity(REQUIRED_DATA_DIRECTORIES.len());
        for name in REQUIRED_DATA_DIRECTORIES {
            let path = root_path.join(name);
            children.push(identity::create_or_open_directory(&path, security, sid)?);
        }

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
