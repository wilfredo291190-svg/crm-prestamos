'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Formateador universal de fechas a DD/MM/AAAA
function formatearFechaEspanol(fechaStr: string) {
  if (!fechaStr) return 'N/A';
  const cleanDate = fechaStr.split('T')[0];
  const partes = cleanDate.split(/[-/]/);
  if (partes.length === 3) {
    if (partes[0].length === 4) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return `${partes[0]}/${partes[1]}/${partes[2]}`;
  }
  return fechaStr;
}

// Convertidor de cualquier formato de fecha a ISO (AAAA-MM-DD)
function normalizarFechaISO(fechaInput: string) {
  if (!fechaInput) return new Date().toISOString().split('T')[0];
  const partes = fechaInput.trim().split(/[-/]/);
  if (partes.length === 3) {
    if (partes[0].length === 4) {
      return `${partes[0]}-${partes[1].padStart(2, '0')}-${partes[2].padStart(2, '0')}`;
    }
    if (partes[2].length === 4) {
      return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
    }
  }
  return fechaInput;
}

export default function Home() {
  // Estado de Sesión y Autenticación
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Selector de Tema
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [effectiveTheme, setEffectiveTheme] = useState<'dark' | 'light'>('dark');

  // Campos de Auth
  const [authIdentifier, setAuthIdentifier] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Datos de Registro
  const [regUsername, setRegUsername] = useState('');
  const [regNombre, setRegNombre] = useState('');
  const [regEmail, setRegEmail] = useState('');

  // Estados de CRM
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clientes' | 'prestamos' | 'pagos' | 'csv'>('dashboard');
  const [loading, setLoading] = useState(true);

  // Estados de Datos
  const [clientes, setClientes] = useState<any[]>([]);
  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [quincenas, setQuincenas] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);

  // Formularios CRM
  const hoyISO = new Date().toISOString().split('T')[0];
  
  const [nuevoCliente, setNuevoCliente] = useState({ nombre_completo: '', cedula: '', telefono: '', direccion: '' });
  const [clienteEditar, setClienteEditar] = useState<any>(null);
  
  const [nuevoPrestamo, setNuevoPrestamo] = useState({ 
    cliente_id: '', 
    monto_original: '', 
    tasa_quincenal: '', 
    esquema_cobro: '15_30', 
    fecha_inicio: hoyISO
  });

  const [nuevoPago, setNuevoPago] = useState({ 
    prestamo_id: '', 
    monto_total: '', 
    metodo_pago: 'Yappy', 
    fecha_pago: hoyISO
  });

  const [csvTexto, setCsvTexto] = useState('');

  // EXPEDIENTE DIGITAL Y TUTORIALES
  const [clienteExpediente, setClienteExpediente] = useState<any>(null);
  const [mostrarTutorial, setMostrarTutorial] = useState(false);
  const [tutorialSeccion, setTutorialSeccion] = useState<'general' | 'csv' | 'interes' | 'pwa'>('general');

  // MODALES Y ALERTAS NATIVAS
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    tipo: 'alerta' | 'confirmacion' | 'exito' | 'error';
    titulo: string;
    mensaje: string;
    onAceptar?: () => void;
  }>({
    isOpen: false,
    tipo: 'alerta',
    titulo: '',
    mensaje: ''
  });

  useEffect(() => {
    const handleThemeChange = () => {
      if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setEffectiveTheme(isDark ? 'dark' : 'light');
      } else {
        setEffectiveTheme(theme);
      }
    };

    handleThemeChange();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleThemeChange);
    return () => mediaQuery.removeEventListener('change', handleThemeChange);
  }, [theme]);

  function mostrarAlerta(titulo: string, mensaje: string, tipo: 'alerta' | 'exito' | 'error' = 'alerta') {
    setModalConfig({ isOpen: true, tipo, titulo, mensaje });
  }

  function mostrarConfirmacion(titulo: string, mensaje: string, onAceptar: () => void) {
    setModalConfig({ isOpen: true, tipo: 'confirmacion', titulo, mensaje, onAceptar });
  }

  function cerrarModal() {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  }

  function calcularFuerzaPassword(pass: string) {
    if (!pass) return { score: 0, label: '', colorClass: 'bg-gray-800' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) || /[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass) && pass.length >= 8) score += 1;

    if (score === 1) return { score: 1, label: 'Débil', colorClass: 'bg-red-500' };
    if (score === 2) return { score: 2, label: 'Moderada', colorClass: 'bg-amber-500' };
    if (score === 3) return { score: 3, label: 'Fuerte', colorClass: 'bg-emerald-500' };
    return { score: 0, label: 'Muy Débil', colorClass: 'bg-red-500' };
  }

  const fuerzaPass = calcularFuerzaPassword(authPassword);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      if (session) cargarDatos(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) cargarDatos(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();

    if (authPassword.length < 8) {
      return mostrarAlerta('Contraseña Muy Corta', 'La contraseña debe tener mínimo 8 caracteres.', 'alerta');
    }

    setIsSubmitting(true);

    try {
      if (isRegistering) {
        if (!regUsername || !regNombre || !regEmail) {
          setIsSubmitting(false);
          return mostrarAlerta('Datos Incompletos', 'Por favor ingresa tu Usuario, Nombre Completo y Correo Electrónico.', 'alerta');
        }

        const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}` : 'https://prestao-app.vercel.app';
        
        const { data, error } = await supabase.auth.signUp({
          email: regEmail,
          password: authPassword,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              username: regUsername.toLowerCase().trim(),
              nombre_completo: regNombre,
            }
          }
        });
        
        setIsSubmitting(false);

        if (error) {
          if (error.message.includes('already registered') || error.message.includes('User already exists')) {
            mostrarAlerta('Cuenta Existente', 'Este correo o usuario ya se encuentra registrado.', 'error');
          } else {
            mostrarAlerta('Error de Registro', error.message, 'error');
          }
        } else if (data?.user && data?.session) {
          mostrarAlerta('Cuenta Creada', 'Bienvenido a Prestao. Tu sesión ha sido iniciada.', 'exito');
        } else {
          mostrarAlerta(
            'Verificación Enviada', 
            `Hemos enviado un correo de confirmación a ${regEmail}. Revisa tu bandeja para activar tu cuenta.`, 
            'exito'
          );
          setIsRegistering(false);
        }
      } else {
        let emailToLogin = authIdentifier.trim();

        if (!emailToLogin.includes('@')) {
          const { data: userMeta } = await supabase
            .from('profiles')
            .select('email')
            .eq('username', emailToLogin.toLowerCase())
            .single();

          if (userMeta?.email) {
            emailToLogin = userMeta.email;
          }
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: emailToLogin,
          password: authPassword,
        });

        setIsSubmitting(false);

        if (error) {
          mostrarAlerta('Error de Acceso', 'Usuario/Correo o contraseña incorrectos.', 'error');
        }
      }
    } catch (err: any) {
      setIsSubmitting(false);
      mostrarAlerta('Error', err.message || 'Ocurrió un error inesperado', 'error');
    }
  }

  async function handleSignOut() {
    mostrarConfirmacion('Cerrar Sesión', '¿Estás seguro de que deseas salir del sistema?', async () => {
      await supabase.auth.signOut();
      setSession(null);
      setClientes([]);
      setPrestamos([]);
      setPagos([]);
    });
  }

  function cambiarPestana(tab: 'dashboard' | 'clientes' | 'prestamos' | 'pagos' | 'csv') {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function cargarDatos(userId?: string) {
    setLoading(true);
    const activeUserId = userId || session?.user?.id;

    if (!supabaseUrl || !supabaseAnonKey || !activeUserId) {
      setLoading(false);
      return;
    }

    const { data: dataClientes } = await supabase.from('clientes').select('*').eq('user_id', activeUserId).order('creado_en', { ascending: false });
    const { data: dataPrestamos } = await supabase.from('prestamos').select('*, clientes(*)').eq('user_id', activeUserId).order('creado_en', { ascending: false });
    const { data: dataQuincenas } = await supabase.from('quincenas_interes').select('*');
    const { data: dataPagos } = await supabase.from('pagos').select('*, prestamos(*, clientes(*))').eq('user_id', activeUserId).order('fecha_pago', { ascending: false });

    if (dataClientes) setClientes(dataClientes);
    if (dataPrestamos) setPrestamos(dataPrestamos);
    if (dataQuincenas) setQuincenas(dataQuincenas);
    if (dataPagos) setPagos(dataPagos);

    setLoading(false);
  }

  function getEstadoCliente(clienteId: string) {
    const prestamosCliente = prestamos.filter(p => p.cliente_id === clienteId && p.estado === 'activo');
    if (prestamosCliente.length === 0) return { label: 'Sin Deuda', color: effectiveTheme === 'dark' ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-300' };

    const hoyStr = new Date().toISOString().split('T')[0];
    let tieneMora = false;

    for (const p of prestamosCliente) {
      const qMora = quincenas.some(q => q.prestamo_id === p.id && q.interes_pendiente > 0 && q.fecha_limite_gracia < hoyStr);
      if (qMora) {
        tieneMora = true;
        break;
      }
    }

    if (tieneMora) return { label: 'En Mora', color: effectiveTheme === 'dark' ? 'bg-red-950/80 text-red-400 border-red-800' : 'bg-red-50 text-red-700 border-red-300' };
    return { label: 'Al Día', color: effectiveTheme === 'dark' ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-300' };
  }

  function limpiarTelefonoPanama(val: string) {
    return val.replace(/\D/g, '').slice(0, 8);
  }

  async function handleGuardarCliente(e: React.FormEvent) {
    e.preventDefault();
    const clienteData = clienteEditar || nuevoCliente;

    if (!clienteData.nombre_completo || !clienteData.cedula || !clienteData.telefono) {
      return mostrarAlerta('Campos Requeridos', 'Por favor ingresa Nombre, Cédula y Teléfono.', 'alerta');
    }

    const telLimpio = limpiarTelefonoPanama(clienteData.telefono);

    if (telLimpio.length < 8) {
      return mostrarAlerta('Teléfono Inválido', 'El teléfono celular debe contener exactamente 8 dígitos numéricos.', 'alerta');
    }

    if (clienteEditar) {
      const { error } = await supabase
        .from('clientes')
        .update({
          nombre_completo: clienteEditar.nombre_completo,
          cedula: clienteEditar.cedula,
          telefono: telLimpio,
          direccion: clienteEditar.direccion
        })
        .eq('id', clienteEditar.id);

      if (error) {
        mostrarAlerta('Error al Actualizar', error.message, 'error');
      } else {
        setClienteEditar(null);
        cargarDatos();
        mostrarAlerta('Cliente Actualizado', 'Los datos del cliente fueron guardados correctamente.', 'exito');
      }
    } else {
      const { error } = await supabase.from('clientes').insert([{
        ...nuevoCliente,
        user_id: session?.user?.id,
        telefono: telLimpio
      }]);

      if (error) {
        mostrarAlerta('Error', 'No se pudo crear el cliente: ' + error.message, 'error');
      } else {
        setNuevoCliente({ nombre_completo: '', cedula: '', telefono: '', direccion: '' });
        cargarDatos();
        mostrarAlerta('Cliente Registrado', 'El cliente fue guardado correctamente.', 'exito');
      }
    }
  }

  function handleBorrarCliente(id: string, nombre: string) {
    mostrarConfirmacion(
      '¿Eliminar Cliente?',
      `¿Estás seguro de eliminar a ${nombre}? Se borrarán sus préstamos y pagos registrados.`,
      async () => {
        const { error } = await supabase.from('clientes').delete().eq('id', id);
        if (error) {
          mostrarAlerta('Error al eliminar', error.message, 'error');
        } else {
          cargarDatos();
          mostrarAlerta('Cliente Eliminado', `${nombre} fue removido del sistema.`, 'exito');
        }
      }
    );
  }

  function descargarPlantillaCSV() {
    const plantilla = "Nombre,Cedula,Telefono,Direccion,MontoPrestamo,TasaQuincenal,FechaInicio,PagoMonto,PagoFecha\n" +
      "Juan Perez,8-888-8888,66666666,Panama,500.00,10,15/01/2026,50.00,30/01/2026\n" +
      "Juan Perez,8-888-8888,66666666,Panama,,,15/02/2026,50.00,15/02/2026\n" +
      "Maria Gomez,3-333-3333,65555555,Colon,1000.00,5,01/02/2026,,";

    const blob = new Blob([plantilla], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'plantilla_prestao_cartera.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleCargarCSV(e: React.FormEvent) {
    e.preventDefault();
    if (!csvTexto.trim()) return mostrarAlerta('Archivo Vacío', 'Pega las filas de tu Excel o CSV para continuar.', 'alerta');

    const filas = csvTexto.trim().split('\n');
    let clientesProcesados = 0;
    let prestamosProcesados = 0;
    let pagosProcesados = 0;

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i].trim();
      if (!fila || fila.toLowerCase().startsWith('nombre')) continue;

      const col = fila.split(',');
      if (col.length >= 3) {
        const nombre = col[0]?.trim();
        const cedula = col[1]?.trim();
        const telefono = limpiarTelefonoPanama(col[2]?.trim() || '');
        const direccion = col[3]?.trim() || 'Panamá';
        const montoPrestamo = col[4]?.trim() ? parseFloat(col[4].trim()) : 0;
        const tasaQuincenal = col[5]?.trim() ? parseFloat(col[5].trim()) : 10;
        const fechaInicio = normalizarFechaISO(col[6]?.trim() || '');
        const pagoMonto = col[7]?.trim() ? parseFloat(col[7].trim()) : 0;
        const pagoFecha = normalizarFechaISO(col[8]?.trim() || '');

        if (cedula) {
          let clienteId = null;
          const { data: clienteExiste } = await supabase
            .from('clientes')
            .select('id')
            .eq('user_id', session?.user?.id)
            .eq('cedula', cedula)
            .single();

          if (clienteExiste) {
            clienteId = clienteExiste.id;
          } else if (nombre && telefono) {
            const { data: clienteNuevo } = await supabase.from('clientes').insert([{
              user_id: session?.user?.id,
              nombre_completo: nombre,
              cedula: cedula,
              telefono: telefono,
              direccion: direccion
            }]).select().single();

            if (clienteNuevo) {
              clienteId = clienteNuevo.id;
              clientesProcesados++;
            }
          }

          if (clienteId) {
            let prestamoId = null;
            let capitalActual = 0;

            if (montoPrestamo > 0) {
              const { data: prestamoNuevo } = await supabase.from('prestamos').insert([{
                user_id: session?.user?.id,
                cliente_id: clienteId,
                monto_original: montoPrestamo,
                capital_pendiente: montoPrestamo,
                tasa_quincenal: tasaQuincenal,
                esquema_cobro: '15_30',
                fecha_inicio: fechaInicio,
                estado: 'activo'
              }]).select().single();

              if (prestamoNuevo) {
                prestamoId = prestamoNuevo.id;
                capitalActual = montoPrestamo;
                prestamosProcesados++;
              }
            } else {
              const { data: prestamoExistente } = await supabase
                .from('prestamos')
                .select('*')
                .eq('user_id', session?.user?.id)
                .eq('cliente_id', clienteId)
                .eq('estado', 'activo')
                .order('creado_en', { ascending: false })
                .limit(1)
                .single();

              if (prestamoExistente) {
                prestamoId = prestamoExistente.id;
                capitalActual = Number(prestamoExistente.capital_pendiente);
              }
            }

            if (prestamoId && pagoMonto > 0) {
              const interesQuincenal = (capitalActual * tasaQuincenal) / 100;
              const aplicadoInteres = Math.min(pagoMonto, interesQuincenal);
              const aplicadoCapital = Math.max(0, pagoMonto - aplicadoInteres);

              await supabase.from('pagos').insert([{
                user_id: session?.user?.id,
                prestamo_id: prestamoId,
                monto_total: pagoMonto,
                aplicado_interes: aplicadoInteres,
                aplicado_capital: aplicadoCapital,
                fecha_pago: pagoFecha,
                notas: 'Importación de Cartera'
              }]);

              const nuevoCapital = Math.max(0, capitalActual - aplicadoCapital);
              await supabase.from('prestamos').update({
                capital_pendiente: nuevoCapital,
                estado: nuevoCapital === 0 ? 'cancelado' : 'activo'
              }).eq('id', prestamoId);

              pagosProcesados++;
            }
          }
        }
      }
    }

    setCsvTexto('');
    cargarDatos();
    mostrarAlerta('Carga Exitosa', `Se procesaron: ${clientesProcesados} nuevos clientes, ${prestamosProcesados} préstamos y ${pagosProcesados} abonos históricos.`, 'exito');
  }

  async function handleCrearPrestamo(e: React.FormEvent) {
    e.preventDefault();
    const monto = parseFloat(nuevoPrestamo.monto_original);
    const tasa = parseFloat(nuevoPrestamo.tasa_quincenal);

    if (!nuevoPrestamo.cliente_id || !monto || isNaN(tasa) || !nuevoPrestamo.fecha_inicio) {
      return mostrarAlerta('Formulario Incompleto', 'Por favor ingresa todos los datos del préstamo incluyendo la fecha.', 'alerta');
    }

    const { error } = await supabase.from('prestamos').insert([{
      user_id: session?.user?.id,
      cliente_id: nuevoPrestamo.cliente_id,
      monto_original: monto,
      capital_pendiente: monto,
      tasa_quincenal: tasa,
      esquema_cobro: nuevoPrestamo.esquema_cobro,
      fecha_inicio: nuevoPrestamo.fecha_inicio,
      estado: 'activo'
    }]);

    if (error) {
      mostrarAlerta('Error', 'No se pudo generar el préstamo: ' + error.message, 'error');
    } else {
      setNuevoPrestamo({ cliente_id: '', monto_original: '', tasa_quincenal: '', esquema_cobro: '15_30', fecha_inicio: hoyISO });
      cargarDatos();
      mostrarAlerta('Préstamo Generado', 'El crédito quedó registrado exitosamente.', 'exito');
    }
  }

  function enviarComprobanteWhatsApp(pago: any, saldoRestanteCalculado?: number) {
    const clienteNombre = pago.prestamos?.clientes?.nombre_completo || 'Cliente';
    const telefonoRaw = pago.prestamos?.clientes?.telefono || '';
    const numLimpio = '507' + limpiarTelefonoPanama(telefonoRaw);

    const saldoFinal = saldoRestanteCalculado !== undefined 
      ? saldoRestanteCalculado 
      : Number(pago.prestamos?.capital_pendiente || 0);

    const mensaje = `*RECIBO DE PAGO - PRESTAO*\n\n` +
      `👤 *Cliente:* ${clienteNombre}\n` +
      `💵 *Monto Abonado:* $${Number(pago.monto_total).toFixed(2)}\n` +
      `📅 *Fecha:* ${formatearFechaEspanol(pago.fecha_pago)}\n` +
      `💳 *Método:* ${pago.notas}\n\n` +
      `Desglose del Abono:\n` +
      `• A Interés: $${Number(pago.aplicado_interes).toFixed(2)}\n` +
      `• A Capital: $${Number(pago.aplicado_capital).toFixed(2)}\n\n` +
      `*Saldo Capital Restante:* $${saldoFinal.toFixed(2)}\n\n` +
      `¡Gracias por tu pago puntual!`;

    const url = `https://wa.me/${numLimpio}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  }

  async function handleRegistrarPago(e: React.FormEvent) {
    e.preventDefault();
    const prestamo = prestamos.find(p => p.id === nuevoPago.prestamo_id);
    const montoAbonado = parseFloat(nuevoPago.monto_total);

    if (!prestamo || !montoAbonado) return mostrarAlerta('Selección Requerida', 'Selecciona un préstamo e ingresa un monto válido.', 'alerta');

    const fechaPagoEval = new Date(nuevoPago.fecha_pago);
    const fechaInicio = new Date(prestamo.fecha_inicio);
    const diasDiferencia = Math.max(1, Math.floor((fechaPagoEval.getTime() - fechaInicio.getTime()) / (1000 * 3600 * 24)));
    const quincenasTranscurridas = Math.max(1, Math.ceil(diasDiferencia / 15));

    const pagosPrevios = pagos.filter(p => p.prestamo_id === prestamo.id);
    const totalInteresYaPagado = pagosPrevios.reduce((acc, curr) => acc + Number(curr.aplicado_interes || 0), 0);

    const interesPorQuincena = (Number(prestamo.capital_pendiente) * Number(prestamo.tasa_quincenal)) / 100;
    const interesTotalAcumuladoHastaHoy = quincenasTranscurridas * interesPorQuincena;
    const interesPendientePorCobrar = Math.max(0, interesTotalAcumuladoHastaHoy - totalInteresYaPagado);

    const aplicadoInteres = Math.min(montoAbonado, interesPendientePorCobrar);
    const aplicadoCapital = Math.max(0, montoAbonado - aplicadoInteres);

    const payloadPago: any = {
      user_id: session?.user?.id,
      prestamo_id: prestamo.id,
      monto_total: montoAbonado,
      aplicado_interes: aplicadoInteres,
      aplicado_capital: aplicadoCapital,
      fecha_pago: nuevoPago.fecha_pago,
      notas: `Método: ${nuevoPago.metodo_pago}`
    };

    const { data: dataPago, error: errPago } = await supabase.from('pagos').insert([payloadPago]).select('*, prestamos(*, clientes(*))').single();

    if (errPago) return mostrarAlerta('Error de Pago', errPago.message, 'error');

    const nuevoCapitalPendiente = Math.max(0, Number(prestamo.capital_pendiente) - aplicadoCapital);
    const nuevoEstado = nuevoCapitalPendiente === 0 ? 'cancelado' : 'activo';

    await supabase.from('prestamos').update({
      capital_pendiente: nuevoCapitalPendiente,
      estado: nuevoEstado
    }).eq('id', prestamo.id);

    setNuevoPago({ prestamo_id: '', monto_total: '', metodo_pago: 'Yappy', fecha_pago: hoyISO });
    cargarDatos();

    mostrarConfirmacion(
      'Cobro Exitoso - ¿Enviar Comprobante?',
      `Abonado: $${aplicadoInteres.toFixed(2)} a Interés | $${aplicadoCapital.toFixed(2)} a Capital. Saldo Restante: $${nuevoCapitalPendiente.toFixed(2)}. ¿Deseas enviar el recibo por WhatsApp al cliente?`,
      () => {
        if (dataPago) enviarComprobanteWhatsApp(dataPago, nuevoCapitalPendiente);
      }
    );
  }

  // Métricas
  const totalCapitalColocado = prestamos.reduce((acc, curr) => acc + Number(curr.monto_original || 0), 0);
  const totalCapitalPendiente = prestamos.reduce((acc, curr) => acc + Number(curr.capital_pendiente || 0), 0);
  const totalInteresCobrado = pagos.reduce((acc, curr) => acc + Number(curr.aplicado_interes || 0), 0);
  const totalInteresPendiente = quincenas.reduce((acc, curr) => acc + Number(curr.interes_pendiente || 0), 0);

  const hoyStr = new Date().toISOString().split('T')[0];
  const totalInteresAtrasado = quincenas
    .filter(q => q.interes_pendiente > 0 && q.fecha_limite_gracia < hoyStr)
    .reduce((acc, curr) => acc + Number(curr.interes_pendiente || 0), 0);

  const isDark = effectiveTheme === 'dark';

  const fieldInputStyle = "w-full bg-white text-black font-extrabold text-sm border border-gray-300 rounded-2xl p-3.5 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all";

  const tabNames: Record<string, string> = {
    dashboard: 'Dashboard',
    clientes: 'Clientes',
    prestamos: 'Préstamos',
    pagos: 'Cobros',
    csv: 'Cargar Cartera'
  };

  if (authLoading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center space-y-3 ${isDark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <p className="text-sm font-bold tracking-wide animate-pulse">Cargando Prestao...</p>
      </div>
    );
  }

  // --- VISTA 1: LOGIN / REGISTRO ---
  if (!session) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
        <style jsx global>{`
          input, select, textarea {
            color: #000000 !important;
            background-color: #ffffff !important;
            -webkit-text-fill-color: #000000 !important;
            opacity: 1 !important;
          }
          input::placeholder {
            color: #6b7280 !important;
            -webkit-text-fill-color: #6b7280 !important;
          }
        `}</style>
        
        <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-6 border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto flex items-center justify-center">
              <img src="/logo.png" alt="Prestao" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-blue-600">Prestao</h1>
            <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Gestor de Microcréditos</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4 text-xs" autoComplete="off">
            {isRegistering ? (
              <>
                <div>
                  <label className={`block font-bold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Nombre de Usuario *</label>
                  <input 
                    type="text" 
                    value={regUsername} 
                    onChange={e => setRegUsername(e.target.value)}
                    className={fieldInputStyle}
                    placeholder="Ej: wilfredo29"
                    required
                  />
                </div>
                <div>
                  <label className={`block font-bold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Nombre Completo *</label>
                  <input 
                    type="text" 
                    value={regNombre} 
                    onChange={e => setRegNombre(e.target.value)}
                    className={fieldInputStyle}
                    placeholder="Ej: Wilfredo Smith"
                    required
                  />
                </div>
                <div>
                  <label className={`block font-bold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Correo Electrónico *</label>
                  <input 
                    type="email" 
                    value={regEmail} 
                    onChange={e => setRegEmail(e.target.value)}
                    className={fieldInputStyle}
                    placeholder="correo@ejemplo.com"
                    required
                  />
                </div>
              </>
            ) : (
              <div>
                <label className={`block font-bold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Usuario o Correo Electrónico *</label>
                <input 
                  type="text" 
                  value={authIdentifier} 
                  onChange={e => setAuthIdentifier(e.target.value)}
                  className={fieldInputStyle}
                  placeholder="Usuario o correo"
                  required
                />
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className={`block font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Contraseña *</label>
                <span className="text-[10px] text-gray-400">Mínimo 8 caracteres</span>
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={authPassword} 
                  onChange={e => setAuthPassword(e.target.value)}
                  className={fieldInputStyle}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black font-bold text-xs"
                >
                  {showPassword ? "🙈 Ocultar" : "👁️ Ver"}
                </button>
              </div>

              {authPassword.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className={`flex gap-1.5 h-2 w-full rounded-full overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                    <div className={`h-full transition-all duration-300 w-1/3 ${fuerzaPass.score >= 1 ? fuerzaPass.colorClass : 'bg-transparent'}`} />
                    <div className={`h-full transition-all duration-300 w-1/3 ${fuerzaPass.score >= 2 ? fuerzaPass.colorClass : 'bg-transparent'}`} />
                    <div className={`h-full transition-all duration-300 w-1/3 ${fuerzaPass.score >= 3 ? fuerzaPass.colorClass : 'bg-transparent'}`} />
                  </div>
                  <p className="text-[10px] text-gray-400 text-right font-medium">
                    Seguridad: <span className="font-bold text-gray-200">{fuerzaPass.label}</span>
                  </p>
                </div>
              )}
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-black py-3.5 rounded-2xl transition shadow-lg text-sm text-center tracking-wide"
            >
              {isSubmitting ? 'Procesando...' : isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-gray-800">
            <button 
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthIdentifier('');
                setAuthPassword('');
              }}
              className="text-xs text-blue-400 hover:underline font-bold"
            >
              {isRegistering ? '¿Ya tienes cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate aquí'}
            </button>
          </div>
        </div>

      </div>
    );
  }

  // --- VISTA 2: CRM DASHBOARD COMPLETO ---
  return (
    <div className={`min-h-screen font-sans py-6 px-4 ${isDark ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <style jsx global>{`
        input, select, textarea {
          color: #000000 !important;
          background-color: #ffffff !important;
          -webkit-text-fill-color: #000000 !important;
          opacity: 1 !important;
        }
        input::placeholder, textarea::placeholder {
          color: #6b7280 !important;
          -webkit-text-fill-color: #6b7280 !important;
        }
        select option {
          color: #000000 !important;
          background-color: #ffffff !important;
        }
      `}</style>

      <div className="max-w-3xl mx-auto space-y-6 min-h-[85vh]">
        
        {/* ENCABEZADO Y NAVEGACIÓN */}
        <header className={`flex flex-col sm:flex-row justify-between items-center gap-4 p-4 rounded-3xl border shadow-lg ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                <img src="/logo.png" alt="Prestao" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-lg font-black text-blue-600 tracking-tight leading-none">Prestao</h1>
                <p className={`text-[10px] mt-0.5 font-bold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Gestor de Microcréditos</p>
              </div>
            </div>
            
            <button 
              onClick={() => setMostrarTutorial(true)}
              className={`text-xs px-3.5 py-2 rounded-2xl font-bold transition flex items-center gap-1 border shadow-sm ${
                isDark ? 'bg-gray-950 text-blue-400 border-gray-800 hover:bg-gray-800' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
              }`}
            >
              ❓ Ayuda
            </button>
          </div>

          <nav className={`w-full sm:w-auto flex flex-wrap sm:flex-nowrap p-1.5 rounded-2xl border gap-1.5 justify-center ${isDark ? 'bg-gray-950 border-gray-800' : 'bg-gray-100 border-gray-200'}`}>
            {(['dashboard', 'clientes', 'prestamos', 'pagos', 'csv'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => cambiarPestana(tab)}
                className={`flex-1 sm:flex-none py-2.5 px-3 text-center rounded-2xl transition font-black text-xs whitespace-nowrap min-w-[70px] h-10 flex items-center justify-center ${
                  activeTab === tab 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : isDark ? 'text-gray-400 hover:text-white hover:bg-gray-900' : 'text-gray-600 hover:text-black hover:bg-white'
                }`}
              >
                {tabNames[tab]}
              </button>
            ))}
          </nav>
        </header>

        {/* TARJETA DE MÉTRICAS */}
        <div className={`rounded-3xl p-6 shadow-xl space-y-6 border ${isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className={`text-xs font-bold tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Capital Activo Pendiente</p>
              <p className="text-3xl sm:text-4xl font-black mt-1 text-blue-600">${totalCapitalPendiente.toFixed(2)}</p>
            </div>
            <div className={`self-start sm:self-center text-xs px-4 py-2 rounded-2xl font-bold border shadow-sm ${
              isDark ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              ${totalInteresCobrado.toFixed(2)} Cobrado
            </div>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
            <div className={`p-4 rounded-2xl border text-center ${isDark ? 'bg-gray-950/60 border-gray-800/80' : 'bg-gray-50 border-gray-200'}`}>
              <p className={`font-bold text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total Prestado</p>
              <p className={`font-black text-base sm:text-lg mt-1 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>${totalCapitalColocado.toFixed(2)}</p>
            </div>
            <div className={`p-4 rounded-2xl border text-center ${isDark ? 'bg-gray-950/60 border-gray-800/80' : 'bg-gray-50 border-gray-200'}`}>
              <p className={`font-bold text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Interés Pendiente</p>
              <p className="font-black text-amber-500 text-base sm:text-lg mt-1">${totalInteresPendiente.toFixed(2)}</p>
            </div>
            <div className={`p-4 rounded-2xl border text-center ${isDark ? 'bg-gray-950/60 border-gray-800/80' : 'bg-gray-50 border-gray-200'}`}>
              <p className={`font-bold text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>En Mora</p>
              <p className="font-black text-red-500 text-base sm:text-lg mt-1">${totalInteresAtrasado.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* VISTAS DE TABS */}
        <main>
          {loading && <p className="text-center text-gray-400 py-12 text-sm font-bold">Cargando información...</p>}

          {!loading && activeTab === 'dashboard' && (
            <div className={`rounded-3xl p-6 border space-y-4 shadow-md ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
              <div className="border-b pb-3 border-gray-800/60">
                <h2 className={`text-base font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Préstamos Activos</h2>
                <p className="text-[11px] text-gray-400 mt-0.5 font-bold">Toca la carpeta 📂 para abrir el Expediente completo</p>
              </div>

              <div className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                {prestamos.map((p) => {
                  const est = getEstadoCliente(p.cliente_id);
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => setClienteExpediente(p.clientes)}
                      className={`py-4 flex items-center justify-between gap-3 cursor-pointer p-3 rounded-2xl transition border border-transparent ${
                        isDark ? 'hover:bg-gray-800/60 hover:border-gray-700' : 'hover:bg-blue-50/50 hover:border-blue-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl bg-blue-600/10 p-2.5 rounded-2xl border border-blue-600/20 shrink-0" title="Ver Expediente">📂</span>
                        <p className={`font-black text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{p.clientes?.nombre_completo || 'N/A'}</p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <p className={`font-black text-sm ${isDark ? 'text-white' : 'text-blue-600'}`}>${Number(p.capital_pendiente).toFixed(2)}</p>
                        <span className={`px-3 py-1.5 rounded-2xl text-[11px] font-bold border whitespace-nowrap ${est.color}`}>
                          {est.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {prestamos.length === 0 && <p className="text-gray-500 py-6 text-xs text-center font-semibold">No hay préstamos activos registrados en tu cartera.</p>}
              </div>
            </div>
          )}

          {!loading && activeTab === 'clientes' && (
            <div className="space-y-6">
              <div className={`rounded-3xl p-6 border space-y-4 shadow-md ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                <div className="flex justify-between items-center">
                  <h2 className={`text-base font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {clienteEditar ? 'Editar Datos del Cliente' : 'Registrar Nuevo Cliente'}
                  </h2>
                  {clienteEditar && (
                    <button
                      onClick={() => setClienteEditar(null)}
                      className="text-xs bg-gray-800 text-gray-300 px-3 py-1 rounded-xl hover:bg-gray-700 font-bold transition"
                    >
                      Cancelar Edición
                    </button>
                  )}
                </div>

                <form onSubmit={handleGuardarCliente} className="space-y-3.5 text-xs">
                  <div>
                    <label className={`block font-bold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Nombre Completo *</label>
                    <input 
                      type="text" 
                      value={clienteEditar ? clienteEditar.nombre_completo : nuevoCliente.nombre_completo} 
                      onChange={e => clienteEditar ? setClienteEditar({...clienteEditar, nombre_completo: e.target.value}) : setNuevoCliente({...nuevoCliente, nombre_completo: e.target.value})}
                      className={fieldInputStyle}
                      placeholder="Juan Pérez"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block font-bold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Cédula *</label>
                      <input 
                        type="text" 
                        value={clienteEditar ? clienteEditar.cedula : nuevoCliente.cedula} 
                        onChange={e => clienteEditar ? setClienteEditar({...clienteEditar, cedula: e.target.value}) : setNuevoCliente({...nuevoCliente, cedula: e.target.value})}
                        className={fieldInputStyle}
                        placeholder="8-888-8888"
                      />
                    </div>

                    <div>
                      <label className={`block font-bold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Teléfono Celular (Panamá) *</label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3.5 text-xs font-black text-gray-500 select-none z-10 flex items-center gap-1">
                          🇵🇦 +507
                        </span>
                        <input 
                          type="tel" 
                          maxLength={8}
                          value={clienteEditar ? clienteEditar.telefono : nuevoCliente.telefono} 
                          onChange={e => {
                            const val = limpiarTelefonoPanama(e.target.value);
                            clienteEditar ? setClienteEditar({...clienteEditar, telefono: val}) : setNuevoCliente({...nuevoCliente, telefono: val});
                          }}
                          className={`${fieldInputStyle} pl-20`}
                          placeholder="66666666"
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium">Ingresa únicamente los 8 dígitos (sin guiones).</p>
                    </div>
                  </div>

                  <div>
                    <label className={`block font-bold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Dirección</label>
                    <input 
                      type="text" 
                      value={clienteEditar ? clienteEditar.direccion : nuevoCliente.direccion} 
                      onChange={e => clienteEditar ? setClienteEditar({...clienteEditar, direccion: e.target.value}) : setNuevoCliente({...nuevoCliente, direccion: e.target.value})}
                      className={fieldInputStyle}
                      placeholder="Panamá"
                    />
                  </div>

                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3.5 rounded-2xl transition mt-2 shadow-md text-xs">
                    {clienteEditar ? 'Guardar Cambios' : 'Guardar Cliente'}
                  </button>
                </form>
              </div>

              <div className={`rounded-3xl p-6 border space-y-4 shadow-md ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                <div className="border-b pb-3 border-gray-800/60">
                  <h2 className={`text-base font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Directorio de Clientes ({clientes.length})</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5 font-bold">Toca la carpeta 📂 para abrir el expediente completo</p>
                </div>

                <div className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                  {clientes.map(c => {
                    const est = getEstadoCliente(c.id);
                    return (
                      <div key={c.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div 
                          onClick={() => setClienteExpediente(c)}
                          className="cursor-pointer hover:opacity-80 transition flex items-center gap-3"
                        >
                          <span className="text-xl bg-blue-600/10 p-2.5 rounded-2xl border border-blue-600/20 shrink-0" title="Ver Expediente">📂</span>
                          <p className={`font-black text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{c.nombre_completo}</p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                          <span className={`px-3 py-1.5 rounded-2xl text-[11px] font-bold border whitespace-nowrap ${est.color}`}>
                            {est.label}
                          </span>
                          <button 
                            onClick={() => setClienteEditar(c)}
                            className={`px-3 py-1.5 rounded-2xl font-bold text-[11px] transition border ${
                              isDark ? 'text-blue-400 bg-gray-950 border-gray-800 hover:bg-gray-800' : 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100'
                            }`}
                          >
                            Editar
                          </button>
                          <button 
                            onClick={() => handleBorrarCliente(c.id, c.nombre_completo)}
                            className={`px-3 py-1.5 rounded-2xl font-bold text-[11px] transition border ${
                              isDark ? 'text-red-400 bg-gray-950 border-gray-800 hover:bg-gray-800' : 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100'
                            }`}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {clientes.length === 0 && <p className="text-gray-500 py-6 text-xs text-center font-semibold">Aún no has agregado ningún cliente.</p>}
                </div>
              </div>
            </div>
          )}

          {!loading && activeTab === 'prestamos' && (
            <div className={`rounded-3xl p-6 border space-y-4 shadow-md ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
              <h2 className={`text-base font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Nuevo Préstamo</h2>
              <form onSubmit={handleCrearPrestamo} className="space-y-3.5 text-xs">
                <div>
                  <label className={`block font-bold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Cliente *</label>
                  <select 
                    value={nuevoPrestamo.cliente_id} 
                    onChange={e => setNuevoPrestamo({...nuevoPrestamo, cliente_id: e.target.value})}
                    className={fieldInputStyle}
                  >
                    <option value="">-- Selecciona Cliente --</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre_completo} (Cédula: {c.cedula})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block font-bold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Monto ($) *</label>
                    <input 
                      type="number" 
                      value={nuevoPrestamo.monto_original} 
                      onChange={e => setNuevoPrestamo({...nuevoPrestamo, monto_original: e.target.value})}
                      className={fieldInputStyle}
                      placeholder="1000.00"
                    />
                  </div>
                  <div>
                    <label className={`block font-bold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Tasa Quincenal (%) *</label>
                    <input 
                      type="number" 
                      value={nuevoPrestamo.tasa_quincenal} 
                      onChange={e => setNuevoPrestamo({...nuevoPrestamo, tasa_quincenal: e.target.value})}
                      className={fieldInputStyle}
                      placeholder="Ej: 5 o 10"
                    />
                  </div>
                </div>

                <div>
                  <label className={`block font-bold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Esquema Cobro *</label>
                  <select 
                    value={nuevoPrestamo.esquema_cobro} 
                    onChange={e => setNuevoPrestamo({...nuevoPrestamo, esquema_cobro: e.target.value})}
                    className={fieldInputStyle}
                  >
                    <option value="5_20">Días 5 y 20</option>
                    <option value="10_25">Días 10 y 25</option>
                    <option value="15_30">Días 15 y 30</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-bold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Fecha Desembolso *</label>
                  <input 
                    type="date" 
                    value={nuevoPrestamo.fecha_inicio} 
                    onChange={e => setNuevoPrestamo({...nuevoPrestamo, fecha_inicio: e.target.value})}
                    className={fieldInputStyle}
                  />
                  <p className="text-[10px] text-gray-400 mt-1 font-medium">Formato: DD/MM/AAAA (Selección por calendario desplegable)</p>
                </div>

                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3.5 rounded-2xl transition mt-2 shadow-md">
                  Generar Préstamo
                </button>
              </form>
            </div>
          )}

          {!loading && activeTab === 'pagos' && (
            <div className="space-y-6">
              <div className={`rounded-3xl p-6 border space-y-4 shadow-md ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                <h2 className={`text-base font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Registrar Cobro</h2>
                <form onSubmit={handleRegistrarPago} className="space-y-4 text-xs">
                  <div>
                    <label className={`block font-bold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Préstamo Activo *</label>
                    <select 
                      value={nuevoPago.prestamo_id} 
                      onChange={e => setNuevoPago({...nuevoPago, prestamo_id: e.target.value})}
                      className={fieldInputStyle}
                    >
                      <option value="">-- Selecciona Préstamo --</option>
                      {prestamos.filter(p => p.estado === 'activo').map(p => (
                        <option key={p.id} value={p.id}>
                          {p.clientes?.nombre_completo} (Cédula: {p.clientes?.cedula}) - Saldo: ${Number(p.capital_pendiente).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block font-bold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Monto ($) *</label>
                      <input 
                        type="number" 
                        value={nuevoPago.monto_total} 
                        onChange={e => setNuevoPago({...nuevoPago, monto_total: e.target.value})}
                        className={fieldInputStyle}
                        placeholder="50.00"
                      />
                    </div>
                    <div>
                      <label className={`block font-bold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Método de Pago *</label>
                      <select 
                        value={nuevoPago.metodo_pago} 
                        onChange={e => setNuevoPago({...nuevoPago, metodo_pago: e.target.value})}
                        className={fieldInputStyle}
                      >
                        <option value="Yappy">Yappy</option>
                        <option value="ACH">ACH (Transferencia)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={`block font-bold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Fecha Real de Pago *</label>
                    <input 
                      type="date" 
                      value={nuevoPago.fecha_pago} 
                      onChange={e => setNuevoPago({...nuevoPago, fecha_pago: e.target.value})}
                      className={fieldInputStyle}
                    />
                  </div>

                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3.5 rounded-2xl transition shadow-lg">
                    Procesar Cobro
                  </button>
                </form>
              </div>

              <div className={`rounded-3xl p-6 border space-y-4 shadow-md ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                <h2 className={`text-base font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Historial de Cobros</h2>
                <div className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                  {pagos.map((p) => (
                    <div key={p.id} className="py-3 flex justify-between items-center text-xs">
                      <div>
                        <p className={`font-black text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{p.prestamos?.clientes?.nombre_completo || 'N/A'}</p>
                        <p className={`mt-0.5 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatearFechaEspanol(p.fecha_pago)} | {p.notas}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-black text-emerald-500 text-sm">+${Number(p.monto_total).toFixed(2)}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 font-medium">
                            (Int: ${Number(p.aplicado_interes).toFixed(2)} <span className="text-gray-500 px-1 font-bold">|</span> Cap: ${Number(p.aplicado_capital).toFixed(2)})
                          </p>
                        </div>
                        <button
                          onClick={() => enviarComprobanteWhatsApp(p)}
                          className={`p-2 rounded-2xl font-bold text-xs transition border ${
                            isDark ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80 hover:bg-emerald-900' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                          title="Enviar Recibo por WhatsApp"
                        >
                          📲 WhatsApp
                        </button>
                      </div>
                    </div>
                  ))}
                  {pagos.length === 0 && <p className="text-gray-500 py-6 text-xs text-center font-semibold">Aún no hay cobros registrados.</p>}
                </div>
              </div>
            </div>
          )}

          {!loading && activeTab === 'csv' && (
            <div className={`rounded-3xl p-6 border space-y-5 shadow-md ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className={`text-base font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Cargar Cartera e Historial Masivo</h2>
                  <p className={`text-xs mt-0.5 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Importa tus préstamos existentes desde Excel en segundos.</p>
                </div>
                <button
                  onClick={descargarPlantillaCSV}
                  className={`px-3.5 py-2 rounded-2xl font-bold text-xs transition flex items-center gap-1.5 shrink-0 border ${
                    isDark ? 'bg-gray-950 text-blue-400 border-gray-800 hover:bg-gray-800' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  📥 Descargar Plantilla .CSV
                </button>
              </div>

              <div className={`border rounded-2xl p-4 text-xs space-y-3 ${isDark ? 'bg-gray-950/60 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex justify-between items-center">
                  <p className="font-black text-blue-600 uppercase tracking-wide text-[11px]">Guía Rápida para Cargar tu Cartera:</p>
                  <button 
                    onClick={() => {
                      setTutorialSeccion('csv');
                      setMostrarTutorial(true);
                    }}
                    className="text-[10px] text-blue-500 hover:underline font-bold"
                  >
                    Ver Tutorial Completo ➔
                  </button>
                </div>
                <ol className={`list-decimal list-inside space-y-1.5 leading-relaxed font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <li>Haz clic en <strong>Descargar Plantilla .CSV</strong> arriba y ábrela en Excel o Google Sheets.</li>
                  <li>Llena tus clientes. Si un mismo cliente tiene <strong>varios préstamos o pagos</strong>, usa su misma <strong>Cédula</strong> en varias filas.</li>
                  <li>Copia las filas desde Excel, pégalas en el cajón de abajo y presiona <strong>Procesar Cartera</strong>.</li>
                </ol>
                <div className={`pt-2 border-t text-[11px] ${isDark ? 'border-gray-800 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                  <span className={`font-bold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Formato de Columnas:</span>
                  <code className={`px-2 py-1 rounded-xl block mt-1 overflow-x-auto font-mono border ${isDark ? 'bg-gray-900 border-gray-800 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}`}>
                    Nombre, Cédula, Teléfono, Dirección, MontoPréstamo, TasaQuincenal(%), FechaInicio(DD/MM/AAAA), MontoPago, FechaPago(DD/MM/AAAA)
                  </code>
                </div>
              </div>

              <form onSubmit={handleCargarCSV} className="space-y-3 text-xs">
                <textarea
                  rows={7}
                  value={csvTexto}
                  onChange={e => setCsvTexto(e.target.value)}
                  placeholder="Juan Perez, 8-888-8888, 66666666, Panama, 500.00, 10, 15/01/2026, 50.00, 30/01/2026&#10;Juan Perez, 8-888-8888, 66666666, Panama, , , 15/02/2026, 50.00, 15/02/2026&#10;Maria Gomez, 3-333-3333, 65555555, Colon, 1000.00, 5, 01/02/2026, ,"
                  className={fieldInputStyle}
                />
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3.5 rounded-2xl transition shadow-md">
                  Procesar y Cargar Cartera
                </button>
              </form>
            </div>
          )}
        </main>

        {/* PIE DE PÁGINA CON SELECTOR DE TEMA Y CERRAR SESIÓN */}
        <footer className={`flex flex-col sm:flex-row justify-between items-center gap-4 p-4 rounded-3xl border text-xs ${isDark ? 'bg-gray-900 border-gray-800 text-gray-400' : 'bg-white border-gray-200 text-gray-600'}`}>
          <div className="flex items-center gap-2">
            <span className="font-bold">Tema:</span>
            <div className={`p-1 rounded-xl border flex gap-1 ${isDark ? 'bg-gray-950 border-gray-800' : 'bg-gray-100 border-gray-200'}`}>
              {(['dark', 'light', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-2.5 py-1 rounded-lg font-bold capitalize transition ${
                    theme === t 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'hover:text-blue-500'
                  }`}
                >
                  {t === 'dark' ? '🌙 Dark' : t === 'light' ? '☀️ Light' : '💻 System'}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={handleSignOut}
            className="text-xs bg-red-950/80 hover:bg-red-900 text-red-400 border border-red-800/80 px-4 py-2 rounded-2xl font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            🔒 Cerrar Sesión
          </button>
        </footer>

      </div>

      {/* MODAL DE TUTORIALES Y GUÍA DE USO */}
      {mostrarTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`border w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 text-xs max-h-[90vh] overflow-y-auto ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
            
            <div className={`flex justify-between items-center border-b pb-3 ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Prestao" className="w-6 h-6 object-contain" />
                <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Centro de Ayuda Prestao</h3>
              </div>
              <button 
                onClick={() => setMostrarTutorial(false)}
                className="text-gray-400 hover:text-gray-200 font-bold text-base p-1"
              >
                ✕
              </button>
            </div>

            <div className={`grid grid-cols-2 gap-2 border-b pb-3 ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
              {[
                { id: 'general', label: '1. General' },
                { id: 'csv', label: '2. Cargar Cartera' },
                { id: 'interes', label: '3. Interés' },
                { id: 'pwa', label: '4. Botón PWA App' }
              ].map(sec => (
                <button
                  key={sec.id}
                  onClick={() => setTutorialSeccion(sec.id as any)}
                  className={`py-2 px-3 rounded-2xl font-bold text-center text-xs transition border ${
                    tutorialSeccion === sec.id ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : isDark ? 'bg-gray-950 text-gray-400 border-gray-800 hover:bg-gray-800' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {sec.label}
                </button>
              ))}
            </div>

            <div className={`space-y-3 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {tutorialSeccion === 'general' && (
                <>
                  <h4 className={`font-black text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>💡 ¿Cómo funciona Prestao?</h4>
                  <p className="font-medium">Prestao administra tus créditos personales separando clientes, préstamos y abonos de forma automatizada.</p>
                  <ul className="list-disc list-inside space-y-1 pl-1 font-medium">
                    <li><strong>Dashboard:</strong> Muestra el capital colocado, pendiente y montos en mora.</li>
                    <li><strong>Clientes:</strong> Ficha de clientes con su expediente e historial completo al tocar la carpeta 📂.</li>
                    <li><strong>Préstamos:</strong> Registra nuevos préstamos con tasa quincenal.</li>
                    <li><strong>Cobros:</strong> Liquida automáticamente intereses acumulados y amortiza a capital.</li>
                  </ul>
                </>
              )}

              {tutorialSeccion === 'csv' && (
                <>
                  <h4 className={`font-black text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>📥 Guía de Carga Masiva desde Excel</h4>
                  <p className="font-medium">Si ya tienes una libreta o Excel con préstamos actuales, impórtala fácilmente:</p>
                  <ol className="list-decimal list-inside space-y-1.5 pl-1 font-medium">
                    <li>Entra a <strong>Cargar Cartera</strong> y presiona <strong>Descargar Plantilla .CSV</strong>.</li>
                    <li>Completa la tabla en Excel con tus clientes, préstamos y pagos antiguos.</li>
                    <li><strong>Importante:</strong> Usa la **misma cédula** en filas diferentes para vincular múltiples préstamos o abonos a un mismo cliente.</li>
                    <li>Copia las filas desde Excel, pégalas en la app y presiona <strong>Procesar Cartera</strong>.</li>
                  </ol>
                </>
              )}

              {tutorialSeccion === 'interes' && (
                <>
                  <h4 className={`font-black text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>🧮 Motor Financiero y Saldo Insoluto</h4>
                  <p className="font-medium">Prestao calcula los intereses sobre el <strong>Capital Restante (Saldo Insoluto)</strong>:</p>
                  <ul className="list-disc list-inside space-y-1 pl-1 font-medium">
                    <li>Si la deuda es de $1,000 al 10% quincenal, la cuota de interés es $100.</li>
                    <li>Si el cliente abona $300 ($100 a interés y $200 a capital), el saldo baja a $800.</li>
                    <li>En la siguiente quincena el 10% se calcula sobre los **$800 restantes** ($80.00 de interés).</li>
                  </ul>
                </>
              )}

              {tutorialSeccion === 'pwa' && (
                <>
                  <h4 className={`font-black text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>📲 Cómo Instalar Prestao como App en tu Pantalla de Inicio</h4>
                  <p className="font-medium">Conviértela en una WebApp sin descargarla de las tiendas oficiales:</p>
                  <div className="space-y-2 pt-1 font-medium">
                    <p className="font-black text-blue-600">En iPhone (Safari):</p>
                    <p className="pl-2">Toca el botón <strong>Compartir</strong> (icono del cuadro con la flecha arriba) en la parte inferior de Safari y selecciona <strong>"Agregar a inicio"</strong> ➕.</p>
                    
                    <p className="font-black text-blue-600">En Android (Chrome):</p>
                    <p className="pl-2">Toca los <strong>3 puntos</strong> de la esquina superior derecha y selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong> 📲.</p>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setMostrarTutorial(false)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-2xl transition mt-4"
            >
              Cerrar Ayuda
            </button>

          </div>
        </div>
      )}

      {/* EXPEDIENTE DIGITAL DE CLIENTE */}
      {clienteExpediente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`border w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 text-xs max-h-[90vh] overflow-y-auto ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
            
            <div className={`flex justify-between items-start border-b pb-3 ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
              <div>
                <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{clienteExpediente.nombre_completo}</h3>
                <p className="text-gray-400 mt-0.5 font-medium">Cédula: {clienteExpediente.cedula} | Teléfono: +507 {clienteExpediente.telefono}</p>
                <p className="text-gray-400 mt-0.5 font-medium">Dirección: {clienteExpediente.direccion || 'Panamá'}</p>
              </div>
              <button 
                onClick={() => setClienteExpediente(null)}
                className="text-gray-400 hover:text-gray-200 font-bold text-base p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="font-black text-blue-600 uppercase tracking-wide">Préstamos Registrados</h4>
              <div className="space-y-2">
                {prestamos.filter(p => p.cliente_id === clienteExpediente.id).map(p => (
                  <div key={p.id} className={`p-3 rounded-2xl border space-y-1 ${isDark ? 'bg-gray-950/80 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                    <div className={`flex justify-between font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      <span>Monto Original: ${Number(p.monto_original).toFixed(2)}</span>
                      <span className={p.estado === 'activo' ? 'text-amber-500' : 'text-emerald-500'}>
                        {p.estado === 'activo' ? `Pendiente: $${Number(p.capital_pendiente).toFixed(2)}` : 'CANCELADO'}
                      </span>
                    </div>
                    <p className="text-gray-400 text-[11px] font-medium">
                      Tasa: {p.tasa_quincenal}% Quincenal | Inicio: {formatearFechaEspanol(p.fecha_inicio)} | Esquema: {p.esquema_cobro}
                    </p>
                  </div>
                ))}
                {prestamos.filter(p => p.cliente_id === clienteExpediente.id).length === 0 && (
                  <p className="text-gray-500 italic font-medium">Este cliente no tiene préstamos registrados.</p>
                )}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h4 className="font-black text-blue-600 uppercase tracking-wide">Historial de Abonos</h4>
              <div className={`divide-y rounded-2xl border p-3 ${isDark ? 'divide-gray-800 bg-gray-950/80 border-gray-800' : 'divide-gray-100 bg-gray-50 border-gray-200'}`}>
                {pagos.filter(p => p.prestamos?.cliente_id === clienteExpediente.id).map(p => (
                  <div key={p.id} className="py-2 flex justify-between items-center">
                    <div>
                      <p className={`font-bold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{formatearFechaEspanol(p.fecha_pago)}</p>
                      <p className="text-gray-400 text-[10px] font-medium">{p.notas}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-emerald-500">+${Number(p.monto_total).toFixed(2)}</p>
                      <p className="text-[10px] text-gray-500 font-medium">Int: ${Number(p.aplicado_interes).toFixed(2)} | Cap: ${Number(p.aplicado_capital).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
                {pagos.filter(p => p.prestamos?.cliente_id === clienteExpediente.id).length === 0 && (
                  <p className="text-gray-500 italic text-center py-2 font-medium">No hay abonos registrados para este cliente.</p>
                )}
              </div>
            </div>

            <button
              onClick={() => setClienteExpediente(null)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-2xl transition"
            >
              Cerrar Expediente
            </button>

          </div>
        </div>
      )}

      {/* MODAL PWA GENERAL */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`border w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 text-center ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
            
            <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-lg font-bold">
              {modalConfig.tipo === 'confirmacion' && <span className="bg-red-500/20 text-red-400 border border-red-500/30 w-full h-full rounded-2xl flex items-center justify-center">⚠️</span>}
              {modalConfig.tipo === 'exito' && <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 w-full h-full rounded-2xl flex items-center justify-center">✓</span>}
              {modalConfig.tipo === 'error' && <span className="bg-red-500/20 text-red-400 border border-red-500/30 w-full h-full rounded-2xl flex items-center justify-center">✕</span>}
              {modalConfig.tipo === 'alerta' && <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 w-full h-full rounded-2xl flex items-center justify-center">ℹ</span>}
            </div>

            <div>
              <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{modalConfig.titulo}</h3>
              <p className={`text-xs mt-2 leading-relaxed font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{modalConfig.mensaje}</p>
            </div>

            <div className="flex gap-2 pt-2 text-xs font-semibold">
              {modalConfig.tipo === 'confirmacion' ? (
                <>
                  <button
                    onClick={cerrarModal}
                    className={`w-1/2 py-3 rounded-2xl transition font-bold ${isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      cerrarModal();
                      if (modalConfig.onAceptar) modalConfig.onAceptar();
                    }}
                    className="w-1/2 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-2xl transition shadow-md font-bold"
                  >
                    Confirmar
                  </button>
                </>
              ) : (
                <button
                  onClick={cerrarModal}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-2xl transition shadow-md font-black text-xs"
                >
                  Entendido
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Formateador universal de fechas a DD/MM/AAAA
function formatearFechaEspanol(fechaStr: string) {
  if (!fechaStr) return 'N/A';
  const cleanDate = fechaStr.split('T')[0];
  const partes = cleanDate.split(/[-/]/);
  if (partes.length === 3) {
    if (partes[0].length === 4) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return `${partes[0]}/${partes[1]}/${partes[2]}`;
  }
  return fechaStr;
}

// Convertidor de cualquier formato de fecha a ISO (AAAA-MM-DD) para Supabase
function normalizarFechaISO(fechaInput: string) {
  if (!fechaInput) return new Date().toISOString().split('T')[0];
  const partes = fechaInput.trim().split(/[-/]/);
  if (partes.length === 3) {
    if (partes[0].length === 4) {
      return `${partes[0]}-${partes[1].padStart(2, '0')}-${partes[2].padStart(2, '0')}`;
    }
    if (partes[2].length === 4) {
      return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
    }
  }
  return fechaInput;
}

export default function Home() {
  // Estado de Sesión y Autenticación
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Selector de Tema (dark | light | system)
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [effectiveTheme, setEffectiveTheme] = useState<'dark' | 'light'>('dark');

  // Campos del Formulario de Auth
  const [authIdentifier, setAuthIdentifier] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Datos de Registro
  const [regUsername, setRegUsername] = useState('');
  const [regNombre, setRegNombre] = useState('');
  const [regEmail, setRegEmail] = useState('');

  // Estados de CRM
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clientes' | 'prestamos' | 'pagos' | 'csv'>('dashboard');
  const [loading, setLoading] = useState(true);

  // Estados de Datos
  const [clientes, setClientes] = useState<any[]>([]);
  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [quincenas, setQuincenas] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);

  // Formularios CRM
  const hoyISO = new Date().toISOString().split('T')[0];
  
  const [nuevoCliente, setNuevoCliente] = useState({ nombre_completo: '', cedula: '', telefono: '', direccion: '' });
  const [clienteEditar, setClienteEditar] = useState<any>(null);
  
  const [nuevoPrestamo, setNuevoPrestamo] = useState({ 
    cliente_id: '', 
    monto_original: '', 
    tasa_quincenal: '', 
    esquema_cobro: '15_30', 
    fecha_inicio: hoyISO
  });

  const [nuevoPago, setNuevoPago] = useState({ 
    prestamo_id: '', 
    monto_total: '', 
    metodo_pago: 'Yappy', 
    fecha_pago: hoyISO
  });

  const [csvTexto, setCsvTexto] = useState('');

  // EXPEDIENTE DIGITAL Y TUTORIALES
  const [clienteExpediente, setClienteExpediente] = useState<any>(null);
  const [mostrarTutorial, setMostrarTutorial] = useState(false);
  const [tutorialSeccion, setTutorialSeccion] = useState<'general' | 'csv' | 'interes' | 'pwa'>('general');

  // SISTEMA DE MODALES Y ALERTAS NATIVAS PWA
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    tipo: 'alerta' | 'confirmacion' | 'exito' | 'error';
    titulo: string;
    mensaje: string;
    onAceptar?: () => void;
  }>({
    isOpen: false,
    tipo: 'alerta',
    titulo: '',
    mensaje: ''
  });

  // Manejador del Tema (Dark / Light / System)
  useEffect(() => {
    const handleThemeChange = () => {
      if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setEffectiveTheme(isDark ? 'dark' : 'light');
      } else {
        setEffectiveTheme(theme);
      }
    };

    handleThemeChange();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleThemeChange);
    return () => mediaQuery.removeEventListener('change', handleThemeChange);
  }, [theme]);

  function mostrarAlerta(titulo: string, mensaje: string, tipo: 'alerta' | 'exito' | 'error' = 'alerta') {
    setModalConfig({ isOpen: true, tipo, titulo, mensaje });
  }

  function mostrarConfirmacion(titulo: string, mensaje: string, onAceptar: () => void) {
    setModalConfig({ isOpen: true, tipo: 'confirmacion', titulo, mensaje, onAceptar });
  }

  function cerrarModal() {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  }

  function calcularFuerzaPassword(pass: string) {
    if (!pass) return { score: 0, label: '', color: 'bg-gray-800' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) || /[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass) && pass.length >= 8) score += 1;

    if (score === 1) return { score: 1, label: 'Débil', color: 'bg-red-500' };
    if (score === 2) return { score: 2, label: 'Media', color: 'bg-yellow-500' };
    if (score === 3) return { score: 3, label: 'Fuerte', color: 'bg-emerald-500' };
    return { score: 0, label: 'Muy Débil', color: 'bg-red-500' };
  }

  const fuerzaPass = calcularFuerzaPassword(authPassword);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      if (session) cargarDatos(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) cargarDatos(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();

    if (authPassword.length < 8) {
      return mostrarAlerta('Contraseña Muy Corta', 'La contraseña debe tener mínimo 8 caracteres.', 'alerta');
    }

    setIsSubmitting(true);

    try {
      if (isRegistering) {
        if (!regUsername || !regNombre || !regEmail) {
          setIsSubmitting(false);
          return mostrarAlerta('Datos Incompletos', 'Por favor ingresa tu Usuario, Nombre Completo y Correo Electrónico.', 'alerta');
        }

        const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}` : 'https://prestao-app.vercel.app';
        
        const { data, error } = await supabase.auth.signUp({
          email: regEmail,
          password: authPassword,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              username: regUsername.toLowerCase().trim(),
              nombre_completo: regNombre,
            }
          }
        });
        
        setIsSubmitting(false);

        if (error) {
          if (error.message.includes('already registered') || error.message.includes('User already exists')) {
            mostrarAlerta('Cuenta Existente', 'Este correo o usuario ya se encuentra registrado.', 'error');
          } else {
            mostrarAlerta('Error de Registro', error.message, 'error');
          }
        } else if (data?.user && data?.session) {
          mostrarAlerta('Cuenta Creada', 'Bienvenido a Prestao. Tu sesión ha sido iniciada.', 'exito');
        } else {
          mostrarAlerta(
            'Verificación Enviada', 
            `Hemos enviado un correo de confirmación a ${regEmail}. Revisa tu bandeja para activar tu cuenta.`, 
            'exito'
          );
          setIsRegistering(false);
        }
      } else {
        let emailToLogin = authIdentifier.trim();

        if (!emailToLogin.includes('@')) {
          const { data: userMeta } = await supabase
            .from('profiles')
            .select('email')
            .eq('username', emailToLogin.toLowerCase())
            .single();

          if (userMeta?.email) {
            emailToLogin = userMeta.email;
          }
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: emailToLogin,
          password: authPassword,
        });

        setIsSubmitting(false);

        if (error) {
          mostrarAlerta('Error de Acceso', 'Usuario/Correo o contraseña incorrectos.', 'error');
        }
      }
    } catch (err: any) {
      setIsSubmitting(false);
      mostrarAlerta('Error', err.message || 'Ocurrió un error inesperado', 'error');
    }
  }

  async function handleSignOut() {
    mostrarConfirmacion('Cerrar Sesión', '¿Estás seguro de que deseas salir del sistema?', async () => {
      await supabase.auth.signOut();
      setSession(null);
      setClientes([]);
      setPrestamos([]);
      setPagos([]);
    });
  }

  function cambiarPestana(tab: 'dashboard' | 'clientes' | 'prestamos' | 'pagos' | 'csv') {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function cargarDatos(userId?: string) {
    setLoading(true);
    const activeUserId = userId || session?.user?.id;

    if (!supabaseUrl || !supabaseAnonKey || !activeUserId) {
      setLoading(false);
      return;
    }

    const { data: dataClientes } = await supabase.from('clientes').select('*').eq('user_id', activeUserId).order('creado_en', { ascending: false });
    const { data: dataPrestamos } = await supabase.from('prestamos').select('*, clientes(*)').eq('user_id', activeUserId).order('creado_en', { ascending: false });
    const { data: dataQuincenas } = await supabase.from('quincenas_interes').select('*');
    const { data: dataPagos } = await supabase.from('pagos').select('*, prestamos(*, clientes(*))').eq('user_id', activeUserId).order('fecha_pago', { ascending: false });

    if (dataClientes) setClientes(dataClientes);
    if (dataPrestamos) setPrestamos(dataPrestamos);
    if (dataQuincenas) setQuincenas(dataQuincenas);
    if (dataPagos) setPagos(dataPagos);

    setLoading(false);
  }

  function getEstadoCliente(clienteId: string) {
    const prestamosCliente = prestamos.filter(p => p.cliente_id === clienteId && p.estado === 'activo');
    if (prestamosCliente.length === 0) return { label: 'Sin Deuda', color: effectiveTheme === 'dark' ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-300' };

    const hoyStr = new Date().toISOString().split('T')[0];
    let tieneMora = false;

    for (const p of prestamosCliente) {
      const qMora = quincenas.some(q => q.prestamo_id === p.id && q.interes_pendiente > 0 && q.fecha_limite_gracia < hoyStr);
      if (qMora) {
        tieneMora = true;
        break;
      }
    }

    if (tieneMora) return { label: 'En Mora', color: effectiveTheme === 'dark' ? 'bg-red-950/80 text-red-400 border-red-800' : 'bg-red-50 text-red-700 border-red-300' };
    return { label: 'Al Día', color: effectiveTheme === 'dark' ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-300' };
  }

  function limpiarTelefonoPanama(val: string) {
    return val.replace(/\D/g, '').slice(0, 8);
  }

  async function handleGuardarCliente(e: React.FormEvent) {
    e.preventDefault();
    const clienteData = clienteEditar || nuevoCliente;

    if (!clienteData.nombre_completo || !clienteData.cedula || !clienteData.telefono) {
      return mostrarAlerta('Campos Requeridos', 'Por favor ingresa Nombre, Cédula y Teléfono.', 'alerta');
    }

    const telLimpio = limpiarTelefonoPanama(clienteData.telefono);

    if (telLimpio.length < 8) {
      return mostrarAlerta('Teléfono Inválido', 'El teléfono celular debe contener exactamente 8 dígitos numéricos.', 'alerta');
    }

    if (clienteEditar) {
      const { error } = await supabase
        .from('clientes')
        .update({
          nombre_completo: clienteEditar.nombre_completo,
          cedula: clienteEditar.cedula,
          telefono: telLimpio,
          direccion: clienteEditar.direccion
        })
        .eq('id', clienteEditar.id);

      if (error) {
        mostrarAlerta('Error al Actualizar', error.message, 'error');
      } else {
        setClienteEditar(null);
        cargarDatos();
        mostrarAlerta('Cliente Actualizado', 'Los datos del cliente fueron guardados correctamente.', 'exito');
      }
    } else {
      const { error } = await supabase.from('clientes').insert([{
        ...nuevoCliente,
        user_id: session?.user?.id,
        telefono: telLimpio
      }]);

      if (error) {
        mostrarAlerta('Error', 'No se pudo crear el cliente: ' + error.message, 'error');
      } else {
        setNuevoCliente({ nombre_completo: '', cedula: '', telefono: '', direccion: '' });
        cargarDatos();
        mostrarAlerta('Cliente Registrado', 'El cliente fue guardado correctamente.', 'exito');
      }
    }
  }

  function handleBorrarCliente(id: string, nombre: string) {
    mostrarConfirmacion(
      '¿Eliminar Cliente?',
      `¿Estás seguro de eliminar a ${nombre}? Se borrarán sus préstamos y pagos registrados.`,
      async () => {
        const { error } = await supabase.from('clientes').delete().eq('id', id);
        if (error) {
          mostrarAlerta('Error al eliminar', error.message, 'error');
        } else {
          cargarDatos();
          mostrarAlerta('Cliente Eliminado', `${nombre} fue removido del sistema.`, 'exito');
        }
      }
    );
  }

  function descargarPlantillaCSV() {
    const plantilla = "Nombre,Cedula,Telefono,Direccion,MontoPrestamo,TasaQuincenal,FechaInicio,PagoMonto,PagoFecha\n" +
      "Juan Perez,8-888-8888,66666666,Panama,500.00,10,15/01/2026,50.00,30/01/2026\n" +
      "Juan Perez,8-888-8888,66666666,Panama,,,15/02/2026,50.00,15/02/2026\n" +
      "Maria Gomez,3-333-3333,65555555,Colon,1000.00,5,01/02/2026,,";

    const blob = new Blob([plantilla], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'plantilla_prestao_cartera.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleCargarCSV(e: React.FormEvent) {
    e.preventDefault();
    if (!csvTexto.trim()) return mostrarAlerta('Archivo Vacío', 'Pega las filas de tu Excel o CSV para continuar.', 'alerta');

    const filas = csvTexto.trim().split('\n');
    let clientesProcesados = 0;
    let prestamosProcesados = 0;
    let pagosProcesados = 0;

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i].trim();
      if (!fila || fila.toLowerCase().startsWith('nombre')) continue;

      const col = fila.split(',');
      if (col.length >= 3) {
        const nombre = col[0]?.trim();
        const cedula = col[1]?.trim();
        const telefono = limpiarTelefonoPanama(col[2]?.trim() || '');
        const direccion = col[3]?.trim() || 'Panamá';
        const montoPrestamo = col[4]?.trim() ? parseFloat(col[4].trim()) : 0;
        const tasaQuincenal = col[5]?.trim() ? parseFloat(col[5].trim()) : 10;
        const fechaInicio = normalizarFechaISO(col[6]?.trim() || '');
        const pagoMonto = col[7]?.trim() ? parseFloat(col[7].trim()) : 0;
        const pagoFecha = normalizarFechaISO(col[8]?.trim() || '');

        if (cedula) {
          let clienteId = null;
          const { data: clienteExiste } = await supabase
            .from('clientes')
            .select('id')
            .eq('user_id', session?.user?.id)
            .eq('cedula', cedula)
            .single();

          if (clienteExiste) {
            clienteId = clienteExiste.id;
          } else if (nombre && telefono) {
            const { data: clienteNuevo } = await supabase.from('clientes').insert([{
              user_id: session?.user?.id,
              nombre_completo: nombre,
              cedula: cedula,
              telefono: telefono,
              direccion: direccion
            }]).select().single();

            if (clienteNuevo) {
              clienteId = clienteNuevo.id;
              clientesProcesados++;
            }
          }

          if (clienteId) {
            let prestamoId = null;
            let capitalActual = 0;

            if (montoPrestamo > 0) {
              const { data: prestamoNuevo } = await supabase.from('prestamos').insert([{
                user_id: session?.user?.id,
                cliente_id: clienteId,
                monto_original: montoPrestamo,
                capital_pendiente: montoPrestamo,
                tasa_quincenal: tasaQuincenal,
                esquema_cobro: '15_30',
                fecha_inicio: fechaInicio,
                estado: 'activo'
              }]).select().single();

              if (prestamoNuevo) {
                prestamoId = prestamoNuevo.id;
                capitalActual = montoPrestamo;
                prestamosProcesados++;
              }
            } else {
              const { data: prestamoExistente } = await supabase
                .from('prestamos')
                .select('*')
                .eq('user_id', session?.user?.id)
                .eq('cliente_id', clienteId)
                .eq('estado', 'activo')
                .order('creado_en', { ascending: false })
                .limit(1)
                .single();

              if (prestamoExistente) {
                prestamoId = prestamoExistente.id;
                capitalActual = Number(prestamoExistente.capital_pendiente);
              }
            }

            if (prestamoId && pagoMonto > 0) {
              const interesQuincenal = (capitalActual * tasaQuincenal) / 100;
              const aplicadoInteres = Math.min(pagoMonto, interesQuincenal);
              const aplicadoCapital = Math.max(0, pagoMonto - aplicadoInteres);

              await supabase.from('pagos').insert([{
                user_id: session?.user?.id,
                prestamo_id: prestamoId,
                monto_total: pagoMonto,
                aplicado_interes: aplicadoInteres,
                aplicado_capital: aplicadoCapital,
                fecha_pago: pagoFecha,
                notas: 'Importación de Cartera'
              }]);

              const nuevoCapital = Math.max(0, capitalActual - aplicadoCapital);
              await supabase.from('prestamos').update({
                capital_pendiente: nuevoCapital,
                estado: nuevoCapital === 0 ? 'cancelado' : 'activo'
              }).eq('id', prestamoId);

              pagosProcesados++;
            }
          }
        }
      }
    }

    setCsvTexto('');
    cargarDatos();
    mostrarAlerta('Carga Exitosa', `Se procesaron: ${clientesProcesados} nuevos clientes, ${prestamosProcesados} préstamos y ${pagosProcesados} abonos históricos.`, 'exito');
  }

  async function handleCrearPrestamo(e: React.FormEvent) {
    e.preventDefault();
    const monto = parseFloat(nuevoPrestamo.monto_original);
    const tasa = parseFloat(nuevoPrestamo.tasa_quincenal);

    if (!nuevoPrestamo.cliente_id || !monto || isNaN(tasa) || !nuevoPrestamo.fecha_inicio) {
      return mostrarAlerta('Formulario Incompleto', 'Por favor ingresa todos los datos del préstamo incluyendo la fecha.', 'alerta');
    }

    const { error } = await supabase.from('prestamos').insert([{
      user_id: session?.user?.id,
      cliente_id: nuevoPrestamo.cliente_id,
      monto_original: monto,
      capital_pendiente: monto,
      tasa_quincenal: tasa,
      esquema_cobro: nuevoPrestamo.esquema_cobro,
      fecha_inicio: nuevoPrestamo.fecha_inicio,
      estado: 'activo'
    }]);

    if (error) {
      mostrarAlerta('Error', 'No se pudo generar el préstamo: ' + error.message, 'error');
    } else {
      setNuevoPrestamo({ cliente_id: '', monto_original: '', tasa_quincenal: '', esquema_cobro: '15_30', fecha_inicio: hoyISO });
      cargarDatos();
      mostrarAlerta('Préstamo Generado', 'El crédito quedó registrado exitosamente.', 'exito');
    }
  }

  function enviarComprobanteWhatsApp(pago: any, saldoRestanteCalculado?: number) {
    const clienteNombre = pago.prestamos?.clientes?.nombre_completo || 'Cliente';
    const telefonoRaw = pago.prestamos?.clientes?.telefono || '';
    const numLimpio = '507' + limpiarTelefonoPanama(telefonoRaw);

    const saldoFinal = saldoRestanteCalculado !== undefined 
      ? saldoRestanteCalculado 
      : Number(pago.prestamos?.capital_pendiente || 0);

    const mensaje = `*RECIBO DE PAGO - PRESTAO*\n\n` +
      `👤 *Cliente:* ${clienteNombre}\n` +
      `💵 *Monto Abonado:* $${Number(pago.monto_total).toFixed(2)}\n` +
      `📅 *Fecha:* ${formatearFechaEspanol(pago.fecha_pago)}\n` +
      `💳 *Método:* ${pago.notas}\n\n` +
      `Desglose del Abono:\n` +
      `• A Interés: $${Number(pago.aplicado_interes).toFixed(2)}\n` +
      `• A Capital: $${Number(pago.aplicado_capital).toFixed(2)}\n\n` +
      `*Saldo Capital Restante:* $${saldoFinal.toFixed(2)}\n\n` +
      `¡Gracias por tu pago puntual!`;

    const url = `https://wa.me/${numLimpio}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  }

  async function handleRegistrarPago(e: React.FormEvent) {
    e.preventDefault();
    const prestamo = prestamos.find(p => p.id === nuevoPago.prestamo_id);
    const montoAbonado = parseFloat(nuevoPago.monto_total);

    if (!prestamo || !montoAbonado) return mostrarAlerta('Selección Requerida', 'Selecciona un préstamo e ingresa un monto válido.', 'alerta');

    const fechaPagoEval = new Date(nuevoPago.fecha_pago);
    const fechaInicio = new Date(prestamo.fecha_inicio);
    const diasDiferencia = Math.max(1, Math.floor((fechaPagoEval.getTime() - fechaInicio.getTime()) / (1000 * 3600 * 24)));
    const quincenasTranscurridas = Math.max(1, Math.ceil(diasDiferencia / 15));

    const pagosPrevios = pagos.filter(p => p.prestamo_id === prestamo.id);
    const totalInteresYaPagado = pagosPrevios.reduce((acc, curr) => acc + Number(curr.aplicado_interes || 0), 0);

    const interesPorQuincena = (Number(prestamo.capital_pendiente) * Number(prestamo.tasa_quincenal)) / 100;
    const interesTotalAcumuladoHastaHoy = quincenasTranscurridas * interesPorQuincena;
    const interesPendientePorCobrar = Math.max(0, interesTotalAcumuladoHastaHoy - totalInteresYaPagado);

    const aplicadoInteres = Math.min(montoAbonado, interesPendientePorCobrar);
    const aplicadoCapital = Math.max(0, montoAbonado - aplicadoInteres);

    const payloadPago: any = {
      user_id: session?.user?.id,
      prestamo_id: prestamo.id,
      monto_total: montoAbonado,
      aplicado_interes: aplicadoInteres,
      aplicado_capital: aplicadoCapital,
      fecha_pago: nuevoPago.fecha_pago,
      notas: `Método: ${nuevoPago.metodo_pago}`
    };

    const { data: dataPago, error: errPago } = await supabase.from('pagos').insert([payloadPago]).select('*, prestamos(*, clientes(*))').single();

    if (errPago) return mostrarAlerta('Error de Pago', errPago.message, 'error');

    const nuevoCapitalPendiente = Math.max(0, Number(prestamo.capital_pendiente) - aplicadoCapital);
    const nuevoEstado = nuevoCapitalPendiente === 0 ? 'cancelado' : 'activo';

    await supabase.from('prestamos').update({
      capital_pendiente: nuevoCapitalPendiente,
      estado: nuevoEstado
    }).eq('id', prestamo.id);

    setNuevoPago({ prestamo_id: '', monto_total: '', metodo_pago: 'Yappy', fecha_pago: hoyISO });
    cargarDatos();

    mostrarConfirmacion(
      'Cobro Exitoso - ¿Enviar Comprobante?',
      `Abonado: $${aplicadoInteres.toFixed(2)} a Interés | $${aplicadoCapital.toFixed(2)} a Capital. Saldo Restante: $${nuevoCapitalPendiente.toFixed(2)}. ¿Deseas enviar el recibo por WhatsApp al cliente?`,
      () => {
        if (dataPago) enviarComprobanteWhatsApp(dataPago, nuevoCapitalPendiente);
      }
    );
  }

  // Métricas
  const totalCapitalColocado = prestamos.reduce((acc, curr) => acc + Number(curr.monto_original || 0), 0);
  const totalCapitalPendiente = prestamos.reduce((acc, curr) => acc + Number(curr.capital_pendiente || 0), 0);
  const totalInteresCobrado = pagos.reduce((acc, curr) => acc + Number(curr.aplicado_interes || 0), 0);
  const totalInteresPendiente = quincenas.reduce((acc, curr) => acc + Number(curr.interes_pendiente || 0), 0);

  const hoyStr = new Date().toISOString().split('T')[0];
  const totalInteresAtrasado = quincenas
    .filter(q => q.interes_pendiente > 0 && q.fecha_limite_gracia < hoyStr)
    .reduce((acc, curr) => acc + Number(curr.interes_pendiente || 0), 0);

  const isDark = effectiveTheme === 'dark';

  const fieldInputStyle = "w-full bg-white text-black font-extrabold text-sm border border-gray-300 rounded-2xl p-3.5 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all";

  const tabNames: Record<string, string> = {
    dashboard: 'Dashboard',
    clientes: 'Clientes',
    prestamos: 'Préstamos',
    pagos: 'Cobros',
    csv: 'Cargar Cartera'
  };

  if (authLoading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center space-y-3 ${isDark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <p className="text-sm font-bold tracking-wide animate-pulse">Cargando Prestao...</p>
      </div>
    );
  }

  // --- VISTA 1: LOGIN / REGISTRO ---
  if (!session) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
        <style jsx global>{`
          input, select, textarea {
            color: #000000 !important;
            background-color: #ffffff !important;
            -webkit-text-fill-color: #000000 !important;
            opacity: 1 !important;
          }
          input::placeholder {
            color: #6b7280 !important;
            -webkit-text-fill-color: #6b7280 !important;
          }
        `}</style>
        
        <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-6 border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto flex items-center justify-center">
              <img src="/logo.png" alt="Prestao" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-blue-500">Prestao</h1>
            <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Gestor de Microcréditos</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4 text-xs" autoComplete="off">
            {isRegistering ? (
              <>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Nombre de Usuario *</label>
                  <input 
                    type="text" 
                    value={regUsername} 
                    onChange={e => setRegUsername(e.target.value)}
                    className={fieldInputStyle}
                    placeholder="Ej: wilfredo29"
                    required
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Nombre Completo *</label>
                  <input 
                    type="text" 
                    value={regNombre} 
                    onChange={e => setRegNombre(e.target.value)}
                    className={fieldInputStyle}
                    placeholder="Ej: Wilfredo Smith"
                    required
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Correo Electrónico *</label>
                  <input 
                    type="email" 
                    value={regEmail} 
                    onChange={e => setRegEmail(e.target.value)}
                    className={fieldInputStyle}
                    placeholder="correo@ejemplo.com"
                    required
                  />
                </div>
              </>
            ) : (
              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Usuario o Correo Electrónico *</label>
                <input 
                  type="text" 
                  value={authIdentifier} 
                  onChange={e => setAuthIdentifier(e.target.value)}
                  className={fieldInputStyle}
                  placeholder="Usuario o correo"
                  required
                />
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className={`block font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Contraseña *</label>
                <span className="text-[10px] text-gray-400">Mínimo 8 caracteres</span>
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={authPassword} 
                  onChange={e => setAuthPassword(e.target.value)}
                  className={fieldInputStyle}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black font-bold text-xs"
                >
                  {showPassword ? "🙈 Ocultar" : "👁️ Ver"}
                </button>
              </div>

              {authPassword.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className={`flex gap-1 h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                    <div className={`h-full transition-all duration-300 ${fuerzaPass.score >= 1 ? fuerzaPass.color : 'bg-transparent'} w-1/3`} />
                    <div className={`h-full transition-all duration-300 ${fuerzaPass.score >= 2 ? fuerzaPass.color : 'bg-transparent'} w-1/3`} />
                    <div className={`h-full transition-all duration-300 ${fuerzaPass.score >= 3 ? fuerzaPass.color : 'bg-transparent'} w-1/3`} />
                  </div>
                  <p className="text-[10px] text-gray-400 text-right">
                    Seguridad: <span className="font-bold text-gray-200">{fuerzaPass.label}</span>
                  </p>
                </div>
              )}
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-3.5 rounded-2xl transition shadow-lg text-sm text-center tracking-wide"
            >
              {isSubmitting ? 'Procesando...' : isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-gray-800">
            <button 
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthIdentifier('');
                setAuthPassword('');
              }}
              className="text-xs text-blue-400 hover:underline font-semibold"
            >
              {isRegistering ? '¿Ya tienes cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate aquí'}
            </button>
          </div>
        </div>

      </div>
    );
  }

  // --- VISTA 2: CRM DASHBOARD COMPLETO ---
  return (
    <div className={`min-h-screen font-sans py-6 px-4 ${isDark ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <style jsx global>{`
        input, select, textarea {
          color: #000000 !important;
          background-color: #ffffff !important;
          -webkit-text-fill-color: #000000 !important;
          opacity: 1 !important;
        }
        input::placeholder, textarea::placeholder {
          color: #6b7280 !important;
          -webkit-text-fill-color: #6b7280 !important;
        }
        select option {
          color: #000000 !important;
          background-color: #ffffff !important;
        }
      `}</style>

      <div className="max-w-3xl mx-auto space-y-6 min-h-[85vh]">
        
        {/* ENCABEZADO Y NAVEGACIÓN */}
        <header className={`flex flex-col sm:flex-row justify-between items-center gap-4 p-4 rounded-3xl border shadow-lg ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                <img src="/logo.png" alt="Prestao" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-lg font-black text-blue-500 tracking-tight leading-none">Prestao</h1>
                <p className={`text-[10px] mt-0.5 font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Gestor de Microcréditos</p>
              </div>
            </div>
            
            <button 
              onClick={() => setMostrarTutorial(true)}
              className={`text-xs px-3.5 py-2 rounded-2xl font-bold transition flex items-center gap-1 border shadow-sm ${
                isDark ? 'bg-blue-950/80 text-blue-400 border-blue-800/80 hover:bg-blue-900' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
              }`}
            >
              ❓ Ayuda
            </button>
          </div>

          <nav className={`w-full sm:w-auto flex flex-wrap sm:flex-nowrap p-1.5 rounded-2xl border gap-1.5 justify-center ${isDark ? 'bg-gray-950 border-gray-800' : 'bg-gray-100 border-gray-200'}`}>
            {(['dashboard', 'clientes', 'prestamos', 'pagos', 'csv'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => cambiarPestana(tab)}
                className={`flex-1 sm:flex-none py-2.5 px-3 text-center rounded-2xl transition font-bold text-xs whitespace-nowrap min-w-[70px] h-10 flex items-center justify-center ${
                  activeTab === tab 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : isDark ? 'text-gray-400 hover:text-white hover:bg-gray-900' : 'text-gray-600 hover:text-black hover:bg-white'
                }`}
              >
                {tabNames[tab]}
              </button>
            ))}
          </nav>
        </header>

        {/* TARJETA DE MÉTRICAS */}
        <div className={`rounded-3xl p-6 shadow-xl space-y-6 border ${isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className={`text-xs font-semibold tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Capital Activo Pendiente</p>
              <p className="text-3xl sm:text-4xl font-black mt-1 text-blue-500">${totalCapitalPendiente.toFixed(2)}</p>
            </div>
            <div className={`self-start sm:self-center text-xs px-4 py-2 rounded-2xl font-bold border shadow-sm ${
              isDark ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              ${totalInteresCobrado.toFixed(2)} Cobrado
            </div>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
            <div className={`p-4 rounded-2xl border text-center ${isDark ? 'bg-gray-950/60 border-gray-800/80' : 'bg-gray-50 border-gray-200'}`}>
              <p className={`font-medium text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total Prestado</p>
              <p className={`font-black text-base sm:text-lg mt-1 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>${totalCapitalColocado.toFixed(2)}</p>
            </div>
            <div className={`p-4 rounded-2xl border text-center ${isDark ? 'bg-gray-950/60 border-gray-800/80' : 'bg-gray-50 border-gray-200'}`}>
              <p className={`font-medium text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Interés Pendiente</p>
              <p className="font-black text-amber-500 text-base sm:text-lg mt-1">${totalInteresPendiente.toFixed(2)}</p>
            </div>
            <div className={`p-4 rounded-2xl border text-center ${isDark ? 'bg-gray-950/60 border-gray-800/80' : 'bg-gray-50 border-gray-200'}`}>
              <p className={`font-medium text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>En Mora</p>
              <p className="font-black text-red-500 text-base sm:text-lg mt-1">${totalInteresAtrasado.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* VISTAS DE TABS */}
        <main>
          {loading && <p className="text-center text-gray-400 py-12 text-sm font-medium">Cargando información...</p>}

          {!loading && activeTab === 'dashboard' && (
            <div className={`rounded-3xl p-6 border space-y-4 shadow-md ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
              <div className="border-b pb-3 border-gray-800/60">
                <h2 className={`text-base font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Préstamos Activos</h2>
                <p className="text-[11px] text-gray-400 mt-0.5 font-medium">Toca la carpeta 📂 para ver el Expediente del cliente</p>
              </div>

              <div className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                {prestamos.map((p) => {
                  const est = getEstadoCliente(p.cliente_id);
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => setClienteExpediente(p.clientes)}
                      className={`py-4 flex flex-col gap-3 cursor-pointer p-3 rounded-2xl transition border border-transparent ${
                        isDark ? 'hover:bg-gray-800/60 hover:border-gray-700' : 'hover:bg-blue-50/50 hover:border-blue-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl bg-blue-500/10 p-2 rounded-2xl border border-blue-500/20" title="Ver Expediente Digital">📂</span>
                          <div>
                            <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{p.clientes?.nombre_completo || 'N/A'}</p>
                            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Cédula: {p.clientes?.cedula || 'N/A'} | Tel: +507 {p.clientes?.telefono}</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className={`font-black text-base ${isDark ? 'text-white' : 'text-blue-600'}`}>${Number(p.capital_pendiente).toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <span className={`px-3 py-1 rounded-2xl text-[10px] font-bold border whitespace-nowrap ${est.color}`}>
                          {est.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {prestamos.length === 0 && <p className="text-gray-500 py-6 text-xs text-center">No hay préstamos activos registrados en tu cartera.</p>}
              </div>
            </div>
          )}

          {!loading && activeTab === 'clientes' && (
            <div className="space-y-6">
              <div className={`rounded-3xl p-6 border space-y-4 shadow-md ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                <div className="flex justify-between items-center">
                  <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {clienteEditar ? 'Editar Datos del Cliente' : 'Registrar Nuevo Cliente'}
                  </h2>
                  {clienteEditar && (
                    <button
                      onClick={() => setClienteEditar(null)}
                      className="text-xs bg-gray-800 text-gray-300 px-3 py-1 rounded-xl hover:bg-gray-700 transition"
                    >
                      Cancelar Edición
                    </button>
                  )}
                </div>

                <form onSubmit={handleGuardarCliente} className="space-y-3.5 text-xs">
                  <div>
                    <label className={`block font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Nombre Completo *</label>
                    <input 
                      type="text" 
                      value={clienteEditar ? clienteEditar.nombre_completo : nuevoCliente.nombre_completo} 
                      onChange={e => clienteEditar ? setClienteEditar({...clienteEditar, nombre_completo: e.target.value}) : setNuevoCliente({...nuevoCliente, nombre_completo: e.target.value})}
                      className={fieldInputStyle}
                      placeholder="Juan Pérez"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Cédula *</label>
                      <input 
                        type="text" 
                        value={clienteEditar ? clienteEditar.cedula : nuevoCliente.cedula} 
                        onChange={e => clienteEditar ? setClienteEditar({...clienteEditar, cedula: e.target.value}) : setNuevoCliente({...nuevoCliente, cedula: e.target.value})}
                        className={fieldInputStyle}
                        placeholder="8-888-8888"
                      />
                    </div>

                    <div>
                      <label className={`block font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Teléfono Celular (Panamá) *</label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3.5 text-xs font-black text-gray-500 select-none z-10 flex items-center gap-1">
                          🇵🇦 +507
                        </span>
                        <input 
                          type="tel" 
                          maxLength={8}
                          value={clienteEditar ? clienteEditar.telefono : nuevoCliente.telefono} 
                          onChange={e => {
                            const val = limpiarTelefonoPanama(e.target.value);
                            clienteEditar ? setClienteEditar({...clienteEditar, telefono: val}) : setNuevoCliente({...nuevoCliente, telefono: val});
                          }}
                          className={`${fieldInputStyle} pl-20`}
                          placeholder="66666666"
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">Ingresa únicamente los 8 dígitos (sin guiones).</p>
                    </div>
                  </div>

                  <div>
                    <label className={`block font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Dirección</label>
                    <input 
                      type="text" 
                      value={clienteEditar ? clienteEditar.direccion : nuevoCliente.direccion} 
                      onChange={e => clienteEditar ? setClienteEditar({...clienteEditar, direccion: e.target.value}) : setNuevoCliente({...nuevoCliente, direccion: e.target.value})}
                      className={fieldInputStyle}
                      placeholder="Panamá"
                    />
                  </div>

                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-2xl transition mt-2 shadow-md">
                    {clienteEditar ? 'Guardar Cambios' : 'Guardar Cliente'}
                  </button>
                </form>
              </div>

              <div className={`rounded-3xl p-6 border space-y-4 shadow-md ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                <div className="border-b pb-3 border-gray-800/60">
                  <h2 className={`text-base font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Directorio de Clientes ({clientes.length})</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5 font-medium">Toca la carpeta 📂 para abrir el expediente completo</p>
                </div>

                <div className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                  {clientes.map(c => {
                    const est = getEstadoCliente(c.id);
                    return (
                      <div key={c.id} className="py-4 space-y-3">
                        <div 
                          onClick={() => setClienteExpediente(c)}
                          className="cursor-pointer hover:opacity-80 transition flex items-center gap-3"
                        >
                          <span className="text-xl bg-blue-500/10 p-2.5 rounded-2xl border border-blue-500/20 shrink-0" title="Ver Expediente Digital">📂</span>
                          <div>
                            <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{c.nombre_completo}</p>
                            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Cédula: {c.cedula || 'N/A'} | Tel: +507 {c.telefono}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className={`px-3 py-1 rounded-2xl text-[10px] font-bold border whitespace-nowrap ${est.color}`}>
                            {est.label}
                          </span>

                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setClienteEditar(c)}
                              className={`px-3 py-1.5 rounded-2xl font-bold text-xs transition border ${
                                isDark ? 'text-blue-400 bg-blue-950/80 border-blue-800/80 hover:bg-blue-900' : 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100'
                              }`}
                            >
                              Editar
                            </button>
                            <button 
                              onClick={() => handleBorrarCliente(c.id, c.nombre_completo)}
                              className={`px-3 py-1.5 rounded-2xl font-bold text-xs transition border ${
                                isDark ? 'text-red-400 bg-red-950/80 border-red-800/80 hover:bg-red-900' : 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100'
                              }`}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {clientes.length === 0 && <p className="text-gray-500 py-6 text-xs text-center">Aún no has agregado ningún cliente.</p>}
                </div>
              </div>
            </div>
          )}

          {!loading && activeTab === 'prestamos' && (
            <div className={`rounded-3xl p-6 border space-y-4 shadow-md ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
              <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Nuevo Préstamo</h2>
              <form onSubmit={handleCrearPrestamo} className="space-y-3.5 text-xs">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Cliente *</label>
                  <select 
                    value={nuevoPrestamo.cliente_id} 
                    onChange={e => setNuevoPrestamo({...nuevoPrestamo, cliente_id: e.target.value})}
                    className={fieldInputStyle}
                  >
                    <option value="">-- Selecciona Cliente --</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre_completo} (Cédula: {c.cedula})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Monto ($) *</label>
                    <input 
                      type="number" 
                      value={nuevoPrestamo.monto_original} 
                      onChange={e => setNuevoPrestamo({...nuevoPrestamo, monto_original: e.target.value})}
                      className={fieldInputStyle}
                      placeholder="1000.00"
                    />
                  </div>
                  <div>
                    <label className={`block font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Tasa Quincenal (%) *</label>
                    <input 
                      type="number" 
                      value={nuevoPrestamo.tasa_quincenal} 
                      onChange={e => setNuevoPrestamo({...nuevoPrestamo, tasa_quincenal: e.target.value})}
                      className={fieldInputStyle}
                      placeholder="Ej: 5 o 10"
                    />
                  </div>
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Esquema Cobro *</label>
                  <select 
                    value={nuevoPrestamo.esquema_cobro} 
                    onChange={e => setNuevoPrestamo({...nuevoPrestamo, esquema_cobro: e.target.value})}
                    className={fieldInputStyle}
                  >
                    <option value="5_20">Días 5 y 20</option>
                    <option value="10_25">Días 10 y 25</option>
                    <option value="15_30">Días 15 y 30</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Fecha Desembolso *</label>
                  <input 
                    type="date" 
                    value={nuevoPrestamo.fecha_inicio} 
                    onChange={e => setNuevoPrestamo({...nuevoPrestamo, fecha_inicio: e.target.value})}
                    className={fieldInputStyle}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Formato: DD/MM/AAAA (Selección por calendario desplegable)</p>
                </div>

                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-2xl transition mt-2 shadow-md">
                  Generar Préstamo
                </button>
              </form>
            </div>
          )}

          {!loading && activeTab === 'pagos' && (
            <div className="space-y-6">
              <div className={`rounded-3xl p-6 border space-y-4 shadow-md ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Registrar Cobro</h2>
                <form onSubmit={handleRegistrarPago} className="space-y-4 text-xs">
                  <div>
                    <label className={`block font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Préstamo Activo *</label>
                    <select 
                      value={nuevoPago.prestamo_id} 
                      onChange={e => setNuevoPago({...nuevoPago, prestamo_id: e.target.value})}
                      className={fieldInputStyle}
                    >
                      <option value="">-- Selecciona Préstamo --</option>
                      {prestamos.filter(p => p.estado === 'activo').map(p => (
                        <option key={p.id} value={p.id}>
                          {p.clientes?.nombre_completo} (Cédula: {p.clientes?.cedula}) - Saldo: ${Number(p.capital_pendiente).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Monto ($) *</label>
                      <input 
                        type="number" 
                        value={nuevoPago.monto_total} 
                        onChange={e => setNuevoPago({...nuevoPago, monto_total: e.target.value})}
                        className={fieldInputStyle}
                        placeholder="50.00"
                      />
                    </div>
                    <div>
                      <label className={`block font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Método de Pago *</label>
                      <select 
                        value={nuevoPago.metodo_pago} 
                        onChange={e => setNuevoPago({...nuevoPago, metodo_pago: e.target.value})}
                        className={fieldInputStyle}
                      >
                        <option value="Yappy">Yappy</option>
                        <option value="ACH">ACH (Transferencia)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={`block font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Fecha Real de Pago *</label>
                    <input 
                      type="date" 
                      value={nuevoPago.fecha_pago} 
                      onChange={e => setNuevoPago({...nuevoPago, fecha_pago: e.target.value})}
                      className={fieldInputStyle}
                    />
                  </div>

                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-2xl transition shadow-lg">
                    Procesar Cobro
                  </button>
                </form>
              </div>

              <div className={`rounded-3xl p-6 border space-y-4 shadow-md ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Historial de Cobros</h2>
                <div className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                  {pagos.map((p) => (
                    <div key={p.id} className="py-3 flex justify-between items-center text-xs">
                      <div>
                        <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{p.prestamos?.clientes?.nombre_completo || 'N/A'}</p>
                        <p className={`mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatearFechaEspanol(p.fecha_pago)} | {p.notas}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-emerald-500 text-sm">+${Number(p.monto_total).toFixed(2)}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            (Int: ${Number(p.aplicado_interes).toFixed(2)} <span className="text-gray-500 px-1 font-bold">|</span> Cap: ${Number(p.aplicado_capital).toFixed(2)})
                          </p>
                        </div>
                        <button
                          onClick={() => enviarComprobanteWhatsApp(p)}
                          className={`p-2 rounded-2xl font-bold text-xs transition border ${
                            isDark ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80 hover:bg-emerald-900' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                          title="Enviar Recibo por WhatsApp"
                        >
                          📲 WhatsApp
                        </button>
                      </div>
                    </div>
                  ))}
                  {pagos.length === 0 && <p className="text-gray-500 py-6 text-xs text-center">Aún no hay cobros registrados.</p>}
                </div>
              </div>
            </div>
          )}

          {!loading && activeTab === 'csv' && (
            <div className={`rounded-3xl p-6 border space-y-5 shadow-md ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Cargar Cartera e Historial Masivo</h2>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Importa tus préstamos existentes desde Excel en segundos.</p>
                </div>
                <button
                  onClick={descargarPlantillaCSV}
                  className={`px-3.5 py-2 rounded-2xl font-bold text-xs transition flex items-center gap-1.5 shrink-0 border ${
                    isDark ? 'bg-blue-950/80 text-blue-400 border-blue-800/80 hover:bg-blue-900' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  📥 Descargar Plantilla .CSV
                </button>
              </div>

              <div className={`border rounded-2xl p-4 text-xs space-y-3 ${isDark ? 'bg-gray-950/60 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex justify-between items-center">
                  <p className="font-bold text-blue-500 uppercase tracking-wide text-[11px]">Guía Rápida para Cargar tu Cartera:</p>
                  <button 
                    onClick={() => {
                      setTutorialSeccion('csv');
                      setMostrarTutorial(true);
                    }}
                    className="text-[10px] text-blue-500 hover:underline font-bold"
                  >
                    Ver Tutorial Completo ➔
                  </button>
                </div>
                <ol className={`list-decimal list-inside space-y-1.5 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <li>Haz clic en <strong>Descargar Plantilla .CSV</strong> arriba y ábrela en Excel o Google Sheets.</li>
                  <li>Llena tus clientes. Si un mismo cliente tiene <strong>varios préstamos o pagos</strong>, usa su misma <strong>Cédula</strong> en varias filas.</li>
                  <li>Copia las filas desde Excel, pégalas en el cajón de abajo y presiona <strong>Procesar Cartera</strong>.</li>
                </ol>
                <div className={`pt-2 border-t text-[11px] ${isDark ? 'border-gray-800 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                  <span className={`font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Formato de Columnas:</span>
                  <code className={`px-2 py-1 rounded-xl block mt-1 overflow-x-auto font-mono border ${isDark ? 'bg-gray-900 border-gray-800 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}`}>
                    Nombre, Cédula, Teléfono, Dirección, MontoPréstamo, TasaQuincenal(%), FechaInicio(DD/MM/AAAA), MontoPago, FechaPago(DD/MM/AAAA)
                  </code>
                </div>
              </div>

              <form onSubmit={handleCargarCSV} className="space-y-3 text-xs">
                <textarea
                  rows={7}
                  value={csvTexto}
                  onChange={e => setCsvTexto(e.target.value)}
                  placeholder="Juan Perez, 8-888-8888, 66666666, Panama, 500.00, 10, 15/01/2026, 50.00, 30/01/2026&#10;Juan Perez, 8-888-8888, 66666666, Panama, , , 15/02/2026, 50.00, 15/02/2026&#10;Maria Gomez, 3-333-3333, 65555555, Colon, 1000.00, 5, 01/02/2026, ,"
                  className={fieldInputStyle}
                />
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-2xl transition shadow-md">
                  Procesar y Cargar Cartera
                </button>
              </form>
            </div>
          )}
        </main>

        {/* PIE DE PÁGINA CON SELECTOR DE TEMA Y CERRAR SESIÓN */}
        <footer className={`flex flex-col sm:flex-row justify-between items-center gap-4 p-4 rounded-3xl border text-xs ${isDark ? 'bg-gray-900 border-gray-800 text-gray-400' : 'bg-white border-gray-200 text-gray-600'}`}>
          <div className="flex items-center gap-2">
            <span className="font-semibold">Tema:</span>
            <div className={`p-1 rounded-xl border flex gap-1 ${isDark ? 'bg-gray-950 border-gray-800' : 'bg-gray-100 border-gray-200'}`}>
              {(['dark', 'light', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-2.5 py-1 rounded-lg font-bold capitalize transition ${
                    theme === t 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'hover:text-blue-500'
                  }`}
                >
                  {t === 'dark' ? '🌙 Dark' : t === 'light' ? '☀️ Light' : '💻 System'}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={handleSignOut}
            className="text-xs bg-red-950/80 hover:bg-red-900 text-red-400 border border-red-800/80 px-4 py-2 rounded-2xl font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            🔒 Cerrar Sesión
          </button>
        </footer>

      </div>

      {/* MODAL DE TUTORIALES Y GUÍA DE USO */}
      {mostrarTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`border w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 text-xs max-h-[90vh] overflow-y-auto ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
            
            <div className={`flex justify-between items-center border-b pb-3 ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Prestao" className="w-6 h-6 object-contain" />
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Centro de Ayuda Prestao</h3>
              </div>
              <button 
                onClick={() => setMostrarTutorial(false)}
                className="text-gray-400 hover:text-gray-200 font-bold text-base p-1"
              >
                ✕
              </button>
            </div>

            <div className={`grid grid-cols-2 gap-2 border-b pb-3 ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
              {[
                { id: 'general', label: '1. General' },
                { id: 'csv', label: '2. Cargar Cartera' },
                { id: 'interes', label: '3. Interés' },
                { id: 'pwa', label: '4. Botón PWA App' }
              ].map(sec => (
                <button
                  key={sec.id}
                  onClick={() => setTutorialSeccion(sec.id as any)}
                  className={`py-2 px-3 rounded-2xl font-bold text-center text-xs transition border ${
                    tutorialSeccion === sec.id ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : isDark ? 'bg-gray-950 text-gray-400 border-gray-800 hover:bg-gray-800' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {sec.label}
                </button>
              ))}
            </div>

            <div className={`space-y-3 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {tutorialSeccion === 'general' && (
                <>
                  <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>💡 ¿Cómo funciona Prestao?</h4>
                  <p>Prestao administra tus créditos personales separando clientes, préstamos y abonos de forma automatizada.</p>
                  <ul className="list-disc list-inside space-y-1 pl-1">
                    <li><strong>Dashboard:</strong> Muestra el capital colocado, pendiente y montos en mora.</li>
                    <li><strong>Clientes:</strong> Ficha de clientes con su expediente e historial completo al tocar la carpeta 📂.</li>
                    <li><strong>Préstamos:</strong> Registra nuevos préstamos con tasa quincenal.</li>
                    <li><strong>Cobros:</strong> Liquida automáticamente intereses acumulados y amortiza a capital.</li>
                  </ul>
                </>
              )}

              {tutorialSeccion === 'csv' && (
                <>
                  <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>📥 Guía de Carga Masiva desde Excel</h4>
                  <p>Si ya tienes una libreta o Excel con préstamos actuales, impórtala fácilmente:</p>
                  <ol className="list-decimal list-inside space-y-1.5 pl-1">
                    <li>Entra a <strong>Cargar Cartera</strong> y presiona <strong>Descargar Plantilla .CSV</strong>.</li>
                    <li>Completa la tabla en Excel con tus clientes, préstamos y pagos antiguos.</li>
                    <li><strong>Importante:</strong> Usa la **misma cédula** en filas diferentes para vincular múltiples préstamos o abonos a un mismo cliente.</li>
                    <li>Copia las filas desde Excel, pégalas en la app y presiona <strong>Procesar Cartera</strong>.</li>
                  </ol>
                </>
              )}

              {tutorialSeccion === 'interes' && (
                <>
                  <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>🧮 Motor Financiero y Saldo Insoluto</h4>
                  <p>Prestao calcula los intereses sobre el <strong>Capital Restante (Saldo Insoluto)</strong>:</p>
                  <ul className="list-disc list-inside space-y-1 pl-1">
                    <li>Si la deuda es de $1,000 al 10% quincenal, la cuota de interés es $100.</li>
                    <li>Si el cliente abona $300 ($100 a interés y $200 a capital), el saldo baja a $800.</li>
                    <li>En la siguiente quincena el 10% se calcula sobre los **$800 restantes** ($80.00 de interés).</li>
                  </ul>
                </>
              )}

              {tutorialSeccion === 'pwa' && (
                <>
                  <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>📲 Cómo Instalar Prestao como App en tu Pantalla de Inicio</h4>
                  <p>Conviértela en una WebApp sin descargarla de las tiendas oficiales:</p>
                  <div className="space-y-2 pt-1">
                    <p className="font-bold text-blue-500">En iPhone (Safari):</p>
                    <p className="pl-2">Toca el botón <strong>Compartir</strong> (icono del cuadro con la flecha arriba) en la parte inferior de Safari y selecciona <strong>"Agregar a inicio"</strong> ➕.</p>
                    
                    <p className="font-bold text-blue-500">En Android (Chrome):</p>
                    <p className="pl-2">Toca los <strong>3 puntos</strong> de la esquina superior derecha y selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong> 📲.</p>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setMostrarTutorial(false)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-2xl transition mt-4"
            >
              Cerrar Ayuda
            </button>

          </div>
        </div>
      )}

      {/* EXPEDIENTE DIGITAL DE CLIENTE */}
      {clienteExpediente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`border w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 text-xs max-h-[90vh] overflow-y-auto ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
            
            <div className={`flex justify-between items-start border-b pb-3 ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
              <div>
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{clienteExpediente.nombre_completo}</h3>
                <p className="text-gray-400 mt-0.5">Cédula: {clienteExpediente.cedula} | Teléfono: +507 {clienteExpediente.telefono}</p>
                <p className="text-gray-400 mt-0.5">Dirección: {clienteExpediente.direccion || 'Panamá'}</p>
              </div>
              <button 
                onClick={() => setClienteExpediente(null)}
                className="text-gray-400 hover:text-gray-200 font-bold text-base p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-blue-500 uppercase tracking-wide">Préstamos Registrados</h4>
              <div className="space-y-2">
                {prestamos.filter(p => p.cliente_id === clienteExpediente.id).map(p => (
                  <div key={p.id} className={`p-3 rounded-2xl border space-y-1 ${isDark ? 'bg-gray-950/80 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                    <div className={`flex justify-between font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      <span>Monto Original: ${Number(p.monto_original).toFixed(2)}</span>
                      <span className={p.estado === 'activo' ? 'text-amber-500' : 'text-emerald-500'}>
                        {p.estado === 'activo' ? `Pendiente: $${Number(p.capital_pendiente).toFixed(2)}` : 'CANCELADO'}
                      </span>
                    </div>
                    <p className="text-gray-400 text-[11px]">
                      Tasa: {p.tasa_quincenal}% Quincenal | Inicio: {formatearFechaEspanol(p.fecha_inicio)} | Esquema: {p.esquema_cobro}
                    </p>
                  </div>
                ))}
                {prestamos.filter(p => p.cliente_id === clienteExpediente.id).length === 0 && (
                  <p className="text-gray-500 italic">Este cliente no tiene préstamos registrados.</p>
                )}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h4 className="font-bold text-blue-500 uppercase tracking-wide">Historial de Abonos</h4>
              <div className={`divide-y rounded-2xl border p-3 ${isDark ? 'divide-gray-800 bg-gray-950/80 border-gray-800' : 'divide-gray-100 bg-gray-50 border-gray-200'}`}>
                {pagos.filter(p => p.prestamos?.cliente_id === clienteExpediente.id).map(p => (
                  <div key={p.id} className="py-2 flex justify-between items-center">
                    <div>
                      <p className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{formatearFechaEspanol(p.fecha_pago)}</p>
                      <p className="text-gray-400 text-[10px]">{p.notas}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-500">+${Number(p.monto_total).toFixed(2)}</p>
                      <p className="text-[10px] text-gray-500">Int: ${Number(p.aplicado_interes).toFixed(2)} | Cap: ${Number(p.aplicado_capital).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
                {pagos.filter(p => p.prestamos?.cliente_id === clienteExpediente.id).length === 0 && (
                  <p className="text-gray-500 italic text-center py-2">No hay abonos registrados para este cliente.</p>
                )}
              </div>
            </div>

            <button
              onClick={() => setClienteExpediente(null)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-2xl transition"
            >
              Cerrar Expediente
            </button>

          </div>
        </div>
      )}

      {/* MODAL PWA GENERAL */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`border w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 text-center ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
            
            <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-lg font-bold">
              {modalConfig.tipo === 'confirmacion' && <span className="bg-red-500/20 text-red-400 border border-red-500/30 w-full h-full rounded-2xl flex items-center justify-center">⚠️</span>}
              {modalConfig.tipo === 'exito' && <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 w-full h-full rounded-2xl flex items-center justify-center">✓</span>}
              {modalConfig.tipo === 'error' && <span className="bg-red-500/20 text-red-400 border border-red-500/30 w-full h-full rounded-2xl flex items-center justify-center">✕</span>}
              {modalConfig.tipo === 'alerta' && <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 w-full h-full rounded-2xl flex items-center justify-center">ℹ</span>}
            </div>

            <div>
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{modalConfig.titulo}</h3>
              <p className={`text-xs mt-2 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{modalConfig.mensaje}</p>
            </div>

            <div className="flex gap-2 pt-2 text-xs font-semibold">
              {modalConfig.tipo === 'confirmacion' ? (
                <>
                  <button
                    onClick={cerrarModal}
                    className={`w-1/2 py-3 rounded-2xl transition ${isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      cerrarModal();
                      if (modalConfig.onAceptar) modalConfig.onAceptar();
                    }}
                    className="w-1/2 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-2xl transition shadow-md"
                  >
                    Confirmar
                  </button>
                </>
              ) : (
                <button
                  onClick={cerrarModal}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-2xl transition shadow-md font-bold text-xs"
                >
                  Entendido
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
