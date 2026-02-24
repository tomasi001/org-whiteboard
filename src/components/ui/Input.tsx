"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-[54px] w-full rounded-[16.168px] border border-white/20 bg-black/20 backdrop-blur-md px-3 py-2 text-base text-cardzzz-cream placeholder:text-cardzzz-cream/70 caret-cardzzz-cream font-satoshi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cardzzz-cream/70 focus-visible:border-cardzzz-cream disabled:cursor-not-allowed disabled:border-cardzzz-cream disabled:bg-transparent disabled:text-cardzzz-cream",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
