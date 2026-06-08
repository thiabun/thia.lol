import { Activity, Database, Shield, UsersRound } from "lucide-react";
import { PageMeta } from "../components/PageMeta";
import { Badge } from "../components/ui/Badge";
import { Panel } from "../components/ui/Panel";

export function AdminPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageMeta
        title="Admin"
        description="Admin placeholder for future thia.lol platform operations."
        path="/admin"
      />
      <Panel className="p-5 sm:p-6">
        <Badge tone="rose">admin placeholder</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-normal text-text">
          Platform operations will live here.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
          Moderation, room health, user support, and API observability are staged for
          the PHP/MySQL backend.
        </p>
      </Panel>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminMetric icon={UsersRound} label="Users" value="pending" />
        <AdminMetric icon={Activity} label="Reports" value="0" />
        <AdminMetric icon={Shield} label="Roles" value="planned" />
        <AdminMetric icon={Database} label="API" value="mocked" />
      </section>

      <Panel className="p-5">
        <h2 className="text-lg font-semibold text-text">Backend readiness</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Status label="Schema" value="drafted" />
          <Status label="Health route" value="/api/health" />
          <Status label="Auth policy" value="future" />
        </div>
      </Panel>
    </div>
  );
}

type AdminMetricProps = {
  icon: typeof UsersRound;
  label: string;
  value: string;
};

function AdminMetric({ icon: Icon, label, value }: AdminMetricProps) {
  return (
    <Panel className="p-4">
      <div className="grid size-11 place-items-center rounded-card bg-surface-strong text-accent-strong">
        <Icon aria-hidden="true" size={19} />
      </div>
      <p className="mt-4 text-sm text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-text">{value}</p>
    </Panel>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-canvas/45 p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-semibold text-text">{value}</p>
    </div>
  );
}
