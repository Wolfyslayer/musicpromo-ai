import React from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="app-gradient flex min-h-dvh items-center justify-center overflow-y-auto px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mb-5 flex justify-center">
            <Logo size={44} withWord={false} />
          </div>
          {Icon ? (
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary/12 ring-1 ring-primary/20">
              <Icon className="h-6 w-6 text-primary" aria-hidden="true" strokeWidth={1.75} />
            </div>
          ) : null}
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle ? <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="surface rounded-2xl p-6 md:p-8">{children}</div>
        {footer ? <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p> : null}
        <p className="mt-5 text-center text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground hover:underline">
            Privacy
          </Link>
          {" · "}
          <Link to="/terms" className="hover:text-foreground hover:underline">
            Terms
          </Link>
        </p>
      </div>
    </div>
  );
}
