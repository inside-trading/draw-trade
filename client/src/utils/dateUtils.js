/**
 * Date utilities for formatting dates in user's local timezone
 */

/**
 * Format a date string or Date object to the user's local timezone
 * @param {string|Date} dateInput - ISO date string or Date object
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date string in local timezone
 */
export function formatLocalDate(dateInput, options = {}) {
  if (!dateInput) return '-'

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput

  if (isNaN(date.getTime())) return '-'

  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  }

  return date.toLocaleString(undefined, defaultOptions)
}

/**
 * Format a date to show just the date portion in local timezone
 * @param {string|Date} dateInput - ISO date string or Date object
 * @returns {string} Formatted date string
 */
export function formatLocalDateOnly(dateInput) {
  return formatLocalDate(dateInput, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: undefined,
    minute: undefined
  })
}

/**
 * Format a date to show just the time in local timezone
 * @param {string|Date} dateInput - ISO date string or Date object
 * @returns {string} Formatted time string
 */
export function formatLocalTime(dateInput) {
  if (!dateInput) return '-'

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput

  if (isNaN(date.getTime())) return '-'

  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 * @param {string|Date} dateInput - ISO date string or Date object
 * @returns {string} Relative time string
 */
export function getRelativeTime(dateInput) {
  if (!dateInput) return '-'

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput

  if (isNaN(date.getTime())) return '-'

  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffSec = Math.round(diffMs / 1000)
  const diffMin = Math.round(diffSec / 60)
  const diffHour = Math.round(diffMin / 60)
  const diffDay = Math.round(diffHour / 24)

  if (Math.abs(diffSec) < 60) {
    return 'just now'
  } else if (Math.abs(diffMin) < 60) {
    return diffMin > 0 ? `in ${diffMin}m` : `${Math.abs(diffMin)}m ago`
  } else if (Math.abs(diffHour) < 24) {
    return diffHour > 0 ? `in ${diffHour}h` : `${Math.abs(diffHour)}h ago`
  } else if (Math.abs(diffDay) < 7) {
    return diffDay > 0 ? `in ${diffDay}d` : `${Math.abs(diffDay)}d ago`
  } else {
    return formatLocalDateOnly(date)
  }
}
