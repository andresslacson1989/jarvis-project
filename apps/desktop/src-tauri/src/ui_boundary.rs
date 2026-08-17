use serde::{Deserialize, Serialize};

const PROTOCOL_MAJOR: u32 = 1;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CoreStatusRequest {
    pub protocol_version: u32,
    pub correlation_id: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CoreBoundaryError {
    pub code: &'static str,
    pub category: &'static str,
    pub message: &'static str,
    pub retryable: bool,
    pub correlation_id: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct CoreStatusResponse {
    pub ok: bool,
    pub error: CoreBoundaryError,
}

#[tauri::command]
pub fn get_core_status(request: CoreStatusRequest) -> CoreStatusResponse {
    if request.protocol_version != PROTOCOL_MAJOR || !is_uuid_v7(&request.correlation_id) {
        return CoreStatusResponse {
            ok: false,
            error: CoreBoundaryError {
                code: "CORE_IPC_REQUEST_INVALID",
                category: "VALIDATION",
                message: "Core status request has an unsupported protocol or invalid UUIDv7 correlation ID",
                retryable: false,
                correlation_id: request.correlation_id,
            },
        };
    }

    CoreStatusResponse {
        ok: false,
        error: CoreBoundaryError {
            code: "CORE_IPC_NOT_READY",
            category: "UNSUPPORTED",
            message: "Core IPC is unavailable until the authenticated native transport is established",
            retryable: false,
            correlation_id: request.correlation_id,
        },
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
        && bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| matches!(index, 8 | 13 | 18 | 23) || byte.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::{CoreStatusRequest, get_core_status};

    const CORRELATION_ID: &str = "018f3b8e-6c68-7abc-8def-0123456789ab";

    #[test]
    fn status_stub_stays_locked_until_authenticated_transport_exists() {
        let response = get_core_status(CoreStatusRequest {
            protocol_version: 1,
            correlation_id: CORRELATION_ID.to_owned(),
        });
        let encoded = serde_json::to_value(response).expect("response must serialize");
        assert_eq!(encoded["ok"], false);
        assert_eq!(encoded["error"]["code"], "CORE_IPC_NOT_READY");
    }

    #[test]
    fn invalid_protocol_or_correlation_fails_closed() {
        let response = get_core_status(CoreStatusRequest {
            protocol_version: 2,
            correlation_id: "not-a-uuid".to_owned(),
        });
        let encoded = serde_json::to_value(response).expect("response must serialize");
        assert_eq!(encoded["error"]["code"], "CORE_IPC_REQUEST_INVALID");
    }
}
