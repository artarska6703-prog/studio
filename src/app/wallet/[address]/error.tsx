'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
 
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])
 
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
        <p className="text-muted-foreground mb-6">{error.message}</p>
        <Button
          onClick={
            () => reset()
          }
        >
          Try again
        </Button>
      </main>
    </div>
  )
}
