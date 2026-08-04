/**
 * Página principal del módulo "Historial de Lavados" (reemplaza al viejo módulo Actividades).
 * Contiene dos solapas: Historial de procesos y Remitos Eliminados.
 * Restringido a superadmin/administrador.
 */

import { useSearchParams } from 'react-router-dom';
import { History, Trash2 } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import HistorialTab from './tabs/HistorialTab';
import EliminadosTab from './tabs/EliminadosTab';

export default function HistorialLavadosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabActivo = searchParams.get('tab') === 'eliminados' ? 'eliminados' : 'historial';

  const cambiarTab = (value: string) => {
    const nuevos = new URLSearchParams(searchParams);
    if (value === 'historial') nuevos.delete('tab');
    else nuevos.set('tab', value);
    setSearchParams(nuevos);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Historial de Lavados</h1>
        <p className="text-sm text-gray-500">
          Consulta y auditoría de todos los procesos de lavado
        </p>
      </div>

      <Tabs value={tabActivo} onValueChange={cambiarTab}>
        <TabsList>
          <TabsTrigger value="historial" className="gap-2">
            <History className="h-4 w-4" />
            Historial
          </TabsTrigger>
          <TabsTrigger value="eliminados" className="gap-2">
            <Trash2 className="h-4 w-4" />
            Eliminados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="historial" className="mt-4">
          <HistorialTab />
        </TabsContent>

        <TabsContent value="eliminados" className="mt-4">
          <EliminadosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
