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
import type { Session } from '@/types';

interface WeeklyFocusChartProps {
  sessions: Session[];
}

export function WeeklyFocusChart({ sessions }: WeeklyFocusChartProps) {
  const chartData = useMemo(() => getLast7DaysData(sessions), [sessions]);

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
              {chartData.map((entry) => (
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

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DayData }> }) {
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
      {data.sessionCount > 0 && (
        <div className="text-muted-foreground">
          {data.sessionCount} session{data.sessionCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

interface DayData {
  date: string;
  label: string;
  fullDate: string;
  minutes: number;
  sessionCount: number;
  isToday: boolean;
}

function getLast7DaysData(sessions: Session[]): DayData[] {
  const days: DayData[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];

    const daySessions = sessions.filter(s => {
      const sessionDate = new Date(s.startedAt).toISOString().split('T')[0];
      return sessionDate === dateKey;
    });

    const minutes = Math.round(
      daySessions.reduce((sum, s) => sum + s.totalFocusMs, 0) / 60000
    );

    days.push({
      date: dateKey,
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      fullDate: date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }),
      minutes,
      sessionCount: daySessions.length,
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
