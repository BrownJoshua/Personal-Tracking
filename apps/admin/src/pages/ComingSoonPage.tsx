import { PageHeader } from "../components/ui";

export function ComingSoonPage({ title, phase, items }: { title: string; phase: string; items: string[] }) {
  return (
    <>
      <PageHeader title={title} subtitle={`Planned for ${phase}`} />
      <div className="card">
        <p>This section is part of the roadmap and is not built yet. It will include:</p>
        <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>
      </div>
    </>
  );
}
