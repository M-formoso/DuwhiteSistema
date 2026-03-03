/**
 * Formulario de Empleado
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2, User, Briefcase, CreditCard, Heart } from 'lucide-react';
import { toast } from 'sonner';

import { getEmpleado, createEmpleado, updateEmpleado } from '@/services/empleadoService';
import type { EmpleadoCreate, EmpleadoUpdate, TipoEmpleado, TipoContrato } from '@/types/empleado';
import { TIPOS_EMPLEADO, TIPOS_CONTRATO, DIAS_SEMANA } from '@/types/empleado';

type TabType = 'personal' | 'laboral' | 'bancario' | 'salud';

export default function EmpleadoFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [activeTab, setActiveTab] = useState<TabType>('personal');
  const [formData, setFormData] = useState<EmpleadoCreate>({
    nombre: '',
    apellido: '',
    dni: '',
    cuil: null,
    fecha_nacimiento: null,
    email: null,
    telefono: null,
    telefono_emergencia: null,
    contacto_emergencia: null,
    direccion: null,
    ciudad: null,
    codigo_postal: null,
    tipo: 'operario',
    tipo_contrato: 'permanente',
    puesto: null,
    departamento: null,
    fecha_ingreso: new Date().toISOString().split('T')[0],
    horario_entrada: null,
    horario_salida: null,
    dias_trabajo: null,
    salario_base: 0,
    salario_hora: null,
    banco: null,
    tipo_cuenta_banco: null,
    numero_cuenta_banco: null,
    cbu: null,
    alias_cbu: null,
    obra_social: null,
    numero_afiliado_os: null,
    art: null,
    notas: null,
  });

  const [selectedDias, setSelectedDias] = useState<string[]>([]);

  // Query para cargar empleado existente
  const { data: empleado, isLoading: loadingEmpleado } = useQuery({
    queryKey: ['empleado', id],
    queryFn: () => getEmpleado(id!),
    enabled: isEditing,
  });

  // Cargar datos del empleado en el formulario
  useEffect(() => {
    if (empleado) {
      setFormData({
        nombre: empleado.nombre,
        apellido: empleado.apellido,
        dni: empleado.dni,
        cuil: empleado.cuil,
        fecha_nacimiento: empleado.fecha_nacimiento,
        email: empleado.email,
        telefono: empleado.telefono,
        telefono_emergencia: empleado.telefono_emergencia,
        contacto_emergencia: empleado.contacto_emergencia,
        direccion: empleado.direccion,
        ciudad: empleado.ciudad,
        codigo_postal: empleado.codigo_postal,
        tipo: empleado.tipo,
        tipo_contrato: empleado.tipo_contrato,
        puesto: empleado.puesto,
        departamento: empleado.departamento,
        fecha_ingreso: empleado.fecha_ingreso,
        horario_entrada: empleado.horario_entrada,
        horario_salida: empleado.horario_salida,
        dias_trabajo: empleado.dias_trabajo,
        salario_base: empleado.salario_base,
        salario_hora: empleado.salario_hora,
        banco: empleado.banco,
        tipo_cuenta_banco: empleado.tipo_cuenta_banco,
        numero_cuenta_banco: empleado.numero_cuenta_banco,
        cbu: empleado.cbu,
        alias_cbu: empleado.alias_cbu,
        obra_social: empleado.obra_social,
        numero_afiliado_os: empleado.numero_afiliado_os,
        art: empleado.art,
        notas: empleado.notas,
      });
      if (empleado.dias_trabajo) {
        setSelectedDias(empleado.dias_trabajo.split(','));
      }
    }
  }, [empleado]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: createEmpleado,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empleados'] });
      toast.success('Empleado creado exitosamente');
      navigate('/empleados');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al crear empleado');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: EmpleadoUpdate) => updateEmpleado(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empleados'] });
      queryClient.invalidateQueries({ queryKey: ['empleado', id] });
      toast.success('Empleado actualizado exitosamente');
      navigate('/empleados');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al actualizar empleado');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      ...formData,
      dias_trabajo: selectedDias.length > 0 ? selectedDias.join(',') : null,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value ? parseFloat(value) : null) : value || null,
    }));
  };

  const toggleDia = (dia: string) => {
    setSelectedDias((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    );
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  if (isEditing && loadingEmpleado) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: 'personal', label: 'Datos Personales', icon: User },
    { id: 'laboral', label: 'Datos Laborales', icon: Briefcase },
    { id: 'bancario', label: 'Datos Bancarios', icon: CreditCard },
    { id: 'salud', label: 'Obra Social / ART', icon: Heart },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/empleados')}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {isEditing ? 'Editar Empleado' : 'Nuevo Empleado'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Modifica los datos del empleado' : 'Registra un nuevo empleado'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tabs */}
        <div className="bg-card border border-border rounded-lg">
          <div className="border-b border-border">
            <nav className="flex -mb-px">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-text-primary hover:border-border'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Tab: Datos Personales */}
            {activeTab === 'personal' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Apellido *
                  </label>
                  <input
                    type="text"
                    name="apellido"
                    value={formData.apellido}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    DNI *
                  </label>
                  <input
                    type="text"
                    name="dni"
                    value={formData.dni}
                    onChange={handleChange}
                    required
                    disabled={isEditing}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    CUIL
                  </label>
                  <input
                    type="text"
                    name="cuil"
                    value={formData.cuil || ''}
                    onChange={handleChange}
                    placeholder="XX-XXXXXXXX-X"
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Fecha de Nacimiento
                  </label>
                  <input
                    type="date"
                    name="fecha_nacimiento"
                    value={formData.fecha_nacimiento || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    name="telefono"
                    value={formData.telefono || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Teléfono de Emergencia
                  </label>
                  <input
                    type="tel"
                    name="telefono_emergencia"
                    value={formData.telefono_emergencia || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Contacto de Emergencia
                  </label>
                  <input
                    type="text"
                    name="contacto_emergencia"
                    value={formData.contacto_emergencia || ''}
                    onChange={handleChange}
                    placeholder="Nombre y relación"
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Dirección
                  </label>
                  <input
                    type="text"
                    name="direccion"
                    value={formData.direccion || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    name="ciudad"
                    value={formData.ciudad || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Código Postal
                  </label>
                  <input
                    type="text"
                    name="codigo_postal"
                    value={formData.codigo_postal || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            {/* Tab: Datos Laborales */}
            {activeTab === 'laboral' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Tipo de Empleado *
                  </label>
                  <select
                    name="tipo"
                    value={formData.tipo}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {TIPOS_EMPLEADO.map((tipo) => (
                      <option key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Tipo de Contrato *
                  </label>
                  <select
                    name="tipo_contrato"
                    value={formData.tipo_contrato}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {TIPOS_CONTRATO.map((tipo) => (
                      <option key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Puesto
                  </label>
                  <input
                    type="text"
                    name="puesto"
                    value={formData.puesto || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Departamento
                  </label>
                  <input
                    type="text"
                    name="departamento"
                    value={formData.departamento || ''}
                    onChange={handleChange}
                    placeholder="ej: Lavado, Planchado, Administración"
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Fecha de Ingreso *
                  </label>
                  <input
                    type="date"
                    name="fecha_ingreso"
                    value={formData.fecha_ingreso}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Salario Base *
                  </label>
                  <input
                    type="number"
                    name="salario_base"
                    value={formData.salario_base || ''}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    required
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Salario por Hora
                  </label>
                  <input
                    type="number"
                    name="salario_hora"
                    value={formData.salario_hora || ''}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Días de Trabajo
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DIAS_SEMANA.map((dia) => (
                      <button
                        key={dia.value}
                        type="button"
                        onClick={() => toggleDia(dia.value)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          selectedDias.includes(dia.value)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {dia.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Horario Entrada
                  </label>
                  <input
                    type="time"
                    name="horario_entrada"
                    value={formData.horario_entrada || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Horario Salida
                  </label>
                  <input
                    type="time"
                    name="horario_salida"
                    value={formData.horario_salida || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Notas
                  </label>
                  <textarea
                    name="notas"
                    value={formData.notas || ''}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
              </div>
            )}

            {/* Tab: Datos Bancarios */}
            {activeTab === 'bancario' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Banco
                  </label>
                  <input
                    type="text"
                    name="banco"
                    value={formData.banco || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Tipo de Cuenta
                  </label>
                  <select
                    name="tipo_cuenta_banco"
                    value={formData.tipo_cuenta_banco || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="caja_ahorro">Caja de Ahorro</option>
                    <option value="cuenta_corriente">Cuenta Corriente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Número de Cuenta
                  </label>
                  <input
                    type="text"
                    name="numero_cuenta_banco"
                    value={formData.numero_cuenta_banco || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    CBU
                  </label>
                  <input
                    type="text"
                    name="cbu"
                    value={formData.cbu || ''}
                    onChange={handleChange}
                    maxLength={22}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Alias CBU
                  </label>
                  <input
                    type="text"
                    name="alias_cbu"
                    value={formData.alias_cbu || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            {/* Tab: Obra Social / ART */}
            {activeTab === 'salud' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Obra Social
                  </label>
                  <input
                    type="text"
                    name="obra_social"
                    value={formData.obra_social || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Número de Afiliado
                  </label>
                  <input
                    type="text"
                    name="numero_afiliado_os"
                    value={formData.numero_afiliado_os || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    ART
                  </label>
                  <input
                    type="text"
                    name="art"
                    value={formData.art || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/empleados')}
            className="px-4 py-2 border border-input rounded-lg text-text-primary hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEditing ? 'Guardar Cambios' : 'Crear Empleado'}
          </button>
        </div>
      </form>
    </div>
  );
}
