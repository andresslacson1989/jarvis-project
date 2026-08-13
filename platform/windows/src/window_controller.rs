//! Windows full-host presentation boundary for the primary JARVIS window.
//!
//! This module owns deterministic presentation state and monitor recovery.
//! It intentionally exposes no AI-facing window primitive; callers choose a
//! typed presentation mode and the controller applies the corresponding
//! bounded native operation.

use serde::{Deserialize, Serialize};
use std::error::Error;
use std::fmt::{Display, Formatter};
use std::fs::{remove_file, rename, File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::webview::{NewWindowResponse, WebviewWindow, WebviewWindowBuilder};
use tauri::{
    LogicalPosition, LogicalSize, Manager, Monitor, PhysicalPosition, PhysicalRect, PhysicalSize,
    Runtime, Url, WebviewUrl, WindowEvent,
};

pub const PRIMARY_WINDOW_LABEL: &str = "main";
pub const WINDOW_STATE_SCHEMA_VERSION: u32 = 1;
pub const DEFAULT_LOGICAL_WIDTH: f64 = 1280.0;
pub const DEFAULT_LOGICAL_HEIGHT: f64 = 800.0;
pub const MIN_LOGICAL_WIDTH: f64 = 800.0;
pub const MIN_LOGICAL_HEIGHT: f64 = 600.0;
const MAX_LOGICAL_WIDTH: f64 = 16_384.0;
const MAX_LOGICAL_HEIGHT: f64 = 16_384.0;

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PresentationMode {
    Hidden,
    #[default]
    Windowed,
    Maximized,
    Fullscreen,
    FocusedContext,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MonitorSnapshot {
    pub name: Option<String>,
    pub work_area_x: i32,
    pub work_area_y: i32,
    pub work_area_width: u32,
    pub work_area_height: u32,
    pub scale_factor: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WindowPresentationState {
    pub schema_version: u32,
    pub mode: PresentationMode,
    pub logical_x: f64,
    pub logical_y: f64,
    pub logical_width: f64,
    pub logical_height: f64,
    pub monitor: Option<MonitorSnapshot>,
}

impl Default for WindowPresentationState {
    fn default() -> Self {
        Self {
            schema_version: WINDOW_STATE_SCHEMA_VERSION,
            mode: PresentationMode::Windowed,
            logical_x: 0.0,
            logical_y: 0.0,
            logical_width: DEFAULT_LOGICAL_WIDTH,
            logical_height: DEFAULT_LOGICAL_HEIGHT,
            monitor: None,
        }
    }
}

impl WindowPresentationState {
    pub fn validate(&self) -> Result<(), WindowStateError> {
        if self.schema_version != WINDOW_STATE_SCHEMA_VERSION {
            return Err(WindowStateError::Invalid(
                "window state schema version is unsupported".to_owned(),
            ));
        }
        if !self.logical_x.is_finite()
            || !self.logical_y.is_finite()
            || !self.logical_width.is_finite()
            || !self.logical_height.is_finite()
            || self.logical_width < MIN_LOGICAL_WIDTH
            || self.logical_height < MIN_LOGICAL_HEIGHT
            || self.logical_width > MAX_LOGICAL_WIDTH
            || self.logical_height > MAX_LOGICAL_HEIGHT
        {
            return Err(WindowStateError::Invalid(
                "window state geometry is outside the bounded finite range".to_owned(),
            ));
        }
        match &self.monitor {
            Some(monitor)
                if !monitor.scale_factor.is_finite()
                    || monitor.scale_factor <= 0.0
                    || monitor.work_area_width == 0
                    || monitor.work_area_height == 0 =>
            {
                return Err(WindowStateError::Invalid(
                    "window state monitor snapshot is invalid".to_owned(),
                ));
            }
            _ => {}
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WindowStateError {
    Io(String),
    Invalid(String),
}

impl Display for WindowStateError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(detail) => write!(formatter, "window state I/O error: {detail}"),
            Self::Invalid(detail) => write!(formatter, "invalid window state: {detail}"),
        }
    }
}

impl Error for WindowStateError {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WindowControllerError {
    State(WindowStateError),
    Native(String),
}

impl Display for WindowControllerError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::State(error) => Display::fmt(error, formatter),
            Self::Native(detail) => write!(formatter, "native window error: {detail}"),
        }
    }
}

impl Error for WindowControllerError {}

impl From<WindowStateError> for WindowControllerError {
    fn from(error: WindowStateError) -> Self {
        Self::State(error)
    }
}

#[derive(Debug, Clone)]
pub struct WindowStateStore {
    path: PathBuf,
}

impl WindowStateStore {
    pub fn new(path: PathBuf) -> Result<Self, WindowStateError> {
        if !path.is_absolute() {
            return Err(WindowStateError::Invalid(
                "window state path must be absolute".to_owned(),
            ));
        }
        Ok(Self { path })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn load(&self) -> Result<Option<WindowPresentationState>, WindowStateError> {
        let mut file = match File::open(&self.path) {
            Ok(file) => file,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(io_error("open window state", error)),
        };
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes)
            .map_err(|error| io_error("read window state", error))?;
        let state = serde_json::from_slice::<WindowPresentationState>(&bytes)
            .map_err(|error| WindowStateError::Invalid(format!("JSON is invalid: {error}")))?;
        state.validate()?;
        Ok(Some(state))
    }

    pub fn save(&self, state: &WindowPresentationState) -> Result<(), WindowStateError> {
        state.validate()?;
        let parent = self.path.parent().ok_or_else(|| {
            WindowStateError::Invalid("window state path must have a parent".to_owned())
        })?;
        std::fs::create_dir_all(parent)
            .map_err(|error| io_error("create window state directory", error))?;

        let temporary_path = self.path.with_extension("json.tmp");
        let _ = remove_file(&temporary_path);
        let bytes = serde_json::to_vec_pretty(state).map_err(|error| {
            WindowStateError::Invalid(format!("JSON cannot be encoded: {error}"))
        })?;
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary_path)
            .map_err(|error| io_error("create temporary window state", error))?;
        file.write_all(&bytes)
            .map_err(|error| io_error("write temporary window state", error))?;
        file.sync_all()
            .map_err(|error| io_error("flush temporary window state", error))?;
        drop(file);

        if self.path.exists() {
            remove_file(&self.path).map_err(|error| io_error("replace window state", error))?;
        }
        rename(&temporary_path, &self.path)
            .map_err(|error| io_error("install window state", error))?;
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct PlatformWindowController {
    store: Arc<WindowStateStore>,
}

impl PlatformWindowController {
    pub fn new(state_path: PathBuf) -> Result<Self, WindowControllerError> {
        Ok(Self {
            store: Arc::new(WindowStateStore::new(state_path)?),
        })
    }

    pub fn build_primary_window<R: Runtime, M: Manager<R>>(
        &self,
        manager: &M,
        webview_url: WebviewUrl,
        navigation_policy: fn(&Url) -> bool,
    ) -> Result<WebviewWindow<R>, WindowControllerError> {
        let saved_state = match self.store.load() {
            Ok(state) => state,
            Err(WindowStateError::Invalid(_)) => None,
            Err(error) => return Err(error.into()),
        };
        let window = WebviewWindowBuilder::new(manager, PRIMARY_WINDOW_LABEL, webview_url)
            .title("JARVIS Mission Control")
            .inner_size(DEFAULT_LOGICAL_WIDTH, DEFAULT_LOGICAL_HEIGHT)
            .min_inner_size(MIN_LOGICAL_WIDTH, MIN_LOGICAL_HEIGHT)
            .resizable(true)
            .fullscreen(false)
            .maximized(false)
            .always_on_top(false)
            .focused(false)
            .visible(false)
            .devtools(false)
            .on_navigation(navigation_policy)
            .on_new_window(|_url, _features| NewWindowResponse::Deny)
            .build()
            .map_err(native_error)?;

        self.restore(&window, saved_state.as_ref())?;
        self.install_event_persistence(&window);
        if !matches!(
            saved_state.map(|state| state.mode),
            Some(PresentationMode::Hidden)
        ) {
            window.show().map_err(native_error)?;
        }
        Ok(window)
    }

    pub fn present<R: Runtime>(
        &self,
        window: &WebviewWindow<R>,
        mode: PresentationMode,
    ) -> Result<(), WindowControllerError> {
        let state = self.capture(window, mode)?;
        self.apply_mode(window, mode, true)?;
        self.store.save(&state)?;
        Ok(())
    }

    pub fn save_current<R: Runtime>(
        &self,
        window: &WebviewWindow<R>,
    ) -> Result<(), WindowControllerError> {
        let mode = current_mode(window)?;
        self.store.save(&self.capture(window, mode)?)?;
        Ok(())
    }

    fn restore<R: Runtime>(
        &self,
        window: &WebviewWindow<R>,
        state: Option<&WindowPresentationState>,
    ) -> Result<(), WindowControllerError> {
        let state = state.cloned().unwrap_or_default();
        let monitor = choose_monitor(window, state.monitor.as_ref())?;
        let (position, size) = recover_geometry(&state, monitor.as_ref());
        window.set_size(size).map_err(native_error)?;
        window.set_position(position).map_err(native_error)?;
        self.apply_mode(window, state.mode, false)?;
        Ok(())
    }

    fn apply_mode<R: Runtime>(
        &self,
        window: &WebviewWindow<R>,
        mode: PresentationMode,
        allow_focus: bool,
    ) -> Result<(), WindowControllerError> {
        if mode != PresentationMode::Fullscreen {
            window.set_fullscreen(false).map_err(native_error)?;
        }
        if matches!(
            mode,
            PresentationMode::Windowed
                | PresentationMode::FocusedContext
                | PresentationMode::Fullscreen
        ) && window.is_maximized().map_err(native_error)?
        {
            window.unmaximize().map_err(native_error)?;
        }
        match mode {
            PresentationMode::Hidden => window.hide().map_err(native_error)?,
            PresentationMode::Windowed => window.show().map_err(native_error)?,
            PresentationMode::Maximized => {
                window.maximize().map_err(native_error)?;
                window.show().map_err(native_error)?;
            }
            PresentationMode::Fullscreen => {
                window.set_fullscreen(true).map_err(native_error)?;
                window.show().map_err(native_error)?;
            }
            PresentationMode::FocusedContext => {
                window.show().map_err(native_error)?;
                if allow_focus {
                    window.set_focus().map_err(native_error)?;
                }
            }
        }
        Ok(())
    }

    fn capture<R: Runtime>(
        &self,
        window: &WebviewWindow<R>,
        mode: PresentationMode,
    ) -> Result<WindowPresentationState, WindowControllerError> {
        let monitor = choose_monitor(window, None)?;
        let scale_factor = monitor
            .as_ref()
            .map(Monitor::scale_factor)
            .filter(|factor| factor.is_finite() && *factor > 0.0)
            .unwrap_or(1.0);
        let position = window.outer_position().map_err(native_error)?;
        let size = window.inner_size().map_err(native_error)?;
        let logical_position = position.to_logical::<f64>(scale_factor);
        let logical_size = size.to_logical::<f64>(scale_factor);
        let state = WindowPresentationState {
            schema_version: WINDOW_STATE_SCHEMA_VERSION,
            mode,
            logical_x: logical_position.x,
            logical_y: logical_position.y,
            logical_width: logical_size.width,
            logical_height: logical_size.height,
            monitor: monitor.as_ref().map(monitor_snapshot),
        };
        state.validate()?;
        Ok(state)
    }

    fn install_event_persistence<R: Runtime>(&self, window: &WebviewWindow<R>) {
        let app_handle = window.app_handle().clone();
        let store = Arc::clone(&self.store);
        window.on_window_event(move |event| {
            let should_persist = matches!(
                event,
                WindowEvent::Moved(_)
                    | WindowEvent::Resized(_)
                    | WindowEvent::ScaleFactorChanged { .. }
            );
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if let Some(window) = app_handle.get_webview_window(PRIMARY_WINDOW_LABEL) {
                    let _ = window.hide();
                    if let Ok(state) = capture_state(&window, PresentationMode::Hidden) {
                        let _ = store.save(&state);
                    }
                }
                return;
            }
            if should_persist {
                let state = app_handle
                    .get_webview_window(PRIMARY_WINDOW_LABEL)
                    .and_then(|window| {
                        current_mode(&window)
                            .ok()
                            .and_then(|mode| capture_state(&window, mode).ok())
                    });
                if let Some(state) = state {
                    let _ = store.save(&state);
                }
            }
        });
    }
}

fn capture_state<R: Runtime>(
    window: &WebviewWindow<R>,
    mode: PresentationMode,
) -> Result<WindowPresentationState, WindowControllerError> {
    let monitor = choose_monitor(window, None)?;
    let scale_factor = monitor
        .as_ref()
        .map(Monitor::scale_factor)
        .filter(|factor| factor.is_finite() && *factor > 0.0)
        .unwrap_or(1.0);
    let position = window.outer_position().map_err(native_error)?;
    let size = window.inner_size().map_err(native_error)?;
    let logical_position = position.to_logical::<f64>(scale_factor);
    let logical_size = size.to_logical::<f64>(scale_factor);
    let state = WindowPresentationState {
        schema_version: WINDOW_STATE_SCHEMA_VERSION,
        mode,
        logical_x: logical_position.x,
        logical_y: logical_position.y,
        logical_width: logical_size.width,
        logical_height: logical_size.height,
        monitor: monitor.as_ref().map(monitor_snapshot),
    };
    state.validate()?;
    Ok(state)
}

fn current_mode<R: Runtime>(
    window: &WebviewWindow<R>,
) -> Result<PresentationMode, WindowControllerError> {
    if !window.is_visible().map_err(native_error)? {
        return Ok(PresentationMode::Hidden);
    }
    if window.is_fullscreen().map_err(native_error)? {
        return Ok(PresentationMode::Fullscreen);
    }
    if window.is_maximized().map_err(native_error)? {
        return Ok(PresentationMode::Maximized);
    }
    Ok(PresentationMode::Windowed)
}

fn choose_monitor<R: Runtime>(
    window: &WebviewWindow<R>,
    saved: Option<&MonitorSnapshot>,
) -> Result<Option<Monitor>, WindowControllerError> {
    let monitors = window.available_monitors().map_err(native_error)?;
    let saved_monitor = saved
        .and_then(|saved| saved.name.as_ref())
        .and_then(|name| {
            monitors
                .iter()
                .find(|monitor| monitor.name().map(String::as_str) == Some(name.as_str()))
        });
    if let Some(monitor) = saved_monitor {
        return Ok(Some(monitor.clone()));
    }
    if let Some(monitor) = window.current_monitor().map_err(native_error)? {
        return Ok(Some(monitor));
    }
    if let Some(monitor) = window.primary_monitor().map_err(native_error)? {
        return Ok(Some(monitor));
    }
    Ok(monitors.into_iter().next())
}

fn recover_geometry(
    state: &WindowPresentationState,
    monitor: Option<&Monitor>,
) -> (PhysicalPosition<i32>, PhysicalSize<u32>) {
    let scale_factor = monitor
        .map(Monitor::scale_factor)
        .filter(|factor| factor.is_finite() && *factor > 0.0)
        .unwrap_or(1.0);
    let work_area = monitor.map(Monitor::work_area);
    recover_geometry_in_work_area(state, scale_factor, work_area)
}

fn recover_geometry_in_work_area(
    state: &WindowPresentationState,
    scale_factor: f64,
    work_area: Option<&PhysicalRect<i32, u32>>,
) -> (PhysicalPosition<i32>, PhysicalSize<u32>) {
    let logical_width = state
        .logical_width
        .clamp(MIN_LOGICAL_WIDTH, MAX_LOGICAL_WIDTH);
    let logical_height = state
        .logical_height
        .clamp(MIN_LOGICAL_HEIGHT, MAX_LOGICAL_HEIGHT);
    let size = PhysicalSize::from_logical(
        LogicalSize::new(logical_width, logical_height),
        scale_factor,
    );
    let position = PhysicalPosition::from_logical(
        LogicalPosition::new(state.logical_x, state.logical_y),
        scale_factor,
    );
    match work_area {
        Some(work_area) if !intersects_work_area(position, size, work_area) => {
            return centered_in_work_area(size, work_area);
        }
        _ => {}
    }
    (position, size)
}

fn intersects_work_area(
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
    work_area: &PhysicalRect<i32, u32>,
) -> bool {
    let left = i64::from(position.x).max(i64::from(work_area.position.x));
    let top = i64::from(position.y).max(i64::from(work_area.position.y));
    let right = (i64::from(position.x) + i64::from(size.width))
        .min(i64::from(work_area.position.x) + i64::from(work_area.size.width));
    let bottom = (i64::from(position.y) + i64::from(size.height))
        .min(i64::from(work_area.position.y) + i64::from(work_area.size.height));
    let minimum_visible_width = i64::from(size.width.min(64));
    let minimum_visible_height = i64::from(size.height.min(64));
    right - left >= minimum_visible_width && bottom - top >= minimum_visible_height
}

fn centered_in_work_area(
    size: PhysicalSize<u32>,
    work_area: &PhysicalRect<i32, u32>,
) -> (PhysicalPosition<i32>, PhysicalSize<u32>) {
    let width = size.width.min(work_area.size.width);
    let height = size.height.min(work_area.size.height);
    let x =
        i64::from(work_area.position.x) + (i64::from(work_area.size.width) - i64::from(width)) / 2;
    let y = i64::from(work_area.position.y)
        + (i64::from(work_area.size.height) - i64::from(height)) / 2;
    (
        PhysicalPosition::new(
            x.clamp(i64::from(i32::MIN), i64::from(i32::MAX)) as i32,
            y.clamp(i64::from(i32::MIN), i64::from(i32::MAX)) as i32,
        ),
        PhysicalSize::new(width.max(1), height.max(1)),
    )
}

fn monitor_snapshot(monitor: &Monitor) -> MonitorSnapshot {
    let work_area = monitor.work_area();
    MonitorSnapshot {
        name: monitor.name().cloned(),
        work_area_x: work_area.position.x,
        work_area_y: work_area.position.y,
        work_area_width: work_area.size.width,
        work_area_height: work_area.size.height,
        scale_factor: monitor.scale_factor(),
    }
}

fn native_error(error: tauri::Error) -> WindowControllerError {
    WindowControllerError::Native(error.to_string())
}

fn io_error(operation: &str, error: io::Error) -> WindowStateError {
    WindowStateError::Io(format!("{operation} failed: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::remove_dir_all;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_path() -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("test clock must be after epoch")
            .as_nanos();
        std::env::temp_dir()
            .join(format!("jarvis-window-controller-{suffix}"))
            .join("data")
            .join("window-state.json")
    }

    fn state(mode: PresentationMode, x: f64, y: f64) -> WindowPresentationState {
        WindowPresentationState {
            schema_version: WINDOW_STATE_SCHEMA_VERSION,
            mode,
            logical_x: x,
            logical_y: y,
            logical_width: DEFAULT_LOGICAL_WIDTH,
            logical_height: DEFAULT_LOGICAL_HEIGHT,
            monitor: Some(MonitorSnapshot {
                name: Some("DISPLAY1".to_owned()),
                work_area_x: 0,
                work_area_y: 0,
                work_area_width: 1920,
                work_area_height: 1040,
                scale_factor: 1.25,
            }),
        }
    }

    #[test]
    fn presentation_modes_and_geometry_are_strictly_validated() {
        let valid = state(PresentationMode::FocusedContext, 20.0, 30.0);
        valid.validate().expect("valid state must pass");
        let mut invalid = valid.clone();
        invalid.logical_width = f64::NAN;
        assert!(matches!(
            invalid.validate(),
            Err(WindowStateError::Invalid(_))
        ));
        invalid = valid;
        invalid.schema_version = WINDOW_STATE_SCHEMA_VERSION + 1;
        assert!(matches!(
            invalid.validate(),
            Err(WindowStateError::Invalid(_))
        ));
    }

    #[test]
    fn state_store_round_trips_and_rejects_unknown_fields() {
        let path = test_path();
        let store = WindowStateStore::new(path.clone()).expect("absolute path must be accepted");
        let expected = state(PresentationMode::Maximized, 100.0, 120.0);
        assert_eq!(store.load().expect("missing state is readable"), None);
        store.save(&expected).expect("state must save");
        assert_eq!(
            store.load().expect("saved state must load"),
            Some(expected.clone())
        );
        std::fs::write(
            &path,
            br#"{"schemaVersion":1,"mode":"WINDOWED","logicalX":0.0,"logicalY":0.0,"logicalWidth":1280.0,"logicalHeight":800.0,"monitor":null,"unexpected":true}"#,
        )
        .expect("invalid fixture must be writable");
        assert!(matches!(store.load(), Err(WindowStateError::Invalid(_))));
        remove_dir_all(path.parent().unwrap().parent().unwrap())
            .expect("test state directory must be removable");
    }

    #[test]
    fn off_screen_geometry_is_centered_inside_work_area() {
        let state = state(PresentationMode::Windowed, -3000.0, -2000.0);
        let work_area = PhysicalRect {
            position: PhysicalPosition::new(0, 0),
            size: PhysicalSize::new(1920, 1040),
        };
        let (position, size) = recover_geometry_in_work_area(&state, 1.0, Some(&work_area));
        assert!(intersects_work_area(position, size, &work_area));
        assert!(position.x >= work_area.position.x);
        assert!(position.y >= work_area.position.y);
    }
}
