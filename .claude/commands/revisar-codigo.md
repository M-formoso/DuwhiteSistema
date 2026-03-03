# Revisar Código DUWHITE

Realiza una revisión de código siguiendo los estándares del proyecto DUWHITE.

## Parámetros
- **$ARGUMENTS**: Ruta del archivo o directorio a revisar

## Checklist de Revisión

### Backend (Python/FastAPI)

#### Arquitectura
- [ ] Lógica de negocio en servicios, NO en endpoints
- [ ] Validación Pydantic en todos los inputs
- [ ] Type hints en todas las funciones
- [ ] Docstrings en funciones públicas

#### Seguridad
- [ ] Verificación de permisos en endpoints
- [ ] Soft delete implementado (campo `activo`)
- [ ] Logs de auditoría en operaciones de escritura
- [ ] Sanitización de inputs
- [ ] Sin hardcoded secrets

#### Base de Datos
- [ ] Uso de transacciones para operaciones críticas
- [ ] Índices en campos de búsqueda frecuente
- [ ] Relaciones correctas (FK, cascades)
- [ ] Timestamps (created_at, updated_at)

#### Código
- [ ] Sin código comentado innecesario
- [ ] Manejo de excepciones apropiado
- [ ] Sin prints de debug (usar logging)
- [ ] Nombres descriptivos en español

### Frontend (React/TypeScript)

#### TypeScript
- [ ] Sin uso de `any`
- [ ] Interfaces definidas para todos los tipos
- [ ] Props tipadas correctamente
- [ ] Retornos de funciones tipados

#### Componentes
- [ ] Componentes pequeños y reutilizables
- [ ] Loading states implementados
- [ ] Error handling implementado
- [ ] Keys únicas en listas

#### Formularios
- [ ] Validación con Zod
- [ ] Mensajes de error claros
- [ ] Feedback de submit (loading, success, error)
- [ ] Campos requeridos marcados

#### Estilos
- [ ] Uso de Tailwind (no CSS custom)
- [ ] Paleta DUWHITE respetada
- [ ] Mobile-first responsive
- [ ] Consistencia visual con shadcn/ui

#### Performance
- [ ] Memoización donde sea necesario
- [ ] Sin re-renders innecesarios
- [ ] Lazy loading de componentes pesados
- [ ] Imágenes optimizadas

### Formato Argentino
- [ ] Fechas: DD/MM/YYYY
- [ ] Moneda: $ con separador de miles (punto) y decimales (coma)
- [ ] CUIT: XX-XXXXXXXX-X
- [ ] Validación de CUIT/CUIL

---

## Template de Reporte

```markdown
# Code Review: {archivo}

## Resumen
- **Estado**: ✅ Aprobado / ⚠️ Cambios menores / ❌ Requiere revisión
- **Archivos revisados**: X
- **Issues encontrados**: X

## Issues

### 🔴 Crítico
1. [Descripción del issue]
   - Línea: XX
   - Sugerencia: [código sugerido]

### 🟡 Mejora
1. [Descripción]
   - Línea: XX
   - Sugerencia: [código]

### 🟢 Nitpick
1. [Descripción menor]

## Aspectos Positivos
- [Qué está bien implementado]

## Recomendaciones Generales
- [Sugerencias de mejora]
```

## Ejemplo de uso
```
/revisar-codigo backend/app/services/stock_service.py
/revisar-codigo frontend/src/components/clientes/
```
