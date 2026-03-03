# Crear Módulo Frontend

Crea un nuevo módulo frontend completo para el Sistema DUWHITE usando React + TypeScript.

## Parámetros
- **$ARGUMENTS**: Nombre del módulo (ej: "stock", "proveedores", "clientes")

## Instrucciones

1. **Crear tipos TypeScript** en `frontend/src/types/{modulo}.ts`:
   - Interfaces para el modelo
   - Tipos para formularios
   - Tipos para filtros y paginación

2. **Crear servicio API** en `frontend/src/services/{modulo}Service.ts`:
   - Funciones para CRUD (usando Axios)
   - Tipado completo de request/response
   - Manejo de errores

3. **Crear componentes** en `frontend/src/components/{modulo}/`:
   - `{Modulo}List.tsx`: Tabla con TanStack Table, filtros, paginación
   - `{Modulo}Form.tsx`: Formulario con React Hook Form + Zod
   - `{Modulo}Detail.tsx`: Vista detalle
   - `{Modulo}Filters.tsx`: Filtros de búsqueda
   - `index.ts`: exports

4. **Crear páginas** en `frontend/src/pages/{modulo}/`:
   - `index.tsx`: Listado principal
   - `create.tsx`: Crear nuevo
   - `[id].tsx`: Ver/Editar detalle

5. **Crear custom hooks** en `frontend/src/hooks/`:
   - `use{Modulo}.ts`: Hook con TanStack Query para data fetching
   - Cache, refetch, mutations

6. **Agregar rutas** en el router principal

7. **Agregar al sidebar** en el layout

## Estilo
- Usar Tailwind CSS con la paleta DUWHITE
- Componentes de shadcn/ui
- Iconos de lucide-react
- Mobile-first para vistas de operarios

## Ejemplo de uso
```
/crear-modulo-frontend clientes
```

## Checklist de verificación
- [ ] Tipos TypeScript completos (sin `any`)
- [ ] Servicio API con manejo de errores
- [ ] Componentes con loading/error states
- [ ] Formularios con validación Zod
- [ ] Tabla con filtros y paginación
- [ ] Responsive design
- [ ] Rutas configuradas
- [ ] Sidebar actualizado
