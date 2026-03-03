/**
 * Lista de Empleados
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Users, Filter, Phone, Mail, Building2 } from 'lucide-react';

import { getEmpleados, getDepartamentos } from '@/services/empleadoService';
import type { EmpleadoList, TipoEmpleado, EstadoEmpleado } from '@/types/empleado';
import {
  TIPOS_EMPLEADO,
  ESTADOS_EMPLEADO,
  getEstadoBadgeColor,
  getTipoBadgeColor,
} from '@/types/empleado';

export default function EmpleadosListPage() {
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<TipoEmpleado | ''>('');
  const [estadoFilter, setEstadoFilter] = useState<EstadoEmpleado | ''>('');
  const [departamentoFilter, setDepartamentoFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['empleados', page, search, tipoFilter, estadoFilter, departamentoFilter],
    queryFn: () =>
      getEmpleados({
        skip: page * limit,
        limit,
        search: search || undefined,
        tipo: tipoFilter || undefined,
        estado: estadoFilter || undefined,
        departamento: departamentoFilter || undefined,
        solo_activos: estadoFilter !== 'desvinculado',
      }),
  });

  const { data: departamentos } = useQuery({
    queryKey: ['departamentos'],
    queryFn: getDepartamentos,
  });

  const empleados = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-AR');
  };

  const clearFilters = () => {
    setTipoFilter('');
    setEstadoFilter('');
    setDepartamentoFilter('');
    setSearch('');
  };

  const hasActiveFilters = tipoFilter || estadoFilter || departamentoFilter || search;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Empleados</h1>
          <p className="text-muted-foreground">Gestión del personal de la empresa</p>
        </div>
        <Link
          to="/empleados/nuevo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Empleado
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Empleados</p>
              <p className="text-xl font-bold text-text-primary">{total}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nombre, DNI o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-lg text-text-primary placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-primary/10 border-primary text-primary'
                : 'border-input text-muted-foreground hover:text-text-primary'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-primary rounded-full"></span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Tipo
              </label>
              <select
                value={tipoFilter}
                onChange={(e) => setTipoFilter(e.target.value as TipoEmpleado | '')}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Todos los tipos</option>
                {TIPOS_EMPLEADO.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Estado
              </label>
              <select
                value={estadoFilter}
                onChange={(e) => setEstadoFilter(e.target.value as EstadoEmpleado | '')}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Todos los estados</option>
                {ESTADOS_EMPLEADO.map((estado) => (
                  <option key={estado.value} value={estado.value}>
                    {estado.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Departamento
              </label>
              <select
                value={departamentoFilter}
                onChange={(e) => setDepartamentoFilter(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Todos los departamentos</option>
                {departamentos?.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <div className="md:col-span-3 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="text-sm text-primary hover:underline"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Empleado
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  DNI
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Puesto
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Ingreso
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Contacto
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Cargando...
                  </td>
                </tr>
              ) : empleados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No se encontraron empleados
                  </td>
                </tr>
              ) : (
                empleados.map((empleado: EmpleadoList) => (
                  <tr
                    key={empleado.id}
                    className="border-b border-border hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/empleados/${empleado.id}`}
                        className="flex items-center gap-3"
                      >
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-primary font-medium">
                            {empleado.nombre_completo.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-text-primary hover:text-primary">
                            {empleado.nombre_completo}
                          </p>
                          <p className="text-sm text-muted-foreground">{empleado.codigo}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-primary">{empleado.dni}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getTipoBadgeColor(
                          empleado.tipo
                        )}`}
                      >
                        {TIPOS_EMPLEADO.find((t) => t.value === empleado.tipo)?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getEstadoBadgeColor(
                          empleado.estado
                        )}`}
                      >
                        {ESTADOS_EMPLEADO.find((e) => e.value === empleado.estado)?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-text-primary">{empleado.puesto || '-'}</div>
                      {empleado.departamento && (
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {empleado.departamento}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {formatDate(empleado.fecha_ingreso)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {empleado.telefono && (
                          <a
                            href={`tel:${empleado.telefono}`}
                            className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            {empleado.telefono}
                          </a>
                        )}
                        {empleado.email && (
                          <a
                            href={`mailto:${empleado.email}`}
                            className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                          >
                            <Mail className="w-3 h-3" />
                            {empleado.email}
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Mostrando {page * limit + 1} - {Math.min((page + 1) * limit, total)} de {total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 0}
                className="px-3 py-1 text-sm border border-input rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 text-sm border border-input rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
