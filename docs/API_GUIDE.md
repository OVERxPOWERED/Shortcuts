interface ShortcutsService {
  // Initialization
  init(): Promise<void>;
  
  // CRUD Operations
  getShortcuts(): Promise<Shortcut[]>;
  createShortcut(params: ShortcutParams): Promise<Shortcut>;
  updateShortcut(id: string, params: Partial<ShortcutParams>): Promise<Shortcut>;
  deleteShortcut(id: string): Promise<void>;
  reorderShortcuts(shortcuts: Shortcut[]): Promise<void>;
  
  // Validation
  validateShortcut(params: ShortcutParams): ValidationResult;
  
  // Import/Export
  exportShortcuts(): Promise<string>;
  importShortcuts(json: string): Promise<ImportResult>;
  
  // Event Subscription
  onShortcutsChange(listener: (shortcuts: Shortcut[]) => void): () => void;
}
```

### Methods

#### `init()`
Initializes the service, loads shortcuts from MMKV storage, and sets up schema migration.

```typescript
await shortcutsService.init();
// Returns: Promise<void>
// Throws: ShortcutsServiceError if MMKV initialization fails
```

#### `getShortcuts()`
Retrieves all shortcuts sorted by order index.

```typescript
const shortcuts = await shortcutsService.getShortcuts();
// Returns: Promise<Shortcut[]>
// Example: [{ id: '1', label: 'Home', action: 'navigate', ... }, ...]
```

#### `createShortcut(params)`
Creates a new shortcut with validation.

```typescript
const shortcut = await shortcutsService.createShortcut({
  label: 'Settings',
  icon: 'settings',
  action: { type: 'navigate', payload: { screen: 'Settings' } },
  order: 0,
  isEnabled: true
});
// Returns: Promise<Shortcut>
// Throws: ValidationError if params fail schema validation
```

#### `updateShortcut(id, params)`
Updates an existing shortcut with partial parameters.

```typescript
const updated = await shortcutsService.updateShortcut('1', {
  label: 'New Label',
  isEnabled: false
});
// Returns: Promise<Shortcut>
// Throws: NotFoundError if shortcut doesn't exist
```

#### `deleteShortcut(id)`
Deletes a shortcut by ID.

```typescript
await shortcutsService.deleteShortcut('1');
// Returns: Promise<void>
// Throws: NotFoundError if shortcut doesn't exist
```

#### `reorderShortcuts(shortcuts)`
Reorders shortcuts by updating their order indices.

```typescript
await shortcutsService.reorderShortcuts([
  { ...shortcuts[1], order: 0 },
  { ...shortcuts[0], order: 1 }
]);
// Returns: Promise<void>
```

#### `validateShortcut(params)`
Validates shortcut parameters against Zod schema.

```typescript
const result = shortcutsService.validateShortcut({
  label: '',
  icon: 'home',
  action: { type: 'navigate', payload: {} }
});
// Returns: ValidationResult
// { success: false, errors: [{ path: 'label', message: 'Label is required' }] }
```

#### `exportShortcuts()`
Exports all shortcuts as JSON string.

```typescript
const json = await shortcutsService.exportShortcuts();
// Returns: Promise<string>
// Format: { version: 1, shortcuts: [...], exportedAt: '2024-01-15T10:30:00Z' }
```

#### `importShortcuts(json)`
Imports shortcuts from JSON string with validation.

```typescript
const result = await shortcutsService.importShortcuts(jsonString);
// Returns: Promise<ImportResult>
// { imported: 5, skipped: 1, errors: [{ id: '2', reason: 'Duplicate ID' }] }
```

#### `onShortcutsChange(listener)`
Subscribes to shortcut changes.

```typescript
const unsubscribe = shortcutsService.onShortcutsChange((shortcuts) => {
  console.log('Shortcuts updated:', shortcuts.length);
});
// Returns: () => void (unsubscribe function)
```

### MMKV Storage Schema

```typescript
// Storage key: 'shortcuts:v1'
// Value: { version: number; shortcuts: Shortcut[]; updatedAt: string }
```

### Usage Example

```typescript
import { shortcutsService } from '@/services/ShortcutsService';
import { ShortcutParams } from '@/models/shortcut';

async function setupShortcuts() {
  await shortcutsService.init();
  
  // Create default shortcuts if empty
  const existing = await shortcutsService.getShortcuts();
  if (existing.length === 0) {
    await shortcutsService.createShortcut({
      label: 'Home',
      icon: 'home',
      action: { type: 'navigate', payload: { screen: 'Home' } },
      order: 0,
      isEnabled: true
    });
  }
  
  // Subscribe to changes
  const unsubscribe = shortcutsService.onShortcutsChange((shortcuts) => {
    renderShortcuts(shortcuts);
  });
  
  return unsubscribe;
}
```

---

## HealthCheckService

Performs periodic health checks, collects metrics, and integrates with native modules.

### Location
`src/services/HealthCheckService.ts`

### Interface

```typescript
interface HealthCheckService {
  // Lifecycle
  start(intervalMs?: number): Promise<void>;
  stop(): Promise<void>;
  
