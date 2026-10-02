import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    (<textarea
      className={cn(
        "flex min-h-[88px] w-full rounded-xl border-0 bg-muted/50 px-3.5 py-2.5 text-base text-foreground shadow-inner ring-1 ring-border/60 transition duration-200 placeholder:text-muted-foreground hover:ring-border focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props} />)
  );
})
Textarea.displayName = "Textarea"

export { Textarea }
