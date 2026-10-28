import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="min-h-svh bg-background lg:pl-64" aria-busy="true" aria-label="Carregando">
      <div className="flex h-16 items-center justify-between border-b px-4 md:px-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="size-9 rounded-full" />
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  )
}
