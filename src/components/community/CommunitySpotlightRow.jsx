import { Link } from "react-router-dom";
import { Sparkles, Zap } from "lucide-react";
import { formatHandleLabel, profilePublicPath } from "@/services/profileHandle";

function SpotlightCard({ member, badge }) {
  if (!member) return null;
  return (
    <Link
      to={member.isSelf ? "/profile" : profilePublicPath(member)}
      className="flex w-[11.5rem] shrink-0 flex-col gap-2 rounded-2xl border border-border/60 bg-card/80 p-3 transition hover:border-primary/40 hover:bg-card"
    >
      <div className="flex items-center gap-2">
        {member.avatarUrl ? (
          <img src={member.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-border/50" />
        ) : (
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
            {(member.displayName || "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{member.displayName}</p>
          {member.handle ? (
            <p className="truncate text-[10px] text-muted-foreground">{formatHandleLabel(member.handle)}</p>
          ) : null}
        </div>
      </div>
      {badge ? (
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          {badge}
        </span>
      ) : null}
      {member.bio ? (
        <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{member.bio}</p>
      ) : null}
    </Link>
  );
}

function SpotlightStrip({ title, icon: Icon, members }) {
  if (!members?.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="font-heading text-sm font-600">{title}</h2>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {members.map((m) => (
          <SpotlightCard
            key={m.id}
            member={m}
            badge={title.startsWith("Featured") ? "Featured" : "Active"}
          />
        ))}
      </div>
    </div>
  );
}

export default function CommunitySpotlightRow({ spotlight }) {
  const featured = spotlight?.featured || [];
  const recent = spotlight?.recentlyActive || [];
  if (!featured.length && !recent.length) return null;

  return (
    <section className="space-y-4 rounded-2xl border border-border/60 bg-muted/15 p-4">
      <SpotlightStrip title="Featured artists" icon={Sparkles} members={featured} />
      <SpotlightStrip title="Recently active" icon={Zap} members={recent} />
    </section>
  );
}
