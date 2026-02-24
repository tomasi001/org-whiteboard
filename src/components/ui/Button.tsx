"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "secondary" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variants = {
      default:
        "bg-cardzzz-cream text-cardzzz-accent border-cardzzz-cream/50 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:opacity-90",
      outline:
        "bg-transparent text-cardzzz-cream border-cardzzz-cream hover:bg-white/10",
      ghost:
        "bg-white/10 text-cardzzz-cream border-white/20 backdrop-blur-md hover:bg-white/20",
      secondary:
        "bg-black/20 text-cardzzz-cream border-white/20 backdrop-blur-md hover:bg-black/30",
      destructive:
        "bg-cardzzz-accent text-cardzzz-cream border-cardzzz-cream/50 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:opacity-90",
    };

    const sizes = {
      default: "h-[54px] py-[20px] px-[10px]",
      sm: "h-[44px] py-[10px] px-[10px] text-[15px]",
      lg: "h-[54px] py-[20px] px-[14px]",
      icon: "h-[44px] w-[44px] p-0 rounded-[12px] text-[16px]",
    };

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center gap-[10px] rounded-[16.168px] border transition-all font-roundo font-bold lowercase text-[19px] leading-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cardzzz-cream/70 disabled:pointer-events-none disabled:border-cardzzz-cream disabled:bg-transparent disabled:text-cardzzz-cream disabled:cursor-not-allowed disabled:shadow-none disabled:opacity-100",
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
