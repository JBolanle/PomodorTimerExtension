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

interface ProductiveHoursChartProps {
  sessions: Session[];
}

export function ProductiveHoursChart({ sessions }: ProductiveHoursChartProps) {
  const chartData = useMemo(() => getHourlyData(sessions), [sessions]);

  const peakHour = useMemo(() => {
    const max = Math.max(...chartData.map(d => d.minutes));
    return chartData.find(d => d.minutes === max);
  }, [chartData]);

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
              interval={2}
            />
            <YAxis hide />
            <Tooltip
              content={<HourTooltip />}
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
            />
            <Bar dataKey="minutes" radius={[2, 2, 0, 0]} maxBarSize={20}>
              {chartData.map((entry) => (
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

function HourTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: HourData }> }) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-2 text-sm">
      <div className="font-medium">{data.fullLabel}</div>
      <div className="text-muted-foreground">
        {data.minutes > 0
          ? `${data.minutes}m focus · ${data.sessionCount} sessions`
          : 'No sessions'
        }
      </div>
    </div>
  );
}

interface HourData {
  hour: number;
  label: string;
  fullLabel: string;
  minutes: number;
  sessionCount: number;
}

function getHourlyData(sessions: Session[]): HourData[] {
  const hours: HourData[] = [];

  for (let hour = 6; hour <= 23; hour++) {
    const hourSessions = sessions.filter(s => {
      const sessionHour = new Date(s.startedAt).getHours();
      return sessionHour === hour;
    });

    const minutes = Math.round(
      hourSessions.reduce((sum, s) => sum + s.totalFocusMs, 0) / 60000
    );

    hours.push({
      hour,
      label: formatHourShort(hour),
      fullLabel: formatHourFull(hour),
      minutes,
      sessionCount: hourSessions.length,
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
