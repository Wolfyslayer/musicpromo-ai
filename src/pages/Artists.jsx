import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, MapPin, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import { loadArtists } from "@/services/data";
import { initials } from "@/services/format";
import EmptyState from "@/components/EmptyState";
import { Image } from "@/components/ui/image";

export default function Artists() {
  const navigate = useNavigate();
  const [artists, setArtists] = useState(null);

  const reload = () => loadArtists().then(setArtists).catch(() => setArtists([]));
  useEffect(() => { reload(); }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-700 tracking-tight">Artists</h1>
          <p className="text-sm text-muted-foreground">Manage multiple artist profiles from one account.</p>
        </div>
        <Button onClick={() => navigate("/artists/new")} className="rounded-full"><Plus className="mr-1.5 h-4 w-4" />New Artist</Button>
      </div>

      {artists?.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {artists.map((a) => (
            <button
              key={a.id}
              onClick={() => navigate(`/artists/${a.id}`)}
              className="flex items-center gap-4 rounded-2xl border border-border/60 card-gradient p-4 text-left transition hover:border-primary/40 animate-slide-up"
            >
              {a.profile_image ? (
                <Image src={a.profile_image} alt={a.name} className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-lg font-700 text-primary">{initials(a.name)}</div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-heading font-600">{a.name}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {a.genre && <span className="inline-flex items-center gap-1"><Music2 className="h-3 w-3" />{a.genre}</span>}
                  {a.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{a.location}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : artists ? (
        <EmptyState icon={Music2} title="No artists yet" description="Create an artist profile to start building campaigns." action={<Button onClick={() => navigate("/artists/new")} className="rounded-full"><Plus className="mr-1.5 h-4 w-4" />New Artist</Button>} />
      ) : (
        <div className="h-40 animate-shimmer rounded-2xl" />
      )}
    </div>
  );
}