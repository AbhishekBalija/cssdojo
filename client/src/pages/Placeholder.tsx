import { Header } from "@/components/Header";

export function Placeholder({ title }: { title: string }) {
  return (
    <div className="app">
      <Header />
      <div className="empty-state">
        <h2>{title}</h2>
      </div>
    </div>
  );
}
