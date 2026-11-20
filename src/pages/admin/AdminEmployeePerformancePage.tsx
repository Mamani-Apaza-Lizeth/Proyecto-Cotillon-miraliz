import { useMemo, useState } from 'react';
import { Badge, EmptyState, ErrorState, PageHeader, Spinner, StatCard } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { formatMinutes, todayInLaPaz } from '../../lib/format';
import { listEmployeePerformanceTasks, type EmployeePerformanceTask } from '../../services/production';
import type { TaskStatus } from '../../types/db';

type Bucket = 'early' | 'onTime' | 'lateDone' | 'overdue' | 'pending' | 'blocked';
const BUCKET_LABEL: Record<Bucket, string> = {
  early: 'Terminadas antes del plazo', onTime: 'Terminadas dentro del plazo', lateDone: 'Terminadas después del plazo',
  overdue: 'Pendientes con plazo vencido', pending: 'Pendientes dentro del plazo', blocked: 'Bloqueadas',
};

function classify(status: TaskStatus, completedAt: string | null, due: string | null, today: string): Bucket {
  if (status === 'bloqueada') return 'blocked';
  if (status === 'completada') {
    if (!due || !completedAt) return 'onTime';
    const completedDay = completedAt.slice(0, 10);
    return completedDay < due ? 'early' : completedDay === due ? 'onTime' : 'lateDone';
  }
  return due && due < today ? 'overdue' : 'pending';
}

export function AdminEmployeePerformancePage() {
  const tasks = useAsync(listEmployeePerformanceTasks, []);
  const [selected, setSelected] = useState('');
  const today = todayInLaPaz();
  const employees = useMemo(() => {
    const grouped = new Map<string, { id: string; name: string; email: string; tasks: EmployeePerformanceTask[] }>();
    for (const task of tasks.data ?? []) {
      const profile = task.profiles;
      if (!profile) continue;
      const entry = grouped.get(profile.id) ?? { id: profile.id, name: profile.full_name || profile.email, email: profile.email, tasks: [] };
      entry.tasks.push(task);
      grouped.set(profile.id, entry);
    }
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [tasks.data]);
  const employee = employees.find((item) => item.id === selected) ?? employees[0];
  const rows = employee?.tasks ?? [];
  const counts = useMemo(() => {
    const result: Record<Bucket, number> = { early: 0, onTime: 0, lateDone: 0, overdue: 0, pending: 0, blocked: 0 };
    for (const task of rows) result[classify(task.status, task.completed_at, task.orders?.promised_date ?? null, today)] += 1;
    return result;
  }, [rows, today]);
  const completed = counts.early + counts.onTime + counts.lateDone;
  const compliant = counts.early + counts.onTime;
  const estimated = rows.reduce((sum, task) => sum + task.est_minutes, 0);
  const actual = rows.reduce((sum, task) => sum + task.spent_minutes, 0);

  return <div>
    <PageHeader title="Rendimiento de producción" subtitle="Seguimiento descriptivo basado en tareas, plazos y tiempo registrados; no es una evaluación disciplinaria." />
    {tasks.loading && !tasks.data && <Spinner />}
    {tasks.error && <ErrorState message={tasks.error} onRetry={tasks.reload} />}
    {tasks.data && employees.length === 0 && <EmptyState title="Sin tareas asignadas" description="Cuando haya tareas de producción asignadas, aquí aparecerá su resumen por trabajador." />}
    {employee && <div className="space-y-5">
      <label className="block max-w-md"><span className="label">Trabajador</span>
        <select className="input" value={employee.id} onChange={(event) => setSelected(event.target.value)}>
          {employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Tareas asignadas" value={rows.length} hint={`${completed} terminadas`} />
        <StatCard label="Cumplimiento a tiempo" value={completed ? `${Math.round((compliant / completed) * 100)}%` : '—'} hint={`${compliant} de ${completed} tareas terminadas`} />
        <StatCard label="Tiempo estimado" value={formatMinutes(estimated)} />
        <StatCard label="Tiempo registrado" value={formatMinutes(actual)} hint={actual > estimated ? `${formatMinutes(actual - estimated)} sobre lo estimado` : `${formatMinutes(estimated - actual)} bajo lo estimado`} />
      </div>
      <section className="card p-4 sm:p-5">
        <h2 className="mb-3 text-lg">Clasificación de tareas</h2>
        <ul className="divide-y divide-ink-100">
          {(Object.keys(BUCKET_LABEL) as Bucket[]).map((bucket) => <li key={bucket} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span>{BUCKET_LABEL[bucket]}</span><Badge tone={bucket === 'overdue' || bucket === 'lateDone' || bucket === 'blocked' ? 'red' : bucket === 'early' || bucket === 'onTime' ? 'green' : 'yellow'}>{counts[bucket]}</Badge>
          </li>)}
        </ul>
        <p className="mt-3 text-xs text-ink-500">El plazo se toma de la fecha prometida del pedido. Tareas sin fecha límite completadas se muestran como dentro del plazo; las pendientes aún sin vencer no se cuentan como incumplidas.</p>
      </section>
    </div>}
  </div>;
}
