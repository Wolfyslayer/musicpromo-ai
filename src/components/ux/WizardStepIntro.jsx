/**
 * Apple-style step header inside the create wizard.
 */
export default function WizardStepIntro({ title, description, optionalHint }) {
  return (
    <div className="mb-6 space-y-2 border-b border-border/40 pb-5">
      <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground md:text-2xl">{title}</h2>
      {description ? <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      {optionalHint ? (
        <p className="text-xs font-medium text-primary/90">{optionalHint}</p>
      ) : null}
    </div>
  );
}
