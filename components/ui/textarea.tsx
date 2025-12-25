import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "bg-black text-white border-2 border-white placeholder:text-[#a0a0a0] focus-visible:bg-[#1a1a1a] aria-invalid:border-[#ff0000] flex field-sizing-content min-h-16 w-full px-3 py-2 text-base font-mono transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
