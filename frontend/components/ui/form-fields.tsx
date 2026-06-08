import { InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const inputBase =
  'h-9 w-full rounded-md border border-borderSoft bg-surface px-3 text-sm text-bodyText placeholder:text-hintText transition-colors outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-grayCard disabled:text-mutedText';

export function FieldLabel(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className={cn('mb-1.5 block text-sm font-medium text-bodyText', props.className)}
    />
  );
}

export function FormField({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="grid gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <input {...props} className={cn(inputBase, className)} />
    </div>
  );
}

export function SelectField({
  label,
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <div className="grid gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <select {...props} className={cn(inputBase, className)}>
        {children}
      </select>
    </div>
  );
}

export function DateField(props: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <FormField {...props} type="date" />;
}

export function TextareaField({
  label,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <div className="grid gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <textarea
        {...props}
        className={cn(
          'w-full rounded-md border border-borderSoft bg-surface px-3 py-2 text-sm text-bodyText placeholder:text-hintText transition-colors outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-grayCard',
          className,
        )}
      />
    </div>
  );
}
