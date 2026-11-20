import React from 'react';
import { LucideIcon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  icon?: LucideIcon;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, variant = 'primary', size = 'md', className, isLoading, icon: Icon, ...props 
}) => {
  const baseStyles = "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-primary-600 text-white hover:bg-primary-500",
    secondary: "bg-white dark:bg-white/[.03] text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-white/[.09] hover:bg-gray-50 dark:hover:bg-white/[.06]",
    danger: "bg-red-600 text-white hover:bg-red-500",
    ghost: "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-white/[.06]",
  };

  const sizes = {
    sm: "h-7 px-2.5 text-xs",
    md: "h-8 px-3.5 text-[13px]",
    lg: "h-10 px-5 text-sm",
    icon: "h-8 w-8"
  };

  return (
    <button className={cn(baseStyles, variants[variant], sizes[size], className)} disabled={isLoading} {...props}>
      {isLoading ? (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : Icon ? (
        <Icon className="mr-1.5 h-3.5 w-3.5" />
      ) : null}
      {children}
    </button>
  );
};

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white p-6 dark:border-white/[.07] dark:bg-gray-900", className)} {...props}>
      {children}
    </div>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => {
  return (
    <input 
      className={cn(
        "w-full rounded-md border border-gray-200 dark:border-white/[.09] bg-white dark:bg-white/[.03] px-3 py-1.5 text-[13px] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-primary-500/70 focus:ring-2 focus:ring-primary-500/15 outline-none transition-colors", 
        className
      )} 
      {...props} 
    />
  );
};

export const ProgressBar: React.FC<{ value: number; className?: string }> = ({ value, className }) => {
  return (
    <div className={cn("h-1.5 w-full rounded-full bg-gray-200 dark:bg-white/[.08] overflow-hidden", className)}>
      <div 
        className="h-full rounded-full bg-primary-500 transition-all duration-500 ease-out" 
        style={{ width: `${value}%` }}
      />
    </div>
  );
};

export const Badge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = "bg-blue-100 text-blue-800" }) => {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", color)}>
      {children}
    </span>
  );
};
/** Marks a feature that is planned but not switched on yet. */
export const SoonBadge: React.FC<{ className?: string }> = ({ className }) => (
  <span className={cn("ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", className)}>
    Soon
  </span>
);
