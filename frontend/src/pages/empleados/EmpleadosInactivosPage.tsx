/**
 * Lista de Empleados Inactivos (desvinculados)
 *
 * Se separa de la lista principal para que los operativos no vean
 * empleados que ya no trabajan en la empresa. El historial completo
 * (asistencias, jornales, nómina) se conserva y es accesible desde el
 * detalle, que se abre en modo lectura salvo por el botón "Reactivar".
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Users, ArrowLeft, UserX } from 'lucide-react';

import { formatDateAR } from '@/lib/utils';
import { getEmpleados } from '@/services/empleadoService';

const PAGE_SIZE = 20;

function tiempoTrabajado(ingreso: string, egreso: string | null): string {
  const inicio = new Date(ingreso);
  const fin = egreso ? new Date(egreso) : new Date();
  const dias = Math.max(0, Math.floor((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)));
  if (dias < 30) return `${dias} día${dias === 1 ? '' : 's'}`;
  if (dias < 365) {
    const meses = Math.floor(dias / 30);
    return `${meses} mes${meses === 1 ? '' : 'es'}`;
  }
  const anios = Math.floor(dias / 365);
  const mesesRestantes = Math.floor((dias % 365) / 30);
  return mesesRestantes > 0
    ? `${anios} año${anios === 1 ? '' : 's'} ${mesesRestantes} m`
    : `${anios} año${anios === 1 ? '' : 's'}`;
}

export default function EmpleadosInactivosPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['empleados-inactivos', page, search],
    queryFn: () =>
      getEmpleados({
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        search: search || undefined,
        estado: 'desvinculado',
        solo_activos: false,
      }),
  });

  const empleados = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <UserX className="w-6 h-6 text-amber-600" />
            Empleados inactivos
          </h1>
          <p className="text-muted-foreground text-sm">
            Empleados desvinculados. El historial completo se conserva y podés reactivar cuando quieras.
          </p>
        </div>
        <Link
          to="/empleados"
          className="inline-flex items-center gap-2 px-4 py-2 border border-input rounded-lg text-text-primary hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a activos
        </Link>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Buscar por nombre, DNI o código..."
          className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background"
        />
      </div>

      {/* Lista */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Cargando...</div>
        ) : empleados.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No hay empleados inactivos</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Código</th>
                    <th className="text-left px-4 py-3 font-medium">Empleado</th>
                    <th className="text-left px-4 py-3 font-medium">DNI</th>
                    <th className="text-left px-4 py-3 font-medium">Departamento</th>
                    <th className="text-left px-4 py-3 font-medium">Ingreso</th>
                    <th className="text-left px-4 py-3 font-medium">Egreso</th>
                    <th className="text-left px-4 py-3 font-medium">Trabajó</th>
                  </tr>
                </thead>
                <tbody>
                  {empleados.map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => navigate(`/empleados/${e.id}`)}
                      className="border-b border-border hover:bg-muted/40 cursor-pointer"
                    >
                      <td className="px-4 py-3 font-mono text-xs">{e.codigo}</td>
                      <td className="px-4 py-3 font-medium">{e.nombre_completo}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.dni}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {e.departamento || '—'}
                      </td>
                      <td className="px-4 py-3">{formatDateAR(e.fecha_ingreso)}</td>
                      <td className="px-4 py-3">
                        {e.fecha_egreso ? formatDateAR(e.fecha_egreso) : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {tiempoTrabajado(e.fecha_ingreso, e.fecha_egreso)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  Página {page + 1} de {totalPages} — {total} inactivo{total === 1 ? '' : 's'}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="px-3 py-1.5 border border-input rounded-lg hover:bg-muted disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 border border-input rounded-lg hover:bg-muted disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
