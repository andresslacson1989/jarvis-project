$ErrorActionPreference = 'Stop'

$repository_root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$manifest_path = Join-Path $repository_root 'platform\windows\native\tests\windows_process_qualification.rs'
$runner_temp = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [System.IO.Path]::GetTempPath() }
$log_path = Join-Path $runner_temp 'jarvis-windows-native-qualification.log'
$evidence_path = Join-Path $runner_temp 'jarvis-windows-native-qualification.json'
$evidence_mode = if ($env:JARVIS_EVIDENCE_MODE) { $env:JARVIS_EVIDENCE_MODE.Trim() } else { 'SUPPORTING_LOCAL' }
$identity_errors = [System.Collections.Generic.List[string]]::new()
$authority_policy = $null
$authority_policy_text = $null
$authority_policy_path = Join-Path $repository_root 'tools\ci\section-1-4-authority-policy.json'
$expected_authority_policy_sha256 = '0f9f6b228c3e8ac231644b1c07a4090c0aff398de6db94482008bb461386b0fe'
$expected_manifest_sha256 = '77dbf32273136adc2ecbcb9131f5352c8a0507ed95abc2f144d2749ed0c23939'
try {
    $authority_policy_text = Get-Content -LiteralPath $authority_policy_path -Raw
    $authority_policy = $authority_policy_text | ConvertFrom-Json
    $observed_policy_sha256 = (Get-FileHash -LiteralPath $authority_policy_path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($observed_policy_sha256 -cne $expected_authority_policy_sha256) {
        $identity_errors.Add('authority policy content digest is not the approved digest')
    }
} catch {
    $identity_errors.Add("authority policy unavailable: $($_.Exception.Message)")
}

function Invoke-GitOutput([string[]] $arguments, [bool] $allow_empty = $false) {
    $output = & git -C $repository_root @arguments 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "git $($arguments -join ' ') failed"
    }
    $value = ($output -join "`n").Trim()
    if (-not $allow_empty -and -not $value) {
        throw "git $($arguments -join ' ') returned empty output"
    }
    return $value
}

function Get-SafeRemote([string] $value) {
    $value = $value.Trim()
    if ($value -match '^(?<scheme>[A-Za-z][A-Za-z0-9+.-]*)://(?<rest>.*)$') {
        $rest = $Matches.rest -replace '^[^/]*@', ''
        return "$($Matches.scheme)://$rest"
    }
    if ($value -match '^[^@]+@(?<rest>.+)$') {
        return "ssh://$($Matches.rest)"
    }
    return $value
}

function Test-Sha([string] $value, [int] $length = 40) {
    return $value -cmatch "^[0-9a-f]{$length}$"
}

function Test-ValidHeadRef([string] $value) {
    if ([string]::IsNullOrWhiteSpace($value) -or $value -cnotmatch [string]$authority_policy.headRefPattern) {
        return $false
    }
    return $value -cnotmatch '\.\.' -and $value -cnotmatch '//' -and $value -cnotmatch '@\{' -and
        $value -cnotmatch '^\.' -and $value -cnotmatch '\.$' -and $value -cnotmatch '^/' -and $value -cnotmatch '/$'
}

function Test-ApprovedRemote([string] $value) {
    if ([string]::IsNullOrWhiteSpace($value) -or $null -eq $authority_policy) { return $false }
    return @($authority_policy.remoteForms | ForEach-Object { ([string]$_).ToLowerInvariant() }) -contains $value.ToLowerInvariant()
}

function Test-AuthorityRef([string] $value, [AllowNull()][string] $head_ref) {
    if ([string]::IsNullOrWhiteSpace($value) -or $null -eq $authority_policy) { return $false }
    if ($value -cmatch [string]$authority_policy.pullRefPattern) {
        return Test-ValidHeadRef $head_ref
    }
    $push_allowed = @($authority_policy.allowedPushRefs | ForEach-Object { [string]$_ }) | Where-Object {
        $allowed = $_
        $value -ceq $allowed -or ($allowed.EndsWith('/') -and $value.StartsWith($allowed, [System.StringComparison]::Ordinal) -and (Test-ValidHeadRef ($value.Substring('refs/heads/'.Length))))
    }
    return $push_allowed.Count -gt 0 -and [string]::IsNullOrWhiteSpace($head_ref)
}

function Test-PositiveDecimal([string] $value) {
    return $value -cmatch '^[1-9][0-9]*$'
}

$checkout_sha = $null
$tree_sha = $null
$remote = $null
$worktree_clean = $null
try { $checkout_sha = Invoke-GitOutput @('rev-parse', 'HEAD') } catch { $identity_errors.Add('checkout SHA unavailable') }
try { $tree_sha = Invoke-GitOutput @('rev-parse', 'HEAD^{tree}') } catch { $identity_errors.Add('checkout tree SHA unavailable') }
try { $remote = Get-SafeRemote (Invoke-GitOutput @('config', '--get', 'remote.origin.url')) } catch { $identity_errors.Add('origin remote unavailable') }
try { $worktree_clean = [string]::IsNullOrWhiteSpace((Invoke-GitOutput @('status', '--porcelain=v1', '--untracked-files=all') $true)) } catch { $identity_errors.Add('worktree status unavailable') }
$candidate_sha = if (-not [string]::IsNullOrWhiteSpace($env:JARVIS_CANDIDATE_SHA)) {
    $env:JARVIS_CANDIDATE_SHA.Trim()
} elseif ($evidence_mode -eq 'AUTHORITATIVE_GITHUB_ACTIONS') {
    $null
} else {
    $checkout_sha
}

