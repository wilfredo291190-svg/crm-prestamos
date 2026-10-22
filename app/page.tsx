'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  // Estado de Sesión y Autenticación
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
  const [nuevoCliente, setNuevoCliente] = useState({ nombre_completo: '', cedula: '', telefono: '', direccion: '' });
  const [clienteEditar, setClienteEditar] = useState<any>(null);
  
  const [nuevoPrestamo, setNuevoPrestamo] = useState({ 
    cliente_id: '', 
    monto_original: '', 
    tasa_quincenal: '', 
    esquema_cobro: '15_30', 
    dia: '', 
    mes: '', 
    anio: new Date().getFullYear().toString() 
  });
  const [nuevoPago, setNuevoPago] = useState({ 
    prestamo_id: '', 
    monto_total: '', 
    metodo_pago: 'Yappy', 
    dia: '', 
    mes: '', 
    anio: new Date().getFullYear().toString() 
  });
  const [csvTexto, setCsvTexto] = useState('');

  // EXPEDIENTE DIGITAL Y TUTORIALES
  const [clienteExpediente, setClienteExpediente] = useState<any>(null);
  const [mostrarTutorial, setMostrarTutorial] = useState(false);
  const [tutorialSeccion, setTutorialSeccion] = useState<'general' | 'csv' | 'interes' | 'whatsapp'>('general');

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

  function mostrarAlerta(titulo: string, mensaje: string, tipo: 'alerta' | 'exito' | 'error' = 'alerta') {
    setModalConfig({ isOpen: true, tipo, titulo, mensaje });
  }

  function mostrarConfirmacion(titulo: string, mensaje: string, onAceptar: () => void) {
    setModalConfig({ isOpen: true, tipo: 'confirmacion', titulo, mensaje, onAceptar });
  }

  function cerrarModal() {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  }

  // CÁLCULO DE FUERZA DE CONTRASEÑA
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

  // VALIDAR SESIÓN DE SUPABASE
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
          mostrarAlerta('Cuenta Creada', 'Bienvenido a Presta\'o. Tu sesión ha sido iniciada.', 'exito');
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

  // CARGAR DATOS AISLADOS POR USUARIO (MULTITENANCY)
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
    if (prestamosCliente.length === 0) return { label: 'Sin Deuda', color: 'bg-emerald-950/80 text-emerald-400 border-emerald-800' };

    const hoyStr = new Date().toISOString().split('T')[0];
    let tieneMora = false;

    for (const p of prestamosCliente) {
      const qMora = quincenas.some(q => q.prestamo_id === p.id && q.interes_pendiente > 0 && q.fecha_limite_gracia < hoyStr);
      if (qMora) {
        tieneMora = true;
        break;
      }
    }

    if (tieneMora) return { label: 'En Mora', color: 'bg-red-950/80 text-red-400 border-red-800' };
    return { label: 'Al Día', color: 'bg-emerald-950/80 text-emerald-400 border-emerald-800' };
  }

  function formatearTelefono(val: string) {
    const num = val.replace(/\D/g, '');
    if (num.length <= 4) return num;
    return `${num.slice(0, 4)}-${num.slice(4, 8)}`;
  }

  // CREAR O EDITAR CLIENTE
  async function handleGuardarCliente(e: React.FormEvent) {
    e.preventDefault();
    const clienteData = clienteEditar || nuevoCliente;

    if (!clienteData.nombre_completo || !clienteData.cedula || !clienteData.telefono) {
      return mostrarAlerta('Campos Requeridos', 'Por favor ingresa Nombre, Cédula y Teléfono.', 'alerta');
    }

    if (clienteEditar) {
      const { error } = await supabase
        .from('clientes')
        .update({
          nombre_completo: clienteEditar.nombre_completo,
          cedula: clienteEditar.cedula,
          telefono: formatearTelefono(clienteEditar.telefono),
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
        telefono: formatearTelefono(nuevoCliente.telefono)
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

  // DESCARGAR PLANTILLA EXCEL/CSV DE EJEMPLO
  function descargarPlantillaCSV() {
    const plantilla = "Nombre,Cedula,Telefono,Direccion,MontoPrestamo,TasaQuincenal,FechaInicio,PagoMonto,PagoFecha\n" +
      "Juan Perez,8-888-8888,6666-6666,Panama,500.00,10,2026-01-15,50.00,2026-01-30\n" +
      "Juan Perez,8-888-8888,6666-6666,Panama,,,2026-02-15,50.00,2026-02-15\n" +
      "Maria Gomez,3-333-3333,6555-5555,Colon,1000.00,5,2026-02-01,,";

    const blob = new Blob([plantilla], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'plantilla_prestao_cartera.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // CARGA MASIVA AVANZADA DE CARTERA
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
        const telefono = col[2]?.trim();
        const direccion = col[3]?.trim() || 'Panamá';
        const montoPrestamo = col[4]?.trim() ? parseFloat(col[4].trim()) : 0;
        const tasaQuincenal = col[5]?.trim() ? parseFloat(col[5].trim()) : 10;
        const fechaInicio = col[6]?.trim() || new Date().toISOString().split('T')[0];
        const pagoMonto = col[7]?.trim() ? parseFloat(col[7].trim()) : 0;
        const pagoFecha = col[8]?.trim() || new Date().toISOString().split('T')[0];

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
              telefono: formatearTelefono(telefono),
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

    if (!nuevoPrestamo.cliente_id || !monto || isNaN(tasa) || !nuevoPrestamo.dia || !nuevoPrestamo.mes || !nuevoPrestamo.anio) {
      return mostrarAlerta('Formulario Incompleto', 'Por favor ingresa todos los datos del préstamo incluyendo la fecha en formato dd/mm/aaaa.', 'alerta');
    }

    const diaPadded = nuevoPrestamo.dia.padStart(2, '0');
    const mesPadded = nuevoPrestamo.mes.padStart(2, '0');
    const fechaISO = `${nuevoPrestamo.anio}-${mesPadded}-${diaPadded}`;

    const { error } = await supabase.from('prestamos').insert([{
      user_id: session?.user?.id,
      cliente_id: nuevoPrestamo.cliente_id,
      monto_original: monto,
      capital_pendiente: monto,
      tasa_quincenal: tasa,
      esquema_cobro: nuevoPrestamo.esquema_cobro,
      fecha_inicio: fechaISO,
      estado: 'activo'
    }]);

    if (error) {
      mostrarAlerta('Error', 'No se pudo generar el préstamo: ' + error.message, 'error');
    } else {
      setNuevoPrestamo({ cliente_id: '', monto_original: '', tasa_quincenal: '', esquema_cobro: '15_30', dia: '', mes: '', anio: new Date().getFullYear().toString() });
      cargarDatos();
      mostrarAlerta('Préstamo Generado', 'El crédito quedó registrado exitosamente.', 'exito');
    }
  }

  // ENVIAR COMPROBANTE DE PAGO POR WHATSAPP
  function enviarComprobanteWhatsApp(pago: any) {
    const clienteNombre = pago.prestamos?.clientes?.nombre_completo || 'Cliente';
    const telefonoRaw = pago.prestamos?.clientes?.telefono || '';
    const numLimpio = '507' + telefonoRaw.replace(/\D/g, '');

    const mensaje = `*RECIBO DE PAGO - PRESTA'O*\n\n` +
      `👤 *Cliente:* ${clienteNombre}\n` +
      `💵 *Monto Abonado:* $${Number(pago.monto_total).toFixed(2)}\n` +
      `📅 *Fecha:* ${new Date(pago.fecha_pago).toLocaleDateString('es-PA')}\n` +
      `💳 *Método:* ${pago.notas}\n\n` +
      `Desglose del Abono:\n` +
      `• A Interés: $${Number(pago.aplicado_interes).toFixed(2)}\n` +
      `• A Capital: $${Number(pago.aplicado_capital).toFixed(2)}\n\n` +
      `*Saldo Restante:* $${Number(pago.prestamos?.capital_pendiente || 0).toFixed(2)}\n\n` +
      `¡Gracias por tu pago puntual!`;

    const url = `https://wa.me/${numLimpio}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  }

  async function handleRegistrarPago(e: React.FormEvent) {
    e.preventDefault();
    const prestamo = prestamos.find(p => p.id === nuevoPago.prestamo_id);
    const montoAbonado = parseFloat(nuevoPago.monto_total);

    if (!prestamo || !montoAbonado) return mostrarAlerta('Selección Requerida', 'Selecciona un préstamo e ingresa un monto válido.', 'alerta');

    let fechaPagoEval = new Date();
    if (nuevoPago.dia && nuevoPago.mes && nuevoPago.anio) {
      const diaPadded = nuevoPago.dia.padStart(2, '0');
      const mesPadded = nuevoPago.mes.padStart(2, '0');
      fechaPagoEval = new Date(`${nuevoPago.anio}-${mesPadded}-${diaPadded}`);
    }

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
      fecha_pago: fechaPagoEval.toISOString().split('T')[0],
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

    setNuevoPago({ prestamo_id: '', monto_total: '', metodo_pago: 'Yappy', dia: '', mes: '', anio: new Date().getFullYear().toString() });
    cargarDatos();

    mostrarConfirmacion(
      'Cobro Exitoso - ¿Enviar Comprobante?',
      `Abonado: $${aplicadoInteres.toFixed(2)} a Interés | $${aplicadoCapital.toFixed(2)} a Capital. ¿Deseas enviar el recibo por WhatsApp al cliente?`,
      () => {
        if (dataPago) enviarComprobanteWhatsApp(dataPago);
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
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-sm font-semibold text-gray-400 animate-pulse">Cargando Presta'o...</p>
      </div>
    );
  }

  // --- VISTA 1: LOGIN / REGISTRO ---
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
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
        
        <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-6">
          
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto bg-gray-950 rounded-2xl border border-gray-800 p-2.5 flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <path d="M 15 85 V 15 C 15 10, 20 5, 28 5 H 38 C 46 5, 52 10, 52 15 V 35 L 70 20 C 76 15, 85 17, 89 23 C 93 29, 91 38, 85 42 L 52 65 V 85 C 52 90, 46 95, 38 95 H 28 C 20 95, 15 90, 15 85 Z" fill="#1D4ED8"/>
                <path d="M 45 10 C 72 10, 95 24, 95 50 C 95 72, 75 88, 52 88 L 38 88 L 52 74 C 68 74, 78 63, 78 50 C 78 36, 64 26, 45 26 H 36 V 10 Z" fill="#38BDF8"/>
              </svg>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-wide">Presta'o</h1>
            <p className="text-xs text-gray-400">Gestión Inteligente de Créditos</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4 text-xs" autoComplete="off">
            {isRegistering ? (
              <>
                <div>
                  <label className="block font-semibold text-gray-300 mb-1">Nombre de Usuario *</label>
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
                  <label className="block font-semibold text-gray-300 mb-1">Nombre Completo *</label>
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
                  <label className="block font-semibold text-gray-300 mb-1">Correo Electrónico *</label>
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
                <label className="block font-semibold text-gray-300 mb-1">Usuario o Correo Electrónico *</label>
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
                <label className="block font-semibold text-gray-300">Contraseña *</label>
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
                  <div className="flex gap-1 h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
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

        {modalConfig.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4 text-center">
              
              <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-lg font-bold">
                {modalConfig.tipo === 'confirmacion' && <span className="bg-red-500/20 text-red-400 border border-red-500/30 w-full h-full rounded-2xl flex items-center justify-center">⚠️</span>}
                {modalConfig.tipo === 'exito' && <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 w-full h-full rounded-2xl flex items-center justify-center">✓</span>}
                {modalConfig.tipo === 'error' && <span className="bg-red-500/20 text-red-400 border border-red-500/30 w-full h-full rounded-2xl flex items-center justify-center">✕</span>}
                {modalConfig.tipo === 'alerta' && <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 w-full h-full rounded-2xl flex items-center justify-center">ℹ</span>}
              </div>

              <div>
                <h3 className="text-base font-bold text-white">{modalConfig.titulo}</h3>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">{modalConfig.mensaje}</p>
              </div>

              <button
                onClick={cerrarModal}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-2xl transition shadow-md font-bold text-xs"
              >
                Entendido
              </button>

            </div>
          </div>
        )}
      </div>
    );
  }

  // --- VISTA 2: CRM DASHBOARD COMPLETO ---
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans py-6 px-4">
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
        <header className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-900 p-4 rounded-2xl border border-gray-800 shadow-lg">
          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gray-950 border border-gray-800 p-1.5 flex items-center justify-center shadow-md shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <path d="M 15 85 V 15 C 15 10, 20 5, 28 5 H 38 C 46 5, 52 10, 52 15 V 35 L 70 20 C 76 15, 85 17, 89 23 C 93 29, 91 38, 85 42 L 52 65 V 85 C 52 90, 46 95, 38 95 H 28 C 20 95, 15 90, 15 85 Z" fill="#1D4ED8"/>
                  <path d="M 45 10 C 72 10, 95 24, 95 50 C 95 72, 75 88, 52 88 L 38 88 L 52 74 C 68 74, 78 63, 78 50 C 78 36, 64 26, 45 26 H 36 V 10 Z" fill="#38BDF8"/>
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-white tracking-wide leading-none">Presta'o</h1>
                <p className="text-[10px] text-gray-400 mt-0.5">Gestión Inteligente de Créditos</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => setMostrarTutorial(true)}
                className="text-xs bg-blue-950/80 hover:bg-blue-900 text-blue-400 border border-blue-800/80 px-3 py-2 rounded-2xl font-bold transition flex items-center gap-1 shadow-sm"
              >
                ❓ Ayuda
              </button>
              <button 
                onClick={handleSignOut}
                className="sm:hidden text-xs bg-red-950/80 hover:bg-red-900 text-red-400 border border-red-800/80 px-3 py-2 rounded-2xl font-bold transition shrink-0 h-10 flex items-center justify-center shadow-sm"
              >
                Salir
              </button>
            </div>
          </div>

          <nav className="w-full sm:w-auto flex flex-wrap sm:flex-nowrap bg-gray-950 p-1.5 rounded-2xl border border-gray-800 gap-1.5 justify-center">
            {(['dashboard', 'clientes', 'prestamos', 'pagos', 'csv'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => cambiarPestana(tab)}
                className={`flex-1 sm:flex-none py-2.5 px-3 text-center rounded-2xl transition font-bold text-xs whitespace-nowrap min-w-[70px] h-10 flex items-center justify-center ${
                  activeTab === tab 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-900'
                }`}
              >
                {tabNames[tab]}
              </button>
            ))}
          </nav>

          <button 
            onClick={handleSignOut}
            className="hidden sm:flex text-xs bg-red-950/80 hover:bg-red-900 text-red-400 border border-red-800/80 px-4 py-2.5 rounded-2xl font-bold transition shrink-0 h-10 items-center justify-center shadow-sm"
          >
            Cerrar Sesión
          </button>
        </header>

        {/* TARJETA DE MÉTRICAS */}
        <div className="bg-gray-900 border border-gray-800 text-white rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-400 font-semibold tracking-wide">Capital Activo Pendiente</p>
              <p className="text-3xl sm:text-4xl font-black mt-1 text-white">${totalCapitalPendiente.toFixed(2)}</p>
            </div>
            <div className="self-start sm:self-center bg-emerald-950/80 text-emerald-400 text-xs px-4 py-2 rounded-2xl font-bold border border-emerald-800/80 shadow-sm">
              ${totalInteresCobrado.toFixed(2)} Cobrado
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-gray-800">
            <div className="bg-gray-950/60 p-4 rounded-2xl border border-gray-800/80 text-center">
              <p className="text-gray-400 font-medium text-xs">Total Prestado</p>
              <p className="font-black text-gray-200 text-base sm:text-lg mt-1">${totalCapitalColocado.toFixed(2)}</p>
            </div>
            <div className="bg-gray-950/60 p-4 rounded-2xl border border-gray-800/80 text-center">
              <p className="text-gray-400 font-medium text-xs">Interés Pendiente</p>
              <p className="font-black text-yellow-400 text-base sm:text-lg mt-1">${totalInteresPendiente.toFixed(2)}</p>
            </div>
            <div className="bg-gray-950/60 p-4 rounded-2xl border border-gray-800/80 text-center">
              <p className="text-gray-400 font-medium text-xs">En Mora</p>
              <p className="font-black text-red-400 text-base sm:text-lg mt-1">${totalInteresAtrasado.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* VISTAS DE TABS */}
        <main>
          {loading && <p className="text-center text-gray-400 py-12 text-sm font-medium">Cargando información...</p>}

          {!loading && activeTab === 'dashboard' && (
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4 shadow-md">
              <h2 className="text-base font-bold text-white">Préstamos Activos</h2>
              <div className="divide-y divide-gray-800">
                {prestamos.map((p) => {
                  const est = getEstadoCliente(p.cliente_id);
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => setClienteExpediente(p.clientes)}
                      className="py-4 flex justify-between items-center text-xs cursor-pointer hover:bg-gray-800/50 p-2 rounded-xl transition"
                    >
                      <div>
                        <p className="font-bold text-white text-sm">{p.clientes?.nombre_completo || 'N/A'}</p>
                        <p className="text-gray-400 mt-0.5">Cédula: {p.clientes?.cedula || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-white text-sm">${Number(p.capital_pendiente).toFixed(2)}</p>
                        <span className={`inline-block mt-1 px-3 py-1 rounded-2xl text-[10px] font-bold border ${est.color}`}>
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
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4 shadow-md">
                <div className="flex justify-between items-center">
                  <h2 className="text-base font-bold text-white">
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
                    <label className="block font-semibold text-gray-300 mb-1">Nombre Completo *</label>
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
                      <label className="block font-semibold text-gray-300 mb-1">Cédula *</label>
                      <input 
                        type="text" 
                        value={clienteEditar ? clienteEditar.cedula : nuevoCliente.cedula} 
                        onChange={e => clienteEditar ? setClienteEditar({...clienteEditar, cedula: e.target.value}) : setNuevoCliente({...nuevoCliente, cedula: e.target.value})}
                        className={fieldInputStyle}
                        placeholder="8-888-8888"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-300 mb-1">Teléfono *</label>
                      <input 
                        type="text" 
                        value={clienteEditar ? clienteEditar.telefono : nuevoCliente.telefono} 
                        onChange={e => clienteEditar ? setClienteEditar({...clienteEditar, telefono: e.target.value}) : setNuevoCliente({...nuevoCliente, telefono: e.target.value})}
                        className={fieldInputStyle}
                        placeholder="6666-6666"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-300 mb-1">Dirección</label>
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

              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4 shadow-md">
                <h2 className="text-base font-bold text-white">Directorio de Clientes ({clientes.length})</h2>
                <div className="divide-y divide-gray-800">
                  {clientes.map(c => {
                    const est = getEstadoCliente(c.id);
                    return (
                      <div key={c.id} className="py-3 flex justify-between items-center text-xs">
                        <div 
                          onClick={() => setClienteExpediente(c)}
                          className="cursor-pointer hover:underline"
                        >
                          <p className="font-bold text-white text-sm">{c.nombre_completo}</p>
                          <p className="text-gray-400 mt-0.5">Cédula: {c.cedula || 'N/A'} | Tel: {c.telefono}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-2xl text-[10px] font-bold border ${est.color}`}>
                            {est.label}
                          </span>
                          <button 
                            onClick={() => setClienteEditar(c)}
                            className="text-blue-400 hover:text-blue-300 bg-blue-950/80 border border-blue-800/80 px-2.5 py-1 rounded-2xl font-bold text-[11px] transition hover:bg-blue-900"
                          >
                            Editar
                          </button>
                          <button 
                            onClick={() => handleBorrarCliente(c.id, c.nombre_completo)}
                            className="text-red-400 hover:text-red-300 bg-red-950/80 border border-red-800/80 px-2.5 py-1 rounded-2xl font-bold text-[11px] transition hover:bg-red-900"
                          >
                            Eliminar
                          </button>
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
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4 shadow-md">
              <h2 className="text-base font-bold text-white">Nuevo Préstamo</h2>
              <form onSubmit={handleCrearPrestamo} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-gray-300 mb-1">Cliente *</label>
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
                    <label className="block font-semibold text-gray-300 mb-1">Monto ($) *</label>
                    <input 
                      type="number" 
                      value={nuevoPrestamo.monto_original} 
                      onChange={e => setNuevoPrestamo({...nuevoPrestamo, monto_original: e.target.value})}
                      className={fieldInputStyle}
                      placeholder="1000.00"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-300 mb-1">Tasa Quincenal (%) *</label>
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
                  <label className="block font-semibold text-gray-300 mb-1">Esquema Cobro *</label>
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
                  <label className="block font-semibold text-gray-300 mb-1">Fecha Desembolso (dd/mm/aaaa) *</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input 
                      type="number" 
                      min="1" 
                      max="31"
                      value={nuevoPrestamo.dia} 
                      onChange={e => setNuevoPrestamo({...nuevoPrestamo, dia: e.target.value})}
                      className={fieldInputStyle}
                      placeholder="DD"
                    />
                    <input 
                      type="number" 
                      min="1" 
                      max="12"
                      value={nuevoPrestamo.mes} 
                      onChange={e => setNuevoPrestamo({...nuevoPrestamo, mes: e.target.value})}
                      className={fieldInputStyle}
                      placeholder="MM"
                    />
                    <input 
                      type="number" 
                      value={nuevoPrestamo.anio} 
                      onChange={e => setNuevoPrestamo({...nuevoPrestamo, anio: e.target.value})}
                      className={fieldInputStyle}
                      placeholder="AAAA"
                    />
                  </div>
                </div>

                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-2xl transition mt-2 shadow-md">
                  Generar Préstamo
                </button>
              </form>
            </div>
          )}

          {!loading && activeTab === 'pagos' && (
            <div className="space-y-6">
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4 shadow-md">
                <h2 className="text-base font-bold text-white">Registrar Cobro</h2>
                <form onSubmit={handleRegistrarPago} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-gray-300 mb-1">Préstamo Activo *</label>
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
                      <label className="block font-semibold text-gray-300 mb-1">Monto ($) *</label>
                      <input 
                        type="number" 
                        value={nuevoPago.monto_total} 
                        onChange={e => setNuevoPago({...nuevoPago, monto_total: e.target.value})}
                        className={fieldInputStyle}
                        placeholder="50.00"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-300 mb-1">Método de Pago *</label>
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
                    <label className="block font-semibold text-gray-300 mb-1">Fecha Real de Pago (Opcional: dd/mm/aaaa)</label>
                    <div className="grid grid-cols-3 gap-2">
                      <input 
                        type="number" 
                        min="1" 
                        max="31"
                        value={nuevoPago.dia} 
                        onChange={e => setNuevoPago({...nuevoPago, dia: e.target.value})}
                        className={fieldInputStyle}
                        placeholder="DD"
                      />
                      <input 
                        type="number" 
                        min="1" 
                        max="12"
                        value={nuevoPago.mes} 
                        onChange={e => setNuevoPago({...nuevoPago, mes: e.target.value})}
                        className={fieldInputStyle}
                        placeholder="MM"
                      />
                      <input 
                        type="number" 
                        value={nuevoPago.anio} 
                        onChange={e => setNuevoPago({...nuevoPago, anio: e.target.value})}
                        className={fieldInputStyle}
                        placeholder="AAAA"
                      />
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-2xl transition shadow-lg">
                    Procesar Cobro
                  </button>
                </form>
              </div>

              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4 shadow-md">
                <h2 className="text-base font-bold text-white">Historial de Cobros</h2>
                <div className="divide-y divide-gray-800">
                  {pagos.map((p) => (
                    <div key={p.id} className="py-3 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold text-white text-sm">{p.prestamos?.clientes?.nombre_completo || 'N/A'}</p>
                        <p className="text-gray-400 mt-0.5">{new Date(p.fecha_pago).toLocaleDateString('es-PA')} | {p.notas}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-emerald-400 text-sm">+${Number(p.monto_total).toFixed(2)}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            (Int: ${Number(p.aplicado_interes).toFixed(2)} <span className="text-gray-600 px-1 font-bold">|</span> Cap: ${Number(p.aplicado_capital).toFixed(2)})
                          </p>
                        </div>
                        <button
                          onClick={() => enviarComprobanteWhatsApp(p)}
                          className="bg-emerald-950/80 hover:bg-emerald-900 text-emerald-400 border border-emerald-800/80 p-2 rounded-2xl font-bold text-xs transition"
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
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-5 shadow-md">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className="text-base font-bold text-white">Cargar Cartera e Historial Masivo</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Importa tus préstamos existentes desde Excel en segundos.</p>
                </div>
                <button
                  onClick={descargarPlantillaCSV}
                  className="bg-blue-950/80 hover:bg-blue-900 text-blue-400 border border-blue-800/80 px-3.5 py-2 rounded-2xl font-bold text-xs transition flex items-center gap-1.5 shrink-0"
                >
                  📥 Descargar Plantilla .CSV
                </button>
              </div>

              <div className="bg-gray-950/60 border border-gray-800 rounded-2xl p-4 text-xs space-y-3">
                <div className="flex justify-between items-center">
                  <p className="font-bold text-blue-400 uppercase tracking-wide text-[11px]">Guía Rápida para Cargar tu Cartera:</p>
                  <button 
                    onClick={() => {
                      setTutorialSeccion('csv');
                      setMostrarTutorial(true);
                    }}
                    className="text-[10px] text-blue-400 hover:underline font-bold"
                  >
                    Ver Tutorial Completo ➔
                  </button>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-gray-300 leading-relaxed">
                  <li>Haz clic en <strong>Descargar Plantilla .CSV</strong> arriba y ábrela en Excel o Google Sheets.</li>
                  <li>Llena tus clientes. Si un mismo cliente tiene <strong>varios préstamos o pagos</strong>, usa su misma <strong>Cédula</strong> en varias filas.</li>
                  <li>Copia las filas desde Excel, pégalas en el cajón de abajo y presiona <strong>Procesar Cartera</strong>.</li>
                </ol>
                <div className="pt-2 border-t border-gray-800/80 text-[11px] text-gray-400">
                  <span className="font-semibold text-gray-300">Formato de Columnas:</span>
                  <code className="bg-gray-900 px-2 py-1 rounded-xl text-gray-200 block mt-1 overflow-x-auto font-mono">
                    Nombre, Cédula, Teléfono, Dirección, MontoPréstamo, TasaQuincenal(%), FechaInicio(AAAA-MM-DD), MontoPago, FechaPago(AAAA-MM-DD)
                  </code>
                </div>
              </div>

              <form onSubmit={handleCargarCSV} className="space-y-3 text-xs">
                <textarea
                  rows={7}
                  value={csvTexto}
                  onChange={e => setCsvTexto(e.target.value)}
                  placeholder="Juan Perez, 8-888-8888, 6666-6666, Panama, 500.00, 10, 2026-01-15, 50.00, 2026-01-30&#10;Juan Perez, 8-888-8888, 6666-6666, Panama, , , 2026-02-15, 50.00, 2026-02-15&#10;Maria Gomez, 3-333-3333, 6555-5555, Colon, 1000.00, 5, 2026-02-01, ,"
                  className={fieldInputStyle}
                />
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-2xl transition shadow-md">
                  Procesar y Cargar Cartera
                </button>
              </form>
            </div>
          )}
        </main>

      </div>

      {/* MODAL DE TUTORIALES Y GUÍA DE USO */}
      {mostrarTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5 text-xs max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">📖 Centro de Ayuda Presta'o</h3>
                <p className="text-gray-400 text-[11px] mt-0.5">Aprende a gestionar tu cartera como un profesional.</p>
              </div>
              <button 
                onClick={() => setMostrarTutorial(false)}
                className="text-gray-400 hover:text-white font-bold text-base p-1"
              >
                ✕
              </button>
            </div>

            {/* BOTONES DE NAVEGACIÓN DEL TUTORIAL */}
            <div className="flex gap-2 border-b border-gray-800 pb-2 overflow-x-auto">
              {[
                { id: 'general', label: '1. General' },
                { id: 'csv', label: '2. Cargar Cartera' },
                { id: 'interes', label: '3. Interés e Aislamiento' },
                { id: 'whatsapp', label: '4. Recibos WhatsApp' }
              ].map(sec => (
                <button
                  key={sec.id}
                  onClick={() => setTutorialSeccion(sec.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap text-[11px] transition ${
                    tutorialSeccion === sec.id ? 'bg-blue-600 text-white' : 'bg-gray-950 text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  {sec.label}
                </button>
              ))}
            </div>

            {/* SECCIONES DEL TUTORIAL */}
            <div className="space-y-3 leading-relaxed text-gray-300">
              {tutorialSeccion === 'general' && (
                <>
                  <h4 className="font-bold text-white text-sm">💡 ¿Cómo funciona Presta'o?</h4>
                  <p>Presta'o te ayuda a administrar tus créditos personales separando clientes, préstamos y abonos de forma automatizada.</p>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li><strong>Dashboard:</strong> Muestra tu capital colocado, pendiente y montos en mora.</li>
                    <li><strong>Clientes:</strong> Guarda el nombre, cédula y teléfono de tus clientes. Puedes ver su ficha haciendo clic en su nombre.</li>
                    <li><strong>Préstamos:</strong> Registra nuevos préstamos con tasa quincenal (5%, 8%, 10%, etc.).</li>
                    <li><strong>Cobros:</strong> Procesa abonos en Yappy o ACH. El sistema liquida automáticamente primero el interés y luego reduce el capital.</li>
                  </ul>
                </>
              )}

              {tutorialSeccion === 'csv' && (
                <>
                  <h4 className="font-bold text-white text-sm">📥 Guía de Carga Masiva desde Excel</h4>
                  <p>Si ya tienes una libreta o Excel con tus préstamos actuales, puedes importarla de un solo golpe:</p>
                  <ol className="list-decimal list-inside space-y-1.5 pl-2">
                    <li>Entra a la pestaña <strong>Cargar Cartera</strong> y presiona <strong>Descargar Plantilla .CSV</strong>.</li>
                    <li>Abre el archivo en Excel y completa las columnas: <code>Nombre, Cédula, Teléfono, Dirección, MontoPréstamo, TasaQuincenal, FechaInicio, MontoPago, FechaPago</code>.</li>
                    <li><strong>Para Múltiples Pagos o Préstamos:</strong> Si un cliente tiene 2 préstamos o 3 abonos pasados, usa su **misma cédula** en filas diferentes. El sistema vinculará las operaciones al mismo cliente.</li>
                    <li>Copia todas las filas en Excel, pégalas en el recuadro de la app y presiona <strong>Procesar Cartera</strong>.</li>
                  </ol>
                </>
              )}

              {tutorialSeccion === 'interes' && (
                <>
                  <h4 className="font-bold text-white text-sm">🧮 Motor Financiero y Prelación</h4>
                  <p>Presta'o calcula los intereses de forma justa sobre el <strong>Saldo Insoluto (Capital Restante)</strong>:</p>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li>Si alguien te debe $1,000 al 10% quincenal, paga $100 de interés por quincena.</li>
                    <li>Si el cliente abona $300 ($100 a interés y $200 a capital), su nuevo saldo será $800.</li>
                    <li>Para la siguiente quincena, el 10% se calculará sobre los **$800 restantes** ($80.00 de interés), reduciendo la cuota del cliente.</li>
                  </ul>
                </>
              )}

              {tutorialSeccion === 'whatsapp' && (
                <>
                  <h4 className="font-bold text-white text-sm">📲 Envío de Recibos por WhatsApp</h4>
                  <p>Cada vez que registras un cobro en la pestaña <strong>Cobros</strong> o abres el historial de cobros:</p>
                  <p>Verás el botón verde <strong>📲 WhatsApp</strong>. Al presionarlo, Presta'o abrirá tu WhatsApp y redactará automáticamente un comprobante con el desglose abonado (interés / capital) y el saldo pendiente restante.</p>
                </>
              )}
            </div>

            <button
              onClick={() => setMostrarTutorial(false)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition mt-4"
            >
              Entendido / Cerrar Ayuda
            </button>

          </div>
        </div>
      )}

      {/* EXPEDIENTE DIGITAL DE CLIENTE */}
      {clienteExpediente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5 text-xs max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-start border-b border-gray-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">{clienteExpediente.nombre_completo}</h3>
                <p className="text-gray-400 mt-0.5">Cédula: {clienteExpediente.cedula} | Teléfono: {clienteExpediente.telefono}</p>
                <p className="text-gray-500 mt-0.5">Dirección: {clienteExpediente.direccion || 'Panamá'}</p>
              </div>
              <button 
                onClick={() => setClienteExpediente(null)}
                className="text-gray-400 hover:text-white font-bold text-base p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-blue-400 uppercase tracking-wide">Préstamos Registrados</h4>
              <div className="space-y-2">
                {prestamos.filter(p => p.cliente_id === clienteExpediente.id).map(p => (
                  <div key={p.id} className="bg-gray-950/80 p-3 rounded-xl border border-gray-800 space-y-1">
                    <div className="flex justify-between font-bold text-white">
                      <span>Monto Original: ${Number(p.monto_original).toFixed(2)}</span>
                      <span className={p.estado === 'activo' ? 'text-yellow-400' : 'text-emerald-400'}>
                        {p.estado === 'activo' ? `Pendiente: $${Number(p.capital_pendiente).toFixed(2)}` : 'CANCELADO'}
                      </span>
                    </div>
                    <p className="text-gray-400 text-[11px]">
                      Tasa: {p.tasa_quincenal}% Quincenal | Inicio: {new Date(p.fecha_inicio).toLocaleDateString('es-PA')} | Esquema: {p.esquema_cobro}
                    </p>
                  </div>
                ))}
                {prestamos.filter(p => p.cliente_id === clienteExpediente.id).length === 0 && (
                  <p className="text-gray-500 italic">Este cliente no tiene préstamos registrados.</p>
                )}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h4 className="font-bold text-blue-400 uppercase tracking-wide">Historial de Abonos</h4>
              <div className="divide-y divide-gray-800 bg-gray-950/80 rounded-xl border border-gray-800 p-3">
                {pagos.filter(p => p.prestamos?.cliente_id === clienteExpediente.id).map(p => (
                  <div key={p.id} className="py-2 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-200">{new Date(p.fecha_pago).toLocaleDateString('es-PA')}</p>
                      <p className="text-gray-400 text-[10px]">{p.notas}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-400">+${Number(p.monto_total).toFixed(2)}</p>
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
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition"
            >
              Cerrar Expediente
            </button>

          </div>
        </div>
      )}

      {/* MODAL PWA GENERAL */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4 text-center">
            
            <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-lg font-bold">
              {modalConfig.tipo === 'confirmacion' && <span className="bg-red-500/20 text-red-400 border border-red-500/30 w-full h-full rounded-2xl flex items-center justify-center">⚠️</span>}
              {modalConfig.tipo === 'exito' && <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 w-full h-full rounded-2xl flex items-center justify-center">✓</span>}
              {modalConfig.tipo === 'error' && <span className="bg-red-500/20 text-red-400 border border-red-500/30 w-full h-full rounded-2xl flex items-center justify-center">✕</span>}
              {modalConfig.tipo === 'alerta' && <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 w-full h-full rounded-2xl flex items-center justify-center">ℹ</span>}
            </div>

            <div>
              <h3 className="text-base font-bold text-white">{modalConfig.titulo}</h3>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">{modalConfig.mensaje}</p>
            </div>

            <div className="flex gap-2 pt-2 text-xs font-semibold">
              {modalConfig.tipo === 'confirmacion' ? (
                <>
                  <button
                    onClick={cerrarModal}
                    className="w-1/2 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-2xl transition"
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
