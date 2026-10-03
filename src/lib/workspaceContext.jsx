import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { verifyWorkspaceAccess } from "@/services/workspaceService";
import { setWorkspaceEffectiveUserId } from "@/services/supabaseStore";

const STORAGE_KEY = "musicpromo:managed-workspace";

const WorkspaceContext = createContext(null);

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ownerUserId) return null;
    return {
      ownerUserId: String(parsed.ownerUserId),
      label: String(parsed.label || "Artist workspace"),
    };
  } catch {
    return null;
  }
}

export function WorkspaceProvider({ children }) {
  const { user } = useAuth();
  const [managed, setManaged] = useState(null);
  const [ready, setReady] = useState(false);

  const clearManaged = useCallback(() => {
    setManaged(null);
    localStorage.removeItem(STORAGE_KEY);
    setWorkspaceEffectiveUserId(null);
  }, []);

  const applyManaged = useCallback(async (ownerUserId, label) => {
    if (!user?.id) return false;
    if (!ownerUserId || ownerUserId === user.id) {
      clearManaged();
      return true;
    }
    const { allowed } = await verifyWorkspaceAccess(ownerUserId);
    if (!allowed) {
      clearManaged();
      return false;
    }
    const next = { ownerUserId: String(ownerUserId), label: label || "Managed workspace" };
    setManaged(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setWorkspaceEffectiveUserId(next.ownerUserId);
    return true;
  }, [user?.id, clearManaged]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        setManaged(null);
        setWorkspaceEffectiveUserId(null);
        setReady(true);
        return;
      }
      const stored = readStored();
      if (!stored) {
        setWorkspaceEffectiveUserId(null);
        setReady(true);
        return;
      }
      try {
        const ok = await applyManaged(stored.ownerUserId, stored.label);
        if (!cancelled && !ok) setManaged(null);
      } catch {
        if (!cancelled) clearManaged();
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, applyManaged, clearManaged]);

  const value = useMemo(
    () => ({
      ready,
      managedOwnerId: managed?.ownerUserId || null,
      managedLabel: managed?.label || null,
      isManagingOther: !!(managed?.ownerUserId && user?.id && managed.ownerUserId !== user.id),
      setManagedWorkspace: applyManaged,
      clearManagedWorkspace: clearManaged,
    }),
    [ready, managed, user?.id, applyManaged, clearManaged]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}
