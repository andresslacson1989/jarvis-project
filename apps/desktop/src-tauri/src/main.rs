#![forbid(unsafe_code)]

mod platform;

use platform::{
    BackendRegistrationState, HostStartupError, PlatformHostRequest, WindowsHostRegistration,
    select_windows_host, validate_compiled_target,
};
#[cfg(all(target_os = "windows", target_arch = "x86_64"))]
use tauri::Manager;

#[cfg(all(target_os = "windows", target_arch = "x86_64"))]
struct HostRuntime {
    _owner: jarvis_windows_native::OwnerLease,
    _activation_worker: jarvis_windows_native::ActivationWorker,
}

fn allows_authoritative_navigation(url: &tauri::Url) -> bool {
    #[cfg(debug_assertions)]
    {
        url.scheme() == "http" && url.host_str() == Some("127.0.0.1") && url.port() == Some(5173)
    }

    #[cfg(not(debug_assertions))]
    {
        url.scheme() == "http" && url.host_str() == Some("tauri.localhost") && url.port().is_none()
    }
}

fn main() -> std::process::ExitCode {
    finish(start())
}

fn finish(result: Result<(), HostStartupError>) -> std::process::ExitCode {
    match result {
        Ok(()) => std::process::ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("{error}");
            error.exit_code()
        }
    }
}

fn start() -> Result<(), HostStartupError> {
    validate_compiled_target()?;
    start_with_runner(
        PlatformHostRequest::windows_v1(),
        BackendRegistrationState::Registered,
        run_tauri_host,
    )
}

fn start_with_runner(
    request: PlatformHostRequest<'_>,
    registration_state: BackendRegistrationState,
    run_host: impl FnOnce(WindowsHostRegistration) -> Result<(), HostStartupError>,
) -> Result<(), HostStartupError> {
    let host = select_windows_host(request, registration_state)?;
    run_host(host)
}

