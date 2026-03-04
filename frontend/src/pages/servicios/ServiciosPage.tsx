/**
 * Página principal de Servicios y Listas de Precios
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tag, List } from 'lucide-react';

import ServiciosList from './ServiciosList';
import ListasPreciosList from './ListasPreciosList';

export default function ServiciosPage() {
  const [activeTab, setActiveTab] = useState('servicios');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Servicios y Listas de Precios</h1>
        <p className="text-text-secondary mt-1">
          Gestiona los servicios ofrecidos y sus listas de precios
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="servicios" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Servicios
          </TabsTrigger>
          <TabsTrigger value="listas" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Listas de Precios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="servicios" className="mt-6">
          <ServiciosList />
        </TabsContent>

        <TabsContent value="listas" className="mt-6">
          <ListasPreciosList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
