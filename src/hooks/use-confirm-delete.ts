import { useState, useCallback } from "react";

export function useConfirmDelete() {
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name?: string } | null>(null);

  const requestDelete = useCallback((id: string, name?: string) => {
    setDeleteTarget({ id, name });
  }, []);

  const cancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const confirmDelete = useCallback((onDelete: (id: string) => void) => {
    if (deleteTarget) {
      onDelete(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  return {
    deleteTarget,
    isConfirmOpen: !!deleteTarget,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}
