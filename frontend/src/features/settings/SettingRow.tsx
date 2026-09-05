import { RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** Một dòng cấu hình: nhãn, giải thích, giá trị mặc định, và control. */
function Row({
  label,
  hint,
  defaultLabel,
  isOverridden,
  onReset,
  control,
}: {
  label: string;
  hint?: string;
  defaultLabel?: string;
  isOverridden?: boolean;
  onReset?: () => void;
  control: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Label className="text-[15px] font-normal">{label}</Label>
          {isOverridden && (
            <span className="rounded-sm bg-primary/12 px-1.5 py-px text-xs text-primary">
              đã đổi
            </span>
          )}
        </div>
        {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
        {defaultLabel !== undefined && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            Mặc định: <span className="font-mono tabular">{defaultLabel}</span>
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 pt-0.5">
        {control}
        {isOverridden && onReset && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onReset}
            aria-label={`Trả ${label} về mặc định`}
          >
            <RotateCcw className="size-3.5" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}

export function NumberSetting({
  label,
  hint,
  value,
  defaultValue,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number | undefined;
  defaultValue: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number | undefined) => void;
}) {
  const isOverridden = value !== undefined && value !== defaultValue;

  return (
    <Row
      label={label}
      hint={hint}
      defaultLabel={unit ? `${defaultValue} ${unit}` : String(defaultValue)}
      isOverridden={isOverridden}
      onReset={() => onChange(undefined)}
      control={
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={min}
            max={max}
            step={step}
            inputMode="decimal"
            value={value ?? ""}
            placeholder={String(defaultValue)}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") return onChange(undefined);
              const next = Number(raw);
              if (Number.isNaN(next)) return;
              onChange(Math.min(max, Math.max(min, next)));
            }}
            className={cn("h-8 w-24 font-mono tabular", isOverridden && "border-primary/45")}
          />
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
      }
    />
  );
}

export function BoolSetting({
  label,
  hint,
  value,
  defaultValue,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean | undefined;
  defaultValue: boolean;
  onChange: (value: boolean | undefined) => void;
}) {
  const effective = value ?? defaultValue;
  const isOverridden = value !== undefined && value !== defaultValue;

  return (
    <Row
      label={label}
      hint={hint}
      defaultLabel={defaultValue ? "bật" : "tắt"}
      isOverridden={isOverridden}
      onReset={() => onChange(undefined)}
      control={
        <Switch
          checked={effective}
          onCheckedChange={(checked) =>
            onChange(checked === defaultValue ? undefined : checked)
          }
        />
      }
    />
  );
}

export function TextSetting({
  label,
  hint,
  value,
  defaultValue,
  onChange,
  mono,
}: {
  label: string;
  hint?: string;
  value: string | undefined;
  defaultValue: string;
  onChange: (value: string | undefined) => void;
  mono?: boolean;
}) {
  const isOverridden = Boolean(value) && value !== defaultValue;

  return (
    <Row
      label={label}
      hint={hint}
      defaultLabel={defaultValue}
      isOverridden={isOverridden}
      onReset={() => onChange(undefined)}
      control={
        <Input
          value={value ?? ""}
          placeholder={defaultValue}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={cn(
            "h-8 w-52",
            mono && "font-mono",
            isOverridden && "border-primary/45",
          )}
        />
      }
    />
  );
}

/** Tham số không đổi nóng được. Nêu lý do cụ thể, không nói chung chung. */
export function LockedSetting({
  label,
  value,
  reason,
  envVar,
  mono,
}: {
  label: string;
  value: string | number | boolean;
  reason: string;
  envVar?: string;
  mono?: boolean;
}) {
  const display = typeof value === "boolean" ? (value ? "bật" : "tắt") : String(value);

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[15px]">{label}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{reason}</p>
        {envVar && (
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{envVar}</p>
        )}
      </div>
      <span
        className={cn(
          "shrink-0 rounded-sm bg-muted px-2 py-1 text-sm",
          mono ? "font-mono" : "tabular",
        )}
        title={display}
      >
        {display}
      </span>
    </div>
  );
}

export function SettingGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="border-b pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {description && (
        <p className="pt-2 text-sm text-muted-foreground">{description}</p>
      )}
      <div className="divide-y">{children}</div>
    </section>
  );
}
