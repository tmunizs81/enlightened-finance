import { BUILD_INFO } from "@/lib/build-info";

export function BuildFooter() {
  const shortDate = new Date(BUILD_INFO.buildTime).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const envColor =
    BUILD_INFO.env === "production"
      ? "bg-green-500/15 text-green-500 border-green-500/30"
      : "bg-amber-500/15 text-amber-500 border-amber-500/30";

  return (
    <footer className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-border/40 px-4 py-2 text-[10px] text-muted-foreground">
      <span className={`rounded-full border px-2 py-0.5 font-medium uppercase ${envColor}`}>
        {BUILD_INFO.env}
      </span>
      <span>
        build <code className="font-mono">{BUILD_INFO.commit}</code>
      </span>
      <span>·</span>
      <span>{shortDate}</span>
      <span>·</span>
      <span>© T2 SimplyFin</span>
    </footer>
  );
}
