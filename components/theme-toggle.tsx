'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button type="button" variant="ghost" size="icon" aria-label="Alternar tema claro ou escuro" title="Alternar tema" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
      <Moon className="dark:hidden" />
      <Sun className="hidden dark:block" />
    </Button>
  )
}
