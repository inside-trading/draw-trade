'use client'

import { TimeWindow, TIME_WINDOW_CONFIGS } from '@/types'

interface TimeWindowSelectorProps {
  selected: TimeWindow
  onChange: (window: TimeWindow) => void
  disabled?: boolean
}

const timeWindows: TimeWindow[] = ['1h', '24h', '7d', '30d', '1y']

export default function TimeWindowSelector({ selected, onChange, disabled }: TimeWindowSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {timeWindows.map((window) => (
        <button
          key={window}
          onClick={() => onChange(window)}
          disabled={disabled}
          className={`time-btn ${selected === window ? 'active' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {TIME_WINDOW_CONFIGS[window].label}
        </button>
      ))}
    </div>
  )
}
