import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { clearActivity, listActivity, markAllActivityRead } from "@/lib/activityInbox";

export default function ActivityInboxBell() {
  const [items, setItems] = useState([]);

  const reload = () => setItems(listActivity());

  useEffect(() => {
    reload();
    const onUpdate = () => reload();
    window.addEventListener("musicpromo:activity-inbox", onUpdate);
    return () => window.removeEventListener("musicpromo:activity-inbox", onUpdate);
  }, []);

  const unread = items.filter((x) => !x.read).length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-tour="activity-bell"
          className="relative h-9 w-9 rounded-full"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-700 text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Activity</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {items.length ? (
            items.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border p-3 text-sm ${
                  item.level === "error" ? "border-destructive/30 bg-destructive/5" : "border-border/50"
                }`}
              >
                <p className="font-600">{item.title}</p>
                {item.message ? <p className="mt-1 text-xs text-muted-foreground">{item.message}</p> : null}
                <div className="mt-2 flex gap-2">
                  {item.href ? (
                    <Button size="sm" variant="outline" className="h-7 rounded-full" asChild>
                      <Link to={item.href} onClick={() => clearActivity(item.id)}>
                        Open
                      </Link>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 rounded-full"
                    onClick={() => clearActivity(item.id)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Publish and schedule updates will appear here.</p>
          )}
          {items.length ? (
            <Button type="button" variant="ghost" className="w-full rounded-full" onClick={markAllActivityRead}>
              Mark all read
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
