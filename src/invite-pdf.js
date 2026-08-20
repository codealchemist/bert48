import { jsPDF } from 'jspdf'
import { toDataURL } from 'qrcode'
import { version } from '../package.json'
import {
  MENU_LABELS,
  EVENT_TITLE,
  EVENT_DATE,
  EVENT_TIME,
  EVENT_LOCATION,
  QR_EASTER_EGG_TEXT
} from './constants.js'

function attendeeLabel(index, inviteeName) {
  return index === 0 ? inviteeName : `Acompañante ${index}`
}

export async function downloadInvitePdf(invitee) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const marginX = 56
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 72

  doc.setTextColor(0, 0, 0)
  doc.setFont('courier', 'bold')
  doc.setFontSize(20)
  doc.text(`${EVENT_TITLE} / v${version}`, marginX, y)
  y += 20
  doc.setLineWidth(1)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 36

  doc.setFont('courier', 'normal')
  doc.setFontSize(12)

  const guestCount = invitee.guestCount || 0
  const menuPreferences = invitee.menuPreferences || []

  const lines = [
    `Fecha:     ${EVENT_DATE}`,
    `Hora:      ${EVENT_TIME}`,
    `Lugar:     ${EVENT_LOCATION}`,
    '',
    `Invitado:  ${invitee.name}`,
    '',
    'Asistentes:'
  ]

  for (let i = 0; i <= guestCount; i++) {
    const label = attendeeLabel(i, invitee.name)
    const menu = MENU_LABELS[menuPreferences[i]] || '-'
    lines.push(`  ${i + 1}. ${label}: ${menu}`)
  }

  for (const line of lines) {
    doc.text(line, marginX, y)
    y += 18
  }

  const qrDataUrl = await toDataURL(QR_EASTER_EGG_TEXT, { margin: 1 })
  const qrSize = 110
  doc.addImage(qrDataUrl, 'PNG', (pageWidth - qrSize) / 2, y + 24, qrSize, qrSize)

  doc.save(`bert48-invitacion-${invitee.id || invitee.name}.pdf`)
}
