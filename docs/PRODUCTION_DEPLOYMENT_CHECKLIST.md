// Expected result structure
{
  overall: 'healthy' | 'degraded' | 'unhealthy',
  checks: {
    mmkv: { status: 'healthy', latencyMs: < 5 },
    floatingBubble: { status: 'healthy', nativeModuleLoaded: true },
    permissions: { status: 'healthy', allGranted: true },
    shortcuts: { status: 'healthy', count: > 0 },
    telemetry: { status: 'healthy', transportConnected: true }
  },
  timestamp: ISO8601
}
```

### 2.2 Verification Steps
- [ ] Cold start: `HealthCheckService.runAllChecks()` returns `overall: 'healthy'`
- [ ] Warm start: Returns `healthy` within **100ms**
- [ ] After permission revocation: Returns `degraded` with correct failed check
- [ ] After MMKV corruption simulation: Returns `unhealthy` with mmkv check failed
- [ ] Health endpoint exposed for monitoring (if applicable)

---

## 3. Performance Benchmarks

| Metric | Target | Measured (iOS) | Measured (Android) | Status |
|--------|--------|----------------|-------------------|--------|
| Bubble tap → action latency (p95) | **< 16ms** | ___ ms | ___ ms | ☐ |
| Bubble render time (initial mount) | **< 8ms** | ___ ms | ___ ms | ☐ |
| Bubble drag frame time (60fps) | **< 16.67ms/frame** | ___ ms | ___ ms | ☐ |
| App cold start (TTI) | **< 2.5s** | ___ s | ___ s | ☐ |
| Memory footprint (idle, 5min) | **< 50MB** | ___ MB | ___ MB | ☐ |
| Memory growth (1hr stress) | **< 10MB** | ___ MB | ___ MB | ☐ |
| JS bundle parse + execute | **< 300ms** | ___ ms | ___ ms | ☐ |
| Shortcut execution (p99) | **< 50ms** | ___ ms | ___ ms | ☐ |

### 3.1 Measurement Protocol
- Device: iPhone 15 Pro / Pixel 8 (or latest flagship)
- OS: Latest stable iOS / Android
- Build: Release (Hermes enabled, bytecode precompiled)
- Tooling: `react-native-performance`, Xcode Instruments, Android Studio Profiler
- Runs: **30 iterations** per metric, report p50/p95/p99

---

## 4. Native Module Verification

### 4.1 iOS (FloatingBubbleManager)
- [ ] Module loads without `RCTFatal` errors in console
- [ ] `FloatingBubbleManager.isAvailable()` returns `true`
- [ ] Bubble renders at correct coordinates (safe area respected)
- [ ] Touch handling: tap, long-press, drag all functional
- [ ] Window level: Above app UI, below system alerts
- [ ] Memory: No leaks after 1000 show/hide cycles (Instruments → Leaks)
- [ ] Architecture: **arm64** only (no armv7)

### 4.2 Android (FloatingBubbleManager)
- [ ] Module loads without `NoSuchMethodError` / `UnsatisfiedLinkError`
- [ ] `FloatingBubbleManager.isAvailable()` returns `true`
- [ ] `SYSTEM_ALERT_WINDOW` permission handled correctly
- [ ] Bubble renders at correct coordinates (display cutout handled)
- [ ] Touch handling: tap, long-press, drag all functional
- [ ] Service lifecycle: Survives app process death (if configured)
- [ ] Memory: No leaks after 1000 show/hide cycles (LeakCanary)
- [ ] Architectures: **arm64-v8a**, **x86_64** (no 32-bit)

### 4.3 Device Test Matrix

| Device | OS Version | Architecture | Status | Notes |
|--------|------------|--------------|--------|-------|
| iPhone 15 Pro | iOS 17.x | arm64 | ☐ | |
| iPhone 14 | iOS 16.x | arm64 | ☐ | |
| iPhone SE (3rd) | iOS 15.x | arm64 | ☐ | Min supported |
| iPad Pro M2 | iPadOS 17.x | arm64 | ☐ | Tablet layout |
| Pixel 8 Pro | Android 14 | arm64-v8a | ☐ | |
| Galaxy S24 | Android 14 | arm64-v8a | ☐ | OneUI |
| Pixel 7a | Android 13 | arm64-v8a | ☐ | |
| Galaxy A54 | Android 13 | arm64-v8a | ☐ | Mid-range |
| **Minimum Supported** | **iOS 15.0** / **Android 8.0 (API 26)** | | | |

### 4.4 Android SDK Versions

| Property | Value | Verified |
|----------|-------|----------|
| `minSdkVersion` | **26** (Android 8.0 Oreo) | ☐ |
| `targetSdkVersion` | **34** (Android 14) | ☐ |
| `compileSdkVersion` | **34** | ☐ |
| `ndkVersion` | **26.1.10909125** | ☐ |
| `buildToolsVersion` | **34.0.0** | ☐ |

---

## 5. MMKV Persistence Integrity

### 5.1 Test Scenarios
- [ ] **Cold start**: Shortcuts, settings, position persist after force-kill + restart
- [ ] **Warm start**: Data intact after background → foreground
- [ ] **App update**: Migration from v0.9 → v1.0 preserves data
- [ ] **Storage pressure**: Data survives low-storage cleanup (Android)
- [ ] **Corruption recovery**: Invalid MMKV file → graceful reset + telemetry
- [ ] **Concurrent access**: Multi-process (if applicable) no data loss
- [ ] **Encryption**: Sensitive keys (if any) encrypted at rest

### 5.2 Verification Commands
```bash
# iOS - inspect MMKV via lldb
(lldb) expr (void)[MMKV defaultMMKV].getAllKeys()

# Android - inspect via adb
adb shell run-as com.yourpackage cat /data/user/0/com.yourpackage/files/mmkv/default.mmkv