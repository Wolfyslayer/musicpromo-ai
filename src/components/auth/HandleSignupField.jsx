import { useEffect, useState } from "react";
import { AtSign, Check, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatHandleLabel, normalizeHandleInput, validateHandle } from "@/services/profileHandle";
import { checkHandleAvailable } from "@/services/signupHandle";
import { cn } from "@/lib/utils";

/**
 * Username field for sign-up (@handle). Validates format and checks uniqueness.
 */
export default function HandleSignupField({ id = "signup-handle", value, onChange, onValidityChange, className }) {
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState(null);

  const normalized = normalizeHandleInput(value);
  const formatCheck = validateHandle(normalized, { required: true });

  useEffect(() => {
    if (!formatCheck.ok) {
      setAvailability(null);
      onValidityChange?.(false, formatCheck.error || "Invalid handle");
      return undefined;
    }

    let cancelled = false;
    setChecking(true);
    const timer = window.setTimeout(() => {
      checkHandleAvailable(normalized)
        .then((res) => {
          if (cancelled) return;
          setAvailability(res);
          const ok = Boolean(res?.available);
          onValidityChange?.(ok, ok ? "" : res?.error || "That handle is already taken.");
        })
        .catch((e) => {
          if (cancelled) return;
          setAvailability(null);
          onValidityChange?.(false, e?.message || "Could not check handle");
        })
        .finally(() => {
          if (!cancelled) setChecking(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onValidityChange is unstable from parents
  }, [normalized, formatCheck.ok, formatCheck.error]);

  const showOk = formatCheck.ok && availability?.available && !checking;
  const showBad =
    (formatCheck.ok && availability && !availability.available) || (!formatCheck.ok && String(value || "").trim());

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>Username</Label>
      <p className="text-xs text-muted-foreground">This becomes your public @handle in Community and on your profile.</p>
      <div className="relative">
        <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type="text"
          autoComplete="username"
          spellCheck={false}
          placeholder="your_artist_name"
          value={value}
          onChange={(e) => onChange(normalizeHandleInput(e.target.value))}
          className="h-12 pl-10 pr-10"
          required
          minLength={3}
          maxLength={24}
        />
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          {checking ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
          {showOk ? <Check className="h-4 w-4 text-emerald-600" /> : null}
          {showBad && !checking ? <X className="h-4 w-4 text-destructive" /> : null}
        </div>
      </div>
      {normalized ? (
        <p className="text-xs text-muted-foreground">
          Profile URL: <span className="font-600 text-foreground">{formatHandleLabel(normalized)}</span>
        </p>
      ) : null}
      {!formatCheck.ok && String(value || "").trim() ? (
        <p className="text-xs text-destructive">{formatCheck.error}</p>
      ) : null}
      {formatCheck.ok && availability && !availability.available ? (
        <p className="text-xs text-destructive">{availability.error || "That handle is already taken."}</p>
      ) : null}
    </div>
  );
}
