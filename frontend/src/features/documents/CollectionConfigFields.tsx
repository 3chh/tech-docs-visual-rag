import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import {
  BoolSetting,
  NumberSetting,
  SettingGroup,
  TextSetting,
} from "@/features/settings/SettingRow";
import { api } from "@/lib/api";
import type { SettingsResponse } from "@/lib/types";

import {
  COLLECTION_FIELD_GROUPS,
  getPath,
  setDraftValue,
  type CollectionDraft,
  type Field,
  type FieldGroup,
} from "./collection-config";

/**
 * Form tham số của một bộ tài liệu, dùng chung cho lúc tạo và lúc sửa.
 *
 * Mọi trường đều để trống mặc định; placeholder hiện giá trị server đang dùng
 * (lấy từ `GET /settings`, không phải hằng số chép tay). Chỉ trường người
 * dùng thực sự nhập mới được gửi lên — xem `collection-config.ts`.
 */
export function CollectionConfigFields({
  draft,
  onChange,
  groups = COLLECTION_FIELD_GROUPS,
}: {
  draft: CollectionDraft;
  onChange: (draft: CollectionDraft) => void;
  /** Mặc định là tham số chạy nóng. Dialog tạo bộ truyền thêm nhóm embedding. */
  groups?: FieldGroup[];
}) {
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: api.settings,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (isLoading || !settings) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Đang tải tham số">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <SettingGroup key={group.title} title={group.title}>
          {group.hint && (
            <p className="pb-1 text-xs text-muted-foreground">{group.hint}</p>
          )}
          {group.fields.map((field) => (
            <FieldControl
              key={field.path.join(".")}
              field={field}
              draft={draft}
              settings={settings}
              onChange={onChange}
            />
          ))}
        </SettingGroup>
      ))}
    </div>
  );
}

function FieldControl({
  field,
  draft,
  settings,
  onChange,
}: {
  field: Field;
  draft: CollectionDraft;
  settings: SettingsResponse;
  onChange: (draft: CollectionDraft) => void;
}) {
  if (field.showIf && !field.showIf(settings)) return null;

  const set = (value: unknown) => onChange(setDraftValue(draft, field.path, value));
  const current = getPath(draft, field.path);

  if (field.kind === "number") {
    return (
      <NumberSetting
        label={field.label}
        tooltip={field.tooltip}
        value={current as number | undefined}
        defaultValue={field.serverDefault(settings)}
        min={field.min}
        max={field.max}
        step={field.step}
        unit={field.unit}
        onChange={set}
      />
    );
  }

  if (field.kind === "bool") {
    return (
      <BoolSetting
        label={field.label}
        tooltip={field.tooltip}
        value={current as boolean | undefined}
        defaultValue={field.serverDefault(settings)}
        onChange={set}
      />
    );
  }

  return (
    <TextSetting
      label={field.label}
      tooltip={field.tooltip}
      value={current as string | undefined}
      defaultValue={field.serverDefault(settings)}
      onChange={set}
    />
  );
}