#[cfg(all(target_os = "windows", target_arch = "x86_64"))]
fn run_tauri_host(_host: WindowsHostRegistration) -> Result<(), HostStartupError> {
    let owner = match jarvis_windows_native::acquire(jarvis_windows_native::Role::Normal)
        .map_err(|_| HostStartupError::NativeFoundationFailed)?
    {
        jarvis_windows_native::Acquisition::Owner(owner) => owner,
        jarvis_windows_native::Acquisition::SecondLaunch(_) => return Ok(()),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            let main_window = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("JARVIS")
            .inner_size(1200.0, 800.0)
            .devtools(false)
            .on_navigation(allows_authoritative_navigation)
            .on_new_window(|_url, _features| tauri::webview::NewWindowResponse::Deny)
            .build()?;

            let activation_window = main_window.clone();
            let activation_worker = owner
                .start_activation_worker(move |_request| {
                    activation_window.show().is_ok() && activation_window.set_focus().is_ok()
                })
                .map_err(|_| {
                    tauri::Error::Setup(
                        (Box::new(std::io::Error::other("activation receiver unavailable"))
                            as Box<dyn std::error::Error>)
                            .into(),
                    )
                })?;
            owner.mark_ready().map_err(|_| {
                tauri::Error::Setup(
                    (Box::new(std::io::Error::other("native authority not ready"))
                        as Box<dyn std::error::Error>)
                        .into(),
                )
            })?;
            app.manage(HostRuntime {
                _owner: owner,
                _activation_worker: activation_worker,
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .map_err(|_| HostStartupError::TauriRuntimeFailed)
}

#[cfg(not(target_os = "windows"))]
fn run_tauri_host(_host: WindowsHostRegistration) -> Result<(), HostStartupError> {
    // JARVIS V1 desktop host is only qualified for Windows.
    Err(HostStartupError::UnsupportedTarget)
}

#[cfg(all(target_os = "windows", not(target_arch = "x86_64")))]
fn run_tauri_host(_host: WindowsHostRegistration) -> Result<(), HostStartupError> {
    Err(HostStartupError::UnsupportedArchitecture)
}

#[cfg(test)]
mod tests {
    use super::{allows_authoritative_navigation, finish, start_with_runner};
    use crate::platform::{
        BackendRegistrationState, HostStartupError, PlatformHostRequest,
        windows::{
            WINDOWS_V1_ARCHITECTURE, WINDOWS_V1_BACKEND_PROFILE_ID, WINDOWS_V1_PLATFORM,
            WINDOWS_V1_RUNTIME_ROLE,
        },
    };

    #[test]
    fn navigation_policy_rejects_remote_and_unexpected_origins() {
        assert!(!allows_authoritative_navigation(
            &"https://example.com".parse().unwrap()
        ));
        assert!(!allows_authoritative_navigation(
            &"file:///tmp/index.html".parse().unwrap()
        ));
    }

    #[cfg(debug_assertions)]
    #[test]
    fn debug_navigation_policy_allows_only_local_dev_server() {
        assert!(allows_authoritative_navigation(
            &"http://127.0.0.1:5173/index.html".parse().unwrap()
        ));
        assert!(!allows_authoritative_navigation(
            &"http://localhost:5173/index.html".parse().unwrap()
        ));
        assert!(!allows_authoritative_navigation(
            &"http://127.0.0.1:9999/index.html".parse().unwrap()
        ));
    }

    #[cfg(not(debug_assertions))]
    #[test]
    fn release_navigation_policy_allows_only_bundled_app_origin() {
        assert!(allows_authoritative_navigation(
            &"http://tauri.localhost/index.html".parse().unwrap()
        ));
        assert!(!allows_authoritative_navigation(
            &"tauri://localhost/index.html".parse().unwrap()
        ));
        assert!(!allows_authoritative_navigation(
            &"http://tauri.localhost:9999/index.html".parse().unwrap()
        ));
    }

    #[test]
    fn every_startup_failure_returns_non_success_with_bounded_diagnostic() {
        let errors = [
            HostStartupError::UnsupportedTarget,
            HostStartupError::UnsupportedArchitecture,
            HostStartupError::InvalidPlatform,
            HostStartupError::InvalidRuntimeRole,
            HostStartupError::InvalidArchitecture,
            HostStartupError::InvalidBackendProfile,
            HostStartupError::BackendMissing,
            HostStartupError::BackendUnavailable,
            HostStartupError::BackendUnqualified,
            HostStartupError::ConflictingRegistration,
            HostStartupError::NativeFoundationFailed,
            HostStartupError::TauriRuntimeFailed,
        ];

        for error in errors {
            assert_eq!(finish(Err(error)), std::process::ExitCode::from(1));
            assert!(error.diagnostic().len() <= 128);
            assert!(
                error
                    .diagnostic()
                    .chars()
                    .all(|character| !character.is_control())
            );
        }
    }

    #[test]
    fn selection_failures_cannot_invoke_the_tauri_runner() {
        fn assert_runner_not_invoked(
            request: PlatformHostRequest<'_>,
            registration_state: BackendRegistrationState,
            expected: HostStartupError,
        ) {
            let invoked = std::cell::Cell::new(false);
            let result = start_with_runner(request, registration_state, |_| {
                invoked.set(true);
                Ok(())
            });

            assert_eq!(result, Err(expected));
            assert!(!invoked.get());
        }

        let valid_request = PlatformHostRequest::windows_v1();
        for (registration_state, expected) in [
            (
                BackendRegistrationState::Missing,
                HostStartupError::BackendMissing,
            ),
            (
                BackendRegistrationState::Unavailable,
                HostStartupError::BackendUnavailable,
            ),
            (
                BackendRegistrationState::Unqualified,
                HostStartupError::BackendUnqualified,
            ),
            (
                BackendRegistrationState::Conflicting,
                HostStartupError::ConflictingRegistration,
            ),
        ] {
            assert_runner_not_invoked(valid_request, registration_state, expected);
        }

        let identity_mismatch_cases = [
            (
                PlatformHostRequest {
                    platform: "LINUX",
                    runtime_role: "FULL_HOST",
                    architecture: WINDOWS_V1_ARCHITECTURE,
                    backend_profile_id: WINDOWS_V1_BACKEND_PROFILE_ID,
                },
                HostStartupError::InvalidPlatform,
            ),
            (
                PlatformHostRequest {
                    platform: WINDOWS_V1_PLATFORM,
                    runtime_role: "COMPANION",
                    architecture: WINDOWS_V1_ARCHITECTURE,
                    backend_profile_id: WINDOWS_V1_BACKEND_PROFILE_ID,
                },
                HostStartupError::InvalidRuntimeRole,
            ),
            (
                PlatformHostRequest {
                    platform: WINDOWS_V1_PLATFORM,
                    runtime_role: WINDOWS_V1_RUNTIME_ROLE,
                    architecture: "arm64",
                    backend_profile_id: WINDOWS_V1_BACKEND_PROFILE_ID,
                },
                HostStartupError::InvalidArchitecture,
            ),
            (
                PlatformHostRequest {
                    platform: WINDOWS_V1_PLATFORM,
                    runtime_role: WINDOWS_V1_RUNTIME_ROLE,
                    architecture: WINDOWS_V1_ARCHITECTURE,
                    backend_profile_id: "wrong-profile",
                },
                HostStartupError::InvalidBackendProfile,
            ),
        ];

        for (request, expected) in identity_mismatch_cases {
            assert_runner_not_invoked(request, BackendRegistrationState::Registered, expected);
        }
    }

    #[test]
    fn runner_failure_returns_non_success_without_success_leakage() {
        let invoked = std::cell::Cell::new(false);
        let result = start_with_runner(
            PlatformHostRequest::windows_v1(),
            BackendRegistrationState::Registered,
            |_| {
                invoked.set(true);
                Err(HostStartupError::TauriRuntimeFailed)
            },
        );

        assert_eq!(result, Err(HostStartupError::TauriRuntimeFailed));
        assert!(invoked.get());
        assert_eq!(finish(result), std::process::ExitCode::from(1));
    }
}
