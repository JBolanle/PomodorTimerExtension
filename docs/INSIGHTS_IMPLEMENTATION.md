# Insights Section Implementation

## Overview

Add a new collapsible "Insights" section between Stats and History with:
- Weekly focus bar chart (last 7 days)
- Streak tracker (current + best)
- Trend comparisons (this week vs last week)
- Optional: Productive hours chart

---

## Page Structure (Updated)

```
HistoryStatsPage
├── Header
├── CollapsibleSection (Stats)        ← existing
│   └── StatsContent (summary cards)
├── CollapsibleSection (Insights)     ← NEW
│   └── InsightsContent
│       ├── StreakCard
│       ├── TrendComparison
│       └── WeeklyFocusChart
├── CollapsibleSection (History)      ← existing
│   └── SessionList
```

---

## Dependencies

Add Recharts for charting (lightweight, React-native):

```bash
npm install recharts
```

---

## 1. Insights Content Component

```tsx
// components/InsightsContent.tsx
import { useMemo } from 'react';
import { SessionRecord } from '../types';
import { StreakCard } from './StreakCard';
import { TrendComparison } from './TrendComparison';
import { WeeklyFocusChart } from './WeeklyFocusChart';
import { ProductiveHoursChart } from './ProductiveHoursChart';

interface InsightsContentProps {
  sessions: SessionRecord[];
}

export function InsightsContent({ sessions }: InsightsContentProps) {
  // Filter to work sessions only for most insights
  const workSessions = useMemo(
    () => sessions.filter(s => s.mode === 'work'),
    [sessions]
  );

  return (
    <div className="space-y-6">
      {/* Top row: Streak + Trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StreakCard sessions={workSessions} />
        <TrendComparison sessions={workSessions} />
      </div>

      {/* Weekly focus chart */}
      <WeeklyFocusChart sessions={workSessions} />

      {/* Optional: Productive hours */}
      <ProductiveHoursChart sessions={workSessions} />
    </div>
  );
}
```

---

## 2. Streak Card

Tracks current streak and best streak based on consecutive days with completed work sessions.

