'use client'

import { TimeWindow, TIME_WINDOW_CONFIGS } from '@/types'

interface TimeWindowSelectorProps {
  selected: TimeWindow
  onChange: (window: TimeWindow) => void
}

const timeWindows: TimeWindow[] = ['hourly', 'daily', 'weekly', 'monthly', 'yearly']

export default function TimeWindowSelector({ selected, onChange }: TimeWindowSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {timeWindows.map((window) => (
        <button
          key={window}
          onClick={() => onChange(window)}
          className={`time-btn ${selected === window ? 'active' : ''}`}
        >
          {TIME_WINDOW_CONFIGS[window].label}
        </button>
      ))}
    </div>
  )
}
