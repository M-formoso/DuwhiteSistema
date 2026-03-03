/**
 * Página de Configuración del Sistema
 */

import { useState } from 'react';
import {
  Settings,
  Building2,
  Users,
  Bell,
  Shield,
  Database,
  FileText,
  Palette,
  Globe,
  Save,
  RefreshCw,
  Mail,
  Phone,
  MapPin,
  Clock,
  DollarSign,
  Percent,
  Printer,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';

interface ConfiguracionEmpresa {
  nombre: string;
  razonSocial: string;
  cuit: string;
  condicionIva: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  codigoPostal: string;
  telefono: string;
  email: string;
  sitioWeb: string;
}

interface ConfiguracionProduccion {
  horaInicioTurnoManana: string;
  horaFinTurnoManana: string;
  horaInicioTurnoTarde: string;
  horaFinTurnoTarde: string;
  alertaStockBajo: boolean;
  diasAnticipacionVencimiento: number;
}

interface ConfiguracionNotificaciones {
  emailAlertas: boolean;
  alertaStockBajo: boolean;
  alertaPedidoNuevo: boolean;
  alertaProduccionCompletada: boolean;
  alertaPagoRecibido: boolean;
  alertaVencimientoInsumo: boolean;
}

interface ConfiguracionFacturacion {
  puntoVenta: string;
  ultimoNumeroFacturaA: string;
  ultimoNumeroFacturaB: string;
  leyendaFactura: string;
  diasVencimientoFactura: number;
  tasaIva: number;
}

export default function ConfiguracionPage() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [tabActiva, setTabActiva] = useState('empresa');

  // Estados de configuración
  const [empresa, setEmpresa] = useState<ConfiguracionEmpresa>({
    nombre: 'DUWHITE',
    razonSocial: 'Lavandería Industrial DUWHITE S.A.',
    cuit: '30-12345678-9',
    condicionIva: 'responsable_inscripto',
    direccion: 'Av. Colón 1234',
    ciudad: 'Córdoba',
    provincia: 'Córdoba',
    codigoPostal: '5000',
    telefono: '+54 351 123-4567',
    email: 'info@duwhite.com.ar',
    sitioWeb: 'www.duwhite.com.ar',
  });

  const [produccion, setProduccion] = useState<ConfiguracionProduccion>({
    horaInicioTurnoManana: '06:00',
    horaFinTurnoManana: '14:00',
    horaInicioTurnoTarde: '14:00',
    horaFinTurnoTarde: '22:00',
    alertaStockBajo: true,
    diasAnticipacionVencimiento: 30,
  });

  const [notificaciones, setNotificaciones] = useState<ConfiguracionNotificaciones>({
    emailAlertas: true,
    alertaStockBajo: true,
    alertaPedidoNuevo: true,
    alertaProduccionCompletada: false,
    alertaPagoRecibido: true,
    alertaVencimientoInsumo: true,
  });

  const [facturacion, setFacturacion] = useState<ConfiguracionFacturacion>({
    puntoVenta: '0001',
    ultimoNumeroFacturaA: '00000125',
    ultimoNumeroFacturaB: '00000089',
    leyendaFactura: 'Gracias por confiar en DUWHITE. Servicio de lavandería industrial profesional.',
    diasVencimientoFactura: 30,
    tasaIva: 21,
  });

  const handleGuardar = async () => {
    setSaving(true);
    try {
      // En producción esto guardaría en el backend
      await new Promise((r) => setTimeout(r, 1000));

      toast({
        title: 'Configuración guardada',
        description: 'Los cambios se han guardado correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
          <p className="text-gray-500">Administra la configuración del sistema</p>
        </div>
        <Button onClick={handleGuardar} disabled={saving}>
          {saving ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Guardar Cambios
            </>
          )}
        </Button>
      </div>

      {/* Tabs de configuración */}
      <Tabs value={tabActiva} onValueChange={setTabActiva}>
        <TabsList className="grid grid-cols-2 lg:grid-cols-5 w-full">
          <TabsTrigger value="empresa" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Empresa</span>
          </TabsTrigger>
          <TabsTrigger value="produccion" className="gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Producción</span>
          </TabsTrigger>
          <TabsTrigger value="facturacion" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Facturación</span>
          </TabsTrigger>
          <TabsTrigger value="notificaciones" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notificaciones</span>
          </TabsTrigger>
          <TabsTrigger value="sistema" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Sistema</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Empresa */}
        <TabsContent value="empresa" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Datos de la Empresa
              </CardTitle>
              <CardDescription>
                Información general que aparecerá en facturas y documentos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre Comercial</Label>
                  <Input
                    value={empresa.nombre}
                    onChange={(e) => setEmpresa({ ...empresa, nombre: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Razón Social</Label>
                  <Input
                    value={empresa.razonSocial}
                    onChange={(e) => setEmpresa({ ...empresa, razonSocial: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>CUIT</Label>
                  <Input
                    value={empresa.cuit}
                    onChange={(e) => setEmpresa({ ...empresa, cuit: e.target.value })}
                    placeholder="XX-XXXXXXXX-X"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Condición IVA</Label>
                  <Select
                    value={empresa.condicionIva}
                    onValueChange={(value) => setEmpresa({ ...empresa, condicionIva: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="responsable_inscripto">Responsable Inscripto</SelectItem>
                      <SelectItem value="monotributo">Monotributo</SelectItem>
                      <SelectItem value="exento">Exento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Dirección
                </Label>
                <Input
                  value={empresa.direccion}
                  onChange={(e) => setEmpresa({ ...empresa, direccion: e.target.value })}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input
                    value={empresa.ciudad}
                    onChange={(e) => setEmpresa({ ...empresa, ciudad: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Provincia</Label>
                  <Input
                    value={empresa.provincia}
                    onChange={(e) => setEmpresa({ ...empresa, provincia: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Código Postal</Label>
                  <Input
                    value={empresa.codigoPostal}
                    onChange={(e) => setEmpresa({ ...empresa, codigoPostal: e.target.value })}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Teléfono
                  </Label>
                  <Input
                    value={empresa.telefono}
                    onChange={(e) => setEmpresa({ ...empresa, telefono: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
                  <Input
                    type="email"
                    value={empresa.email}
                    onChange={(e) => setEmpresa({ ...empresa, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Sitio Web
                  </Label>
                  <Input
                    value={empresa.sitioWeb}
                    onChange={(e) => setEmpresa({ ...empresa, sitioWeb: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Producción */}
        <TabsContent value="produccion" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Horarios de Producción
              </CardTitle>
              <CardDescription>
                Configura los turnos y horarios de trabajo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="font-medium">Turno Mañana</h4>
                  <div className="grid gap-4 grid-cols-2">
                    <div className="space-y-2">
                      <Label>Hora Inicio</Label>
                      <Input
                        type="time"
                        value={produccion.horaInicioTurnoManana}
                        onChange={(e) =>
                          setProduccion({ ...produccion, horaInicioTurnoManana: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hora Fin</Label>
                      <Input
                        type="time"
                        value={produccion.horaFinTurnoManana}
                        onChange={(e) =>
                          setProduccion({ ...produccion, horaFinTurnoManana: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-medium">Turno Tarde</h4>
                  <div className="grid gap-4 grid-cols-2">
                    <div className="space-y-2">
                      <Label>Hora Inicio</Label>
                      <Input
                        type="time"
                        value={produccion.horaInicioTurnoTarde}
                        onChange={(e) =>
                          setProduccion({ ...produccion, horaInicioTurnoTarde: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hora Fin</Label>
                      <Input
                        type="time"
                        value={produccion.horaFinTurnoTarde}
                        onChange={(e) =>
                          setProduccion({ ...produccion, horaFinTurnoTarde: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Alertas de Stock</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Alertas de stock bajo</p>
                    <p className="text-sm text-muted-foreground">
                      Recibir alertas cuando un insumo está por debajo del mínimo
                    </p>
                  </div>
                  <Switch
                    checked={produccion.alertaStockBajo}
                    onCheckedChange={(checked) =>
                      setProduccion({ ...produccion, alertaStockBajo: checked })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Días de anticipación para alertas de vencimiento</Label>
                  <Input
                    type="number"
                    min="1"
                    value={produccion.diasAnticipacionVencimiento}
                    onChange={(e) =>
                      setProduccion({
                        ...produccion,
                        diasAnticipacionVencimiento: parseInt(e.target.value) || 30,
                      })
                    }
                    className="w-32"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Facturación */}
        <TabsContent value="facturacion" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Configuración de Facturación
              </CardTitle>
              <CardDescription>
                Parámetros para la emisión de facturas A y B
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Punto de Venta</Label>
                  <Input
                    value={facturacion.puntoVenta}
                    onChange={(e) => setFacturacion({ ...facturacion, puntoVenta: e.target.value })}
                    className="w-24"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Último N° Factura A</Label>
                  <Input
                    value={facturacion.ultimoNumeroFacturaA}
                    onChange={(e) =>
                      setFacturacion({ ...facturacion, ultimoNumeroFacturaA: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Último N° Factura B</Label>
                  <Input
                    value={facturacion.ultimoNumeroFacturaB}
                    onChange={(e) =>
                      setFacturacion({ ...facturacion, ultimoNumeroFacturaB: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Días de vencimiento
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={facturacion.diasVencimientoFactura}
                    onChange={(e) =>
                      setFacturacion({
                        ...facturacion,
                        diasVencimientoFactura: parseInt(e.target.value) || 30,
                      })
                    }
                    className="w-24"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Tasa IVA (%)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={facturacion.tasaIva}
                    onChange={(e) =>
                      setFacturacion({
                        ...facturacion,
                        tasaIva: parseFloat(e.target.value) || 21,
                      })
                    }
                    className="w-24"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Leyenda de Factura</Label>
                <Textarea
                  value={facturacion.leyendaFactura}
                  onChange={(e) =>
                    setFacturacion({ ...facturacion, leyendaFactura: e.target.value })
                  }
                  rows={3}
                  placeholder="Texto que aparecerá al pie de las facturas"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Printer className="h-5 w-5" />
                Información para Facturas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
                <p>
                  <strong>Factura A:</strong> Se emite para clientes Responsables Inscriptos.
                  Muestra precios NETOS + IVA discriminado.
                </p>
                <p>
                  <strong>Factura B:</strong> Se emite para Consumidores Finales, Monotributistas y Exentos.
                  Muestra precios con IVA incluido.
                </p>
                <p className="text-muted-foreground">
                  El sistema selecciona automáticamente el tipo de factura según la condición IVA del cliente.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Notificaciones */}
        <TabsContent value="notificaciones" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notificaciones del Sistema
              </CardTitle>
              <CardDescription>
                Configura qué notificaciones deseas recibir
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Notificaciones por email</p>
                  <p className="text-sm text-muted-foreground">
                    Recibir alertas importantes por correo electrónico
                  </p>
                </div>
                <Switch
                  checked={notificaciones.emailAlertas}
                  onCheckedChange={(checked) =>
                    setNotificaciones({ ...notificaciones, emailAlertas: checked })
                  }
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase">
                  Tipos de Alertas
                </h4>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Stock bajo</p>
                    <p className="text-sm text-muted-foreground">
                      Cuando un insumo está por debajo del mínimo
                    </p>
                  </div>
                  <Switch
                    checked={notificaciones.alertaStockBajo}
                    onCheckedChange={(checked) =>
                      setNotificaciones({ ...notificaciones, alertaStockBajo: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Nuevo pedido</p>
                    <p className="text-sm text-muted-foreground">
                      Cuando se recibe un nuevo pedido de cliente
                    </p>
                  </div>
                  <Switch
                    checked={notificaciones.alertaPedidoNuevo}
                    onCheckedChange={(checked) =>
                      setNotificaciones({ ...notificaciones, alertaPedidoNuevo: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Producción completada</p>
                    <p className="text-sm text-muted-foreground">
                      Cuando un lote termina su proceso de producción
                    </p>
                  </div>
                  <Switch
                    checked={notificaciones.alertaProduccionCompletada}
                    onCheckedChange={(checked) =>
                      setNotificaciones({ ...notificaciones, alertaProduccionCompletada: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Pago recibido</p>
                    <p className="text-sm text-muted-foreground">
                      Cuando se registra un pago de cliente
                    </p>
                  </div>
                  <Switch
                    checked={notificaciones.alertaPagoRecibido}
                    onCheckedChange={(checked) =>
                      setNotificaciones({ ...notificaciones, alertaPagoRecibido: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Vencimiento de insumos</p>
                    <p className="text-sm text-muted-foreground">
                      Cuando un insumo está próximo a vencer
                    </p>
                  </div>
                  <Switch
                    checked={notificaciones.alertaVencimientoInsumo}
                    onCheckedChange={(checked) =>
                      setNotificaciones({ ...notificaciones, alertaVencimientoInsumo: checked })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Sistema */}
        <TabsContent value="sistema" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5" />
                Información del Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Versión del Sistema</p>
                  <p className="font-medium">1.0.0</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Última actualización</p>
                  <p className="font-medium">01/03/2025</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Seguridad
              </CardTitle>
              <CardDescription>
                Configuración de seguridad y accesos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Sesión activa</p>
                  <p className="text-sm text-muted-foreground">
                    Duración máxima de la sesión antes de requerir nuevo login
                  </p>
                </div>
                <Select defaultValue="480">
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">1 hora</SelectItem>
                    <SelectItem value="240">4 horas</SelectItem>
                    <SelectItem value="480">8 horas</SelectItem>
                    <SelectItem value="1440">24 horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Registro de actividad</p>
                  <p className="text-sm text-muted-foreground">
                    Guardar log de todas las operaciones del sistema
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gestión de Usuarios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">
                  La gestión de usuarios y roles se realiza desde el módulo de administración
                </p>
                <Button variant="outline" disabled>
                  Ir a Gestión de Usuarios (Próximamente)
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
