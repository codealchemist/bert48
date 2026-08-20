import {
  EVENT_SUMMARY,
  EVENT_DESCRIPTION,
  EVENT_LOCATION,
  EVENT_START_ISO,
  EVENT_DURATION_HOURS
} from './constants.js'

// Stable across downloads since it's the same party for every invitee —
// calendar apps use this to recognize a re-import as an update, not a dupe.
const UID = 'cumple-bert-48@bert48.netlify.app'

function toIcsUtc(date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function escapeIcsText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export function downloadInviteCalendar() {
  const dtstamp = toIcsUtc(new Date())
  const dtstart = toIcsUtc(new Date(EVENT_START_ISO))

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bert Megatrends//Cumple Bert 48//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${UID}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DURATION:PT${EVENT_DURATION_HOURS}H`,
    `SUMMARY:${escapeIcsText(EVENT_SUMMARY)}`,
    `DESCRIPTION:${escapeIcsText(EVENT_DESCRIPTION)}`,
    `LOCATION:${escapeIcsText(EVENT_LOCATION)}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ]

  const blob = new Blob([lines.join('\r\n')], {
    type: 'text/calendar;charset=utf-8'
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'cumple-bert-48.ics'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
