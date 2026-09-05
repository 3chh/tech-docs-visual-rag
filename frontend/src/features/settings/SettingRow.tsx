import { HelpCircle, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Một dòng cấu hình: nhãn, giải thích, tooltip, giá trị mặc định, và control. */
function Row({
  label,
  hint,
  tooltip,
  defaultLabel,
  isOverridden,
  onReset,
  control,
}: {
  label: string;
  hint?: string;
  tooltip?: string;
  defaultLabel?: string;
  isOverridden?: boolean;
  onReset?: () => void;
  control: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs font-semibold text-foreground">{label}</Label>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-help text-muted-foreground/70 hover:text-foreground transition-colors">
                  <HelpCircle className="size-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          )}
          {isOverridden && (
            <span className="rounded-sm bg-emerald-500/15 px-1.5 py-px text-[10px] text-emerald-600 font-medium">
              đã đổi
            </span>
          )}
        </div>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        {defaultLabel !== undefined && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
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
            title="Trả về giá trị mặc định"
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
  tooltip,
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
  tooltip?: string;
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
      tooltip={tooltip}
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
            className={cn("h-8 w-24 font-mono tabular text-xs", isOverridden && "border-primary/45")}
          />
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
      }
    />
  );
}

export function BoolSetting({
  label,
  hint,
  tooltip,
  value,
  defaultValue,
  onChange,
}: {
  label: string;
  hint?: string;
  tooltip?: string;
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
      tooltip={tooltip}
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
  tooltip,
  value,
  defaultValue,
  multiline,
  onChange,
}: {
  label: string;
  hint?: string;
  tooltip?: string;
  value: string | undefined;
  defaultValue: string;
  multiline?: boolean;
  onChange: (value: string | undefined) => void;
}) {
  const isOverridden = value !== undefined && value !== defaultValue;

  return (
    <Row
      label={label}
      hint={hint}
      tooltip={tooltip}
      defaultLabel={defaultValue ? `"${defaultValue.slice(0, 30)}..."` : "(trống)"}
      isOverridden={isOverridden}
      onReset={() => onChange(undefined)}
      control={
        multiline ? (
          <textarea
            rows={3}
            value={value ?? ""}
            placeholder={defaultValue || "(dùng mặc định của hệ thống)"}
            onChange={(e) => {
              const next = e.target.value;
              onChange(next === "" ? undefined : next);
            }}
            className={cn(
              "w-64 rounded-md border bg-transparent px-2.5 py-1.5 text-xs font-mono transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isOverridden && "border-primary/45",
            )}
          />
        ) : (
          <Input
            value={value ?? ""}
            placeholder={defaultValue}
            onChange={(e) => {
              const next = e.target.value;
              onChange(next === "" ? undefined : next);
            }}
            className={cn("h-8 w-48 font-mono text-xs", isOverridden && "border-primary/45")}
          />
        )
      }
    />
  );
}

export function LockedSetting({
  label,
  value,
  note,
  tooltip,
  mono,
}: {
  label: string;
  value: string | number | boolean;
  note?: string;
  tooltip?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs font-medium text-foreground">{label}</Label>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-help text-muted-foreground/70 hover:text-foreground">
                  <HelpCircle className="size-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      </div>
      <span className={cn("rounded bg-muted/60 px-2 py-1 text-xs text-muted-foreground", mono && "font-mono")}>
        {String(value)}
      </span>
    </div>
  );
}

export function SettingGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      <div className="divide-y rounded-md border bg-card/60 px-3 py-1">{children}</div>
    </div>
  );
}

export function NumberRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  tooltip,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  tooltip?: string;
  hint?: string;
  onChange: (val: number) => void;
}) {
  return (
    <Row
      label={label}
      hint={hint}
      tooltip={tooltip}
      control={
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (!Number.isNaN(val)) onChange(val);
            }}
            className="h-8 w-24 font-mono tabular text-xs"
          />
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
      }
    />
  );
}

export function BooleanRow({
  label,
  value,
  tooltip,
  hint,
  onChange,
}: {
  label: string;
  value: boolean;
  tooltip?: string;
  hint?: string;
  onChange: (val: boolean) => void;
}) {
  return (
    <Row
      label={label}
      hint={hint}
      tooltip={tooltip}
      control={
        <Switch
          checked={value}
          onCheckedChange={onChange}
        />
      }
    />
  );
}

export function TextRow({
  label,
  value,
  tooltip,
  hint,
  mono,
  onChange,
}: {
  label: string;
  value?: string;
  tooltip?: string;
  hint?: string;
  mono?: boolean;
  onChange: (val: string) => void;
}) {
  return (
    <Row
      label={label}
      hint={hint}
      tooltip={tooltip}
      control={
        <Input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={cn("h-8 w-44 text-xs", mono && "font-mono")}
        />
      }
    />
  );
}
