use super::{ActivationRequest, NativeError, NativeErrorKind, Role, SecondLaunch};

#[derive(Debug)]
pub enum Acquisition {
    Unsupported(NativeError),
    #[allow(dead_code)]
    SecondLaunch(SecondLaunch),
}

#[derive(Debug)]
pub struct OwnerLease;

#[derive(Debug)]
pub struct ActivationWorker;

impl OwnerLease {
    pub fn mark_ready(&self) -> Result<(), NativeError> {
        Err(NativeError {
            kind: NativeErrorKind::UnsupportedPlatform,
        })
    }

    pub fn start_activation_worker<F>(&self, _callback: F) -> Result<ActivationWorker, NativeError>
    where
        F: Fn(ActivationRequest) -> bool + Send + 'static,
    {
        Err(NativeError {
            kind: NativeErrorKind::UnsupportedPlatform,
        })
    }
}

pub fn acquire(_role: Role) -> Result<Acquisition, NativeError> {
    Err(NativeError {
        kind: NativeErrorKind::UnsupportedPlatform,
    })
}
