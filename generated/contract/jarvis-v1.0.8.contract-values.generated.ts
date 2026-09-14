// GENERATED FILE — DO NOT EDIT.
// Source: packages/schemas/src/canonical/v1/jarvis-v1.0.8.contract-values.json
// Source SHA-256: 96ee63f00d62d5c4e9943ed38a5fdd02e1be120c3386de8f5db236defb721cf7

export const JARVIS_CANONICAL_CONTRACT_VALUES = {
  "schemaVersion": 1,
  "canonicalValuesId": "jarvis.contract-values.v1.0.8",
  "contractSuiteVersion": "1.0.8",
  "releaseProfileVersion": "1.0.8",
  "contractComponentRevisions": {
    "scopeGovernanceCoding": "1.0.8",
    "runtimePlatformProtocol": "1.0.8",
    "dataStateBackup": "1.0.8",
    "securityTrust": "1.0.8",
    "operationsIntegrationsUx": "1.0.8",
    "verificationRelease": "1.0.8",
    "releaseProfile": "1.0.8"
  },
  "protocolMajor": 1,
  "v1RuntimeTarget": {
    "platform": "WINDOWS",
    "runtimeRole": "FULL_HOST",
    "operatingSystem": "Windows 11",
    "minimumReleaseBaseline": "25H2",
    "architecture": "x64"
  },
  "platformFamilies": [
    "WINDOWS",
    "LINUX",
    "ANDROID"
  ],
  "runtimeRoles": [
    "FULL_HOST",
    "COMPANION"
  ],
  "configurationDomains": [
    "STARTUP",
    "SESSION_SECURITY",
    "VOICE",
    "PROVIDERS",
    "PRIVACY",
    "PERMISSIONS",
    "BUDGETS",
    "PROJECTS",
    "MODULES",
    "INTEGRATIONS",
    "NOTIFICATIONS",
    "RETENTION",
    "UPDATES",
    "PLATFORM_BACKEND",
    "DEVELOPER_MODE"
  ],
  "providerSetupStates": [
    "NOT_REQUIRED",
    "SETUP_REQUIRED",
    "SETUP_IN_PROGRESS",
    "SETUP_READY",
    "REPAIR_REQUIRED",
    "SETUP_FAILED"
  ],
  "moduleExecutionClasses": [
    "DATA_ONLY",
    "BUILT_IN_TRUSTED",
    "EXTERNAL_MANAGED"
  ],
  "ciAuthorities": {
    "eligibleTypes": [
      "GITHUB_ACTIONS"
    ],
    "selectedType": "GITHUB_ACTIONS",
    "pipelineIdentity": "static-ci"
  },
  "githubCapabilities": {
    "mandatory": [
      "GITHUB_REPOSITORY_READ",
      "GITHUB_REF_READ",
      "GITHUB_REF_WRITE",
      "GITHUB_PULL_REQUEST_READ",
      "GITHUB_PULL_REQUEST_WRITE",
      "GITHUB_ISSUE_READ",
      "GITHUB_COMMENT_WRITE",
      "GITHUB_CHECKS_READ",
      "GITHUB_ACTIONS_READ"
    ],
    "optional": [
      "GITHUB_ACTIONS_DISPATCH"
    ]
  },
  "proxmoxCapabilities": {
    "mandatory": [
      "PROXMOX_READ",
      "PROXMOX_POWER_CONTROL",
      "PROXMOX_SNAPSHOT",
      "PROXMOX_BACKUP",
      "PROXMOX_GUEST_CONFIG",
      "PROXMOX_GUEST_CREATE",
      "PROXMOX_MIGRATE",
      "PROXMOX_DESTROY"
    ],
    "optional": [
      "PROXMOX_STORAGE_WRITE",
      "PROXMOX_NETWORK_WRITE"
    ]
  },
  "kdf": {
    "algorithm": "ARGON2ID",
    "version": 19,
    "sessionAndPortableRecoveryFloor": {
      "memoryKiB": 65536,
      "iterations": 3,
      "parallelism": 4,
      "saltBytes": 16,
      "outputBytes": 32
    },
    "portableBackupPassphraseFloor": {
      "memoryKiB": 262144,
      "iterations": 3,
      "parallelism": 4,
      "saltBytes": 16,
      "outputBytes": 32
    }
  },
  "backup": {
    "formatId": "JARVIS_BACKUP_V1",
    "formatVersion": 1,
    "outerAead": "AES_256_GCM",
    "chunkSizeBytes": 4194304,
    "maxPlaintextBytes": 1099511627776,
    "chunkTagBytes": 16,
    "chunkNonceBytes": 12,
    "hash": "SHA_256",
    "canonicalMetadata": "RFC_8785_JCS",
    "snapshotDbKeyBits": 256,
    "backupDekBits": 256,
    "generatedRecoverySecretBits": 256,
    "noncePrefixBytes": 4,
    "wrapNonceBytes": 12,
    "maxKeySlots": 16,
    "maxUnencryptedMetadataBytes": 262144,
    "protectionClasses": [
      "LOCAL_RECOVERY",
      "PORTABLE_STATE"
    ],
    "mandatoryPortableSlot": "GENERATED_RECOVERY_V1",
    "optionalPortableSlot": "PASSPHRASE_ARGON2ID_V1",
    "generatedRecoveryPrefix": "JRV1-",
    "portableBackupPassphraseMinimumCodePoints": 20,
    "portableBackupPassphraseAcceptedCodePointsAtLeast": 128
  },
  "supplyChain": {
    "tufSpecVersion": "1.0.35",
    "consistentSnapshot": true,
    "keyType": "ed25519",
    "scheme": "ed25519",
    "roles": {
      "root": {
        "threshold": 2,
        "keyCount": 3
      },
      "targets": {
        "threshold": 2,
        "keyCount": 3
      },
      "snapshot": {
        "minimumThreshold": 1,
        "minimumKeyCount": 1
      },
      "timestamp": {
        "minimumThreshold": 1,
        "minimumKeyCount": 1
      },
      "modules": {
        "threshold": 2,
        "keyCount": 3
      }
    },
    "maximumValidityDays": {
      "timestamp": 7,
      "snapshot": 30,
      "targets": 90,
      "root": 365
    }
  },
  "approvalCanonicalization": {
    "actionDescriptorDomain": "jarvis.approval.action.v1",
    "descriptorVersion": 1,
    "canonicalization": "RFC_8785_JCS",
    "digest": "SHA_256",
    "digestEncoding": "BASE64URL_NOPAD"
  }
} as const;

export type JarvisCanonicalContractValues = typeof JARVIS_CANONICAL_CONTRACT_VALUES;
