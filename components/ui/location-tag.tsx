'use client'

import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'

const formatTime=()=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date())

export function LocationTag(){
 const [time,setTime]=useState('--:--:--')
 useEffect(()=>{const timer=window.setInterval(()=>setTime(formatTime()),1000);return()=>window.clearInterval(timer)},[])
 return <div tabIndex={0} role="status" aria-label={`São Paulo, Brasil. Horário local ${time}`} className="group/location relative hidden h-9 min-w-36 cursor-default items-center overflow-hidden rounded-full border border-border/80 bg-card/80 px-3 text-xs shadow-sm outline-none backdrop-blur transition-colors hover:border-cyan-400/30 focus-visible:border-cyan-400/40 focus-visible:ring-2 focus-visible:ring-cyan-400/20 md:flex"><span className="relative mr-2 flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan-400 opacity-40 motion-reduce:animate-none"/><span className="relative inline-flex size-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,.7)]"/></span><span className="relative block h-4 flex-1 overflow-hidden"><span className="absolute inset-0 flex items-center gap-1.5 text-muted-foreground transition-all duration-300 group-hover/location:-translate-y-5 group-hover/location:opacity-0 group-focus-visible/location:-translate-y-5 group-focus-visible/location:opacity-0"><MapPin className="size-3"/>São Paulo, BR</span><span className="absolute inset-0 flex translate-y-5 items-center font-mono text-cyan-400 opacity-0 transition-all duration-300 group-hover/location:translate-y-0 group-hover/location:opacity-100 group-focus-visible/location:translate-y-0 group-focus-visible/location:opacity-100">{time} · BRT</span></span></div>
}
