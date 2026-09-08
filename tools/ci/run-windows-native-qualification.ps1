$ErrorActionPreference = 'Stop'

$repository_root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$manifest_path = Join-Path $repository_root 'platform\windows\native\tests\windows_process_qualification.rs'
$runner_temp = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [System.IO.Path]::GetTempPath() }
$log_path = Join-Path $runner_temp 'jarvis-windows-native-qualification.log'
$evidence_path = Join-Path $runner_temp 'jarvis-windows-native-qualification.json'
$candidate_sha = if ($env:JARVIS_CANDIDATE_SHA) {
    $env:JARVIS_CANDIDATE_SHA.Trim()
} else {
    (git -C $repository_root rev-parse HEAD).Trim()
}
$started_at = [DateTime]::UtcNow
$test_exit = 1
$manifest_error = $null
$expected_tests = @()
$observed_tests = @{}

try {
    $manifest_source = Get-Content -LiteralPath $manifest_path -Raw
    $manifest_match = [regex]::Match(
        $manifest_source,
        '(?s)const\s+QUALIFICATION_TEST_MANIFEST:.*?=\s*&\[\s*(?<entries>.*?)\];\s*static\s+'
    )
    if (-not $manifest_match.Success) {
        throw 'Section 1.4 qualification manifest could not be located'
    }

    $entry_pattern = '\(\s*"(?<name>[^"]+)",\s*"(?<criterion>[^"]+)"\s*,\s*\)'
    foreach ($entry_match in [regex]::Matches($manifest_match.Groups['entries'].Value, $entry_pattern)) {
        $expected_tests += [ordered]@{
            name = $entry_match.Groups['name'].Value
            criterion = $entry_match.Groups['criterion'].Value
        }
    }
    if ($expected_tests.Count -eq 0) {
        throw 'Section 1.4 qualification manifest is empty'
    }
}
catch {
    $manifest_error = $_.Exception.Message
}

$cargo_command = 'cargo test --locked -p jarvis-windows-native --features test-support --all-targets -- --test-threads=1'
if (-not $manifest_error) {
    $env:CARGO_TERM_COLOR = 'never'
    & cargo test --locked -p jarvis-windows-native --features test-support --all-targets -- --test-threads=1 2>&1 |
        Tee-Object -FilePath $log_path
    $test_exit = $LASTEXITCODE
} else {
    [System.IO.File]::WriteAllText(
        $log_path,
        "manifest_error=$manifest_error$([Environment]::NewLine)",
        [System.Text.UTF8Encoding]::new($false)
    )
}

if (Test-Path -LiteralPath $log_path) {
    $log_lines = Get-Content -LiteralPath $log_path
    # Integration tests launch child test processes whose stdout is interleaved
    # with the parent libtest line. Capture the parent test header separately;
    # the aggregate Cargo exit code remains authoritative for an unqualified
    # header, while explicit FAILED/ignored results remain negative.
    $test_pattern = '^\s*test\s+(?<name>\S+)\s+\.\.\.(?:\s+(?<result>ok|FAILED|ignored))?\s*$'
    foreach ($line in $log_lines) {
        $test_match = [regex]::Match($line, $test_pattern)
        if (-not $test_match.Success) {
            continue
        }
        $name = $test_match.Groups['name'].Value
        $result = if ($test_match.Groups['result'].Success) {
            $test_match.Groups['result'].Value.ToUpperInvariant()
        } else {
            'EXECUTED'
        }
        if (-not $observed_tests.ContainsKey($name) -or
            ($observed_tests[$name] -eq 'EXECUTED' -and $result -ne 'EXECUTED') -or
            $result -eq 'FAILED') {
            $observed_tests[$name] = $result
        }
    }
}

if ($test_exit -eq 0) {
    foreach ($name in @($observed_tests.Keys)) {
        if ($observed_tests[$name] -eq 'EXECUTED') {
            $observed_tests[$name] = 'OK'
        }
    }
}

$expected_names = @($expected_tests | ForEach-Object { $_.name })
$observed_names = @($observed_tests.Keys)
$missing_names = @($expected_names | Where-Object { -not $observed_tests.ContainsKey($_) })
$unexpected_names = @($observed_names | Where-Object { $_ -notin $expected_names })
$test_records = @(
    foreach ($expected_test in $expected_tests) {
        $observed_result = if ($observed_tests.ContainsKey($expected_test.name)) {
            $observed_tests[$expected_test.name]
        } else {
            'NOT_OBSERVED'
        }
        [ordered]@{
            test_id = $expected_test.name
            test_name = $expected_test.name
            criterion = $expected_test.criterion
            result = $observed_result
        }
    }
)

$all_expected_passed = $expected_tests.Count -gt 0 -and
    $missing_names.Count -eq 0 -and
    $unexpected_names.Count -eq 0 -and
    @($test_records | Where-Object { $_.result -ne 'OK' }).Count -eq 0
$qualification_status = if (-not $manifest_error -and $test_exit -eq 0 -and $all_expected_passed) {
    'PASS'
} else {
    'FAIL'
}
$finished_at = [DateTime]::UtcNow
$log_hash = if (Test-Path -LiteralPath $log_path) {
    (Get-FileHash -LiteralPath $log_path -Algorithm SHA256).Hash.ToLowerInvariant()
} else {
    $null
}
$evidence = [ordered]@{
    schemaVersion = 1
    scope = 'SECTION_1_4_WINDOWS_NATIVE_QUALIFICATION'
    status = $qualification_status
    candidateSha = $candidate_sha
    repository = $env:GITHUB_REPOSITORY
    ref = $env:GITHUB_REF
    headRef = $env:GITHUB_HEAD_REF
    workflow = $env:GITHUB_WORKFLOW
    runId = $env:GITHUB_RUN_ID
    runAttempt = $env:GITHUB_RUN_ATTEMPT
    job = $env:GITHUB_JOB
    runner = [ordered]@{
        os = $env:RUNNER_OS
        arch = $env:RUNNER_ARCH
        image = $env:ImageOS
    }
    toolchain = [ordered]@{
        rust = (& rustc --version).Trim()
        cargo = (& cargo --version).Trim()
        node = (& node --version).Trim()
        pnpm = (& pnpm --version).Trim()
    }
    profile = [ordered]@{
        cargoCommand = $cargo_command
        features = @('test-support')
        target = 'host Windows x64'
        testThreads = 1
    }
    startedAt = $started_at.ToString('o')
    finishedAt = $finished_at.ToString('o')
    exitCode = $test_exit
    manifestCount = $expected_tests.Count
    observedCount = $observed_tests.Count
    missingTests = $missing_names
    unexpectedTests = $unexpected_names
    manifestError = $manifest_error
    logSha256 = $log_hash
    tests = $test_records
}
$evidence_json = $evidence | ConvertTo-Json -Depth 8 -Compress
[System.IO.File]::WriteAllText(
    $evidence_path,
    $evidence_json,
    [System.Text.UTF8Encoding]::new($false)
)
Write-Output "[windows-native-evidence] $evidence_json"
Write-Output "[windows-native-evidence-path] $evidence_path"

if ($qualification_status -ne 'PASS') {
    throw "Windows native Section 1.4 qualification failed; evidence: $evidence_path"
}