$authority = [ordered]@{ type = $null; repository = $null; ref = $null; headRef = $null; workflow = $null; runId = $null; runAttempt = $null; job = $null }
$runner = [ordered]@{ os = $null; arch = $null; image = $null }
if ($evidence_mode -eq 'AUTHORITATIVE_GITHUB_ACTIONS') {
    $authority = [ordered]@{
        type = 'GITHUB_ACTIONS'
        repository = $env:GITHUB_REPOSITORY
        ref = $env:GITHUB_REF
        headRef = $env:GITHUB_HEAD_REF
        workflow = $env:GITHUB_WORKFLOW
        runId = $env:GITHUB_RUN_ID
        runAttempt = $env:GITHUB_RUN_ATTEMPT
        job = $env:GITHUB_JOB
    }
    $runner = [ordered]@{ os = $env:RUNNER_OS; arch = $env:RUNNER_ARCH; image = $env:ImageOS }
}

$checkout_relationship = if ($evidence_mode -eq 'SUPPORTING_LOCAL') {
    'SUPPORTING_LOCAL'
} elseif ($checkout_sha -and $candidate_sha -and $checkout_sha -eq $candidate_sha) {
    'EXACT_CHECKOUT'
} else {
    'UNKNOWN'
}

if ($evidence_mode -ne 'AUTHORITATIVE_GITHUB_ACTIONS' -and $evidence_mode -ne 'SUPPORTING_LOCAL') {
    $identity_errors.Add('unsupported evidence mode')
}
if ($evidence_mode -eq 'AUTHORITATIVE_GITHUB_ACTIONS') {
    foreach ($field in @('repository', 'ref', 'workflow', 'runId', 'runAttempt', 'job')) {
        if ([string]::IsNullOrWhiteSpace([string]$authority[$field])) { $identity_errors.Add("authority.$field unavailable") }
    }
    foreach ($field in @('os', 'arch')) {
        if ([string]::IsNullOrWhiteSpace([string]$runner[$field])) { $identity_errors.Add("runner.$field unavailable") }
    }
    if (-not (Test-Sha $candidate_sha)) { $identity_errors.Add('candidate SHA is not a lowercase 40-hex value') }
    if (-not (Test-Sha $checkout_sha)) { $identity_errors.Add('checkout SHA is not a lowercase 40-hex value') }
    if (-not (Test-Sha $tree_sha)) { $identity_errors.Add('checkout tree SHA is not a lowercase 40-hex value') }
    if ([string]::IsNullOrWhiteSpace($remote)) { $identity_errors.Add('sanitized origin remote unavailable') }
    if ($worktree_clean -ne $true) { $identity_errors.Add('authoritative worktree is not clean') }
    if ($checkout_relationship -ne 'EXACT_CHECKOUT' -or $checkout_sha -cne $candidate_sha) { $identity_errors.Add('candidate checkout is not exact') }
    if ($null -eq $authority_policy -or ([string]$authority.repository).ToLowerInvariant() -ne ([string]$authority_policy.repository).ToLowerInvariant()) { $identity_errors.Add('authority repository is not the approved repository') }
    if (-not (Test-AuthorityRef ([string]$authority.ref) $authority.headRef)) { $identity_errors.Add('authoritative ref/headRef is outside the approved policy') }
    if (-not (Test-ApprovedRemote $remote)) { $identity_errors.Add('origin remote is not an approved GitHub remote form') }
    if ([string]$authority.type -cne 'GITHUB_ACTIONS' -or
        [string]$authority.workflow -cne [string]$authority_policy.authority.workflow -or
        [string]$authority.job -cne [string]$authority_policy.authority.job -or
        -not (Test-PositiveDecimal ([string]$authority.runId)) -or
        -not (Test-PositiveDecimal ([string]$authority.runAttempt))) {
        $identity_errors.Add('authoritative workflow/run identity is not approved')
    }
    if ([string]$runner.os -cne [string]$authority_policy.runner.os -or
        [string]$runner.arch -cne [string]$authority_policy.runner.arch -or
        @($authority_policy.runner.images | ForEach-Object { [string]$_ }) -cnotcontains [string]$runner.image) {
        $identity_errors.Add('authoritative runner identity is not approved')
    }
}
$cargo_command = 'cargo test --locked -p jarvis-windows-native --features test-support --all-targets -- --test-threads=1'
if ($null -eq $authority_policy -or
    $cargo_command -cne [string]$authority_policy.profiles.native.cargoCommand -or
    @($authority_policy.profiles.native.features | ForEach-Object { [string]$_ }) -cnotcontains 'test-support' -or
    [string]$authority_policy.profiles.native.target -cne 'host Windows x64' -or
    [int]$authority_policy.profiles.native.testThreads -ne 1) {
    $identity_errors.Add('native qualification profile is not the approved profile')
}
$identity_error = if ($identity_errors.Count -gt 0) { $identity_errors -join '; ' } else { $null }
$started_at = [DateTime]::UtcNow
$test_exit = 1
$manifest_error = $null
$manifest_sha256 = $null
$expected_tests = @()
$observed_tests = @{}

