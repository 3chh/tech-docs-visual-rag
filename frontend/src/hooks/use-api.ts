import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { UploadFileMeta } from "@/lib/types";

export const queryKeys = {
  health: ["health"] as const,
  collections: (userId: string) => ["collections", userId] as const,
  toc: (collection: string) => ["toc", collection] as const,
  sections: (collection: string) => ["sections", collection] as const,
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

export function useCollections(userId = "default") {
  return useQuery({
    queryKey: queryKeys.collections(userId),
    queryFn: () => api.listCollections(userId),
    retry: 1,
    staleTime: 60_000,
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
