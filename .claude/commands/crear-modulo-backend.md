# Crear Módulo Backend

Crea un nuevo módulo backend completo para el Sistema DUWHITE siguiendo la arquitectura establecida.

## Parámetros
- **$ARGUMENTS**: Nombre del módulo (ej: "stock", "proveedores", "clientes")

## Instrucciones

1. **Crear el modelo SQLAlchemy** en `backend/app/models/{modulo}.py`:
   - Usar UUID como PK
   - Incluir campos `created_at`, `updated_at`, `activo`
   - Implementar soft delete
   - Relaciones con otras tablas según el esquema de BD

2. **Crear schemas Pydantic** en `backend/app/schemas/{modulo}.py`:
   - `{Modulo}Base`: campos comunes
   - `{Modulo}Create`: para crear
   - `{Modulo}Update`: para actualizar (campos opcionales)
   - `{Modulo}Response`: respuesta con ID y timestamps
   - `{Modulo}List`: para listados con paginación

3. **Crear el servicio** en `backend/app/services/{modulo}_service.py`:
   - Funciones CRUD completas
   - Lógica de negocio específica
   - Validaciones
   - Logs de auditoría

4. **Crear endpoints** en `backend/app/api/v1/endpoints/{modulo}.py`:
   - GET (lista con filtros y paginación)
   - GET /{id}
   - POST
   - PUT /{id}
   - DELETE /{id} (soft delete)
   - Decoradores de permisos según rol
   - Dependency injection

5. **Registrar en el router** en `backend/app/api/v1/api.py`

6. **Crear migración** con Alembic

7. **Crear tests** en `backend/tests/api/test_{modulo}.py`

## Ejemplo de uso
```
/crear-modulo-backend proveedores
```

## Checklist de verificación
- [ ] Modelo con campos según esquema de BD
- [ ] Schemas con validación Pydantic v2
- [ ] Servicio con lógica de negocio
- [ ] Endpoints con permisos por rol
- [ ] Router registrado
- [ ] Migración creada
- [ ] Tests básicos