  // Manual Checks
  runCheck(): Promise<HealthCheckResult>;
  runFullDiagnostics(): Promise<DiagnosticsReport>;
  
  // Metrics
  getMetrics(): HealthMetrics;
  getHistory(limit?: number): HealthCheckResult[];
  
  // Native Integration
  registerNativeModule(module: NativeHealthModule): void;
  
  // Event Subscription
  onHealthChange(listener: (result: HealthCheckResult) => void): () => void;
  onCriticalAlert(listener: (alert: CriticalAlert) => void): () => void;
}
```

### Methods

#### `start(intervalMs?)`
Starts periodic health checks.

```typescript
await healthCheckService.start(30000); // 30 seconds default
// Returns: Promise<void>
// Throws: HealthCheckError if already running
```

#### `stop()`
Stops periodic health checks.

```typescript
await healthCheckService.stop();
// Returns: Promise<void>
```

#### `runCheck()`
Executes a single health check cycle.

```typescript
const result = await healthCheckService.runCheck();
// Returns: Promise<HealthCheckResult>
// {
//   timestamp: '2024-01-15T10:30:00Z',
//   status: 'healthy' | 'degraded' | 'critical',
//   checks: {
//     memory: { status: 'ok', value: 45.2, unit: 'MB' },
//     storage: { status: 'ok', value: 12.5, unit: 'MB' },
//     bubble: { status: 'ok', renderTime: 12.3 },
//     shortcuts: { status: 'ok', count: 5 }
//   }
// }
```

#### `runFullDiagnostics()`
Runs comprehensive diagnostics including native module checks.

```typescript
const report = await healthCheckService.runFullDiagnostics();
// Returns: Promise<DiagnosticsReport>
// {
//   timestamp: '...',
//   system: { os: 'iOS 17.2', device: 'iPhone 15', memory: '8GB' },
//   app: { version: '1.0.0', uptime: 3600 },
//   checks: [...],
//   recommendations: ['Clear cache', 'Update native module']
// }
```

#### `getMetrics()`
Returns aggregated health metrics.

```typescript
const metrics = healthCheckService.getMetrics();
// Returns: HealthMetrics
// {
//   uptime: 3600000,
//   totalChecks: 120,
//   healthyCount: 115,
//   degradedCount: 4,
//   criticalCount: 1,
//   avgMemoryUsage: 42.5,
//   avgRenderTime: 11.2
// }
```

#### `getHistory(limit?)`
Returns recent health check history.

```typescript
const history = healthCheckService.getHistory(50);
// Returns: HealthCheckResult[]
```

#### `registerNativeModule(module)`
Registers a native health module for platform-specific checks.

```typescript
healthCheckService.registerNativeModule({
  checkBattery: async () => ({ level: 0.85, isCharging: false }),
  checkThermal: async () => ({ state: 'nominal', temperature: 32.5 }),
  checkNetwork: async () => ({ type: 'wifi', strength: -45 })
});
// Returns: void
```

#### `onHealthChange(listener)`
Subscribes to health status changes.

```typescript
const unsubscribe = healthCheckService.onHealthChange((result) => {
  if (result.status === 'critical') {
    showAlert('Critical health issue detected');
  }
});
// Returns: () => void
```

#### `onCriticalAlert(listener)`
Subscribes to critical alerts.

```typescript
const unsubscribe = healthCheckService.onCriticalAlert((alert) => {
  telemetryService.trackError(new Error(alert.message), { alert });
});
// Returns: () => void
```

### Health Check Types

```typescript
type HealthStatus = 'healthy' | 'degraded' | 'critical';

interface HealthCheckResult {
  timestamp: string;
  status: HealthStatus;
  checks: {
    memory: CheckResult;
    storage: CheckResult;
    bubble: CheckResult;
    shortcuts: CheckResult;
    native?: Record<string, CheckResult>;
  };
}

interface CheckResult {
  status: HealthStatus;
  value: number;
  unit: string;
  threshold?: { warning: number; critical: number };
  message?: string;
}
```

### Usage Example

```typescript
import { healthCheckService } from '@/services/HealthCheckService';
import { NativeModules } from 'react-native';

async function initializeHealthMonitoring() {
  // Register native module if available
  if (NativeModules.HealthModule) {
    healthCheckService.registerNativeModule(NativeModules.HealthModule);
  }
  
  // Start periodic checks (every 60 seconds)
  await healthCheckService.start(60000);
  
  // Subscribe to changes
  healthCheckService.onHealthChange((result) => {
    updateHealthIndicator(result.status);
  });
  
  healthCheckService.onCriticalAlert((alert) => {
    sendToCrashlytics(alert);
  });
  
  // Run initial check
  const initial = await healthCheckService.runCheck();
  console.log('Initial health:', initial.status);
}
```

---

## InputSanitizationService

Validates and sanitizes input using Zod schemas for type-safe parameter handling.

### Location
`src/services/InputSanitizationService.ts`

### Interface

```typescript
interface InputSanitizationService {
  // Shortcut Validation
  validateShortcutParams(params: unknown): ShortcutParams;
  sanitizeShortcutParams(params: unknown): ShortcutParams;
  
