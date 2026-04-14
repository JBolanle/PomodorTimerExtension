// Vitest global setup. `fake-indexeddb/auto` installs the full set of
// IDB globals (IDBRequest, IDBKeyRange, etc.) that the `idb` wrapper
// looks up. `installChromeMocks()` then swaps in a fresh FDBFactory
// per test for isolation.

import 'fake-indexeddb/auto';
