'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { RecordType } from './types';

interface ChartDataPoint {
  date: string;
  value: number;
  label: string;
}

interface RecordChartProps {
  type: RecordType;
  chartData: ChartDataPoint[];
  getDecimalPlaces: (typeId: number) => number;
  detectDecimalPlaces: (values: number[]) => number;
}

export function RecordChart({ type, chartData, getDecimalPlaces, detectDecimalPlaces }: RecordChartProps) {
  if (chartData.length === 0) return null;

  const values = chartData.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const scoreTableDecimals = getDecimalPlaces(type.id);
  const actualDecimals = detectDecimalPlaces(values);
  const decimalPlaces = Math.max(scoreTableDecimals, actualDecimals);
  const isLowerBetter = type.direction === 'lower';

  let improvement = null;
  if (chartData.length >= 2) {
    const first = chartData[0].value;
    const last = chartData[chartData.length - 1].value;
    const diff = last - first;
    improvement = isLowerBetter ? -diff : diff;
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-slate-800 dark:text-slate-100">{type.name}</h4>
          <span className={`text-xs px-2 py-0.5 rounded ${
            isLowerBetter ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
          }`}>
            {isLowerBetter ? '↓ 낮을수록 좋음' : '↑ 높을수록 좋음'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            평균: {avg.toFixed(decimalPlaces)}{type.unit}
          </span>
          {improvement !== null && (
            <span className={`font-medium ${improvement > 0 ? 'text-green-600 dark:text-green-400' : improvement < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
              {improvement > 0 ? '▲' : improvement < 0 ? '▼' : '−'}
              {Math.abs(improvement).toFixed(decimalPlaces)} 변화
            </span>
          )}
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              domain={[
                Math.floor(minVal * (minVal > 0 ? 0.95 : 1.05) * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces),
                Math.ceil(maxVal * (maxVal > 0 ? 1.05 : 0.95) * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces)
              ]}
              reversed={isLowerBetter}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              width={45}
              tickFormatter={(val) => val.toFixed(decimalPlaces)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              formatter={(value) => [`${Number(value).toFixed(decimalPlaces)}${type.unit}`, type.name]}
            />
            <ReferenceLine y={avg} stroke="#f97316" strokeDasharray="5 5" />
            <Line
              type="monotone"
              dataKey="value"
              stroke={isLowerBetter ? '#3b82f6' : '#22c55e'}
              strokeWidth={2}
              dot={{ fill: isLowerBetter ? '#3b82f6' : '#22c55e', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: isLowerBetter ? '#2563eb' : '#16a34a' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {chartData.map((d, i) => (
          <span
            key={i}
            className={`text-xs px-2 py-1 rounded-full ${
              i === chartData.length - 1
                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-medium'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {d.label}: {d.value.toFixed(decimalPlaces)}{type.unit}
          </span>
        ))}
      </div>
    </div>
  );
}
