import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-white placeholder:text-[#a0a0a0] selection:bg-white selection:text-black bg-black text-white border-2 border-white h-10 w-full min-w-0 px-3 py-2 text-base font-mono transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:bg-[#1a1a1a]",
        "aria-invalid:border-[#ff0000]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
