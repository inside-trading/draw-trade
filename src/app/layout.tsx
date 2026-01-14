import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Draw Trade - Predict Asset Prices',
  description: 'Draw your price predictions for stocks, crypto, and commodities. See the wisdom of the crowd.',
  keywords: ['trading', 'predictions', 'stocks', 'crypto', 'bitcoin', 'gold', 'price chart'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">
        {children}
      </body>
    </html>
  )
}
