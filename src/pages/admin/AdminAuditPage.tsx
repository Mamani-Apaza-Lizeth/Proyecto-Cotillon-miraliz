import { useState, type ChangeEvent } from 'react';
import { ErrorState, PageHeader, Spinner } from '../../components/ui/Feedback';
import { SelectField } from '../../components/ui/Field';
import { useAsync } from '../../hooks/useAsync';
import { listAudit, profileNames } from '../../services/admin';
import { formatDateTime } from '../../lib/format';

const ENTITIES = [
  '',
  'orders',
  'payments',
  'quotes',
  'products',
  'stock_items',
  'recipes',
  'production_tasks',
  'profiles',
  'app_settings',
  'categories',
  'suppliers',
];

const ENTITY_LABELS: Record<string, string> = {
  orders: 'Pedidos',
  payments: 'Pagos',
  quotes: 'Cotizaciones',
  products: 'Productos',
  customization_templates: 'Plantillas de personalización',
  stock_items: 'Inventario',
  recipes: 'Recetas',
  recipe_stages: 'Etapas de receta',
  recipe_materials: 'Materiales de receta',
  production_tasks: 'Tareas de producción',
  profiles: 'Usuarios y roles',
  app_settings: 'Configuración',
  categories: 'Categorías',
  suppliers: 'Proveedores',
};

const ACTION_LABELS: Record<string, string> = {
  insert: 'Creación',
  update: 'Actualización',
  delete: 'Eliminación',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  employee: 'Empleado',
  customer: 'Cliente',
  system: 'Sistema',
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre',
  full_name: 'Nombre completo',
  email: 'Correo electrónico',
  phone: 'Teléfono',
  notes: 'Notas',
  description: 'Descripción',
  slug: 'Enlace corto',
  price: 'Precio',
  base_price: 'Precio base',
  surcharge: 'Recargo',
  amount: 'Monto',
  quantity: 'Cantidad',
  min_stock: 'Stock mínimo',
  min_order_qty: 'Cantidad mínima de pedido',
  units_per_pack: 'Unidades por presentación',
  unit_of_measure: 'Unidad de medida',
  unit_cost: 'Costo unitario',
  reference_cost: 'Costo de referencia',
  is_active: 'Activo',
  is_published: 'Publicado',
  is_featured: 'Destacado',
  allows_custom_design: 'Acepta diseño propio',
  product_type: 'Tipo de producto',
  stock_type: 'Tipo de inventario',
  status: 'Estado',
  payment_status: 'Estado de pago',
  payment_method: 'Método de pago',
  delivery_type: 'Tipo de entrega',
  role: 'Rol',
  supplier_id: 'Proveedor',
  category_id: 'Categoría',
  product_id: 'Producto',
  order_id: 'Pedido',
  assigned_to: 'Asignado a',
  due_date: 'Fecha límite',
  scheduled_date: 'Fecha programada',
  estimated_minutes: 'Minutos estimados',
  actual_minutes: 'Minutos reales',
  version: 'Versión',
  sort_order: 'Orden',
  value: 'Parámetros',
  key: 'Sección',
};

const VALUE_LABELS: Record<string, string> = {
  // Roles
  admin: 'Administrador',
  employee: 'Empleado',
  customer: 'Cliente',
  // Tipos
  resale: 'Reventa',
  custom: 'Personalizado',
  finished_product: 'Producto terminado',
  raw_material: 'Materia prima',
  pickup: 'Recojo en tienda',
  delivery: 'Entrega a domicilio',
  // Estados de pedido
  pending_quote: 'Cotización pendiente',
  quoted: 'Cotizado',
  quote_expired: 'Cotización vencida',
  pending_payment: 'Pendiente de pago',
  confirmed: 'Confirmado',
  in_production: 'En producción',
  ready: 'Listo',
  out_for_delivery: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  // Estados de pago / tarea
  pending: 'Pendiente',
  processing: 'Procesando',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  expired: 'Expirado',
  refunded: 'Reembolsado',
  in_progress: 'En progreso',
  blocked: 'Bloqueado',
  completed: 'Completado',
  // Métodos de pago
  qr: 'QR',
  card: 'Tarjeta',
  cash: 'Efectivo',
  transfer: 'Transferencia',
  // Secciones de configuración
  business: 'Datos del negocio',
  payments: 'Pagos',
  capacity: 'Capacidad del taller',
  orders: 'Reglas de pedidos',
};

function formatHumanValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return 'vacío';
  if (typeof val === 'boolean') return val ? 'Sí' : 'No';
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (typeof obj.name === 'string') return obj.name;
    return 'valores actualizados';
  }
  const str = String(val);
  if (str in VALUE_LABELS) {
    return VALUE_LABELS[str];
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(str)) {
    return `#${str.slice(0, 8)}`;
  }
  return str;
}