try {
    $manifest_sha256 = (Get-FileHash -LiteralPath $manifest_path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($manifest_sha256 -cne $expected_manifest_sha256) {
        $identity_errors.Add('native qualification manifest content digest is not the approved digest')
    }
} catch {
    $identity_errors.Add("native qualification manifest digest unavailable: $($_.Exception.Message)")
}

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

if (-not $manifest_error) {
    try {
        $env:CARGO_TERM_COLOR = 'never'
        & cargo test --locked -p jarvis-windows-native --features test-support --all-targets -- --test-threads=1 2>&1 |
            Tee-Object -FilePath $log_path
        $test_exit = $LASTEXITCODE
    } catch {
        $test_exit = 1
        $identity_errors.Add("qualification test or log write failed: $($_.Exception.Message)")
    }
} else {
    try {
        [System.IO.File]::WriteAllText(
            $log_path,
            "manifest_error=$manifest_error$([Environment]::NewLine)",
            [System.Text.UTF8Encoding]::new($false)
        )
    } catch {
        $identity_errors.Add("qualification log write failed: $($_.Exception.Message)")
    }
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
$identity_error = if ($identity_errors.Count -gt 0) { $identity_errors -join '; ' } else { $null }
$tests_passed = -not $manifest_error -and $test_exit -eq 0 -and $all_expected_passed
$qualification_ok = $tests_passed -and $identity_errors.Count -eq 0
$qualification_status = if ($qualification_ok) {
    if ($evidence_mode -eq 'AUTHORITATIVE_GITHUB_ACTIONS') { 'PASS' } else { 'SUPPORTING_PASS' }
} elseif ($evidence_mode -eq 'SUPPORTING_LOCAL') {
    'SUPPORTING_FAIL'
} else {
    'FAIL'
}
$failure = if ($qualification_ok) {
    $null
} elseif ($identity_errors.Count -gt 0) {
    "evidence identity failed: $($identity_errors -join '; ')"
} elseif ($manifest_error) {
    "qualification manifest failed: $manifest_error"
} elseif ($test_exit -ne 0) {
    "cargo qualification exited with code $test_exit"
} else {
    'qualification manifest did not observe every expected passing test'
}
$finished_at = [DateTime]::UtcNow
$log_hash = if (Test-Path -LiteralPath $log_path) {
    (Get-FileHash -LiteralPath $log_path -Algorithm SHA256).Hash.ToLowerInvariant()
} else {
    $null
}
$evidence = [ordered]@{
    schemaVersion = 3
    scope = 'SECTION_1_4_WINDOWS_NATIVE_QUALIFICATION'
    status = $qualification_status
    evidenceMode = $evidence_mode
    candidateSha = $candidate_sha
    authority = $authority
    runner = $runner
    observed = [ordered]@{
        checkoutSha = $checkout_sha
        treeSha = $tree_sha
        remote = $remote
        checkoutRelationship = $checkout_relationship
        worktreeClean = $worktree_clean
        identityError = $identity_error
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
    failure = $failure
    forcedCleanup = $false
    exitCode = $test_exit
    manifestCount = $expected_tests.Count
    observedCount = $observed_tests.Count
    missingTests = $missing_names
    unexpectedTests = $unexpected_names
    manifestError = $manifest_error
    manifestSha256 = $manifest_sha256
    logSha256 = $log_hash
    tests = $test_records
}
$evidence_json = $evidence | ConvertTo-Json -Depth 8 -Compress
try {
    $evidence_parent = Split-Path -Parent $evidence_path
    if ($evidence_parent) { [System.IO.Directory]::CreateDirectory($evidence_parent) | Out-Null }
    [System.IO.File]::WriteAllText(
        $evidence_path,
        $evidence_json,
        [System.Text.UTF8Encoding]::new($false)
    )
    [System.IO.File]::WriteAllText(
        [System.IO.Path]::ChangeExtension($evidence_path, '.log'),
        "$evidence_json$([Environment]::NewLine)",
        [System.Text.UTF8Encoding]::new($false)
    )
} catch {
    throw "unable to write Section 1.4 evidence: $($_.Exception.Message)"
}
Write-Output "[windows-native-evidence] $evidence_json"
Write-Output "[windows-native-evidence-path] $evidence_path"

if ($qualification_status -notin @('PASS', 'SUPPORTING_PASS')) {
    throw "Windows native Section 1.4 qualification failed; evidence: $evidence_path"
}