  // Bubble Config Validation
  validateBubbleConfig(config: unknown): BubbleConfig;
  sanitizeBubbleConfig(config: unknown): BubbleConfig;
  
  // Generic Validation
  validate<T>(schema: z.ZodSchema<T>, data: unknown): T;
  sanitize<T>(schema: z.ZodSchema<T>, data: unknown): T;
  
  // Schema Access
  getShortcutSchema(): z.ZodSchema<ShortcutParams>;
  getBubbleConfigSchema(): z.ZodSchema<BubbleConfig>;
}
```

### Zod Schemas

#### ShortcutParams Schema

```typescript
const ShortcutParamsSchema = z.object({
  label: z.string()
    .min(1, 'Label is required')
    .max(50, 'Label must be 50 characters or less')
    .trim(),
  icon: z.string()
    .min(1, 'Icon is required')
    .max(100, 'Icon name too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid icon name'),
  action: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('navigate'),
      payload: z.object({
        screen: z.string().min(1),
        params: z.record(z.unknown()).optional()
      })
    }),
    z.object({
      type: 'callback',
      payload: z.object({
        handler: z.string().min(1),
        args: z.array(z.unknown()).optional()
      })
    }),
    z.object({
      type: 'deeplink',
      payload: z.object({
        url: z.string().url('Invalid URL'),
        fallback: z.string().optional()
      })
    }),
    z.object({
      type: 'system',
      payload: z.object({
        action: z.enum(['share', 'clipboard', 'haptic']),
        data: z.unknown().optional()
      })
    })
  ]),
  order: z.number().int().min(0).default(0),
  isEnabled: z.boolean().default(true),
  metadata: z.object({
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
    version: z.number().int().positive().optional()
  }).optional()
});

type ShortcutParams = z.infer<typeof ShortcutParamsSchema>;
```

#### BubbleConfig Schema

```typescript
const BubbleConfigSchema = z.object({
  size: z.number().int().min(40).max(120).default(60),
  position: z.object({
    x: z.number().min(0),
    y: z.number().min(0)
  }).optional(),
  animation: z.object({
    enabled: z.boolean().default(true),
    duration: z.number().int().min(100).max(1000).default(300),
    easing: z.enum(['linear', 'ease-in', 'ease-out', 'ease-in-out', 'spring']).default('ease-out')
  }).default({}),
  appearance: z.object({
    backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#007AFF'),
    borderColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    borderWidth: z.number().min(0).max(4).default(0),
    shadow: z.object({
      enabled: z.boolean().default(true),
      color: z.string().default('#000000'),
      opacity: z.number().min(0).max(1).default(0.3),
      radius: z.number().min(0).max(20).default(8),
      offset: z.object({ x: z.number().default(0), y: z.number().default(4) })
    }).optional()
  }).default({}),
  behavior: z.object({
    magnetEdges: z.boolean().default(true),
    magnetStrength: z.number().min(0).max(1).default(0.5),
    preventOverlap: z.boolean().default(true),
    hapticFeedback: z.boolean().default(true),
    longPressDelay: z.number().int().min(200).max(2000).default(500)
  }).default({}),
  accessibility: z.object({
    label: z.string().optional(),
    hint: z.string().optional(),
    role: z.enum(['button', 'link', 'menuitem']).default('button')
  }).optional()
});

type BubbleConfig = z.infer<typeof BubbleConfigSchema>;
```

### Methods

#### `validateShortcutParams(params)`
Validates and returns typed shortcut parameters.

```typescript
const params = inputSanitizationService.validateShortcutParams(rawInput);
// Returns: ShortcutParams
// Throws: ZodError with detailed validation errors
```

#### `sanitizeShortcutParams(params)`
Sanitizes input by coercing types and applying defaults.

```typescript
const sanitized = inputSanitizationService.sanitizeShortcutParams({
  label: '  Home  ',
  icon: 'home',
  action: { type: 'navigate', payload: { screen: 'Home' } },
  order: '0', // string coerced to number
  isEnabled: 'true' // string coerced to boolean
});
// Returns: ShortcutParams (with trimmed label, coerced types, defaults applied)
```

#### `validateBubbleConfig(config)`
Validates bubble configuration.

```typescript
const config = inputSanitizationService.validateBubbleConfig(userConfig);
// Returns: BubbleConfig
```

#### `sanitizeBubbleConfig(config)`
Sanitizes bubble configuration with defaults.