```tsx
// components/StreakCard.tsx
import { useMemo } from 'react';
import { Flame, Trophy } from 'lucide-react';
import { SessionRecord } from '../types';

interface StreakCardProps {
  sessions: SessionRecord[];
}

export function StreakCard({ sessions }: StreakCardProps) {
  const { currentStreak, bestStreak, isActiveToday } = useMemo(() => {
    return calculateStreaks(sessions);
  }, [sessions]);

  return (
    <div className="bg-muted/30 rounded-lg p-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        Focus Streaks
      </h3>
      
      <div className="flex items-center justify-between">
        {/* Current Streak */}
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${
            currentStreak > 0 ? 'bg-orange-500/20' : 'bg-muted'
          }`}>
            <Flame className={`w-5 h-5 ${
              currentStreak > 0 ? 'text-orange-500' : 'text-muted-foreground'
            }`} />
          </div>
          <div>
            <div className="text-2xl font-bold">
              {currentStreak}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                day{currentStreak !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {isActiveToday ? 'Current streak' : 'Streak paused'}
            </div>
          </div>
        </div>

        {/* Best Streak */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-yellow-500/20">
            <Trophy className="w-5 h-5 text-yellow-500" />
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {bestStreak}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                day{bestStreak !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">Best streak</div>
          </div>
        </div>
      </div>

      {/* Motivational message */}
      {currentStreak > 0 && currentStreak === bestStreak && (
        <div className="mt-3 text-xs text-center text-yellow-500 bg-yellow-500/10 py-1 rounded">
          🎉 You're on your best streak!
        </div>
      )}
      {currentStreak > 0 && currentStreak < bestStreak && (
        <div className="mt-3 text-xs text-center text-muted-foreground">
          {bestStreak - currentStreak} more day{bestStreak - currentStreak !== 1 ? 's' : ''} to beat your record
        </div>
      )}
    </div>
  );
}

// --- Streak Calculation Logic ---

interface StreakResult {
  currentStreak: number;
  bestStreak: number;
  isActiveToday: boolean;
}

function calculateStreaks(sessions: SessionRecord[]): StreakResult {
  if (sessions.length === 0) {
    return { currentStreak: 0, bestStreak: 0, isActiveToday: false };
  }

  // Get unique days with completed sessions (sorted descending)
  const daysWithSessions = getUniqueDays(sessions);
  
  if (daysWithSessions.length === 0) {
    return { currentStreak: 0, bestStreak: 0, isActiveToday: false };
  }

  const today = getDateKey(new Date());
  const yesterday = getDateKey(new Date(Date.now() - 86400000));
  
  // Check if active today or yesterday (streak still valid)
  const mostRecentDay = daysWithSessions[0];
  const isActiveToday = mostRecentDay === today;
  const streakActive = mostRecentDay === today || mostRecentDay === yesterday;

  // Calculate current streak
  let currentStreak = 0;
  if (streakActive) {
    currentStreak = 1;
    for (let i = 1; i < daysWithSessions.length; i++) {
      const prevDay = daysWithSessions[i - 1];
      const currDay = daysWithSessions[i];
      
      if (isConsecutive(currDay, prevDay)) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate best streak (scan all days)
  let bestStreak = 0;
  let tempStreak = 1;
  
  for (let i = 1; i < daysWithSessions.length; i++) {
    const prevDay = daysWithSessions[i - 1];
    const currDay = daysWithSessions[i];
    
    if (isConsecutive(currDay, prevDay)) {
      tempStreak++;
    } else {
      bestStreak = Math.max(bestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  bestStreak = Math.max(bestStreak, tempStreak, currentStreak);

  return { currentStreak, bestStreak, isActiveToday };
}

function getUniqueDays(sessions: SessionRecord[]): string[] {
  const days = new Set<string>();
  for (const session of sessions) {
    if (session.completionType === 'completed') {
      days.add(getDateKey(new Date(session.completedAt)));
    }
  }
  return Array.from(days).sort().reverse(); // Most recent first
}

function getDateKey(date: Date): string {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

function isConsecutive(earlier: string, later: string): boolean {
  const d1 = new Date(earlier);
  const d2 = new Date(later);
  const diffDays = Math.round((d2.getTime() - d1.getTime()) / 86400000);
  return diffDays === 1;
}
```

---

## 3. Trend Comparison

Compares this week vs last week.

```tsx
// components/TrendComparison.tsx
import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SessionRecord } from '../types';

interface TrendComparisonProps {
  sessions: SessionRecord[];
}

export function TrendComparison({ sessions }: TrendComparisonProps) {
  const trends = useMemo(() => calculateTrends(sessions), [sessions]);

  return (
    <div className="bg-muted/30 rounded-lg p-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        This Week vs Last Week
      </h3>

      <div className="space-y-3">
        <TrendRow
          label="Focus Time"
          current={formatMinutes(trends.thisWeekMinutes)}
          previous={formatMinutes(trends.lastWeekMinutes)}
          change={trends.minutesChange}
        />
        <TrendRow
          label="Sessions"
          current={trends.thisWeekSessions.toString()}
          previous={trends.lastWeekSessions.toString()}
          change={trends.sessionsChange}
        />
        <TrendRow
          label="Completion Rate"
          current={`${trends.thisWeekCompletionRate}%`}
          previous={`${trends.lastWeekCompletionRate}%`}
          change={trends.completionChange}
        />
      </div>
    </div>
  );
}

interface TrendRowProps {
  label: string;
  current: string;
  previous: string;
  change: number; // percentage change
}

function TrendRow({ label, current, previous, change }: TrendRowProps) {
  const isPositive = change > 0;
  const isNeutral = change === 0;

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{current}</span>
        <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
          isNeutral 
            ? 'bg-muted text-muted-foreground'
            : isPositive 
              ? 'bg-green-500/20 text-green-500' 
              : 'bg-red-500/20 text-red-400'
        }`}>
          {isNeutral ? (
            <Minus className="w-3 h-3" />
          ) : isPositive ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          <span>{isNeutral ? '0%' : `${isPositive ? '+' : ''}${change}%`}</span>
        </div>
      </div>
    </div>
  );
}

// --- Trend Calculation Logic ---

interface TrendData {
  thisWeekMinutes: number;
  lastWeekMinutes: number;
  minutesChange: number;
  thisWeekSessions: number;
  lastWeekSessions: number;
  sessionsChange: number;
  thisWeekCompletionRate: number;
  lastWeekCompletionRate: number;
  completionChange: number;
}

function calculateTrends(sessions: SessionRecord[]): TrendData {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay(); // 0 = Sunday

  // This week: Sunday to today
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - dayOfWeek);

  // Last week: Previous Sunday to Saturday
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setTime(lastWeekEnd.getTime() - 1); // End of Saturday

  const thisWeekSessions = sessions.filter(s => {
    const date = new Date(s.completedAt);
    return date >= thisWeekStart && date <= now;
  });

  const lastWeekSessions = sessions.filter(s => {
    const date = new Date(s.completedAt);
    return date >= lastWeekStart && date <= lastWeekEnd;
  });

  const thisWeekMinutes = sumMinutes(thisWeekSessions);
  const lastWeekMinutes = sumMinutes(lastWeekSessions);
  
  const thisWeekCompleted = thisWeekSessions.filter(s => s.completionType === 'completed').length;
  const lastWeekCompleted = lastWeekSessions.filter(s => s.completionType === 'completed').length;

  const thisWeekCompletionRate = thisWeekSessions.length > 0
    ? Math.round((thisWeekCompleted / thisWeekSessions.length) * 100)
    : 0;
  const lastWeekCompletionRate = lastWeekSessions.length > 0
    ? Math.round((lastWeekCompleted / lastWeekSessions.length) * 100)
    : 0;

  return {
    thisWeekMinutes,
    lastWeekMinutes,
    minutesChange: calcPercentChange(lastWeekMinutes, thisWeekMinutes),
    thisWeekSessions: thisWeekSessions.length,
    lastWeekSessions: lastWeekSessions.length,
    sessionsChange: calcPercentChange(lastWeekSessions.length, thisWeekSessions.length),
    thisWeekCompletionRate,
    lastWeekCompletionRate,
    completionChange: thisWeekCompletionRate - lastWeekCompletionRate,
  };
}

function sumMinutes(sessions: SessionRecord[]): number {
  return Math.round(
    sessions.reduce((sum, s) => sum + s.actualDurationMs, 0) / 60000
  );
}

function calcPercentChange(previous: number, current: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
```

---

## 4. Weekly Focus Chart

Bar chart showing daily focus time for the last 7 days.

```tsx
// components/WeeklyFocusChart.tsx
import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { SessionRecord } from '../types';

interface WeeklyFocusChartProps {
  sessions: SessionRecord[];
}

export function WeeklyFocusChart({ sessions }: WeeklyFocusChartProps) {
  const chartData = useMemo(() => getLast7DaysData(sessions), [sessions]);

  const maxMinutes = Math.max(...chartData.map(d => d.minutes), 1);

  return (
    <div className="bg-muted/30 rounded-lg p-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">
        Daily Focus (Last 7 Days)
      </h3>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              tickFormatter={(value) => `${value}m`}
              width={45}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
            />
            <Bar dataKey="minutes" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {chartData.map((entry, index) => (
                <Cell
                  key={entry.date}
                  fill={entry.isToday 
                    ? 'hsl(var(--primary))' 
                    : 'hsl(var(--primary) / 0.5)'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary below chart */}
      <div className="flex justify-between mt-4 pt-3 border-t border-border text-sm">
        <div>
          <span className="text-muted-foreground">7-day total: </span>
          <span className="font-medium">
            {formatMinutes(chartData.reduce((sum, d) => sum + d.minutes, 0))}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Daily avg: </span>
          <span className="font-medium">
            {formatMinutes(Math.round(chartData.reduce((sum, d) => sum + d.minutes, 0) / 7))}
          </span>
        </div>
      </div>
    </div>
  );
}

// Custom tooltip component
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
      <div className="font-medium">{data.fullDate}</div>
      <div className="text-muted-foreground mt-1">
        {data.minutes > 0 
          ? `${formatMinutes(data.minutes)} focus time`
          : 'No sessions'
        }
      </div>
      {data.sessions > 0 && (
        <div className="text-muted-foreground">
          {data.sessions} session{data.sessions !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

// --- Data Generation ---

interface DayData {
  date: string;
  label: string;
  fullDate: string;
  minutes: number;
  sessions: number;
  isToday: boolean;
}

function getLast7DaysData(sessions: SessionRecord[]): DayData[] {
  const days: DayData[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];

    const daySessions = sessions.filter(s => {
      const sessionDate = new Date(s.completedAt).toISOString().split('T')[0];
      return sessionDate === dateKey;
    });

    const minutes = Math.round(
      daySessions.reduce((sum, s) => sum + s.actualDurationMs, 0) / 60000
    );

    days.push({
      date: dateKey,
      label: date.toLocaleDateString('en-US', { weekday: 'short' }), // Mon, Tue, etc.
      fullDate: date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      }),
      minutes,
      sessions: daySessions.length,
      isToday: i === 0,
    });
  }

  return days;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
```

---

## 5. Productive Hours Chart (Optional)

Shows which hours of the day have the most focus sessions.

```tsx
// components/ProductiveHoursChart.tsx
import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { SessionRecord } from '../types';

interface ProductiveHoursChartProps {
  sessions: SessionRecord[];
}

export function ProductiveHoursChart({ sessions }: ProductiveHoursChartProps) {
  const chartData = useMemo(() => getHourlyData(sessions), [sessions]);
  
  // Find peak hour
  const peakHour = useMemo(() => {
    const max = Math.max(...chartData.map(d => d.minutes));
    return chartData.find(d => d.minutes === max);
  }, [chartData]);

  // Don't render if no data
  const hasData = chartData.some(d => d.minutes > 0);
  if (!hasData) return null;

  return (
    <div className="bg-muted/30 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          Most Productive Hours
        </h3>
        {peakHour && peakHour.minutes > 0 && (
          <span className="text-xs text-muted-foreground">
            Peak: {peakHour.label}
          </span>
        )}
      </div>

      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              interval={2} // Show every 3rd label (6am, 9am, 12pm, etc.)
            />
            <YAxis hide />
            <Tooltip
              content={<HourTooltip />}
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
            />
            <Bar dataKey="minutes" radius={[2, 2, 0, 0]} maxBarSize={20}>
              {chartData.map((entry, index) => (
                <Cell
                  key={entry.hour}
                  fill={entry === peakHour 
                    ? 'hsl(var(--primary))' 
                    : 'hsl(var(--primary) / 0.4)'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function HourTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-2 text-sm">
      <div className="font-medium">{data.fullLabel}</div>
      <div className="text-muted-foreground">
        {data.minutes > 0 
          ? `${data.minutes}m focus · ${data.sessions} sessions`
          : 'No sessions'
        }
      </div>
    </div>
  );
}

// --- Data Generation ---

interface HourData {
  hour: number;
  label: string;
  fullLabel: string;
  minutes: number;
  sessions: number;
}

function getHourlyData(sessions: SessionRecord[]): HourData[] {
  const hours: HourData[] = [];
  
  // Initialize all hours (6am to 11pm for typical work hours)
  for (let hour = 6; hour <= 23; hour++) {
    const hourSessions = sessions.filter(s => {
      const sessionHour = new Date(s.completedAt).getHours();
      return sessionHour === hour;
    });

    const minutes = Math.round(
      hourSessions.reduce((sum, s) => sum + s.actualDurationMs, 0) / 60000
    );

    hours.push({
      hour,
      label: formatHourShort(hour),
      fullLabel: formatHourFull(hour),
      minutes,
      sessions: hourSessions.length,
    });
  }

  return hours;
}

function formatHourShort(hour: number): string {
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  if (hour < 12) return `${hour}a`;
  return `${hour - 12}p`;
}

function formatHourFull(hour: number): string {
  if (hour === 0) return '12:00 AM';
  if (hour === 12) return '12:00 PM';
  if (hour < 12) return `${hour}:00 AM`;
  return `${hour - 12}:00 PM`;
}
```

---

## 6. Integration into Main Page

Update `HistoryStatsPage.tsx` to include the Insights section:

```tsx
// In HistoryStatsPage.tsx

import { InsightsContent } from '../components/InsightsContent';

// ... inside the component return:

return (
  <div className="max-w-3xl mx-auto p-6 space-y-6">
    {/* Header */}
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">History & Stats</h1>
      <ExportDropdown ... />
    </div>

    {/* Stats Section */}
    <CollapsibleSection title="Statistics" defaultOpen={true}>
      <StatsContent sessions={filteredSessions} dateRange={dateRange} />
    </CollapsibleSection>

    {/* NEW: Insights Section */}
    <CollapsibleSection 
      title="Insights" 
      defaultOpen={true}
      badge={sessions.length > 0 ? "Charts & Trends" : undefined}
    >
      <InsightsContent sessions={sessions} />
    </CollapsibleSection>

    {/* History Section */}
    <CollapsibleSection title="Session History" ...>
      ...
    </CollapsibleSection>
  </div>
);
```

---

## 7. Theming for Recharts

To make charts match your theme, use CSS variables. Add this to your global styles or component:

```css
/* Ensure recharts picks up theme colors */
.recharts-tooltip-wrapper {
  outline: none;
}

.recharts-default-tooltip {
  background-color: hsl(var(--popover)) !important;
  border-color: hsl(var(--border)) !important;
}
```

Or use inline styles in the chart components referencing your CSS variables via `hsl(var(--primary))` etc.

---

## Summary Checklist

| Component | Purpose |
|-----------|---------|
| `InsightsContent` | Container for all insight components |
| `StreakCard` | Current streak + best streak with fire/trophy icons |
| `TrendComparison` | This week vs last week metrics |
| `WeeklyFocusChart` | Bar chart of daily focus time (7 days) |
| `ProductiveHoursChart` | Bar chart of focus by hour of day |

---

## Prompt for Claude Code

```
Add an Insights section to the History & Stats page following 
INSIGHTS_IMPLEMENTATION.md.

1. Install recharts: npm install recharts

2. Create the components:
   - InsightsContent (container)
   - StreakCard (current + best streak)
   - TrendComparison (this week vs last week)
   - WeeklyFocusChart (7-day bar chart)
   - ProductiveHoursChart (focus by hour)

3. Add the Insights section between Stats and History 
   as a new CollapsibleSection

4. Match existing design system (Tailwind, theme colors)

5. Charts should use hsl(var(--primary)) and related CSS 
   variables for theming
```

---

## Testing Checklist

1. ☐ Streak calculates correctly (consecutive days)
2. ☐ Streak resets if no session yesterday or today
3. ☐ "Best streak" message shows when on a record
4. ☐ Trend percentages are accurate
5. ☐ Weekly chart shows last 7 days correctly
6. ☐ Today's bar is highlighted
7. ☐ Tooltips show on hover
8. ☐ Charts resize responsively
9. ☐ Empty state handled (no sessions)
10. ☐ Theme colors apply correctly
