import { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

const base =
  'inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50';

export function PrimaryButton({ className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(base, 'bg-accent text-white hover:bg-accentHover active:scale-[0.98]', className)}
      {...props}
    />
  );
}

export function SecondaryButton({ className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(base, 'border border-borderSoft bg-surface text-bodyText hover:bg-surfaceHover hover:border-borderHover active:scale-[0.98]', className)}
      {...props}
    />
  );
}

export function DangerButton({ className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(base, 'bg-dangerBg text-dangerText border border-dangerBorder hover:bg-red-100 active:scale-[0.98]', className)}
      {...props}
    />
  );
}

export function GhostButton({ className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(base, 'text-mutedText hover:bg-surfaceHover hover:text-bodyText active:scale-[0.98]', className)}
      {...props}
    />
  );
}
