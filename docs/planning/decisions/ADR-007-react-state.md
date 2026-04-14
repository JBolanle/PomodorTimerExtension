# ADR-007: React State via Hooks + Context

**Status**: Accepted

## Context

The current React layer uses custom hooks (`useTimerState`, `useSettings`, `useTheme`, `useHistory`, etc.) that call into the SW or storage. Each component that needs the data calls the hook directly. This works but causes:

- Prop drilling for callbacks (timer controls callback chain through multiple component layers)
- Multiple subscriptions to the same data when several components consume the same hook
- No coordinated initial loading state across the page

Options considered:

1. **Hooks + Context providers** — promote shared hooks to Context at the popup/options root; consume via custom hooks unchanged
2. **Zustand** — lightweight global store, ~1KB; replaces some hooks with `useStore`-style access
3. **TanStack Query** — treat SW messages as a data source; built-in caching, polling, mutation handling

## Decision

Use **hooks + Context providers**. Each shared piece of state gets a provider mounted at the popup or options root:

```tsx
<TimerStateProvider>
  <SettingsProvider>
    <ThemeProvider>
      <FocusModeProvider>
        <App />
      </FocusModeProvider>
    </ThemeProvider>
  </SettingsProvider>
</TimerStateProvider>
```

Components consume via custom hooks (`useTimerState()`, `useSettings()`, etc.) that internally call `useContext`. The hook API stays the same as today — only the implementation changes.

## Consequences

### Positive
- Zero new dependencies
- Familiar pattern for any React developer
- Hook API is unchanged — components don't need rewriting
- One subscription per data type, regardless of consumer count
- Loading states can be coordinated at the provider level

### Negative
- Re-renders propagate through context consumers — for a popup with a few dozen components this is fine, but if it grows we may need to split contexts more finely
- Doesn't solve cross-tab state coordination (storage events still required for that)

### Neutral
- Rejected: Zustand. Real benefit is small for our scale. Adds a dependency and a second mental model alongside React state.
- Rejected: TanStack Query. Powerful but heavyweight; designed for HTTP-style remote data with caching invalidation patterns we don't need. Our SW is local and pushes updates via Port (see [ADR-008](ADR-008-port-based-updates.md)).
- Future option: split TimerStateProvider into separate contexts (state vs. controls) if re-render performance becomes an issue.
