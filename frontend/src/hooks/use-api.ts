import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { UploadFileMeta } from "@/lib/types";

export const queryKeys = {
  health: ["health"] as const,
  toc: (collection: string) => ["toc", collection] as const,
  sections: (collection: string) => ["sections", collection] as const,
  connections: ["connections"] as const,
  configuredCollections: ["configured-collections"] as const,
  collectionConfig: (name: string) => ["collection-config", name] as const,
};

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: api.health,
    refetchInterval: 30_000,
    retry: false,
    staleTime: 10_000,
  });
}

export function useTableOfContents(collection: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.toc(collection),
    queryFn: () => api.tableOfContents(collection),
    enabled: enabled && Boolean(collection),
    staleTime: 60_000,
  });
}

/** Các mục đã index trong collection, lấy qua mục "noname" của mỗi cuốn. */
export function useIndexedSections(collection: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.sections(collection),
    queryFn: () =>
      api
        .searchBySectionTitle({
          sectionTitle: "noname",
          collection,
          limit: 50,
          includeBase64: true,
        })
        .then((r) => r.results),
    enabled: enabled && Boolean(collection),
    staleTime: 60_000,
  });
}

export function useUploadFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      files: File[];
      collection: string;
      metadata: UploadFileMeta[];
    }) => api.uploadFiles(params),
    onSuccess: (_data, variables) => {
      // Index xong thì mục lục và danh sách mục đều đã đổi.
      void queryClient.invalidateQueries({ queryKey: queryKeys.toc(variables.collection) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sections(variables.collection) });
      void queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

export function useRegenerateToc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (collection: string) => api.regenerateToc(collection),
    onSuccess: (_data, collection) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.toc(collection) });
    },
  });
}

export function useSearch() {
  return useMutation({
    mutationFn: (params: { query: string; collection: string; topK?: number }) =>
      api.search(params),
  });
}

// --- Cấu hình chung: kết nối mô hình ---------------------------------------

export function useConnections() {
  return useQuery({
    queryKey: queryKeys.connections,
    queryFn: api.connections,
    retry: false,
    staleTime: 30_000,
  });
}

/**
 * Mọi thao tác ghi kết nối đều trả về danh sách mới, nên chỉ cần đặt lại
 * cache thay vì fetch lại. Kèm theo phải làm mới danh sách bộ tài liệu vì
 * `can_create` và `is_ready` của bộ phụ thuộc vào kết nối còn dùng được.
 */
function useConnectionMutation<TArgs>(
  fn: (args: TArgs) => Promise<import("@/lib/types").ConnectionListResponse>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.connections, data);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.configuredCollections,
      });
    },
  });
}

export function useCreateConnection() {
  return useConnectionMutation(api.createConnection);
}

export function useUpdateConnection() {
  return useConnectionMutation(
    ({ id, input }: { id: string; input: import("@/lib/types").UpdateConnectionInput }) =>
      api.updateConnection(id, input),
  );
}

export function useDeleteConnection() {
  return useConnectionMutation((id: string) => api.deleteConnection(id));
}

// --- Cấu hình bộ tài liệu --------------------------------------------------

export function useConfiguredCollections() {
  return useQuery({
    queryKey: queryKeys.configuredCollections,
    queryFn: api.configuredCollections,
    retry: false,
    staleTime: 15_000,
  });
}

export function useCollectionConfig(name: string | undefined) {
  return useQuery({
    queryKey: queryKeys.collectionConfig(name ?? ""),
    queryFn: () => api.collection(name as string),
    enabled: Boolean(name),
    retry: false,
  });
}

function useCollectionWriteInvalidation() {
  const queryClient = useQueryClient();

  return (name: string) => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.configuredCollections,
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.collectionConfig(name),
    });
  };
}

export function useCreateCollection() {
  const invalidate = useCollectionWriteInvalidation();

  return useMutation({
    mutationFn: api.createCollection,
    onSuccess: (config) => invalidate(config.name),
  });
}

export function useUpdateCollection() {
  const invalidate = useCollectionWriteInvalidation();

  return useMutation({
    mutationFn: ({
      name,
      input,
    }: {
      name: string;
      input: import("@/lib/types").UpdateCollectionInput;
    }) => api.updateCollection(name, input),
    onSuccess: (config) => invalidate(config.name),
  });
}
