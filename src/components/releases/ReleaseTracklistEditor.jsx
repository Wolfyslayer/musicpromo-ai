import { useEffect, useState } from "react";
import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { db } from "@/api/base44Client";
import { sortReleaseTracks } from "@/services/releaseTracks";

function emptyRow(n) {
  return { localKey: `new-${Date.now()}-${n}`, id: null, title: "", track_number: n };
}

/**
 * Manage album/EP track list on a release (creates Song rows with release_id + track_number).
 */
export default function ReleaseTracklistEditor({ releaseId, artistId, releaseArtworkUrl = "", releaseDate = "", onSaved }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    db.entities.Song.list("-created_date", 500)
      .then((songs) => {
        if (cancelled) return;
        const onRelease = sortReleaseTracks(songs.filter((s) => s.release_id === releaseId));
        setRows(
          onRelease.length
            ? onRelease.map((s) => ({
                localKey: s.id,
                id: s.id,
                title: s.title || "",
                track_number: s.track_number || 0,
              }))
            : [emptyRow(1)]
        );
      })
      .catch(() => setRows([emptyRow(1)]))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [releaseId]);

  const setRow = (localKey, patch) => {
    setRows((prev) => prev.map((r) => (r.localKey === localKey ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow(prev.length + 1)]);
  };

  const removeRow = (localKey) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.localKey !== localKey)));
  };

  const moveRow = (index, dir) => {
    setRows((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next.map((r, i) => ({ ...r, track_number: i + 1 }));
    });
  };

  const save = async () => {
    const titles = rows.map((r) => r.title.trim()).filter(Boolean);
    if (!titles.length) {
      toast({ variant: "destructive", title: "Add at least one track title" });
      return;
    }
    setBusy(true);
    try {
      const keptIds = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const title = r.title.trim();
        if (!title) continue;
        const track_number = i + 1;
        const payload = {
          artist_id: artistId,
          release_id: releaseId,
          title,
          track_number,
          release_date: releaseDate || null,
          artwork_url: releaseArtworkUrl || "",
          is_demo: false,
        };
        if (r.id) {
          await db.entities.Song.update(r.id, payload);
          keptIds.push(r.id);
        } else {
          const created = await db.entities.Song.create(payload);
          keptIds.push(created.id);
        }
      }

      const all = await db.entities.Song.list("-created_date", 500);
      const orphans = all.filter((s) => s.release_id === releaseId && !keptIds.includes(s.id));
      for (const o of orphans) {
        await db.entities.Song.update(o.id, { release_id: null, track_number: null });
      }

      toast({ title: "Tracklist saved" });
      onSaved?.();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not save tracks", description: e.message });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading tracks…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">Tracklist</Label>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={addRow}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add track
        </Button>
      </div>
      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li key={row.localKey} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-center text-xs tabular-nums text-muted-foreground">{index + 1}</span>
            <div className="flex shrink-0 flex-col gap-0.5">
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                disabled={index === 0}
                aria-label="Move up"
                onClick={() => moveRow(index, -1)}
              >
                <GripVertical className="h-4 w-4 rotate-90" />
              </button>
            </div>
            <Input
              value={row.title}
              onChange={(e) => setRow(row.localKey, { title: e.target.value })}
              placeholder="Track title"
              className="rounded-xl"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-full"
              disabled={rows.length <= 1}
              onClick={() => removeRow(row.localKey)}
              aria-label="Remove track"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Add every song on the album here. You can attach audio and run campaigns per track next.
      </p>
      <Button type="button" onClick={save} disabled={busy} className="rounded-full">
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save tracklist
      </Button>
    </div>
  );
}
