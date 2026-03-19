import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { cn } from '@/lib/utils'
import { TooltipProvider } from '@/components/ui/tooltip'
import './globals.css'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-sans',
  weight: '100 900',
})

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-mono',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'Orchestra',
  description: 'Visual orchestration platform for Claude Code agents',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={cn(geistSans.variable, geistMono.variable, 'font-sans antialiased')}>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  )
}
