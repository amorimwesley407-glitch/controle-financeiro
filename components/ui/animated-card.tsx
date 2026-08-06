'use client'

import { useRef, type MouseEvent, type ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function AnimatedCard({children,className}:{children:ReactNode;className?:string}){
 const ref=useRef<HTMLDivElement>(null)
 function move(event:MouseEvent<HTMLDivElement>){const element=ref.current;if(!element)return;const bounds=element.getBoundingClientRect();element.style.setProperty('--pointer-x',`${event.clientX-bounds.left}px`);element.style.setProperty('--pointer-y',`${event.clientY-bounds.top}px`)}
 return <div ref={ref} onMouseMove={move} className="animated-metric group/animated relative h-full rounded-xl p-px"><span className="animated-metric-border pointer-events-none absolute inset-0 rounded-xl opacity-45 transition-opacity duration-500 group-hover/animated:opacity-100"/><span className="animated-metric-spotlight pointer-events-none absolute inset-px z-10 rounded-[calc(var(--radius-xl)-1px)] opacity-0 transition-opacity duration-300 group-hover/animated:opacity-100"/><Card className={cn('relative z-0 h-full',className)}>{children}</Card></div>
}