function summarizeDetails(action: string, entity: string, details: unknown): string[] {
  const entityName = ENTITY_LABELS[entity] ?? entity;
  if (!details || typeof details !== 'object') {
    return [`Operación registrada en ${entityName}.`];
  }

  const record = details as Record<string, unknown>;
  const lines: string[] = [];

  if (action === 'insert') {
    const rawName = typeof record.name === 'string' ? record.name : typeof record.key === 'string' ? record.key : '';
    const label = rawName ? `"${formatHumanValue(rawName)}"` : '';
    lines.push(`Se creó un nuevo registro ${label} en ${entityName}.`.replace('  ', ' '));
    if (typeof record.notes === 'string' && record.notes) lines.push(`Nota: ${record.notes}`);
    if (typeof record.phone === 'string' && record.phone) lines.push(`Teléfono: ${record.phone}`);
    if (typeof record.price === 'number') lines.push(`Precio: Bs ${record.price}`);
    if (typeof record.base_price === 'number') lines.push(`Precio base: Bs ${record.base_price}`);
    if (typeof record.quantity === 'number') lines.push(`Cantidad: ${record.quantity}`);
    return lines;
  }

  if (action === 'delete') {
    const label = typeof record.name === 'string' ? `"${record.name}"` : '';
    return [`Se eliminó un registro ${label} de ${entityName}.`.replace('  ', ' ')];
  }

  for (const [key, change] of Object.entries(record)) {
    if (key === 'updated_at' || key === 'created_at' || key === 'id') continue;
    const fieldName = FIELD_LABELS[key] ?? key;

    if (change && typeof change === 'object' && ('antes' in change || 'despues' in change)) {
      const diff = change as { antes?: unknown; despues?: unknown };
      lines.push(
        `${fieldName}: cambió de "${formatHumanValue(diff.antes)}" a "${formatHumanValue(diff.despues)}".`
      );
    } else {
      lines.push(`${fieldName}: ${formatHumanValue(change)}.`);
    }
  }

  return lines.length > 0 ? lines : [`Se actualizó un registro en ${entityName}.`];
}

export function AdminAuditPage() {
  const [entity, setEntity] = useState('');

  const selectProps = {
    label: 'Módulo',
    value: entity,
    onChange: (event: ChangeEvent<HTMLSelectElement>) => setEntity(event.target.value),
  };

  const data = useAsync(async () => {
    const rows = await listAudit(entity);
    const names = await profileNames(rows.map((r) => r.actor_id ?? ''));
    return { rows, names };
  }, [entity]);

  return (
    <div>
      <PageHeader title="Auditoría" subtitle="Registro de operaciones importantes. Es de solo lectura." />
      <div className="mb-4 max-w-xs">
        <SelectField {...selectProps}>
          {ENTITIES.map((item) => (
            <option key={item} value={item}>
              {item ? (ENTITY_LABELS[item] ?? item) : 'Todos los módulos'}
            </option>
          ))}
        </SelectField>
      </div>
      {data.loading && !data.data && <Spinner />}
      {data.error && <ErrorState message={data.error} onRetry={data.reload} />}
      {data.data && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Módulo</th>
                <th>Descripción del movimiento</th>
              </tr>
            </thead>
            <tbody>
              {data.data.rows.map((r) => {
                const summary = summarizeDetails(r.action, r.entity, r.details);
                const roleLabel = r.actor_role ? (ROLE_LABELS[r.actor_role] ?? r.actor_role) : 'Sistema';
                return (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                    <td>
                      {r.actor_id ? (data.data?.names.get(r.actor_id) ?? r.actor_id.slice(0, 8)) : 'Sistema'}
                      <span className="block text-xs text-ink-500">{roleLabel}</span>
                    </td>
                    <td className="font-bold">{ACTION_LABELS[r.action] ?? r.action}</td>
                    <td>
                      {ENTITY_LABELS[r.entity] ?? r.entity}
                      <span className="block font-mono text-[11px] text-ink-400">
                        {r.entity_id?.slice(0, 13)}
                      </span>
                    </td>
                    <td className="max-w-md text-xs text-ink-700">
                      <ul className="list-disc space-y-0.5 pl-4">
                        {summary.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[11px] text-ink-400 hover:text-ink-600">
                          Ver dato técnico
                        </summary>
                        <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-all rounded bg-ink-50 p-1.5 text-[10px] text-ink-600">
                          {JSON.stringify(r.details, null, 1)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                );
              })}
              {data.data.rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-ink-500">
                    Sin registros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
